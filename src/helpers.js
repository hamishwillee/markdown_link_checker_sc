import fs from "fs/promises";

// Log data to specified file path, replacing file.
async function logToFile(filePath, dataString) {
  try {
    await fs.writeFile(filePath, dataString);
    //console.log("Data written to file");
  } catch (err) {
    console.error(err);
  }
}


export { logToFile };
