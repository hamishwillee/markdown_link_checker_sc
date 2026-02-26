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

  test("entry with no expiry suppresses as before (backward compat)", () => {
    const opts = makeOpts([
      { link: { url: "https://logs.px4.io/", text: "" }, hideReason: "bot block" },
    ]);
    const error = makeError({
      type: "ExternalLinkWarning",
      fileRelativeToRoot: "en/some-page.md",
      linkUrl: "https://logs.px4.io/",
    });
    const result = filterIgnoreErrors([error], opts);
    assert.strictEqual(result.length, 0, "Entry without expiry should still suppress");
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

// ─── Expiry tests ─────────────────────────────────────────────────────────────

describe("filterIgnoreErrors — expiry handling", () => {
  /** Returns YYYY-MM-DD for a date offset by `days` from today. */
  function offsetDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /** Read the ignore_errors.json written by makeOpts and return parsed array. */
  function readIgnoreFile(opts) {
    const filePath = path.join(opts.docsroot, "_link_checker_sc", "ignore_errors.json");
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  test("future expiry: entry still suppresses error", () => {
    const opts = makeOpts([
      {
        link: { url: "https://www.st.com/page.html", text: "" },
        hideReason: "bot block",
        expiry: offsetDate(90),
      },
    ]);
    const error = makeError({
      type: "ExternalLinkError",
      fileRelativeToRoot: "en/some-page.md",
      linkUrl: "https://www.st.com/page.html",
    });
    const result = filterIgnoreErrors([error], opts);
    assert.strictEqual(result.length, 0, "Future-expiry entry should still suppress the error");
  });

  test("future expiry: ignore file is not rewritten", () => {
    const opts = makeOpts([
      {
        link: { url: "https://www.st.com/page.html", text: "" },
        hideReason: "bot block",
        expiry: offsetDate(90),
      },
    ]);
    const error = makeError({
      type: "ExternalLinkError",
      fileRelativeToRoot: "en/some-page.md",
      linkUrl: "https://www.st.com/page.html",
    });
    filterIgnoreErrors([error], opts);
    const remaining = readIgnoreFile(opts);
    assert.strictEqual(remaining.length, 1, "Non-expired entry should remain in ignore file");
  });

  test("past expiry: entry does NOT suppress error", () => {
    const opts = makeOpts([
      {
        link: { url: "https://www.st.com/page.html", text: "" },
        hideReason: "bot block",
        expiry: offsetDate(-1),
      },
    ]);
    const error = makeError({
      type: "ExternalLinkError",
      fileRelativeToRoot: "en/some-page.md",
      linkUrl: "https://www.st.com/page.html",
    });
    const result = filterIgnoreErrors([error], opts);
    assert.strictEqual(result.length, 1, "Expired entry should not suppress the error");
  });

  test("past expiry: expired entry is removed from ignore file", () => {
    const opts = makeOpts([
      {
        link: { url: "https://www.st.com/page.html", text: "" },
        hideReason: "bot block",
        expiry: offsetDate(-1),
      },
    ]);
    const error = makeError({
      type: "ExternalLinkError",
      fileRelativeToRoot: "en/some-page.md",
      linkUrl: "https://www.st.com/page.html",
    });
    filterIgnoreErrors([error], opts);
    const remaining = readIgnoreFile(opts);
    assert.strictEqual(remaining.length, 0, "Expired entry should be removed from ignore file");
  });

  test("mixed entries: only expired entries are removed, active entries still suppress", () => {
    const opts = makeOpts([
      {
        link: { url: "https://expired.example.com/", text: "" },
        hideReason: "expired",
        expiry: offsetDate(-1),
      },
      {
        link: { url: "https://active.example.com/", text: "" },
        hideReason: "active",
        expiry: offsetDate(30),
      },
    ]);
    const expiredError = makeError({
      type: "ExternalLinkError",
      fileRelativeToRoot: "en/some-page.md",
      linkUrl: "https://expired.example.com/",
    });
    const activeError = makeError({
      type: "ExternalLinkError",
      fileRelativeToRoot: "en/some-page.md",
      linkUrl: "https://active.example.com/",
    });
    const result = filterIgnoreErrors([expiredError, activeError], opts);
    assert.strictEqual(result.length, 1, "Only the expired error should be reported");
    assert.strictEqual(result[0].link.url, "https://expired.example.com/");
    const remaining = readIgnoreFile(opts);
    assert.strictEqual(remaining.length, 1, "Only the active entry should remain in the ignore file");
    assert.strictEqual(remaining[0].link.url, "https://active.example.com/");
  });
});
