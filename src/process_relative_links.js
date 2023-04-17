import path from "path";

// An array of errors given a results object that contains our array of objects containing relativeLinks (and other information).
// The options is used for explaining if it should fallback to HTML
function processRelativeLinks(results, options) {
  const errors = [];
  results.forEach((page, index, array) => {
    //console.log(`PAGE: ${page}`);

    page.relativeLinks.forEach((link, index, array) => {
      //console.log(`LINK: ${link}`);
      if (link.linkUrl === "") {
        // This is a page-local link
        // Verify the link goes to either heading or id defined in page.
        if (
          !(
            page.anchors_auto_headings.includes(link.linkAnchor) ||
            page.anchors_tag_ids.includes(link.linkAnchor)
          )
        ) {
          const error = {
            type: "LocalMissingAnchor",
            page: `${page.page_file}`,
            linkAnchor: `${link.linkAnchor}`,
            linkText: `${link.linkText}`,
          };

          errors.push(error);
        }
      } else {
        // This is a link to another page
        // See if that page is in our results
        // Report error if not. Otherwise check if anchor is in page.

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
              errors.push(error);
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
          errors.push(error);
        } else {
          // There is a linked file, so now see if there are anchors, and whether they work
          if (!link.linkAnchor) { // No anchors, so go to next step
            //null
          } else if ( //List of anchors in linked file includes the anchor
            linkedFile.anchors_auto_headings.includes(link.linkAnchor) ||
            linkedFile.anchors_tag_ids.includes(link.linkAnchor)
          ) {
            //
            //do nothing - we're good
          } else {
            // File exists but does not contain matching anchor
            const error = {
              type: "InternalMissingAnchor",
              page: `${page.page_file}`,
              linkAnchor: `${link.linkAnchor}`,
              linkUrl: `${link.linkUrl}`,
              linkText: `${link.linkText}`,
              linkUrlFilePath: `${linkAbsoluteFilePath}`,
            };
            errors.push(error);
          }
        }
      }
    });
  });
  return errors;
}

export { processRelativeLinks };
