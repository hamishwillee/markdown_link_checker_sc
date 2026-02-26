import fs from "fs";
import path from "path";
import { logFunction } from "./helpers.js";
import normalize from "normalize-path";

function filterIgnoreErrors(errors, options) {
  // This method removes any errors that are in the ignore errors list
  // This list is imported from the file _link_checker_sc/ignore_errors.json

  // Currently it is the pages to output, as listed in the options.files to output.
  logFunction(options, `Function: filterIgnoreErrors(${errors})`);
  const errorFile = path.join(
    options.docsroot,
    "./_link_checker_sc/ignore_errors.json"
  );

  let ignoreErrors = [];
  try {
    const ignoreFromFile = fs.readFileSync(errorFile);
    ignoreErrors = JSON.parse(ignoreFromFile);
  } catch (error) {
    ignoreErrors = [];
    options.log.includes("quick")
      ? console.log("Error loading IgnoreErrors")
      : null;
    options.log.includes("quick") ? console.log(error) : null;
  }

  const filteredErrors = errors.filter((error) => {
    let returnValue = true; //All items are not filtered, by default.
    ignoreErrors.forEach((ignorableError) => {
      if (
        error.type === ignorableError.type &&
        normalize(error.fileRelativeToRoot) ===
          normalize(ignorableError.fileRelativeToRoot)
      ) {
        // Same file and type, so probably filter out.
        if (!(error.link && ignorableError.link)) {
          returnValue = false; // Neither have a link, so we match on same type
        }

        if (
          error.link &&
          ignorableError.link &&
          error.link.url === ignorableError.link.url
        ) {
          returnValue = false; // They both have a link and it is the same link
        }
      }

      // URL-only match: ignore entry has no type/file, just a link.url — suppress globally
      if (
        !ignorableError.type &&
        !ignorableError.fileRelativeToRoot &&
        error.link &&
        ignorableError.link &&
        error.link.url === ignorableError.link.url
      ) {
        returnValue = false;
      }
    });
    //if (returnValue ==false) console.log(error);
    return returnValue;
  });

  return filteredErrors;
}

function filterErrors(errors, options) {
  // This method filters all errors against settings in the command line
  // Currently it is the pages to output, as listed in the options.files to output.
  logFunction(options, `Function: filterErrors(${errors})`);

  let filteredErrors = errors;
  // Filter results on specified file names (if any specified)
  //console.log(`Number pages to filter: ${options.files.length}`);
  if (options.files.length > 0) {
    //console.log(`USharedFileslength: ${options.files.length}`);
    filteredErrors = errors.filter((error) => {
      //console.log(`UError: ${error}`);
      //console.log(JSON.stringify(error, null, 2));
      //console.log(`UError file: ${error.file}`);
      const filterResult = options.files.includes(error.file);
      return filterResult;
    });
  }

  // Experimental filtering on error types
  // This version filters out values in options.errors
  // console.log(`DEBUG: Filtering out error types: ${options.errors}`);
  if (options.errors.length > 0) {
    filteredErrors = filteredErrors.filter((error) => {
      //console.log(`UError: ${error}`);
      //console.log(JSON.stringify(error, null, 2));
      //console.log(`UError type: ${error.type}`);
      const filterResult = !options.errors.includes(error.type);
      return filterResult;
    });
  }

  // Filter on other things - such as errors.

  filteredErrors;

  //console.log(filteredErrors);
  return filteredErrors;
}

export { filterErrors, filterIgnoreErrors };
