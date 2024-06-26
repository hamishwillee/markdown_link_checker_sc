import { Link } from "./links.js";
import { sharedData } from "./shared_data.js";
import { logFunction } from "./helpers.js";
import { processReferenceLinks } from "./process_markdown_reflinks.js";

// Returns slug for a string (markdown heading) using Vuepress algorithm.
// Algorithm from chatgpt - needs testing.
const processMarkdown = (contents, page) => {
  logFunction(`Function: processMarkdown(): page: ${page}`);

  const headings = [];
  //const anchors = [];
  const htmlAnchors = []; //{};
  const relativeLinks = [];
  const urlLinks = [];
  const urlLocalLinks = [];
  const urlImageLinks = [];
  const relativeImageLinks = [];
  //const referenceLinks = [];
  const unHandledLinkTypes = [];
  const errors = [];
  let redirectTo; //Pages that contain <Redirect to="string"/> links

  //console.log("SHARED_DATA");
  //console.log(sharedData);
  // Check if page is a redirect.
  // If it is, add to list then return.
  // Otherwise do other file processing.
  const regex = /<Redirect to="(.+?)" \/>/;
  const matches = contents.match(regex);
  matches ? (redirectTo = matches[1]) : (redirectTo = null);
  if (redirectTo) {
    //console.log(`REDIRECT: ${file}`)
  } else {
    // Don't do anything else for redirects pages

    const lines = contents.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // match headings
      const matches = line.match(/^#+\s+(.+)$/);

      if (matches) {
        let heading = matches[1];

        //console.log(sharedData.options.anchor_in_heading);

        if (sharedData.options.anchor_in_heading) {
          // True by default - catch anchors in headings

          // Define the regex pattern to match the heading and anchor
          // If it exists, overwrite heading and also push the anchor
          const pattern = /(.*?)\{#(.*?)\}\s*?/;
          const anchormatches = heading.match(pattern);
          if (anchormatches) {
            //console.log(anchormatches);
            heading = anchormatches[1].trim();
            //console.log(heading);
            htmlAnchors.push(anchormatches[2]);
            //console.log(anchormatches[2]);
          }
        }

        headings.push(heading);
      }
      // TODO - have to slugify later.

      const links = processLineMarkdownLinks(
        line,
        relativeLinks,
        relativeImageLinks,
        urlLinks,
        urlLocalLinks,
        urlImageLinks,
        unHandledLinkTypes,
        page
      );

      // This gets a reference links
    }

    const referenceLinkInfo = processReferenceLinks(contents, page);
    urlLinks.push(...referenceLinkInfo.urlLinks);
    urlLocalLinks.push(...referenceLinkInfo.urlLocalLinks);
    urlImageLinks.push(...referenceLinkInfo.urlImageLinks);
    relativeLinks.push(...referenceLinkInfo.relativeLinks);
    relativeImageLinks.push(...referenceLinkInfo.relativeImageLinks);
    errors.push(...referenceLinkInfo.errors);

    //errors: errors, //TODO need to also pass referenceLinkInfo.errors

    // Match html tags that have an id element
    // (another way an anchor can be created)
    const htmlTagsWithIdsMatches = contents.match(
      /<([a-z]+)(?:\s+[^>]*?\bid=(["'])(.*?)\2[^>]*?)?>/gi
    );
    if (htmlTagsWithIdsMatches) {
      htmlTagsWithIdsMatches.forEach((match) => {
        const tagMatches = match.match(/^<([a-z]+)/i);
        const idMatches = match.match(/id=(["'])(.*?)\1/);
        if (tagMatches && idMatches) {
          const tag = tagMatches[1].toLowerCase();
          const id = idMatches[2];
          if (tag && id) {
            htmlAnchors.push(id);
          }
        }
      });
    }
  }
  return {
    //page_file: file,
    headings: headings,
    //anchors_auto_headings: anchors,
    anchors_tag_ids: htmlAnchors,
    relativeLinks,
    urlLinks,
    urlLocalLinks,
    urlImageLinks,
    relativeImageLinks,
    unHandledLinkTypes,
    redirectTo,
    errors,
  };
};

// Processes line, taking arrays of different link types.
// Update the incoming values and return
// Note, assumption is all links are on one line, not split across lines.
// This is generally true, but does not have to be.
const processLineMarkdownLinks = (
  line,
  relativeLinks,
  relativeImageLinks,
  urlLinks,
  urlLocalLinks,
  urlImageLinks,
  unHandledLinkTypes,
  page
) => {
  logFunction(`Function: processMarkdownLinks(): page: ${page}`);

  //const regex = /(?<prefix>[!@]?)\[(?<text>[^\]]+)\]\((?<url>\S+?)(?:\s+"(?<title>[^"]+)")?\)/g;
  // Match to Markdown link OR image
  const regex =
    /(?<prefix>[!@]?)\[(?<text>[^\]]*)\]\((?<url>\S+?)(?:\s+"(?<title>[^"]+)")?\)/g;
  const matches = line.matchAll(regex);

  // TODO - THIS matches @[youtube](gjHj6YsxcZk) valid link which is used for vuepress plugin URLs. We probably want to exclude it and deal with it separately
  // Maybe a backwards lookup on @
  // Not sure if we can generalize

  for (const match of matches) {
    const { prefix, text, url, title } = match.groups;
    const isMarkdownImageLink = prefix == "!" ? true : false;
    const isVuepressYouTubeLink = prefix == "@" ? true : false;

    const linkText = text;
    const linkUrl = url;
    const linkTitle = title ? title : "";

    // Work out Link type
    let linkType = "";

    if (isVuepressYouTubeLink) {
      if (linkUrl.startsWith("http")) {
        linkType = "urlLink";
      } else {
        // Not going to handle this (yet)
        // TODO - prepend the standard URL
      }
    } else if (
      sharedData.options.site_url &&
      (linkUrl.startsWith(`http://${sharedData.options.site_url}`) ||
        linkUrl.startsWith(`https://${sharedData.options.site_url}`))
    ) {
      //console.log(link);
      linkType = "urlLocalLink";
    }

    if (!linkUrl) {
      // We should never get to this logging
      console.log(
        `WWregexMarkdownLinkAndImage: page: ${page}, linkUrl: ${linkUrl}, linkText: ${linkText}, linkTitle: ${linkTitle}, linkType: ${linkType}`
      );
    }

    //Create link
    const link = new Link({
      page: page,
      url: linkUrl,
      text: linkText,
      title: linkTitle,
      type: linkType,
    });
    //console.log(`XXLINKTESTnewLink: ${JSON.stringify(link, null, 2)}`);

    // For now, dump in different arrays. Might just add to one array eventually
    switch (link.type) {
      case "urlLink": {
        urlLinks.push(link);
        //console.log("This is a URL link");
        break;
      }
      case "urlLocalLink": {
        urlLocalLinks.push(link);
        //console.log("This is a URL local link");
        break;
      }
      case "urlImageLink": {
        urlImageLinks.push(link);
        //console.log("This is a URL image link");
        break;
      }
      case "relativeImageLink": {
        relativeImageLinks.push(link);
        //console.log("This is a relative image link");
        break;
      }
      case "relativeLink": {
        relativeLinks.push(link);
        //console.log("This is a relative link");
        break;
      }
      case "relativeAnchorLink": {
        relativeLinks.push(link); // This is an anchor link - but currently handled in the same code.
        //console.log("This is a relative link");
        break;
      }
      case "relativeHTMLLink": {
        relativeLinks.push(link); // This is HTML link handled in same code.
        //console.log("This is a relative link");
        break;
      }
      default: {
        unHandledLinkTypes.push(link);
        sharedData.options.log.includes("todo")
          ? console.log(`TODO: 3Unhandled link.type: ${link.type}`)
          : null;
        break;
      }
    }
  }

  //Match for html a - append to the lists
  const regexHTMLLinkTotal = /<a\s+(?<attributes>.*?)>(?<linktext>.*?)<\/a>/gi;
  const regexHTMLTitle =
    /title\s*[=]\s*(?<quote>['"])(?<title>.*?)(?<!\\)\k<quote>/i;
  //title\s*[=]\s*(?<title>['"]?)([^'"\s>]+)\k<title>/i;
  const regexHTMLhref =
    /href\s*[=]\s*(?<quote>['"])(?<href>.*?)(?<!\\)\k<quote>/i;
  const regexHTMLid = /id\s*[=]\s*(?<quote>['"])(?<id>.*?)(?<!\\)\k<quote>/i;
  for (const match of line.matchAll(regexHTMLLinkTotal)) {
    const attributes = match.groups.attributes;
    //console.log(`XXXXXattributes_s: ${attributes}`)
    const linkText =
      match && match.groups.linktext ? match.groups.linktext : "";
    //console.log(`XXXXXlinktext: ${linktext}`)
    let linkTitle = "";
    let linkUrl = "";
    let linkId = "";
    if (attributes) {
      const titlematch = attributes.match(regexHTMLTitle);
      linkTitle =
        titlematch && titlematch.groups.title ? titlematch.groups.title : "";
      const hrefmatch = attributes.match(regexHTMLhref);
      linkUrl = hrefmatch && hrefmatch.groups.href ? hrefmatch.groups.href : "";
      const idMatch = attributes.match(regexHTMLid);
      linkId = idMatch && idMatch.groups.id ? idMatch.groups.id : "";
    }
    // If not linkUrl then this is probably and anchor link.
    //
    if (!linkUrl && linkId) {
      // This is an anchor-only link. Skip to next found link
      continue;
    }

    let linkType = "";
    if (
      sharedData.options.site_url &&
      (linkUrl.startsWith(`http://${sharedData.options.site_url}`) ||
        linkUrl.startsWith(`https://${sharedData.options.site_url}`))
    ) {
      //console.log(link);
      linkType = "urlLocalLink";
    }

    //const link = new Link(linkUrl, linkText, linkTitle);
    if (!linkUrl) {
      //We should only get here for empty links.
      console.log(
        `WWregexHTMLmatchAtag: page: ${page}, linkUrl: ${linkUrl}, linkText: ${linkText}, linkTitle: ${linkTitle}, linkType: ${linkType}`
      );
    }

    const link = new Link({
      page: page,
      url: linkUrl,
      type: linkType,
      text: linkText,
      title: linkTitle /* type: linkType */,
    });

    // For now, dump in different arrays. Might just add to one array eventually
    switch (link.type) {
      case "urlLink": {
        urlLinks.push(link);
        //console.log("This is a URL link");
        break;
      }
      case "urlLocalLink": {
        urlLocalLinks.push(link);
        //console.log("This is a URL local link");
        break;
      }
      case "urlImageLink": {
        urlImageLinks.push(link);
        //console.log("This is a URL image link");
        break;
      }
      case "relativeImageLink": {
        relativeImageLinks.push(link);
        //console.log("This is a relative image link");
        break;
      }
      case "relativeLink": {
        relativeLinks.push(link);
        //console.log("This is a relative link");
        break;
      }
      case "relativeAnchorLink": {
        relativeLinks.push(link); // This is an anchor link - but currently handled in the same code.
        //console.log("This is a relative link");
        break;
      }
      case "relativeHTMLLink": {
        relativeLinks.push(link); // This is an anchor link - but currently handled in the same code.
        //console.log("This is a relative link");
        break;
      }

      default: {
        unHandledLinkTypes.push(link);
        sharedData.options.log.includes("todo")
          ? console.log(`TODO: 2Unhandled link.type: ${link.type}`)
          : null;
        break;
      }
    }
  }

  //Might further parse this to catch img in anchor.

  //Match for html img - append to the lists
  const regexHTMLImgTotal = /<img\s+(?<attributes>.*?)>/gi;
  //const regexHTMLImgTotal = /<img\s+(?<attributes>.*?)\/>/gi;

  const regex_htmlattr_src =
    /src\s*[=]\s*(?<quote>['"])(?<src>.*?)(?<!\\)\k<quote>/i;

  for (const match of line.matchAll(regexHTMLImgTotal)) {
    //console.log(`XXXXXregexHTMLImgTotals: ${match}`)
    const attributes = match.groups.attributes;
    const linkText = "";
    let linkTitle = "";
    let linkUrl = "";
    if (attributes) {
      const titlematch = attributes.match(regexHTMLTitle);
      linkTitle =
        titlematch && titlematch.groups.title ? titlematch.groups.title : "";
      const srcmatch = attributes.match(regex_htmlattr_src);
      linkUrl = srcmatch && srcmatch.groups.src ? srcmatch.groups.src : "";
    }

    //const link = new Link(linkUrl, linkText, linkTitle);
    //console.log(`WWregexHTML_matchImage: page: ${page}, linkUrl: ${linkUrl}, linkText: ${linkText}, linkTitle: ${linkTitle},`);
    const link = new Link({
      page: page,
      url: linkUrl,
      text: linkText,
      title: linkTitle /* type: linkType */,
    });

    /*
    if (linkUrl) {
      linkUrl.startsWith("http")
        ? urlImageLinks.push(link)
        : relativeImageLinks.push(link);
    }
*/
    // For now, dump in different arrays. Might just add to one array eventually
    switch (link.type) {
      case "urlLink": {
        urlLinks.push(link);
        //console.log("This is a URL link");
        break;
      }
      case "urlLocalLink": {
        urlLocalLinks.push(link);
        //console.log("This is a URL local link");
        break;
      }
      case "urlImageLink": {
        urlImageLinks.push(link);
        //console.log("This is a URL image link");
        break;
      }
      case "relativeImageLink": {
        relativeImageLinks.push(link);
        //console.log("This is a relative image link");
        break;
      }
      case "relativeLink": {
        relativeLinks.push(link);
        //console.log("This is a relative link");
        break;
      }
      case "relativeAnchorLink": {
        relativeLinks.push(link); // This is an anchor link - but currently handled in the same code.
        //console.log("This is a relative link");
        break;
      }
      case "relativeHTMLLink": {
        relativeLinks.push(link); // This is an HTML link.
        break;
      }

      default: {
        unHandledLinkTypes.push(link);
        sharedData.options.log.includes("todo")
          ? console.log(`TODO: 1Unhandled link.type: ${link.type}`)
          : null;
        break;
      }
    }
    //console.log(link);
  }

  return {
    relativeLinks,
    urlLinks,
    urlImageLinks,
    relativeImageLinks,
  };
};

export { processMarkdown };
