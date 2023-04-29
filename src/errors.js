/*
const error = {
  type: "InternalMissingAnchor",
  page: `${page.page_file}`,
  linkAnchor: `${link.anchor}`,
  linkUrl: `${link.url}`,
  linkText: `${link.text}`,
  linkUrlFilePath: `${linkAbsoluteFilePath}`,
};
*/

class Error {
  constructor(type = "", link = null) {
    this.type = type;
    this.page = "";
    this.link = link;
    this.blahdelme = "Delete me";
  }
}


export { Error };
