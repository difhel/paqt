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
  scan <folder>            Scan folder and create/update metadata.csv
  compress <folder>        Compress folder into tar.xz archive
  decompress <archive>     Decompress archive and restore timestamps
  clean <folder>           Clean useless directories (node_modules, cache, etc.)
  help [command]           Display help for command

Options:
  -V, --version           Display version number
  -h, --help              Display help for command
```

### 1. Scan Command

Recursively scans a folder and generates a `metadata.csv` file containing file paths and modification timestamps.

```bash
# Basic scan - overwrites existing metadata.csv
xtar scan /path/to/folder

# Append-only scan - preserves existing entries, adds new files
xtar scan /path/to/folder --append-only
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
# Compress with default name (folder-name.tar.xz)
xtar compress /path/to/folder

# Compress with custom output path
xtar compress /path/to/folder --output /custom/path/archive.tar.xz
xtar compress /path/to/folder -o archive.tar.xz
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
```

**Timestamp Restoration:**
- On macOS: Sets both birth time and modification time
- On Linux: Sets modification time (birth time not supported)
- Fails gracefully if timestamps cannot be set

### 4. Clean Command

Intelligently removes problematic directories that cause deep nesting and consume excessive space. Uses categorized patterns for safe, careful, and dangerous deletions.

```bash
# Safe clean - removes only regenerable files (node_modules, cache, build, dist)
xtar clean /path/to/folder --dry-run

# Actual cleaning of safe patterns
xtar clean /path/to/folder

# Include careful patterns (.vscode, .cache, tmp)
xtar clean /path/to/folder --include-careful

# Include dangerous patterns (.git, config) - use with extreme caution!
xtar clean /path/to/folder --include-dangerous

# Clean specific patterns only
xtar clean /path/to/folder --patterns node_modules,cache,build
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