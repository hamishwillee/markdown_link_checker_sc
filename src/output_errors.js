//Function that generates console and/or log output from an array of error objects.
// - `results` is an array of error objects. These will have a `type` and a `page`. They may also have other values, depending on type of error - such as linkurl
// - `options` has following properties:
//   - files: An array of file paths to filter errors by
//   - root: A string representing the root directory of the files.
//   - directory: A string representing file directory that is searched for files if not the root.
//   - toc: A string indicating the table of contents file or summarry file. ?

function outputErrors(results, options) {
  //console.log(results);

  //Sort results by page and type.
  // Perhaps next step is to create only get info for particular pages.
  const sortedByPageErrors = {};

  for (const error of results) {
    //Report errors for listed pages or all
    //console.log("error:");
    //console.log(error);
    //console.log(error.page);
    if (!sortedByPageErrors[error.page]) {
      sortedByPageErrors[error.page] = [];
    }
    sortedByPageErrors[error.page].push(error);

    // Sort by type as well.
    for (const page in sortedByPageErrors) {
      sortedByPageErrors[page].sort((a, b) => a.type.localeCompare(b.type));
    }
  }

  //console.log(sortedByPageErrors);
  for (const page in sortedByPageErrors) {
    let pageFromRoot;
    if (options.root) {
      pageFromRoot = page.split(options.root)[1];
    } else {
      pageFromRoot = page.split(options.directory)[1];
    }

    console.log(`\n${pageFromRoot}`);
    for (const error of sortedByPageErrors[page]) {
      if (error.type == "InternalLinkMissingFile") {
        console.log(`- ${error.type}: ${error.linkUrl}`);
        //console.log(`  ${error.type}: ${error.linkAnchor}, linkURL: ${error.linkUrl}`);
        // { "type": "InternalLinkMissingFile", "page": `${page.page_file}`, "linkUrl": `${link.linkUrl}`, "linkText": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}` };
      } else if (error.type == "LocalMissingAnchor") {
        // missing anchor in linked file that exists.
        //console.log(error);
        //console.log(          `- ${error.type}: ` +            "`[" +            `${error.linkText}](#${error.linkAnchor})` +            "` (Internal link without matching heading name or element id)"        );
        console.log(
          `- ${error.type}: ` +
            "`[" +
            `${error.linkText}](#${error.linkAnchor})` +
            "`: anchor doesn't match any heading id or element id"
        );
        //console.log(          `- ${error.type}: #${error.linkAnchor} (Internal link without matching heading name or element id)`        );
        //console.log(`  ${error.type}: #${error.linkAnchor} (heading/anchor missing?)`);
        //console.log(`  #${error.linkAnchor} - Internal anchor not found`);
        //console.log(`  [${error.linkText}](#${error.linkAnchor}) - Anchor not found`);
        //console.log(`  Internal anchor not found: #${error.linkAnchor} `);
        // `{ "type": "LocalMissingAnchor", "page": "${page.page_file}", "anchor": "${link.linkAnchor}", "linktext", "${link.linkText}"  }`;
      } else if (error.type == "InternalMissingAnchor") {
        // missing anchor in linked file that exists.
        //console.log(error);
        console.log(
          `- ${error.type}: #${error.linkAnchor} not found in ${error.linkUrlFilePath}`
        );
        //console.log(`  ${error.type}: #${error.linkAnchor} (heading/anchor missing?)`);
        //console.log(`  #${error.linkAnchor} - Internal anchor not found`);
        //console.log(`  [${error.linkText}](#${error.linkAnchor}) - Anchor not found`);
        //console.log(`  Internal anchor not found: #${error.linkAnchor} `);
        // { "type": "InternalMissingAnchor", "page": `${page.page_file}`, "linkAnchor": `${link.linkAnchor}`, "linkUrl": `${link.linkUrl}`, "linktext": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}` };
      } else if (error.type == "InternalLinkToHTML") {
        console.log(`- ${error.type}: ${error.linkUrl} (should be ".md"?)`);
        //console.log(`  ${error.type}: linkURL: ${error.linkUrl} ends in ".html"`);
        // { "type": "InternalLinkToHTML", "page": `${page.page_file}`, "linkUrl": `${link.linkUrl}`, "linkText": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}`  };
      } else if (error.type == "PageNotLinkedFromSummary") {
        console.log(`- ${error.type}: Page must be in ${options.toc}`);
        //console.log(`  ${error.type}: linkURL: ${error.linkUrl} ends in ".html"`);
        // { "type": "InternalLinkToHTML", "page": `${page.page_file}`, "linkUrl": `${link.linkUrl}`, "linkText": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}`  };
      } else if (error.type == "PageNotLinkedInternally") {
        console.log(
          `- ${error.type}: Page is orphan (not linked by any other page)`
        );
        //console.log(`  ${error.type}: linkURL: ${error.linkUrl} ends in ".html"`);
        // { "type": "InternalLinkToHTML", "page": `${page.page_file}`, "linkUrl": `${link.linkUrl}`, "linkText": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}`  };
      } else if (error.type == "MissingLocalImage") {
        console.log(
          `- ${error.type}: Linked image not found in file system: ${error.linkUrl}`
        );
        //console.log(`  ${error.type}: linkURL: ${error.linkUrl} ends in ".html"`);
        // { "type": "InternalLinkToHTML", "page": `${page.page_file}`, "linkUrl": `${link.linkUrl}`, "linkText": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}`  };
      } else if (error.type == "UrlToLocalSite") {
        console.log(
          `- ${error.type}: Link is URL but should be a relative link: \\[${error.linkText}](${error.linkUrl})`
        );
        //console.log(`  ${error.type}: linkURL: ${error.linkUrl} ends in ".html"`);
        // { "type": "InternalLinkToHTML", "page": `${page.page_file}`, "linkUrl": `${link.linkUrl}`, "linkText": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}`  };
      } else {
        console.log(`UNKKOWN ERROR:`);
        console.log(error);
      }
    }
    //console.log(page)
    //console.log(page.errors);
  }
}

export { outputErrors };
