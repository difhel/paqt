import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import { join, relative, resolve } from 'path';
import { SAFE_PATTERNS, CAREFUL_PATTERNS, DANGEROUS_PATTERNS, ALL_PATTERNS, SuspiciousPattern, getPatternsByCategory } from './patterns.js';

export interface CleanOptions {
  dryRun?: boolean;
  includeCareful?: boolean;
  includeDangerous?: boolean;
  patterns?: string[];
  interactive?: boolean;
}

export interface CleanStats {
  scannedDirs: number;
  deletedDirs: number;
  deletedFiles: number;
  freedSpace: number; // in bytes
  skippedDirs: number;
}

/**
 * Get the size of a directory in bytes
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    // Use du -sk to get size in KB, then convert to bytes
    // This is more reliable across different systems
    const output = execSync(`du -sk "${dirPath}" 2>/dev/null`, { 
      encoding: 'utf-8',
      timeout: 120000, // 2 minutes for large directories
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer
    });
    
    // Parse the output - du returns "SIZE\tPATH"
    const lines = output.trim().split('\n');
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      const sizeMatch = firstLine.match(/^(\d+)/);
      if (sizeMatch) {
        const sizeInKB = parseInt(sizeMatch[1]);
        if (!isNaN(sizeInKB)) {
          return sizeInKB * 1024; // Convert KB to bytes
        }
      }
    }
    
    // Fallback: try with -s flag only (returns 512-byte blocks)
    const fallbackOutput = execSync(`du -s "${dirPath}" 2>/dev/null`, { 
      encoding: 'utf-8',
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 50
    });
    
    const fallbackLines = fallbackOutput.trim().split('\n');
    if (fallbackLines.length > 0) {
      const fallbackLine = fallbackLines[0].trim();
      const fallbackMatch = fallbackLine.match(/^(\d+)/);
      if (fallbackMatch) {
        const fallbackSize = parseInt(fallbackMatch[1]);
        if (!isNaN(fallbackSize)) {
          return fallbackSize * 512; // Convert 512-byte blocks to bytes
        }
      }
    }
    
    return 0;
  } catch (error) {
    // Final fallback: try to estimate with find (slower but more reliable)
    try {
      const output = execSync(`find "${dirPath}" -type f -print0 2>/dev/null | xargs -0 wc -c 2>/dev/null | tail -1 | awk '{print $1}'`, { 
        encoding: 'utf-8',
        timeout: 180000, // 3 minutes for find
        maxBuffer: 1024 * 1024 * 100 // 100MB buffer
      });
      const totalSize = parseInt(output.trim());
      return isNaN(totalSize) ? 0 : totalSize;
    } catch {
      // If all else fails, return 0
      return 0;
    }
  }
}

/**
 * Count files in a directory
 */
async function countFiles(dirPath: string): Promise<number> {
  try {
    const output = execSync(`find "${dirPath}" -type f 2>/dev/null | wc -l`, { 
      encoding: 'utf-8',
      timeout: 120000, // 2 minutes for large directories
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer
    });
    const count = parseInt(output.trim());
    return isNaN(count) ? 0 : count;
  } catch (error) {
    // Fallback: try with a simpler approach
    try {
      const output = execSync(`ls -1A "${dirPath}" 2>/dev/null | wc -l`, { 
        encoding: 'utf-8',
        timeout: 30000 
      });
      const count = parseInt(output.trim());
      return isNaN(count) ? 0 : count;
    } catch {
      return 0;
    }
  }
}

/**
 * Find directories matching the specified patterns
 */
async function findMatchingDirectories(
  basePath: string, 
  patterns: SuspiciousPattern[]
): Promise<{ path: string; pattern: SuspiciousPattern; size: number; fileCount: number }[]> {
  const results: { path: string; pattern: SuspiciousPattern; size: number; fileCount: number }[] = [];
  
  for (const pattern of patterns) {
    try {
      const output = execSync(`find "${basePath}" -type d -name "*${pattern.pattern}*" 2>/dev/null`, { 
        encoding: 'utf-8',
        timeout: 60000,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      const paths = output.trim().split('\n').filter(p => p.trim());
      
      for (const path of paths) {
        if (path.trim()) {
          const size = await getDirectorySize(path);
          const fileCount = await countFiles(path);
          results.push({
            path: path.trim(),
            pattern,
            size,
            fileCount
          });
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not search for pattern ${pattern.pattern}: ${(error as Error).message}`);
    }
  }
  
  return results.sort((a, b) => b.size - a.size); // Sort by size, largest first
}

/**
 * Ask user for confirmation in interactive mode
 */
function askConfirmation(message: string): boolean {
  try {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // This is a simplified version - in a real implementation you'd want proper async handling
    // For now, we'll default to requiring explicit confirmation via CLI flags
    rl.close();
    return false;
  } catch {
    return false;
  }
}

/**
 * Clean directories based on specified patterns and options
 */
export async function cleanDirectories(folderPath: string, options: CleanOptions = {}): Promise<CleanStats> {
  const resolvedPath = resolve(folderPath);
  
  console.log(`🧹 Cleaning folder: ${resolvedPath}`);
  
  // Check if folder exists
  try {
    const stats = await fs.stat(resolvedPath);
    if (!stats.isDirectory()) {
      console.error(`Error: ${resolvedPath} is not a directory`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: Folder ${resolvedPath} does not exist`);
    process.exit(1);
  }
  
  const stats: CleanStats = {
    scannedDirs: 0,
    deletedDirs: 0,
    deletedFiles: 0,
    freedSpace: 0,
    skippedDirs: 0
  };
  
  // Determine which patterns to use
  let patternsToUse: SuspiciousPattern[] = [...SAFE_PATTERNS];
  
  if (options.patterns) {
    // Use specific patterns provided by user
    patternsToUse = options.patterns
      .map(p => ALL_PATTERNS.find(pattern => pattern.pattern === p))
      .filter((p): p is SuspiciousPattern => p !== undefined);
  } else {
    // Use patterns based on safety level
    if (options.includeCareful) {
      patternsToUse.push(...CAREFUL_PATTERNS);
    }
    if (options.includeDangerous) {
      patternsToUse.push(...DANGEROUS_PATTERNS);
    }
  }
  
  if (patternsToUse.length === 0) {
    console.log('❌ No patterns specified for cleaning');
    return stats;
  }
  
  console.log(`🔍 Scanning for directories matching ${patternsToUse.length} patterns...`);
  if (options.dryRun) {
    console.log('📋 DRY RUN MODE - No files will be deleted');
  }
  
  // Display patterns being used
  console.log('\n📋 Patterns to clean:');
  const safePatterns = patternsToUse.filter(p => p.category === 'safe');
  const carefulPatterns = patternsToUse.filter(p => p.category === 'careful');
  const dangerousPatterns = patternsToUse.filter(p => p.category === 'dangerous');
  
  if (safePatterns.length > 0) {
    console.log('  🟢 Safe patterns:', safePatterns.map(p => p.pattern).join(', '));
  }
  if (carefulPatterns.length > 0) {
    console.log('  🟡 Careful patterns:', carefulPatterns.map(p => p.pattern).join(', '));
  }
  if (dangerousPatterns.length > 0) {
    console.log('  🔴 Dangerous patterns:', dangerousPatterns.map(p => p.pattern).join(', '));
  }
  
  // Find matching directories
  const matchingDirs = await findMatchingDirectories(resolvedPath, patternsToUse);
  stats.scannedDirs = matchingDirs.length;
  
  if (matchingDirs.length === 0) {
    console.log('\n✅ No directories found matching the specified patterns');
    return stats;
  }
  
  // Group by pattern for better display
  const groupedByPattern = matchingDirs.reduce((acc, item) => {
    const key = item.pattern.pattern;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, typeof matchingDirs>);
  
  console.log(`\n📊 Found ${matchingDirs.length} directories to clean:`);
  console.log('═'.repeat(80));
  
  for (const [patternName, dirs] of Object.entries(groupedByPattern)) {
    const pattern = dirs[0].pattern;
    const totalSize = dirs.reduce((sum, d) => sum + d.size, 0);
    const totalFiles = dirs.reduce((sum, d) => sum + d.fileCount, 0);
    const categoryIcon = pattern.category === 'safe' ? '🟢' : pattern.category === 'careful' ? '🟡' : '🔴';
    
    console.log(`\n${categoryIcon} ${pattern.description} (${patternName}):`);
    console.log(`   📁 Directories: ${dirs.length}`);
    console.log(`   📄 Files: ${totalFiles.toLocaleString()}`);
    console.log(`   💾 Total size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   📝 Reason: ${pattern.reason}`);
    
    // Show largest directories
    const topDirs = dirs.slice(0, 3);
    if (topDirs.length > 0) {
      console.log('   📂 Largest directories:');
      topDirs.forEach((dir, index) => {
        const relativePath = relative(resolvedPath, dir.path);
        const sizeMB = (dir.size / (1024 * 1024)).toFixed(1);
        console.log(`      ${index + 1}. ${relativePath} (${sizeMB} MB, ${dir.fileCount} files)`);
      });
    }
  }
  
  const totalSize = matchingDirs.reduce((sum, d) => sum + d.size, 0);
  const totalFiles = matchingDirs.reduce((sum, d) => sum + d.fileCount, 0);
  
  console.log('\n' + '═'.repeat(80));
  console.log(`💾 Total space to free: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`📄 Total files to delete: ${totalFiles.toLocaleString()}`);
  console.log('═'.repeat(80));
  
  if (options.dryRun) {
    console.log('\n📋 DRY RUN completed - no files were deleted');
    console.log('💡 Run without --dry-run to perform actual deletion');
    return stats;
  }
  
  // Warn about dangerous patterns
  if (dangerousPatterns.length > 0) {
    console.log('\n⚠️  WARNING: You are about to delete directories with DANGEROUS patterns!');
    dangerousPatterns.forEach(p => {
      console.log(`   🔴 ${p.pattern}: ${p.reason}`);
    });
    console.log('\n❗ This action cannot be undone!');
  }
  
  console.log('\n🗑️  Starting deletion...');
  
  // Delete directories
  for (const dir of matchingDirs) {
    try {
      const relativePath = relative(resolvedPath, dir.path);
      console.log(`   Deleting: ${relativePath} (${(dir.size / (1024 * 1024)).toFixed(1)} MB)`);
      
      await fs.rm(dir.path, { recursive: true, force: true });
      
      stats.deletedDirs++;
      stats.deletedFiles += dir.fileCount;
      stats.freedSpace += dir.size;
      
    } catch (error) {
      console.warn(`   ❌ Failed to delete ${relative(resolvedPath, dir.path)}: ${(error as Error).message}`);
      stats.skippedDirs++;
    }
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log('✅ CLEANING COMPLETED');
  console.log('═'.repeat(80));
  console.log(`📁 Directories deleted: ${stats.deletedDirs}`);
  console.log(`📄 Files deleted: ${stats.deletedFiles.toLocaleString()}`);
  console.log(`💾 Space freed: ${(stats.freedSpace / (1024 * 1024)).toFixed(2)} MB`);
  if (stats.skippedDirs > 0) {
    console.log(`⚠️  Directories skipped: ${stats.skippedDirs}`);
  }
  console.log('═'.repeat(80));

  return stats;
}
