import path from "path";
import fs from "fs";
import { sharedData } from "./shared_data.js";


// Checks if every image in every markdown page (results.page.relativeImageLinks) is present on the file system.
// - results is the array of information coming out of markdown parsing.
async function checkLocalImageLinks(results) {
  sharedData.options.log.includes("functions") ? console.log(`Function: checkLocalImageLinks()`) : null;
  const errors = [];
  const promises = [];

  results.forEach((page /*, index, array*/) => {
    //console.log(`PAGE: ${page}`);

    page.relativeImageLinks.forEach((link, index, array) => {
      //console.log(`XYYXLINK: ${JSON.stringify(link, null, 2)}`);
      //console.log(`sharedData.options.root: ${sharedData.options.root}`);
      //console.log(`sharedData.options.directory: ${sharedData.options.directory}`);
      //console.log(`link.linkUrlt: ${link.url}`);
      //console.log(`dirname: ${path.dirname(page.page_file)}`);

      const fullImagePath = path.join(
        path.dirname(page.page_file),
        link.url
      );
      //console.log(`fullImagePath: ${fullImagePath}`);
      const promise = new Promise((resolve) => {
        fs.access(fullImagePath, fs.constants.F_OK, (err) => {
          if (err) {
            //console.log("Error");
            const error = {
              type: "MissingLocalImage",
              page: `${page.page_file}`,
              linkUrl: `${link.url}`,
              linkText: `${link.text}`,
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
