# paqt

A TypeScript CLI tool for reliable folder archiving and cleaning with timestamp preservation on Linux and macOS.

## Features

- **Reliable archiving**: Uses zpaq with method 5 compression for excellent compression ratios
- **Timestamp preservation**: Restores exact file modification times from metadata
- **Cross-platform compatibility**: Works on both Linux and macOS (Node.js and Bun)
- **Comprehensive scanning**: Detects circular references, deep nesting, and problematic patterns
- **Smart cleaning**: Removes temporary files and build artifacts with safety categories
- **Directory analysis**: Shows size distribution and identifies largest files/folders
- **Path memorization**: Set working directory once, use across all commands
- **Automatic tool detection**: Detects and validates zpaq installation

## Prerequisites

Ensure you have the following tools installed:

- `zpaq` compression utility

### Installation

**macOS (Homebrew):**
```bash
# Install zpaq via Homebrew
brew install zpaq
```

**Linux (Ubuntu/Debian):**
```bash
# Install zpaq
sudo apt-get install zpaq
```

**Linux (CentOS/RHEL):**
```bash
# Install zpaq (may need EPEL repository)
sudo yum install zpaq
```

**Linux (Arch):**
```bash
# Install zpaq
sudo pacman -S zpaq
```

**Manual Installation:**
If zpaq is not available in your package manager, download from: https://mattmahoney.net/dc/zpaq.html

## Installation

```bash
npm install -g paqt
```

## Usage

```bash
paqt <command> [options]
```

### Commands:
- `scan [folder]`         Create/update metadata.csv with file timestamps (uses stored path if omitted)
- `compress [folder]`     Compress folder into zpaq archive (uses stored path if omitted)
- `decompress <archive>`  Extract zpaq archive and restore timestamps
- `clean [folder]`        Remove temporary files and build artifacts (uses stored path if omitted)
- `info [folder]`         Show directory statistics and save path for other commands
- `rm <paths...>`         Remove files/directories from stored base directory
- `reset`                 Clear stored base directory path

### Global Options:
- `--help`               Show help for command
- `--version`            Show version number

## Command Details

### 1. Scan Command

Recursively scans a folder and creates/updates `metadata.csv` with file paths and modification timestamps.

**Examples:**
```bash
# Scan with explicit path
paqt scan /path/to/folder

# Append-only mode (don't update existing file timestamps)
paqt scan /path/to/folder --append-only

# Using stored path (after running info command)
paqt info /path/to/folder    # Sets working directory
paqt scan                    # Scans stored path
paqt scan --append-only      # Append-only scan of stored path
```

**Options:**
- `--append-only`: Only add new files, don't update timestamps for existing files

**Output:**
- Creates `metadata.csv` in the target folder
- Shows scan progress and statistics
- Detects and reports problematic patterns (deep nesting, circular references, etc.)

### 2. Compress Command

Compresses a folder into a highly compressed `.zpaq` archive using method 5 compression. Automatically scans the folder if `metadata.csv` doesn't exist.

**Examples:**
```bash
# Compress with explicit path and default name (folder-name.zpaq)
paqt compress /path/to/folder

# Compress with custom output path
paqt compress /path/to/folder --output /custom/path/archive.zpaq
paqt compress /path/to/folder -o archive.zpaq

# Using stored path (after running info command)
paqt info /path/to/folder    # Sets working directory
paqt compress                # Uses stored path
```

**Compression Details:**
- Uses `zpaq` with method 5 (high compression)
- Includes all files and hidden files
- Excludes symbolic links for safety
- Preserves directory structure
- Includes `metadata.csv` for timestamp restoration

### 3. Decompress Command

Extracts a `.zpaq` archive and restores original file timestamps from the included `metadata.csv`.

**Examples:**
```bash
# Decompress with default folder name (removes .zpaq extension)
paqt decompress archive.zpaq

# Decompress to custom path
paqt decompress archive.zpaq --output /custom/path
paqt decompress archive.zpaq -o restored-folder

# Using stored path as output location
paqt info /restore/here        # Sets working directory
paqt decompress archive.zpaq -o  # Uses stored path as output location
```

**Features:**
- Restores exact file modification times
- On macOS: Restores both modification time and birth time where possible
- Validates metadata.csv exists in the archive
- Creates output directory if it doesn't exist

### 4. Clean Command

Removes temporary files, build artifacts, and other unnecessary data from directories before compression.

**Examples:**
```bash
# Preview what would be deleted (dry run)
paqt clean /path/to/folder --dry-run

# Clean safe patterns (node_modules, cache, build, etc.)
paqt clean /path/to/folder

# Include careful patterns (.vscode, target, tmp, .cache) - requires confirmation
paqt clean /path/to/folder --include-careful

# Include dangerous patterns (.git, .env, config) - requires explicit confirmation
paqt clean /path/to/folder --include-dangerous

# Clean specific patterns only
paqt clean /path/to/folder --patterns node_modules,cache,build

# Using stored path (after running info command)
paqt info /path/to/folder    # Sets working directory
paqt clean --dry-run         # Clean stored path (dry run)
paqt clean --patterns cache  # Clean specific patterns from stored path
```

**Safety Categories:**
- 🟢 **Safe**: `node_modules`, `cache`, `build`, `dist`, `.next`, `.nuxt` - can be regenerated
- 🟡 **Careful**: `.vscode`, `target`, `tmp`, `.cache` - contain preferences/settings
- 🔴 **Dangerous**: `.git`, `.env`, `config` - contain critical data

**Options:**
- `--dry-run`: Show what would be deleted without actually deleting
- `--include-careful`: Include careful patterns (requires confirmation)
- `--include-dangerous`: Include dangerous patterns (requires explicit confirmation)
- `--patterns <list>`: Specify exact patterns to clean (comma-separated)

### 5. Info Command

Analyzes directory structure and shows statistics. **Also saves the directory path for use with other commands.**

**Examples:**
```bash
# Analyze directory and save path for other commands
paqt info /path/to/folder

# Re-analyze stored directory
paqt info
```

**Displays:**
- Total directory size
- File and folder counts  
- Top 10 largest directories
- Top 10 largest files
- All sizes in human-readable format

**Path Storage:**
The info command saves the analyzed directory path to `~/.paqt_info`. Other commands can then use this stored path when you omit the folder parameter.

### 6. Remove Command (rm)

Removes files and directories using paths relative to the base directory set by the `info` command.

**Examples:**
```bash
# Remove specific files (paths relative to base directory)
paqt rm file1.txt subdirectory/largefile.dat folder1

# Remove with wildcards (handled by shell)
paqt rm *.log build cache node_modules

**Security:**
- Only works with paths under the base directory (no path traversal)
- Shows detailed summary of what was removed
- Prevents accidental deletion outside the project

### 7. Reset Command

Removes the stored base directory path.

**Examples:**
```bash
# Example workflow
paqt info ~/projects/my-app

# ... use other commands ...

# Remove stored path when done
paqt rm node_modules/package.zip build/bundle.js logs/debug.log

# Clean up stored path
paqt reset
```

**Behavior:**
- Deletes `~/.paqt_info` file
- Shows error if `.paqt_info` file doesn't exist
- Required before switching to a different project directory

## Path Memorization System

paqt uses a simple but powerful path memorization system:

1. **When you provide a path**: The command executes with that specific path
2. **When you omit the path**: The tool uses the previously stored path from `~/.paqt_info`

This allows for efficient workflows:

```bash
# Set working directory once
paqt info ~/large-project

# Use all commands without repeating the path
paqt scan                        # Scan ~/large-project
paqt clean --dry-run             # Clean ~/large-project (dry run)
paqt rm build logs cache         # Remove files from ~/large-project
paqt compress                    # Compress ~/large-project
paqt info                        # Re-analyze ~/large-project

# Clean up when done
paqt reset
```

## Examples

### Basic Workflow

```bash
# Set working directory and analyze
paqt info /path/to/analyze

# Remove unwanted files
paqt rm file1.txt subdirectory/largefile.dat folder1

# Using shell wildcards (remove all .log files and build-related directories)
paqt rm *.log build cache node_modules

### Project Analysis and Cleanup

```bash
# Example: Clean up a development project
paqt info ~/projects/my-app

# See what temporary files exist
paqt clean --dry-run

# Remove safe temporary files
paqt clean

# Remove specific files using relative paths
paqt rm node_modules/package.zip build/bundle.js logs/debug.log

# Clear stored path
paqt reset
```

### Complete Workflow

```bash
# Clear any existing stored path
paqt reset

# Analyze and set working directory
paqt info ~/projects/my-app

```

### Complete Project Analysis Workflow

```bash
# Step 1: Analyze directory structure and set working path
paqt info ~/projects/my-app

# Step 2: Scan for problematic patterns and create metadata
paqt scan                               # Scan ~/projects/my-app

# Step 3: Preview cleanup of temporary files
paqt clean --dry-run                    # Preview cleanup of ~/projects/my-app

# Step 4: Clean specific patterns only
paqt clean --patterns cache            # Actually clean cache from ~/projects/my-app

# Step 5: Remove specific files manually
paqt rm build logs                     # Remove specific files from ~/projects/my-app

# Step 6: Re-analyze after cleanup
paqt info                              # Shows new statistics

# Step 7: Create final archive
paqt compress -o ~/backups/my-app-clean.zpaq

# Step 8: Clean up
paqt reset
```

This workflow demonstrates the power of path memorization - set the working directory once with `info`, then use all other commands without repeating paths.

## Error Handling

- All commands provide clear error messages without stack traces
- Commands validate input parameters and file existence
- Tool availability is checked at startup
- Graceful handling of permission errors and missing files

## Cross-Platform Notes

- **macOS**: Restores both file modification time and birth time where possible
- **Linux**: Restores file modification time (birth time cannot be set)
- **Both**: Preserves directory structure and handles hidden files correctly

## Dependencies

- Node.js 16+ or Bun
- zpaq compression utility
- Standard Unix tools (find, du, etc.) 