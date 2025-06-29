import { promises as fs } from 'fs';
import { join, relative, resolve } from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { FileMetadata, ScanOptions } from './types.js';
import { isSymlink, toISOString } from './utils.js';

/**
 * Recursively scan a directory and collect file metadata
 */
async function scanDirectory(
  dirPath: string,
  basePath: string,
  existingFiles: Set<string>
): Promise<FileMetadata[]> {
  const entries: FileMetadata[] = [];
  
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = join(dirPath, item.name);
      const relativePath = relative(basePath, fullPath);
      
      // Skip symlinks
      if (item.isSymbolicLink() || isSymlink(item.name)) {
        continue;
      }
      
      if (item.isDirectory()) {
        // Recursively scan subdirectories
        const subEntries = await scanDirectory(fullPath, basePath, existingFiles);
        entries.push(...subEntries);
      } else if (item.isFile()) {
        // Skip if this file already exists (for append-only mode)
        if (existingFiles.has(relativePath)) {
          continue;
        }
        
        const stats = await fs.stat(fullPath);
        entries.push({
          path: relativePath,
          modifiedTime: toISOString(stats.mtime)
        });
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
    process.exit(1);
  }
  
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
  const newMetadata = await scanDirectory(resolvedPath, resolvedPath, existingFiles);
  
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