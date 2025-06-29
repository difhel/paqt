import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { resolve, basename, join } from 'path';
import { DecompressOptions, ToolConfig } from './types.js';
import { removeExtension, fromISOString } from './utils.js';
import { loadMetadata } from './scanner.js';

/**
 * Set both creation time and modification time for a file
 * On macOS, this will set both birth time and mtime
 * On Linux, this will set mtime (birth time is not settable)
 */
async function setFileTimestamps(filePath: string, timestamp: Date): Promise<void> {
  try {
    // fs.utimes sets both atime and mtime
    await fs.utimes(filePath, timestamp, timestamp);
    
    // On macOS, also try to set birth time using touch command
    if (process.platform === 'darwin') {
      try {
        // Format timestamp for touch command (YYYYMMDDHHMM.SS)
        const year = timestamp.getFullYear();
        const month = String(timestamp.getMonth() + 1).padStart(2, '0');
        const day = String(timestamp.getDate()).padStart(2, '0');
        const hour = String(timestamp.getHours()).padStart(2, '0');
        const minute = String(timestamp.getMinutes()).padStart(2, '0');
        const second = String(timestamp.getSeconds()).padStart(2, '0');
        
        const touchFormat = `${year}${month}${day}${hour}${minute}.${second}`;
        execSync(`touch -t ${touchFormat} "${filePath}"`, { stdio: 'ignore' });
      } catch {
        // If touch fails, we still have mtime set via fs.utimes
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not set timestamp for ${filePath}:`, error);
  }
}

/**
 * Restore timestamps for all files based on metadata.csv
 */
async function restoreTimestamps(extractedFolderPath: string): Promise<void> {
  console.log('Restoring timestamps...');
  
  try {
    const metadata = await loadMetadata(extractedFolderPath);
    
    if (metadata.length === 0) {
      console.warn('Warning: No metadata found or metadata.csv is empty');
      return;
    }
    
    let restoredCount = 0;
    let errorCount = 0;
    
    for (const entry of metadata) {
      const filePath = join(extractedFolderPath, entry.path);
      
      try {
        // Check if file exists
        await fs.access(filePath);
        
        // Parse timestamp and restore
        const timestamp = fromISOString(entry.modifiedTime);
        await setFileTimestamps(filePath, timestamp);
        restoredCount++;
      } catch (error) {
        console.warn(`Warning: Could not restore timestamp for ${entry.path}:`, error);
        errorCount++;
      }
    }
    
    console.log(`✓ Restored timestamps for ${restoredCount} files`);
    if (errorCount > 0) {
      console.warn(`  ${errorCount} files had timestamp restoration errors`);
    }
    
  } catch (error) {
    console.error('Error loading metadata for timestamp restoration:', error);
    process.exit(1);
  }
}

/**
 * Decompress a tar.xz archive and restore timestamps
 */
export async function decompressArchive(
  archivePath: string,
  options: DecompressOptions,
  toolConfig: ToolConfig
): Promise<void> {
  const resolvedArchivePath = resolve(archivePath);
  
  console.log(`Decompressing archive: ${resolvedArchivePath}`);
  
  // Check if archive exists
  try {
    const stats = await fs.stat(resolvedArchivePath);
    if (!stats.isFile()) {
      console.error(`Error: ${resolvedArchivePath} is not a file`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: Archive ${resolvedArchivePath} does not exist`);
    process.exit(1);
  }
  
  // Determine output directory
  const archiveBasename = basename(resolvedArchivePath);
  const defaultOutputName = removeExtension(archiveBasename, '.tar.xz');
  const outputPath = (options.output && typeof options.output === 'string') ? resolve(options.output) : resolve(defaultOutputName);
  
  // Ensure output directory doesn't exist or is empty
  try {
    const stats = await fs.stat(outputPath);
    if (stats.isDirectory()) {
      const contents = await fs.readdir(outputPath);
      if (contents.length > 0) {
        console.error(`Error: Output directory ${outputPath} already exists and is not empty`);
        process.exit(1);
      }
    } else {
      console.error(`Error: Output path ${outputPath} exists but is not a directory`);
      process.exit(1);
    }
  } catch {
    // Directory doesn't exist, which is fine
  }
  
  // Create output directory if it doesn't exist
  try {
    await fs.mkdir(outputPath, { recursive: true });
  } catch (error) {
    console.error(`Error creating output directory ${outputPath}:`, error);
    process.exit(1);
  }
  
  // Build tar extraction command
  const command = [
    toolConfig.tarCommand,
    `-C "${outputPath}"`,
    `-I "xz -d"`,
    `-xf "${resolvedArchivePath}"`
  ].join(' ');
  
  console.log('Extracting...');
  console.log(`Command: ${command}`);
  
  try {
    // Execute extraction command
    execSync(command, { 
      stdio: 'inherit',
      maxBuffer: 1024 * 1024 * 100 // 100MB buffer
    });
    
    console.log(`✓ Archive extracted to: ${outputPath}`);
    
    // Find the extracted folder (tar extracts to a subdirectory)
    const contents = await fs.readdir(outputPath);
    if (contents.length === 0) {
      console.error('Error: No files were extracted from the archive');
      process.exit(1);
    }
    
    // Find the extracted folder (should be a directory)
    let metadataFolder = outputPath;
    for (const item of contents) {
      const itemPath = join(outputPath, item);
      try {
        const stats = await fs.stat(itemPath);
        if (stats.isDirectory()) {
          metadataFolder = itemPath;
          break;
        }
      } catch {
        // Skip files that can't be stat'd
      }
    }
    
    // Check if metadata.csv exists in the extracted content
    const metadataPath = join(metadataFolder, 'metadata.csv');
    try {
      await fs.access(metadataPath);
    } catch {
      console.error('Error: metadata.csv not found in extracted archive');
      console.error(`Expected location: ${metadataPath}`);
      process.exit(1);
    }
    
    // Restore timestamps
    await restoreTimestamps(metadataFolder);
    
  } catch (error) {
    console.error('Error during extraction:', error);
    process.exit(1);
  }
} 