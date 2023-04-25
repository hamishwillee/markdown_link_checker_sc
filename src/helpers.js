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

// Take a URL and split to address, anchor, params
function splitURL(url) {
  const hashIndex = url.indexOf("#");
  const queryIndex = url.indexOf("?");
  //console.log('XXXXX'); //XXX
  //console.log(`hashIndex: ${hashIndex}`); //XXX
  //console.log(`queryIndex: ${queryIndex}`);

  let address = "";
  let anchor = "";
  let params = "";

  if (hashIndex >= 0 && queryIndex >= 0) {
    const splitIndex = hashIndex < queryIndex ? hashIndex : queryIndex;
    address = url.substring(0, splitIndex);
    if (hashIndex < queryIndex) {
      anchor = url.substring(hashIndex + 1, queryIndex);
      params = url.substring(queryIndex + 1);
    } else {
      params = url.substring(queryIndex + 1, hashIndex);
      anchor = url.substring(hashIndex + 1);
    }
  } else if (hashIndex >= 0) {
    // no queryIndex
    address = url.substring(0, hashIndex);
    anchor = url.substring(hashIndex + 1);
  } else if (queryIndex >= 0) {
    address = url.substring(0, queryIndex);
    params = url.substring(queryIndex + 1);
  } else {
    address = url;
    //anchor="";
    //params = "";
  }

  //console.log(`url: ${url}`);
  //console.log(`Address: ${address}`); //XXX
  //console.log(`anchor: ${anchor}`);
  //console.log(`param: ${params}`);

  return { address, anchor, params };
}

export { logToFile, splitURL };
