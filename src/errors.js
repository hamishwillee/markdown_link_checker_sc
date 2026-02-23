class LinkError {
  constructor({ type, file, link = null, docsroot = null }) {
    if (!type) {
      throw new Error("LinkError: Type is required!");
    } else {
      this.type = type;
    }
    if (link) {
      this.link = link;
      this.file = this.link.page;
      this.fileRelativeToRoot = this.link.fileRelativeToRoot;
      //console.log(`debugX: fileRelativeToRoot: ${this.fileRelativeToRoot}`);
    } else {
      this.file = file; // i.e. infer file from link, but if link not specified then can take passed value
      this.fileRelativeToRoot = this.file.split(docsroot)[1];
      //console.log(`debug: docsroot: ${docsroot}`);
      //console.log(`debug: fileRelativeToRoot: ${this.fileRelativeToRoot}`);
      this.fileRelativeToRoot =
        this.fileRelativeToRoot.startsWith("/") ||
        this.fileRelativeToRoot.startsWith("\\")
          ? this.fileRelativeToRoot.substring(1)
          : this.fileRelativeToRoot;
      //console.log(`debug: 2fileRelativeToRoot: ${this.fileRelativeToRoot}`);
    }
  }

  output() {
    console.log(`UNKNOWN ERROR:`);
    console.log(this);
  }
}

class ExternalLinkError extends LinkError {
  constructor({ file, link, statusCode, statusMessage, error, docsroot }) {
    super({ file: file, link: link, type: "ExternalLinkError", docsroot }); // call the super class constructor and pass in the param object
    this.statusCode = statusCode; // HTTP status code, if available
    this.statusMessage = statusMessage; // HTTP status message, if available
    this.error = error; // Error message, if available
  }
  output() {
    let errorText = `- ${this.type}:`;
    errorText = this.statusCode
      ? `${errorText} ${this.statusCode} (${this.statusMessage})`
      : errorText;
    errorText = this.error ? `${errorText} ${this.error})` : errorText;
    errorText = `${errorText}\n   ${this.link.url}`;
    //this.link.text
    console.log(errorText);
  }
}

class ExternalLinkWarning extends LinkError {
  constructor({ file, link, statusCode, statusMessage, error, docsroot }) {
    super({ file: file, link: link, type: "ExternalLinkWarning", docsroot }); // call the super class constructor and pass in the param object
    this.statusCode = statusCode; // HTTP status code, if available
    this.statusMessage = statusMessage; // HTTP status message, if available
    this.error = error; // Error message, if available
  }
  output() {
    let errorText = `- ${this.type}:`;
    errorText = this.statusCode
      ? `${errorText} ${this.statusCode} (${this.statusMessage})`
      : errorText;
    errorText = this.error ? `${errorText} ${this.error})` : errorText;
    errorText = `${errorText}\n   ${this.link.url}`;
    //this.link.text
    console.log(errorText);
  }
}

// Anchor link in current file does not exist
class CurrentFileMissingAnchorError extends LinkError {
  constructor({ file, link, docsroot }) {
    super({ file: file, link: link, type: "CurrentFileMissingAnchor", docsroot }); // call the super class constructor and pass in the param object
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
  constructor({ file, link, docsroot }) {
    super({ file: file, link: link, type: "LinkedFileMissingAnchor", docsroot });
  }
  output() {
    console.log(
      `- ${this.type}: #${this.link.anchor} not found in ${
        this.link.address
      } (${this.link.getAbsolutePath()})`
    );
  }
}

// A link to a page (markdown, and maybe HTML) that does not exist.
class LinkedInternalPageMissingError extends LinkError {
  constructor({ file, link, docsroot }) {
    super({ file: file, link: link, type: "LinkedInternalPageMissing", docsroot });
  }
  output() {
    console.log(
      `- ${this.type}: This linked file is missing: ${this.link.address}`
    );
  }
}

// A link to an HTML file probably should be markdown
class InternalLinkToHTMLError extends LinkError {
  constructor({ file, link, docsroot }) {
    super({ file: file, link: link, type: "InternalLinkToHTML", docsroot });
  }
  output() {
    console.log(`- ${this.type}: ${this.link.url} (should be ".md"?)`);
  }
}

// A link to a URL that is this site, and should probably be an internal/relative link
class UrlToLocalSiteError extends LinkError {
  constructor({ file, link, docsroot }) {
    super({ file: file, link: link, type: "UrlToLocalSite", docsroot });
  }
  output() {
    console.log(
      `- ${this.type}: Link is URL to this site. Should it be relative link?: \\[${this.link.text}](${this.link.url}))`
    );
  }
}

// Page is not linked from TOC page - here TOC is the page with most links, or may be explicitly defined.
class PageNotInTOCError extends LinkError {
  constructor({ file, link, docsroot, toc }) {
    super({ file: file, link: link, type: "PageNotInTOC", docsroot });
    this.toc = toc;
  }
  output() {
    console.log(
      `- ${this.type}:  Page not in Table of Contents (${this.toc})`
    );
  }
}

// Page is not linked from any other page
class PageNotLinkedInternallyError extends LinkError {
  constructor({ file, link, docsroot }) {
    super({ file: file, link: link, type: "PageNotLinkedInternally", docsroot });
  }
  output() {
    console.log(
      `- ${this.type}: Page is orphan (not linked by any other page)`
    );
  }
}

// Image is linked from page but not found
class LocalImageNotFoundError extends LinkError {
  constructor({ file, link, docsroot }) {
    super({ file: file, link: link, type: "LocalImageNotFound", docsroot });
  }
  output() {
    console.log(
      `- ${this.type}: Linked image not found in file system: ${this.link.url}`
    );
  }
}

// Image is linked from page but not found
class OrphanedImageError extends LinkError {
  constructor({ file, link, docsroot }) {
    super({ file: file, link: link, type: "OrphanedImage", docsroot });
  }
  output() {
    console.log(`- ${this.type}: Image not linked from docs: ${this.file}`);
  }
}

class ReferenceLinkEmptyReferenceError extends LinkError {
  // A reference like [linktext][]
  // this isn't valid because the reference to map to is undefined
  constructor({ file, linkMatch, docsroot }) {
    super({ file: file, type: "ReferenceLinkEmptyReference", docsroot });
    if (!linkMatch) {
      throw new Error(
        "ReferenceLinkEmptyReferenceError: linkMatch is required!"
      );
    } else {
      this.linkMatch = linkMatch;
    }
  }
  output() {
    console.log(
      `- ${this.type}: Link ${this.linkMatch} has as an empty string for its reference`
    );
  }
}

class ReferenceForLinkNotFoundError extends LinkError {
  constructor({ file, linkMatch, refMatch, docsroot }) {
    super({ file: file, type: "ReferenceForLinkNotFound", docsroot });
    if (!linkMatch) {
      throw new Error("ReferenceForLinkNotFoundError: linkMatch is required!");
    } else {
      this.linkMatch = linkMatch;
    }
    if (!refMatch) {
      throw new Error("ReferenceForLinkNotFoundError: refMatch is required!");
    } else {
      this.refMatch = refMatch;
    }
  }
  output() {
    console.log(
      `- ${this.type}: Matching reference ${this.refMatch} not found for link ${this.linkMatch}`
    );
  }
}

export {
  LinkError,
  ExternalLinkError,
  ExternalLinkWarning,
  CurrentFileMissingAnchorError,
  LinkedFileMissingAnchorError,
  LinkedInternalPageMissingError,
  InternalLinkToHTMLError,
  UrlToLocalSiteError,
  PageNotInTOCError,
  PageNotLinkedInternallyError,
  LocalImageNotFoundError,
  OrphanedImageError,
  ReferenceForLinkNotFoundError,
  ReferenceLinkEmptyReferenceError,
};
