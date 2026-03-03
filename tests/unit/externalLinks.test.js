/**
 * Unit tests for external link checking logic in process_external_url_links.js.
 *
 * LinkManager tests use mock request functions — no real network calls.
 * processExternalUrlLinks tests pass a real LinkManager built with a mock
 * request function, exercising the full error-classification pipeline.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  LinkManager,
  processExternalUrlLinks,
  stripFragment,
  getHeadRequestStatusCode,
} from "../../src/process_external_url_links.js";

// ─── Mock helpers ────────────────────────────────────────────────────────────

/** Returns a mock request function that always resolves with the given result. */
function mockResolve(statusCode, statusMessage = "OK", redirectUrl = undefined) {
  return async () => ({ statusCode, statusMessage, redirectUrl });
}

/** Returns a mock request function that always rejects with the given error. */
function mockReject(message) {
  return async () => {
    throw new Error(message);
  };
}

/**
 * Returns a slow mock that resolves after `delayMs`.
 * Useful for testing concurrent-request counts.
 */
function mockSlow(statusCode = 200, delayMs = 30) {
  return async () => {
    await new Promise((r) => setTimeout(r, delayMs));
    return { statusCode, statusMessage: "OK" };
  };
}

/**
 * Returns a mock function that counts how many times it has been called.
 * Access the count via fn.callCount().
 */
function mockCounter(statusCode = 200) {
  let calls = 0;
  const fn = async () => {
    calls++;
    return { statusCode, statusMessage: "OK" };
  };
  fn.callCount = () => calls;
  return fn;
}

/**
 * Minimal link object matching what processMarkdown puts in page.urlLinks.
 * Only the fields read by processExternalUrlLinks / error constructors are needed.
 */
function makeLink(url) {
  return { url, page: "/docs/en/file.md", fileRelativeToRoot: "en/file.md", type: "urlLink" };
}

/** One-page results array containing the given links. */
function makeResults(links) {
  return [{ urlLinks: links }];
}

// ─── stripFragment() ──────────────────────────────────────────────────────────

describe("stripFragment()", () => {
  test("removes the fragment from a URL", () => {
    assert.equal(
      stripFragment("https://example.com/page#heading"),
      "https://example.com/page"
    );
  });

  test("returns the URL unchanged when there is no fragment", () => {
    assert.equal(
      stripFragment("https://example.com/page"),
      "https://example.com/page"
    );
  });

  test("handles an empty fragment (#)", () => {
    assert.equal(
      stripFragment("https://example.com/page#"),
      "https://example.com/page"
    );
  });

  test("returns malformed URLs unchanged (no crash)", () => {
    assert.equal(stripFragment("not-a-url"), "not-a-url");
  });
});

// ─── LinkManager: checkURL() ──────────────────────────────────────────────────

describe("LinkManager.checkURL()", () => {
  test("returns 'pending' for a brand-new URL", () => {
    const mgr = new LinkManager(mockResolve(200), 10);
    const result = mgr.checkURL("https://example.com/new");
    assert.equal(result.type, "pending");
  });

  test("returns 'resolved' for a URL already in the cache", async () => {
    const mgr = new LinkManager(mockResolve(200), 10);
    mgr.checkURL("https://example.com/cached");
    mgr.finish();
    await mgr.onComplete();

    const origWarn = console.warn;
    console.warn = () => {}; // suppress expected "manager is finishing" warning
    const result = mgr.checkURL("https://example.com/cached");
    console.warn = origWarn;

    assert.equal(result.type, "resolved");
    assert.equal(result.statusCode, 200);
  });

  test("returns 'active' while a request is in-flight", () => {
    const neverResolves = () => new Promise(() => {});
    const mgr = new LinkManager(neverResolves, 10);
    mgr.checkURL("https://example.com/slow");

    const result = mgr.checkURL("https://example.com/slow");
    assert.equal(result.type, "active");
  });

  test("returns 'pending' for the same URL queued twice before processing", () => {
    // concurrency 0 = nothing starts, so the URL stays in the pending queue
    const mgr = new LinkManager(mockSlow(200, 50), 0);
    mgr.checkURL("https://example.com/page");
    const result = mgr.checkURL("https://example.com/page");
    assert.equal(result.type, "pending");
  });

  test("same URL added twice → only one HTTP request is made", async () => {
    const counter = mockCounter(200);
    const mgr = new LinkManager(counter, 10);
    mgr.checkURL("https://example.com/once");
    mgr.checkURL("https://example.com/once");
    mgr.finish();
    await mgr.onComplete();

    assert.equal(counter.callCount(), 1, "request should be made exactly once");
  });

  test("after finish(), an external checkURL() warns and is blocked", async () => {
    const mgr = new LinkManager(mockResolve(200), 10);
    mgr.finish();
    await mgr.onComplete();

    let warnCalled = false;
    const origWarn = console.warn;
    console.warn = () => { warnCalled = true; };
    mgr.checkURL("https://example.com/too-late");
    console.warn = origWarn;

    assert.ok(warnCalled, "should warn when URL is added after finish()");
  });

  test("after finish(), a cached URL is still returned", async () => {
    const mgr = new LinkManager(mockResolve(404), 10);
    mgr.checkURL("https://example.com/page");
    mgr.finish();
    await mgr.onComplete();

    const origWarn = console.warn;
    console.warn = () => {};
    const result = mgr.checkURL("https://example.com/page");
    console.warn = origWarn;

    assert.equal(result.type, "resolved");
    assert.equal(result.statusCode, 404);
  });
});

// ─── LinkManager: URL fragment stripping ─────────────────────────────────────

describe("LinkManager: URL fragment stripping", () => {
  test("two URLs differing only by fragment → single HTTP request", async () => {
    const counter = mockCounter(200);
    const mgr = new LinkManager(counter, 10);
    mgr.checkURL("https://example.com/page#section-1");
    mgr.checkURL("https://example.com/page#section-2");
    mgr.finish();
    await mgr.onComplete();

    assert.equal(counter.callCount(), 1, "should make only one request for the same page");
  });

  test("URL with fragment is stored without fragment in checkedUrls", async () => {
    const mgr = new LinkManager(mockResolve(200), 10);
    mgr.checkURL("https://example.com/page#heading");
    mgr.finish();
    await mgr.onComplete();

    assert.ok(
      mgr.checkedUrls.has("https://example.com/page"),
      "should be stored under the fragment-free URL"
    );
    assert.ok(
      !mgr.checkedUrls.has("https://example.com/page#heading"),
      "should NOT be stored under the original fragment URL"
    );
  });

  test("getResult() resolves a URL that has a fragment", async () => {
    const mgr = new LinkManager(mockResolve(200), 10);
    mgr.checkURL("https://example.com/page");
    mgr.finish();
    await mgr.onComplete();

    const result = mgr.getResult("https://example.com/page#heading");
    assert.ok(result, "getResult() should find the cached result via fragment stripping");
    assert.equal(result.statusCode, 200);
  });
});

// ─── LinkManager: per-host concurrency ───────────────────────────────────────

describe("LinkManager: per-host concurrency", () => {
  test("respects maxPerHostRequests for the same hostname", async () => {
    const LIMIT = 1;
    let maxConcurrentForHost = 0;
    let currentConcurrentForHost = 0;

    const mockFn = async (url) => {
      if (new URL(url).hostname === "example.com") {
        currentConcurrentForHost++;
        maxConcurrentForHost = Math.max(maxConcurrentForHost, currentConcurrentForHost);
        await new Promise((r) => setTimeout(r, 20));
        currentConcurrentForHost--;
      }
      return { statusCode: 200, statusMessage: "OK" };
    };

    const mgr = new LinkManager(mockFn, 10);
    mgr.maxPerHostRequests = LIMIT;
    mgr.checkURL("https://example.com/1");
    mgr.checkURL("https://example.com/2");
    mgr.checkURL("https://example.com/3");
    mgr.finish();
    await mgr.onComplete();

    assert.ok(
      maxConcurrentForHost <= LIMIT,
      `expected <= ${LIMIT} concurrent per host, got ${maxConcurrentForHost}`
    );
  });

  test("allows up to maxPerHostRequests concurrent requests for the same hostname", async () => {
    const LIMIT = 2;
    let maxConcurrentForHost = 0;
    let currentConcurrentForHost = 0;

    const mockFn = async (url) => {
      if (new URL(url).hostname === "example.com") {
        currentConcurrentForHost++;
        maxConcurrentForHost = Math.max(maxConcurrentForHost, currentConcurrentForHost);
        await new Promise((r) => setTimeout(r, 20));
        currentConcurrentForHost--;
      }
      return { statusCode: 200, statusMessage: "OK" };
    };

    const mgr = new LinkManager(mockFn, 10);
    mgr.maxPerHostRequests = LIMIT;
    // Queue 3 URLs to the same host; we expect 2 to run concurrently.
    mgr.checkURL("https://example.com/1");
    mgr.checkURL("https://example.com/2");
    mgr.checkURL("https://example.com/3");
    mgr.finish();
    await mgr.onComplete();

    assert.ok(
      maxConcurrentForHost > 1,
      `expected > 1 concurrent per host with LIMIT=${LIMIT}, got ${maxConcurrentForHost}`
    );
  });

  test("different hostnames can be requested concurrently", async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const mockFn = async () => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise((r) => setTimeout(r, 20));
      currentConcurrent--;
      return { statusCode: 200, statusMessage: "OK" };
    };

    const mgr = new LinkManager(mockFn, 10);
    mgr.checkURL("https://site-a.com/page");
    mgr.checkURL("https://site-b.com/page");
    mgr.checkURL("https://site-c.com/page");
    mgr.finish();
    await mgr.onComplete();

    assert.ok(
      maxConcurrent > 1,
      `expected concurrent requests across hosts, saw max ${maxConcurrent}`
    );
  });
});

// ─── LinkManager: global concurrency limit ────────────────────────────────────

describe("LinkManager: global concurrency limit", () => {
  test("never exceeds maxActiveRequests", async () => {
    let maxSeen = 0;
    let current = 0;
    const MAX = 3;

    const mockFn = async () => {
      current++;
      maxSeen = Math.max(maxSeen, current);
      await new Promise((r) => setTimeout(r, 15));
      current--;
      return { statusCode: 200, statusMessage: "OK" };
    };

    const mgr = new LinkManager(mockFn, MAX);
    for (let i = 0; i < 10; i++) {
      mgr.checkURL(`https://site${i}.com/page`);
    }
    mgr.finish();
    await mgr.onComplete();

    assert.ok(
      maxSeen <= MAX,
      `concurrent requests peaked at ${maxSeen}, but limit is ${MAX}`
    );
  });
});

// ─── LinkManager: 429 retry logic ────────────────────────────────────────────

describe("LinkManager: 429 Too Many Requests retry", () => {
  test("429 is retried up to _maxRetries times (default 3)", async () => {
    let callCount = 0;
    const mockFn = async () => {
      callCount++;
      return { statusCode: 429, statusMessage: "Too Many Requests" };
    };

    const mgr = new LinkManager(mockFn, 10);
    mgr._baseRetryDelayMs = 1;
    mgr.checkURL("https://example.com/rate-limited");
    mgr.finish();
    await mgr.onComplete();

    // 1 initial + 3 retries = 4 calls total
    assert.equal(callCount, 4, "expected 4 total attempts (1 initial + 3 retries)");
  });

  test("after max retries, result is stored as an error with statusCode 429", async () => {
    const mockFn = async () => ({
      statusCode: 429,
      statusMessage: "Too Many Requests",
    });

    const mgr = new LinkManager(mockFn, 10);
    mgr._baseRetryDelayMs = 1;
    mgr.checkURL("https://example.com/always-429");
    mgr.finish();
    await mgr.onComplete();

    const result = mgr.checkedUrls.get("https://example.com/always-429");
    assert.ok(result, "URL should be in checkedUrls after exhausting retries");
    assert.equal(result.statusCode, 429);
    assert.ok(result.error, "should have an error object after max retries");
    assert.match(result.error.message, /Too many retries/i);
  });

  test("URL that succeeds on second try (after one 429) is stored as 200", async () => {
    let callCount = 0;
    const mockFn = async () => {
      callCount++;
      if (callCount === 1)
        return { statusCode: 429, statusMessage: "Too Many Requests" };
      return { statusCode: 200, statusMessage: "OK" };
    };

    const mgr = new LinkManager(mockFn, 10);
    mgr._baseRetryDelayMs = 1;
    mgr.checkURL("https://example.com/retry-once");
    mgr.finish();
    await mgr.onComplete();

    const result = mgr.checkedUrls.get("https://example.com/retry-once");
    assert.equal(result.statusCode, 200);
    assert.equal(callCount, 2);
  });

  test("Retry-After header value overrides exponential backoff when larger", async () => {
    const RETRY_AFTER_MS = 60;
    let firstCallTime;
    let secondCallTime;
    let callCount = 0;

    const mockFn = async () => {
      callCount++;
      if (callCount === 1) {
        firstCallTime = Date.now();
        return {
          statusCode: 429,
          statusMessage: "Too Many Requests",
          retryAfterMs: RETRY_AFTER_MS,
        };
      }
      secondCallTime = Date.now();
      return { statusCode: 200, statusMessage: "OK" };
    };

    const mgr = new LinkManager(mockFn, 10);
    mgr._baseRetryDelayMs = 1; // exponential backoff = 1ms, far less than Retry-After
    mgr.checkURL("https://example.com/retry-after");
    mgr.finish();
    await mgr.onComplete();

    const elapsed = secondCallTime - firstCallTime;
    assert.ok(
      elapsed >= RETRY_AFTER_MS - 10, // 10ms tolerance for timer imprecision
      `retry should wait at least ${RETRY_AFTER_MS}ms (Retry-After), got ${elapsed}ms`
    );
  });
});

// ─── LinkManager: retry queue ordering ───────────────────────────────────────

describe("LinkManager: retry queue", () => {
  test("retries are deferred until the initial pendingQueue is drained", async () => {
    // Force serial execution (concurrency=1) so we can assert request order.
    const startOrder = [];
    let callCount = {};

    const mockFn = async (url) => {
      startOrder.push(url);
      callCount[url] = (callCount[url] ?? 0) + 1;
      if (url === "https://a.com/" && callCount[url] === 1) {
        return { statusCode: 429, statusMessage: "Too Many Requests" };
      }
      return { statusCode: 200, statusMessage: "OK" };
    };

    const mgr = new LinkManager(mockFn, 1); // serial
    mgr._baseRetryDelayMs = 1;
    mgr.checkURL("https://a.com/"); // starts first (429 → goes to retryQueue)
    mgr.checkURL("https://b.com/"); // waits in pendingQueue
    mgr.finish();
    await mgr.onComplete();

    // Expected: a (429), b (200), a-retry (200)
    assert.deepEqual(startOrder, [
      "https://a.com/",
      "https://b.com/",
      "https://a.com/",
    ]);
  });

  test("getRetryCount() is 0 after all processing is complete", async () => {
    let callCount = 0;
    const mockFn = async () => {
      callCount++;
      if (callCount === 1)
        return { statusCode: 429, statusMessage: "Too Many Requests" };
      return { statusCode: 200, statusMessage: "OK" };
    };

    const mgr = new LinkManager(mockFn, 10);
    mgr._baseRetryDelayMs = 1;
    mgr.checkURL("https://example.com/retry");
    mgr.finish();
    await mgr.onComplete();

    assert.equal(mgr.getRetryCount(), 0);
  });
});

// ─── LinkManager: abort() ────────────────────────────────────────────────────

describe("LinkManager: abort()", () => {
  test("abort() resolves onComplete() immediately even with requests in flight", async () => {
    const neverResolves = () => new Promise(() => {});
    const mgr = new LinkManager(neverResolves, 10);
    mgr.checkURL("https://a.com/");
    mgr.finish();

    // Abort after a short delay; onComplete should return without the request completing.
    setTimeout(() => mgr.abort(), 5);
    await mgr.onComplete(); // would hang forever without abort()

    assert.equal(mgr.getCheckedCount(), 0, "request never completed, nothing should be checked");
  });

  test("abort() prevents new requests from starting", async () => {
    let requestCount = 0;
    const mockFn = async () => {
      requestCount++;
      return { statusCode: 200, statusMessage: "OK" };
    };

    // concurrency=0 means nothing starts on checkURL, so we can abort first.
    const mgr = new LinkManager(mockFn, 0);
    mgr.checkURL("https://a.com/");
    mgr.checkURL("https://b.com/");
    mgr.abort();  // abort with items still in pendingQueue
    mgr.finish();
    await mgr.onComplete();

    assert.equal(requestCount, 0, "no requests should start after abort()");
  });
});

// ─── LinkManager: redirect handling ──────────────────────────────────────────

describe("LinkManager: redirect handling", () => {
  test("redirect URL is enqueued and checked", async () => {
    const checked = [];
    const mockFn = async (url) => {
      checked.push(url);
      if (url === "https://old.com/page") {
        return {
          statusCode: 301,
          statusMessage: "Moved Permanently",
          redirectUrl: "https://new.com/page",
        };
      }
      return { statusCode: 200, statusMessage: "OK" };
    };

    const mgr = new LinkManager(mockFn, 10);
    mgr.checkURL("https://old.com/page");
    mgr.finish();
    await mgr.onComplete();

    assert.ok(checked.includes("https://old.com/page"), "original URL should be checked");
    assert.ok(checked.includes("https://new.com/page"), "redirect target URL should be checked");
  });

  test("redirect URL is stored in checkedUrls entry for the original URL", async () => {
    const mockFn = async (url) => {
      if (url === "https://old.com/page") {
        return {
          statusCode: 301,
          statusMessage: "Moved Permanently",
          redirectUrl: "https://new.com/page",
        };
      }
      return { statusCode: 200, statusMessage: "OK" };
    };

    const mgr = new LinkManager(mockFn, 10);
    mgr.checkURL("https://old.com/page");
    mgr.finish();
    await mgr.onComplete();

    const result = mgr.checkedUrls.get("https://old.com/page");
    assert.equal(result.redirectUrl, "https://new.com/page");
  });

  test("redirect target added after finish() still completes (internal trigger)", async () => {
    const mockFn = async (url) => {
      if (url === "https://a.com/") {
        return { statusCode: 302, statusMessage: "Found", redirectUrl: "https://b.com/" };
      }
      return { statusCode: 200, statusMessage: "OK" };
    };

    const mgr = new LinkManager(mockFn, 10);
    mgr.checkURL("https://a.com/");
    mgr.finish();
    await mgr.onComplete();

    assert.ok(mgr.checkedUrls.has("https://a.com/"));
    assert.ok(
      mgr.checkedUrls.has("https://b.com/"),
      "redirect target should be resolved even though finish() was called"
    );
  });
});

// ─── LinkManager: network/request errors ─────────────────────────────────────

describe("LinkManager: network/request errors", () => {
  test("network error is stored in checkedUrls", async () => {
    const mgr = new LinkManager(mockReject("ECONNREFUSED"), 10);
    mgr.checkURL("https://example.com/fail");
    mgr.finish();
    await mgr.onComplete();

    const result = mgr.checkedUrls.get("https://example.com/fail");
    assert.ok(result, "URL should be in checkedUrls");
    assert.ok(result.error, "error should be stored");
    assert.match(result.error.message, /ECONNREFUSED/);
  });

  test("timeout error (ETIMEDOUT code) is stored as an error", async () => {
    const mockTimeout = async () => { const e = new Error("Request timed out after 8000ms"); e.code = "ETIMEDOUT"; throw e; };
    const mgr = new LinkManager(mockTimeout, 10);
    mgr.checkURL("https://example.com/timeout");
    mgr.finish();
    await mgr.onComplete();

    const result = mgr.checkedUrls.get("https://example.com/timeout");
    assert.ok(result.error);
    assert.equal(result.error.code, "ETIMEDOUT");
  });

  test("malformed URL is stored as an error without crashing", async () => {
    const mgr = new LinkManager(mockResolve(200), 10);
    mgr.checkURL("not-a-valid-url");
    mgr.finish();
    await mgr.onComplete();

    const result = mgr.checkedUrls.get("not-a-valid-url");
    assert.ok(result, "malformed URL should be in checkedUrls");
    assert.ok(result.error, "should have an error entry");
    assert.match(result.error.message, /Malformed URL/i);
  });
});

// ─── LinkManager: counter methods ────────────────────────────────────────────

describe("LinkManager: counter methods", () => {
  test("getPendingCount / getRetryCount / getActiveCount / getCheckedCount reflect state", async () => {
    const mgr = new LinkManager(mockSlow(200, 30), 10);

    assert.equal(mgr.getPendingCount(), 0);
    assert.equal(mgr.getRetryCount(), 0);
    assert.equal(mgr.getActiveCount(), 0);
    assert.equal(mgr.getCheckedCount(), 0);

    mgr.checkURL("https://example.com/1");

    assert.equal(mgr.getActiveCount(), 1);
    assert.equal(mgr.getPendingCount(), 0);

    mgr.finish();
    await mgr.onComplete();

    assert.equal(mgr.getCheckedCount(), 1);
    assert.equal(mgr.getPendingCount(), 0);
    assert.equal(mgr.getRetryCount(), 0);
    assert.equal(mgr.getActiveCount(), 0);
  });

  test("multiple URLs are all counted in getCheckedCount", async () => {
    const mgr = new LinkManager(mockResolve(200), 10);
    mgr.checkURL("https://a.com/");
    mgr.checkURL("https://b.com/");
    mgr.checkURL("https://c.com/");
    mgr.finish();
    await mgr.onComplete();

    assert.equal(mgr.getCheckedCount(), 3);
  });
});

// ─── LinkManager: finish() and onComplete() ───────────────────────────────────

describe("LinkManager: finish() and onComplete()", () => {
  test("onComplete() resolves immediately when finish() is called on an empty manager", async () => {
    const mgr = new LinkManager(mockResolve(200), 10);
    mgr.finish();
    await mgr.onComplete();
    assert.equal(mgr.getCheckedCount(), 0);
  });

  test("onComplete() resolves only after all pending requests finish", async () => {
    let completed = false;
    const mgr = new LinkManager(mockSlow(200, 40), 10);
    mgr.checkURL("https://example.com/slow");

    const donePromise = mgr.onComplete().then(() => { completed = true; });

    assert.equal(completed, false);

    mgr.finish();
    await donePromise;

    assert.equal(completed, true);
  });

  test("all URLs checked after onComplete() resolves", async () => {
    const mgr = new LinkManager(mockResolve(200), 10);
    mgr.checkURL("https://a.com/");
    mgr.checkURL("https://b.com/");
    mgr.finish();
    await mgr.onComplete();

    assert.ok(mgr.checkedUrls.has("https://a.com/"));
    assert.ok(mgr.checkedUrls.has("https://b.com/"));
  });
});

// ─── LinkManager: status code storage ────────────────────────────────────────

describe("LinkManager: status code storage", () => {
  for (const code of [200, 301, 302, 303, 307, 308, 400, 403, 404, 410, 500]) {
    test(`stores statusCode ${code} correctly`, async () => {
      const mgr = new LinkManager(mockResolve(code, `Status ${code}`), 10);
      mgr.checkURL(`https://example.com/${code}`);
      mgr.finish();
      await mgr.onComplete();

      const result = mgr.checkedUrls.get(`https://example.com/${code}`);
      assert.equal(result.statusCode, code);
      assert.equal(result.statusMessage, `Status ${code}`);
    });
  }
});

// ─── processExternalUrlLinks(): error classification ─────────────────────────

describe("processExternalUrlLinks(): error classification", () => {
  test("200 OK → no errors", async () => {
    const mgr = new LinkManager(mockResolve(200), 10);
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/ok")]), mgr);
    assert.equal(errors.length, 0);
  });

  test("302 Found → ExternalLinkWarning", async () => {
    const mgr = new LinkManager(mockResolve(302, "Found"), 10);
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/302")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkWarning");
    assert.equal(errors[0].statusCode, 302);
  });

  test("303 See Other → ExternalLinkWarning", async () => {
    const mgr = new LinkManager(mockResolve(303, "See Other"), 10);
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/303")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkWarning");
  });

  test("307 Temporary Redirect → ExternalLinkWarning", async () => {
    const mgr = new LinkManager(mockResolve(307, "Temporary Redirect"), 10);
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/307")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkWarning");
  });

  test("301 Moved Permanently → ExternalLinkError (not a warning)", async () => {
    const mgr = new LinkManager(mockResolve(301, "Moved Permanently"), 10);
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/301")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkError");
  });

  test("308 Permanent Redirect → ExternalLinkError (not a warning)", async () => {
    const mgr = new LinkManager(mockResolve(308, "Permanent Redirect"), 10);
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/308")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkError");
    assert.equal(errors[0].statusCode, 308);
  });

  test("403 Forbidden → ExternalLinkWarning (bot-blocking sites still load in browsers)", async () => {
    const mgr = new LinkManager(mockResolve(403, "Forbidden"), 10);
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/blocked")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkWarning");
    assert.equal(errors[0].statusCode, 403);
  });

  // Cloudflare/CDN-specific codes: CDN or bot-blocking issues, not definitively broken links
  for (const code of [520, 521, 522, 523, 524, 525, 526, 527, 530]) {
    test(`${code} (Cloudflare/CDN) → ExternalLinkWarning`, async () => {
      const mgr = new LinkManager(mockResolve(code, "<none>"), 10);
      const errors = await processExternalUrlLinks(makeResults([makeLink(`https://example.com/${code}`)]), mgr);
      assert.equal(errors.length, 1);
      assert.equal(errors[0].type, "ExternalLinkWarning");
      assert.equal(errors[0].statusCode, code);
    });
  }

  // 502/503/504 — retried once, then classified as warning

  test("502 that succeeds on retry → no error", async () => {
    let calls = 0;
    const mockFn = async () => {
      calls++;
      if (calls === 1) return { statusCode: 502, statusMessage: "Bad Gateway" };
      return { statusCode: 200, statusMessage: "OK" };
    };
    const mgr = new LinkManager(mockFn, 10);
    mgr._transientRetryDelayMs = 1;
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/502")]), mgr);
    assert.equal(errors.length, 0, "successful retry should produce no error");
    assert.equal(calls, 2, "should have been attempted twice");
  });

  test("502 that fails both attempts → ExternalLinkWarning", async () => {
    const mgr = new LinkManager(mockResolve(502, "Bad Gateway"), 10);
    mgr._transientRetryDelayMs = 1;
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/502")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkWarning");
    assert.equal(errors[0].statusCode, 502);
  });

  test("503 that fails both attempts → ExternalLinkWarning", async () => {
    const mgr = new LinkManager(mockResolve(503, "Service Unavailable"), 10);
    mgr._transientRetryDelayMs = 1;
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/503")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkWarning");
    assert.equal(errors[0].statusCode, 503);
  });

  test("504 that fails both attempts → ExternalLinkWarning", async () => {
    const mgr = new LinkManager(mockResolve(504, "Gateway Timeout"), 10);
    mgr._transientRetryDelayMs = 1;
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/504")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkWarning");
    assert.equal(errors[0].statusCode, 504);
  });

  test("502 retry respects _transientRetryDelayMs", async () => {
    const DELAY = 60;
    let firstCallTime;
    let secondCallTime;
    let calls = 0;
    const mockFn = async () => {
      calls++;
      if (calls === 1) { firstCallTime = Date.now(); return { statusCode: 502, statusMessage: "Bad Gateway" }; }
      secondCallTime = Date.now();
      return { statusCode: 200, statusMessage: "OK" };
    };
    const mgr = new LinkManager(mockFn, 10);
    mgr._transientRetryDelayMs = DELAY;
    await processExternalUrlLinks(makeResults([makeLink("https://example.com/slow-502")]), mgr);
    assert.ok(
      secondCallTime - firstCallTime >= DELAY - 10,
      `retry should wait at least ${DELAY}ms, got ${secondCallTime - firstCallTime}ms`
    );
  });

  test("502 only retried once even though _maxRetries for 429 is 3", async () => {
    let calls = 0;
    const mockFn = async () => { calls++; return { statusCode: 502, statusMessage: "Bad Gateway" }; };
    const mgr = new LinkManager(mockFn, 10);
    mgr._transientRetryDelayMs = 1;
    await processExternalUrlLinks(makeResults([makeLink("https://example.com/always-502")]), mgr);
    assert.equal(calls, 2, "502 should be attempted exactly twice (1 initial + 1 retry)");
  });

  test("502 retry recovers to a non-200 success (e.g. 404) → ExternalLinkError not Warning", async () => {
    let calls = 0;
    const mockFn = async () => {
      calls++;
      if (calls === 1) return { statusCode: 502, statusMessage: "Bad Gateway" };
      return { statusCode: 404, statusMessage: "Not Found" };
    };
    const mgr = new LinkManager(mockFn, 10);
    mgr._transientRetryDelayMs = 1;
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/was-502")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkError", "a definitive 404 on retry should be an error, not a warning");
    assert.equal(errors[0].statusCode, 404);
  });

  test("520 with statusMessage '<none>' → output() omits the empty message parens", async () => {
    const mgr = new LinkManager(mockResolve(520, "<none>"), 10);
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/cf")]), mgr);
    const lines = [];
    const origLog = console.log;
    console.log = (s) => lines.push(s);
    errors[0].output();
    console.log = origLog;

    assert.ok(!lines[0].includes("(<none>)"), "should not display (<none>) in output");
    assert.ok(lines[0].includes("520"), "should still include the status code");
  });

  test("404 Not Found → ExternalLinkError", async () => {
    const mgr = new LinkManager(mockResolve(404, "Not Found"), 10);
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/missing")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkError");
    assert.equal(errors[0].statusCode, 404);
  });

  test("500 Internal Server Error → ExternalLinkError", async () => {
    const mgr = new LinkManager(mockResolve(500, "Internal Server Error"), 10);
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/broken")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkError");
    assert.equal(errors[0].statusCode, 500);
  });

  test("network error (plain Error, no code) → ExternalLinkError carrying the underlying Error object", async () => {
    const mgr = new LinkManager(mockReject("ECONNREFUSED"), 10);
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/unreachable")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkError");
    assert.ok(errors[0].error, "should carry the underlying error");
    assert.match(errors[0].error.message, /ECONNREFUSED/);
  });

  test("AggregateError (Happy Eyeballs) → ExternalLinkWarning", async () => {
    const mockAgg = async () => { throw new AggregateError([new Error("IPv4 failed"), new Error("IPv6 failed")], "All connections failed"); };
    const mgr = new LinkManager(mockAgg, 10);
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/agg")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkWarning", "AggregateError should be a warning, not an error");
  });

  test("Error with code ECONNREFUSED → ExternalLinkWarning", async () => {
    const mockConnRefused = async () => { const e = new Error("connect ECONNREFUSED"); e.code = "ECONNREFUSED"; throw e; };
    const mgr = new LinkManager(mockConnRefused, 10);
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/refused")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkWarning", "ECONNREFUSED should be a warning");
  });

  test("Error with code ECONNRESET → ExternalLinkWarning", async () => {
    const mockReset = async () => { const e = new Error("read ECONNRESET"); e.code = "ECONNRESET"; throw e; };
    const mgr = new LinkManager(mockReset, 10);
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/reset")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkWarning", "ECONNRESET should be a warning");
  });

  test("Error with code ETIMEDOUT → ExternalLinkWarning (timeout means unverifiable, not definitively broken)", async () => {
    const mockTimeout = async () => { const e = new Error("Request timed out after 8000ms"); e.code = "ETIMEDOUT"; throw e; };
    const mgr = new LinkManager(mockTimeout, 10);
    const errors = await processExternalUrlLinks(makeResults([makeLink("https://example.com/slow")]), mgr);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "ExternalLinkWarning", "ETIMEDOUT should be a warning");
  });

  test("multiple links from one page — all errors are collected", async () => {
    const mockFn = async (url) => {
      if (url.includes("/ok")) return { statusCode: 200, statusMessage: "OK" };
      if (url.includes("/missing")) return { statusCode: 404, statusMessage: "Not Found" };
      return { statusCode: 302, statusMessage: "Found" };
    };
    const links = [
      makeLink("https://a.com/ok"),
      makeLink("https://b.com/missing"),
      makeLink("https://c.com/moved"),
    ];
    const mgr = new LinkManager(mockFn, 10);
    const errors = await processExternalUrlLinks(makeResults(links), mgr);

    assert.equal(errors.length, 2, "200 produces no error; 404 and 302 each produce one");
    assert.ok(errors.some((e) => e.type === "ExternalLinkError"));
    assert.ok(errors.some((e) => e.type === "ExternalLinkWarning"));
  });

  test("links from multiple pages — all errors are collected", async () => {
    const mockFn = async (url) => {
      if (url.includes("/ok")) return { statusCode: 200, statusMessage: "OK" };
      return { statusCode: 404, statusMessage: "Not Found" };
    };
    const results = [
      { urlLinks: [makeLink("https://page1.com/ok"), makeLink("https://page1.com/bad")] },
      { urlLinks: [makeLink("https://page2.com/bad")] },
    ];
    const mgr = new LinkManager(mockFn, 10);
    const errors = await processExternalUrlLinks(results, mgr);

    assert.equal(errors.length, 2, "one error per bad link across both pages");
  });

  test("same URL in multiple pages → only one HTTP request made", async () => {
    const counter = mockCounter(200);
    const url = "https://shared.com/page";
    const results = [
      { urlLinks: [makeLink(url)] },
      { urlLinks: [makeLink(url)] },
    ];
    const mgr = new LinkManager(counter, 10);
    const errors = await processExternalUrlLinks(results, mgr);

    assert.equal(counter.callCount(), 1, "duplicate URL should only be fetched once");
    assert.equal(errors.length, 0);
  });

  test("two links to same page but different fragments → single HTTP request, no errors", async () => {
    const counter = mockCounter(200);
    const links = [
      makeLink("https://example.com/page#section-1"),
      makeLink("https://example.com/page#section-2"),
    ];
    const mgr = new LinkManager(counter, 10);
    const errors = await processExternalUrlLinks(makeResults(links), mgr);

    assert.equal(counter.callCount(), 1, "fragment URLs should share a single HTTP request");
    assert.equal(errors.length, 0);
  });

  test("page with no urlLinks produces no errors", async () => {
    const mgr = new LinkManager(mockResolve(200), 10);
    const errors = await processExternalUrlLinks([{ urlLinks: [] }], mgr);
    assert.equal(errors.length, 0);
  });

  test("301 with redirectUrl → error carries redirectUrl", async () => {
    const mgr = new LinkManager(
      mockResolve(301, "Moved Permanently", "https://example.com/new"),
      10
    );
    const errors = await processExternalUrlLinks(
      makeResults([makeLink("https://example.com/old")]),
      mgr
    );
    assert.equal(errors.length, 1);
    assert.equal(errors[0].redirectUrl, "https://example.com/new");
  });

  test("301 with redirectUrl → output() prints FROM/TO lines", async () => {
    const mgr = new LinkManager(
      mockResolve(301, "Moved Permanently", "https://example.com/new"),
      10
    );
    const errors = await processExternalUrlLinks(
      makeResults([makeLink("https://example.com/old")]),
      mgr
    );
    const lines = [];
    const origLog = console.log;
    console.log = (s) => lines.push(s);
    errors[0].output();
    console.log = origLog;

    assert.ok(lines[0].includes("FROM: https://example.com/old"), "should include FROM line");
    assert.ok(lines[0].includes("TO:   https://example.com/new"), "should include TO line");
  });

  test("302 with redirectUrl → ExternalLinkWarning output() prints FROM/TO lines", async () => {
    const mgr = new LinkManager(
      mockResolve(302, "Found", "https://example.com/new"),
      10
    );
    const errors = await processExternalUrlLinks(
      makeResults([makeLink("https://example.com/old")]),
      mgr
    );
    const lines = [];
    const origLog = console.log;
    console.log = (s) => lines.push(s);
    errors[0].output();
    console.log = origLog;

    assert.equal(errors[0].type, "ExternalLinkWarning");
    assert.ok(lines[0].includes("FROM: https://example.com/old"), "should include FROM line");
    assert.ok(lines[0].includes("TO:   https://example.com/new"), "should include TO line");
  });

  test("308 with redirectUrl → ExternalLinkError output() prints FROM/TO lines", async () => {
    const mgr = new LinkManager(
      mockResolve(308, "Permanent Redirect", "https://example.com/new"),
      10
    );
    const errors = await processExternalUrlLinks(
      makeResults([makeLink("https://example.com/old")]),
      mgr
    );
    const lines = [];
    const origLog = console.log;
    console.log = (s) => lines.push(s);
    errors[0].output();
    console.log = origLog;

    assert.equal(errors[0].type, "ExternalLinkError");
    assert.ok(lines[0].includes("FROM: https://example.com/old"), "should include FROM line");
    assert.ok(lines[0].includes("TO:   https://example.com/new"), "should include TO line");
  });

  test("301 with redirectUrl and original fragment → TO includes fragment", async () => {
    const mgr = new LinkManager(
      mockResolve(301, "Moved Permanently", "https://example.com/new"),
      10
    );
    const errors = await processExternalUrlLinks(
      makeResults([makeLink("https://example.com/old#section-1")]),
      mgr
    );
    const lines = [];
    const origLog = console.log;
    console.log = (s) => lines.push(s);
    errors[0].output();
    console.log = origLog;

    assert.ok(lines[0].includes("FROM: https://example.com/old#section-1"), "FROM should include fragment");
    assert.ok(lines[0].includes("TO:   https://example.com/new#section-1"), "TO should include original fragment");
  });

  test("404 without redirectUrl → output() prints single URL line", async () => {
    const mgr = new LinkManager(mockResolve(404, "Not Found"), 10);
    const errors = await processExternalUrlLinks(
      makeResults([makeLink("https://example.com/missing")]),
      mgr
    );
    const lines = [];
    const origLog = console.log;
    console.log = (s) => lines.push(s);
    errors[0].output();
    console.log = origLog;

    assert.ok(!lines[0].includes("FROM:"), "should not include FROM: when no redirect");
    assert.ok(lines[0].includes("https://example.com/missing"), "should include the URL");
  });
});

// ─── getHeadRequestStatusCode(): HEAD→GET fallback ────────────────────────────

describe("getHeadRequestStatusCode(): HEAD→GET fallback", () => {
  test("returns HEAD result directly when status is not 403", async () => {
    const mockReq = async (_url, method) => ({ statusCode: 200, statusMessage: "OK", method });
    const result = await getHeadRequestStatusCode("https://example.com/", 5000, mockReq);
    assert.equal(result.statusCode, 200);
    assert.equal(result.method, "HEAD");
  });

  test("falls back to GET when HEAD returns 403, and returns the GET result", async () => {
    const calls = [];
    const mockReq = async (_url, method) => {
      calls.push(method);
      if (method === "HEAD") return { statusCode: 403, statusMessage: "Forbidden" };
      return { statusCode: 200, statusMessage: "OK" };
    };
    const result = await getHeadRequestStatusCode("https://example.com/", 5000, mockReq);
    assert.deepEqual(calls, ["HEAD", "GET"], "should try HEAD first then GET");
    assert.equal(result.statusCode, 200);
  });

  test("returns GET 403 when both HEAD and GET return 403", async () => {
    const mockReq = async () => ({ statusCode: 403, statusMessage: "Forbidden" });
    const result = await getHeadRequestStatusCode("https://example.com/", 5000, mockReq);
    assert.equal(result.statusCode, 403);
  });

  test("falls back to GET for 404 (some servers return 404 to HEAD but 200 to GET)", async () => {
    const calls = [];
    const mockReq = async (_url, method) => {
      calls.push(method);
      if (method === "HEAD") return { statusCode: 404, statusMessage: "Not Found" };
      return { statusCode: 200, statusMessage: "OK" };
    };
    const result = await getHeadRequestStatusCode("https://example.com/", 5000, mockReq);
    assert.deepEqual(calls, ["HEAD", "GET"], "should retry with GET after HEAD 404");
    assert.equal(result.statusCode, 200);
  });

  test("falls back to GET for 405 Method Not Allowed", async () => {
    const calls = [];
    const mockReq = async (_url, method) => {
      calls.push(method);
      if (method === "HEAD") return { statusCode: 405, statusMessage: "Method Not Allowed" };
      return { statusCode: 200, statusMessage: "OK" };
    };
    const result = await getHeadRequestStatusCode("https://example.com/", 5000, mockReq);
    assert.deepEqual(calls, ["HEAD", "GET"], "should retry with GET after HEAD 405");
    assert.equal(result.statusCode, 200);
  });

  test("does not fall back to GET for other non-success codes (e.g. 500)", async () => {
    const calls = [];
    const mockReq = async (_url, method) => {
      calls.push(method);
      return { statusCode: 500, statusMessage: "Internal Server Error" };
    };
    await getHeadRequestStatusCode("https://example.com/", 5000, mockReq);
    assert.deepEqual(calls, ["HEAD"], "should not retry with GET for 500 responses");
  });

  test("HEAD ETIMEDOUT → retries with GET and returns GET result", async () => {
    const calls = [];
    const mockReq = async (_url, method) => {
      calls.push(method);
      if (method === "HEAD") { const e = new Error("Request timed out"); e.code = "ETIMEDOUT"; throw e; }
      return { statusCode: 200, statusMessage: "OK" };
    };
    const result = await getHeadRequestStatusCode("https://example.com/", 5000, mockReq);
    assert.deepEqual(calls, ["HEAD", "GET"], "should try HEAD first then GET on timeout");
    assert.equal(result.statusCode, 200);
  });

  test("HEAD ETIMEDOUT, GET also times out → throws the GET error", async () => {
    const calls = [];
    const mockReq = async (_url, method) => {
      calls.push(method);
      const e = new Error(`Request timed out (${method})`);
      e.code = "ETIMEDOUT";
      throw e;
    };
    await assert.rejects(
      () => getHeadRequestStatusCode("https://example.com/", 5000, mockReq),
      (err) => err.code === "ETIMEDOUT"
    );
    assert.deepEqual(calls, ["HEAD", "GET"]);
  });

  test("HEAD non-timeout error is not retried with GET", async () => {
    const calls = [];
    const mockReq = async (_url, method) => {
      calls.push(method);
      const e = new Error("connect ECONNREFUSED");
      e.code = "ECONNREFUSED";
      throw e;
    };
    await assert.rejects(
      () => getHeadRequestStatusCode("https://example.com/", 5000, mockReq),
      (err) => err.code === "ECONNREFUSED"
    );
    assert.deepEqual(calls, ["HEAD"], "non-timeout errors should not trigger GET retry");
  });
});
