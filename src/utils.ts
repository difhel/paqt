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
 * Detect and validate required tools (zpaq)
 */
export function detectTools(): ToolConfig {
  console.log('Checking for required tools...');
  
  // Check for zpaq
  if (!commandExists('zpaq')) {
    console.error('Error: zpaq command not found. Please install zpaq.');
    console.error('  On macOS: brew install zpaq');
    console.error('  On Ubuntu/Debian: sudo apt install zpaq');
    console.error('  Or download from: https://mattmahoney.net/dc/zpaq.html');
    process.exit(1);
  }
  
  console.log('✓ Using zpaq with method 5 compression');
  
  return {
    zpaqCommand: 'zpaq'
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