//import { /*LinkError,*/ CurrentFileMissingAnchorError, LinkedFileMissingAnchorError, LinkedInternalPageMissingError, InternalLinkToHTMLError, UrlToLocalSiteError} from "./errors.js"

import { sharedData } from "./shared_data.js";


//Function that generates console and/or log output from an array of error objects.
// - `results` is an array of error objects. These will have a `type` and a `page`. They may also have other values, depending on type of error - such as linkurl
function outputErrors(results) {
  //console.log(results);

  //Sort results by page and type.
  // Perhaps next step is to create only get info for particular pages.
  const sortedByPageErrors = {};

  for (const error of results) {
    //Report errors for listed pages or all
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
    if (sharedData.options.root) {
      pageFromRoot = page.split(sharedData.options.root)[1];
    } else {
      pageFromRoot = page.split(sharedData.options.directory)[1];
    }

    console.log(`\n${pageFromRoot}`); //Root needs to full path - not '.' or whatever
    for (const error of sortedByPageErrors[page]) {
      if (error.output) {
        console.log("OUTPUT FROM ERROR OBJECT")
        error.output();
      }
      console.log("OUTPUT FROM OLD STYLE OBJECT")
      if (error.type == "LinkedInternalPageMissing") {
        //console.log(`- ${error.type}: ${error.linkUrl}`);
        //console.log(`  ${error.type}: ${error.linkAnchor}, linkURL: ${error.linkUrl}`);
        // { "type": "LinkedInternalPageMissing", "page": `${page.page_file}`, "linkUrl": `${link.linkUrl}`, "linkText": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}` };
      } else if (error.type == "CurrentFileMissingAnchor") {
        // missing anchor in linked file that exists.
        //console.log(error);
        //console.log(          `- ${error.type}: ` +            "`[" +            `${error.linkText}](#${error.linkAnchor})` +            "` (Internal link without matching heading name or element id)"        );
        //console.log( `- ${error.type}: ` + "`[" + `${error.linkText}](#${error.linkAnchor})` + "`: anchor doesn't match any heading id or element id" );
        // `{ "type": "CurrentFileMissingAnchor", "page": "${page.page_file}", "anchor": "${link.linkAnchor}", "linktext", "${link.linkText}"  }`;
      } else if (error.type == "LinkedFileMissingAnchor") {
        // missing anchor in linked file that exists.
        console.log(
          `- ${error.type}: #${error.linkAnchor} not found in ${error.linkUrlFilePath}`
        );
        // { "type": "LinkedFileMissingAnchor", "page": `${page.page_file}`, "linkAnchor": `${link.linkAnchor}`, "linkUrl": `${link.linkUrl}`, "linktext": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}` };
      } else if (error.type == "InternalLinkToHTML") {
        console.log(`- ${error.type}: ${error.linkUrl} (should be ".md"?)`);
        //console.log(`  ${error.type}: linkURL: ${error.linkUrl} ends in ".html"`);
        // { "type": "InternalLinkToHTML", "page": `${page.page_file}`, "linkUrl": `${link.linkUrl}`, "linkText": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}`  };
      } else if (error.type == "PageNotInTOC") {
        console.log(
          `- ${error.type}: Page not in Table of Contents (${sharedData.options.toc})`
        );
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
        //console.log( `- ${error.type}: Link is URL but should be a relative link: \\[${error.linkText}](${error.linkUrl})` );
        //console.log(`  ${error.type}: linkURL: ${error.linkUrl} ends in ".html"`);
        // { "type": "InternalLinkToHTML", "page": `${page.page_file}`, "linkUrl": `${link.linkUrl}`, "linkText": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}`  };
      } else if (error.type == "OrphanedImage") {
        console.log(
          `- ${error.type}: Image not linked from docs: ${error.page})`
        );
        //console.log(`  ${error.type}: linkURL: ${error.linkUrl} ends in ".html"`);
        // { "type": "InternalLinkToHTML", "page": `${page.page_file}`, "linkUrl": `${link.linkUrl}`, "linkText": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}`  };
      } else {
        console.log(`UNKKOWN ERROR:`);
        console.log(error);
      }
    }
  }
}

export { outputErrors };
