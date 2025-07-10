import path from "path";
import { ExternalLinkError } from "./errors.js"; // TODO Add error for external links
import { logFunction } from "./helpers.js";
import { exit } from "process";

import { URL } from "url"; // Import URL from the 'url' built-in module
import http from "http"; // Import http from the 'http' built-in module
import https from "https"; // Import https from the 'https' built-in module

/**
 * Performs a HEAD request to a given URL and returns the HTTP status code.
 *
 * @param {string} urlString The URL to make the HEAD request to.
 * @param {number} [timeoutMs=5000] The timeout in milliseconds for the request. Defaults to 5000ms (5 seconds).
 * @returns {Promise<number>} A Promise that resolves with the HTTP status code,
 * or rejects with an error if the request fails or times out.
 */
async function getHeadRequestStatusCode(urlString, timeoutMs = 5000) {
  // We use the 'URL' class to parse the URL string and extract its components.
  // This is crucial for correctly configuring the HTTP/HTTPS request options.
  const url = new URL(urlString);

  // Determine whether to use http or https module based on the protocol.
  // This makes the function flexible for both HTTP and HTTPS URLs.
  // We use the imported http and https modules directly.
  const client = url.protocol === "https:" ? https : http;

  // Define the options for the request.
  // 'method: 'HEAD'' is the core of this function, ensuring only headers are fetched.
  // 'hostname', 'port', and 'path' are extracted from the parsed URL.
  const options = {
    method: "HEAD",
    hostname: url.hostname,
    port: url.port || (url.protocol === "https:" ? 443 : 80), // Default ports if not specified
    path: url.pathname + url.search, // Include query parameters
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept:
        "text/html, application/xhtml+xml;q=0.9, application/vnd.wap.xhtml+xml;q=0.6, */*;q=0.5",
      "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
    },
  };

  return new Promise((resolve, reject) => {
    let timeoutId; // Variable to hold the timeout ID

    const req = client.request(options, (res) => {
      clearTimeout(timeoutId); // Clear the timeout if response is received

      const { statusCode, statusMessage, headers } = res;
      let redirectUrl;

      // Check for redirect status codes (3xx)
      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        // Resolve the redirect URL relative to the original URL if it's a relative path
        redirectUrl = new URL(headers.location, urlString).toString();
      }

      // Resolve with an object containing statusCode, statusMessage, and optionally redirectUrl
      resolve({ statusCode, statusMessage, redirectUrl });
      //resolve({ statusCode: res.statusCode, statusMessage: res.statusMessage });
      res.resume(); // Consume response data to free up memory/connection
    });

    // Set a timeout for the request
    timeoutId = setTimeout(() => {
      req.destroy(
        new Error(`Request timed out after ${timeoutMs}ms for ${urlString}`)
      ); // Abort the request
    }, timeoutMs);

    // Handle any errors that occur during the request (e.g., network issues, or timeout destroying the request).
    req.on("error", (e) => {
      clearTimeout(timeoutId); // Clear the timeout on error too
      //console.error(`Problem with request to ${urlString}: ${e.message}`);
      reject(e);
    });

    // End the request. For HEAD requests, there's no body to send.
    req.end();
  });
}

/**
 * Manages concurrent HEAD requests, queuing, and caching results with per-host concurrency limits.
 */
class LinkManager {
  /**
   * @private {Map<string, {statusCode?: number, statusMessage?: string, error?: Error, redirectUrl?: string}>} checkedUrls - Dictionary of URLs that have been resolved, with their results.
   * @private {string[]} pendingQueue - Queue of URLs waiting to be processed.
   * @private {Map<string, Promise<any>>} activeRequests - Map of URLs currently being processed and their active Promises.
   * @private {Set<string>} _activeHostnames - Set of hostnames that currently have an active request.
   * @private {number} maxActiveRequests - Maximum number of concurrent HEAD requests allowed.
   * @private {Function} headRequestFunction - The function used to perform HEAD requests (e.g., getHeadRequestStatusCode).
   * @private {boolean} _finishedAddingUrls - Flag to indicate if no more URLs will be added.
   * @private {Promise<void>} _completionPromise - A Promise that resolves when all URLs are processed.
   * @private {Function} _resolveCompletionPromise - Function to resolve _completionPromise.
   * @private {Map<string, number>} _retryAttempts - Map to track retry attempts for each URL (for 429 errors).
   * @private {number} _maxRetries - Maximum number of retries for a 429 error.
   * @private {number} _baseRetryDelayMs - Base delay for exponential backoff.
   */
  constructor(headRequestFunction, maxConcurrent = 10) {
    this.checkedUrls = new Map(); // Stores resolved results (statusCode or error)
    this.pendingQueue = []; // URLs waiting to be picked up
    this.activeRequests = new Map(); // URLs currently being processed (URL -> Promise)
    this._activeHostnames = new Set(); // Tracks hostnames with active requests
    this.maxActiveRequests = maxConcurrent; // Global concurrency limit
    this.headRequestFunction = headRequestFunction; // Function to execute HEAD request
    this._finishedAddingUrls = false; // Initially, we can still add URLs

    this._retryAttempts = new Map(); // Tracks how many times a URL has been retried for 429
    this._maxRetries = 3; // Max attempts for a 429 error
    this._baseRetryDelayMs = 1000; // 1 second base delay for exponential backoff

    // Create a Promise that will resolve when the manager is done processing everything
    this._completionPromise = new Promise((resolve) => {
      this._resolveCompletionPromise = resolve;
    });
  }

  /**
   * Checks the status of a given URL, managing its lifecycle through pending, active, and resolved states.
   *
   * @param {string} urlString The URL to check.
   * @param {boolean} [isInternalTrigger=false] - Internal flag: true if called due to a redirect or retry.
   * @returns {{type: 'resolved', url: string, statusCode?: number, statusMessage?: string, error?: Error, redirectUrl?: string} | {type: 'active', url: string} | {type: 'pending', url: string}}
   * An object indicating the current status of the URL.
   */
  checkURL(urlString, isInternalTrigger = false) {
    // If manager has been signaled to finish AND it's not an internal trigger (redirect or retry),
    // then new URLs should not be added by external calls.
    if (this._finishedAddingUrls && !isInternalTrigger) {
      console.warn(
        `Cannot add URL ${urlString}. LinkManager has been signaled to finish.`
      );
      if (this.checkedUrls.has(urlString)) {
        const result = this.checkedUrls.get(urlString);
        return { type: "resolved", url: urlString, ...result };
      }
      return {
        type: "error",
        url: urlString,
        message: "Manager is finishing.",
      };
    }

    if (this.checkedUrls.has(urlString)) {
      const result = this.checkedUrls.get(urlString);
      return { type: "resolved", url: urlString, ...result };
    }

    if (this.activeRequests.has(urlString)) {
      return { type: "active", url: urlString };
    }

    // Check if it's already in pending queue (important for retries to avoid duplicates)
    if (this.pendingQueue.includes(urlString)) {
      return { type: "pending", url: urlString };
    }

    this.pendingQueue.push(urlString);
    this._processQueue(); // Attempt to start processing immediately
    return { type: "pending", url: urlString };
  }

  /**
   * Internal method to manage the active and pending queues.
   * It moves URLs from the pending queue to the active queue up to maxActiveRequests limit,
   * respecting per-host concurrency.
   * Also checks if all processing is complete to resolve the completion promise.
   * @private
   */
  _processQueue() {
    // Iterate through the pending queue to find suitable URLs
    for (let i = 0; i < this.pendingQueue.length; i++) {
      // Stop if global concurrency limit is reached
      if (this.activeRequests.size >= this.maxActiveRequests) {
        break;
      }

      const urlToProcess = this.pendingQueue[i];
      let hostname;
      try {
        hostname = new URL(urlToProcess).hostname;
      } catch (e) {
        // Handle malformed URLs that might be in the queue
        console.error(
          `Malformed URL in pending queue, skipping: ${urlToProcess} - ${e.message}`
        );
        this.checkedUrls.set(urlToProcess, {
          error: new Error(`Malformed URL: ${e.message}`),
        });
        this.pendingQueue.splice(i, 1); // Remove it
        i--; // Adjust index due to removal
        continue;
      }

      // Check if this hostname already has an active request
      if (this._activeHostnames.has(hostname)) {
        // This host is currently busy, skip this URL for now.
        // It remains in the pendingQueue and will be re-evaluated in future _processQueue calls.
        continue;
      }

      // If we reach here, we found a suitable URL:
      // 1. Remove it from the pending queue
      this.pendingQueue.splice(i, 1);
      i--; // Decrement index because we removed an element and the next element shifts to current position

      // 2. Add its hostname to the set of active hostnames
      this._activeHostnames.add(hostname);

      // 3. Add the URL to the active requests map
      // Start the HEAD request. The returned promise now resolves with { statusCode, statusMessage, redirectUrl }
      const requestPromise = this.headRequestFunction(urlToProcess, 8000)
        .then((result) => {
          // Handle 429 Too Many Requests errors with exponential backoff
          if (result.statusCode === 429) {
            const currentRetries = this._retryAttempts.get(urlToProcess) || 0;
            if (currentRetries < this._maxRetries) {
              const delay =
                this._baseRetryDelayMs * Math.pow(2, currentRetries); // Exponential backoff
              this._retryAttempts.set(urlToProcess, currentRetries + 1);

              /*
              console.warn(
                `  ${urlToProcess}: Received 429. Retrying in ${delay}ms (attempt ${
                  currentRetries + 1
                }/${this._maxRetries}).`
              );
              */

              // Re-add to pending queue after delay
              setTimeout(() => this.checkURL(urlToProcess, true), delay); // true for isInternalTrigger
            } else {
              // Max retries reached, store as a final error
              const error = new Error(`Too many retries for 429 status code`);
              this.checkedUrls.set(urlToProcess, {
                statusCode: result.statusCode,
                statusMessage: result.statusMessage,
                error: error,
              });
            }
          } else {
            // Not a 429, store the result normally
            this.checkedUrls.set(urlToProcess, {
              statusCode: result.statusCode,
              statusMessage: result.statusMessage,
              redirectUrl: result.redirectUrl, // Store the redirect URL if present
            });
            this._retryAttempts.delete(urlToProcess); // Clean up retry attempts if successful

            // If it's a redirect, add the redirected URL back to be processed
            if (result.redirectUrl) {
              /*
              console.log(
                `  ${urlToProcess} redirected to: ${result.redirectUrl}`
              );
              */

              // IMPORTANT: Pass true for isInternalTrigger to allow adding even after finish()
              this.checkURL(result.redirectUrl, true);
            }
          }
        })
        .catch((error) => {
          this.checkedUrls.set(urlToProcess, { error: error });
          this._retryAttempts.delete(urlToProcess); // Clean up retry attempts on other errors
        })
        .finally(() => {
          // Request completed (success or failure/timeout/429-max-retries)
          this.activeRequests.delete(urlToProcess); // Remove URL from active requests map
          this._activeHostnames.delete(hostname); // Free up the hostname for new requests

          // Important: Recurse to process more from the pending queue
          // This handles cases where _processQueue exited because all pending hosts were busy
          let totalSize =
            this.checkedUrls.size +
            this.pendingQueue.length +
            this.activeRequests.size;
          if (totalSize % 100 === 0) {
            //
            updateConsoleLine(
              `checked: ${this.checkedUrls.size}, pendingQueue: ${this.pendingQueue.length}, activeRequests: ${this.activeRequests.size}`
            );
          }

          //console.log(            `checked: ${this.checkedUrls.size}, pendingQueue: ${this.pendingQueue.length}, activeRequests: ${this.activeRequests.size}`          );
          this._processQueue();
        });

      this.activeRequests.set(urlToProcess, requestPromise);
    }

    // Check if everything is done if finish() has been called
    if (
      this._finishedAddingUrls &&
      this.pendingQueue.length === 0 &&
      this.activeRequests.size === 0
    ) {
      this._resolveCompletionPromise();
    }
  }

  /**
   * Signals that no more URLs will be added to the LinkManager.
   * This allows the manager to know when it can consider all processing complete.
   */
  finish() {
    this._finishedAddingUrls = true;
    this._processQueue();
  }

  /**
   * Returns a Promise that resolves when all pending and active requests are complete,
   * and the `finish()` method has been called.
   * @returns {Promise<void>}
   */
  async onComplete() {
    return this._completionPromise;
  }

  /**
   * Returns the current size of the pending queue.
   * @returns {number}
   */
  getPendingCount() {
    return this.pendingQueue.length;
  }

  /**
   * Returns the current size of the active requests queue.
   * @returns {number}
   */
  getActiveCount() {
    return this.activeRequests.size;
  }

  /**
   * Returns the current size of the checked URLs dictionary.
   * @returns {number}
   */
  getCheckedCount() {
    return this.checkedUrls.size;
  }
}

function updateConsoleLine(message) {
  // Update the console line with the current status on same line
  process.stdout.write("\r" + message + "          ");
}

const linkManager = new LinkManager(getHeadRequestStatusCode, 10);

// Add all external links to the link manager.
// That async gets the status of any URL passed.
// But if doesn't refetch if already fetched or fetching
async function checkExternalUrlLinks(results) {
  logFunction(`Function: checkExternalUrlLinks()`);
  results.forEach((page, index, array) => {
    page.urlLinks.forEach((link, index, array) => {
      // const status = linkManager.checkURL(link.url);
      linkManager.checkURL(link.url);
    });

    //console.log(urlResultLookup);
  });

  linkManager.finish(); // Signal that no more URLs will be added
  await linkManager.onComplete();
}

async function processExternalUrlLinks(results) {
  logFunction(`Function: processExternalUrlLinks()`);
  await checkExternalUrlLinks(results); // Wait for all links to be checked
  logFunction(`Function FINISHED AWAITING: processExternalUrlLinks()`);
  // Now we can process the results and create errors for any links that failed.
  const errors = [];
  results.forEach((page, index, array) => {
    //console.log(`debug: PAGE: ${page}`);
    //console.log(page);
    //exit();
    page.urlLinks.forEach((link, index, array) => {
      const urlResult = linkManager.checkedUrls.get(link.url);
      //console.log(urlResult);
      if (urlResult) {
        if (urlResult.statusCode === 200) {
          // Link is good. Do nothing.
        } else {
          // Link is not valid, so we can create an error object.
          const error = new ExternalLinkError({
            file: link.page,
            link: link,
            statusCode: urlResult.statusCode,
            statusMessage: urlResult.statusMessage,
            error: urlResult.error,
          });
          errors.push(error);
          //error.output();
        }
      }

      // Here we should have all our links checked, so we can start processing them.
    });

    //console.log(urlResultLookup);
  });
  return errors;
}

export { processExternalUrlLinks };

/* Format of a result of an external link.
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
      },

      */
