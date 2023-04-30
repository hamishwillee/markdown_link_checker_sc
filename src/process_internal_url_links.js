import path from "path";
import { UrlToLocalSiteError} from "./errors.js"

// An array of errors given a results object that contains our array of objects containing urls that link to our current site.
// The options not used at this point.
function processUrlsToLocalSource(results, options) {
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
