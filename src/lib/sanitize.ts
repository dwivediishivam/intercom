import sanitizeHtml from "sanitize-html";

const richTextTags = [
    "p",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "s",
    "blockquote",
    "code",
    "pre",
    "ul",
    "ol",
    "li",
    "a",
    "h1",
    "h2",
    "h3",
    "h4",
];

const commonOptions: sanitizeHtml.IOptions = {
  allowedTags: richTextTags,
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
  },
};

export function sanitizeRichText(html: string) {
  return sanitizeHtml(html, commonOptions);
}

export function stripUnsafeEmailHtml(html: string) {
  return sanitizeHtml(html, {
    ...commonOptions,
    allowedTags: [...richTextTags, "table", "thead", "tbody", "tr", "td", "th", "img"],
    allowedAttributes: {
      ...commonOptions.allowedAttributes,
      img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemesByTag: { img: ["https"] },
  });
}
