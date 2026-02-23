# Page A

## Internal Section

<!-- INLINE MARKDOWN LINKS -->
[Relative link to page B](./page_b.md)
[Relative link with anchor](./page_b.md#heading-in-page-b)
[Anchor-only link in current page](#internal-section)
[Link with title](./page_b.md "Title text")
[External URL](https://example.com)
[Mailto link](mailto:test@example.com)
[FTP link](ftp://example.com)

<!-- INLINE MARKDOWN IMAGES -->
![Relative image](./assets/test.png)
![External image](https://example.com/image.png)

<!-- HTML ANCHOR TAGS -->
<a href="./page_b.md">HTML link to page B</a>
<a href="#internal-section">HTML anchor-only link</a>
<a href="https://example.com">HTML external URL</a>
<a href="./page_b.md" title="a title">HTML link with title</a>

<!-- HTML IMAGE TAGS -->
<img src="./assets/test.png" />
<img src="https://example.com/image.png" />

<!-- REFERENCE LINKS -->
[Reference link][page-b-ref]
[Reference URL][url-ref]
![Reference relative image][img-ref]
![Reference external image][ext-img-ref]

[page-b-ref]: ./page_b.md
[url-ref]: https://example.com
[img-ref]: ./assets/test.png
[ext-img-ref]: https://example.com/image.png

<!-- KNOWN LIMITATION: autolinks <https://example.com> are NOT detected -->
<!-- KNOWN LIMITATION: [text][missing] raises ReferenceForLinkNotFound but is NOT currently pushed to errors -->
