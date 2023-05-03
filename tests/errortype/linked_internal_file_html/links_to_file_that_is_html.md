# Tests if error shows when linked file has no matching heading

Run like: `node .\index.js -d tests/errortype/linked_internal_file_html`

- [Url to HTML file that exists - but has no matching heading (we probably don't do anchors in HTML yet)](file_exists.html#heading-to-match) yeah!

- [Url to HTML file that does not exists - show missing file error](file_not_exists.html#heading-to-match) yeah!


- [Url to HTML file that does not exists but markdown does - show appropriate error](file_exists_as_markdown.html#heading-to-match) yeah!