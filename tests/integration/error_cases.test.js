/**
 * Integration test: error detection using tests/errortype/ fixtures.
 *
 * Each describe block covers one error type, using the existing fixture files.
 * Tests assert that specific errors ARE raised for bad links, and that good
 * links produce no errors.
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { processMarkdown } from "../../src/process_markdown.js";
import { processRelativeLinks } from "../../src/process_relative_links.js";
import { checkLocalImageLinks } from "../../src/process_local_image_links.js";
import { processUrlsToLocalSource } from "../../src/process_internal_url_links.js";
import { slugifyVuepress } from "../../src/slugify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ERROR_TYPES_DIR = path.resolve(__dirname, "../errortype");

// Replicate index.js processFile() logic
function processFixtureFile(filePath, docsroot) {
  const contents = fs.readFileSync(filePath, "utf8");
  const opts = makeOpts(docsroot);
  const result = processMarkdown(contents, filePath, opts);
  result.page_file = filePath;
  result.anchors_auto_headings = result.headings.map(slugifyVuepress);
  return result;
}

function makeOpts(docsroot, extra = {}) {
  return {
    docsroot,
    markdownroot: docsroot,
    log: [],
    anchor_in_heading: true,
    tryMarkdownforHTML: true,
    site_url: "mylocalsite.com",
    toc: null,
    files: [],
    errors: "ExternalLinkWarning",
    logtofile: false,
    interactive: false,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// CurrentFileMissingAnchor
// ---------------------------------------------------------------------------
describe("CurrentFileMissingAnchor", () => {
  const dir = path.join(ERROR_TYPES_DIR, "current_file_missing_anchor");
  const opts = makeOpts(dir);

  test("raises CurrentFileMissingAnchor when anchor not found in current page", () => {
    const page = processFixtureFile(path.join(dir, "missing_heading.md"), dir);
    const results = [page];
    results.allErrors = [];
    const errors = processRelativeLinks(results, opts);
    const match = errors.find((e) => e.type === "CurrentFileMissingAnchor");
    assert.ok(match, "Expected CurrentFileMissingAnchorError");
  });

  test("no error when anchor matches a heading in current page", () => {
    const page = processFixtureFile(path.join(dir, "heading_present_for_anchor.md"), dir);
    const results = [page];
    results.allErrors = [];
    const errors = processRelativeLinks(results, opts);
    const match = errors.find((e) => e.type === "CurrentFileMissingAnchor");
    assert.equal(match, undefined, `Unexpected CurrentFileMissingAnchorError: ${match?.link?.url}`);
  });
});

// ---------------------------------------------------------------------------
// LinkedFileMissingAnchor
// ---------------------------------------------------------------------------
describe("LinkedFileMissingAnchor", () => {
  const dir = path.join(ERROR_TYPES_DIR, "linked_file_missing_anchor");
  const opts = makeOpts(dir);

  let errors;
  before(() => {
    const source = processFixtureFile(path.join(dir, "file_with_broken_heading_link.md"), dir);
    const target = processFixtureFile(path.join(dir, "file_without_heading.md"), dir);
    const results = [source, target];
    results.allErrors = [];
    errors = processRelativeLinks(results, opts);
  });

  test("raises LinkedFileMissingAnchor for anchor that does not exist in linked file", () => {
    const match = errors.find((e) => e.type === "LinkedFileMissingAnchor");
    assert.ok(match, "Expected LinkedFileMissingAnchorError");
    assert.ok(match.link.anchor.includes("doesnt_exist"), `Unexpected anchor: ${match.link.anchor}`);
  });

  test("no error for link to anchor that does exist in linked file", () => {
    // The good link targets #cool-matched-heading-for-anchor-link
    const badErrors = errors.filter(
      (e) => e.type === "LinkedFileMissingAnchor" && e.link.anchor === "cool-matched-heading-for-anchor-link"
    );
    assert.equal(badErrors.length, 0, "Unexpected error for valid anchor link");
  });

  test("exactly one LinkedFileMissingAnchor error", () => {
    const anchErrors = errors.filter((e) => e.type === "LinkedFileMissingAnchor");
    assert.equal(anchErrors.length, 1, `Expected 1 LinkedFileMissingAnchor, got ${anchErrors.length}`);
  });
});

// ---------------------------------------------------------------------------
// LinkedInternalPageMissing
// ---------------------------------------------------------------------------
describe("LinkedInternalPageMissing", () => {
  const dir = path.join(ERROR_TYPES_DIR, "linked_internal_file_missing");
  const opts = makeOpts(dir);

  let errors;
  before(() => {
    // Process all .md files in the directory
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    const results = files.map((f) => processFixtureFile(path.join(dir, f), dir));
    results.allErrors = [];
    errors = processRelativeLinks(results, opts);
  });

  test("raises LinkedInternalPageMissing for link to non-existent file", () => {
    const match = errors.find((e) => e.type === "LinkedInternalPageMissing");
    assert.ok(match, "Expected LinkedInternalPageMissingError");
    assert.ok(match.link.address.includes("file_no_exists"), `Unexpected address: ${match.link.address}`);
  });

  test("no error for link to file that exists in same directory", () => {
    const badErrors = errors.filter(
      (e) => e.type === "LinkedInternalPageMissing" && e.link.address.includes("file_present_should_be_no_error")
    );
    assert.equal(badErrors.length, 0, "Unexpected error for present file link");
  });

  test("no error for relative link to file that exists via ../ path", () => {
    const badErrors = errors.filter(
      (e) => e.type === "LinkedInternalPageMissing" && e.link.address.includes("file_present_relative_link_no_error")
    );
    assert.equal(badErrors.length, 0, "Unexpected error for relative path link to present file");
  });

  test("exactly one LinkedInternalPageMissing error", () => {
    const missingErrors = errors.filter((e) => e.type === "LinkedInternalPageMissing");
    assert.equal(missingErrors.length, 1, `Expected 1 LinkedInternalPageMissing, got ${missingErrors.length}`);
  });
});

// ---------------------------------------------------------------------------
// InternalLinkToHTML
// ---------------------------------------------------------------------------
describe("InternalLinkToHTML", () => {
  const dir = path.join(ERROR_TYPES_DIR, "linked_internal_file_html");
  const opts = makeOpts(dir, { tryMarkdownforHTML: true });

  let errors;
  before(() => {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    const results = files.map((f) => processFixtureFile(path.join(dir, f), dir));
    results.allErrors = [];
    errors = processRelativeLinks(results, opts);
  });

  test("raises InternalLinkToHTML when linking to .html but .md version exists", () => {
    const match = errors.find((e) => e.type === "InternalLinkToHTML");
    assert.ok(match, "Expected InternalLinkToHTMLError");
  });
});

// ---------------------------------------------------------------------------
// LocalImageNotFound
// ---------------------------------------------------------------------------
describe("LocalImageNotFound", () => {
  const dir = path.join(ERROR_TYPES_DIR, "local_image_not_found");
  const opts = makeOpts(dir);

  let errors;
  before(async () => {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    const results = files.map((f) => processFixtureFile(path.join(dir, f), dir));
    results.allErrors = [];
    errors = await checkLocalImageLinks(results, opts);
  });

  test("raises LocalImageNotFound for each missing image", () => {
    const match = errors.filter((e) => e.type === "LocalImageNotFound");
    assert.ok(match.length >= 2, `Expected at least 2 LocalImageNotFound errors, got ${match.length}`);
  });

  test("no LocalImageNotFound error for image that exists on disk", () => {
    const badErrors = errors.filter(
      (e) => e.type === "LocalImageNotFound" && e.link.url.includes("test.png")
    );
    assert.equal(badErrors.length, 0, "Unexpected error for present image file");
  });
});

// ---------------------------------------------------------------------------
// UrlToLocalSite
// ---------------------------------------------------------------------------
describe("UrlToLocalSite", () => {
  const dir = path.join(ERROR_TYPES_DIR, "url_to_local_site");
  const opts = makeOpts(dir, { site_url: "mylocalsite.com" });

  let errors;
  before(() => {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    const results = files.map((f) => processFixtureFile(path.join(dir, f), dir));
    results.allErrors = [];
    errors = processUrlsToLocalSource(results, opts);
  });

  test("raises UrlToLocalSite for absolute URL to the local site (markdown link)", () => {
    const match = errors.find((e) => e.type === "UrlToLocalSite" && e.link.url.includes("markdown"));
    // The fixture has both a markdown link and an HTML link
    const allMatch = errors.filter((e) => e.type === "UrlToLocalSite");
    assert.ok(allMatch.length >= 1, "Expected at least one UrlToLocalSiteError");
  });

  test("raises UrlToLocalSite for absolute URL to the local site (HTML <a> link)", () => {
    const allMatch = errors.filter((e) => e.type === "UrlToLocalSite");
    assert.ok(allMatch.length >= 2, `Expected at least 2 UrlToLocalSite errors, got ${allMatch.length}`);
  });
});
