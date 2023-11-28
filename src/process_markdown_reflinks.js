import { Link } from "./links.js";
import { logFunction } from "./helpers.js";
import {
  ReferenceForLinkNotFoundError,
  ReferenceLinkEmptyReferenceError /* CurrentFileMissingAnchorError,   LinkedFileMissingAnchorError, */,
} from "./errors.js";

//import { sharedData } from "./shared_data.js";

// Process all content in page, generating lists of links and some errors.
function processReferenceLinks(content, page) {
  logFunction(`Function: processReferenceLinks(): page: ${page}`);

  // Detect reference link
  //const regex = /^\[(.+?)\]:\s+(.+?$)/;
  // Link label format: https://github.github.com/gfm/#link-label
  // Link reference definition: https://github.github.com/gfm/#link-reference-definition
  //   This will only catch the "all in one line format".
  //   Within that it catches reference, url and title.
  //const regex = /^\s{0,3}\[(?<refName>.+?)\]:\s*?(?<refUrl>.+?$)/;
  //const regex = /^\s{0,3}[\[(?<refName>.+?)\]:\s*?(?<refUrl>.+?)$/;
  const references = {};
  const possibleLinks = [];

  const errors = [];
  const urlLinks = [];
  const urlLocalLinks = [];
  const urlImageLinks = [];
  const relativeLinks = [];
  const relativeImageLinks = [];

  const regexReference =
    /^\s{0,3}\[(?<capRefName>.+?)\]:\s*?(?<capRefUrl>.+?)(?:[\"'](?<capRefTitle>[^\"\']+)[\"'])?(\s*$)/; //is goodish but matches on two []
  //const regex = /^\s{0,3}\[(?<refName>.+?)\]:\s*?(?<refUrl>.+?)(?:[\"'](?<refTitle>[^\"\']+)[\"'])?(\s*(?<refTrailing>\S*))?$/
  // TODO NEED to do something about trailing text as it breaks parser.
  //Split content into lines
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match on reflinks
    const matchstring = line.match(regexReference);
    if (matchstring) {
      const { capRefName, capRefUrl, capRefTitle } = matchstring.groups;

      // Normalize refname (lowercase, trimmed, only onewhitespace)
      // First reference used by default.
      const refName = capRefName.trim().toLowerCase().replace(/\s+/g, " ");
      if (refName.includes(`[`) || refName.includes(`]`)) {
        //console.log(`Markdown Link reference appears invalid: ${refName}`);
        // This is case where we have a line that nearly matches a markdown link reference.
        // We'll assume its not a link at all.
        continue;
      }
      const refTitle = capRefTitle ? capRefTitle : "";
      const refUrl = capRefUrl.trim();

      if (refName.length !== capRefName.length) {
        console.log(`TODO warn check spaces on ref: ${capRefName}`);
      }

      const refItem = {
        ref: refName,
        url: refUrl,
        title: refTitle,
        captured: matchstring[0],
      };

      if (refName in references) {
        console.log(`TODO: Error duplicate reference to print: ${refName}`);
      } else {
        references[refName] = refItem;
      }
    }

    //Match on possible reference links.
    //   const regexWithLinkText =       /(?<prefix>[!@]?)\[(?<text>[^\]]*)\][(?<reference>.*?)]/g;
    const regexWithLinkText =
      /(?<prefix>[!@]?)\[(?<text>.*?)\]\[(?<reference>.*?)\]/g;

    const matches = line.matchAll(regexWithLinkText);
    //console.log(`Matches: ${matches}`);

    for (const match of matches) {
      const { prefix, text, reference } = match.groups;
      //console.log(        ` Prefix: ${prefix}, Text: ${text}, Reference: ${reference}, `      );
      const refName = reference.trim().toLowerCase().replace(/\s+/g, " ");

      //Create link (possible link from ref)
      // Note, this is just an object, not an object of type Link
      const link = {
        page: page,
        text: text,
        prefix: prefix,
        refName: refName,
        refMatch: reference,
        linkMatch: match[0],
      };
      possibleLinks.push(link);
      //console.log(possibleLinks);
    }
  }
  //console.log(references);
  //console.log(possibleLinks);

  // Iterate through the possible links, checking for references.
  // Create links and errors
  possibleLinks.forEach((value) => {
    if (value.refName in references) {
      //console.log("Ref exists for link:");
      //console.log(references[value.refName]);

      //Create link for ref links with matching ref
      const link = new Link({
        page: value.page,
        url: references[value.refName].url,
        text: value.text,
        title: references[value.refName].title,
        isReference: true,
        refName: value.refName,
        refMatch: value.linkMatch,
      });

      // TODO Save error here if there is a mismatch in prefix - i.e. prefix ! but URL is not an image.
      // Perhaps roll that out elsewhere too.
      // Now lets add to correct type.

      //Link works out it own type, so add to the appropriate array to return:
      switch (link.type) {
        case "urlLink":
          urlLinks.push(link);
          break;
        case "urlLocalLink":
          urlLocalLinks.push(link);
          break;
        case "urlImageLink":
          urlImageLinks.push(link);
          break;
        case "relativeLink":
          relativeLinks.push(link);
          break;
        case "relativeImageLink":
          relativeImageLinks.push(link);
          break;
        default:
          throw new Error(
            `processReferenceLinks: '${link.type}' link type unknown in switch statement!`
          );
          break;
      }
    } else {
      //console.log(`XXXXX file: ${value.page}, linkMatch: ${value.linkMatch}, refMatch: ${value.refMatch}`);
      if (!value.refMatch) {
        const error = new ReferenceLinkEmptyReferenceError({
          file: value.page,
          linkMatch: value.linkMatch,
        });
        errors.push(error);
      } else {
        const error = new ReferenceForLinkNotFoundError({
          file: value.page,
          linkMatch: value.linkMatch,
          refMatch: value.refMatch,
        });
        //TODO: It is valid to have text that has reference format.
        // Don't push error until ready to disable specific cases.
        //errors.push(error);
      }
    }
  });

  //console.log(refLinks);
  return {
    errors: errors,
    urlLinks: urlLinks,
    urlLocalLinks: urlLocalLinks,
    urlImageLinks: urlImageLinks,
    relativeLinks: relativeLinks,
    relativeImageLinks: relativeImageLinks,
  };
}

export { processReferenceLinks };

/*


*/
