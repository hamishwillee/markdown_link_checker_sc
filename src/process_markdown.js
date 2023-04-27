import { splitURL } from "./helpers.js";

// Returns slug for a string (markdown heading) using Vuepress algorithm.
// Algorithm from chatgpt - needs testing.
const processMarkdown = (contents, options) => {
  const headings = [];
  //const anchors = [];
  const htmlAnchors = []; //{};
  const relativeLinks = [];
  const urlLinks = [];
  const urlLocalLinks = [];
  const urlImageLinks = [];
  const relativeImageLinks = [];
  const unHandledLinkTypes = [];
  let redirectTo; //Pages that contain <Redirect to="string"/> links

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
        headings.push(matches[1]);
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
        options
      );
    }

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
  options
) => {
  //const regex = /(?<prefix>[!@]?)\[(?<text>[^\]]+)\]\((?<url>\S+?)(?:\s+"(?<title>[^"]+)")?\)/g;
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

    // Split URL into address, anchor and params
    const {
      address: linkAddress,
      anchor: linkAnchor,
      params: linkParams,
    } = splitURL(url);
    const link = {
      linkUrl,
      linkText,
      linkAddress,
      linkAnchor,
      linkParams,
      linkTitle,
    };
    //console.log(link);

    if (isVuepressYouTubeLink) {
      if (linkUrl.startsWith("http")) {
        urlLinks.push(link);
      } else {
        unHandledLinkTypes.push(link); // Not going to handle this (yet)
        // TODO - prepend the standard URL
      }
    } else if (
      options.site_url &&
      (linkUrl.startsWith(`http://${options.site_url}`) ||
        linkUrl.startsWith(`https://${options.site_url}`))
    ) {
      //console.log(link);
      urlLocalLinks.push(link);
    } else if (linkUrl.startsWith("http")) {
      isMarkdownImageLink ? urlImageLinks.push(link) : urlLinks.push(link);
    } else if (
      linkUrl.startsWith("ftp:") ||
      linkUrl.startsWith("ftps") ||
      linkUrl.startsWith("mailto")
    ) {
      // One of the types we specifically do not handle
      unHandledLinkTypes.push(link);
    } else if (
      linkUrl.endsWith(".png") ||
      linkUrl.endsWith(".jpg") ||
      linkUrl.endsWith(".jpeg") ||
      linkUrl.endsWith(".gif") ||
      linkUrl.endsWith(".webp")
    ) {
      //console.log("???Markdown");
      //Catch case where image link is inside
      relativeImageLinks.push(link);
    } else {
      isMarkdownImageLink
        ? relativeImageLinks.push(link)
        : relativeLinks.push(link);
    }
  }

  //Match for html a - append to the lists
  const regexHTMLLinkTotal = /<a\s+(?<attributes>.*?)>(?<linktext>.*?)<\/a>/gi;
  const regexHTMLTitle =
    /title\s*[=]\s*(?<quote>['"])(?<title>.*?)(?<!\\)\k<quote>/i;
  //title\s*[=]\s*(?<title>['"]?)([^'"\s>]+)\k<title>/i;
  const regexHTMLhref =
    /href\s*[=]\s*(?<quote>['"])(?<href>.*?)(?<!\\)\k<quote>/i;
  for (const match of line.matchAll(regexHTMLLinkTotal)) {
    const attributes = match.groups.attributes;
    //console.log(`XXXXXattributes_s: ${attributes}`)
    const linkText =
      match && match.groups.linktext ? match.groups.linktext : "";
    //console.log(`XXXXXlinktext: ${linktext}`)
    let linkTitle = "";
    let linkUrl = "";
    if (attributes) {
      const titlematch = attributes.match(regexHTMLTitle);
      linkTitle =
        titlematch && titlematch.groups.title ? titlematch.groups.title : "";
      const hrefmatch = attributes.match(regexHTMLhref);
      linkUrl = hrefmatch && hrefmatch.groups.href ? hrefmatch.groups.href : "";
    }

    const {
      address: linkAddress,
      anchor: linkAnchor,
      params: linkParams,
    } = splitURL(linkUrl);
    const link = {
      linkUrl,
      linkText,
      linkAddress,
      linkAnchor,
      linkParams,
      linkTitle,
    };
    if (linkUrl) {
      linkUrl.startsWith("http")
        ? urlLinks.push(link)
        : relativeLinks.push(link);
    }
  }

  //Match for html img - append to the lists
  const regexHTMLImgTotal = /<img\s+(?<attributes>.*?)\/>/gi;
  const regex_htmlattr_src =
    /src\s*[=]\s*(?<quote>['"])(?<src>.*?)(?<!\\)\k<quote>/i;
  for (const match of line.matchAll(regexHTMLImgTotal)) {
    const attributes = match.groups.attributes;
    //console.log(`XXXXXImageattributes_s: ${attributes}`)
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

    const {
      address: linkAddress,
      anchor: linkAnchor,
      params: linkParams,
    } = splitURL(linkUrl);
    const link = {
      linkUrl,
      linkText,
      linkAddress,
      linkAnchor,
      linkParams,
      linkTitle,
    };
    if (linkUrl) {
      linkUrl.startsWith("http")
        ? urlImageLinks.push(link)
        : relativeImageLinks.push(link);
    }

    //console.log(link);
  }

  /*
  const regexHTMLLinks =
    /<(a|img)[^>]*(href|src)="([^"]+)"[^>]*(?:title="([^"]+)"|>([^<]+)<\/\1>)/gi;

  for (const match of line.matchAll(regexHTMLLinks)) {
    const isMarkdownImageLink = match[1] == "img" ? true : false;
    //const tagType = match[1];
    //const hrefOrSrc = match[2];
    let linkUrl = match[3];
    const linkText = match[4] || match[5] || "";
    const linkTitle = match.title ? match.title : "";
    const { address: linkAddress, anchor: linkAnchor, params: linkParams } = splitURL(linkUrl);
    const link = { linkUrl, linkText, linkAddress, linkAnchor, linkParams, linkTitle };

    if (linkUrl.startsWith("http")) {
      isMarkdownImageLink ? urlImageLinks.push(link) : urlLinks.push(link);
    } else {
      isMarkdownImageLink
        ? relativeImageLinks.push(link)
        : relativeLinks.push(link);
    }
  }
*/

  return {
    relativeLinks,
    urlLinks,
    urlImageLinks,
    relativeImageLinks,
  };
};

export { processMarkdown };
