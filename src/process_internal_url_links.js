import path from "path";

// An array of errors given a results object that contains our array of objects containing urls that link to our current site.
// The options not used at this point.
function processUrlsToLocalSource(results, options) {
  const errors = [];
  results.forEach((page, index, array) => {
    //console.log(`PAGE: ${page}`);

    page.urlLocalLinks.forEach((link, index, array) => {
      //console.log(`LINK: ${link}`);
      const error = {
        type: "UrlToLocalSite",
        page: `${page.page_file}`,
        linkUrl: `${link.linkUrl}`,
        linkAnchor: `${link.linkAnchor}`,
        linkText: `${link.linkText}`,
      };
      errors.push(error);
    });
  });
  return errors;
}

export { processUrlsToLocalSource };
