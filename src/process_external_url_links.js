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
    },
  };

  return new Promise((resolve, reject) => {
    let timeoutId; // Variable to hold the timeout ID

    // Make the actual HEAD request.
    const req = client.request(options, (res) => {
      clearTimeout(timeoutId); // Clear the timeout if response is received
      // When a response is received, we resolve the Promise with the status code.
      // No need to consume the response body as it's a HEAD request.
      resolve(res.statusCode);
      // It's good practice to end the request even if no data is expected.
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
      console.error(`Problem with request to ${urlString}: ${e.message}`);
      reject(e);
    });

    // End the request. For HEAD requests, there's no body to send.
    req.end();
  });
}

/**
 * Manages concurrent HEAD requests, queuing, and caching results.
 */
class LinkManager {
  /**
   * @private {Map<string, {statusCode?: number, error?: Error}>} checkedUrls - Dictionary of URLs that have been resolved, with their results.
   * @private {string[]} pendingQueue - Queue of URLs waiting to be processed.
   * @private {Map<string, Promise<any>>} activeRequests - Map of URLs currently being processed and their active Promises.
   * @private {number} maxActiveRequests - Maximum number of concurrent HEAD requests allowed.
   * @private {Function} headRequestFunction - The function used to perform HEAD requests (e.g., getHeadRequestStatusCode).
   * @private {boolean} _finishedAddingUrls - Flag to indicate if no more URLs will be added.
   * @private {Promise<void>} _completionPromise - A Promise that resolves when all URLs are processed.
   * @private {Function} _resolveCompletionPromise - Function to resolve _completionPromise.
   */
  constructor(headRequestFunction, maxConcurrent = 10) {
    this.checkedUrls = new Map(); // Stores resolved results (statusCode or error)
    this.pendingQueue = []; // URLs waiting to be picked up
    this.activeRequests = new Map(); // URLs currently being processed (URL -> Promise)
    this.maxActiveRequests = maxConcurrent; // Concurrency limit
    this.headRequestFunction = headRequestFunction; // Function to execute HEAD request
    this._finishedAddingUrls = false; // Initially, we can still add URLs

    // Create a Promise that will resolve when the manager is done processing everything
    this._completionPromise = new Promise((resolve) => {
      this._resolveCompletionPromise = resolve;
    });
  }

  /**
   * Checks the status of a given URL, managing its lifecycle through pending, active, and resolved states.
   *
   * @param {string} urlString The URL to check.
   * @returns {{type: 'resolved', url: string, statusCode?: number, error?: Error} | {type: 'active', url: string} | {type: 'pending', url: string}}
   * An object indicating the current status of the URL.
   */
  checkURL(urlString) {
    if (this._finishedAddingUrls) {
      // If we've signaled completion, no new URLs should be added.
      // This is a safety check; ideally, checkURL wouldn't be called after finish().
      console.warn(
        `Cannot add URL ${urlString}. LinkManager has been signaled to finish.`
      );
      // Still return existing status if available
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

    // 1. Check if the URL has already been resolved
    if (this.checkedUrls.has(urlString)) {
      const result = this.checkedUrls.get(urlString);
      return { type: "resolved", url: urlString, ...result };
    }

    // 2. Check if the URL is currently being processed (in active queue)
    if (this.activeRequests.has(urlString)) {
      return { type: "active", url: urlString };
    }

    // 3. Check if the URL is already in the pending queue
    if (this.pendingQueue.includes(urlString)) {
      return { type: "pending", url: urlString };
    }

    // 4. If not resolved, active, or pending, add to pending queue and try to process
    this.pendingQueue.push(urlString);
    this._processQueue(); // Attempt to start processing immediately
    return { type: "pending", url: urlString };
  }

  /**
   * Internal method to manage the active and pending queues.
   * It moves URLs from the pending queue to the active queue up to maxActiveRequests limit.
   * Also checks if all processing is complete to resolve the completion promise.
   * @private
   */
  _processQueue() {
    // Fill the active queue as long as there are pending URLs and capacity
    console.log(
      `Processing queue: ${this.getPendingCount()} pending, ${this.getActiveCount()} active`
    );

    while (
      this.activeRequests.size < this.maxActiveRequests &&
      this.pendingQueue.length > 0
    ) {
      const urlToProcess = this.pendingQueue.shift(); // Get the next URL from pending queue

      if (!urlToProcess) {
        // Should not happen if length > 0, but good for safety
        continue;
      }

      // Start the HEAD request
      const requestPromise = this.headRequestFunction(urlToProcess)
        .then((statusCode) => {
          // Request successful: store status code
          this.checkedUrls.set(urlToProcess, { statusCode: statusCode });
        })
        .catch((error) => {
          // Request failed: store error
          this.checkedUrls.set(urlToProcess, { error: error });
        })
        .finally(() => {
          // Request completed (success or failure)
          this.activeRequests.delete(urlToProcess); // Remove from active requests
          this._processQueue(); // Try to fill the queue again with next pending URL
        });

      this.activeRequests.set(urlToProcess, requestPromise); // Add to active requests map
    }

    // Check if everything is done if finish() has been called
    if (
      this._finishedAddingUrls &&
      this.pendingQueue.length === 0 &&
      this.activeRequests.size === 0
    ) {
      this._resolveCompletionPromise(); // Resolve the main completion promise
    }
  }

  /**
   * Signals that no more URLs will be added to the LinkManager.
   * This allows the manager to know when it can consider all processing complete.
   */
  finish() {
    this._finishedAddingUrls = true;
    // Immediately check if queues are already empty (e.g., if finish() is called after all checkURL calls)
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
  logFunction(`Function FIISHED AWAIING: processExternalUrlLinks()`);
  const errors = [];
  results.forEach((page, index, array) => {
    //console.log(`debug: PAGE: ${page}`);
    //console.log(page);
    //exit();
    page.urlLinks.forEach((link, index, array) => {
      console.log(`debug: LINK: ${link}`);
      console.log(link);
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
