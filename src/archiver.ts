import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { resolve, basename, dirname } from 'path';
import { CompressOptions, ToolConfig } from './types.js';
import { scanFolder, hasMetadata } from './scanner.js';

/**
 * Compress a folder into a tar.xz archive
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
  const defaultArchiveName = `${folderName}.tar.xz`;
  const archivePath = options.output ? resolve(options.output) : resolve(defaultArchiveName);
  
  // Ensure output directory exists
  const archiveDir = dirname(archivePath);
  try {
    await fs.mkdir(archiveDir, { recursive: true });
  } catch (error) {
    console.error(`Error creating output directory ${archiveDir}:`, error);
    process.exit(1);
  }
  
  // Build tar command with maximum compression settings
  const parentDir = dirname(resolvedFolderPath);
  const command = [
    toolConfig.tarCommand,
    `-C "${parentDir}"`,
    `-I "xz -9e --lzma2=dict=1536m -T0"`,
    `-cf "${archivePath}"`,
    `"${folderName}"`
  ].join(' ');
  
  console.log('Compressing...');
  console.log(`Command: ${command}`);
  
  try {
    // Execute compression command
    execSync(command, { 
      stdio: 'inherit',
      maxBuffer: 1024 * 1024 * 100 // 100MB buffer
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