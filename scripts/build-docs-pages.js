import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const docsDir = path.join(rootDir, 'docs');
const outputDir = path.join(rootDir, '.site');
const uiStylesPath = path.join(rootDir, 'ui', 'dist', 'styles.css');
const outputStylesPath = path.join(outputDir, 'ui', 'dist', 'styles.css');

const preferredOrder = [
  'index',
  'getting-started',
  'ui-guide',
  'api-reference',
  'split-host-deployment',
  'docker',
  'nginx',
  'database-production',
  'troubleshooting'
];

const titleOverrides = {
  'ui-guide': 'UI Guide',
  'api-reference': 'API Reference',
  'split-host-deployment': 'Split-Host Deployment',
  'docker': 'Docker Deployment',
  'nginx': 'Nginx, Auth & Hardening',
  'database-production': 'Database In Production'
};

const titleFromSlug = (slug) => {
  if (slug === 'index') return 'Overview';
  if (titleOverrides[slug]) return titleOverrides[slug];
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const toNavItems = (slugs) => {
  const known = preferredOrder.filter((slug) => slugs.includes(slug));
  const remaining = slugs
    .filter((slug) => !preferredOrder.includes(slug))
    .sort((a, b) => a.localeCompare(b));

  return [...known, ...remaining].map((slug) => ({
    slug,
    href: `${slug === 'index' ? 'index' : slug}.html`,
    title: titleFromSlug(slug)
  }));
};

const rewriteMarkdownLinks = (html) => html.replace(
  /href="([^"#?]+\.md)(#[^"]*)?"/gi,
  (_full, href, hash = '') => {
    const normalized = href.replace(/^\.?\//, '');
    const slug = normalized.replace(/\.md$/i, '');
    const target = slug === 'index' ? 'index.html' : `${slug}.html`;
    return `href="${target}${hash || ''}"`;
  }
);

const decodeHtmlEntities = (value) => value
  .replaceAll('&amp;', '&')
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&#x27;', "'")
  .replaceAll('&nbsp;', ' ');

const stripTags = (value) => value.replace(/<[^>]*>/g, '');

const slugifyHeading = (rawHeading) => {
  const normalized = decodeHtmlEntities(stripTags(rawHeading))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');

  return normalized || 'section';
};

const addHeadingIds = (html) => {
  const slugCounts = new Map();

  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_match, level, content) => {
    const baseSlug = slugifyHeading(content);
    const seenCount = slugCounts.get(baseSlug) || 0;
    slugCounts.set(baseSlug, seenCount + 1);

    const id = seenCount === 0 ? baseSlug : `${baseSlug}-${seenCount}`;
    return `<h${level} id="${id}">${content}</h${level}>`;
  });
};

const pageTemplate = ({ pageTitle, navItems, activeSlug, contentHtml }) => {
  const navHtml = navItems
    .map((item) => {
      const activeClass = item.slug === activeSlug ? 'active' : '';
      return `<a class="nav-link ${activeClass}" href="${item.href}">${escapeHtml(item.title)}</a>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pageTitle)} | Gateherald Docs</title>
  <link rel="stylesheet" href="ui/dist/styles.css">
</head>
<body class="app-body">
  <main class="app-shell">
    <section class="app-brand" aria-label="Gateherald">
      <p class="app-brand-title">Gateherald</p>
      <p class="app-brand-kicker">Docs</p>
    </section>

    <nav class="app-nav" aria-label="Docs Sections">
      ${navHtml}
      <a href="https://github.com/tcurrent/gateherald" class="nav-link" target="_blank" rel="noopener noreferrer">Repository</a>
    </nav>

    <section class="section-card" aria-live="polite">
      <div class="section-body docs-section-body">
        <div class="markdown-content">${contentHtml}</div>
      </div>
    </section>
  </main>
</body>
</html>`;
};

const build = async () => {
  marked.setOptions({ gfm: true, breaks: false });

  const entries = await fs.readdir(docsDir, { withFileTypes: true });
  const mdFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const slugs = mdFiles.map((fileName) => fileName.replace(/\.md$/i, ''));
  const navItems = toNavItems(slugs);

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.dirname(outputStylesPath), { recursive: true });
  await fs.copyFile(uiStylesPath, outputStylesPath);

  for (const fileName of mdFiles) {
    const slug = fileName.replace(/\.md$/i, '');
    const markdown = await fs.readFile(path.join(docsDir, fileName), 'utf8');
    const rawHtml = marked.parse(markdown);
    const contentHtml = addHeadingIds(rewriteMarkdownLinks(rawHtml));
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const pageTitle = titleMatch ? titleMatch[1].trim() : titleFromSlug(slug);

    const outputFile = slug === 'index' ? 'index.html' : `${slug}.html`;
    const html = pageTemplate({ pageTitle, navItems, activeSlug: slug, contentHtml });

    await fs.writeFile(path.join(outputDir, outputFile), html, 'utf8');
  }

  // Keep a simple 404 page that links back to docs home.
  await fs.writeFile(
    path.join(outputDir, '404.html'),
    pageTemplate({
      pageTitle: 'Not Found',
      navItems,
      activeSlug: '',
      contentHtml: '<h1>Page Not Found</h1><p>The requested docs page does not exist. <a href="index.html">Go back to docs home</a>.</p>'
    }),
    'utf8'
  );

  console.log(`Built ${mdFiles.length} docs pages to ${outputDir}`);
};

build().catch((error) => {
  console.error('Failed to build docs for GitHub Pages:', error);
  process.exitCode = 1;
});
