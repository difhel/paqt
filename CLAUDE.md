Write a TypeScript command-line program called `xtar` that supports three subcommands—`scan`, `compress` and `decompress`—to reliably snapshot, archive, and restore a folder on Linux and macOS (both Node.js and Bun). The tool must meet the following requirements:

1. **Environment & Dependencies**

   * Detect at startup that `tar` and `xz` are installed.
   * Verify that `tar -I` works; if not, fall back to `gtar -I`.
   * Exit with a clear error if neither works.
   * No support for symlinks: skip any `.l*nk` or symlink entries.

2. **Common CLI Conventions**

   * Use a modern CLI-parsing library (e.g. `commander` or `yargs`).
   * Include `--help` and `--version`.
   * Support both relative and absolute paths for folder/archive arguments.
   * Exit with nonzero codes on failure.

3. **Subcommands**

   1. **`scan <folder> [--append-only]`**

      * Recursively traverse `<folder>` (including hidden files).
      * For each regular file, read its last-modified time (`mtime`).
      * Write (or update) a CSV file named `metadata.csv` in `<folder>` with header:

        ```
        path,modifiedTime
        ```

        where `path` is the file’s path relative to `<folder>`, and `modifiedTime` is in ISO-8601 (`YYYY-MM-DDTHH:mm:ssZ`).
      * **Default mode**: overwrite the CSV with the current snapshot.
      * **`--append-only`**: load existing `metadata.csv`, preserve its entries (never update their timestamps), then append any new files found.

   2. **`compress <folder> [--output <archive.tar.xz>]`**

      * Ensure `<folder>/metadata.csv` exists; if missing, invoke `scan <folder>`.
      * Run:

        ```
        tar -C <parent-of-folder> -I "xz -9e --lzma2=dict=24g -T0" -cf <archive> <folder-name>
        ```

        to produce a `.tar.xz` archive with maximum CPU threads, 24 GB LZMA2 dictionary, and extreme compression (`-9e`).
      * Default `<archive>` name: `<folder-name>.tar.xz` in the current working directory.
      * Exit only after the archive is complete; preserve `metadata.csv` alongside the archive.

   3. **`decompress <archive.tar.xz> [--output <folder>]`**

      * Unpack to `--output` or, by default, to a folder named after the archive (minus `.tar.xz`).
      * After extraction, locate `metadata.csv` inside that folder.
      * For each entry in the CSV, set both the file’s creation/birth time **and** its last-modified time to the stored `modifiedTime` (using `fs.utimes` or a suitable native extension).
      * Report an error and exit if `metadata.csv` is missing or malformed.

4. **Platform Notes**

   * Must run on Node.js ≥14 and Bun.
   * On macOS, if built-in `tar` lacks `-I`, detect and switch to `gtar`.

5. **Edge Cases & Logging**

   * Skip symlinks silently.
   * Include hidden files (`.*`).
   * Emit simple progress logs (“Scanning…”, “Compressing…”, “Restoring timestamps…”).
   * Fail fast on unexpected errors with meaningful messages.

Structure your code into well-named modules (e.g. `cli.ts`, `scanner.ts`, `archiver.ts`, `restorer.ts`). Use `async/await` and `fs.promises`. Provide clear JSDoc comments for exported functions. Include minimal tests or usage examples in the README.
