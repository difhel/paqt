# xtar

A vibe-coded TypeScript command-line tool for reliable folder archiving with timestamp preservation. Supports three operations: scanning folders to generate metadata, compressing folders with maximum compression, and decompressing archives while restoring original timestamps.

## Features

- **Reliable archiving**: Uses tar and xz with maximum compression settings
- **Timestamp preservation**: Restores both creation time and modification time on supported platforms
- **Cross-platform**: Works on Linux and macOS with Node.js ≥14 or Bun
- **Skip symlinks**: Automatically skips symlinks and `.l*nk` files for safety
- **Include hidden files**: Processes all files including hidden files (`.*)
- **Append-only scanning**: Option to add new files without updating existing timestamps
- **Automatic tool detection**: Falls back to `gtar` if standard `tar` doesn't support `-I` flag

## Prerequisites

The tool requires the following system utilities:

- `tar` (with `-I` flag support) or `gtar` (GNU tar)
- `xz` compression utility

### Installation on macOS

```bash
# Install GNU tar and xz via Homebrew
brew install gnu-tar xz

# Or install xz-utils
brew install xz
```

### Installation on Linux

```bash
# Ubuntu/Debian
sudo apt-get install tar xz-utils

# CentOS/RHEL
sudo yum install tar xz

# Arch Linux
sudo pacman -S tar xz
```

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Or run directly with tsx for development
npm run dev -- --help
```

## Usage

### Command Overview

```bash
xtar <command> [options]

Commands:
  scan [folder]            Scan folder and create/update metadata.csv (uses stored path if omitted)
  compress [folder]        Compress folder into tar.xz archive (uses stored path if omitted)
  decompress <archive>     Decompress archive and restore timestamps
  clean [folder]           Clean useless directories (uses stored path if omitted)
  info [folder]            Show directory statistics (uses stored path if omitted)
  rm <paths...>            Remove files/directories relative to the stored base directory
  reset                    Clear the stored base directory from previous info command
  help [command]           Display help for command

Options:
  -V, --version           Display version number
  -h, --help              Display help for command
```

### 1. Scan Command

Recursively scans a folder and generates a `metadata.csv` file containing file paths and modification timestamps.

```bash
# Basic scan with explicit path - overwrites existing metadata.csv
xtar scan /path/to/folder

# Append-only scan - preserves existing entries, adds new files
xtar scan /path/to/folder --append-only

# Use stored path from previous info command
xtar info /path/to/folder    # Sets working directory
xtar scan                    # Scans stored path
xtar scan --append-only      # Append-only scan of stored path
```

**Output Format** (`metadata.csv`):
```csv
path,modifiedTime
file1.txt,2024-01-15T10:30:45.123Z
subfolder/file2.js,2024-01-14T15:20:30.456Z
.hidden-file,2024-01-13T08:45:15.789Z
```

### 2. Compress Command

Compresses a folder into a highly compressed `.tar.xz` archive. Automatically scans the folder if `metadata.csv` doesn't exist.

```bash
# Compress with explicit path and default name (folder-name.tar.xz)
xtar compress /path/to/folder

# Compress with custom output path
xtar compress /path/to/folder --output /custom/path/archive.tar.xz
xtar compress /path/to/folder -o archive.tar.xz

# Use stored path from previous info command
xtar info /path/to/folder    # Sets working directory
xtar compress                # Uses stored path
```

**Compression Settings:**
- Uses `xz -9e` (extreme compression)
- LZMA2 dictionary size: 1.5GB
- Multi-threaded compression (`-T0`)
- Typically achieves 20-40% better compression than standard settings

### 3. Decompress Command

Extracts a `.tar.xz` archive and restores original file timestamps from the included `metadata.csv`.

```bash
# Decompress with default folder name (removes .tar.xz extension)
xtar decompress archive.tar.xz

# Decompress to custom folder
xtar decompress archive.tar.xz --output /custom/path
xtar decompress archive.tar.xz -o restored-folder

# Use stored path from previous info command for output location
xtar info /restore/here        # Sets working directory
xtar decompress archive.tar.xz -o  # Uses stored path as output location
```

**Timestamp Restoration:**
- On macOS: Sets both birth time and modification time
- On Linux: Sets modification time (birth time not supported)
- Fails gracefully if timestamps cannot be set

### 4. Clean Command

Intelligently removes problematic directories that cause deep nesting and consume excessive space. Uses categorized patterns for safe, careful, and dangerous deletions.

```bash
# Safe clean with explicit path - removes only regenerable files (node_modules, cache, build, dist)
xtar clean /path/to/folder --dry-run

# Actual cleaning of safe patterns
xtar clean /path/to/folder

# Include careful patterns (.vscode, .cache, tmp)
xtar clean /path/to/folder --include-careful

# Include dangerous patterns (.git, config) - use with extreme caution!
xtar clean /path/to/folder --include-dangerous

# Clean specific patterns only
xtar clean /path/to/folder --patterns node_modules,cache,build

# Use stored path from previous info command
xtar info /path/to/folder    # Sets working directory
xtar clean --dry-run         # Clean stored path (dry run)
xtar clean --patterns cache  # Clean specific patterns from stored path
```

**Safety Categories:**
- 🟢 **Safe**: `node_modules`, `.venv`, `cache`, `build`, `dist`, `.next`, `.nuxt` - can be regenerated
- 🟡 **Careful**: `.vscode`, `target`, `tmp`, `.cache` - contain preferences/settings
- 🔴 **Dangerous**: `.git`, `.config` - permanent loss if deleted

**Example Output:**
```bash
📊 Found 368 directories to clean:
════════════════════════════════════════════════════════════════════════════════

🟢 Node.js dependencies (node_modules):
   📁 Directories: 70
   📄 Files: 40,128
   💾 Total size: 245.8 MB
   📝 Reason: Can be regenerated with npm/yarn install
   📂 Largest directories:
      1. project/node_modules (180.2 MB, 26,404 files)
      2. lib/node_modules (45.3 MB, 8,932 files)

💾 Total space to free: 487.3 MB
📄 Total files to delete: 43,881
```

### 5. Info Command

Provides comprehensive statistics about a directory, including size analysis and identification of the largest files and directories.

```bash
# Get directory statistics
xtar info /path/to/folder
```

**Shows:**
- 💾 Total directory size
- 📄 Total file count  
- 📁 Total directory count
- 📁 Top 10 largest directories
- 📄 Top 10 largest files

**Example Output:**
```bash
📊 Directory Information: /home/user/projects
════════════════════════════════════════════════════════════════════════════════
🔍 Analyzing directory...

📈 Summary Statistics:
   💾 Total size: 2.5 GB
   📄 Files: 15,432
   📁 Directories: 3,247

📁 Top 10 Largest Directories:
    1. node_modules (1.2 GB)
    2. .git (450 MB)  
    3. build (180 MB)
    4. dist (95 MB)
    5. cache (67 MB)

📄 Top 10 Largest Files:
    1. package-lock.json (2.1 MB)
    2. bundle.js (850 KB)
    3. database.sqlite (500 KB)
    4. video.mp4 (350 KB)
    5. image.png (200 KB)
```

The `info` command is perfect for understanding directory composition before cleaning or archiving operations.

#### Path Memorization

**ALL commands** support automatic path memorization for seamless workflow:

- `info`, `scan`, `compress`, `clean` - Make folder parameter optional
- `decompress` - Supports optional output path with `-o` flag  
- `rm` - Uses stored path as base directory for relative file operations

**How it works:**
1. **When you provide a path explicitly**: The path is verified and stored for future use
2. **When you omit the path**: The tool uses the previously stored path from `~/.xtar_info`
3. **If no stored path exists**: Shows helpful error with instructions

**Complete workflow example:**
```bash
# Set working directory once
xtar info ~/large-project

# Now ALL commands can omit paths
xtar scan                        # Scan ~/large-project
xtar clean --dry-run             # Clean ~/large-project (dry run)
xtar rm build logs cache         # Remove files from ~/large-project
xtar compress                    # Compress ~/large-project
xtar info                        # Re-analyze ~/large-project

# Clean up when done
xtar reset
```

### 6. Remove Command

The `rm` command allows you to remove files and directories using relative paths from the last `info` command, without changing your current working directory.

```bash
# First, analyze a directory
xtar info /path/to/analyze

# Then remove files using relative paths shown in the info output
xtar rm file1.txt subdirectory/largefile.dat folder1

# Remove multiple items at once
xtar rm *.log build cache node_modules
```

**Features:**
- 🗂️ Uses base directory from last `info` command
- 🔒 Security: prevents path traversal outside base directory
- 📊 Detailed removal summary with success/failure counts
- 📁 Handles both files and directories (recursive removal)
- ⚠️ Shows clear error messages for missing items

**Example Workflow:**
```bash
# 1. Analyze directory structure
xtar info ~/projects/my-app
# 📄 Top 10 Largest Files:
#     1. node_modules/package.zip (50 MB)
#     2. build/bundle.js (25 MB)
#     3. logs/debug.log (10 MB)

# 2. Remove largest files without changing directory
xtar rm node_modules/package.zip build/bundle.js logs/debug.log

# 3. Clear the stored path when done
xtar reset
```

### 7. Reset Command

The `reset` command clears the stored base directory from the previous `info` command.

```bash
# Clear stored directory path
xtar reset
```

**Use Cases:**
- Clean up after using `rm` command
- Clear stale directory references
- Reset before analyzing a different directory

**Error Handling:**
- Shows error if `.xtar_info` file doesn't exist
- Confirms successful deletion

## Examples

### Complete Workflow

```bash
# 1. Create a test folder with some files
mkdir test-folder
echo "Hello World" > test-folder/file1.txt
echo "Hidden content" > test-folder/.hidden
mkdir test-folder/subfolder
echo "Nested file" > test-folder/subfolder/nested.txt

# 2. Scan the folder
xtar scan test-folder
# Creates test-folder/metadata.csv

# 3. Compress the folder
xtar compress test-folder
# Creates test-folder.tar.xz

# 4. Remove original folder
rm -rf test-folder

# 5. Decompress and restore
xtar decompress test-folder.tar.xz
# Restores test-folder/ with original timestamps
```

### Cleaning Problematic Directories

```bash
# 1. Analyze what would be cleaned (safe)
xtar clean problematic-folder --dry-run

# 2. Clean safe patterns (node_modules, cache, build, dist)
xtar clean problematic-folder

# 3. Scan the cleaned folder (should work much better now)
xtar scan problematic-folder

# 4. Compress the cleaned folder
xtar compress problematic-folder
```

### Incremental Backups

```bash
# Initial scan
xtar scan my-project

# ... time passes, files are modified ...

# Add new files without updating existing timestamps
xtar scan my-project --append-only

# Compress with all metadata
xtar compress my-project -o my-project-backup.tar.xz
```

### Directory Analysis and Targeted Cleanup

```bash
# 1. Analyze a large directory from anywhere (sets working directory)
cd ~
xtar info /some/deep/path/project-folder

# 2. Review the largest files and decide what to remove
# Output shows relative paths like:
#   📄 Top 10 Largest Files:
#      1. logs/application.log (500 MB)
#      2. node_modules/package.zip (200 MB)
#      3. build/bundle.js (50 MB)

# 3. Remove problematic files without changing directory
xtar rm logs/application.log node_modules/package.zip build

# 4. Verify the cleanup (uses stored path)
xtar info

# 5. Compress the cleaned project (uses stored path)
xtar compress -o ~/backups/cleaned-project.tar.xz

# 6. Clean up when done
xtar reset
```

### Path Memorization Workflow

```bash
# 1. Set working directory once
xtar info ~/projects/my-app

# 2. Use ALL commands without repeating the path
xtar scan                               # Scan ~/projects/my-app  
xtar clean --dry-run                    # Preview cleanup of ~/projects/my-app
xtar clean --patterns cache            # Actually clean cache from ~/projects/my-app
xtar rm build logs                     # Remove specific files from ~/projects/my-app
xtar compress                          # Compress ~/projects/my-app
xtar info                              # Re-analyze ~/projects/my-app
xtar compress -o ~/backups/clean.tar.xz # Compress again with custom output

# 3. Clean up stored path
xtar reset
```

### Complete Project Analysis Workflow

```bash
# 1. Analyze a problematic directory
cd ~
xtar info /deep/path/problematic-project

# 2. Create initial backup  
xtar scan                              # Generate metadata.csv
xtar compress -o ~/backups/original.tar.xz

# 3. Clean up the project
xtar clean --dry-run                   # Preview what would be deleted
xtar clean                             # Remove safe patterns (node_modules, cache, etc.)
xtar rm logs/debug.log build/old       # Remove specific large files

# 4. Create cleaned backup
xtar scan                              # Update metadata after cleanup
xtar compress -o ~/backups/cleaned.tar.xz

# 5. Verify results
xtar info                              # Check final size and structure

# 6. Clean up
xtar reset
```

## Error Handling & Diagnostics

The tool provides comprehensive error analysis with detailed diagnostics for problematic directories:

- **Exit code 0**: Success
- **Exit code 1**: Error (missing tools, invalid paths, compression failures, etc.)

### Enhanced Diagnostic Features

When issues are encountered during scanning, the tool provides:

1. **Exact Problem Location**: Shows precisely which files/folders are problematic
2. **Issue Classification**: STACK_OVERFLOW, CIRCULAR_SYMLINK, PERMISSION_DENIED, etc.
3. **Detailed Analysis**: Runs diagnostic commands and shows results
4. **Actionable Solutions**: Specific commands to investigate and fix issues

### Example Diagnostic Output

```bash
⚠️  Issues encountered during scan (1 paths skipped):
════════════════════════════════════════════════════════════════════════════════
1. STACK_OVERFLOW: Directory 'project/node_modules' contains extremely deep nesting...
════════════════════════════════════════════════════════════════════════════════

📋 DETAILED DIAGNOSTIC ANALYSIS
════════════════════════════════════════════════════════════════════════════════

🔍 Detailed analysis of problematic directory: 'project/node_modules'
   📁 Type: Directory
   📏 Size: 4.2 MB
   📅 Modified: 2024-01-15T10:30:45.123Z

   🔍 Finding deepest nested paths...
   📊 Top 5 deepest paths:
      1. Depth 25: project/node_modules/@babel/core/lib/transformation/file/generate.js
      2. Depth 24: project/node_modules/webpack/lib/dependencies/HarmonyImportDependency.js

   📊 Contents summary:
      Directories: 15,847
      Files: 89,234

   🔍 Checking for common problematic patterns...
      ⚠️  Found 892 Node.js dependencies directories (node_modules)
      ⚠️  Found 45 Cache directories (cache)
      ⚠️  Found 23 Build artifacts (build)
```

### Common Error Scenarios

```bash
# Missing required tools
Error: xz command not found. Please install xz-utils or equivalent.
Error: Neither tar nor gtar support the -I flag. Please install GNU tar.

# Invalid paths
Error: /nonexistent/path does not exist
Error: /path/to/file is not a directory

# Missing metadata
Error: metadata.csv not found in extracted archive
```

## Platform Notes

### macOS
- If built-in `tar` doesn't support `-I` flag, automatically switches to `gtar`
- Requires GNU tar for `-I` flag support: `brew install gnu-tar`
- Birth time restoration supported via `touch -t`

### Linux
- Most distributions include compatible `tar` by default
- Birth time restoration not supported (filesystem limitation)
- Modification time restoration works normally

### Node.js vs Bun
- Fully compatible with Node.js ≥14
- Tested with Bun runtime
- Uses standard Node.js APIs (`fs.promises`, `child_process`)

## Development

```bash
# Install dependencies
npm install

# Development mode (runs TypeScript directly)
npm run dev -- scan test-folder

# Build for production
npm run build

# Run built version
npm start -- --help
```

## Architecture

The tool is structured into focused modules:

- `cli.ts` - Command-line interface and argument parsing
- `scanner.ts` - Folder scanning and metadata CSV generation
- `archiver.ts` - Compression operations
- `restorer.ts` - Decompression and timestamp restoration
- `cleaner.ts` - Directory cleaning and space optimization
- `patterns.ts` - Suspicious pattern definitions and categorization
- `utils.ts` - Utility functions and tool detection
- `types.ts` - TypeScript type definitions

## License

MIT License 