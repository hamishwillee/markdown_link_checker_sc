//import { /*LinkError,*/ CurrentFileMissingAnchorError, LinkedFileMissingAnchorError, LinkedInternalPageMissingError, InternalLinkToHTMLError, UrlToLocalSiteError} from "./errors.js"

import { sharedData } from "./shared_data.js";
import { logFunction } from "./helpers.js";

import promptSync from "prompt-sync";
const prompt = promptSync();

import fs from "fs";
import path from "path";

//Function that generates console and/or log output from an array of error objects.
// - `results` is an array of error objects.
//  These will have a `type` and a `page`. They may also have other values, depending on type of error - such as linkurl
function outputErrors(results) {
  logFunction("Function: outputErrors()");

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

  //let updateErrors = false;
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

        // Add items to the errors to be ignored, if enabled.
        if (sharedData.options.interactive) {
          const hideError = prompt("Stop reporting on this error? (Y/N) ", "N");
          console.log(`HideError: ${hideError}`);
          if (!sharedData.IgnoreErrors) {
            sharedData.IgnoreErrors = [];
          }
          if (hideError === "X" || hideError === "x") {
            // Exit without saving
            exit();
          }
          if (hideError === "Y" || hideError === "y") {
            const reduceError = {
              type: error.type,
              fileRelativeToRoot: error.fileRelativeToRoot,
              //link: reduceLink,
            };
            if (error.link) {
              const reduceLink = {
                url: error.link.url,
                text: error.link.text,
              };
              reduceError.link = reduceLink;
            }

            reduceError.hideReason = prompt("Why? (enter for now reason) ", "");

            sharedData.IgnoreErrors.push(reduceError);
            //updateErrors = true;
          }
        }
      }
    }
  }

  // Create the `_link_checker_sc` folder if it doesn't exist.
  const dirPath = path.join(process.cwd(), "_link_checker_sc");
  if (!fs.existsSync(dirPath) && sharedData.options.interactive) {
    fs.mkdirSync(dirPath);
  }

  // Create create file to store the json for the errors into
  // But only if iterative update in progress
  if (sharedData.options.interactive) {
    const filePath = path.join(dirPath, "ignore_errors.json");
    fs.writeFileSync(
      filePath,
      JSON.stringify(sharedData.IgnoreErrors, null, 2)
    );
  }
}

export { outputErrors };
