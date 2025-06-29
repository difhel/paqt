/**
 * Type definitions for xtar CLI tool
 */

/** Metadata entry for a file */
export interface FileMetadata {
  path: string;
  modifiedTime: string; // ISO-8601 format
}

/** Configuration for environment tools */
export interface ToolConfig {
  zpaqCommand: string;
}

/** Options for scan command */
export interface ScanOptions {
  appendOnly?: boolean;
}

/** Options for compress command */
export interface CompressOptions {
  output?: string;
}

/** Options for decompress command */
export interface DecompressOptions {
  output?: string | boolean; // boolean when -o flag is used without value
}

/** Options for clean command */
export interface CleanOptions {
  dryRun?: boolean;
  includeCareful?: boolean;
  includeDangerous?: boolean;
  patterns?: string[];
} 