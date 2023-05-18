# Test

Run like: `node .\index.js -d tests/links/linkreference/`

Confirm we pick up references

[reference 1]: http://this.com/is/a/url/refererence        
[reference 2]: http://this.com/is/a/url/refererence  withtextafternoquoteisinvalid    
[reference 3]: http://this.com/is/a/url/refererence  "is title in doublequote"     
[reference 4]: http://this.com/is/a/url/refererence  'is title in singlequote'   
[reference 5]: http://this.com/is/a/url/refererence  'is title in singlequote but has text after'   with following text.
[relativepathref]: /a/relative/path

[pathref with whitespace   ]: /a/path/ref/first/should/be/used

[pathref with  whitespace]: /a/path/ref/second/should/not/be/used

[  pathref WITH Capitals AnD  whitespace  ]: /a/path/ref/second/should/not/be/used

[ onespacebefore  twospace   threespace    fourspace WITH Capitals AnD  whitespace  ]: /a/path/ref/second/should/not/be/used

[  pathref with whitespace]: /a/path/ref/link/but/should/not/be/used

  [reference indented two spaces]: /a/path/ref
  
   [reference indented THREEE spaces]: /a/path/ref
   
    [reference indented 4 spaces should  be ignored]: /a/path/ref
	
[ref with trailing text not title is error]: /a/path/ref trailingtextnot_matched_as_title.  

[ref with trailing text after title is error]: /a/path/ref 'ref title text' trailingtextnot_matched_as_title_after_title .  