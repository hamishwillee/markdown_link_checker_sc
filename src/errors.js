import { sharedData } from "./shared_data.js";

class LinkError {
  constructor({ type, file, link = null }) {
    if (!type) {
      throw new Error("LinkError: Type is required!");
    } else {
      this.type = type;
    }
    if (link) {
      this.link = link;
      this.file = this.link.page;
    } else {
      this.file = file; // i.e. infer file from link, but if link not specified then can take passed value
    }
  }

  output() {
    console.log(`UNKNOWN ERROR:`);
    console.log(this);
  }
}

// Anchor link in current file does not exist
class CurrentFileMissingAnchorError extends LinkError {
  constructor({ file, link }) {
    super({ file: file, link: link, type: "CurrentFileMissingAnchor" }); // call the super class constructor and pass in the param object
  }
  output() {
    console.log(
      `- ${this.type}: ` +
        "`[" +
        `${this.link.text}](#${this.link.anchor})` +
        "`: anchor doesn't match any heading id or element id"
    );
  }
}

// Linked file (relative) exists but anchor in it does not
class LinkedFileMissingAnchorError extends LinkError {
  constructor({ file, link }) {
    super({ file: file, link: link, type: "LinkedFileMissingAnchor" }); 
  }
  output() {
    console.log(
      `- ${this.type}: #${this.link.anchor} not found in ${this.link.address} (${this.link.getAbsolutePath()})`
    );
  }
}

// A link to a page (markdown, and maybe HTML) that does not exist.
class LinkedInternalPageMissingError extends LinkError {
  constructor({ file, link }) {
    super({ file: file, link: link, type: "LinkedInternalPageMissing" }); 
  }
  output() {
    console.log(`- ${this.type}: This linked file is missing: ${this.link.address}`);
  }
}

// A link to an HTML file probably should be markdown
class InternalLinkToHTMLError extends LinkError {
  constructor({ file, link }) {
    super({ file: file, link: link, type: "InternalLinkToHTML" }); 
  }
  output() {
    console.log(`- ${this.type}: ${this.link.url} (should be ".md"?)`);
  }
}


// A link to a URL that is this site, and should probably be an internal/relative link
class UrlToLocalSiteError extends LinkError {
  constructor({ file, link }) {
    super({ file: file, link: link, type: "UrlToLocalSite" }); 
  }
  output() {
    console.log(`- ${this.type}: Link is URL to this site. Should it be relative link?: \\[${this.link.text}](${this.link.url}))`);
  }
}

// A link to a URL that is this site, and should probably be an internal/relative link
class PageNotInTOCError extends LinkError {
  constructor({ file, link }) {
    super({ file: file, link: link, type: "PageNotInTOC" }); 
  }
  output() {
    console.log(`- ${this.type}:  Page not in Table of Contents (${sharedData.options.toc})`);
  }
}


/* Errors still to create

    } else if (error.type == "PageNotInTOC") {
        console.log(
          `- ${error.type}: Page not in Table of Contents (${sharedData.options.toc})`
        );
        //console.log(`  ${error.type}: linkURL: ${error.linkUrl} ends in ".html"`);
        // { "type": "InternalLinkToHTML", "page": `${page.page_file}`, "linkUrl": `${link.linkUrl}`, "linkText": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}`  };
      } else if (error.type == "PageNotLinkedInternally") {
        console.log(
          `- ${error.type}: Page is orphan (not linked by any other page)`
        );
        //console.log(`  ${error.type}: linkURL: ${error.linkUrl} ends in ".html"`);
        // { "type": "InternalLinkToHTML", "page": `${page.page_file}`, "linkUrl": `${link.linkUrl}`, "linkText": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}`  };
      } else if (error.type == "MissingLocalImage") {
        console.log(
          `- ${error.type}: Linked image not found in file system: ${error.linkUrl}`
        );
        //console.log(`  ${error.type}: linkURL: ${error.linkUrl} ends in ".html"`);
        // { "type": "InternalLinkToHTML", "page": `${page.page_file}`, "linkUrl": `${link.linkUrl}`, "linkText": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}`  };
      } else if (error.type == "UrlToLocalSite") {
        //console.log( `- ${error.type}: Link is URL but should be a relative link: \\[${error.linkText}](${error.linkUrl})` );
        //console.log(`  ${error.type}: linkURL: ${error.linkUrl} ends in ".html"`);
        // { "type": "InternalLinkToHTML", "page": `${page.page_file}`, "linkUrl": `${link.linkUrl}`, "linkText": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}`  };
      } else if (error.type == "OrphanedImage") {
        console.log(
          `- ${error.type}: Image not linked from docs: ${error.page})`
        );

        */



export { LinkError, CurrentFileMissingAnchorError, LinkedFileMissingAnchorError, LinkedInternalPageMissingError, InternalLinkToHTMLError, UrlToLocalSiteError, PageNotInTOCError};
