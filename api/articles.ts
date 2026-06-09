import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';

// ===== 環境変数（Vercelで設定、サーバー側のみ） =====
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const GH_TOKEN = process.env.GH_TOKEN || '';
const GH_OWNER = process.env.GH_OWNER || 'E-edu-byte';
const GH_REPO = process.env.GH_REPO || 'e-edu-main';
const GH_BRANCH = process.env.GH_BRANCH || 'main';

const API = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents`;

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
function verify(req: VercelRequest): boolean {
  const pwd = (req.headers.authorization || '').replace('Bearer ', '');
  return !!pwd && !!ADMIN_PASSWORD_HASH && sha256(pwd) === ADMIN_PASSWORD_HASH;
}

// ===== GitHub ファイル操作 =====
async function ghGet(path: string): Promise<{ text: string; sha: string } | null> {
  const res = await fetch(`${API}/${path}?ref=${GH_BRANCH}`, {
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'e-edu-admin',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status}`);
  const json: any = await res.json();
  return {
    text: Buffer.from(json.content, 'base64').toString('utf-8'),
    sha: json.sha,
  };
}
async function ghPut(path: string, text: string, message: string, sha?: string) {
  const body: any = {
    message,
    content: Buffer.from(text, 'utf-8').toString('base64'),
    branch: GH_BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(`${API}/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'e-edu-admin',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub PUT ${path}: ${res.status} ${await res.text()}`);
}
async function ghDelete(path: string, message: string, sha: string) {
  const res = await fetch(`${API}/${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'e-edu-admin',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, sha, branch: GH_BRANCH }),
  });
  if (!res.ok) throw new Error(`GitHub DELETE ${path}: ${res.status}`);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== 記事HTMLテンプレート =====
const STYLE = `  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif;
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      min-height: 100vh;
      color: #1f2937;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
    header { margin-bottom: 40px; }
    .logo { text-align: center; margin-bottom: 20px; }
    .logo a { font-size: 1.8rem; color: #065f46; text-decoration: none; font-weight: bold; }
    nav { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; }
    nav a { color: #059669; text-decoration: none; }
    nav a:hover { text-decoration: underline; }
    .breadcrumb { font-size: 0.9rem; color: #6b7280; margin-bottom: 24px; }
    .breadcrumb a { color: #059669; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .article {
      background: white;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      margin-bottom: 40px;
    }
    .article-tag {
      display: inline-block;
      background: #ecfdf5;
      color: #059669;
      font-size: 0.8rem;
      font-weight: bold;
      padding: 4px 12px;
      border-radius: 99px;
      margin-bottom: 16px;
    }
    h1 { font-size: 1.6rem; color: #065f46; margin-bottom: 12px; line-height: 1.5; }
    .article-meta { color: #9ca3af; font-size: 0.85rem; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e5e7eb; }
    h2 {
      font-size: 1.2rem;
      color: #065f46;
      margin-top: 40px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #d1fae5;
    }
    h3 { font-size: 1.05rem; color: #065f46; margin-top: 24px; margin-bottom: 12px; }
    p { color: #4b5563; line-height: 1.9; margin-bottom: 16px; }
    ul, ol { color: #4b5563; line-height: 1.9; margin-bottom: 16px; padding-left: 24px; }
    li { margin-bottom: 8px; }
    .highlight-box {
      background: #ecfdf5;
      border-radius: 8px;
      padding: 20px 24px;
      margin: 24px 0;
      border-left: 4px solid #059669;
    }
    .highlight-box p { color: #065f46; margin-bottom: 0; }
    .example-box {
      background: #f9fafb;
      border-radius: 8px;
      padding: 20px 24px;
      margin: 24px 0;
    }
    .example-box h4 { color: #065f46; font-size: 0.95rem; margin-bottom: 10px; }
    .example-box p, .example-box ul { font-size: 0.95rem; margin-bottom: 0; }
    .tip-box {
      background: #f9fafb;
      border-radius: 8px;
      padding: 20px 24px;
      margin: 16px 0;
      border-left: 3px solid #d1fae5;
    }
    .tip-box h4 { color: #065f46; font-size: 1rem; margin-bottom: 8px; }
    .tip-box p { font-size: 0.95rem; margin-bottom: 0; }
    .tool-cta {
      background: linear-gradient(135deg, #ecfdf5, #d1fae5);
      border-radius: 12px;
      padding: 28px;
      margin: 32px 0;
      text-align: center;
    }
    .tool-cta h3 { color: #065f46; margin-bottom: 12px; }
    .tool-cta p { color: #4b5563; margin-bottom: 20px; font-size: 0.95rem; }
    .tool-cta a {
      display: inline-block;
      background: #059669;
      color: white;
      padding: 12px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      transition: background 0.2s;
    }
    .tool-cta a:hover { background: #047857; }
    .related-articles { margin-bottom: 40px; }
    .related-articles h2 { font-size: 1.1rem; color: #065f46; margin-bottom: 16px; border-bottom: none; }
    .related-link {
      display: block;
      background: white;
      border-radius: 8px;
      padding: 16px 20px;
      text-decoration: none;
      margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      color: #065f46;
      transition: box-shadow 0.2s;
    }
    .related-link:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
    .related-link span { color: #6b7280; font-size: 0.85rem; display: block; margin-top: 4px; }
    footer { text-align: center; padding: 40px 20px; border-top: 1px solid #d1fae5; }
    footer p { color: #6b7280; font-size: 0.9rem; }
    footer nav { margin-top: 16px; }
  </style>`;

const NAV = `      <nav>
        <a href="/">ホーム</a>
        <a href="/articles.html">記事・ガイド</a>
        <a href="/about.html">運営者情報</a>
        <a href="/privacy.html">プライバシーポリシー</a>
        <a href="/terms.html">利用規約</a>
        <a href="/contact.html">お問い合わせ</a>
      </nav>`;

const FOOTER = `  <footer>
    <p>&copy; 2026 E-edu. All rights reserved.</p>
    <nav>
      <a href="/">ホーム</a>
      <a href="/articles.html">記事・ガイド</a>
      <a href="/about.html">運営者情報</a>
      <a href="/privacy.html">プライバシーポリシー</a>
      <a href="/terms.html">利用規約</a>
      <a href="/contact.html">お問い合わせ</a>
    </nav>
  </footer>`;

interface ArticleData {
  slug: string;
  title: string;
  description: string;
  tag: string;
  metaLine: string;
  breadcrumb: string;
  bodyHtml: string;
  relatedHtml: string;
}

function renderArticle(a: ArticleData): string {
  const related = a.relatedHtml.trim()
    ? `
    <div class="related-articles">
      <h2>関連記事</h2>
${a.relatedHtml.trim()}
    </div>
`
    : '';
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(a.title)} | E-edu</title>
  <meta name="description" content="${esc(a.description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://e-edu.jp/article-${a.slug}.html">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon.png">
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-G6LYGM71B9"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-G6LYGM71B9');
  </script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2331612435863730"
     crossorigin="anonymous"></script>
${STYLE}
</head>
<body>
  <div class="container">
    <header>
      <div class="logo"><a href="/">E-edu</a></div>
${NAV}
    </header>

    <p class="breadcrumb"><a href="/">ホーム</a> &gt; <a href="/articles.html">記事・ガイド</a> &gt; ${esc(a.breadcrumb)}</p>

    <article class="article">
      <span class="article-tag">${esc(a.tag)}</span>
      <h1>${esc(a.title)}</h1>
      <p class="article-meta">${esc(a.metaLine)}</p>

${a.bodyHtml.trim()}
    </article>
${related}  </div>

${FOOTER}
</body>
</html>
`;
}

// 記事HTMLから編集用フィールドを抽出
function parseArticle(html: string, slug: string): ArticleData {
  const pick = (re: RegExp) => (html.match(re)?.[1] || '').trim();
  const title = pick(/<h1>([\s\S]*?)<\/h1>/);
  const description = pick(/<meta name="description" content="([\s\S]*?)">/);
  const tag = pick(/<span class="article-tag">([\s\S]*?)<\/span>/);
  const metaLine = pick(/<p class="article-meta">([\s\S]*?)<\/p>/);
  const breadcrumb = pick(/記事・ガイド<\/a>\s*&gt;\s*([\s\S]*?)<\/p>/);
  // body = article-meta の閉じ </p> から </article> まで
  let bodyHtml = '';
  const m = html.match(/<p class="article-meta">[\s\S]*?<\/p>([\s\S]*?)<\/article>/);
  if (m) bodyHtml = m[1].trim();
  const relatedHtml = pick(/<div class="related-articles">\s*<h2>関連記事<\/h2>([\s\S]*?)<\/div>/);
  return {
    slug,
    title: decodeEntities(title),
    description: decodeEntities(description),
    tag: decodeEntities(tag),
    metaLine: decodeEntities(metaLine),
    breadcrumb: decodeEntities(breadcrumb),
    bodyHtml,
    relatedHtml: relatedHtml.trim(),
  };
}
function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

// articles.html のカード一覧をパース
function parseCards(html: string): Array<{ slug: string; title: string; tag: string; meta: string }> {
  const list: Array<{ slug: string; title: string; tag: string; meta: string }> = [];
  const re = /<a href="\/article-([^"]+)\.html" class="article-card">([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const inner = m[2];
    list.push({
      slug: m[1],
      title: decodeEntities((inner.match(/<h2>([\s\S]*?)<\/h2>/)?.[1] || '').trim()),
      tag: decodeEntities((inner.match(/<span class="article-tag">([\s\S]*?)<\/span>/)?.[1] || '').trim()),
      meta: decodeEntities((inner.match(/<p class="article-meta">([\s\S]*?)<\/p>/)?.[1] || '').trim()),
    });
  }
  return list;
}

function buildCard(a: ArticleData): string {
  return `      <a href="/article-${a.slug}.html" class="article-card">
        <span class="article-tag">${esc(a.tag)}</span>
        <h2>${esc(a.title)}</h2>
        <p>${esc(a.description)}</p>
        <p class="article-meta">${esc(a.metaLine)}</p>
      </a>`;
}

// articles.html にカードを挿入 or 置換
function upsertCard(listHtml: string, a: ArticleData): string {
  const card = buildCard(a);
  const cardRe = new RegExp(`\\s*<a href="/article-${a.slug}\\.html" class="article-card">[\\s\\S]*?</a>`);
  if (cardRe.test(listHtml)) {
    return listHtml.replace(cardRe, '\n\n' + card);
  }
  // 新規：article-list の先頭に挿入
  return listHtml.replace(/(<div class="article-list">)/, `$1\n\n${card}\n`);
}
function removeCard(listHtml: string, slug: string): string {
  const cardRe = new RegExp(`\\s*<a href="/article-${slug}\\.html" class="article-card">[\\s\\S]*?</a>`);
  return listHtml.replace(cardRe, '');
}

// sitemap.xml 更新
function upsertSitemap(xml: string, slug: string, date: string): string {
  const loc = `https://e-edu.jp/article-${slug}.html`;
  if (xml.includes(`<loc>${loc}</loc>`)) {
    return xml.replace(
      new RegExp(`(<loc>${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>\\s*<lastmod>)[^<]*(</lastmod>)`),
      `$1${date}$2`
    );
  }
  const entry = `  <url>
    <loc>${loc}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  return xml.replace(/(<\/urlset>)/, `${entry}$1`);
}
function removeSitemap(xml: string, slug: string): string {
  const loc = `https://e-edu.jp/article-${slug}.html`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return xml.replace(new RegExp(`\\s*<url>\\s*<loc>${loc}</loc>[\\s\\S]*?</url>`), '');
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!GH_TOKEN) return res.status(500).json({ error: 'GH_TOKEN が未設定です' });

  try {
    // ---- GET: list / get ----
    if (req.method === 'GET') {
      const action = (req.query.action as string) || 'list';
      if (action === 'list') {
        const file = await ghGet('articles.html');
        if (!file) return res.status(200).json([]);
        return res.status(200).json(parseCards(file.text));
      }
      if (action === 'get') {
        const slug = req.query.slug as string;
        if (!slug) return res.status(400).json({ error: 'slug が必要です' });
        const file = await ghGet(`article-${slug}.html`);
        if (!file) return res.status(404).json({ error: '記事が見つかりません' });
        return res.status(200).json(parseArticle(file.text, slug));
      }
      return res.status(400).json({ error: '不明な action' });
    }

    // ---- 以下は認証必須 ----
    if (!verify(req)) return res.status(401).json({ error: '認証に失敗しました' });

    if (req.method === 'POST') {
      const a = req.body as ArticleData;
      if (!a.slug || !a.title) return res.status(400).json({ error: 'slug と title は必須です' });
      if (!/^[a-z0-9-]+$/.test(a.slug)) return res.status(400).json({ error: 'slug は半角英数字とハイフンのみ' });

      const date = todayISO();

      // 1) 記事HTML
      const existing = await ghGet(`article-${a.slug}.html`);
      await ghPut(`article-${a.slug}.html`, renderArticle(a),
        `${existing ? '記事更新' : '記事作成'}: ${a.slug}`, existing?.sha);

      // 2) articles.html カード
      const list = await ghGet('articles.html');
      if (list) {
        await ghPut('articles.html', upsertCard(list.text, a), `記事一覧更新: ${a.slug}`, list.sha);
      }

      // 3) sitemap.xml
      const sm = await ghGet('sitemap.xml');
      if (sm) {
        await ghPut('sitemap.xml', upsertSitemap(sm.text, a.slug, date), `sitemap更新: ${a.slug}`, sm.sha);
      }

      return res.status(200).json({ success: true, url: `https://e-edu.jp/article-${a.slug}.html` });
    }

    if (req.method === 'DELETE') {
      const slug = (req.body?.slug || req.query.slug) as string;
      if (!slug) return res.status(400).json({ error: 'slug が必要です' });

      const art = await ghGet(`article-${slug}.html`);
      if (art) await ghDelete(`article-${slug}.html`, `記事削除: ${slug}`, art.sha);

      const list = await ghGet('articles.html');
      if (list) await ghPut('articles.html', removeCard(list.text, slug), `記事一覧から削除: ${slug}`, list.sha);

      const sm = await ghGet('sitemap.xml');
      if (sm) await ghPut('sitemap.xml', removeSitemap(sm.text, slug), `sitemapから削除: ${slug}`, sm.sha);

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    console.error('articles API error:', e);
    return res.status(500).json({ error: e.message || 'Internal server error' });
  }
}
