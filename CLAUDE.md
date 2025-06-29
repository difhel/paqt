Write a TypeScript command-line program called `xtar` that supports three subcommands—`scan`, `compress` and `decompress`—to reliably snapshot, archive, and restore a folder on Linux and macOS (both Node.js and Bun). The tool must meet the following

## Requirements
* Detect at startup that `zpaq` is installed.
* Skip symlinks entirely (but include hidden files like `.env`).
* Follow standard CLI conventions: `--help`, `--version`, proper exit codes.
* Preserve directory structure and exact file modification timestamps.

## Commands

1. **`scan <folder> [--append-only]`**

   Recursively scan `<folder>` and create/update a CSV file named `metadata.csv` inside that folder.

   **CSV Format:**
   ```csv
   path,modifiedTime
   file1.txt,2024-01-15T10:30:45.123Z
   dir/file2.js,2024-01-14T15:20:30.456Z
   .hidden-file,2024-01-13T08:45:15.789Z
   ```

   - `path`: relative path from the scanned folder
   - `modifiedTime`: ISO-8601 timestamp of last modification
   - `--append-only`: Only add new files, don't update existing entries

2. **`compress <folder> [--output <archive.zpaq>]`**

   Create a zpaq archive of the entire folder using method 5 compression.
   
   Before compression, ensure `metadata.csv` exists (run scan if missing).
   
   Use the equivalent of:
   ```bash
   zpaq a -m5 <archive> <folder>
   ```
   
   to produce a `.zpaq` archive with method 5 compression for optimal compression ratios.
   * Default `<archive>` name: `<folder-name>.zpaq` in the current working directory.
   * Progress output should be shown.

3. **`decompress <archive.zpaq> [--output <folder>]`**

   Decompress the zpaq archive and restore file timestamps from the `metadata.csv` contained within.
   * Unpack to `--output` or, by default, to a folder named after the archive (minus `.zpaq`).
   * After extraction, parse the included `metadata.csv` and restore modification times.
   * If possible, also restore creation/birth time using `touch -t`.

## Technical Requirements

* **TypeScript**: Use proper type definitions and compile to JavaScript.
* **Dependencies**: Minimal external dependencies (commander.js for CLI parsing is acceptable).
* **Error Handling**: Graceful error messages for missing tools, permissions, etc.
* **Cross-platform**: Support both macOS and Linux environments.
* **Runtime**: Compatible with both Node.js and Bun.

## Additional Features

The tool has been extended beyond the original specification to include:

* **Smart Cleaning**: `clean` command to remove temporary files and build artifacts to reduce the size of data to compress
* **Directory Analysis**: `info` command for comprehensive directory statistics  
* **Path Memorization**: Commands can use stored paths from previous operations. The path of the base directory is saved into `~/.xtar_info`
* **Targeted Removal**: `rm` command for removing specific files relative to a base directory
* **Enhanced Diagnostics**: Detailed analysis of problematic directory structures

The implementation prioritizes reliability, user safety, and professional CLI experience while maintaining the core archiving functionality with zpaq compression.
