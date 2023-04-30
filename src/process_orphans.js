import { logToFile } from "./helpers.js";
import path from "path";
import { sharedData } from "./shared_data.js";
import { PageNotInTOCError, PageNotLinkedInternallyError } from "./errors.js";


// Gets page with most links. Supposed to be used on the allResults object that is an array of objects about each page.
// Will use to get the summary.
function getPageWithMostLinks(pages) {
  if (sharedData.options.log.includes("functions")) {
    console.log("Function: getPageWithMostLinks");
  }
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
function checkPageOrphans(results) {
  const resultObj = {};
  const allInternalAbsLinks = [];

  //Create result object that has page as property
  // And value is an array of links in/from that page converted to absolute.
  results.forEach((obj) => {
    const filePath = obj.page_file;
    const relativeLinks = obj.relativeLinks;
    const absLinks = [];

    relativeLinks.forEach((linkObj) => {
      const linkUrl = linkObj.url;
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
      } else if (obj.page_file === sharedData.options.toc) {
        //do nothing
      } else {
        //if it a redirect file then it shouldn't be linked.
        allFilesNoReference.push(filePath);
        //console.log(`File "${filePath}" not referenced by any absolute link`);
        
        const error = new PageNotLinkedInternallyError({file: obj.page_file});
        results.allErrors.push(error);
        allFilesReferenced = false;
      }
    }

    const summaryFileLinks = resultObj[sharedData.options.toc];

    if (summaryFileLinks && !summaryFileLinks.some((absLink) => absLink === filePath)) {
      if (obj.redirectTo) {
        // do nothing /-if it a redirect file then it shouldn't be linked.
		//console.log(`EXECUTED: ${obj.page_file} in redirect`)
      } else if (obj.page_file === sharedData.options.toc) {
        //do nothing - summary shouldt be error for summary.
      } else {
        
        allFilesNoSummaryReference.push(filePath);
        const error = new PageNotInTOCError({file: obj.page_file});

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

  if (sharedData.options.log.includes("quick")) {
    //console.log(resultObj);
    const jsonFilesWithAbsoluteLinks = JSON.stringify(resultObj, null, 2);
    logToFile(
      "./logs/pagesResolvedAbsoluteLinks.json",
      jsonFilesWithAbsoluteLinks
    );
  }
}

export { checkPageOrphans, getPageWithMostLinks };
