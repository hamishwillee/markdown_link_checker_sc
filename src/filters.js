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

  // Split entries into active and expired based on optional expiry field.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activeEntries = [];
  const expiredEntries = [];
  ignoreErrors.forEach((entry) => {
    if (entry.expiry) {
      const expiryDate = new Date(entry.expiry);
      expiryDate.setHours(0, 0, 0, 0);
      if (expiryDate < today) {
        expiredEntries.push(entry);
      } else {
        activeEntries.push(entry);
      }
    } else {
      activeEntries.push(entry);
    }
  });

  if (expiredEntries.length > 0) {
    expiredEntries.forEach((entry) => {
      const url = entry.link?.url ?? "(no url)";
      console.log(`Ignore entry expired: ${url} (expired: ${entry.expiry})`);
      entry.expired = true;
    });
    try {
      fs.writeFileSync(errorFile, JSON.stringify([...activeEntries, ...expiredEntries], null, 2));
    } catch (writeError) {
      console.error(`Failed to write updated ignore file: ${writeError.message}`);
    }
  }

  function matchesIgnoreEntry(error, ignorableError) {
    if (
      error.type === ignorableError.type &&
      normalize(error.fileRelativeToRoot) ===
        normalize(ignorableError.fileRelativeToRoot)
    ) {
      if (!(error.link && ignorableError.link)) return true;
      if (error.link && ignorableError.link && error.link.url === ignorableError.link.url) return true;
    }
    // URL-only match: ignore entry has no type/file, just a link.url — suppress globally
    if (
      !ignorableError.type &&
      !ignorableError.fileRelativeToRoot &&
      error.link &&
      ignorableError.link &&
      error.link.url === ignorableError.link.url
    ) {
      return true;
    }
    return false;
  }

  const filteredErrors = errors.filter((error) => {
    return !activeEntries.some((ignorableError) => matchesIgnoreEntry(error, ignorableError));
  });

  // Annotate errors that match an expired entry so output can show context.
  if (expiredEntries.length > 0) {
    filteredErrors.forEach((error) => {
      const match = expiredEntries.find((e) => matchesIgnoreEntry(error, e));
      if (match) error.previouslyIgnored = match;
    });
  }

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
