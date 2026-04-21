#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "trips");
const CATALOG_PATH = path.join(ROOT, "data", "catalog.json");
const OUT_TRIPS_DIR = path.join(ROOT, "trips");
const ROOT_INDEX = path.join(ROOT, "index.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap.xml");
const ROBOTS_PATH = path.join(ROOT, "robots.txt");

const SITE_URL = "https://travel.omnixaas.com";
const SITE_NAME = "TravelHub";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`;

const I18N = {
  "zh-TW": {
    htmlLang: "zh-Hant",
    siteTitle: "TravelHub",
    catalogKicker: "Travel",
    catalogSubtitle: "旅遊行程分享，包含完整行程、地圖、預算與住宿資訊。",
    trips: "Trips",
    noData: "目前沒有行程",
    redirecting: "跳轉中…",
    redirectTitle: "Redirecting...",
    homeDescription: "旅遊行程分享，包含完整行程、地圖、預算與住宿資訊。",
    tripFallbackDescription: "旅遊行程分享",
    metaDates: "日期",
    metaTravelers: "同行人數",
    metaNights: "住宿安排",
    openApp: "查看完整互動行程",
    reminders: "行前提醒",
    travelersUnit: "人",
    dayUnit: "天",
    nightUnit: "晚",
  },
  en: {
    htmlLang: "en",
    siteTitle: "TravelHub",
    catalogKicker: "Travel",
    catalogSubtitle: "Travel notes with itinerary, maps, budget, stays, and useful places.",
    trips: "Trips",
    noData: "No trips yet",
    redirecting: "Redirecting...",
    redirectTitle: "Redirecting...",
    homeDescription: "Travel notes with itinerary, maps, budget, stays, and useful places.",
    tripFallbackDescription: "Travel notes",
    metaDates: "Dates",
    metaTravelers: "Travelers",
    metaNights: "Stays",
    openApp: "Open interactive trip page",
    reminders: "Reminders",
    travelersUnit: "",
    dayUnit: "days",
    nightUnit: "nights",
  },
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `JSON 解析失敗: ${filePath}\n${err.message}\n請檢查報錯行附近是否有多餘逗號、括號不成對、或字串未關閉。`
    );
  }
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

function normalizeLocale(locale) {
  if (!locale || typeof locale !== "string") return "zh-TW";
  const lower = locale.toLowerCase();
  if (lower === "en" || lower === "en-us" || lower === "en-gb") return "en";
  if (lower === "zh" || lower === "zh-tw") return "zh-TW";
  return I18N[locale] ? locale : "zh-TW";
}

function getDict(locale) {
  return I18N[normalizeLocale(locale)] || I18N["zh-TW"];
}

function toAbsoluteUrl(url) {
  if (!url) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${SITE_URL}${url}`;
  return `${SITE_URL}/${url}`;
}

function normalizeDateString(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function getFileLastmod(filePath) {
  const stat = fs.statSync(filePath);
  return new Date(stat.mtime).toISOString().slice(0, 10);
}

function firstPhotoFromTrip(trip) {
  for (const day of trip.days || []) {
    for (const stop of day.stops || []) {
      for (const photo of stop.photos || []) {
        if (typeof photo === "string") return photo;
        if (photo?.src) return photo.src;
      }
    }
  }

  for (const group of trip.shop_groups || []) {
    for (const item of group.items || []) {
      for (const photo of item.photos || []) {
        if (typeof photo === "string") return photo;
        if (photo?.src) return photo.src;
      }
    }
  }

  for (const group of trip.stay_groups || []) {
    for (const item of group.items || []) {
      for (const photo of item.photos || []) {
        if (typeof photo === "string") return photo;
        if (photo?.src) return photo.src;
      }
    }
  }

  for (const item of trip.shops || []) {
    for (const photo of item.photos || []) {
      if (typeof photo === "string") return photo;
      if (photo?.src) return photo.src;
    }
  }

  for (const item of trip.stays || []) {
    for (const photo of item.photos || []) {
      if (typeof photo === "string") return photo;
      if (photo?.src) return photo.src;
    }
  }

  return "";
}

function pickCoverImage(trip) {
  return trip.coverImage || trip.cover || firstPhotoFromTrip(trip) || DEFAULT_OG_IMAGE;
}

function buildTripDescription(trip, dict) {
  const parts = [];
  if (trip.subtitle) parts.push(trip.subtitle);
  if (trip.summary) parts.push(trip.summary);
  if (trip.dates) parts.push(trip.dates);
  if (trip.nights) parts.push(trip.nights);

  const text = parts.join("｜").trim();
  return text || dict.tripFallbackDescription;
}

function buildTripKeywords(trip, slug) {
  const tags = Array.isArray(trip.tags) ? trip.tags : [];
  return [trip.title, trip.subtitle, trip.summary, slug, ...tags]
    .filter(Boolean)
    .join(", ");
}

function extractNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const m = value.match(/(\d+)/);
    return m ? Number(m[1]) : "";
  }
  return "";
}

function computeDays(trip) {
  if (Array.isArray(trip.days)) return trip.days.length;
  return extractNumber(trip.days);
}

function computeNights(trip) {
  if (typeof trip.catalog_nights === "number") return trip.catalog_nights;
  return extractNumber(trip.nights);
}

function buildCatalogEntry(slug, trip) {
  return {
    slug,
    title: trip.title || slug,
    summary: trip.summary || trip.subtitle || "",
    coverImage: toAbsoluteUrl(pickCoverImage(trip)),
    days: computeDays(trip),
    nights: computeNights(trip),
    tags: Array.isArray(trip.tags) ? trip.tags : [],
    locale: normalizeLocale(trip?.defaults?.locale),
    lastmod:
      normalizeDateString(trip.lastmod) ||
      normalizeDateString(trip.updated_at) ||
      "",
  };
}

function buildTripStructuredData(trip, slug, pageUrl, imageUrl, dict) {
  return {
    "@context": "https://schema.org",
    "@type": "TravelItinerary",
    name: trip.title || slug,
    description: buildTripDescription(trip, dict),
    image: [imageUrl],
    url: pageUrl,
    inLanguage: normalizeLocale(trip?.defaults?.locale),
  };
}

function renderTripNoscriptSummary(trip, dict) {
  const dayBlocks = (trip.days || [])
    .slice(0, 3)
    .map((day, index) => {
      const dayLabel = `Day ${day.key || index + 1}`;
      const stops = (day.stops || [])
        .slice(0, 5)
        .map((stop) => {
          const pieces = [];
          if (stop.start_time) pieces.push(stop.start_time);
          if (stop.type) pieces.push(stop.type);

          return `
            <li>
              <strong>${escapeHtml(stop.name || stop.maps_label || "行程點")}</strong>
              ${pieces.length ? `｜${escapeHtml(pieces.join("｜"))}` : ""}
            </li>
          `;
        })
        .join("");

      return `
        <section style="margin-top:16px;">
          <h2 style="margin:0 0 8px;font-size:22px;">${escapeHtml(dayLabel)} ${escapeHtml(day.title || "")}</h2>
          ${day.theme ? `<p style="margin:0 0 8px;color:#667085;">${escapeHtml(day.theme)}</p>` : ""}
          ${stops ? `<ul style="margin:0;padding-left:20px;line-height:1.8;">${stops}</ul>` : ""}
        </section>
      `;
    })
    .join("");

  const reminders = (trip.reminders || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `
    <div style="max-width:960px;margin:24px auto;padding:24px;font-family:Arial,sans-serif;line-height:1.8;color:#18212f;">
      <h1 style="margin:0 0 12px;font-size:36px;">${escapeHtml(trip.title || "")}</h1>
      <p style="margin:0 0 12px;color:#667085;">${escapeHtml(buildTripDescription(trip, dict))}</p>

      ${trip.dates ? `<p style="margin:6px 0;"><strong>${escapeHtml(dict.metaDates)}：</strong>${escapeHtml(trip.dates)}</p>` : ""}
      ${trip.travelers ? `<p style="margin:6px 0;"><strong>${escapeHtml(dict.metaTravelers)}：</strong>${escapeHtml(`${trip.travelers}${dict.travelersUnit ? ` ${dict.travelersUnit}` : ""}`.trim())}</p>` : ""}
      ${trip.nights ? `<p style="margin:6px 0;"><strong>${escapeHtml(dict.metaNights)}：</strong>${escapeHtml(trip.nights)}</p>` : ""}

      ${dayBlocks}

      ${
        reminders
          ? `
          <section style="margin-top:16px;">
            <h2 style="margin:0 0 8px;font-size:22px;">${escapeHtml(dict.reminders)}</h2>
            <ul style="margin:0;padding-left:20px;line-height:1.8;">${reminders}</ul>
          </section>
        `
          : ""
      }
    </div>
  `;
}

function renderTripPage({ slug, trip }) {
  const locale = normalizeLocale(trip?.defaults?.locale);
  const dict = getDict(locale);

  const title = trip.title || slug;
  const description = buildTripDescription(trip, dict);
  const pageUrl = `${SITE_URL}/trips/${encodeURIComponent(slug)}/`;
  const imageUrl = toAbsoluteUrl(pickCoverImage(trip));
  const structuredData = JSON.stringify(
    buildTripStructuredData(trip, slug, pageUrl, imageUrl, dict),
    null,
    2
  );

  return `<!doctype html>
<html lang="${escapeAttr(dict.htmlLang)}">
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
  <meta property="og:locale" content="${escapeAttr(locale)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <meta name="twitter:image" content="${escapeAttr(imageUrl)}" />

  <script type="application/ld+json">
${structuredData}
  </script>

  <link rel="stylesheet" href="/assets/styles.css" />
</head>
<body data-page-type="trip" data-trip-slug="${escapeAttr(slug)}">
  <div id="app"></div>
  <noscript>
    ${renderTripNoscriptSummary(trip, dict)}
  </noscript>
  <script type="module" src="/assets/app.js"></script>
</body>
</html>`;
}

function renderHomePage(catalog) {
  const locale = normalizeLocale(catalog?.defaults?.locale);
  const dict = getDict(locale);
  const trips = Array.isArray(catalog?.trips) ? catalog.trips : [];

  const cards = trips
    .map((trip) => {
      const href = `/trips/${encodeURIComponent(trip.slug)}/`;
      const meta = [];
      const days = extractNumber(trip.days);
      const nights = extractNumber(trip.nights);

      if (days !== "") meta.push(`${days} ${dict.dayUnit}`);
      if (nights !== "") meta.push(`${nights} ${dict.nightUnit}`);

      return `
        <a class="trip-card" href="${href}">
          <div class="trip-cover" style="background-image:url('${escapeAttr(trip.coverImage || "")}')"></div>
          <div class="trip-body">
            <div class="trip-card-top">
              <h3>${escapeHtml(trip.title || trip.slug)}</h3>
              ${meta.length ? `<div class="trip-meta">${escapeHtml(meta.join(" / "))}</div>` : ""}
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
<html lang="${escapeAttr(dict.htmlLang)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${SITE_NAME}</title>
  <meta name="description" content="${escapeAttr(dict.homeDescription)}" />
  <link rel="canonical" href="${SITE_URL}/" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:title" content="${SITE_NAME}" />
  <meta property="og:description" content="${escapeAttr(dict.homeDescription)}" />
  <meta property="og:image" content="${DEFAULT_OG_IMAGE}" />
  <meta property="og:url" content="${SITE_URL}/" />
  <meta property="og:locale" content="${escapeAttr(locale)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${SITE_NAME}" />
  <meta name="twitter:description" content="${escapeAttr(dict.homeDescription)}" />
  <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />

  <link rel="stylesheet" href="./assets/styles.css" />
</head>
<body data-page-type="home-static">
  <div class="catalog-wrap">
    <div class="catalog-hero">
      <p class="catalog-kicker">${escapeHtml(dict.catalogKicker)}</p>
      <h1>${SITE_NAME}</h1>
      <p class="catalog-subtitle">${escapeHtml(catalog?.subtitle || dict.catalogSubtitle)}</p>
    </div>

    <section class="catalog-section">
      <div class="catalog-section-head">
        <h2>${escapeHtml(dict.trips)}</h2>
      </div>
      ${trips.length ? `<div class="trip-grid">${cards}</div>` : `<div class="empty-box">${escapeHtml(dict.noData)}</div>`}
    </section>
  </div>

  <div id="app"></div>
  <script type="module" src="./assets/app.js"></script>
</body>
</html>`;
}

function renderTripsIndexRedirect() {
  const dict = getDict("zh-TW");

  return `<!doctype html>
<html lang="${escapeAttr(dict.htmlLang)}">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0; url=/" />
  <meta name="robots" content="noindex,follow" />
  <title>${escapeHtml(dict.redirectTitle)}</title>
  <script>
    window.location.replace("/");
  </script>
</head>
<body>
  ${escapeHtml(dict.redirecting)}
</body>
</html>`;
}

function buildSitemap(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${escapeHtml(entry.loc)}</loc>
    <lastmod>${escapeHtml(entry.lastmod)}</lastmod>
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
  const files = fs.readdirSync(DATA_DIR).filter((name) => name.endsWith(".json")).sort();

  const catalogTrips = [];
  const sitemapEntries = [
    {
      loc: `${SITE_URL}/`,
      lastmod: new Date().toISOString().slice(0, 10),
    },
  ];

  for (const file of files) {
    const slug = getSlugFromFilename(file);
    const filePath = path.join(DATA_DIR, file);
    const trip = readJson(filePath);

    const html = renderTripPage({ slug, trip });
    const outPath = path.join(OUT_TRIPS_DIR, slug, "index.html");
    writeText(outPath, html);

    const lastmod =
      normalizeDateString(trip.lastmod) ||
      normalizeDateString(trip.updated_at) ||
      getFileLastmod(filePath);

    catalogTrips.push({
      ...buildCatalogEntry(slug, trip),
      lastmod,
    });

    sitemapEntries.push({
      loc: `${SITE_URL}/trips/${encodeURIComponent(slug)}/`,
      lastmod,
    });

    console.log(`[OK] ${path.relative(ROOT, outPath)}`);
  }

  const catalog = {
    defaults: {
      locale: "zh-TW",
    },
    subtitle: "",
    trips: catalogTrips,
  };

  writeText(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");
  console.log("[OK] data/catalog.json");

  writeText(ROOT_INDEX, renderHomePage(catalog));
  console.log("[OK] index.html");

  writeText(SITEMAP_PATH, buildSitemap(sitemapEntries));
  console.log("[OK] sitemap.xml");

  writeText(ROBOTS_PATH, buildRobotsTxt());
  console.log("[OK] robots.txt");

  writeText(path.join(OUT_TRIPS_DIR, "index.html"), renderTripsIndexRedirect());
  console.log("[OK] trips/index.html");
}

main();
