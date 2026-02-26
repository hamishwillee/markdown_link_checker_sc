import readline from "readline";
import { ExternalLinkError, ExternalLinkWarning } from "./errors.js";
import { logFunction } from "./helpers.js";
import { URL } from "url";
import http from "http";
import https from "https";

/**
 * Strips the fragment (#...) from a URL string so that
 * https://example.com/page#section-1 and https://example.com/page#section-2
 * are treated as the same resource when making HTTP requests.
 *
 * Malformed URLs are returned unchanged; they will be caught later in _processQueue.
 *
 * @param {string} urlString
 * @returns {string}
 */
function stripFragment(urlString) {
  try {
    const u = new URL(urlString);
    u.hash = "";
    return u.toString();
  } catch {
    return urlString;
  }
}

/**
 * Performs an HTTP request (HEAD or GET) to a given URL and returns the HTTP
 * status code, status message, redirect URL (if any), and parsed Retry-After
 * delay (if the server supplied one).
 *
 * @param {string} urlString
 * @param {'HEAD' | 'GET'} method
 * @param {number} [timeoutMs=5000]
 * @returns {Promise<{statusCode: number, statusMessage: string, redirectUrl?: string, retryAfterMs?: number}>}
 */
async function makeHttpRequest(urlString, method, timeoutMs = 5000) {
  const url = new URL(urlString);
  const client = url.protocol === "https:" ? https : http;
  const options = {
    method,
    hostname: url.hostname,
    port: url.port || (url.protocol === "https:" ? 443 : 80),
    path: url.pathname + url.search,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept:
        "text/html, application/xhtml+xml;q=0.9, application/vnd.wap.xhtml+xml;q=0.6, */*;q=0.5",
      "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
    },
  };

  return new Promise((resolve, reject) => {
    let timeoutId;

    const req = client.request(options, (res) => {
      clearTimeout(timeoutId);
      const { statusCode, statusMessage, headers } = res;

      let redirectUrl;
      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        redirectUrl = new URL(headers.location, urlString).toString();
      }

      // Parse Retry-After header (integer seconds only; HTTP-date format ignored).
      let retryAfterMs;
      if (headers["retry-after"]) {
        const parsed = parseInt(headers["retry-after"], 10);
        if (!isNaN(parsed)) retryAfterMs = parsed * 1000;
      }

      res.resume();
      resolve({ statusCode, statusMessage, redirectUrl, retryAfterMs });
    });

    timeoutId = setTimeout(() => {
      req.destroy(
        new Error(`Request timed out after ${timeoutMs}ms for ${urlString} (${method})`)
      );
    }, timeoutMs);

    req.on("error", (e) => {
      clearTimeout(timeoutId);
      reject(e);
    });

    req.end();
  });
}

/**
 * Performs a HEAD request and retries with GET if the server returns 403
 * (some servers block HEAD requests).
 *
 * @param {string} urlString
 * @param {number} [timeoutMs=5000]
 * @returns {Promise<{statusCode: number, statusMessage: string, redirectUrl?: string, retryAfterMs?: number}>}
 */
async function getHeadRequestStatusCode(urlString, timeoutMs = 5000, _makeRequest = makeHttpRequest) {
  const headResult = await _makeRequest(urlString, "HEAD", timeoutMs);
  if (headResult.statusCode === 403) {
    return _makeRequest(urlString, "GET", timeoutMs);
  }
  return headResult;
}

/**
 * Manages concurrent HTTP requests with:
 *   - A primary pendingQueue for first-attempt URLs.
 *   - A separate retryQueue for 429-rate-limited URLs, drained only after
 *     pendingQueue is empty (so retries never starve first-time requests).
 *   - Per-hostname concurrency limiting (maxPerHostRequests, default 2).
 *   - Global concurrency limiting (maxActiveRequests).
 *   - Exponential backoff for 429s, honouring Retry-After headers.
 *   - Fragment stripping: https://host/page#a and https://host/page#b share
 *     one HTTP request.
 *   - abort() to stop immediately and continue with partial results.
 */
class LinkManager {
  constructor(headRequestFunction, maxConcurrent = 10) {
    this.checkedUrls = new Map();

    // First-attempt URLs.
    this.pendingQueue = [];
    this._pendingSet = new Set(); // O(1) membership test for pendingQueue

    // 429-rate-limited URLs waiting for their backoff to expire.
    // Each entry: { url: string, notBefore: number (epoch ms) }
    // Drained only when pendingQueue is empty.
    this.retryQueue = [];
    this._retrySet = new Set(); // O(1) membership test for retryQueue

    this.activeRequests = new Map();        // url -> Promise
    this._activeHostCounts = new Map();     // hostname -> active request count
    this.maxActiveRequests = maxConcurrent;
    this.maxPerHostRequests = 5;            // concurrent requests allowed per hostname

    this.headRequestFunction = headRequestFunction;
    this._finishedAddingUrls = false;
    this._aborted = false;

    this._retryAttempts = new Map();
    this._maxRetries = 3;
    this._baseRetryDelayMs = 1000;

    this._completionPromise = new Promise((resolve) => {
      this._resolveCompletionPromise = resolve;
    });
  }

  /**
   * Registers a URL to be checked.  Strips the fragment before queuing so
   * that multiple links to the same page (different anchors) share one request.
   *
   * @param {string} urlString
   * @param {boolean} [isInternalTrigger=false] Set true for redirects/retries.
   * @returns {{ type: 'resolved'|'active'|'pending'|'error', url: string, ...}}
   */
  checkURL(urlString, isInternalTrigger = false) {
    urlString = stripFragment(urlString);

    if (this._finishedAddingUrls && !isInternalTrigger) {
      console.warn(
        `Cannot add URL ${urlString}. LinkManager has been signaled to finish.`
      );
      if (this.checkedUrls.has(urlString)) {
        return { type: "resolved", url: urlString, ...this.checkedUrls.get(urlString) };
      }
      return { type: "error", url: urlString, message: "Manager is finishing." };
    }

    if (this.checkedUrls.has(urlString)) {
      return { type: "resolved", url: urlString, ...this.checkedUrls.get(urlString) };
    }
    if (this.activeRequests.has(urlString)) {
      return { type: "active", url: urlString };
    }
    if (this._pendingSet.has(urlString) || this._retrySet.has(urlString)) {
      return { type: "pending", url: urlString };
    }

    this.pendingQueue.push(urlString);
    this._pendingSet.add(urlString);
    this._processQueue();
    return { type: "pending", url: urlString };
  }

  /**
   * Returns the cached result for a URL, stripping its fragment first.
   * Use this instead of checkedUrls.get(url) so that fragment URLs resolve correctly.
   *
   * @param {string} urlString
   * @returns {{ statusCode?: number, statusMessage?: string, error?: Error, redirectUrl?: string } | undefined}
   */
  getResult(urlString) {
    return this.checkedUrls.get(stripFragment(urlString));
  }

  /**
   * Pulls work from pendingQueue (priority) then retryQueue and starts HTTP
   * requests, respecting global and per-host concurrency limits.
   * @private
   */
  _processQueue() {
    if (this._aborted) return;

    // Two passes: pendingQueue first, retryQueue only when pendingQueue is empty.
    outer: for (const [queue, set, isRetry] of [
      [this.pendingQueue, this._pendingSet, false],
      [this.retryQueue, this._retrySet, true],
    ]) {
      if (isRetry && this.pendingQueue.length > 0) break;

      for (let i = 0; i < queue.length; i++) {
        if (this.activeRequests.size >= this.maxActiveRequests) break outer;

        const entry = queue[i];
        const urlToProcess = isRetry ? entry.url : entry;

        // Retry entries whose backoff hasn't elapsed yet are skipped.
        // The entry's `ready` flag is set to true by the scheduled setTimeout,
        // guaranteeing the delay has actually elapsed before we dispatch.
        if (isRetry && !entry.ready) continue;

        let hostname;
        try {
          hostname = new URL(urlToProcess).hostname;
        } catch (e) {
          console.error(
            `Malformed URL in queue, skipping: ${urlToProcess} - ${e.message}`
          );
          this.checkedUrls.set(urlToProcess, {
            error: new Error(`Malformed URL: ${e.message}`),
          });
          queue.splice(i, 1);
          set.delete(urlToProcess);
          i--;
          continue;
        }

        const hostCount = this._activeHostCounts.get(hostname) ?? 0;
        if (hostCount >= this.maxPerHostRequests) continue;

        // Claim this URL.
        queue.splice(i, 1);
        set.delete(urlToProcess);
        i--;

        this._activeHostCounts.set(hostname, hostCount + 1);

        const requestPromise = this.headRequestFunction(urlToProcess, 8000)
          .then((result) => {
            if (result.statusCode === 429) {
              const currentRetries = this._retryAttempts.get(urlToProcess) ?? 0;
              if (currentRetries < this._maxRetries) {
                const backoffMs =
                  this._baseRetryDelayMs * Math.pow(2, currentRetries);
                const delay = Math.max(backoffMs, result.retryAfterMs ?? 0);
                this._retryAttempts.set(urlToProcess, currentRetries + 1);

                // Place in retryQueue immediately so the completion check sees it.
                // The entry starts with ready=false; the setTimeout below sets
                // ready=true, guaranteeing the delay has elapsed before dispatch.
                const retryEntry = { url: urlToProcess, ready: false };
                this.retryQueue.push(retryEntry);
                this._retrySet.add(urlToProcess);

                // Wake up _processQueue once the backoff expires.
                setTimeout(() => { retryEntry.ready = true; this._processQueue(); }, delay);
              } else {
                this.checkedUrls.set(urlToProcess, {
                  statusCode: result.statusCode,
                  statusMessage: result.statusMessage,
                  error: new Error("Too many retries for 429 status code"),
                });
              }
            } else {
              this.checkedUrls.set(urlToProcess, {
                statusCode: result.statusCode,
                statusMessage: result.statusMessage,
                redirectUrl: result.redirectUrl,
              });
              this._retryAttempts.delete(urlToProcess);
              if (result.redirectUrl) {
                this.checkURL(result.redirectUrl, true);
              }
            }
          })
          .catch((error) => {
            this.checkedUrls.set(urlToProcess, { error });
            this._retryAttempts.delete(urlToProcess);
          })
          .finally(() => {
            this.activeRequests.delete(urlToProcess);
            const newCount = (this._activeHostCounts.get(hostname) ?? 1) - 1;
            if (newCount <= 0) {
              this._activeHostCounts.delete(hostname);
            } else {
              this._activeHostCounts.set(hostname, newCount);
            }

            if (!this._aborted) {
              this._processQueue();
              updateConsoleLine(
                `checked: ${this.checkedUrls.size}  active: ${this.activeRequests.size}  queued: ${this.pendingQueue.length + this.retryQueue.length}`
              );
            }
          });

        this.activeRequests.set(urlToProcess, requestPromise);
      }
    }

    // Resolve when all queues and in-flight requests are drained.
    if (
      this._finishedAddingUrls &&
      this.pendingQueue.length === 0 &&
      this.retryQueue.length === 0 &&
      this.activeRequests.size === 0
    ) {
      this._resolveCompletionPromise();
    }
  }

  /** Signals that no more external URLs will be added. */
  finish() {
    this._finishedAddingUrls = true;
    this._processQueue();
  }

  /**
   * Stops processing immediately and resolves onComplete() with whatever
   * results have been collected so far.  In-flight requests complete silently
   * but their results are not used.  No new requests are started after abort().
   */
  abort() {
    this._aborted = true;
    this._resolveCompletionPromise();
  }

  /** @returns {Promise<void>} Resolves when all URLs are checked (or after abort()). */
  async onComplete() {
    return this._completionPromise;
  }

  getPendingCount() { return this.pendingQueue.length; }
  getRetryCount()   { return this.retryQueue.length; }
  getActiveCount()  { return this.activeRequests.size; }
  getCheckedCount() { return this.checkedUrls.size; }
}

function updateConsoleLine(message) {
  if (process.stdout.isTTY) {
    process.stdout.write("\r" + message + "          ");
  }
}

/**
 * Queues all external links from results into manager, then waits for
 * completion.  If stdin is a TTY, pressing X stops checking early and
 * continues with partial results; Ctrl+C quits entirely.
 *
 * @param {Array} results
 * @param {LinkManager} manager
 */
async function checkExternalUrlLinks(results, manager) {
  logFunction("Function: checkExternalUrlLinks()");
  results.forEach((page) => {
    page.urlLinks.forEach((link) => {
      manager.checkURL(link.url);
    });
  });

  manager.finish();

  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write(
      "\n  [X] or [Ctrl+C] Stop external link checking and continue with partial results\n"
    );

    const onKeypress = (_str, key) => {
      if (!key) return;
      if (key.name === "x" || key.name === "X" || (key.ctrl && key.name === "c")) {
        process.stderr.write(
          "\n  External link checking stopped. Continuing with partial results...\n"
        );
        manager.abort();
      }
    };

    process.stdin.on("keypress", onKeypress);
    await manager.onComplete();
    process.stdin.removeListener("keypress", onKeypress);
    process.stdin.setRawMode(false);
    process.stdin.pause();
  } else {
    await manager.onComplete();
  }
}

/**
 * Main entry point for external link checking.
 * Accepts an optional LinkManager for testing; creates a default one otherwise.
 *
 * @param {Array} results
 * @param {LinkManager|null} [manager=null]
 * @returns {Promise<Array>} Array of ExternalLinkError / ExternalLinkWarning instances.
 */
async function processExternalUrlLinks(results, manager = null) {
  if (!manager) {
    manager = new LinkManager(getHeadRequestStatusCode, 10);
  }
  logFunction("Function: processExternalUrlLinks()");
  await checkExternalUrlLinks(results, manager);
  logFunction("Function FINISHED AWAITING: processExternalUrlLinks()");

  const errors = [];
  results.forEach((page) => {
    page.urlLinks.forEach((link) => {
      // getResult() strips the fragment before looking up, so
      // https://host/page#section resolves to the cached https://host/page result.
      const urlResult = manager.getResult(link.url);
      if (urlResult) {
        if (urlResult.statusCode === 200) {
          // Link is good — do nothing.
        } else if (
          urlResult.statusCode === 302 ||
          urlResult.statusCode === 303 ||
          urlResult.statusCode === 307 ||
          urlResult.statusCode === 403
        ) {
          errors.push(
            new ExternalLinkWarning({
              file: link.page,
              link,
              statusCode: urlResult.statusCode,
              statusMessage: urlResult.statusMessage,
              error: urlResult.error,
              redirectUrl: urlResult.redirectUrl,
            })
          );
        } else {
          errors.push(
            new ExternalLinkError({
              file: link.page,
              link,
              statusCode: urlResult.statusCode,
              statusMessage: urlResult.statusMessage,
              error: urlResult.error,
              redirectUrl: urlResult.redirectUrl,
            })
          );
        }
      }
    });
  });
  return errors;
}

export { processExternalUrlLinks, LinkManager, stripFragment, getHeadRequestStatusCode };

/* Format of a result object on page.urlLinks:
      {
        "address": "https://github.com/PX4/PX4-Autopilot/blob/main/src/drivers/gps/gps.cpp",
        "anchor": "L1023",
        "params": "",
        "type": "urlLink",
        "isImage": false,
        "isMarkdown": false,
        "isHTML": false,
        "isRelative": false,
        "isReferenceLink": false,
        "page": "D:\\github\\px4\\PX4-Autopilot\\docs\\en\\uart\\user_configurable_serial_driver.md",
        "fileRelativeToRoot": "en\\uart\\user_configurable_serial_driver.md",
        "url": "https://github.com/PX4/PX4-Autopilot/blob/main/src/drivers/gps/gps.cpp#L1023",
        "text": "gps driver",
        "title": "",
        "refName": "",
        "refMatch": ""
      }
*/
