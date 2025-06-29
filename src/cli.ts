#!/usr/bin/env node

import { Command } from 'commander';
import { scanFolder } from './scanner.js';
import { compressFolder } from './archiver.js';
import { decompressArchive } from './restorer.js';
import { cleanDirectories } from './cleaner.js';
import { getDirectoryInfo } from './info.js';
import { resetBaseDirectory, removeRelative, resolveFolderPath } from './rmops.js';
import { detectTools } from './utils.js';
import { ScanOptions, CompressOptions, DecompressOptions, CleanOptions } from './types.js';

// Package info (in a real project, this would come from package.json)
const packageInfo = {
  name: 'xtar',
  version: '1.0.0',
  description: 'A TypeScript CLI tool for reliable folder archiving with timestamp preservation'
};

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  // Detect required tools at startup
  const toolConfig = detectTools();
  
  const program = new Command();
  
  program
    .name(packageInfo.name)
    .description(packageInfo.description)
    .version(packageInfo.version);
  
  // Scan subcommand
  program
    .command('scan')
    .description('Recursively scan a folder and create/update metadata.csv')
    .argument('[folder]', 'folder to scan (optional - uses stored path from previous info command)')
    .option('--append-only', 'append new files without updating existing timestamps')
    .action(async (folder: string | undefined, options: ScanOptions) => {
      const resolvedPath = await resolveFolderPath(folder);
      if (!resolvedPath) {
        process.exit(1);
      }
      
      try {
        await scanFolder(resolvedPath, options);
      } catch (error) {
        console.error('Scan failed:', error);
        process.exit(1);
      }
    });
  
  // Compress subcommand
  program
    .command('compress')
    .description('Compress a folder into a tar.xz archive')
    .argument('[folder]', 'folder to compress (optional - uses stored path from previous info command)')
    .option('-o, --output <archive>', 'output archive path (default: <folder-name>.tar.xz)')
    .action(async (folder: string | undefined, options: CompressOptions) => {
      const resolvedPath = await resolveFolderPath(folder);
      if (!resolvedPath) {
        process.exit(1);
      }
      
      try {
        await compressFolder(resolvedPath, options, toolConfig);
      } catch (error) {
        console.error('Compression failed:', error);
        process.exit(1);
      }
    });
  
  // Decompress subcommand
  program
    .command('decompress')
    .description('Decompress a tar.xz archive and restore timestamps')
    .argument('<archive>', 'archive file to decompress')
    .option('-o, --output [folder]', 'output folder path (optional - uses stored path from previous info command, or default: <archive-name>)')
    .action(async (archive: string, options: DecompressOptions) => {
      // If output is true (meaning -o was provided without value), try to resolve path
      if (options.output === true) {
        const resolvedPath = await resolveFolderPath(undefined);
        if (resolvedPath) {
          options.output = resolvedPath;
        } else {
          options.output = undefined; // Fall back to default behavior
        }
      }
      
      try {
        await decompressArchive(archive, options, toolConfig);
      } catch (error) {
        console.error('Decompression failed:', error);
        process.exit(1);
      }
    });
  
  // Clean subcommand
  program
    .command('clean')
    .description('Clean useless directories (node_modules, cache, build artifacts, etc.)')
    .argument('[folder]', 'folder to clean (optional - uses stored path from previous info command)')
    .option('--dry-run', 'show what would be deleted without actually deleting')
    .option('--include-careful', 'include careful patterns like .vscode, .cache (requires confirmation)')
    .option('--include-dangerous', 'include dangerous patterns like .git (requires explicit confirmation)')
    .option('--patterns <patterns...>', 'specify exact patterns to clean (comma-separated)')
    .action(async (folder: string | undefined, options: any) => {
      const resolvedPath = await resolveFolderPath(folder);
      if (!resolvedPath) {
        process.exit(1);
      }
      
      try {
        // Handle patterns - could be array or string
        let patterns: string[] | undefined = undefined;
        if (options.patterns) {
          if (Array.isArray(options.patterns)) {
            // If it's already an array, flatten any comma-separated values
            patterns = options.patterns.flatMap((p: string) => p.split(',').map(item => item.trim()));
          } else if (typeof options.patterns === 'string') {
            // If it's a string, split by comma
            patterns = options.patterns.split(',').map((p: string) => p.trim());
          }
        }
        
        const cleanOptions: CleanOptions = {
          dryRun: options.dryRun,
          includeCareful: options.includeCareful,
          includeDangerous: options.includeDangerous,
          patterns
        };
        
        await cleanDirectories(resolvedPath, cleanOptions);
      } catch (error) {
        console.error('Cleaning failed:', error);
        process.exit(1);
      }
    });
  
    // Info subcommand
  program
    .command('info')
    .description('Show directory statistics (size, file/folder counts, largest items)')
    .argument('[folder]', 'folder to analyze (optional - uses stored path from previous info command)')
    .action(async (folder?: string) => {
      const resolvedPath = await resolveFolderPath(folder);
      if (!resolvedPath) {
        process.exit(1);
      }
      
      try {
        await getDirectoryInfo(resolvedPath);
      } catch (error) {
        console.error('Info failed:', error);
        process.exit(1);
      }
    });

  // Reset subcommand
  program
    .command('reset')
    .description('Clear the stored base directory from previous info command')
    .action(async () => {
      await resetBaseDirectory();
    });

  // Remove subcommand
  program
    .command('rm')
    .description('Remove files/directories relative to the last info command directory')
    .argument('<paths...>', 'files and directories to remove (relative paths)')
    .action(async (paths: string[]) => {
      await removeRelative(paths);
    });

  // Handle case where no command is provided
  if (process.argv.length <= 2) {
    program.help();
  }
  
  // Parse command line arguments
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error('Command failed:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 