#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { sharedData } from "./src/shared_data.js";
//const path = require("path");
import { program } from "commander";
//const { program } = require("commander");
import {
  logFunction,
  logToFile,
  isMarkdown,
  isHTML,
  isImage,
} from "./src/helpers.js";

import { outputErrors } from "./src/output_errors.js";

import { slugifyVuepress } from "./src/slugify.js";
import { processMarkdown } from "./src/process_markdown.js";
import { processRelativeLinks } from "./src/process_relative_links.js";
import { checkLocalImageLinks } from "./src/process_local_image_links.js";
import { processUrlsToLocalSource } from "./src/process_internal_url_links.js";
import {
  checkPageOrphans,
  getPageWithMostLinks,
} from "./src/process_orphans.js";
import { checkImageOrphansGlobal } from "./src/process_image_orphans.js";
import { filterErrors, filterIgnoreErrors } from "./src/filters.js";

program
  .option(
    "-r, --repo <path>",
    "Repo root directory. Defaults to current directory. Everything resolved relative to this.)",
    ""
  )
  .option(
    "-d, --doc [directory]",
    "Docs root directory, relative to -g (such as `docs`). Defaults to '' (all docs in root of repo). Use -d as well to restrict search to a particular subfolder. Defaults to current directory.",
    process.cwd()
  )
  .option(
    "-e, --subdir [directory]",
    "A subfolder of the docs root (-d) to search for markdown and html files. Such as: `en` for an English subfolder. Default empty (same as -d directory)",
    ""
  )
  .option(
    "-i, --imagedir [directory]",
    "The directory to search for all image files for global orphan checking, relative docs root (-d) - such as: `assets` or `en`. Default empty if not explicitly set, and global orphan checking will not be done",
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
    "Types of console logs to display logs for debugging. Types: functions, todo etc."
  )
  .option(
    "-f, --files <path>",
    "JSON file with array of files to report on (default is all files). JSON paths are usually relative to git repo root `-r`.",
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
  .option("-o, --logtofile [value]", "Output logs to file", true)
  .option(
    "-p, --interactive [value]",
    "Interactively add errors to the ignore list at <repo>/_link_checker_sc/ignore_errors.json",
    false
  )
  .option(
    //This doesn't work. Dunno why - does for other cases!
    "-c, --anchor_in_heading [value]",
    "Detect anchors in heading such as: # Heading {#anchor}",
    true
  )
  .parse(process.argv);

// TODO PX4 special parsing - errors or pages we exclude by default.
// Particular error types on particular pages?

//const options = program.opts();
sharedData.options = program.opts();
sharedData.options.log ? null : (sharedData.options.log = []);
sharedData.allMarkdownFiles = new Set([]);
sharedData.allHTMLFiles = new Set([]);
sharedData.allImageFiles = new Set([]);
sharedData.allOtherFiles = new Set([]);

//console.log(`debug: sharedData.options.repo: ${sharedData.options.repo}`);
//console.log(`debug: sharedData.options.doc: ${sharedData.options.doc}`);
//console.log(`debug: sharedData.options.subdir: ${sharedData.options.subdir}`);

sharedData.options.docsroot = path.join(
  sharedData.options.repo,
  sharedData.options.doc
);

// Markdown directory we are actually checking
sharedData.options.markdownroot = path.join(
  sharedData.options.docsroot,
  sharedData.options.subdir
);

//console.log(`debug: sharedData.options.repo: ${sharedData.options.repo}`);
//console.log(`debug: sharedData.options.doc: ${sharedData.options.doc}`);
//console.log(`debug: sharedData.options.subdir: ${sharedData.options.subdir}`);
//console.log(`debug: sharedData.options.docsroot: ${sharedData.options.docsroot}`);
//console.log(`debug: sharedData.options.markdownroot: ${sharedData.options.markdownroot}`);

//process.exit(1);

// Function for loading JSON file that contains files to report on
async function loadJSONFileToReportOn(filePath) {
  sharedData.options.log.includes("functions")
    ? console.log(`Function: loadJSONFileToReportOn(): filePath: ${filePath}`)
    : null;
  sharedData.options.log.includes("quick")
    ? console.log(`Function: loadJSONFileToReportOn(): filePath: ${filePath}`)
    : null;
  try {
    const fileContent = await fs.promises.readFile(filePath, "utf8");
    let filesArray = JSON.parse(fileContent);
    // Array relative to root, so update to have full path
    filesArray = filesArray.map((str) =>
      path.join(sharedData.options.repo, str)
    );

    sharedData.options.log.includes("quick")
      ? console.log(`quick:filesArray: ${filesArray}`)
      : null;

    return filesArray;
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    //console.log(`Error reading file: ${error.message}`);
    process.exit(1);
  }
}

// Function for loading JSON file that contains files to ignore (such as _summary.md)
// This will be in _link_checker_sc/ignorelist.json relative to root.
async function loadJSONFileToIgnore(filePath) {
  sharedData.options.log.includes("functions")
    ? console.log(`Function: loadJSONFileToIgnore(): filePath: ${filePath}`)
    : null;
  sharedData.options.log.includes("quick")
    ? console.log(`Function: loadJSONFileToIgnore(): filePath: ${filePath}`)
    : null;
  try {
    const fileContent = await fs.promises.readFile(filePath, "utf8");
    let filesArray = JSON.parse(fileContent);
    if (filesArray.length == 0) {
      return [];
    } else {
      // Array relative to repo root, so update to have full path
      filesArray = filesArray.map((str) =>
        path.join(sharedData.options.docsroot, str)
      );
    }

    sharedData.options.log.includes("quick")
      ? console.log(`quick:filesArray: ${filesArray}`)
      : null;

    return filesArray;
  } catch (error) {
    //console.error(`Error reading file: ${error.message}`);
    console.log(`Error reading ignore file: ${error.message}`);
    return [];
    //process.exit(1);
  }
}

const replaceDelimiter = (str, underscore) =>
  underscore ? str.replace(/\s+/g, "_") : str.replace(/\s+/g, "-");

const processFile = async (file) => {
  sharedData.options.log.includes("functions")
    ? console.log(`Function: processFile(): file: ${file}`)
    : null;
  try {
    const contents = await fs.promises.readFile(file, "utf8");
    const resultsForFile = processMarkdown(contents, file);
    //console.log(resultsForFile);

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

const processDirectory = async (dir) => {
  sharedData.options.log.includes("functions")
    ? console.log(`Function: processDirectory(): dir: ${dir}`)
    : null;
  const files = await fs.promises.readdir(dir, { withFileTypes: true });
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = path.join(dir, files[i].name);
    //console.log(`XxxxXprocessDirectory: file: ${file}`);
    if (files[i].isDirectory()) {
      const subResults = await processDirectory(file);
      results.push(...subResults);
    } else if (sharedData.options.ignoreFiles.includes(file)) {
      // do nothing
      //console.log(`XxxxXignorelist: file: ${file}`);
    } else if (isMarkdown(file)) {
      sharedData.allMarkdownFiles.add(file);
      const result = await processFile(file);
      if (result) {
        results.push(result);
      }
    } else if (isHTML(file)) {
      sharedData.allHTMLFiles.add(file);
      const result = await processFile(file);
      if (result) {
        results.push(result);
      }
    } else if (isImage(file)) {
      sharedData.allImageFiles.add(file);
    } else {
      sharedData.allOtherFiles.add(file);
    }
  }
  return results;
};

//main function, after options et have been set up.
(async () => {
  sharedData.options.files
    ? (sharedData.options.files = await loadJSONFileToReportOn(
        sharedData.options.files
      ))
    : (sharedData.options.files = []);

  const pathToJsonIgnoreFile = path.join(
    sharedData.options.repo,
    sharedData.options.doc,
    "_link_checker_sc/ignorefile.json"
  );
  //console.log(`debug: pathToJsonIgnoreFile: ${pathToJsonIgnoreFile}`);
  sharedData.options.ignoreFiles = await loadJSONFileToIgnore(
    pathToJsonIgnoreFile
  );

  // process  containing markdown, return results which includes links, headings, id anchors
  const results = await processDirectory(sharedData.options.markdownroot);

  if (!results.allErrors) {
    results.allErrors = [];
  }

  // Add errors saved with page during page parsing.
  // Convenient to include with page earlier, but move into main errors item in results here.
  // (we could also just have a global errors and add to that, and share it round to wherever errors are done - might have been easier).
  const pageErrors = results.reduce((accumulator, page) => {
    if (page.errors) {
      accumulator.push(...page.errors);
    }
    return accumulator;
  }, []);

  results["allErrors"].push(...pageErrors);

  // Process just the relative links to find errors like missing files, anchors
  const errorsFromRelativeLinks = processRelativeLinks(results);

  results["allErrors"].push(...errorsFromRelativeLinks);

  // Process just images linked in local file system - find errors like missing images.
  const errorsFromLocalImageLinks = await checkLocalImageLinks(results);
  //console.log(errorsFromLocalImageLinks)
  results["allErrors"].push(...errorsFromLocalImageLinks);

  // Process links to current site URL - should be relative links normally.
  const errorsFromUrlsToLocalSite = await processUrlsToLocalSource(results);
  //console.log(errorsFromUrlsToLocalSite)
  results["allErrors"].push(...errorsFromUrlsToLocalSite);

  // Check for page orphans - markdown files not linked anywhere and not in summary.
  // Guesses the table of contents file if not specified in options.toc
  sharedData.options.toc
    ? null
    : (sharedData.options.toc = getPageWithMostLinks(results));
  checkPageOrphans(results); // Perhaps should follow pattern of returning errors - currently updates results

  const errorsGlobalImageOrphanCheck = await checkImageOrphansGlobal(results);
  results["allErrors"].push(...errorsGlobalImageOrphanCheck);

  // Filter the errors based on the settings in options.
  // At time of writing just filters on specific set of pages.
  let filteredResults = filterErrors(results.allErrors);
  // Filter out the ones we have indicated we want to ignore.
  filteredResults = filterIgnoreErrors(filteredResults);

  // Output the errors as console.logs
  outputErrors(filteredResults);

  //make array and document options? ie. if includes ...
  const jsonFilteredErrors = JSON.stringify(filteredResults, null, 2);
  logToFile("./logs/filteredErrors.json", jsonFilteredErrors);

  // Log filtered errors to standard out
  if (sharedData.options.log.includes("filterederrors")) {
    console.log(jsonFilteredErrors);
  }

  //make array and document options? ie. if includes ...
  const jsonAllResults = JSON.stringify(results, null, 2);
  logToFile("./logs/allResults.json", jsonAllResults);
  if (sharedData.options.log.includes("allresults")) {
    console.log(jsonAllResults);
  }

  //make array and document options? ie. if includes ...
  const jsonAllErrors = JSON.stringify(results.allErrors, null, 2);
  logToFile("./logs/allErrors.json", jsonAllErrors);

  if (sharedData.options.log.includes("allerrors")) {
    console.log(jsonAllErrors);
  }
  //console.log(`OPTIONS.LOG ${options.log}`);
})();

//OpenQuestions
// Handle page link to #itself
