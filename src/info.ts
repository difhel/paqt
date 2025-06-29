import { existsSync, statSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { homedir } from 'os';

/**
 * Interface for directory statistics
 */
interface DirectoryStats {
  totalSize: number;
  fileCount: number;
  dirCount: number;
  largestDirs: Array<{ path: string; size: number; }>;
  largestFiles: Array<{ path: string; size: number; }>;
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get directory size in bytes
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const output = execSync(`du -sk "${dirPath}" 2>/dev/null`, { 
      encoding: 'utf-8',
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 50
    });
    
    const lines = output.trim().split('\n');
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      const sizeMatch = firstLine.match(/^(\d+)/);
      if (sizeMatch) {
        const sizeInKB = parseInt(sizeMatch[1]);
        if (!isNaN(sizeInKB)) {
          return sizeInKB * 1024;
        }
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Count files and directories
 */
async function getCounts(dirPath: string): Promise<{ files: number; dirs: number }> {
  try {
    // Count files
    const fileOutput = execSync(`find "${dirPath}" -type f 2>/dev/null | wc -l`, { 
      encoding: 'utf-8',
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 50
    });
    const fileCount = parseInt(fileOutput.trim()) || 0;

    // Count directories  
    const dirOutput = execSync(`find "${dirPath}" -type d 2>/dev/null | wc -l`, { 
      encoding: 'utf-8',
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 50
    });
    const dirCount = parseInt(dirOutput.trim()) || 0;

    return { files: fileCount, dirs: dirCount - 1 }; // Subtract 1 to exclude the root directory
  } catch {
    return { files: 0, dirs: 0 };
  }
}

/**
 * Get top 10 largest directories
 */
async function getLargestDirectories(dirPath: string): Promise<Array<{ path: string; size: number; }>> {
  try {
    const output = execSync(`du -sk "${dirPath}"/* 2>/dev/null | sort -nr | head -10`, { 
      encoding: 'utf-8',
      timeout: 180000,
      maxBuffer: 1024 * 1024 * 100
    });
    
    const lines = output.trim().split('\n').filter(line => line.trim());
    const results: Array<{ path: string; size: number; }> = [];
    
    for (const line of lines) {
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (match) {
        const sizeInKB = parseInt(match[1]);
        const path = match[2];
        if (!isNaN(sizeInKB)) {
          // Get relative path
          const relativePath = path.replace(dirPath + '/', '').replace(dirPath, '.');
          results.push({
            path: relativePath,
            size: sizeInKB * 1024
          });
        }
      }
    }
    
    return results;
  } catch {
    return [];
  }
}

/**
 * Get top 10 largest files
 */
async function getLargestFiles(dirPath: string): Promise<Array<{ path: string; size: number; }>> {
  try {
    const output = execSync(`find "${dirPath}" -type f -exec ls -la {} + 2>/dev/null | sort -k5 -nr | head -10`, { 
      encoding: 'utf-8',
      timeout: 180000,
      maxBuffer: 1024 * 1024 * 100
    });
    
    const lines = output.trim().split('\n').filter(line => line.trim());
    const results: Array<{ path: string; size: number; }> = [];
    
    for (const line of lines) {
      // Parse ls -la output: permissions links owner group size date time filename
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 9) {
        const size = parseInt(parts[4]);
        const filename = parts.slice(8).join(' ');
        if (!isNaN(size)) {
          // Get relative path
          const relativePath = filename.replace(dirPath + '/', '').replace(dirPath, '.');
          results.push({
            path: relativePath,
            size: size
          });
        }
      }
    }
    
    return results;
  } catch {
    return [];
  }
}

/**
 * Get comprehensive directory information
 */
export async function getDirectoryInfo(dirPath: string): Promise<void> {
  const fullPath = resolve(dirPath);
  
  // Check if directory exists
  if (!existsSync(fullPath)) {
    throw new Error(`Directory does not exist: ${dirPath}`);
  }
  
  // Check if it's actually a directory
  const stat = statSync(fullPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${dirPath}`);
  }
  
  console.log(`📊 Directory Information: ${fullPath}`);
  console.log('═'.repeat(80));
  
  console.log('🔍 Analyzing directory...');
  
  // Get all statistics in parallel for better performance
  const [totalSize, counts, largestDirs, largestFiles] = await Promise.all([
    getDirectorySize(fullPath),
    getCounts(fullPath),
    getLargestDirectories(fullPath),
    getLargestFiles(fullPath)
  ]);
  
  console.log('\n📈 Summary Statistics:');
  console.log(`   💾 Total size: ${formatBytes(totalSize)}`);
  console.log(`   📄 Files: ${counts.files.toLocaleString()}`);
  console.log(`   📁 Directories: ${counts.dirs.toLocaleString()}`);
  
  if (largestDirs.length > 0) {
    console.log('\n📁 Top 10 Largest Directories:');
    largestDirs.forEach((dir, index) => {
      console.log(`   ${(index + 1).toString().padStart(2)}. ${dir.path} (${formatBytes(dir.size)})`);
    });
  }
  
  if (largestFiles.length > 0) {
    console.log('\n📄 Top 10 Largest Files:');
    largestFiles.forEach((file, index) => {
      console.log(`   ${(index + 1).toString().padStart(2)}. ${file.path} (${formatBytes(file.size)})`);
    });
  }
  
  console.log('\n' + '═'.repeat(80));
  
  // Save the directory path for use with rm command
  try {
    const infoFile = resolve(homedir(), '.paqt_info');
    writeFileSync(infoFile, fullPath, 'utf-8');
    console.log(`💾 Directory path saved for future commands: ${fullPath}`);
  } catch (error) {
    console.warn(`⚠️  Could not save directory path: ${error}`);
  }
} 