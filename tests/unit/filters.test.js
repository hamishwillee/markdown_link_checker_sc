/**
 * Unit tests for filterIgnoreErrors in src/filters.js.
 *
 * filterIgnoreErrors reads ignore_errors.json from disk, so we point
 * options.docsroot at a temp directory that we populate per-test.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { filterIgnoreErrors } from "../../src/filters.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Write an ignore_errors.json inside a fresh temp docsroot and return opts. */
function makeOpts(ignoreEntries) {
  const docsroot = fs.mkdtempSync(path.join(os.tmpdir(), "lc-test-"));
  const dir = path.join(docsroot, "_link_checker_sc");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "ignore_errors.json"),
    JSON.stringify(ignoreEntries, null, 2)
  );
  return { docsroot, log: [] };
}

/** Minimal error object that matches what filterIgnoreErrors inspects. */
function makeError({ type, fileRelativeToRoot, linkUrl } = {}) {
  return {
    type,
    fileRelativeToRoot,
    link: linkUrl ? { url: linkUrl } : undefined,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("filterIgnoreErrors — URL-only matching", () => {
  test("URL-only entry suppresses error with matching link.url", () => {
    const opts = makeOpts([
      { link: { url: "https://logs.px4.io/", text: "" }, hideReason: "bot block" },
    ]);
    const error = makeError({
      type: "ExternalLinkWarning",
      fileRelativeToRoot: "en/some-page.md",
      linkUrl: "https://logs.px4.io/",
    });
    const result = filterIgnoreErrors([error], opts);
    assert.strictEqual(result.length, 0, "Error should be suppressed");
  });

  test("URL-only entry does not suppress error with a different link.url", () => {
    const opts = makeOpts([
      { link: { url: "https://logs.px4.io/", text: "" }, hideReason: "bot block" },
    ]);
    const error = makeError({
      type: "ExternalLinkWarning",
      fileRelativeToRoot: "en/some-page.md",
      linkUrl: "https://other.example.com/",
    });
    const result = filterIgnoreErrors([error], opts);
    assert.strictEqual(result.length, 1, "Error with different URL should not be suppressed");
  });

  test("URL-only entry does not suppress error with no link", () => {
    const opts = makeOpts([
      { link: { url: "https://logs.px4.io/", text: "" }, hideReason: "bot block" },
    ]);
    const error = makeError({
      type: "LinkedInternalPageMissing",
      fileRelativeToRoot: "en/some-page.md",
      linkUrl: undefined,
    });
    const result = filterIgnoreErrors([error], opts);
    assert.strictEqual(result.length, 1, "Error without a link should not be suppressed by URL-only entry");
  });

  test("existing type+file matching still works unchanged", () => {
    const opts = makeOpts([
      {
        type: "ExternalLinkWarning",
        fileRelativeToRoot: "en/some-page.md",
        link: { url: "https://example.com/", text: "" },
      },
    ]);
    // Same type + file + url → suppressed
    const errorMatch = makeError({
      type: "ExternalLinkWarning",
      fileRelativeToRoot: "en/some-page.md",
      linkUrl: "https://example.com/",
    });
    // Different file → not suppressed
    const errorOtherFile = makeError({
      type: "ExternalLinkWarning",
      fileRelativeToRoot: "en/other-page.md",
      linkUrl: "https://example.com/",
    });
    const result = filterIgnoreErrors([errorMatch, errorOtherFile], opts);
    assert.strictEqual(result.length, 1, "Only the matching file+type+url error should be suppressed");
    assert.strictEqual(result[0].fileRelativeToRoot, "en/other-page.md");
  });
});
