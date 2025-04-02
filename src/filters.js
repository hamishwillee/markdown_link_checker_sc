import fs from "fs";
import path from "path";
import { sharedData } from "./shared_data.js";
import { logFunction } from "./helpers.js";
import normalize from 'normalize-path';

function filterIgnoreErrors(errors) {
  // This method removes any errors that are in the ignore errors list
  // This list is imported from the file _link_checker_sc/ignore_errors.json

  // Currently it is the pages to output, as listed in the options.files to output.
  logFunction(`Function: filterIgnoreErrors(${errors})`);
  const errorFile = path.join(
    sharedData.options.root,
    "./_link_checker_sc/ignore_errors.json"
  );

  try {
    //sharedData.IgnoreErrors = require('./_link_checker_sc/ignore_errors.json');
    const ignoreFromFile = fs.readFileSync(errorFile);
    sharedData.IgnoreErrors = JSON.parse(ignoreFromFile);
    //sharedData.options.log.includes("quick")    ? console.log(sharedData.IgnoreErrors)     : null;
  } catch (error) {
    sharedData.IgnoreErrors = [];
    sharedData.options.log.includes("quick")
      ? console.log("Error loading IgnoreErrors")
      : null;
    sharedData.options.log.includes("quick") ? console.log(error) : null;
  }

  const filteredErrors = errors.filter((error) => {
    let returnValue = true; //All items are not filtered, by default.
    sharedData.IgnoreErrors.forEach((ignorableError) => {
      if (
        error.type === ignorableError.type &&
        normalize(error.fileRelativeToRoot) === normalize(ignorableError.fileRelativeToRoot)
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
    });
    //if (returnValue ==false) console.log(error);
    return returnValue;
  });

  return filteredErrors;
}

function filterErrors(errors) {
  // This method filters all errors against settings in the command line
  // Currently it is the pages to output, as listed in the options.files to output.
  logFunction(`Function: filterErrors(${errors})`);

  let filteredErrors = errors;
  // Filter results on specified file names (if any specified)
  //console.log(`Number pages to filter: ${sharedData.options.files.length}`);
  if (sharedData.options.files.length > 0) {
    //console.log(`USharedFileslength: ${sharedData.options.files.length}`);
    filteredErrors = errors.filter((error) => {
      //console.log(`UError: ${error}`);
      //console.log(JSON.stringify(error, null, 2));
      //console.log(`UError file: ${error.file}`);
      const filterResult = sharedData.options.files.includes(error.file);
      return filterResult;
    });
  }
  // Filter on other things - such as errors.

  //console.log(filteredErrors);
  return filteredErrors;
}

export { filterErrors, filterIgnoreErrors };
