/*import path from "path";
import {
  CurrentFileMissingAnchorError,
  LinkedFileMissingAnchorError,
  LinkedInternalPageMissingError,
  InternalLinkToHTMLError,
  UrlToLocalSiteError,
} from "./errors.js";
*/
import { sharedData } from "./shared_data.js";
import { logFunction } from "./helpers.js";

/*
Thoughts.
1. We want to make Head request by default. Only make a GET if we want to check for anchors.
2. We want to cache the results of requests so that if we made a request a day or so ago we don't try and make it again
3. We want to only request the links in the current set of pages by default. For all pages we probably want to explicitly decide to do the checks.
4. We can make parallel requests. Lets start in batches of 5. 
5. Redirects should go back on the queue. The results should include the path of redirects to some depth.
6. We should be able to search for data by URL i.e. a dict of URLs.


*/

function processUrls(results) {
  logFunction(`Function: processUrls()`);
  //const errors = [];
  //console.log(externalLinks);
  results.forEach((page, index, array) => {
    console.log(page.page_file);

    page.urlLinks.forEach((urlitem, index, array) => {
      //console.log(urlitem);
      console.log(urlitem.url);

    });
  });
}

function processPageURLS(results) {
  // Not sure yet how to structure - might break up like this
  logFunction(`Function: processPageURLS()`);
  //const errors = [];
  //console.log(externalLinks);
  results.forEach((page, index, array) => {
    console.log(page.page_file);

    page.urlLinks.forEach((urlitem, index, array) => {
      console.log(urlitem);
      console.log(urlitem.url);
    });
  });
}

export { processUrls };
