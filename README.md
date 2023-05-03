# markdown link checker sc

ALPHA - Mostly just attempting better handling of internal links.
Probably never coming out of alpha. Bit of fun.

Markdown link checker in node.
Better handling of internal link checking.

Current version only does internal link checking

```
Usage: markdown_link_checker_sc [options]

Options:
  -r, --root <path>                   Root directory of your source (i.e. root of github repo). Use -d as well to specify a folder if docs are not in the root, or to just run on
                                      particular subfolder. Defaults to current directory. (default: "D:\\github\\hamishwillee\\markdown_link_checker_sc")
  -d, --directory [directory]         The directory to search for markdown and html files, relative to root - such as: `en` for an English subfolder. Default empty (same as -r
                                      directory) (default: "")
  -i, --imagedir [directory]          The directory to search for all image files for global orphan checking, relative to root - such as: `assets` or `en`. Default empty if not
                                      explicitly set, and global orphan checking will not be done (default: "")
  -c, --headingAnchorSlugify [value]  Slugify approach for turning markdown headings into heading anchors. Currently support vuepress only and always (default: "vuepress")
  -t, --tryMarkdownforHTML [value]    Try a markdown file extension check if a link to HTML fails. (default: true)
  -l, --log <types...>                Export logs for debugging. Types: allerrors, filterederrors, allresults etc.
  -f, --files <path>                  JSON file with array of files to report on (default is all files). Paths are relative relative to -d by default, but -r can be used to set a
                                      different root. (default: "")
  -s, --toc [value]                   full filename of TOC/Summary file in file system. If not specified, inferred from file with most links to other files
  -u, --site_url [value]              Site base url in form dev.example.com (used to catch absolute urls to local files)
  -h, --help                          display help for command
```


## What link formats can it match

Currently matches:
- `\[Link text](url#anchor)`, `\[Link text](url#anchor?param1=value...)`, `\[Link text](url?param1=value...#anchor)`
- `[Link text](url#anchor "title")`
- `![Image alt](url)`
- `<a href="someurl#someanchor?someparams" title="sometitle">some text</a>`
- `<img src="someurl" title="sometitle" />`


> **Note:** It uses simple regexp. If you have a link commented out, or inside a code block that may well be captured.

There are heaps of link formats it does not match:

- `<http://www.whatever.com>` - doesn't support autolinks
- `www.fred.com` - Doesn't support auto-links external.
- `[![image title](imageurl)](linkurl)`- Doesn't properly support a link around an image.
- `linkreference: linkurl` - Doesn't support reference links (which would be linked like `[link text][linkreference]`


Essentially lots of the other things https://github.github.com/gfm/ 


The regex that drives this is very simple.


There are many other alternatives, such as: https://github.com/tcort/markdown-link-check
You might also use a tokenziker or round trip to HTML using something like https://marked.js.org/using_advanced#inline in future as HTML is eaiser to extract links from.

This does catch a LOT of cases though, and is pretty quick.

## TODO

- Files passed in should be filtered to check if markdown and only use the markdown ones in the markdown areas.
- Files passed in shoudl be filtered for image types.
  All image types passed in should be checked to make sure they are not orphans.

Anchors that are not url escaped can trip it up. 
- You can URL escape them like this: [Airframe Reference](#underwater_robot_underwater_robot_hippocampus_uuv_%28unmanned_underwater_vehicle%29)
- BUT the comparision of the anchor is NOT url escaped, so you would need to convert back to compare.
- URL escaping anchors and reversing for comparison is not done.

Anchors defined in id in a or span are caught. Need to check those in video, div are also caught and used in internal link checking.

A way to indicate that a particular error can be ignored - e.g. by page, type, maybe by line etc. Perhaps make this something that can be turned on and off.

Get images in/around the source files that are not linked - i.e. orphan images.



# How does it work?

The way this works:
- Specify the directory and it will searc
h below that for all markdown/html files.
- It loads each file, and:
  - parses for markdown and html style links for both page and image links.
  - parses headings and builds list of anchors in the page (as per vuepress) for those headings (poorly tested code)
  - parses for html elements with ids, that are also link targets. 
- Then it parses the results, comparing internal links to internal anchors to see if it can find matching files, and matching headings or anchors within files.
  - If it can't match, that is an error - which gets added to the list of errors with a type and enough detail to handle.
- Errors are then filtered based on:
  - pages in a json file defined using -f (and possibly -r). 
- Finally the output is exported in a markdown friendly output format.

Lots more to do, but this already catches lots of internal errors.
