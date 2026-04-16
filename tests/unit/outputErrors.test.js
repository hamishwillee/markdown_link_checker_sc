/**
 * Unit tests for the interactive file-write behaviour of outputErrors().
 *
 * Key invariant: calling outputErrors() in interactive mode must preserve any
 * entries already in ignore_errors.json and merge new entries on top — never
 * overwrite the file with only the entries added in the current session.
 */

import { test, describe, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

// ─── Prompt mock ─────────────────────────────────────────────────────────────
// Must be installed before output_errors.js is imported so that the module-
// level `const prompt = promptSync()` picks up the mock implementation.

let promptQueue = [];

mock.module("prompt-sync", {
  defaultExport: () => {
    // Returns a promptSync "instance" — a callable function.
    return (_question, defaultVal) => {
      if (promptQueue.length > 0) return promptQueue.shift();
      return defaultVal ?? "N";
    };
  },
});

const { outputErrors } = await import("../../src/output_errors.js");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTempDocsroot(ignoreEntries) {
  const docsroot = fs.mkdtempSync(path.join(os.tmpdir(), "lc-out-test-"));
  const dir = path.join(docsroot, "_link_checker_sc");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "ignore_errors.json"),
    JSON.stringify(ignoreEntries, null, 2)
  );
  return docsroot;
}

function readIgnoreFile(docsroot) {
  const filePath = path.join(docsroot, "_link_checker_sc", "ignore_errors.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function makeResult(docsroot, { type, fileRelativeToRoot, linkUrl } = {}) {
  const file = path.join(docsroot, fileRelativeToRoot);
  return {
    type,
    file,
    fileRelativeToRoot,
    link: linkUrl ? { url: linkUrl, text: "" } : undefined,
    output() {
      // no-op: suppress console output during tests
    },
  };
}

function makeOpts(docsroot) {
  return {
    docsroot,
    log: [],
    logtofile: false,
    interactive: true,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("outputErrors — interactive file-write behaviour", () => {
  test("existing entries are preserved when new ones are added", () => {
    const existing = [
      {
        type: "ExternalLinkWarning",
        fileRelativeToRoot: "en/old-page.md",
        link: { url: "https://old.example.com/", text: "" },
        hideReason: "pre-existing entry",
      },
    ];
    const docsroot = makeTempDocsroot(existing);

    const results = [
      makeResult(docsroot, {
        type: "ExternalLinkWarning",
        fileRelativeToRoot: "en/new-page.md",
        linkUrl: "https://new.example.com/",
      }),
    ];

    // Simulate: user answers "Y" then provides a reason.
    promptQueue = ["Y", "new reason"];

    outputErrors(results, makeOpts(docsroot));

    const written = readIgnoreFile(docsroot);
    assert.strictEqual(written.length, 2, "Both old and new entries should be in the file");
    assert.ok(
      written.some((e) => e.link?.url === "https://old.example.com/"),
      "Pre-existing entry should be preserved"
    );
    assert.ok(
      written.some((e) => e.link?.url === "https://new.example.com/"),
      "Newly added entry should be present"
    );
  });

  test("existing entries are preserved when user says N to all errors", () => {
    const existing = [
      {
        type: "ExternalLinkWarning",
        fileRelativeToRoot: "en/old-page.md",
        link: { url: "https://old.example.com/", text: "" },
        hideReason: "pre-existing entry",
      },
    ];
    const docsroot = makeTempDocsroot(existing);

    const results = [
      makeResult(docsroot, {
        type: "ExternalLinkWarning",
        fileRelativeToRoot: "en/some-page.md",
        linkUrl: "https://some.example.com/",
      }),
    ];

    // Simulate: user answers "N" — no new entries should be added.
    promptQueue = ["N"];

    outputErrors(results, makeOpts(docsroot));

    const written = readIgnoreFile(docsroot);
    assert.strictEqual(written.length, 1, "File must not be cleared when user adds nothing");
    assert.strictEqual(
      written[0].link.url,
      "https://old.example.com/",
      "Original entry should be unchanged"
    );
  });
});
