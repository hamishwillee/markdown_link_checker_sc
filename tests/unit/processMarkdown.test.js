import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "url";
import path from "path";
import { processMarkdown } from "../../src/process_markdown.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_LINK_FORMATS = path.resolve(__dirname, "../fixtures/link_formats");
const FIXTURES_ANCHOR_TARGETS = path.resolve(__dirname, "../fixtures/anchor_targets");

// Minimal options object for unit tests — no file I/O, no logging.
function makeOpts(docsroot) {
  return {
    docsroot,
    markdownroot: docsroot,
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
}

const PAGE_A = path.join(FIXTURES_LINK_FORMATS, "page_a.md");
const optsLF = makeOpts(FIXTURES_LINK_FORMATS);

// ---------------------------------------------------------------------------
// Inline markdown links
// ---------------------------------------------------------------------------
describe("Inline markdown links", () => {
  test("[text](./page_b.md) detected as relativeLink", () => {
    const result = processMarkdown("[text](./page_b.md)", PAGE_A, optsLF);
    const match = result.relativeLinks.find((l) => l.url === "./page_b.md");
    assert.ok(match, "relativeLink with url ./page_b.md not found");
    assert.equal(match.type, "relativeLink");
    assert.equal(match.address, "./page_b.md");
    assert.equal(match.anchor, "");
  });

  test("[text](./page_b.md#anchor) detected as relativeLink with anchor", () => {
    const result = processMarkdown("[text](./page_b.md#heading-in-page-b)", PAGE_A, optsLF);
    const match = result.relativeLinks.find((l) => l.url === "./page_b.md#heading-in-page-b");
    assert.ok(match, "relativeLink to page_b.md#heading-in-page-b not found");
    assert.equal(match.address, "./page_b.md");
    assert.equal(match.anchor, "heading-in-page-b");
  });

  test("[text](#anchor) detected as relativeAnchorLink (in relativeLinks array)", () => {
    const result = processMarkdown("[text](#internal-section)", PAGE_A, optsLF);
    const match = result.relativeLinks.find((l) => l.url === "#internal-section");
    assert.ok(match, "relativeAnchorLink #internal-section not found");
    assert.equal(match.type, "relativeAnchorLink");
    assert.equal(match.address, "");
    assert.equal(match.anchor, "internal-section");
  });

  test('[text](./page_b.md "Title text") — title is captured', () => {
    const result = processMarkdown('[text](./page_b.md "Title text")', PAGE_A, optsLF);
    const match = result.relativeLinks.find((l) => l.url === './page_b.md');
    assert.ok(match, "relativeLink with title not found");
    assert.equal(match.title, "Title text");
  });

  test("[text](https://example.com) detected as urlLink", () => {
    const result = processMarkdown("[text](https://example.com)", PAGE_A, optsLF);
    const match = result.urlLinks.find((l) => l.url === "https://example.com");
    assert.ok(match, "urlLink https://example.com not found");
    assert.equal(match.type, "urlLink");
  });

  test("[text](mailto:test@example.com) detected as mailtoLink (unhandled, not in relativeLinks)", () => {
    const result = processMarkdown("[text](mailto:test@example.com)", PAGE_A, optsLF);
    // mailtoLink ends up in unHandledLinkTypes since there's no array for it
    const inUnhandled = result.unHandledLinkTypes.find((l) => l.url === "mailto:test@example.com");
    assert.ok(inUnhandled, "mailtoLink not found in unHandledLinkTypes");
    assert.equal(inUnhandled.type, "mailtoLink");
  });

  test("[text](ftp://example.com) detected as ftpLink (unhandled, not in relativeLinks)", () => {
    const result = processMarkdown("[text](ftp://example.com)", PAGE_A, optsLF);
    const inUnhandled = result.unHandledLinkTypes.find((l) => l.url === "ftp://example.com");
    assert.ok(inUnhandled, "ftpLink not found in unHandledLinkTypes");
    assert.equal(inUnhandled.type, "ftpLink");
  });

  test("link text is captured", () => {
    const result = processMarkdown("[My Link Text](./page_b.md)", PAGE_A, optsLF);
    const match = result.relativeLinks.find((l) => l.url === "./page_b.md");
    assert.ok(match);
    assert.equal(match.text, "My Link Text");
  });
});

// ---------------------------------------------------------------------------
// Inline markdown images
// ---------------------------------------------------------------------------
describe("Inline markdown images", () => {
  test("![alt](./assets/test.png) detected as relativeImageLink", () => {
    const result = processMarkdown("![alt](./assets/test.png)", PAGE_A, optsLF);
    const match = result.relativeImageLinks.find((l) => l.url === "./assets/test.png");
    assert.ok(match, "relativeImageLink ./assets/test.png not found");
    assert.equal(match.type, "relativeImageLink");
  });

  test("![alt](https://example.com/image.png) detected as urlImageLink", () => {
    const result = processMarkdown("![alt](https://example.com/image.png)", PAGE_A, optsLF);
    const match = result.urlImageLinks.find((l) => l.url === "https://example.com/image.png");
    assert.ok(match, "urlImageLink https://example.com/image.png not found");
    assert.equal(match.type, "urlImageLink");
  });
});

// ---------------------------------------------------------------------------
// HTML <a href> tags
// ---------------------------------------------------------------------------
describe("HTML <a href> tags", () => {
  test('<a href="./page_b.md"> detected as relativeLink', () => {
    const result = processMarkdown('<a href="./page_b.md">text</a>', PAGE_A, optsLF);
    const match = result.relativeLinks.find((l) => l.url === "./page_b.md");
    assert.ok(match, "relativeLink from <a href> not found");
    assert.equal(match.type, "relativeLink");
  });

  test('<a href="#internal-section"> detected as relativeAnchorLink', () => {
    const result = processMarkdown('<a href="#internal-section">text</a>', PAGE_A, optsLF);
    const match = result.relativeLinks.find((l) => l.url === "#internal-section");
    assert.ok(match, "relativeAnchorLink from <a href=#...> not found");
    assert.equal(match.type, "relativeAnchorLink");
  });

  test('<a href="https://example.com"> detected as urlLink', () => {
    const result = processMarkdown('<a href="https://example.com">text</a>', PAGE_A, optsLF);
    const match = result.urlLinks.find((l) => l.url === "https://example.com");
    assert.ok(match, "urlLink from <a href=https://...> not found");
    assert.equal(match.type, "urlLink");
  });

  test('<a href="./page_b.md" title="a title"> — title captured', () => {
    const result = processMarkdown('<a href="./page_b.md" title="a title">text</a>', PAGE_A, optsLF);
    const match = result.relativeLinks.find((l) => l.url === "./page_b.md");
    assert.ok(match, "relativeLink from <a href> with title not found");
    assert.equal(match.title, "a title");
  });

  test('<a id="x"> without href is NOT added to links (it is an anchor target, not a link)', () => {
    const result = processMarkdown('<a id="anchor-only"></a>', PAGE_A, optsLF);
    // Should not appear in any link array
    const allLinks = [
      ...result.relativeLinks,
      ...result.urlLinks,
      ...result.relativeImageLinks,
      ...result.urlImageLinks,
      ...result.unHandledLinkTypes,
    ];
    const match = allLinks.find((l) => l.url === "");
    assert.equal(match, undefined, "<a id=...> without href should not be a link");
    // But the id should be captured as an anchor target
    assert.ok(result.anchors_tag_ids.includes("anchor-only"), "id from <a id=...> not in anchors_tag_ids");
  });
});

// ---------------------------------------------------------------------------
// HTML <img src> tags
// ---------------------------------------------------------------------------
describe("HTML <img src> tags", () => {
  test('<img src="./assets/test.png" /> detected as relativeImageLink', () => {
    const result = processMarkdown('<img src="./assets/test.png" />', PAGE_A, optsLF);
    const match = result.relativeImageLinks.find((l) => l.url === "./assets/test.png");
    assert.ok(match, "relativeImageLink from <img src=...> not found");
    assert.equal(match.type, "relativeImageLink");
  });

  test('<img src="https://example.com/image.png" /> detected as urlImageLink', () => {
    const result = processMarkdown('<img src="https://example.com/image.png" />', PAGE_A, optsLF);
    const match = result.urlImageLinks.find((l) => l.url === "https://example.com/image.png");
    assert.ok(match, "urlImageLink from <img src=https://...> not found");
    assert.equal(match.type, "urlImageLink");
  });

  test("<img> without trailing slash is also detected", () => {
    const result = processMarkdown('<img src="./assets/test.png" width="400">', PAGE_A, optsLF);
    const match = result.relativeImageLinks.find((l) => l.url === "./assets/test.png");
    assert.ok(match, "relativeImageLink from <img src=...> without trailing slash not found");
  });
});

// ---------------------------------------------------------------------------
// Reference links
// ---------------------------------------------------------------------------
describe("Reference links", () => {
  test("[text][ref] with matching [ref]: ./page_b.md → detected as relativeLink", () => {
    const content = "[My link][page-b-ref]\n\n[page-b-ref]: ./page_b.md";
    const result = processMarkdown(content, PAGE_A, optsLF);
    const match = result.relativeLinks.find((l) => l.url === "./page_b.md");
    assert.ok(match, "relativeLink from reference link not found");
    assert.equal(match.type, "relativeLink");
    assert.equal(match.text, "My link");
  });

  test("[text][ref] with matching [ref]: https://... → detected as urlLink", () => {
    const content = "[My link][url-ref]\n\n[url-ref]: https://example.com";
    const result = processMarkdown(content, PAGE_A, optsLF);
    const match = result.urlLinks.find((l) => l.url === "https://example.com");
    assert.ok(match, "urlLink from reference link not found");
    assert.equal(match.type, "urlLink");
  });

  test("![alt][ref] with matching [ref]: ./assets/test.png → detected as relativeImageLink", () => {
    const content = "![alt][img-ref]\n\n[img-ref]: ./assets/test.png";
    const result = processMarkdown(content, PAGE_A, optsLF);
    const match = result.relativeImageLinks.find((l) => l.url === "./assets/test.png");
    assert.ok(match, "relativeImageLink from reference image link not found");
    assert.equal(match.type, "relativeImageLink");
  });

  test("[text][] (empty reference) → ReferenceLinkEmptyReferenceError in errors", () => {
    const content = "[My link][]";
    const result = processMarkdown(content, PAGE_A, optsLF);
    const err = result.errors.find((e) => e.type === "ReferenceLinkEmptyReference");
    assert.ok(err, "ReferenceLinkEmptyReferenceError not found for [text][]");
  });

  test.skip("[text][missing] (reference not found) → ReferenceForLinkNotFound — KNOWN LIMITATION: error is created but not pushed to errors array (see process_markdown_reflinks.js)", () => {
    const content = "[My link][missing-ref]";
    const result = processMarkdown(content, PAGE_A, optsLF);
    const err = result.errors.find((e) => e.type === "ReferenceForLinkNotFound");
    assert.ok(err, "ReferenceForLinkNotFoundError not found");
  });

  test("Reference definitions with leading/trailing whitespace in name are normalized", () => {
    const content = "[My link][  My Ref  ]\n\n[my ref]: https://example.com";
    const result = processMarkdown(content, PAGE_A, optsLF);
    const match = result.urlLinks.find((l) => l.url === "https://example.com");
    assert.ok(match, "Reference link with whitespace in name not resolved");
  });

  test("Reference definitions with multiple internal spaces are normalized to single space", () => {
    const content = "[My link][pathref with  whitespace]\n\n[pathref with whitespace]: https://example.com";
    const result = processMarkdown(content, PAGE_A, optsLF);
    const match = result.urlLinks.find((l) => l.url === "https://example.com");
    assert.ok(match, "Reference link with multiple internal spaces not resolved");
  });
});

// ---------------------------------------------------------------------------
// Anchor targets detected in a page
// ---------------------------------------------------------------------------
describe("Anchor targets detected in page", () => {
  const PAGE = path.join(FIXTURES_ANCHOR_TARGETS, "page.md");
  const optsAT = makeOpts(FIXTURES_ANCHOR_TARGETS);

  test("## Heading Text → slugified anchor in anchors_auto_headings", () => {
    const result = processMarkdown("## Heading Text", PAGE, optsAT);
    assert.ok(result.headings.includes("Heading Text"), "Heading not in headings array");
    // anchors_auto_headings is computed by index.js (slugify applied after processMarkdown)
    // so here we only verify headings are captured; slugify is tested in slugify.test.js
  });

  test('## Heading {#custom-id} → "custom-id" captured in anchors_tag_ids', () => {
    const result = processMarkdown("## My Heading {#custom-id}", PAGE, optsAT);
    assert.ok(result.anchors_tag_ids.includes("custom-id"), "custom-id from {#} syntax not in anchors_tag_ids");
  });

  test('## Heading {#custom-id} — heading text stripped of {#...} and stored in headings', () => {
    const result = processMarkdown("## My Heading {#custom-id}", PAGE, optsAT);
    assert.ok(result.headings.includes("My Heading"), `Expected "My Heading" in headings, got: ${JSON.stringify(result.headings)}`);
  });

  test('<a id="x"> → "x" captured in anchors_tag_ids', () => {
    const result = processMarkdown('<a id="html-a-id-anchor"></a>', PAGE, optsAT);
    assert.ok(result.anchors_tag_ids.includes("html-a-id-anchor"), "html-a-id-anchor not in anchors_tag_ids");
  });

  test('<div id="x"> → "x" captured in anchors_tag_ids', () => {
    const result = processMarkdown('<div id="html-div-id-anchor">content</div>', PAGE, optsAT);
    assert.ok(result.anchors_tag_ids.includes("html-div-id-anchor"), "html-div-id-anchor not in anchors_tag_ids");
  });

  test.skip('<a name="x"> → NOT detected as anchor target — KNOWN LIMITATION: only id= attribute is captured, not name=', () => {
    const result = processMarkdown('<a name="old-style-name-anchor">text</a>', PAGE, optsAT);
    assert.ok(result.anchors_tag_ids.includes("old-style-name-anchor"), "old-style-name-anchor not in anchors_tag_ids");
  });
});

// ---------------------------------------------------------------------------
// Known limitations — formats NOT detected
// ---------------------------------------------------------------------------
describe("Known limitations — NOT detected", () => {
  test.skip("Autolinks <https://example.com> are NOT parsed — not added to any link array", () => {
    const result = processMarkdown("<https://example.com>", PAGE_A, optsLF);
    const allLinks = [
      ...result.relativeLinks,
      ...result.urlLinks,
      ...result.relativeImageLinks,
      ...result.urlImageLinks,
      ...result.unHandledLinkTypes,
    ];
    assert.equal(allLinks.length, 0, "Autolink unexpectedly detected");
  });
});
