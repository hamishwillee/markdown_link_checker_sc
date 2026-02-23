import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { slugifyVuepress } from "../../src/slugify.js";

describe("slugifyVuepress — VuePress heading anchor algorithm", () => {
  test('"Heading Text" → "heading-text"', () => {
    assert.equal(slugifyVuepress("Heading Text"), "heading-text");
  });

  test('"Multi Word Heading" → "multi-word-heading"', () => {
    assert.equal(slugifyVuepress("Multi Word Heading"), "multi-word-heading");
  });

  test('"Heading With/Slash" → "heading-with-slash"', () => {
    // The slugify algorithm replaces / with - first, then non-word chars
    assert.equal(slugifyVuepress("Heading With/Slash"), "heading-with-slash");
  });

  test('"Special-Chars And/Slash" → "special-chars-and-slash"', () => {
    assert.equal(slugifyVuepress("Special-Chars And/Slash"), "special-chars-and-slash");
  });

  test('"Heading With Numbers 123" → "heading-with-numbers-123"', () => {
    assert.equal(slugifyVuepress("Heading With Numbers 123"), "heading-with-numbers-123");
  });

  test('"Heading  With  Extra  Spaces" → "heading-with-extra-spaces"', () => {
    assert.equal(slugifyVuepress("Heading  With  Extra  Spaces"), "heading-with-extra-spaces");
  });

  test('"Auto Heading One" → "auto-heading-one"', () => {
    assert.equal(slugifyVuepress("Auto Heading One"), "auto-heading-one");
  });

  test('"Custom Anchor Heading" (after {#} stripped) → "custom-anchor-heading"', () => {
    assert.equal(slugifyVuepress("Custom Anchor Heading"), "custom-anchor-heading");
  });

  test("all lowercase output", () => {
    assert.equal(slugifyVuepress("ALL CAPS HEADING"), "all-caps-heading");
  });

  test("leading and trailing hyphens removed", () => {
    // If heading starts/ends with special chars
    const result = slugifyVuepress("  heading  ");
    assert.ok(!result.startsWith("-"), "Result starts with hyphen");
    assert.ok(!result.endsWith("-"), "Result ends with hyphen");
  });
});
