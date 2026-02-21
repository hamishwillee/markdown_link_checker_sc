/**
 * Integration test: all anchor target mechanisms in fixtures/anchor_targets/
 *
 * Tests that every anchor-creation mechanism in page.md is correctly detected,
 * and that links to those anchors from linker.md pass validation — except for
 * <a name="..."> which is a known limitation.
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { processMarkdown } from "../../src/process_markdown.js";
import { processRelativeLinks } from "../../src/process_relative_links.js";
import { slugifyVuepress } from "../../src/slugify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "../fixtures/anchor_targets");

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

function processFixtureFile(filePath) {
  const contents = fs.readFileSync(filePath, "utf8");
  const result = processMarkdown(contents, filePath, opts);
  result.page_file = filePath;
  result.anchors_auto_headings = result.headings.map(slugifyVuepress);
  return result;
}

let pageMd, linkerMd, results, relLinkErrors;

before(() => {
  pageMd = processFixtureFile(path.join(FIXTURES, "page.md"));
  linkerMd = processFixtureFile(path.join(FIXTURES, "linker.md"));
  results = [pageMd, linkerMd];
  results.allErrors = [];
  relLinkErrors = processRelativeLinks(results, opts);
});

// ---------------------------------------------------------------------------
// Anchors detected in page.md
// ---------------------------------------------------------------------------
describe("page.md — auto-heading anchors", () => {
  test('"Auto Heading One" → "auto-heading-one" in anchors_auto_headings', () => {
    assert.ok(pageMd.anchors_auto_headings.includes("auto-heading-one"),
      `Expected "auto-heading-one", got: ${JSON.stringify(pageMd.anchors_auto_headings)}`);
  });

  test('"Multi Word Heading" → "multi-word-heading" in anchors_auto_headings', () => {
    assert.ok(pageMd.anchors_auto_headings.includes("multi-word-heading"),
      `Expected "multi-word-heading", got: ${JSON.stringify(pageMd.anchors_auto_headings)}`);
  });

  test('"Heading With Special-Chars And/Slash" → "heading-with-special-chars-and-slash" in anchors_auto_headings', () => {
    assert.ok(pageMd.anchors_auto_headings.includes("heading-with-special-chars-and-slash"),
      `Expected "heading-with-special-chars-and-slash", got: ${JSON.stringify(pageMd.anchors_auto_headings)}`);
  });
});

describe("page.md — {#custom-anchor} syntax", () => {
  test('"Custom Anchor Heading {#my-custom-anchor}" → "my-custom-anchor" in anchors_tag_ids', () => {
    assert.ok(pageMd.anchors_tag_ids.includes("my-custom-anchor"),
      `Expected "my-custom-anchor" in anchors_tag_ids, got: ${JSON.stringify(pageMd.anchors_tag_ids)}`);
  });

  test('"Custom Anchor Heading" text stored in headings (without the {#...} part)', () => {
    assert.ok(pageMd.headings.includes("Custom Anchor Heading"),
      `Expected "Custom Anchor Heading" in headings, got: ${JSON.stringify(pageMd.headings)}`);
  });
});

describe("page.md — HTML id= attribute anchors", () => {
  test('<a id="html-a-id-anchor"> → "html-a-id-anchor" in anchors_tag_ids', () => {
    assert.ok(pageMd.anchors_tag_ids.includes("html-a-id-anchor"),
      `Expected "html-a-id-anchor" in anchors_tag_ids, got: ${JSON.stringify(pageMd.anchors_tag_ids)}`);
  });

  test('<div id="html-div-id-anchor"> → "html-div-id-anchor" in anchors_tag_ids', () => {
    assert.ok(pageMd.anchors_tag_ids.includes("html-div-id-anchor"),
      `Expected "html-div-id-anchor" in anchors_tag_ids, got: ${JSON.stringify(pageMd.anchors_tag_ids)}`);
  });
});

describe("page.md — known limitation: <a name=...>", () => {
  test.skip(
    '<a name="old-style-name-anchor"> is NOT detected as anchor target — KNOWN LIMITATION: ' +
    'only id= attribute is captured; name= is not. ' +
    'Additionally, <a name="..."> with inner text and no href/id crashes the parser (Link: url argument is required), ' +
    'so this element cannot safely appear in fixture files.',
    () => {
      assert.ok(pageMd.anchors_tag_ids.includes("old-style-name-anchor"),
        "old-style-name-anchor should be in anchors_tag_ids");
    }
  );
});

// ---------------------------------------------------------------------------
// processRelativeLinks: linker.md links to page.md anchors
// ---------------------------------------------------------------------------
describe("linker.md → page.md — anchor link validation", () => {
  test("link to auto-heading anchor produces no error", () => {
    const err = relLinkErrors.find(
      (e) => e.link?.anchor === "auto-heading-one"
    );
    assert.equal(err, undefined, `Unexpected error for #auto-heading-one: ${err?.type}`);
  });

  test("link to multi-word-heading anchor produces no error", () => {
    const err = relLinkErrors.find(
      (e) => e.link?.anchor === "multi-word-heading"
    );
    assert.equal(err, undefined, `Unexpected error for #multi-word-heading: ${err?.type}`);
  });

  test("link to special-chars-and-slash heading produces no error", () => {
    const err = relLinkErrors.find(
      (e) => e.link?.anchor === "heading-with-special-chars-and-slash"
    );
    assert.equal(err, undefined, `Unexpected error for #heading-with-special-chars-and-slash`);
  });

  test("link to {#my-custom-anchor} produces no error", () => {
    const err = relLinkErrors.find(
      (e) => e.link?.anchor === "my-custom-anchor"
    );
    assert.equal(err, undefined, `Unexpected error for #my-custom-anchor: ${err?.type}`);
  });

  test("link to <a id=...> anchor produces no error", () => {
    const err = relLinkErrors.find(
      (e) => e.link?.anchor === "html-a-id-anchor"
    );
    assert.equal(err, undefined, `Unexpected error for #html-a-id-anchor: ${err?.type}`);
  });

  test("link to <div id=...> anchor produces no error", () => {
    const err = relLinkErrors.find(
      (e) => e.link?.anchor === "html-div-id-anchor"
    );
    assert.equal(err, undefined, `Unexpected error for #html-div-id-anchor: ${err?.type}`);
  });

  test("link to <a name=...> anchor produces LinkedFileMissingAnchorError (known limitation)", () => {
    const err = relLinkErrors.find(
      (e) => e.type === "LinkedFileMissingAnchor" && e.link?.anchor === "old-style-name-anchor"
    );
    assert.ok(err, "Expected LinkedFileMissingAnchorError for #old-style-name-anchor");
  });

  test("exactly one error total (only the <a name=...> link fails)", () => {
    assert.equal(relLinkErrors.length, 1,
      `Expected exactly 1 error, got ${relLinkErrors.length}: ${relLinkErrors.map((e) => `${e.type}:${e.link?.anchor}`).join(", ")}`
    );
  });
});
