# Tests if missing page in toc throws error (test page is in toc)

Run like: 
- `node .\index.js -d tests/errortype/orphan_images/test` 
  - should just pick up "\test\image3_not_linked.png"
- `node .\index.js -d tests/errortype/orphan_images/test -i tests/errortype/orphan_images/assets`
  - should pick up "\test\image3_not_linked.png", \assets\image1_not_linked.png, \assets\image2_not_linked.png


 
- ![Image 4 is linked - should not show error](image4_linked.png)