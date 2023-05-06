import path from "path";
import { UrlToLocalSiteError} from "./errors.js"
import { logFunction } from "./helpers.js";

// An array of errors given a results object that contains our array of objects containing urls that link to our current site.
function processUrlsToLocalSource(results) {
  logFunction(`Function:processUrlsToLocalSource()`);
  const errors = [];
  results.forEach((page, index, array) => {
    //console.log(`PAGE: ${page}`);

    page.urlLocalLinks.forEach((link, index, array) => {
      //console.log(`LINK: ${link}`);
      
      const error = new UrlToLocalSiteError({link: link})
      errors.push(error);
    });
  });
  return errors;
}

export { processUrlsToLocalSource };
