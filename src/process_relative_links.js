import path from "path";
import {
  /*LinkError,*/ CurrentFileMissingAnchorError,
  LinkedFileMissingAnchorError,
  LinkedInternalPageMissingError,
  InternalLinkToHTMLError,
  UrlToLocalSiteError,
} from "./errors.js";
import { sharedData } from "./shared_data.js";

// An array of errors given a results object that contains our array of objects containing relativeLinks (and other information).
function processRelativeLinks(results) {
  sharedData.options.log.includes("functions")
    ? console.log("Function: processRelativeLinks")
    : null;
  const errors = [];

  //console.log(sharedData);

  results.forEach((page, index, array) => {
    //console.log(`PAGE:${JSON.stringify(page, null, 2)}`);

    page.relativeLinks.forEach((link, index, array) => {
      //console.log(`LINK: ${JSON.stringify(link, null, 2)}`);
      if (link.address === "") {
        // This is a page-local link
        // Verify the link goes to either heading or id defined in page.
        if (
          !(
            page.anchors_auto_headings.includes(link.anchor) ||
            page.anchors_tag_ids.includes(link.anchor)
          )
        ) {
          // There is no heading link to specified anchor in current page
          const error = new CurrentFileMissingAnchorError({ link: link });
          //console.log(`XXX_LMA_Error: ${JSON.stringify(error, null, 2)}`);
          errors.push(error);
        }
      } else {
        // This is a link to another page
        // See if that page is in our results
        // Report error if not. Otherwise check if anchor is in page.

        //find the path of the linked page.
        //console.log(`LINK: ${JSON.stringify(link, null, 2)}`);
        //console.log(`LINKADDRESS: ${link.address}`);

        const linkAbsoluteFilePath = link.getAbsolutePath();

        //console.log(link);

        // Get the matching file matching our link, if it exists
        let linkedFile =
          results.find(
            (linkedFile) =>
              linkedFile.hasOwnProperty("page_file") &&
              path.normalize(linkedFile.page_file) === linkAbsoluteFilePath
          ) || null;

        if (!linkedFile) {
          if (sharedData.options.tryMarkdownforHTML && link.isHTML) {
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
              const error = new InternalLinkToHTMLError({ link: link });
              //console.log(error);
              errors.push(error);
              linkedFile = linkedHTMLFile;
            }
          }
        }

        if (!linkedFile) {
          //File not found as .html or md
          const error = new LinkedInternalPageMissingError({ link: link });
          //console.log(error);
          errors.push(error);
        } else {
          // There is a linked file, so now see if there are anchors, and whether they work

          if (!link.anchor) {
            // No anchors, so go to next step
            //null
          } else if (
            //List of anchors in linked file includes the anchor
            linkedFile.anchors_auto_headings.includes(link.anchor) ||
            linkedFile.anchors_tag_ids.includes(link.anchor)
          ) {
            //
            //do nothing - the linked page includes the anchor from this link
          } else {
            // File exists but does not contain matching anchor
            const error = new LinkedFileMissingAnchorError({ link: link });
            errors.push(error);
          }
        }
      }
    });
  });
  return errors;
}

export { processRelativeLinks };
