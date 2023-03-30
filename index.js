#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { program } = require("commander");

program
  .option(
    "-d, --directory [directory]",
    "The directory to search for markdown and html files",
    process.cwd()
  )
  .option(
    "-h, --headingAnchorSlugify [value]",
    "Slugify approach for turning markdown headings into heading anchors. Currently support vuepress only and always",
    "vuepress"
  )
  .option(
    "-t, --tryMarkdownforHTML [value]",
    "Try a markdown file extension check if a link to HTML fails.",
    true
  )
  .parse(process.argv);

const options = program.opts();

const isMarkdown = (file) => path.extname(file).toLowerCase() === ".md";
const isHtml = (file) => path.extname(file).toLowerCase() === ".html";
const replaceDelimiter = (str, underscore) =>
  underscore ? str.replace(/\s+/g, "_") : str.replace(/\s+/g, "-");

function slugifyVuepress(str) {
  const slug = str
    .toLowerCase()
    .replace(/\/+/g, "-") // replace / with hyphens
    .replace(/[^A-Za-z0-9/]+/g, "-") // replace non-word characters except / with hyphens
    .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ""); // Remove extra hyphens from the beginning or end of the string

  if (str.includes("/")) {
    //console.log(`DEBUG: SLUG: str: ${str} slug: ${slug}`);
  }
  return `${slug}`;
}

const processHeading = (line, slugifyApproach) => {
  const matches = line.match(/^#+\s+(.+)$/);
  if (matches) {
    //slugifyApproach is currently only slugifyVuepress so we do no test.
    return slugifyVuepress(matches[1]);
  }
  return null;
};

const processMarkdownLink = (
  line,
  relativeLinks,
  relativeImageLinks,
  absoluteLinks,
  absoluteImageLinks,
  unHandledLinkTypes
) => {
  const matches = line.matchAll(/([!@]?)\[([^\]]+)\]\((\S+?)\)/g);

  // TODO - THIS matches @[youtube](gjHj6YsxcZk) valid link which is used for vuepress plugin URLs. We probably want to exclude it and deal with it separately
  // Maybe a backwards lookup on @
  // Not sure if we can generalize

  for (const match of matches) {
    const isMarkdownImageLink = match[1] == "!" ? true : false;
    const isVuepressYouTubeLink = match[1] == "@" ? true : false;

    const linkText = match[2];
    let linkUrl = match[3];
    const linkAnchorSplit = linkUrl.split("#");
    linkUrl = linkAnchorSplit[0].trim();
    const linkAnchor = linkAnchorSplit[1] ? linkAnchorSplit[1] : null;

    const link = { linkText, linkUrl, linkAnchor };

    if (isVuepressYouTubeLink) {
      if (linkUrl.startsWith("http")) {
        absoluteLinks.push(link);
      } else {
        unHandledLinkTypes.push(link); // Not going to handle this (yet)
        // TODO - prepend the standard URL
      }
    } else if (linkUrl.startsWith("http")) {
      isMarkdownImageLink
        ? absoluteImageLinks.push(link)
        : absoluteLinks.push(link);
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

  //Match for html img and a - append to the lists
  const regexHTMLLinks =
    /<(a|img)[^>]*(href|src)="([^"]+)"[^>]*(?:title="([^"]+)"|>([^<]+)<\/\1>)/gi;

  for (const match of line.matchAll(regexHTMLLinks)) {
    const isMarkdownImageLink = match[1] == "img" ? true : false;
    //const tagType = match[1];
    //const hrefOrSrc = match[2];
    let linkUrl = match[3];
    const linkText = match[4] || match[5] || "";
    const linkAnchorSplit = linkUrl.split("#");
    linkUrl = linkAnchorSplit[0];
    const linkAnchor = linkAnchorSplit[1] ? linkAnchorSplit[1] : null;
    const link = { linkText, linkUrl, linkAnchor };

    if (linkUrl.startsWith("http")) {
      isMarkdownImageLink
        ? absoluteImageLinks.push(link)
        : absoluteLinks.push(link);
    } else {
      isMarkdownImageLink
        ? relativeImageLinks.push(link)
        : relativeLinks.push(link);
    }
  }

  return {
    relativeLinks,
    absoluteLinks,
    absoluteImageLinks,
    relativeImageLinks,
  };
};

const processFile = async (file, slugifyApproach) => {
  try {
    const contents = await fs.promises.readFile(file, "utf8");
    const lines = contents.split(/\r?\n/);
    const anchors = [];
    const htmlAnchors = []; //{};
    const relativeLinks = [];
    const absoluteLinks = [];
    const absoluteImageLinks = [];
    const relativeImageLinks = [];
    const unHandledLinkTypes = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const heading = processHeading(line, slugifyApproach);
      if (heading) {
        anchors.push(heading);
      }

      const links = processMarkdownLink(
        line,
        relativeLinks,
        relativeImageLinks,
        absoluteLinks,
        absoluteImageLinks,
        unHandledLinkTypes
      );
    }

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
            /*
            if (!htmlAnchors[tag]) {
              htmlAnchors[tag] = [];
            }
            htmlAnchors[tag].push(id);
            */
            htmlAnchors.push(id);
          }
        }
      });
    }

    return {
      page_file: file,
      anchors_auto_headings: anchors,
      anchors_tag_ids: htmlAnchors,
      relativeLinks,
      absoluteLinks,
      absoluteImageLinks,
      relativeImageLinks,
      unHandledLinkTypes,
    };
  } catch (err) {
    console.error(`Error processing file ${file}: ${err.message}`);
    console.error(err);
    return null;
  }
};

const processDirectory = async (dir, slugifyApproach) => {
  const files = await fs.promises.readdir(dir, { withFileTypes: true });
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = path.join(dir, files[i].name);
    if (files[i].isDirectory()) {
      const subResults = await processDirectory(file, slugifyApproach);
      results.push(...subResults);
    } else if (isMarkdown(file) || isHtml(file)) {
      const result = await processFile(file, slugifyApproach);
      if (result) {
        results.push(result);
      }
    }
  }
  return results;
};

function processRelativeLinks(results) {
  results.forEach((page, index, array) => {
    //console.log(page);

    page.relativeLinks.forEach((link, index, array) => {
      //console.log(link);
      //resolve the path for the link
      const page_rel_path = page.page_file.split(options.directory)[1];
      if (link.linkUrl === "") {
        //page local link - check current page for headings
        //console.log(link);

        if (
          page.anchors_auto_headings.includes(link.linkAnchor) ||
          page.anchors_tag_ids.includes(link.linkAnchor)
        ) {
          //do nothing - we're good
        } else {
          console.log(
            `ERROR: ${page_rel_path}: Missing local anchor [${link.linkText}](#${link.linkAnchor})`
          );
          /*
          console.log(`DEBUG: Anchor: BB${link.linkAnchor}BB - AutoHeadingAnchors BB${page.anchors_auto_headings}BB`);
          console.log(page.anchors_auto_headings);
          */
        }
      } else {
        // relative link on another page.

        //find the path of the linked page.
        const linkAbsoluteFilePath = path.resolve(
          path.dirname(page.page_file),
          link.linkUrl
        );

        // Get the matching file matching our link, if it exists
        let linkedFile =
          results.find(
            (linkedFile) =>
              linkedFile.hasOwnProperty("page_file") &&
              path.normalize(linkedFile.page_file) === linkAbsoluteFilePath
          ) || null;

        if (!linkedFile) {
          if (
            options.tryMarkdownforHTML &&
            linkAbsoluteFilePath.endsWith(".html")
          ) {
            // The file was HTML so it might be a file extension mistake (linking to html instead of md)
            // In this case we'll try find it.

            const markdownAbsoluteFilePath = `${
              linkAbsoluteFilePath.split(".html")[0]
            }.md`;
            const linkedHTMLFile =
              results.find(
                (linkedHTMLFile) =>
                  linkedHTMLFile.hasOwnProperty("page_file") &&
                  path.normalize(linkedHTMLFile.page_file) ===
                    markdownAbsoluteFilePath
              ) || null;

            if (linkedHTMLFile) {
              console.log(
                `: ${page_rel_path}: WARN: Link to .html not .md '${link.linkUrl}' with text '${link.linkText}' (${linkAbsoluteFilePath} )`
              );
              linkedFile = linkedHTMLFile;
            }
          }
        }

        if (!linkedFile) {
          //File not found as .html or md
          console.log(
            `ERROR: ${page_rel_path}: ERROR Broken rel. link '${link.linkUrl}' with text '${link.linkText}' (${linkAbsoluteFilePath} )`
          );
        } else {
          // There is a link, so now see if there are anchors, and whether they work
          if (!link.linkAnchor) {
            //null
            return;
          } else if (
            linkedFile.anchors_auto_headings.includes(link.linkAnchor) ||
            linkedFile.anchors_tag_ids.includes(link.linkAnchor)
          ) {
            //
            //do nothing - we're good
          } else {
            // Link exists, but anchor broken

            const link_rel_path = linkedFile.page_file.split(
              options.directory
            )[1];

            console.log(
              `WARN: ${page_rel_path}: Missing anchor \`${link.linkAnchor}\` linked in '${link_rel_path}' (linktext '${link.linkText}')`
            );
            //console.log(`ERRORS CAUSED BY INCORRECT GUESS ABOUT FORMAT OF / in the new URL - e.g. mounting/orientation`)
          }
        }
      }
    });
  });
}

(async () => {
  const results = await processDirectory(
    options.directory,
    options.headingAnchorSlugify
  );
  //console.log(JSON.stringify(results, null, 2));

  processRelativeLinks(results);
})();

//OpenQuestions
// Handle page link to #itself
