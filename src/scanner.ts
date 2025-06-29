import { promises as fs } from 'fs';
import { join, relative, resolve } from 'path';
import { execSync } from 'child_process';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { FileMetadata, ScanOptions } from './types.js';
import { isSymlink, toISOString } from './utils.js';
import { ALL_PATTERNS } from './patterns.js';

/**
 * Run a diagnostic command and capture its output safely
 */
function runDiagnosticCommand(command: string, description: string): string {
  try {
    const output = execSync(command, { 
      encoding: 'utf-8', 
      timeout: 10000, // 10 second timeout
      maxBuffer: 1024 * 1024 // 1MB buffer
    });
    return output.trim();
  } catch (error) {
    return `Failed to run ${description}: ${(error as Error).message}`;
  }
}

/**
 * Analyze a problematic directory and provide detailed diagnostics
 */
async function analyzeProblematicDirectory(dirPath: string, basePath: string, issueType: string): Promise<string[]> {
  const relativePath = relative(basePath, dirPath);
  const analysis: string[] = [];
  
  analysis.push(`\n🔍 Detailed analysis of problematic directory: '${relativePath}'`);
  
  try {
    // Check if directory exists and get basic info
    const stats = await fs.stat(dirPath);
    analysis.push(`   📁 Type: ${stats.isDirectory() ? 'Directory' : stats.isFile() ? 'File' : 'Other'}`);
    analysis.push(`   📏 Size: ${(stats.size / 1024).toFixed(2)} KB`);
    analysis.push(`   📅 Modified: ${stats.mtime.toISOString()}`);
  } catch (error) {
    analysis.push(`   ❌ Cannot access: ${(error as Error).message}`);
    return analysis;
  }
  
  if (issueType.includes('STACK_OVERFLOW') || issueType.includes('DEEP_NESTING')) {
    // Find deepest paths in this directory
    analysis.push(`\n   🔍 Finding deepest nested paths...`);
    const deepestPaths = runDiagnosticCommand(
      `find "${dirPath}" -type d 2>/dev/null | head -20 | while read dir; do echo "$(echo "$dir" | tr '/' '\\n' | wc -l) $dir"; done | sort -nr | head -5`,
      'deepest paths analysis'
    );
    if (deepestPaths && !deepestPaths.startsWith('Failed')) {
      analysis.push(`   📊 Top 5 deepest paths:`);
      deepestPaths.split('\n').forEach((line, index) => {
        if (line.trim()) {
          const [depth, ...pathParts] = line.trim().split(' ');
          const path = pathParts.join(' ');
          const relPath = relative(basePath, path);
          analysis.push(`      ${index + 1}. Depth ${depth}: ${relPath}`);
        }
      });
    } else {
      analysis.push(`   ⚠️  ${deepestPaths}`);
    }
    
    // Count total directories and files
    const dirCount = runDiagnosticCommand(
      `find "${dirPath}" -type d 2>/dev/null | wc -l`,
      'directory count'
    );
    const fileCount = runDiagnosticCommand(
      `find "${dirPath}" -type f 2>/dev/null | wc -l`,
      'file count'
    );
    
    analysis.push(`\n   📊 Contents summary:`);
    analysis.push(`      Directories: ${dirCount.replace(/\s+/g, '')}`);
    analysis.push(`      Files: ${fileCount.replace(/\s+/g, '')}`);
    
    // Check for suspicious patterns
    analysis.push(`\n   🔍 Checking for common problematic patterns...`);
    for (const pattern of ALL_PATTERNS) {
      const count = runDiagnosticCommand(
        `find "${dirPath}" -type d -name "*${pattern.pattern}*" 2>/dev/null | wc -l`,
        `${pattern.pattern} directories`
      );
      const countNum = parseInt(count.replace(/\s+/g, ''));
      if (countNum > 0) {
        const categoryIcon = pattern.category === 'safe' ? '🟢' : pattern.category === 'careful' ? '🟡' : '🔴';
        analysis.push(`      ${categoryIcon} Found ${countNum} ${pattern.description} directories (${pattern.pattern})`);
        
        // Show first few examples
        const examples = runDiagnosticCommand(
          `find "${dirPath}" -type d -name "*${pattern.pattern}*" 2>/dev/null | head -3`,
          `${pattern.pattern} examples`
        );
        if (examples && !examples.startsWith('Failed')) {
          examples.split('\n').forEach(example => {
            if (example.trim()) {
              const relExample = relative(basePath, example.trim());
              analysis.push(`         📁 ${relExample}`);
            }
          });
        }
      }
    }
  }
  
  if (issueType.includes('CIRCULAR_SYMLINK')) {
    // Analyze symlinks
    analysis.push(`\n   🔗 Analyzing symlinks...`);
    const symlinks = runDiagnosticCommand(
      `find "${dirPath}" -type l -ls 2>/dev/null | head -10`,
      'symlink analysis'
    );
    if (symlinks && !symlinks.startsWith('Failed') && symlinks.trim()) {
      analysis.push(`   📊 Found symlinks:`);
      symlinks.split('\n').forEach((line, index) => {
        if (line.trim() && index < 5) {
          analysis.push(`      ${index + 1}. ${line.trim()}`);
        }
      });
    } else {
      analysis.push(`   ✅ No symlinks found or ${symlinks}`);
    }
    
    // Check for broken symlinks
    const brokenSymlinks = runDiagnosticCommand(
      `find "${dirPath}" -type l ! -exec test -e {} \\; -print 2>/dev/null | head -5`,
      'broken symlinks'
    );
    if (brokenSymlinks && !brokenSymlinks.startsWith('Failed') && brokenSymlinks.trim()) {
      analysis.push(`\n   💔 Broken symlinks found:`);
      brokenSymlinks.split('\n').forEach((line, index) => {
        if (line.trim()) {
          const relPath = relative(basePath, line.trim());
          analysis.push(`      ${index + 1}. ${relPath}`);
        }
      });
    }
  }
  
  if (issueType.includes('PERMISSION_DENIED')) {
    // Check permissions
    analysis.push(`\n   🔒 Permission analysis...`);
    const permissions = runDiagnosticCommand(
      `ls -la "${dirPath}" 2>/dev/null | head -10`,
      'permission check'
    );
    if (permissions && !permissions.startsWith('Failed')) {
      analysis.push(`   📋 Directory permissions:`);
      permissions.split('\n').slice(0, 5).forEach(line => {
        if (line.trim()) {
          analysis.push(`      ${line.trim()}`);
        }
      });
    }
  }
  
  return analysis;
}

/**
 * Recursively scan a directory and collect file metadata
 */
async function scanDirectory(
  dirPath: string,
  basePath: string,
  existingFiles: Set<string>,
  visitedPaths: Set<string> = new Set(),
  depth: number = 0,
  maxDepth: number = 50,
  diagnostics: { skippedPaths: string[]; issues: string[]; detailedAnalysis: string[] } = { skippedPaths: [], issues: [], detailedAnalysis: [] }
): Promise<FileMetadata[]> {
  const entries: FileMetadata[] = [];
  
  // Prevent infinite recursion with depth limit
  if (depth > maxDepth) {
    const relativePath = relative(basePath, dirPath);
    diagnostics.skippedPaths.push(relativePath);
    diagnostics.issues.push(`DEEP_NESTING: Directory '${relativePath}' exceeds maximum depth of ${maxDepth} levels. This may indicate a circular symlink or extremely deep folder structure.`);
    return entries;
  }
  
  // Resolve real path to handle symlinks properly
  let realPath: string;
  try {
    realPath = await fs.realpath(dirPath);
  } catch (error) {
    const relativePath = relative(basePath, dirPath);
    diagnostics.skippedPaths.push(relativePath);
    diagnostics.issues.push(`PERMISSION_DENIED: Cannot access directory '${relativePath}'. Check file permissions or run with appropriate privileges.`);
    return entries;
  }
  
  // Check for circular references
  if (visitedPaths.has(realPath)) {
    const relativePath = relative(basePath, dirPath);
    diagnostics.skippedPaths.push(relativePath);
    const issueType = 'CIRCULAR_SYMLINK';
    diagnostics.issues.push(`${issueType}: Circular symlink detected at '${relativePath}' -> '${relative(basePath, realPath)}'. Consider removing or fixing the symlink.`);
    
    // Perform detailed analysis for circular symlinks
    try {
      const analysis = await analyzeProblematicDirectory(dirPath, basePath, issueType);
      diagnostics.detailedAnalysis.push(...analysis);
    } catch (analysisError) {
      diagnostics.detailedAnalysis.push(`Failed to analyze ${relativePath}: ${(analysisError as Error).message}`);
    }
    
    return entries;
  }
  
  // Mark this path as visited
  visitedPaths.add(realPath);
  
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = join(dirPath, item.name);
      const relativePath = relative(basePath, fullPath);
      
      // Skip symlinks
      if (item.isSymbolicLink() || isSymlink(item.name)) {
        continue;
      }
      
      // Skip metadata.csv to avoid circular reference
      if (item.name === 'metadata.csv') {
        continue;
      }
      
      if (item.isDirectory()) {
        // Recursively scan subdirectories with updated depth and visited paths
        try {
          const subEntries = await scanDirectory(
            fullPath, 
            basePath, 
            existingFiles, 
            new Set(visitedPaths), // Pass a copy to avoid sharing state between siblings
            depth + 1, 
            maxDepth,
            diagnostics
          );
          entries.push(...subEntries);
        } catch (error) {
          const relativePath = relative(basePath, fullPath);
          diagnostics.skippedPaths.push(relativePath);
          
          if (error instanceof RangeError && error.message.includes('Maximum call stack')) {
            const issueType = 'STACK_OVERFLOW';
            diagnostics.issues.push(`${issueType}: Directory '${relativePath}' contains extremely deep nesting that causes stack overflow. This likely indicates a problematic symlink structure. Check for symlinks with: 'find "${fullPath}" -type l -ls'`);
            
            // Perform detailed analysis asynchronously
            try {
              const analysis = await analyzeProblematicDirectory(fullPath, basePath, issueType);
              diagnostics.detailedAnalysis.push(...analysis);
            } catch (analysisError) {
              diagnostics.detailedAnalysis.push(`Failed to analyze ${relativePath}: ${(analysisError as Error).message}`);
            }
          } else {
            const issueType = 'SCAN_ERROR';
            diagnostics.issues.push(`${issueType}: Failed to scan directory '${relativePath}': ${(error as Error).message || error}. Check file permissions and disk integrity.`);
            
            // Perform detailed analysis for permission errors
            if ((error as Error).message?.includes('permission') || (error as Error).message?.includes('EACCES')) {
              try {
                const analysis = await analyzeProblematicDirectory(fullPath, basePath, 'PERMISSION_DENIED');
                diagnostics.detailedAnalysis.push(...analysis);
              } catch (analysisError) {
                diagnostics.detailedAnalysis.push(`Failed to analyze ${relativePath}: ${(analysisError as Error).message}`);
              }
            }
          }
          // Continue processing other directories instead of crashing
        }
      } else if (item.isFile()) {
        // Skip if this file already exists (for append-only mode)
        if (existingFiles.has(relativePath)) {
          continue;
        }
        
        try {
          const stats = await fs.stat(fullPath);
          entries.push({
            path: relativePath,
            modifiedTime: toISOString(stats.mtime)
          });
        } catch (error) {
          diagnostics.skippedPaths.push(relativePath);
          diagnostics.issues.push(`FILE_ACCESS_ERROR: Cannot read file '${relativePath}': ${(error as Error).message || error}. Check file permissions or if the file still exists.`);
          // Continue processing other files
        }
      }
    }
  } catch (error) {
    const relativePath = relative(basePath, dirPath);
    diagnostics.skippedPaths.push(relativePath);
    diagnostics.issues.push(`DIRECTORY_READ_ERROR: Cannot read directory '${relativePath}': ${(error as Error).message || error}. Check permissions and disk integrity.`);
    // Don't exit the process, just skip this directory
  }
  
  // Remove from visited paths when done (for cleanup)
  visitedPaths.delete(realPath);
  
  return entries;
}

/**
 * Load existing metadata from CSV file
 */
async function loadExistingMetadata(csvPath: string): Promise<FileMetadata[]> {
  try {
    const csvContent = await fs.readFile(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    return records.map((record: any) => ({
      path: record.path,
      modifiedTime: record.modifiedTime
    }));
  } catch (error) {
    // File doesn't exist or is invalid, return empty array
    return [];
  }
}

/**
 * Write metadata to CSV file
 */
async function writeMetadata(csvPath: string, metadata: FileMetadata[]): Promise<void> {
  const csvContent = stringify(metadata, {
    header: true,
    columns: ['path', 'modifiedTime']
  });
  
  await fs.writeFile(csvPath, csvContent, 'utf-8');
}

/**
 * Scan a folder and generate/update metadata.csv
 */
export async function scanFolder(folderPath: string, options: ScanOptions = {}): Promise<void> {
  const resolvedPath = resolve(folderPath);
  
  console.log(`Scanning folder: ${resolvedPath}`);
  
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
  
  const csvPath = join(resolvedPath, 'metadata.csv');
  let allMetadata: FileMetadata[] = [];
  let existingFiles = new Set<string>();
  
  if (options.appendOnly) {
    console.log('Loading existing metadata...');
    const existingMetadata = await loadExistingMetadata(csvPath);
    allMetadata = existingMetadata;
    existingFiles = new Set(existingMetadata.map(m => m.path));
    console.log(`Found ${existingMetadata.length} existing entries`);
  }
  
  console.log('Scanning files...');
  const diagnostics: { skippedPaths: string[]; issues: string[]; detailedAnalysis: string[] } = { skippedPaths: [], issues: [], detailedAnalysis: [] };
  const newMetadata = await scanDirectory(resolvedPath, resolvedPath, existingFiles, new Set(), 0, 50, diagnostics);
  
  // Report any issues found during scanning
  if (diagnostics.issues.length > 0) {
    console.log(`\n⚠️  Issues encountered during scan (${diagnostics.skippedPaths.length} paths skipped):`);
    console.log('═'.repeat(80));
    
    diagnostics.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
    
    console.log('═'.repeat(80));
    console.log('\n💡 Suggested fixes:');
    
    if (diagnostics.issues.some(i => i.includes('CIRCULAR_SYMLINK'))) {
      console.log('   • For circular symlinks: Remove problematic symlinks or fix their targets');
      console.log('   • Find symlinks: find /path/to/folder -type l -ls');
    }
    
    if (diagnostics.issues.some(i => i.includes('STACK_OVERFLOW') || i.includes('DEEP_NESTING'))) {
      console.log('   • For deep nesting/stack overflow: Check for broken symlinks creating infinite loops');
      console.log('   • Find broken symlinks: find /path/to/folder -type l ! -exec test -e {} \\; -print');
    }
    
    if (diagnostics.issues.some(i => i.includes('PERMISSION_DENIED') || i.includes('FILE_ACCESS_ERROR'))) {
      console.log('   • For permission errors: Check file ownership and permissions');
      console.log('   • Fix permissions: chmod -R u+r /path/to/folder');
    }
    
    console.log(`\n📁 Successfully scanned ${newMetadata.length} files, skipped ${diagnostics.skippedPaths.length} problematic paths`);
    
    // Display detailed analysis
    if (diagnostics.detailedAnalysis.length > 0) {
      console.log('\n' + '═'.repeat(80));
      console.log('📋 DETAILED DIAGNOSTIC ANALYSIS');
      console.log('═'.repeat(80));
      diagnostics.detailedAnalysis.forEach(line => console.log(line));
      console.log('═'.repeat(80));
    }
    
    console.log('');
  }
  
  // Combine existing and new metadata
  allMetadata.push(...newMetadata);
  
  // Sort by path for consistent output
  allMetadata.sort((a, b) => a.path.localeCompare(b.path));
  
  console.log(`Writing metadata for ${allMetadata.length} files...`);
  await writeMetadata(csvPath, allMetadata);
  
  console.log(`✓ Metadata saved to ${csvPath}`);
  if (options.appendOnly && newMetadata.length > 0) {
    console.log(`  Added ${newMetadata.length} new files`);
  }
}

/**
 * Check if metadata.csv exists in the given folder
 */
export async function hasMetadata(folderPath: string): Promise<boolean> {
  const csvPath = join(resolve(folderPath), 'metadata.csv');
  try {
    await fs.access(csvPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load metadata from a folder's metadata.csv
 */
export async function loadMetadata(folderPath: string): Promise<FileMetadata[]> {
  const csvPath = join(resolve(folderPath), 'metadata.csv');
  return loadExistingMetadata(csvPath);
} 