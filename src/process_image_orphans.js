import { logToFile } from "./helpers.js";
import fs from "fs";
import path from "path";
import { sharedData } from "./shared_data.js";
import { OrphanedImageError } from "./errors.js";

function isImage(file) {
  const imageExtensions = [".jpg", ".jpeg", ".png", ".svg", ".gif", ".webm"];
  const fileExtension = path.extname(file).toLowerCase();
  return imageExtensions.includes(fileExtension) ? true : false;
}

var otherFileTypes = []; // Just used for logging in function below.

// Gets all image files in a directory.
async function getAllImageFilesInDirectory(dir) {
  sharedData.options.log.includes("functions")
    ? console.log(`Function: getAllImageFilesInDirectory(${dir})`)
    : null;

  // TODO put this all in a try catch and return a better error.
  // Or perhaps put around parent.

  const files = await fs.promises.readdir(dir, { withFileTypes: true });
  const images = [];
  for (let i = 0; i < files.length; i++) {
    const file = path.join(dir, files[i].name);
    if (files[i].isDirectory()) {
      const subImages = await getAllImageFilesInDirectory(file);
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
async function checkImageOrphansGlobal(results) {
  sharedData.options.log.includes("functions")
    ? console.log("Function: checkImageOrphansGlobal")
    : null;
  const errors = [];
  let allImagesFound = [];

  if (sharedData.options.imagedir !== "") {
    const imagePath = path.resolve(
      sharedData.options.root,
      sharedData.options.imagedir
    );

    allImagesFound = await getAllImageFilesInDirectory(imagePath);
  }

  sharedData.allImageFiles.forEach((value, valueAgain, set) => {
    const imagePath = path.resolve(sharedData.options.root, value);
    //console.log('val: ' + value);
    allImagesFound.push(imagePath);
  });

  // Check all image files listed are in the array of local images we have (this is from the options.images directory)
  const allImagesLinked = [];
  results.forEach((page) => {
    page.relativeImageLinks.forEach((link) => {
      const fullImagePath = link.getAbsolutePath();
      allImagesLinked.push(fullImagePath);
    });
  });

  //console.log(`XXXXallImagesFound ${JSON.stringify(allImagesFound, null, 2)}`);
  //console.log( `XXXXallImagesLinked ${JSON.stringify(allImagesLinked, null, 2)}`  );

  // Add the image/assets directory to all the files found in the markdown directory.
  //

  allImagesFound.forEach((image) => {
    if (!allImagesLinked.includes(image)) {
      const error = new OrphanedImageError({ file: image });
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
