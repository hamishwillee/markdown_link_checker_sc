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
  .parse(process.argv);

// TODO PX4 special parsing - errors or pages we exclude by default.
// Particular error types on particular pages?

const options = program.opts();
options.log ? null : (options.log = []);

const markdownDirectory = path.join(options.root, options.directory);
console.log(`MARKDOWN DIR ${markdownDirectory}`);

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

const processFile = async (file, slugifyApproach) => {
  try {
    const contents = await fs.promises.readFile(file, "utf8");
    const resultsForFile = processMarkdown(contents);
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

const processDirectory = async (dir, slugifyApproach) => {
  const files = await fs.promises.readdir(dir, { withFileTypes: true });
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = path.join(dir, files[i].name);
    if (files[i].isDirectory()) {
      const subResults = await processDirectory(file, slugifyApproach);
      results.push(...subResults);
    } else if (isMarkdown(file) || isHtml(file)) {
      const result = await processFile(file, slugifyApproach);
      if (result) {
        results.push(result);
      }
    }
  }
  return results;
};

// Gets page with most links. Supposed to be used on the allResults object that is an array of objects about each page.
// Will use to get the summary.
function getPageWithMostLinks(pages) {
  return pages.reduce(
    (maxLinksPage, currentPage) => {
      if (
        currentPage.relativeLinks.length > maxLinksPage.relativeLinks.length
      ) {
        return currentPage;
      } else {
        return maxLinksPage;
      }
    },
    { relativeLinks: [] }
  ).page_file;
}

// Get any orphans (no links from summary and no links at all)
//
function checkSummaryOrphans(results) {
  const resultObj = {};
  const allInternalAbsLinks = [];

  //Create result object that has page as property
  // And value is an array of links in/from that page converted to absolute.
  results.forEach((obj) => {
    const filePath = obj.page_file;
    const relativeLinks = obj.relativeLinks;
    const absLinks = [];

    relativeLinks.forEach((linkObj) => {
      const linkUrl = linkObj.linkUrl;
      const absLink = path.resolve(path.dirname(filePath), linkUrl);
      absLinks.push(absLink);
      allInternalAbsLinks.push(absLink);
    });

    resultObj[filePath] = absLinks;
  });

  // Invert resultObj to get all objects to link to page.
  // Add the links to to the big results object we process later.
  const pagesObj = {};
  for (const [page, links] of Object.entries(resultObj)) {
    for (const link of links) {
      if (!pagesObj[link]) {
        pagesObj[link] = [];
      }
      pagesObj[link].push(page);
    }
  }
  results.forEach((obj) => {
    obj["linkedFrom"] = pagesObj[obj.page_file];
  });

  // Check that every filepath has at least one object in some absLink that matches it
  let allFilesReferenced = true;
  let allFilesSummaryReferenced = true;
  const allFilesNoReference = [];
  const allFilesNoSummaryReference = [];
  results.forEach((obj) => {
    const filePath = obj.page_file;
    if (!allInternalAbsLinks.some((absLink) => absLink === filePath)) {
      if (obj.redirectTo) {
        //do nothing
      } else if (obj.page_file === options.toc) {
        //do nothing
      } else {
        //if it a redirect file then it shouldn't be linked.
        allFilesNoReference.push(filePath);
        //console.log(`File "${filePath}" not referenced by any absolute link`);
        const error = {
          type: "PageNotLinkedInternally",
          page: `${obj.page_file}`,
        };
        results.allErrors.push(error);
        allFilesReferenced = false;
      }
    }

    const summaryFileLinks = resultObj[options.toc];

    if (!summaryFileLinks.some((absLink) => absLink === filePath)) {
      if (obj.redirectTo) {
        // do nothing
      } else if (obj.page_file === options.toc) {
        //do nothing
      } else {
        //if it a redirect file then it shouldn't be linked.
        allFilesNoSummaryReference.push(filePath);
        //console.log(`File "${filePath}" not referenced in summary.md`);
        const error = {
          type: "PageNotLinkedFromSummary",
          page: `${obj.page_file}`,
        };
        if (!results.allErrors) {
          results["allErrors"] = [];
        }
        results.allErrors.push(error);
        allFilesSummaryReferenced = false;
      }
    }
  });

  if (!allFilesReferenced) {
    const jsonAllFilesNotReferenced = JSON.stringify(
      allFilesNoReference,
      null,
      2
    );
    logToFile("./logs/allFilesNoReference.json", jsonAllFilesNotReferenced);
  } else {
    //console.log("All files referenced at least once");
  }

  if (!allFilesSummaryReferenced) {
    const jsonAllFilesNotSummaryReferenced = JSON.stringify(
      allFilesNoSummaryReference,
      null,
      2
    );
    logToFile(
      "./logs/allFilesNoSummaryReference.json",
      jsonAllFilesNotSummaryReferenced
    );
  } else {
    //console.log("All files referenced at least once");
  }

  if (options.log.includes("quick")) {
    //console.log(resultObj);
    const jsonFilesWithAbsoluteLinks = JSON.stringify(resultObj, null, 2);
    logToFile(
      "./logs/pagesResolvedAbsoluteLinks.json",
      jsonFilesWithAbsoluteLinks
    );
  }
}

function processRelativeLinks(results) {
  if (!results.allErrors) {
    results["allErrors"] = [];
  }
  results.forEach((page, index, array) => {
    //console.log(page);

    page.relativeLinks.forEach((link, index, array) => {
      //console.log(link);
      //resolve the path for the link
      const page_rel_path = page.page_file.split(options.directory)[1];
      if (link.linkUrl === "") {
        //page local link - check current page for headings
        //console.log(link);

        if (
          page.anchors_auto_headings.includes(link.linkAnchor) ||
          page.anchors_tag_ids.includes(link.linkAnchor)
        ) {
          //do nothing - we're good
        } else {
          const error = {
            type: "LocalMissingAnchor",
            page: `${page.page_file}`,
            linkAnchor: `${link.linkAnchor}`,
            linkText: `${link.linkText}`,
          };

          results.allErrors.push(error);
          //console.log(error);
          //console.log( `ERROR: ${page_rel_path}: Missing local anchor [${link.linkText}](#${link.linkAnchor})` );
        }
      } else {
        // relative link on another page.

        //find the path of the linked page.
        const linkAbsoluteFilePath = path.resolve(
          path.dirname(page.page_file),
          link.linkUrl
        );

        // Get the matching file matching our link, if it exists
        let linkedFile =
          results.find(
            (linkedFile) =>
              linkedFile.hasOwnProperty("page_file") &&
              path.normalize(linkedFile.page_file) === linkAbsoluteFilePath
          ) || null;

        if (!linkedFile) {
          if (
            options.tryMarkdownforHTML &&
            linkAbsoluteFilePath.endsWith(".html")
          ) {
            // The file was HTML so it might be a file extension mistake (linking to html instead of md)
            // In this case we'll try find it.

            const markdownAbsoluteFilePath = `${
              linkAbsoluteFilePath.split(".html")[0]
            }.md`;
            const linkedHTMLFile =
              results.find(
                (linkedHTMLFile) =>
                  linkedHTMLFile.hasOwnProperty("page_file") &&
                  path.normalize(linkedHTMLFile.page_file) ===
                    markdownAbsoluteFilePath
              ) || null;

            if (linkedHTMLFile) {
              const error = {
                type: "InternalLinkToHTML",
                page: `${page.page_file}`,
                linkUrl: `${link.linkUrl}`,
                linkText: `${link.linkText}`,
                linkUrlFilePath: `${linkAbsoluteFilePath}`,
              };
              results.allErrors.push(error);
              // console.log(`: ${page_rel_path}: WARN: Link to .html not .md '${link.linkUrl}' with text '${link.linkText}' (${linkAbsoluteFilePath} )` );
              linkedFile = linkedHTMLFile;
            }
          }
        }

        if (!linkedFile) {
          //File not found as .html or md
          const error = {
            type: "InternalLinkMissingFile",
            page: `${page.page_file}`,
            linkUrl: `${link.linkUrl}`,
            linkText: `${link.linkText}`,
            linkUrlFilePath: `${linkAbsoluteFilePath}`,
          };
          results.allErrors.push(error);
          // console.log(`ERROR: ${page_rel_path}: ERROR Broken rel. link '${link.linkUrl}' with text '${link.linkText}' (${linkAbsoluteFilePath} )` );
        } else {
          // There is a link, so now see if there are anchors, and whether they work
          if (!link.linkAnchor) {
            //null
            return;
          } else if (
            linkedFile.anchors_auto_headings.includes(link.linkAnchor) ||
            linkedFile.anchors_tag_ids.includes(link.linkAnchor)
          ) {
            //
            //do nothing - we're good
          } else {
            // Link exists, but anchor broken

            const link_rel_path = linkedFile.page_file.split(
              options.directory
            )[1];
            const error = {
              type: "InternalMissingAnchor",
              page: `${page.page_file}`,
              linkAnchor: `${link.linkAnchor}`,
              linkUrl: `${link.linkUrl}`,
              linkText: `${link.linkText}`,
              linkUrlFilePath: `${linkAbsoluteFilePath}`,
            };
            results.allErrors.push(error);
            //console.log( `WARN: ${page_rel_path}: Missing anchor \`${link.linkAnchor}\` linked in '${link_rel_path}' (linkText '${link.linkText}')` );
            //console.log(`ERRORS CAUSED BY INCORRECT GUESS ABOUT FORMAT OF / in the new URL - e.g. mounting/orientation`)
          }
        }
      }
    });
  });
}

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
  const results = await processDirectory(
    markdownDirectory,
    options.headingAnchorSlugify
  );

  processRelativeLinks(results);

  //Can now guess the summary file if not specified
  options.toc ? null : (options.toc = getPageWithMostLinks(results));
  checkSummaryOrphans(results);
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
