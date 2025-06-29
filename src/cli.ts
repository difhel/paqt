#!/usr/bin/env node

import { Command } from 'commander';
import { scanFolder } from './scanner.js';
import { compressFolder } from './archiver.js';
import { decompressArchive } from './restorer.js';
import { detectTools } from './utils.js';
import { ScanOptions, CompressOptions, DecompressOptions } from './types.js';

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
    .argument('<folder>', 'folder to scan')
    .option('--append-only', 'append new files without updating existing timestamps')
    .action(async (folder: string, options: ScanOptions) => {
      try {
        await scanFolder(folder, options);
      } catch (error) {
        console.error('Scan failed:', error);
        process.exit(1);
      }
    });
  
  // Compress subcommand
  program
    .command('compress')
    .description('Compress a folder into a tar.xz archive')
    .argument('<folder>', 'folder to compress')
    .option('-o, --output <archive>', 'output archive path (default: <folder-name>.tar.xz)')
    .action(async (folder: string, options: CompressOptions) => {
      try {
        await compressFolder(folder, options, toolConfig);
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
    .option('-o, --output <folder>', 'output folder path (default: <archive-name>)')
    .action(async (archive: string, options: DecompressOptions) => {
      try {
        await decompressArchive(archive, options, toolConfig);
      } catch (error) {
        console.error('Decompression failed:', error);
        process.exit(1);
      }
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