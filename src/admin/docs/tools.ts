"use client";
// Printing one A4 page, and turning the on-screen page into a self-contained HTML file
// (emailed to the guest as an attachment and opened from its link).

/** Prints only the given .a4wrap: it is copied into #print-root and everything else is hidden. */
export function printDoc(el: HTMLElement | null) {
  if (!el) return;
  let root = document.getElementById("print-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "print-root";
    document.body.appendChild(root);
  }
  root.innerHTML = "";
  root.appendChild(el.cloneNode(true));
  document.body.classList.add("printing");
  const done = () => {
    document.body.classList.remove("printing");
    root!.innerHTML = "";
    removeEventListener("afterprint", done);
  };
  addEventListener("afterprint", done);
  // Let images in the copy settle before the dialog opens.
  setTimeout(() => window.print(), 60);
}

const DOC_RULE = /\.a4|\.hv-|\.lh-|\.hv\b/;
const VARS = `:root{--paper:#fff;--ink:#0D1B3A;--ink-2:#4A5878;--ink-blue:#2F6CA8;--tint:#ECF9FB;--navy:#0A1734;--ok:#1E8E4E;--line:#E1E6EF;--shadow:rgba(10,23,52,.25);
--body:"Manrope",system-ui,sans-serif;--display:"Cormorant Garamond",Georgia,serif;--mono:"JetBrains Mono",ui-monospace,monospace}`;

function docCss() {
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const r of Array.from(rules)) {
      if (r instanceof CSSStyleRule && DOC_RULE.test(r.selectorText) && !r.selectorText.includes("print-root")) out.push(r.cssText);
    }
  }
  return out.join("\n");
}

const absolute = (u: string) => (/^(data:|https?:)/.test(u) ? u : new URL(u, location.origin).href);

/** A complete HTML page with the document, its styles and absolute image links. */
export function standaloneHtml(el: HTMLElement, title: string) {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("img").forEach((img) => img.setAttribute("src", absolute(img.getAttribute("src") || "")));
  copy.querySelectorAll<HTMLElement>("[style]").forEach((n) => {
    const s = n.getAttribute("style") || "";
    if (s.includes("url(")) n.setAttribute("style", s.replace(/url\((["']?)([^"')]+)\1\)/g, (_m, q, u) => `url(${q}${absolute(u)}${q})`));
  });
  const esc = title.replace(/[<&]/g, "");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Manrope:wght@400;500;600;700;800&display=swap">
<style>${VARS}
*{box-sizing:border-box}body{margin:0;background:#E9ECF2;padding:24px 12px;font-family:var(--body)}
${docCss()}
.a4wrap{margin:0 auto}
@page{size:A4;margin:0}
@media print{body{background:#fff;padding:0}.a4wrap{width:210mm;max-width:none}.a4{width:210mm;height:297mm;box-shadow:none;border-radius:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>${copy.outerHTML}</body></html>`;
}
