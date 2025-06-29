import { execSync } from 'child_process';
import { ToolConfig } from './types.js';

/**
 * Check if a command exists and is executable
 */
function commandExists(command: string): boolean {
  try {
    execSync(`command -v ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Test if tar command supports -I flag
 */
function testTarIFlag(tarCommand: string): boolean {
  try {
    // Test with a simple command that shouldn't fail if -I is supported
    execSync(`${tarCommand} --help | grep -q -- "-I"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect and validate required tools (tar and xz)
 */
export function detectTools(): ToolConfig {
  console.log('Checking for required tools...');
  
  // Check for xz
  if (!commandExists('xz')) {
    console.error('Error: xz command not found. Please install xz-utils or equivalent.');
    process.exit(1);
  }
  
  // Check for tar with -I support
  let tarCommand = 'tar';
  
  if (!commandExists('tar')) {
    console.error('Error: tar command not found.');
    process.exit(1);
  }
  
  // Test if built-in tar supports -I
  if (!testTarIFlag('tar')) {
    console.log('Built-in tar does not support -I flag, checking for gtar...');
    
    if (!commandExists('gtar')) {
      console.error('Error: Neither tar nor gtar support the -I flag. Please install GNU tar.');
      process.exit(1);
    }
    
    if (!testTarIFlag('gtar')) {
      console.error('Error: gtar does not support -I flag. Please install a compatible version of GNU tar.');
      process.exit(1);
    }
    
    tarCommand = 'gtar';
    console.log('Using gtar for archive operations.');
  }
  
  console.log(`✓ Using ${tarCommand} and xz`);
  
  return {
    tarCommand,
    xzCommand: 'xz'
  };
}

/**
 * Check if a path is a symlink by checking for common symlink patterns
 */
export function isSymlink(path: string): boolean {
  // Skip files with symlink-like extensions
  const filename = path.split('/').pop() || '';
  return filename.match(/\.l.*nk$/i) !== null;
}

/**
 * Convert a Date object to ISO-8601 string
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Parse ISO-8601 string to Date object
 */
export function fromISOString(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Get the basename of a path (last component)
 */
export function basename(path: string): string {
  return path.split('/').pop() || path;
}

/**
 * Get the dirname of a path (all components except last)
 */
export function dirname(path: string): string {
  const parts = path.split('/');
  return parts.slice(0, -1).join('/') || '.';
}

/**
 * Remove file extension from filename
 */
export function removeExtension(filename: string, extension: string): string {
  if (filename.endsWith(extension)) {
    return filename.slice(0, -extension.length);
  }
  return filename;
} 