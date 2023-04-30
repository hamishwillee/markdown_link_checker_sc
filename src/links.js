import path from "path";

class Link {
  address = "";
  anchor = "";
  params = "";
  type = "unHandledLinkType";
  goat = "This is a 2goat";
  isImage = false;
  isMarkdown = false;
  isHTML = false;
  isRelative = false;

  //isImage = false;
  static linkTypes;
  static imageExtensions;
  static {
    this.linkTypes = new Set([
      "unHandledLinkType",
      "urlLink", // http(s) link
      "urlLocalLink", // URL (http) pointing to current site
      "urlImageLink", // https(s) link to image
      "relativeImageLink", // relative link to image
      "relativeLink", // relative link to another page/file
      "relativeHTMLLink", // relative link to an HTML file.
      "relativeAnchorLink", // link to anchor in current page
      //"relativeParamLink", // link that only has params - probably a bug
      "ftpLink", // FTP URL (i.e. ftp://)
      "ftpsLink", // FTPS URL (i.e. ftps://)
      "mailtoLink", // Mailto link (ie mailto whatever)
    ]);

    this.imageExtensions = new Set([
      ".jpg",
      ".jpeg",
      ".png",
      ".svg",
      ".gif",
      ".webm",
    ]);
  }

  constructor({ page, url, type, text, title }) {
    //console.log(      `Link: constructor args: ${JSON.stringify(arguments, null, 2)}`    );

    if (page) {
      this.page = page;
    } else {
      throw new Error("Link: page argument is required.");
    }

    if (url) {
      this.url = url;
      this.splitURL(this.url);
    } else {
      throw new Error("Link: url argument is required.");
    }

    const linkTypeGuess = this.findType(); // Do to populate the isXxxx values
    if (type) {
      if (!Link.linkTypes.has(type)) {
        console.log("Supported Link Types:");
        console.log(Link.linkTypes); //This is because having trouble getting the set to print
        throw new Error(`Link: type ${type} must be in supported link types`);
      } else {
        this.type = type;
      }
    } else {
      //No type specified - use type inferred from extension etc.
      this.type = linkTypeGuess;
    }
    text ? (this.text = text) : (this.text = "");
    title ? (this.title = title) : (this.title = "");
  }

  // Take a URL and split to address, anchor, params
  splitURL(url) {
    //console.log(`Link:SplitUrl(${url})`);
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

  // Assign a guessed type based on other information.
  // This is only used if the type is not specified as an argument.
  // Uses file extension etc, so should be run after SplitUrl() which finds the address
  findType() {
    let linkType = "unHandledLinkType";

    this.isImage = this.address && this.checkImage(this.address) ? true : false; //only if address is true.
    this.isMarkdown =
      this.address && this.checkMarkdown(this.address) ? true : false; //only if address is true.
    this.isHTML = this.address && this.checkHTML(this.address) ? true : false; //only if address is true.
    const regexpTestProtocol = /^[a-z]+:/i;

    //console.log(`Linkcheck1: ${this.address} `);
    if (!this.address) {
      //console.log(`Linkcheck2: ${this.address} `);
      // local/relative link
      if (this.anchor) {
        //console.log(`Linkcheck3: ${this.anchor} `);
        linkType = "relativeAnchorLink";
      } else if (this.params) {
        //console.log(`Linkcheck3: ${this.params} `);
        // no anchor, no address, and has params
        throw Error("Link: Invalid - only params, no address or anchor");
      } else {
        //console.log(`Linkcheck4: should be nothing url: ${this.url} `);
        // This is the no url case - we already throw on this.
        //Here we go again
        throw Error("Link: Invalid - no address, params, anchor");
      }
    } else {
      // We have an address - so it is either a URL or relative of some kind
      //console.log(`Linkcheck5: ${this.address} `);

      if (this.address.startsWith("ftp://")) {
        //console.log(`Linkcheck6: ${this.address} `);
        linkType = "ftpLink";
      } else if (this.address.startsWith("ftps://")) {
        //console.log(`Linkcheck67 ${this.address} `);
        linkType = "ftpsLink";
      } else if (this.address.startsWith("mailto:")) {
        //console.log(`Linkcheck8: ${this.address} `);
        linkType = "mailtoLink";
      } else if (
        this.address.startsWith("http:") ||
        this.address.startsWith("https:")
      ) {
        //console.log(`Linkcheck9 is HTTP: ${this.address} `);
        linkType = this.isImage ? "urlImageLink" : "urlLink";
      } else if (regexpTestProtocol.test(this.address)) {
        // This is a protocol, but not one we handle.
        // Leave type as unhandled
        console.log(
          "NN The string starts with an unhandled protocol - remove at some point"
        );
      } else {
        this.isRelative = true;
        //console.log(`Linkcheck10 link is relative : ${this.address} `);
        // Must be a relative link of some kind.
        //this.absolutePath = this.getAbsolutePath();
        if (this.isImage) {
          //console.log(`Linkcheck11 link is relative image : ${isImage} `);
          linkType = "relativeImageLink";
        } else if (this.isMarkdown) {
          //console.log(`Linkcheck12 link is relative image : ${isMarkdown} `);
          linkType = "relativeLink";
        } else if (this.isHTML) {
          //console.log(`Linkcheck13 link is relative image : ${isHTML} `);
          linkType = "relativeHTMLLink"; //
        } else {
          //console.log(`Odd URLS : ${this.url} `);
          // Its an unhandled relative link that isn't an image or markdown.
          // Generally these links don't work in markdown. But for now let's leave it as unhandled.
        }
      }
    }

    return linkType; //Return whatever we guessed
  } // end of file(type)

  //get absolute path to link, if this is a relative URL link.
  getAbsolutePath() {
    //probably should test if is relative ...
    const absPath = path.resolve(path.dirname(this.page), this.address);
    return absPath;
  }

  // Return true if file is an image.
  //Just looks at file extension.
  checkImage(file) {
    const fileExtension = path.extname(file).toLowerCase();
    return Link.imageExtensions.has(fileExtension) ? true : false;
  }

  checkMarkdown(file) {
    const fileExtension = path.extname(file).toLowerCase();
    return fileExtension === ".md" ? true : false;
  }

  checkHTML(file) {
    const fileExtension = path.extname(file).toLowerCase();
    //console.log(`ext: ${fileExtension}`);
    return fileExtension === ".html" || fileExtension === ".htm" ? true : false;
  }
}

export { Link };