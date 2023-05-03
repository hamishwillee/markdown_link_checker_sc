# Tests if linked images not in file system show up as errors

Run like: `node .\index.js -d tests/errortype/local_image_not_found`
 
This has links to images that exist/don't exist in file system

- ![Missing JPG 1 - should show as error](missing_jpg1.jpg)
- ![Missing PNG 1 - should show as error](missing_png1.png)
- ![Present PNG - should NOT show as error](test.png)
