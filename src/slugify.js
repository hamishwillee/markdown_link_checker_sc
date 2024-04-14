// Returns slug for a string (markdown heading) using Vuepress algorithm.
// Algorithm from chatgpt - needs testing.
function slugifyVuepress(str) {
  //console.log(`DEBUG: SLUG: str: ${str}`);
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

export { slugifyVuepress };
