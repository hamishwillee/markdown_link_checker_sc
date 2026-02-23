/**
 * Integration test: all supported link formats in fixtures/link_formats/
 *
 * Runs processMarkdown + processRelativeLinks + checkLocalImageLinks on the
 * fixtures and asserts exact link counts and zero errors for valid content.
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { processMarkdown } from "../../src/process_markdown.js";
import { processRelativeLinks } from "../../src/process_relative_links.js";
import { checkLocalImageLinks } from "../../src/process_local_image_links.js";
import { slugifyVuepress } from "../../src/slugify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "../fixtures/link_formats");

const opts = {
  docsroot: FIXTURES,
  markdownroot: FIXTURES,
  log: [],
  anchor_in_heading: true,
  tryMarkdownforHTML: true,
  site_url: null,
  toc: null,
  files: [],
  errors: "ExternalLinkWarning",
  logtofile: false,
  interactive: false,
};

// Replicate index.js processFile() logic
function processFixtureFile(filePath) {
  const contents = fs.readFileSync(filePath, "utf8");
  const result = processMarkdown(contents, filePath, opts);
  result.page_file = filePath;
  result.anchors_auto_headings = result.headings.map(slugifyVuepress);
  return result;
}

let pageA, pageB, results;

before(() => {
  pageA = processFixtureFile(path.join(FIXTURES, "page_a.md"));
  pageB = processFixtureFile(path.join(FIXTURES, "page_b.md"));
  results = [pageA, pageB];
  results.allErrors = [];
});

// ---------------------------------------------------------------------------
// Link counts in page_a.md
// ---------------------------------------------------------------------------
describe("page_a.md — relative links detected", () => {
  test("correct number of relativeLinks (inline markdown + HTML <a> + reference)", () => {
    // Inline: page_b.md, page_b.md#anchor, #internal-section, page_b.md(with title) = 4
    // HTML <a>: page_b.md, #internal-section, page_b.md(with title) = 3
    // Reference: page-b-ref → page_b.md = 1
    // Total: 8
    assert.equal(pageA.relativeLinks.length, 8, `Expected 8 relativeLinks, got ${pageA.relativeLinks.length}`);
  });

  test("relativeLinks include inline markdown link to page_b.md", () => {
    assert.ok(pageA.relativeLinks.some((l) => l.url === "./page_b.md" && l.type === "relativeLink"));
  });

  test("relativeLinks include inline link with anchor to page_b.md#heading-in-page-b", () => {
    assert.ok(pageA.relativeLinks.some((l) => l.address === "./page_b.md" && l.anchor === "heading-in-page-b"));
  });

  test("relativeLinks include anchor-only link #internal-section", () => {
    assert.ok(pageA.relativeLinks.some((l) => l.url === "#internal-section" && l.type === "relativeAnchorLink"));
  });

  test("relativeLinks include HTML <a href> link to page_b.md", () => {
    // Multiple entries for page_b.md from HTML — at least one
    const htmlLinks = pageA.relativeLinks.filter((l) => l.address === "./page_b.md");
    assert.ok(htmlLinks.length >= 2, "Expected at least 2 relativeLinks to page_b.md (inline + HTML)");
  });

  test("relativeLinks include reference link resolved to page_b.md", () => {
    assert.ok(pageA.relativeLinks.some((l) => l.url === "./page_b.md" && l.refName === "page-b-ref"));
  });
});

describe("page_a.md — URL links detected", () => {
  test("correct number of urlLinks (inline + HTML <a> + reference)", () => {
    // Inline: https://example.com = 1
    // HTML <a>: https://example.com = 1 (the title variant links to page_b.md → relativeLink)
    // Reference: url-ref → https://example.com = 1
    // Total: 3
    assert.equal(pageA.urlLinks.length, 3, `Expected 3 urlLinks, got ${pageA.urlLinks.length}`);
  });

  test("urlLinks include inline https://example.com", () => {
    assert.ok(pageA.urlLinks.some((l) => l.url === "https://example.com"));
  });
});

describe("page_a.md — image links detected", () => {
  test("correct number of relativeImageLinks (inline + HTML <img> + reference)", () => {
    // Inline: ./assets/test.png = 1
    // HTML <img>: ./assets/test.png = 1
    // Reference: img-ref → ./assets/test.png = 1
    // Total: 3
    assert.equal(pageA.relativeImageLinks.length, 3, `Expected 3 relativeImageLinks, got ${pageA.relativeImageLinks.length}`);
  });

  test("relativeImageLinks include inline image ./assets/test.png", () => {
    assert.ok(pageA.relativeImageLinks.some((l) => l.url === "./assets/test.png" && l.type === "relativeImageLink"));
  });

  test("correct number of urlImageLinks (inline + HTML <img> + reference)", () => {
    // Inline: https://example.com/image.png = 1
    // HTML <img>: https://example.com/image.png = 1
    // Reference: ext-img-ref → https://example.com/image.png = 1
    // Total: 3
    assert.equal(pageA.urlImageLinks.length, 3, `Expected 3 urlImageLinks, got ${pageA.urlImageLinks.length}`);
  });
});

describe("page_a.md — unhandled link types", () => {
  test("mailto and ftp links are in unHandledLinkTypes", () => {
    const types = pageA.unHandledLinkTypes.map((l) => l.type);
    assert.ok(types.includes("mailtoLink"), "mailtoLink not in unHandledLinkTypes");
    assert.ok(types.includes("ftpLink"), "ftpLink not in unHandledLinkTypes");
  });
});

// ---------------------------------------------------------------------------
// processRelativeLinks: zero errors for valid fixture
// ---------------------------------------------------------------------------
describe("processRelativeLinks — zero errors for valid fixtures", () => {
  test("no relative link errors when all links are valid", () => {
    const errors = processRelativeLinks(results, opts);
    assert.equal(errors.length, 0, `Expected 0 errors, got: ${errors.map((e) => `${e.type}: ${e.link?.url}`).join(", ")}`);
  });
});

// ---------------------------------------------------------------------------
// checkLocalImageLinks: zero errors (assets/test.png exists)
// ---------------------------------------------------------------------------
describe("checkLocalImageLinks — zero errors for present images", () => {
  test("no image errors when image files exist on disk", async () => {
    const errors = await checkLocalImageLinks(results, opts);
    assert.equal(errors.length, 0, `Expected 0 image errors, got: ${errors.map((e) => e.type).join(", ")}`);
  });
});
