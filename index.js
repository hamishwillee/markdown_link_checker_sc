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
    "-s, --headingAnchorSlugify [value]",
    "Slugify approach for turning markdown headings into heading anchors. Currently support vuepress only and always",
    "vuepress"
  )
  .option(
    "-t, --tryMarkdownforHTML [value]",
    "Try a markdown file extension check if a link to HTML fails.",
    true
  )
  .option("-l, --log [value]", "Export some logs for debugging. ", false)
  .option(
    "-f, --files <path>",
    "JSON file with array of files to report on (default is all files). Paths are relative relative to -d by default, but -r can be used to set a different root.",
    ""
  )
  .option(
    "-r, --root <path>",
    "Directory to prepend before file paths in the JSON directory. Default is same as directory. Useful if directory is not your repo root",
    ""
  )
  .parse(process.argv);

// TODO PX4 special parsing - errors or pages we exclude by default.
// Particular error types on particular pages?

const options = program.opts();

// Function for loading JSON file that contains files to report on
async function loadJSONFileToReportOn(filePath) {
  try {
    const fileContent = await fs.promises.readFile(filePath, "utf8");
    let filesArray = JSON.parse(fileContent);
    // Prepend the full path - either from root or directory
    if (options.root) {
      filesArray = filesArray.map((str) => path.join(options.root, str));
    } else {
      //
      filesArray = filesArray.map((str) => path.join(options.directory, str));
    }

    //console.log(filesArray);
    return filesArray;
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    process.exit(1);
  }
}

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
    const allErrors = [];
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
      allErrors,
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
  if (!results.allErrors) {
    results["allErrors"] = [];
  }
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
          const error = {
            type: "InternalLocalMissingAnchor",
            page: `${page.page_file}`,
            linkAnchor: `${link.linkAnchor}`,
            linkText: `${link.linkText}`,
          };

          results.allErrors.push(error);
          //console.log(error);
          //console.log( `ERROR: ${page_rel_path}: Missing local anchor [${link.linkText}](#${link.linkAnchor})` );
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
              const error = {
                type: "InternalLinkToHTML",
                page: `${page.page_file}`,
                linkUrl: `${link.linkUrl}`,
                linkText: `${link.linkText}`,
                linkUrlFilePath: `${linkAbsoluteFilePath}`,
              };
              results.allErrors.push(error);
              // console.log(`: ${page_rel_path}: WARN: Link to .html not .md '${link.linkUrl}' with text '${link.linkText}' (${linkAbsoluteFilePath} )` );
              linkedFile = linkedHTMLFile;
            }
          }
        }

        if (!linkedFile) {
          //File not found as .html or md
          const error = {
            type: "InternalLinkMissingFile",
            page: `${page.page_file}`,
            linkUrl: `${link.linkUrl}`,
            linkText: `${link.linkText}`,
            linkUrlFilePath: `${linkAbsoluteFilePath}`,
          };
          results.allErrors.push(error);
          // console.log(`ERROR: ${page_rel_path}: ERROR Broken rel. link '${link.linkUrl}' with text '${link.linkText}' (${linkAbsoluteFilePath} )` );
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
            const error = {
              type: "InternalMissingAnchor",
              page: `${page.page_file}`,
              linkAnchor: `${link.linkAnchor}`,
              linkUrl: `${link.linkUrl}`,
              linkText: `${link.linkText}`,
              linkUrlFilePath: `${linkAbsoluteFilePath}`,
            };
            results.allErrors.push(error);
            //console.log( `WARN: ${page_rel_path}: Missing anchor \`${link.linkAnchor}\` linked in '${link_rel_path}' (linkText '${link.linkText}')` );
            //console.log(`ERRORS CAUSED BY INCORRECT GUESS ABOUT FORMAT OF / in the new URL - e.g. mounting/orientation`)
          }
        }
      }
    });
  });
}

function filterErrors(errors) {
  // This method filters all errors against settings in the command line - such as pages to output.
  let filteredErrors = errors;
  // Filter results on specified file names (if any specified)
  //console.log(`Number pages to filter: ${options.files.length}`);
  if (options.files.length > 0) {
    filteredErrors = errors.filter((error) => {
      //console.log(`Error: ${error}`);
      //console.log(JSON.stringify(error, null, 2));
      //console.log(`Error page: ${error.page}`);

      return options.files.includes(error.page);
    });
  }
  // Filter on other things - such as errors.

  //console.log(filteredErrors);
  return filteredErrors;
}

function outputErrors(results) {
  //console.log(results.allErrors);

  // Strip out any files that are not in options.files
  // if this is empty skip step
  // These are path relative, so we will need to
  //console.log(`File options: ${options.files}`);

  //Sort results by page and type.
  // Perhaps next step is to create only get info for particular pages.
  const sortedByPageErrors = {};

  //for (const error of results.allErrors) {
  for (const error of results) {
    //Report errors for listed pages or all
    //console.log("error:");
    //console.log(error);
    //console.log(error.page);
    if (!sortedByPageErrors[error.page]) {
      sortedByPageErrors[error.page] = [];
    }
    sortedByPageErrors[error.page].push(error);

    // Sort by type as well.
    for (const page in sortedByPageErrors) {
      sortedByPageErrors[page].sort((a, b) => a.type.localeCompare(b.type));
    }
  }

  //console.log(sortedByPageErrors);
  for (page in sortedByPageErrors) {
    let pageFromRoot;
    if (options.root) {
      pageFromRoot = page.split(options.root)[1];
    } else {
      pageFromRoot = page.split(options.directory)[1];
    }

    console.log(`\n${pageFromRoot}`);
    for (const error of sortedByPageErrors[page]) {
      if (error.type == "InternalLinkMissingFile") {
        console.log(`- ${error.type}: ${error.linkUrl}`);
        //console.log(`  ${error.type}: ${error.linkAnchor}, linkURL: ${error.linkUrl}`);
        // { "type": "InternalLinkMissingFile", "page": `${page.page_file}`, "linkUrl": `${link.linkUrl}`, "linkText": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}` };
      } else if (error.type == "InternalLocalMissingAnchor") {
        // missing anchor in linked file that exists.
        //console.log(error);
        console.log(
          `- ${error.type}: ` +
            "`[" +
            `${error.linkText}](#${error.linkAnchor})` +
            "` (Internal link without matching heading name or element id)"
        );
        //console.log(          `- ${error.type}: #${error.linkAnchor} (Internal link without matching heading name or element id)`        );
        //console.log(`  ${error.type}: #${error.linkAnchor} (heading/anchor missing?)`);
        //console.log(`  #${error.linkAnchor} - Internal anchor not found`);
        //console.log(`  [${error.linkText}](#${error.linkAnchor}) - Anchor not found`);
        //console.log(`  Internal anchor not found: #${error.linkAnchor} `);
        // `{ "type": "InternalLocalMissingAnchor", "page": "${page.page_file}", "anchor": "${link.linkAnchor}", "linktext", "${link.linkText}"  }`;
      } else if (error.type == "InternalMissingAnchor") {
        // missing anchor in linked file that exists.
        //console.log(error);
        console.log(
          `- ${error.type}: #${error.linkAnchor} not found in ${error.linkUrlFilePath}`
        );
        //console.log(`  ${error.type}: #${error.linkAnchor} (heading/anchor missing?)`);
        //console.log(`  #${error.linkAnchor} - Internal anchor not found`);
        //console.log(`  [${error.linkText}](#${error.linkAnchor}) - Anchor not found`);
        //console.log(`  Internal anchor not found: #${error.linkAnchor} `);
        // { "type": "InternalMissingAnchor", "page": `${page.page_file}`, "linkAnchor": `${link.linkAnchor}`, "linkUrl": `${link.linkUrl}`, "linktext": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}` };
      } else if (error.type == "InternalLinkToHTML") {
        console.log(`- ${error.type}: ${error.linkUrl} (should be ".md"?)`);
        //console.log(`  ${error.type}: linkURL: ${error.linkUrl} ends in ".html"`);
        // { "type": "InternalLinkToHTML", "page": `${page.page_file}`, "linkUrl": `${link.linkUrl}`, "linkText": `${link.linkText}`, "linkUrlFilePath": `${linkAbsoluteFilePath}`  };
      } else {
        console.log(error);
      }
    }
    //console.log(page)
    //console.log(page.errors);
  }
}

(async () => {
  options.files
    ? (options.files = await loadJSONFileToReportOn(options.files))
    : (options.files = []);
  if (options.log == "quick") {
    for (const file of options.files) {
      console.log(file);
    }
  }

  //const object = filesToProcessJSONFilePath ? await convertFileToObject(filePath) : [];

  const results = await processDirectory(
    options.directory,
    options.headingAnchorSlugify
  );

  processRelativeLinks(results);
  const filteredResults = filterErrors(results.allErrors);
  outputErrors(filteredResults);

  //console.log(JSON.stringify(results, null, 2));
  //console.log("AllErrors");
  if (options.log == "allerrors") {
    console.log(JSON.stringify(results.allErrors, null, 2));
  }
})();

//OpenQuestions
// Handle page link to #itself
