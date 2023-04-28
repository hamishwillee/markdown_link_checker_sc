
class Link {
  address = "";
  anchor = "";
  params = "";
  goad = "This is a goat";

  constructor(url = "", text = "", title = "") {
    this.url = url;
    this.text = text;
    this.title = title;
    this.splitURL(this.url);
  }

  // Take a URL and split to address, anchor, params
  splitURL(url) {
    console.log(`Link:SplitUrl(${url})`);
    const hashIndex = url.indexOf("#");
    const queryIndex = url.indexOf("?");

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
    }
    this.address = address;
    this.params = params;
    this.anchor = anchor;
    //console.log(`url: ${this.url}`);
    //console.log(`Address: ${this.address}`); //XXX
    //console.log(`anchor: ${this.anchor}`);
    //console.log(`param: ${this.params}`);
  }
}

export { Link };
