# Test

Run like: `node .\index.js -d tests/links/linkreference/links/`

Confirm we pick up references

- [this is the link text before references][this is the reference 1] And why not
- [link text before references without reference][reference does not exist] so there

Image URL tests
- ![image link text to non-image URL][this is the reference 1] thingy
- ![image link text to image URL][this ref to image url]
- [image url but not image link][this ref to image url]


Image URL tests
- ![image link text to non-image URL][this is the reference 1] thingy
- ![image link text to image URL][this ref to image url]
- [image url but not image link][this ref to image url]
- ![image link text to relative URL][rel ref to image url]


[this is the reference 1]: http://this.com/is/a/url/refererence        
[this is reference 2]: http://this.com/is/a/url/refererence  'is title in singlequote'   

[this ref to image url]: http://this.com/is/a/url/animage.jpg  'is title in singlequote'  


[rel ref to image url]: ../url/arelimage.jpg  'is title in singlequote'  


This is some text [this is the link text after reference 2][   this is reference   2] And why not
