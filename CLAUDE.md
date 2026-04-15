# markdown_link_checker_sc

Node.js internal (and optional external) markdown link checker. Alpha quality — focused on better internal link handling than existing tools.

## Running

```bash
# Basic usage — check a docs directory
node index.js -r <repo-root> -d <docs-subdir> -e <lang-subdir> -i <image-subdir>

# Example: PX4 docs
node index.js -r ~/github/PX4/PX4-Autopilot/ -d docs -e en -i assets

# PX4 docs — also flag absolute links that should be relative (e.g. https://docs.px4.io/...)
node index.js -r ~/github/PX4/PX4-Autopilot/ -d docs -e en -i assets -u docs.px4.io

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
| `-u` | Site base URL (e.g. `docs.px4.io`). Without `-u`, absolute links to your site are treated as external URLs. With `-u`, they are flagged as `UrlToLocalSite` errors ("should this be relative?") |
| `-m false` | Disable markdown fallback for `.html` links (try `.md` if `.html` not found) |
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

Entries in `ignore_errors.json` may have an optional `expiry` field (`YYYY-MM-DD`). When an entry expires:
- It is **kept** in the file with `expired: true` added (not deleted), so the history is visible.
- The error re-appears in output, annotated with `[Previously ignored until <date>: "<reason>"]`.
- In interactive mode (`-p true`), the previous reason is offered as the default when re-ignoring.
- To renew: remove or update `expiry` and remove `expired: true`. To clean up: delete the entry manually.

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

## Testing

Uses Node.js built-in `node:test` — no extra test dependencies.

```bash
# Run from WSL (UNC paths prevent npm test working from Windows PowerShell)
node --test --test-reporter spec tests/unit/*.test.js tests/integration/*.test.js
```

| Directory | Purpose |
|---|---|
| `tests/fixtures/link_formats/` | Fixture markdown files covering every link format |
| `tests/fixtures/anchor_targets/` | Fixture files covering every anchor target mechanism |
| `tests/errortype/` | Existing per-error-type fixtures (kept from original) |
| `tests/unit/processMarkdown.test.js` | Unit tests: link parsing and anchor detection |
| `tests/unit/slugify.test.js` | Unit tests: VuePress slug algorithm |
| `tests/integration/link_formats.test.js` | Pipeline test on link format fixtures |
| `tests/integration/anchor_targets.test.js` | Pipeline test on anchor target fixtures |
| `tests/integration/error_cases.test.js` | Error detection tests using `tests/errortype/` |

Known limitations are documented as `test.skip` entries with descriptive names so they appear in the test report.

### Mock options for new tests

```js
const opts = {
  docsroot: '/abs/path/to/fixture/dir',
  markdownroot: '/abs/path/to/fixture/dir',
  log: [],
  anchor_in_heading: true,
  tryMarkdownforHTML: true,
  site_url: null,   // set to 'mysite.com' for UrlToLocalSite tests
  toc: null,
  files: [],
  errors: 'ExternalLinkWarning',
  logtofile: false,
  interactive: false,
};
```

Replicate `index.js processFile()` logic in tests to build result objects:
```js
const result = processMarkdown(contents, filePath, opts);
result.page_file = filePath;
result.anchors_auto_headings = result.headings.map(slugifyVuepress);
```

## Known Limitations

- Regex-based parsing — links inside code blocks or HTML comments are captured
- No support for autolinks (`<http://example.com>`)
- No URL-escaped anchor comparison
- Plain reference links `[ref]` not supported — only `[text][ref]`
- Reference definitions must be on a single line
- `[text][missing-ref]` — `ReferenceForLinkNotFoundError` is created but not pushed to errors (commented out in `process_markdown_reflinks.js`)
- `<a name="x">` not detected as an anchor target (only `id=` captured); also crashes the parser if it has inner text and no `href`/`id`
- `msg_docs/` auto-generated files produce many false-positive `CurrentFileMissingAnchor` errors (constants linked as anchors)
