#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "trips");
const OUT_TRIPS_DIR = path.join(ROOT, "trips");
const ROOT_INDEX = path.join(ROOT, "index.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap.xml");
const ROBOTS_PATH = path.join(ROOT, "robots.txt");

const SITE_URL = "https://travel.omnixaas.com";
const SITE_NAME = "TravelHub";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function getSlugFromFilename(filename) {
  return path.basename(filename, ".json");
}

function toAbsoluteUrl(url) {
  if (!url) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${SITE_URL}${url}`;
  return `${SITE_URL}/${url}`;
}

function firstPhotoFromTrip(trip) {
  for (const day of trip.days || []) {
    for (const stop of day.stops || []) {
      for (const photo of stop.photos || []) {
        if (photo?.src) return photo.src;
      }
    }
  }

  for (const group of trip.shop_groups || []) {
    for (const item of group.items || []) {
      for (const photo of item.photos || []) {
        if (photo?.src) return photo.src;
      }
    }
  }

  for (const group of trip.stay_groups || []) {
    for (const item of group.items || []) {
      for (const photo of item.photos || []) {
        if (photo?.src) return photo.src;
      }
    }
  }

  return "";
}

function pickCoverImage(trip) {
  return (
    trip.coverImage ||
    trip.cover ||
    firstPhotoFromTrip(trip) ||
    DEFAULT_OG_IMAGE
  );
}

function buildTripDescription(trip) {
  const parts = [];
  if (trip.subtitle) parts.push(trip.subtitle);
  if (trip.dates) parts.push(trip.dates);
  if (trip.nights) parts.push(trip.nights);

  const text = parts.join("｜").trim();
  return text || "旅遊行程分享";
}

function buildTripKeywords(trip, slug) {
  const tags = Array.isArray(trip.tags) ? trip.tags : [];
  return [trip.title, trip.subtitle, slug, ...tags]
    .filter(Boolean)
    .join(", ");
}

function renderTripSummaryHtml(trip) {
  const dayBlocks = (trip.days || [])
    .map((day) => {
      const stops = (day.stops || [])
        .slice(0, 5)
        .map((stop) => {
          const pieces = [];
          if (stop.start_time && stop.end_time) pieces.push(`${stop.start_time}–${stop.end_time}`);
          else if (stop.start_time) pieces.push(stop.start_time);
          if (stop.type) pieces.push(stop.type);

          return `
            <li>
              <strong>${escapeHtml(stop.name || stop.maps_label || "行程點")}</strong>
              ${pieces.length ? `<span>｜${escapeHtml(pieces.join("｜"))}</span>` : ""}
            </li>
          `;
        })
        .join("");

      return `
        <section class="seo-section">
          <h2>${escapeHtml(day.label || "")} ${escapeHtml(day.title || "")}</h2>
          ${day.theme ? `<p class="seo-muted">${escapeHtml(day.theme)}</p>` : ""}
          <ul class="seo-list">${stops}</ul>
        </section>
      `;
    })
    .join("");

  const reminders = (trip.reminders || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `
    <div class="seo-content">
      ${
        trip.subtitle
          ? `<section class="seo-section"><p>${escapeHtml(trip.subtitle)}</p></section>`
          : ""
      }

      ${
        dayBlocks
          ? dayBlocks
          : `<section class="seo-section"><p>此頁包含完整行程、預算、住宿、店家與地圖資訊。</p></section>`
      }

      ${
        reminders
          ? `
          <section class="seo-section">
            <h2>行前提醒</h2>
            <ul class="seo-list">${reminders}</ul>
          </section>
        `
          : ""
      }
    </div>
  `;
}

function buildTripStructuredData(trip, slug, pageUrl, imageUrl) {
  return {
    "@context": "https://schema.org",
    "@type": "TravelItinerary",
    name: trip.title || slug,
    description: buildTripDescription(trip),
    image: [imageUrl],
    url: pageUrl,
  };
}

function renderTripPage({ slug, trip }) {
  const title = trip.title || slug;
  const description = buildTripDescription(trip);
  const pageUrl = `${SITE_URL}/trips/${encodeURIComponent(slug)}/`;
  const imageUrl = toAbsoluteUrl(pickCoverImage(trip));
  const structuredData = JSON.stringify(
    buildTripStructuredData(trip, slug, pageUrl, imageUrl),
    null,
    2
  );

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}" />
  <meta name="keywords" content="${escapeAttr(buildTripKeywords(trip, slug))}" />
  <link rel="canonical" href="${escapeAttr(pageUrl)}" />

  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${escapeAttr(SITE_NAME)}" />
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:image" content="${escapeAttr(imageUrl)}" />
  <meta property="og:url" content="${escapeAttr(pageUrl)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <meta name="twitter:image" content="${escapeAttr(imageUrl)}" />

  <script type="application/ld+json">
${structuredData}
  </script>

  <link rel="stylesheet" href="/assets/styles.css" />

  <style>
    .seo-shell {
      max-width: 1120px;
      margin: 0 auto;
      padding: 24px;
    }
    .seo-hero {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 24px;
      align-items: center;
      margin-top: 24px;
    }
    .seo-card {
      background: #fff;
      border: 1px solid #e5eaf2;
      border-radius: 24px;
      box-shadow: 0 4px 16px rgba(16,24,40,.05);
      overflow: hidden;
    }
    .seo-cover img {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      background: #f3f4f6;
    }
    .seo-body {
      padding: 24px;
    }
    .seo-body h1 {
      margin: 0 0 12px;
      font-size: 40px;
      line-height: 1.15;
    }
    .seo-desc {
      color: #667085;
      line-height: 1.7;
      margin: 0 0 16px;
    }
    .seo-meta {
      display: grid;
      gap: 10px;
      color: #18212f;
    }
    .seo-content {
      margin-top: 24px;
      display: grid;
      gap: 18px;
    }
    .seo-section {
      background: #fff;
      border: 1px solid #e5eaf2;
      border-radius: 20px;
      padding: 20px;
      box-shadow: 0 4px 16px rgba(16,24,40,.05);
    }
    .seo-section h2 {
      margin: 0 0 10px;
      font-size: 22px;
    }
    .seo-list {
      margin: 0;
      padding-left: 20px;
      line-height: 1.8;
    }
    .seo-muted {
      color: #667085;
    }
    .seo-cta {
      margin-top: 18px;
    }
    .seo-cta a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 18px;
      border-radius: 14px;
      background: #111827;
      color: #fff;
      text-decoration: none;
      font-weight: 700;
    }
    #app {
      min-height: 40px;
      margin-top: 24px;
    }
    @media (max-width: 900px) {
      .seo-hero {
        grid-template-columns: 1fr;
      }
      .seo-body h1 {
        font-size: 30px;
      }
    }
  </style>
</head>
<body data-page-type="trip" data-trip-slug="${escapeAttr(slug)}">
  <div class="seo-shell">
    <div class="seo-hero">
      <div class="seo-card seo-cover">
        <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(title)}" />
      </div>

      <div class="seo-card seo-body">
        <h1>${escapeHtml(title)}</h1>
        <p class="seo-desc">${escapeHtml(description)}</p>
        <div class="seo-meta">
          ${trip.dates ? `<div><strong>日期：</strong>${escapeHtml(trip.dates)}</div>` : ""}
          ${trip.travelers ? `<div><strong>同行：</strong>${escapeHtml(`${trip.travelers} 人`)}</div>` : ""}
          ${trip.nights ? `<div><strong>住宿：</strong>${escapeHtml(trip.nights)}</div>` : ""}
        </div>
        <div class="seo-cta">
          <a href="#app">查看完整互動行程</a>
        </div>
      </div>
    </div>

    ${renderTripSummaryHtml(trip)}
  </div>

  <div id="app"></div>
  <script type="module" src="/assets/app.js"></script>
</body>
</html>`;
}

function renderHomePage(catalog) {
  const trips = Array.isArray(catalog?.trips) ? catalog.trips : [];

  const cards = trips
    .map((trip) => {
      const href = `/trips/${encodeURIComponent(trip.slug)}/`;
      return `
        <a class="trip-card" href="${href}">
          <div class="trip-cover" style="background-image:url('${escapeAttr(trip.coverImage || "")}')"></div>
          <div class="trip-body">
            <div class="trip-card-top">
              <h3>${escapeHtml(trip.title || trip.slug)}</h3>
              <div class="trip-meta">${trip.days || "-"} 天 / ${trip.nights || "-"} 晚</div>
            </div>
            <p>${escapeHtml(trip.summary || "")}</p>
            <div class="trip-tags">
              ${(trip.tags || []).map((tag) => `<span class="trip-tag">${escapeHtml(tag)}</span>`).join("")}
            </div>
          </div>
        </a>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${SITE_NAME}｜旅遊行程分享</title>
  <meta name="description" content="整理釜山、小琉球等旅遊行程，包含每日行程、預算、住宿、地圖與店家資訊。" />
  <link rel="canonical" href="${SITE_URL}/" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:title" content="${SITE_NAME}｜旅遊行程分享" />
  <meta property="og:description" content="整理釜山、小琉球等旅遊行程，包含每日行程、預算、住宿、地圖與店家資訊。" />
  <meta property="og:image" content="${DEFAULT_OG_IMAGE}" />
  <meta property="og:url" content="${SITE_URL}/" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${SITE_NAME}｜旅遊行程分享" />
  <meta name="twitter:description" content="整理釜山、小琉球等旅遊行程，包含每日行程、預算、住宿、地圖與店家資訊。" />
  <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />

  <link rel="stylesheet" href="/assets/styles.css" />
</head>
<body data-page-type="home-static">
  <div class="catalog-wrap">
    <div class="catalog-hero">
      <p class="catalog-kicker">Travel</p>
      <h1>${SITE_NAME}</h1>
      <p class="catalog-subtitle">旅遊行程分享，包含完整行程、地圖、預算與住宿資訊。</p>
    </div>

    <section class="catalog-section">
      <div class="catalog-section-head">
        <h2>Trips</h2>
      </div>
      ${trips.length ? `<div class="trip-grid">${cards}</div>` : `<div class="empty-box">目前沒有行程</div>`}
    </section>
  </div>

  <div id="app"></div>
  <script type="module" src="/assets/app.js"></script>
</body>
</html>`;
}

function buildSitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeHtml(url)}</loc>
  </url>`
  )
  .join("\n")}
</urlset>
`;
}

function buildRobotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

function main() {
  if (!SITE_URL.startsWith("http")) {
    throw new Error("SITE_URL 必須是完整網址");
  }
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`Missing: ${DATA_DIR}`);
  }

  const files = fs.readdirSync(DATA_DIR).filter((name) => name.endsWith(".json")).sort();
  const catalogPath = path.join(ROOT, "data", "catalog.json");
  const catalog = fs.existsSync(catalogPath) ? readJson(catalogPath) : { trips: [] };

  const urls = [`${SITE_URL}/`];

  for (const file of files) {
    const slug = getSlugFromFilename(file);
    const trip = readJson(path.join(DATA_DIR, file));
    const html = renderTripPage({ slug, trip });

    const outPath = path.join(OUT_TRIPS_DIR, slug, "index.html");
    writeText(outPath, html);

    urls.push(
      `${SITE_URL.replace(/\/$/, "")}/trips/${encodeURIComponent(slug)}/`
    );
    console.log(`[OK] ${path.relative(ROOT, outPath)}`);
  }

  writeText(ROOT_INDEX, renderHomePage(catalog));
  console.log("[OK] index.html");

  writeText(SITEMAP_PATH, buildSitemap(urls));
  console.log("[OK] sitemap.xml");

  writeText(ROBOTS_PATH, buildRobotsTxt());
  console.log("[OK] robots.txt");
}

main();
