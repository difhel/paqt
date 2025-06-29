import { existsSync, unlinkSync, readFileSync, statSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { homedir } from 'os';

/**
 * Get the path to the .paqt_info file
 */
function getInfoFilePath(): string {
  return resolve(homedir(), '.paqt_info');
}

/**
 * Read the base directory from .paqt_info file
 * Returns the path or null if there's an error (errors are logged to console)
 */
function readBaseDirectory(): string | null {
  const infoFile = getInfoFilePath();
  
  if (!existsSync(infoFile)) {
    console.error('❌ No base directory found. Run "paqt info <folder>" first to set the working directory.');
    return null;
  }
  
  try {
    const basePath = readFileSync(infoFile, 'utf-8').trim();
    if (!basePath) {
      console.error('❌ .paqt_info file is empty. Run "paqt info <folder>" to set the working directory.');
      return null;
    }
    
    if (!existsSync(basePath)) {
      console.error(`❌ Base directory no longer exists: ${basePath}. Run "paqt info <folder>" to update.`);
      return null;
    }
    
    return basePath;
  } catch (error) {
    console.error(`❌ Could not read base directory from .paqt_info: ${error}`);
    return null;
  }
}

/**
 * Reset command - delete the .paqt_info file
 */
export async function resetBaseDirectory(): Promise<void> {
  const infoFile = getInfoFilePath();
  
  if (!existsSync(infoFile)) {
    console.error('❌ .paqt_info file does not exist. Nothing to reset.');
    return;
  }
  
  try {
    unlinkSync(infoFile);
    console.log('✅ Base directory reset - .paqt_info file deleted');
  } catch (error) {
    console.error(`❌ Failed to delete .paqt_info file: ${error}`);
  }
}

/**
 * Remove files and directories relative to the base directory
 */
export async function removeRelative(paths: string[]): Promise<void> {
  if (paths.length === 0) {
    console.error('❌ No paths specified. Usage: paqt rm <file1> <file2> <dir1> ...');
    return;
  }
  
  const baseDir = readBaseDirectory();
  if (!baseDir) {
    return; // Error already logged by readBaseDirectory
  }
  
  console.log(`🗂️  Base directory: ${baseDir}`);
  console.log(`🗑️  Removing ${paths.length} item(s)...`);
  
  const results = {
    success: [] as string[],
    failed: [] as { path: string; error: string }[]
  };
  
  for (const relativePath of paths) {
    const fullPath = resolve(join(baseDir, relativePath));
    
    // Security check: ensure the resolved path is within the base directory
    if (!fullPath.startsWith(baseDir)) {
      results.failed.push({
        path: relativePath,
        error: 'Path escapes base directory (security violation)'
      });
      continue;
    }
    
    try {
      if (!existsSync(fullPath)) {
        results.failed.push({
          path: relativePath,
          error: 'File or directory does not exist'
        });
        continue;
      }
      
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Remove directory recursively
        rmSync(fullPath, { recursive: true, force: true });
        console.log(`  📁 ✅ Removed directory: ${relativePath}`);
      } else {
        // Remove file
        unlinkSync(fullPath);
        console.log(`  📄 ✅ Removed file: ${relativePath}`);
      }
      
      results.success.push(relativePath);
      
    } catch (error) {
      results.failed.push({
        path: relativePath,
        error: error instanceof Error ? error.message : String(error)
      });
      console.log(`  ❌ Failed to remove ${relativePath}: ${error}`);
    }
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log(`📊 Removal Summary:`);
  console.log(`   ✅ Successfully removed: ${results.success.length} item(s)`);
  console.log(`   ❌ Failed to remove: ${results.failed.length} item(s)`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed removals:');
    results.failed.forEach(({ path, error }) => {
      console.log(`   • ${path}: ${error}`);
    });
  }
  
  if (results.success.length > 0) {
    console.log('\n✅ Successfully removed:');
    results.success.forEach(path => {
      console.log(`   • ${path}`);
    });
  }
  
  console.log('═'.repeat(80));
}

/**
 * Resolve folder path - use provided path or fall back to stored path
 * Returns the resolved path or null if there's an error (errors are logged to console)
 */
export async function resolveFolderPath(providedPath?: string): Promise<string | null> {
  if (providedPath) {
    // Use provided path and verify it exists
    const fullPath = resolve(providedPath);
    if (!existsSync(fullPath)) {
      console.error(`❌ Directory does not exist: ${providedPath}`);
      return null;
    }
    
    const stat = statSync(fullPath);
    if (!stat.isDirectory()) {
      console.error(`❌ Path is not a directory: ${providedPath}`);
      return null;
    }
    
    return fullPath;
  } else {
          // Use stored path from .paqt_info
    const storedPath = readBaseDirectory();
    if (!storedPath) {
              console.error('💡 Hint: Manually pass the folder path or use "paqt info /path/to/folder" first.');
      return null;
    }
    return storedPath;
  }
} 