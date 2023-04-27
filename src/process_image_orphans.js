import { logToFile } from "./helpers.js";
import fs from "fs";
import path from "path";

function isImage(file) {
  const imageExtensions = [".jpg", ".jpeg", ".png", ".svg", ".gif", ".webm"];
  const fileExtension = path.extname(file).toLowerCase();
  return imageExtensions.includes(fileExtension) ? true : false;
}

var otherFileTypes = []; // Just used for logging in function below.

// Gets all image files in a directory.
async function getAllImageFilesInDirectory(dir, options) {
  options.log.includes("functions")
    ? console.log(`Function: getAllImageFilesInDirectory(${dir})`)
    : null;

  // TODO put this all in a try catch and return a better error.
  // Or perhaps put around parent.

  const files = await fs.promises.readdir(dir, { withFileTypes: true });
  const images = [];
  for (let i = 0; i < files.length; i++) {
    const file = path.join(dir, files[i].name);
    if (files[i].isDirectory()) {
      const subImages = await getAllImageFilesInDirectory(file, options);
      images.push(...subImages);
    } else if (isImage(file)) {
      images.push(file);
    } else {
      const fileExtension = path.extname(file).toLowerCase();
      otherFileTypes.includes(fileExtension)
        ? null
        : otherFileTypes.push(path.extname(file).toLowerCase());
    }
  }
  //console.log(    `XXXX Other file types ${JSON.stringify(otherFileTypes, null, 2)}`  );
  return images;
}

// Checks if any images in the options.directory
async function checkImageOrphansGlobal(results, options) {
  options.log.includes("functions")
    ? console.log("Function: checkImageOrphansGlobal")
    : null;
  const errors = [];
  if (options.imagedir === "") return errors; // exit early.

  const imagePath = path.resolve(options.root, options.imagedir);
  //console.log(`XXXXImagepath ${imagePath}`);
  const allImagesFound = await getAllImageFilesInDirectory(imagePath, options);
  //console.log(`XXXXallImagesFound ${JSON.stringify(allImagesFound, null, 2)}`);
  // Check all image files listed are in the array of local images we have
  const allImagesLinked = [];
  results.forEach((page) => {
    page.relativeImageLinks.forEach((link) => {

      const fullImagePath = path.join(
        path.dirname(page.page_file),
        link.linkUrl
      );
      //console.log(`XXXXfullImagePath: ${fullImagePath}`);
      allImagesLinked.push(fullImagePath);
    });
  });

  //console.log(`XXXXallImagesLinked ${JSON.stringify(allImagesLinked, null, 2)}`);
  // Check if we have any images in our file system that are not linked

  allImagesFound.forEach((image) => {
    if (!allImagesLinked.includes(image)) {
      const error = {
        type: "OrphanedImage",
        page: `${image}`,
      };
      errors.push(error);
    }
  });
  //console.log(`XXXXOrphanedImageErrors ${JSON.stringify(errors, null, 2)}`);
  return errors;
}

/*
Add function to check if supplied images are linked or orphans - i.e. PR that adds an image that isn't used.
Might not be needed - ie the above should make a filtered image on page.
*/

export { checkImageOrphansGlobal };
