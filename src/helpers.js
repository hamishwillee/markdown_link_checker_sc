import fs from "fs/promises";
import path from "path";

// Log data to specified file path, replacing file.
async function logToFile(filePath, dataString) {
  try {
    await fs.writeFile(filePath, dataString);
    //console.log("Data written to file");
  } catch (err) {
    console.error(err);
  }
}

const imageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".svg",
  ".gif",
  ".webm",
]);

// Return true if file is an image.
//Just looks at file extension.
function isImage(file) {
  const fileExtension = path.extname(file).toLowerCase();
  return imageExtensions.has(fileExtension) ? true : false;
}

function isMarkdown(file) {
  const fileExtension = path.extname(file).toLowerCase();
  return fileExtension === ".md" ? true : false;
}

function isHTML(file) {
  const fileExtension = path.extname(file).toLowerCase();
  //console.log(`ext: ${fileExtension}`);
  return fileExtension === ".html" || fileExtension === ".htm" ? true : false;
}

export { logToFile, isImage, isMarkdown, isHTML };
