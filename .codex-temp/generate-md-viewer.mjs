import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workspace = "D:/Inventory Forecast Rules";
const sourcePath = path.join(workspace, "prd", "备货规则配置页面需求.md");
const outputPath = path.join(workspace, "prd", "备货规则配置页面需求.html");
const markedPath = path.join(
  "C:/Users/MI/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/marked/lib/marked.esm.js",
);

const { marked } = await import(pathToFileURL(markedPath).href);

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const slugCounts = new Map();
const slugify = (text) => {
  const base =
    text
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/&[^;]+;/g, "")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-") || "section";
  const count = slugCounts.get(base) || 0;
  slugCounts.set(base, count + 1);
  return count ? `${base}-${count + 1}` : base;
};

let markdown = await fs.readFile(sourcePath, "utf8");
const sourceStat = await fs.stat(sourcePath);

const mathBlocks = [];
markdown = markdown.replace(/\\\[([\s\S]*?)\\\]/g, (_, body) => {
  const token = `@@DISPLAY_MATH_${mathBlocks.length}@@`;
  mathBlocks.push(body.trim());
  return `\n\n${token}\n\n`;
});

const inlineMath = [];
markdown = markdown.replace(/\\\(([\s\S]*?)\\\)/g, (_, body) => {
  const token = `@@INLINE_MATH_${inlineMath.length}@@`;
  inlineMath.push(body.trim());
  return token;
});

marked.setOptions({
  async: false,
  breaks: false,
  gfm: true,
  mangle: false,
});

let articleHtml = marked.parse(markdown);
articleHtml = articleHtml.replace(/@@DISPLAY_MATH_(\d+)@@/g, (_, index) => {
  const body = escapeHtml(mathBlocks[Number(index)]);
  return `<div class="math-block">\\[${body}\\]</div>`;
});
articleHtml = articleHtml
  .replace(/<p>\s*(<div class="math-block">[\s\S]*?<\/div>)\s*<\/p>/g, "$1")
  .replace(/<p>\s*(<div class="math-block">[\s\S]*?<\/div>)/g, "$1")
  .replace(/(<\/div>)\s*<\/p>/g, "$1");
articleHtml = articleHtml.replace(/@@INLINE_MATH_(\d+)@@/g, (_, index) => {
  const body = escapeHtml(inlineMath[Number(index)]);
  return `<span class="math-inline">\\(${body}\\)</span>`;
});

const headings = [];
articleHtml = articleHtml.replace(
  /<h([1-6])>([\s\S]*?)<\/h\1>/g,
  (match, level, innerHtml) => {
    const text = innerHtml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const id = slugify(text);
    headings.push({ level: Number(level), text, id });
    return `<h${level} id="${id}"><a class="heading-anchor" href="#${id}" aria-label="Link to ${escapeHtml(text)}">#</a>${innerHtml}</h${level}>`;
  },
);

const tocHtml = headings
  .filter((heading) => heading.level <= 3)
  .map(
    (heading) =>
      `<a class="toc-link toc-level-${heading.level}" href="#${heading.id}">${escapeHtml(heading.text)}</a>`,
  )
  .join("\n");

const title = headings[0]?.text || "备货规则配置页面 PRD";
const updatedAt = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
}).format(sourceStat.mtime);

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <script>
    window.MathJax = {
      tex: {
        inlineMath: [['\\\\(', '\\\\)']],
        displayMath: [['\\\\[', '\\\\]']],
        processEscapes: true
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
      },
      startup: {
        pageReady: () => MathJax.startup.defaultPageReady().then(() => {
          document.documentElement.classList.add('math-ready');
        })
      }
    };
  </script>
  <script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f8fa;
      --paper: #ffffff;
      --ink: #24292f;
      --muted: #57606a;
      --subtle: #6e7781;
      --border: #d8dee4;
      --border-strong: #afb8c1;
      --code-bg: #f6f8fa;
      --code-ink: #0f172a;
      --accent: #0969da;
      --accent-soft: #ddf4ff;
      --green: #1a7f37;
      --amber: #9a6700;
      --shadow: 0 12px 40px rgba(27, 31, 36, 0.08);
      --sans: "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif;
      --mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      --serif: Cambria, "Times New Roman", "Noto Serif CJK SC", serif;
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
      text-size-adjust: 100%;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 16px;
      line-height: 1.72;
      overflow-wrap: break-word;
    }

    a {
      color: var(--accent);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .viewer {
      display: grid;
      grid-template-columns: minmax(252px, 304px) minmax(0, 1fr);
      min-height: 100vh;
    }

    .sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      overflow: auto;
      border-right: 1px solid var(--border);
      background: #ffffff;
      padding: 28px 20px 32px;
    }

    .sidebar-title {
      margin: 0 0 4px;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.4;
      color: var(--ink);
    }

    .sidebar-meta {
      margin: 0 0 20px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .toc {
      display: flex;
      flex-direction: column;
      gap: 2px;
      border-top: 1px solid var(--border);
      padding-top: 16px;
    }

    .toc-link {
      display: block;
      border-radius: 6px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
      padding: 6px 8px;
    }

    .toc-link:hover {
      background: var(--code-bg);
      color: var(--ink);
      text-decoration: none;
    }

    .toc-link.active {
      background: var(--accent-soft);
      color: #0550ae;
      font-weight: 650;
    }

    .toc-level-2 {
      padding-left: 18px;
    }

    .toc-level-3 {
      padding-left: 30px;
      font-size: 12px;
    }

    main {
      min-width: 0;
      padding: 42px 28px 72px;
    }

    .markdown-body {
      max-width: 940px;
      margin: 0 auto;
      background: var(--paper);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: var(--shadow);
      padding: 48px 56px 60px;
    }

    .doc-kicker {
      margin: 0 0 10px;
      color: var(--muted);
      font-size: 13px;
    }

    .doc-kicker code {
      color: var(--muted);
      background: transparent;
      border: 0;
      padding: 0;
      font-size: inherit;
    }

    .markdown-body > :first-child {
      margin-top: 0;
    }

    .markdown-body h1,
    .markdown-body h2,
    .markdown-body h3,
    .markdown-body h4,
    .markdown-body h5,
    .markdown-body h6 {
      position: relative;
      color: var(--ink);
      font-weight: 700;
      line-height: 1.32;
      scroll-margin-top: 24px;
      text-wrap: pretty;
    }

    .markdown-body h1 {
      margin: 0 0 24px;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--border);
      font-size: 32px;
      line-height: 1.25;
    }

    .markdown-body h2 {
      margin: 42px 0 18px;
      padding-bottom: 9px;
      border-bottom: 1px solid var(--border);
      font-size: 24px;
    }

    .markdown-body h3 {
      margin: 30px 0 12px;
      font-size: 19px;
    }

    .markdown-body h4 {
      margin: 24px 0 10px;
      font-size: 16px;
    }

    .markdown-body h5,
    .markdown-body h6 {
      margin: 20px 0 8px;
      font-size: 15px;
      color: var(--muted);
    }

    .heading-anchor {
      position: absolute;
      left: -24px;
      width: 20px;
      color: var(--border-strong);
      opacity: 0;
      font-weight: 600;
      text-align: center;
      text-decoration: none;
    }

    h1:hover .heading-anchor,
    h2:hover .heading-anchor,
    h3:hover .heading-anchor,
    h4:hover .heading-anchor,
    h5:hover .heading-anchor,
    h6:hover .heading-anchor {
      opacity: 1;
    }

    .markdown-body p,
    .markdown-body blockquote,
    .markdown-body ul,
    .markdown-body ol,
    .markdown-body dl,
    .markdown-body table,
    .markdown-body pre {
      margin-top: 0;
      margin-bottom: 16px;
    }

    .markdown-body p {
      text-wrap: pretty;
    }

    .markdown-body strong {
      font-weight: 700;
      color: #111827;
    }

    .markdown-body ul,
    .markdown-body ol {
      padding-left: 1.65em;
    }

    .markdown-body li + li {
      margin-top: 4px;
    }

    .markdown-body hr {
      height: 1px;
      margin: 32px 0;
      background: var(--border);
      border: 0;
    }

    .markdown-body blockquote {
      border-left: 4px solid var(--border-strong);
      background: #f6f8fa;
      color: var(--muted);
      padding: 12px 16px;
      border-radius: 0 6px 6px 0;
    }

    .markdown-body blockquote > :last-child {
      margin-bottom: 0;
    }

    .markdown-body table {
      display: block;
      width: 100%;
      overflow-x: auto;
      border-collapse: collapse;
      border-spacing: 0;
      font-size: 14px;
      line-height: 1.58;
    }

    .markdown-body table th,
    .markdown-body table td {
      border: 1px solid var(--border);
      padding: 8px 12px;
      vertical-align: top;
    }

    .markdown-body table th {
      background: #f6f8fa;
      color: var(--ink);
      font-weight: 700;
      text-align: left;
      white-space: nowrap;
    }

    .markdown-body table tr:nth-child(2n) td {
      background: #fbfcfd;
    }

    .markdown-body code,
    .markdown-body tt {
      border: 1px solid rgba(175, 184, 193, 0.35);
      border-radius: 5px;
      background: var(--code-bg);
      color: var(--code-ink);
      font-family: var(--mono);
      font-size: 0.88em;
      padding: 0.16em 0.38em;
    }

    .markdown-body pre {
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 7px;
      background: var(--code-bg);
      color: var(--code-ink);
      padding: 14px 16px;
      line-height: 1.55;
    }

    .markdown-body pre code {
      display: block;
      border: 0;
      border-radius: 0;
      background: transparent;
      padding: 0;
      font-size: 13px;
      white-space: pre;
    }

    .math-block {
      overflow-x: auto;
      margin: 18px 0;
      border: 1px solid var(--border);
      border-left: 4px solid var(--green);
      border-radius: 7px;
      background: #f8faf8;
      color: #172a1c;
      padding: 16px 18px;
      font-family: var(--serif);
      text-align: center;
      white-space: nowrap;
    }

    .math-inline {
      border-radius: 4px;
      background: #f8faf8;
      color: #172a1c;
      font-family: var(--serif);
      padding: 0 0.18em;
      white-space: nowrap;
    }

    .math-ready .math-block,
    .math-ready .math-inline {
      background: transparent;
      border-color: transparent;
      color: inherit;
      padding-left: 0;
      padding-right: 0;
    }

    .markdown-body img {
      max-width: 100%;
      border-radius: 6px;
    }

    .markdown-body kbd {
      display: inline-block;
      border: 1px solid var(--border-strong);
      border-bottom-width: 2px;
      border-radius: 5px;
      background: #f6f8fa;
      padding: 2px 5px;
      font-family: var(--mono);
      font-size: 0.85em;
      line-height: 1.2;
    }

    @media (max-width: 980px) {
      .viewer {
        display: block;
      }

      .sidebar {
        position: static;
        height: auto;
        max-height: 42vh;
        overflow: auto;
        border-right: 0;
        border-bottom: 1px solid var(--border);
      }

      .toc {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      main {
        padding: 24px 14px 48px;
      }

      .markdown-body {
        padding: 32px 24px 42px;
      }

      .heading-anchor {
        display: none;
      }
    }

    @media (max-width: 560px) {
      body {
        font-size: 15px;
      }

      .sidebar {
        padding: 22px 16px;
      }

      .markdown-body {
        border-left: 0;
        border-right: 0;
        border-radius: 0;
        padding: 26px 18px 36px;
      }

      .markdown-body h1 {
        font-size: 26px;
      }

      .markdown-body h2 {
        font-size: 21px;
      }
    }

    @media print {
      body {
        background: #fff;
      }

      .viewer {
        display: block;
      }

      .sidebar {
        display: none;
      }

      main {
        padding: 0;
      }

      .markdown-body {
        max-width: none;
        border: 0;
        box-shadow: none;
        padding: 0;
      }

      .markdown-body h1,
      .markdown-body h2,
      .markdown-body h3 {
        break-after: avoid;
      }

      .markdown-body table,
      .markdown-body pre,
      .math-block {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="viewer">
    <aside class="sidebar" aria-label="文档目录">
      <p class="sidebar-title">${escapeHtml(title)}</p>
      <p class="sidebar-meta">源文件：<code>prd/备货规则配置页面需求.md</code><br>更新：${escapeHtml(updatedAt)}</p>
      <nav class="toc">
${tocHtml}
      </nav>
    </aside>
    <main>
      <article class="markdown-body">
        <p class="doc-kicker">源文件：<code>prd/备货规则配置页面需求.md</code> · 更新：${escapeHtml(updatedAt)}</p>
${articleHtml}
      </article>
    </main>
  </div>
  <script>
    const tocLinks = Array.from(document.querySelectorAll('.toc-link'));
    const headings = tocLinks
      .map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))))
      .filter(Boolean);

    const setActiveLink = () => {
      let activeId = headings[0]?.id;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= 120) {
          activeId = heading.id;
        } else {
          break;
        }
      }
      tocLinks.forEach((link) => {
        link.classList.toggle('active', link.hash === '#' + activeId);
      });
    };

    document.addEventListener('scroll', setActiveLink, { passive: true });
    window.addEventListener('hashchange', setActiveLink);
    setActiveLink();
  </script>
</body>
</html>
`;

await fs.writeFile(outputPath, html, "utf8");
console.log(outputPath);
