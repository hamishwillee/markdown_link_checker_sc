#!/usr/bin/env node

//const fs = require("fs");
import fs from "fs";
import path from "path";
//const path = require("path");
import { program } from "commander";
//const { program } = require("commander");
import { logToFile } from "./src/helpers.js";
import { outputErrors } from "./src/output_errors.js";

import { slugifyVuepress } from "./src/slugify.js";
import { processMarkdown } from "./src/process_markdown.js";
import { processRelativeLinks } from "./src/process_relative_links.js";
import { processLocalImageLinks } from "./src/process_local_image_links.js";
import { processUrlsToLocalSource } from "./src/process_internal_url_links.js";
import { checkSummaryOrphans, getPageWithMostLinks } from "./src/process_orphans.js";


program
  .option(
    "-r, --root <path>",
    "Root directory of your source (i.e. root of github repo). Use -d as well to specify a folder if docs are not in the root, or to just run on particular subfolder",
    process.cwd()
  )
  .option(
    "-d, --directory [directory]",
    "The directory to search for markdown and html files, relative to root - such as: `en` for an English subfolder. Default empty (same as -r directory)",
    ""
  )
  .option(
    "-c, --headingAnchorSlugify [value]",
    "Slugify approach for turning markdown headings into heading anchors. Currently support vuepress only and always",
    "vuepress"
  )
  .option(
    "-t, --tryMarkdownforHTML [value]",
    "Try a markdown file extension check if a link to HTML fails.",
    true
  )
  .option(
    "-l, --log <types...>",
    "Export logs for debugging. Types: allerrors, filterederrors, allresults etc."
  )
  .option(
    "-f, --files <path>",
    "JSON file with array of files to report on (default is all files). Paths are relative relative to -d by default, but -r can be used to set a different root.",
    ""
  )

  .option(
    "-s, --toc [value]",
    "full filename of TOC/Summary file in file system. If not specified, inferred from file with most links to other files"
  )
  .option(
    "-u, --site_url [value]",
    "Site base url in form dev.example.com (used to catch absolute urls to local files)"
  )

  .parse(process.argv);

// TODO PX4 special parsing - errors or pages we exclude by default.
// Particular error types on particular pages?

const options = program.opts();
options.log ? null : (options.log = []);

const markdownDirectory = path.join(options.root, options.directory);
if (options.log == "fast") {
  console.log(`MARKDOWN DIR ${markdownDirectory}`);
}

async () => {
  // Load JSON file containing file paths and reassign as array to the JSON path
  options.files
    ? (options.files = await loadJSONFileToReportOn(options.files))
    : (options.files = []);
  if (options.log == "quick") {
    for (const file of options.files) {
      console.log(file);
    }
  }
};

// Function for loading JSON file that contains files to report on
async function loadJSONFileToReportOn(filePath) {
  try {
    const fileContent = await fs.promises.readFile(filePath, "utf8");
    let filesArray = JSON.parse(fileContent);
    // Array relative to root, so update to have full path
    filesArray = filesArray.map((str) => path.join(options.root, str));

    //console.log(filesArray);
    return filesArray;
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    process.exit(1);
  }
}

const isMarkdown = (file) => path.extname(file).toLowerCase() === ".md";
const isHtml = (file) => path.extname(file).toLowerCase() === ".html";
const replaceDelimiter = (str, underscore) =>
  underscore ? str.replace(/\s+/g, "_") : str.replace(/\s+/g, "-");

const processFile = async (file, options) => {
  try {
    const contents = await fs.promises.readFile(file, "utf8");
    const resultsForFile = processMarkdown(contents, options);
    resultsForFile["page_file"] = file;

    // Call slugify slugifyVuepress() on each of the headings
    // Update resultsForFile[''] with values
    // return slugifyVuepress(matches[1]);
    const anchorArray = [];
    resultsForFile.headings.forEach((item) => {
      anchorArray.push(slugifyVuepress(item));
    });
    resultsForFile["anchors_auto_headings"] = anchorArray;
    //console.log(resultsForFile);

    return resultsForFile;
  } catch (err) {
    console.error(`Error processing file ${file}: ${err.message}`);
    console.error(err);
    return null;
  }
};

const processDirectory = async (dir, options) => {
  if (options.log.includes("functions")) {
    console.log(`processDirectory(${dir}, options)`);
  }
  const files = await fs.promises.readdir(dir, { withFileTypes: true });
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = path.join(dir, files[i].name);
    if (files[i].isDirectory()) {
      const subResults = await processDirectory(file, options);
      results.push(...subResults);
    } else if (isMarkdown(file) || isHtml(file)) {
      const result = await processFile(file, options);
      if (result) {
        results.push(result);
      }
    }
  }
  return results;
};



function filterErrors(errors) {
  // This method filters all errors against settings in the command line - such as pages to output.
  let filteredErrors = errors;
  // Filter results on specified file names (if any specified)
  //console.log(`Number pages to filter: ${options.files.length}`);
  if (options.files.length > 0) {
    filteredErrors = errors.filter((error) => {
      //console.log(`Error: ${error}`);
      //console.log(JSON.stringify(error, null, 2));
      //console.log(`Error page: ${error.page}`);

      return options.files.includes(error.page);
    });
  }
  // Filter on other things - such as errors.

  //console.log(filteredErrors);
  return filteredErrors;
}

//main function, after options et have been set up.
(async () => {
  // process  containing markdown, return results which includes links, headings, id anchors
  const results = await processDirectory(markdownDirectory, options);

  const errorsFromRelativeLinks = processRelativeLinks(results, options);
  if (!results.allErrors) {
    results.allErrors = [];
  }
  results["allErrors"].push(...errorsFromRelativeLinks);

  const errorsFromLocalImageLinks = await processLocalImageLinks(
    results,
    options
  );
  //console.log(errorsFromLocalImageLinks)
  results["allErrors"].push(...errorsFromLocalImageLinks);

  const errorsFromUrlsToLocalSite = await processUrlsToLocalSource(
    results,
    options
  );
  //console.log(errorsFromUrlsToLocalSite)
  results["allErrors"].push(...errorsFromUrlsToLocalSite);

  //Can now guess the summary file if not specified
  options.toc ? null : (options.toc = getPageWithMostLinks(results, options));
  checkSummaryOrphans(results, options);
  const filteredResults = filterErrors(results.allErrors);

  outputErrors(filteredResults, options);

  //make array and document options? ie. if includes ...
  const jsonFilteredErrors = JSON.stringify(filteredResults, null, 2);
  logToFile("./logs/filteredErrors.json", jsonFilteredErrors);

  if (options.log.includes("filterederrors")) {
    console.log(jsonFilteredErrors);
  }

  //make array and document options? ie. if includes ...
  const jsonAllResults = JSON.stringify(results, null, 2);
  logToFile("./logs/allResults.json", jsonAllResults);
  if (options.log.includes("allresults")) {
    console.log(jsonAllResults);
  }

  //make array and document options? ie. if includes ...
  const jsonAllErrors = JSON.stringify(results.allErrors, null, 2);
  logToFile("./logs/allErrors.json", jsonAllErrors);

  if (options.log.includes("allerrors")) {
    console.log(jsonAllErrors);
  }
  //console.log(`OPTIONS.LOG ${options.log}`);
})();

//OpenQuestions
// Handle page link to #itself
