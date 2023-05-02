//import { /*LinkError,*/ CurrentFileMissingAnchorError, LinkedFileMissingAnchorError, LinkedInternalPageMissingError, InternalLinkToHTMLError, UrlToLocalSiteError} from "./errors.js"

import { sharedData } from "./shared_data.js";


//Function that generates console and/or log output from an array of error objects.
// - `results` is an array of error objects. These will have a `type` and a `page`. They may also have other values, depending on type of error - such as linkurl
function outputErrors(results) {
  sharedData.options.log.includes("functions")
    ? console.log("Function: outputErrors()")
    : null;

  //Sort results by page and type.
  // Perhaps next step is to create only get info for particular pages.
  const sortedByPageErrors = {};

  for (const error of results) {
    //Report errors for listed pages or all
    //console.log(error.page);
    if (!sortedByPageErrors[error.file]) {
      sortedByPageErrors[error.file] = [];
    }
    sortedByPageErrors[error.file].push(error);

    // Sort by type as well.
    for (const page in sortedByPageErrors) {
      sortedByPageErrors[page].sort((a, b) => a.type.localeCompare(b.type));
    }
  }

  //console.log(sortedByPageErrors);
  for (const page in sortedByPageErrors) {
    let pageFromRoot;
    if (sharedData.options.root) {
      pageFromRoot = page.split(sharedData.options.root)[1];
    } else {
      pageFromRoot = page.split(sharedData.options.directory)[1];
    }
    //console.log(`\nXX${page}`); //Root needs to full path - not '.' or whatever
    console.log(`\n${pageFromRoot}`); //Root needs to full path - not '.' or whatever
    for (const error of sortedByPageErrors[page]) {
      if (error.output) {
        error.output();
      }
    }
  }
}

export { outputErrors };
