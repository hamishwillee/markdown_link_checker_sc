import path from "path";
import fs from "fs";

// Checks if every image in every markdown page (results.page.relativeImageLinks) is present on the file system.
// - results is the array of information coming out of markdown parsing.
// - options just use to configure logging
async function checkLocalImageLinks(results, options) {
  options.log.includes("functions") ? console.log(`Function: checkLocalImageLinks()`) : null;
  const errors = [];
  const promises = [];

  results.forEach((page /*, index, array*/) => {
    //console.log(`PAGE: ${page}`);

    page.relativeImageLinks.forEach((link, index, array) => {
      //console.log(`LINK: ${link}`);
      //console.log(`options.root: ${options.root}`);
      //console.log(`options.directory: ${options.directory}`);
      //console.log(`link.linkUrlt: ${link.linkUrl}`);
      //console.log(`link.linkUrlt: ${link.linkUrl}`);
      //console.log(`dirname: ${path.dirname(page.page_file)}`);

      const fullImagePath = path.join(
        path.dirname(page.page_file),
        link.linkUrl
      );
      //console.log(`fullImagePath: ${fullImagePath}`);
      const promise = new Promise((resolve) => {
        fs.access(fullImagePath, fs.constants.F_OK, (err) => {
          if (err) {
            //console.log("Error");
            const error = {
              type: "MissingLocalImage",
              page: `${page.page_file}`,
              linkUrl: `${link.linkUrl}`,
              linkText: `${link.linkText}`,
              linkFullPath: `${fullImagePath}`,
            };
            errors.push(error);
            resolve(false);
          } else {
            //console.log("SUCCESS");
            resolve(true);
          }
        });
      });
      promises.push(promise);
    });
  });
  await Promise.all(promises); //Wait for all files to be checked
  return errors;
}

export { checkLocalImageLinks };
