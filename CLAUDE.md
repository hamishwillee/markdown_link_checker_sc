# markdown_link_checker_sc

Node.js internal (and optional external) markdown link checker. Alpha quality — focused on better internal link handling than existing tools.

## Running

```bash
# Basic usage — check a docs directory
node index.js -r <repo-root> -d <docs-subdir> -e <lang-subdir> -i <image-subdir>

# Example: PX4 docs
node index.js -r ~/github/PX4/PX4-Autopilot/ -d docs -e en -i assets

# Include external link checking (slow)
node index.js -r ~/github/PX4/PX4-Autopilot/ -d docs -e en -i assets -x true
```

## Key CLI Options

| Flag | Purpose |
|------|---------|
| `-r` | Repo root (everything resolved relative to this) |
| `-d` | Docs subfolder relative to `-r` |
| `-e` | Subdirectory within docs to check (e.g. `en`) |
| `-i` | Image directory for orphan checking |
| `-x true` | Also check external links |
| `-f` | JSON file listing specific files to report on |
| `-t` | TOC/summary file path (inferred if not set) |
| `-u` | Site base URL to catch absolute links that should be relative |
| `-p true` | Interactive mode — build ignore list by answering prompts |
| `-o false` | Disable log file output |

## Output

- Console: markdown-friendly grouped error list
- `logs/filteredErrors.json` — final errors (post-filter)
- `logs/allErrors.json` — all errors before filtering
- `logs/allResults.json` — complete parse results

## Dependencies

```bash
npm install
```

Three runtime dependencies: `commander`, `normalize-path`, `prompt-sync`.

## Architecture

Pipeline in `index.js`:
1. Scan directory recursively
2. Parse each file (`process_markdown.js`) — extracts links, headings, HTML ids, reference links
3. Validate relative links (`process_relative_links.js`)
4. Validate local image links (`process_local_image_links.js`)
5. Flag absolute URLs to current site (`process_internal_url_links.js`)
6. Check orphaned pages (`process_orphans.js`)
7. Check orphaned images (`process_image_orphans.js`)
8. Optionally check external URLs (`process_external_url_links.js`)
9. Filter errors (`filters.js`)
10. Output errors (`output_errors.js`)

State is managed in `index.js` via `sharedData` from `src/shared_data.js`. All processing/filter/output functions receive `options` as an explicit parameter — `sharedData` is not imported by any `src/` module other than the session state it provides to `index.js`.

## Ignore Files

- `<docsroot>/_link_checker_sc/ignorefile.json` — array of files to skip parsing (paths relative to docsroot)
- `<repo>/_link_checker_sc/ignore_errors.json` — specific errors to suppress (built interactively with `-p true`)

## Source Files

| File | Role |
|------|------|
| `src/shared_data.js` | Session state object — used only by `index.js` |
| `src/helpers.js` | File type detection, logging (`logFunction(options, name)`, `logToFile(path, data, options)`) |
| `src/slugify.js` | VuePress heading → anchor slug |
| `src/links.js` | `Link` class — parses and classifies a URL; constructor takes `options` |
| `src/errors.js` | Error class hierarchy (13 types); all constructors take `docsroot` explicitly |
| `src/process_markdown.js` | Main regex parser — `processMarkdown(contents, page, options)` |
| `src/process_markdown_reflinks.js` | Reference-style links `[text][ref]` — `processReferenceLinks(content, page, options)` |
| `src/process_relative_links.js` | Relative link/anchor validation — `processRelativeLinks(results, options)` |
| `src/process_local_image_links.js` | Image file existence checks — `checkLocalImageLinks(results, options)` |
| `src/process_internal_url_links.js` | Flags absolute URLs to current site — `processUrlsToLocalSource(results, options)` |
| `src/process_external_url_links.js` | External URL checks with concurrency/retry |
| `src/process_orphans.js` | Orphaned page detection — `checkPageOrphans(results, options)`, `getPageWithMostLinks(pages, options)` |
| `src/process_image_orphans.js` | Orphaned image detection — `checkImageOrphansGlobal(results, options, allImageFiles)` |
| `src/filters.js` | Error filtering — `filterErrors(errors, options)`, `filterIgnoreErrors(errors, options)` |
| `src/output_errors.js` | Console + file output — `outputErrors(results, options)` |

## Known Limitations

- Regex-based parsing — links inside code blocks or HTML comments are captured
- No support for autolinks (`<http://example.com>`)
- No URL-escaped anchor comparison
- Plain reference links `[ref]` not supported — only `[text][ref]`
- Reference definitions must be on a single line
- `msg_docs/` auto-generated files produce many false-positive `CurrentFileMissingAnchor` errors (constants linked as anchors)
