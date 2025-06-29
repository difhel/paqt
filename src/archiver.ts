import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { resolve, basename, dirname } from 'path';
import { CompressOptions, ToolConfig } from './types.js';
import { scanFolder, hasMetadata } from './scanner.js';

/**
 * Compress a folder into a zpaq archive with method 5
 */
export async function compressFolder(
  folderPath: string, 
  options: CompressOptions,
  toolConfig: ToolConfig
): Promise<void> {
  const resolvedFolderPath = resolve(folderPath);
  
  console.log(`Compressing folder: ${resolvedFolderPath}`);
  
  // Check if folder exists
  try {
    const stats = await fs.stat(resolvedFolderPath);
    if (!stats.isDirectory()) {
      console.error(`Error: ${resolvedFolderPath} is not a directory`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: Folder ${resolvedFolderPath} does not exist`);
    process.exit(1);
  }
  
  // Ensure metadata.csv exists
  if (!(await hasMetadata(resolvedFolderPath))) {
    console.log('metadata.csv not found, scanning folder first...');
    await scanFolder(resolvedFolderPath);
  }
  
  // Determine output archive path
  const folderName = basename(resolvedFolderPath);
  const defaultArchiveName = `${folderName}.zpaq`;
  const archivePath = options.output ? resolve(options.output) : resolve(defaultArchiveName);
  
  // Ensure output directory exists
  const archiveDir = dirname(archivePath);
  try {
    await fs.mkdir(archiveDir, { recursive: true });
  } catch (error) {
    console.error(`Error creating output directory ${archiveDir}:`, error);
    process.exit(1);
  }
  
  // Build zpaq command with method 5 compression
  const parentDir = dirname(resolvedFolderPath);
  const command = [
    toolConfig.zpaqCommand,
    'a',
    `"${archivePath}"`,
    `"${folderName}"`,
    `-m5`,  // Method 5 compression
  ].join(' ');
  
  console.log('Compressing with zpaq method 5...');
  console.log(`Command: ${command}`);
  
  try {
    // Execute compression command in parent directory
    execSync(command, { 
      cwd: parentDir,
      stdio: 'inherit',
      maxBuffer: 1024 * 1024 * 100, // 100MB buffer
      encoding: 'utf8'
    });
    
    console.log(`✓ Archive created: ${archivePath}`);
    
    // Verify archive was created and has content
    const stats = await fs.stat(archivePath);
    if (stats.size === 0) {
      console.error('Error: Archive file is empty');
      process.exit(1);
    }
    
    console.log(`  Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('Error during compression:', error);
    process.exit(1);
  }
} 