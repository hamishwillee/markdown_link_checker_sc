import path from "path";
import fs from "fs";

// An array of errors given a results object that contains our array of objects containing relativeLinks (and other information).
// The options is used for explaining if it should fallback to HTML
async function processLocalImageLinks(results, options) {
  if (options.log.includes("functions")) {
    console.log(`Function: processLocalImageLinks()`);
  }
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

export { processLocalImageLinks };
