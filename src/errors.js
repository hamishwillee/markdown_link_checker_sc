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
      `- ${this.type}: #${this.link.anchor} not found in ${
        this.link.address
      } (${this.link.getAbsolutePath()})`
    );
  }
}

// A link to a page (markdown, and maybe HTML) that does not exist.
class LinkedInternalPageMissingError extends LinkError {
  constructor({ file, link }) {
    super({ file: file, link: link, type: "LinkedInternalPageMissing" });
  }
  output() {
    console.log(
      `- ${this.type}: This linked file is missing: ${this.link.address}`
    );
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
    console.log(
      `- ${this.type}: Link is URL to this site. Should it be relative link?: \\[${this.link.text}](${this.link.url}))`
    );
  }
}

// Page is not linked from TOC page - here TOC is the page with most links, or may be explicitly defined.
class PageNotInTOCError extends LinkError {
  constructor({ file, link }) {
    super({ file: file, link: link, type: "PageNotInTOC" });
  }
  output() {
    console.log(
      `- ${this.type}:  Page not in Table of Contents (${sharedData.options.toc})`
    );
  }
}

// Page is not linked from any other page
class PageNotLinkedInternallyError extends LinkError {
  constructor({ file, link }) {
    super({ file: file, link: link, type: "PageNotLinkedInternally" });
  }
  output() {
    console.log(
      `- ${this.type}: Page is orphan (not linked by any other page)`
    );
  }
}

// Image is linked from page but not found
class LocalImageNotFoundError extends LinkError {
  constructor({ file, link }) {
    super({ file: file, link: link, type: "LocalImageNotFound" });
  }
  output() {
    console.log(
      `- ${this.type}: Linked image not found in file system: ${this.link.url}`
    );
  }
}

// Image is linked from page but not found
class OrphanedImageError extends LinkError {
  constructor({ file, link }) {
    super({ file: file, link: link, type: "OrphanedImage" });
  }
  output() {
    console.log(`- ${this.type}: Image not linked from docs: ${this.file}`);
  }
}

class ReferenceForLinkNotFoundError extends LinkError {
  constructor({ file, linkMatch, refMatch }) {
    super({ file: file, type: "ReferenceForLinkNotFound" });
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
};
