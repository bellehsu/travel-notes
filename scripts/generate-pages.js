#!/usr/bin/env node

import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const DATA_TRIPS_DIR = path.join(ROOT, "data", "trips");
const DATA_DESTINATIONS_DIR = path.join(ROOT, "data", "destinations");

const TRIPS_OUT_DIR = path.join(ROOT, "trips");
const DESTINATIONS_OUT_DIR = path.join(ROOT, "destinations");

const SITE_URL = "https://foodnetravel.onmixaas.com";
const SITE_NAME = "FoodneTravel";
const DEFAULT_LOCALE = "zh-TW";

main();

function main() {
  const trips = readTrips();
  generateTripPages(trips);
  const destinationUrls = generateDestinationPages(trips);
  generateCatalog(trips);
  generateHomePage();
  generateSitemap(trips, destinationUrls);
  generateRobots();
  console.log("[OK] SEO production pages generated");
}

/* =========================
   READ
========================= */

function readTrips() {
  if (!fs.existsSync(DATA_TRIPS_DIR)) return [];

  return fs
    .readdirSync(DATA_TRIPS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((file) => {
      const json = JSON.parse(fs.readFileSync(path.join(DATA_TRIPS_DIR, file), "utf8"));
      return {
        ...json,
        __fileName: file,
        __tripSlug: file.replace(/\.json$/i, "")
      };
    });
}

function readDestinationSeed(countryCode, destinationSlug) {
  const file = path.join(DATA_DESTINATIONS_DIR, countryCode, destinationSlug, "index.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/* =========================
   TRIP PAGES
========================= */

function generateTripPages(trips) {
  for (const trip of trips) {
    const outDir = path.join(TRIPS_OUT_DIR, trip.__tripSlug);
    mkdirp(outDir);

    const seo = buildTripSeo(trip);
    const html = renderTripHtml(trip, seo);
    writeFile(path.join(outDir, "index.html"), html);
  }
}

function buildTripSeo(trip) {
  const title = trip.title || trip.__tripSlug;
  const description = trip.summary || trip.subtitle || `${title}｜${SITE_NAME}`;
  const image = trip.coverImage || "";
  const canonical = `${SITE_URL}${buildTripUrl(trip.__tripSlug)}`;

  return {
    title,
    description,
    image,
    canonical,
    type: "article",
    keywords: normalizeTags(trip.tags)
  };
}

function renderTripHtml(trip, seo) {
  const jsonLd = buildTripJsonLd(trip, seo);

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(seo.title)}</title>
  <meta name="description" content="${escapeAttr(seo.description)}">
  <link rel="canonical" href="${escapeAttr(seo.canonical)}">
  ${seo.keywords.length ? `<meta name="keywords" content="${escapeAttr(seo.keywords.join(", "))}">` : ""}
  <meta property="og:type" content="${escapeAttr(seo.type)}">
  <meta property="og:site_name" content="${escapeAttr(SITE_NAME)}">
  <meta property="og:title" content="${escapeAttr(seo.title)}">
  <meta property="og:description" content="${escapeAttr(seo.description)}">
  <meta property="og:url" content="${escapeAttr(seo.canonical)}">
  ${seo.image ? `<meta property="og:image" content="${escapeAttr(seo.image)}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(seo.title)}">
  <meta name="twitter:description" content="${escapeAttr(seo.description)}">
  ${seo.image ? `<meta name="twitter:image" content="${escapeAttr(seo.image)}">` : ""}
  <link rel="stylesheet" href="/assets/styles.css">
  <script type="application/ld+json">${escapeJsonForHtml(jsonLd)}</script>
</head>
<body data-page-type="trip">
  <div id="app"></div>
  <script id="page-data" type="application/json">${escapeJsonForHtml(trip)}</script>
  <script type="module">
    import { renderTripPage } from "/assets/trip-view.js";
    const data = JSON.parse(document.getElementById("page-data").textContent);
    renderTripPage(data);
  </script>
</body>
</html>`;
}

/* =========================
   DESTINATIONS
========================= */

function generateDestinationPages(trips) {
  const groups = groupTripsByDestination(trips);
  const urls = [];

  for (const group of groups) {
    const seed = readDestinationSeed(group.countryCode, group.destinationSlug);
    const hub = buildDestinationHub({ group, seed });

    const dataDir = path.join(DATA_DESTINATIONS_DIR, group.countryCode, group.destinationSlug);
    mkdirp(dataDir);
    writeJson(path.join(dataDir, "index.generated.json"), hub);

    const hubOutDir = path.join(DESTINATIONS_OUT_DIR, group.countryCode, group.destinationSlug);
    mkdirp(hubOutDir);

    const hubSeo = buildDestinationSeo(hub);
    writeFile(path.join(hubOutDir, "index.html"), renderDestinationHtml(hub, hubSeo));
    urls.push(buildDestinationUrl(group.countryCode, group.destinationSlug));

    const pages = [
      buildRestaurantsPage({ hub, trips: group.trips, seed }),
      buildItineraryPage({ hub, trips: group.trips, seed }),
      buildBudgetPage({ hub, trips: group.trips, seed }),
      ...buildSeasonPages({ hub, trips: group.trips, seed })
    ];

    for (const page of pages) {
      writeJson(path.join(dataDir, `${page.slug}.generated.json`), page);

      const outDir = path.join(hubOutDir, page.slug);
      mkdirp(outDir);

      const seo = buildDestinationSeo(page);
      writeFile(path.join(outDir, "index.html"), renderDestinationHtml(page, seo));
      urls.push(buildDestinationPageUrl(group.countryCode, group.destinationSlug, page.slug));
    }
  }

  return urls;
}

function groupTripsByDestination(trips) {
  const map = new Map();

  for (const trip of trips) {
    const countryCode = String(trip.countryCode || "xx").toLowerCase();
    const destinationSlugs = normalizeDestinationSlugs(trip);

    for (const destinationSlug of destinationSlugs) {
      const key = `${countryCode}::${destinationSlug}`;
      if (!map.has(key)) {
        map.set(key, {
          countryCode,
          destinationSlug,
          trips: []
        });
      }
      map.get(key).trips.push(trip);
    }
  }

  return [...map.values()];
}

function buildDestinationHub({ group, seed }) {
  const trips = group.trips.slice().sort(sortTripsDesc);
  const name = seed?.name || titleCase(group.destinationSlug);
  const countryName = seed?.countryName || group.countryCode.toUpperCase();
  const featuredTrips = trips.map((trip) => buildFeaturedTrip(trip));
  const seasonTags = unique(trips.flatMap((trip) => normalizeSeasonTags(trip)));

  return {
    id: `${group.countryCode}-${group.destinationSlug}`,
    slug: group.destinationSlug,
    countryCode: group.countryCode,
    countryName,
    name,
    displayName: seed?.displayName || `${name}自由行`,
    description:
      seed?.description ||
      `想安排 ${name} 自由行，可以先從這裡看行程、餐廳、預算和季節玩法。`,
    geo:
      seed?.geo || {
        kind: "destination",
        cities: [group.destinationSlug],
        regions: [group.destinationSlug],
        country: group.countryCode
      },
    voice:
      seed?.voice || {
        tone: "warm_practical",
        audience: "first_time_independent_traveler"
      },
    seasons: seed?.seasons || seasonTags.map((tag) => buildFallbackSeason(tag)),
    hero: {
      title: seed?.hero?.title || `${name}自由行`,
      subtitle: seed?.hero?.subtitle || "行程、餐廳、預算與季節玩法整理",
      coverImage: seed?.hero?.coverImage || featuredTrips[0]?.coverImage || "",
      coverAlt: seed?.hero?.coverAlt || `${name}旅遊`
    },
    intro:
      seed?.intro ||
      `如果你正在安排 ${name}，這裡先幫你把常用入口整理好。你可以先看整體行程，再慢慢往餐廳、預算或季節頁走。`,
    highlights:
      seed?.highlights ||
      [
        "先抓方向，再決定每天怎麼排",
        "行程、餐廳和預算可以分開看，不容易亂",
        "適合第一次規劃這個城市時先建立版本"
      ],
    areas: ensureArray(seed?.areas),
    collections:
      seed?.collections ||
      [
        {
          key: "by-topic",
          title: "依主題找內容",
          items: [
            {
              label: `${name}餐廳推薦`,
              url: buildDestinationPageUrl(group.countryCode, group.destinationSlug, "restaurants")
            },
            {
              label: `${name}行程整理`,
              url: buildDestinationPageUrl(group.countryCode, group.destinationSlug, "itinerary")
            },
            {
              label: `${name}預算整理`,
              url: buildDestinationPageUrl(group.countryCode, group.destinationSlug, "budget")
            }
          ]
        }
      ],
    sections:
      seed?.sections ||
      [
        {
          id: "start-here",
          title: `${name}怎麼開始規劃`,
          summary: `如果你還沒有很明確的版本，先從推薦行程抓出方向，再慢慢往餐廳和預算細修就好。`,
          bullets: [
            "先選擇幾天",
            "再看這趟偏吃、偏逛還是偏放鬆",
            "最後才進單一 trip page 看每天細節"
          ]
        }
      ],
    featuredTrips,
    featuredPages: buildFeaturedPages(group.countryCode, group.destinationSlug, name, seasonTags),
    faq:
      seed?.faq ||
      [
        {
          q: `第一次排 ${name}，建議先看哪一頁？`,
          a: "通常先看行程整理最有用，先抓版本，再進細節。"
        }
      ],
    internalLinks:
      seed?.internalLinks ||
      [
        {
          label: `查看${name}行程整理`,
          url: buildDestinationPageUrl(group.countryCode, group.destinationSlug, "itinerary")
        },
        {
          label: "查看完整行程",
          url: featuredTrips[0]?.url || "#"
        }
      ],
    seo: {
      title: seed?.seo?.title || `${name}自由行規劃｜行程、餐廳、預算與季節玩法整理`,
      description:
        seed?.seo?.description ||
        `想安排 ${name} 自由行，這裡先幫你整理行程、餐廳、預算和季節玩法。`,
      keywords:
        ensureArray(seed?.seo?.keywords).length
          ? seed.seo.keywords
          : [`${name}自由行`, `${name}行程`, `${name}旅遊規劃`]
    },
    contentConfig: {
      defaultLanguage: seed?.contentConfig?.defaultLanguage || DEFAULT_LOCALE,
      pageKinds: ensureArray(seed?.contentConfig?.pageKinds).length
        ? seed.contentConfig.pageKinds
        : ["restaurants", "itinerary", "budget", "season"]
    }
  };
}

function buildFeaturedPages(countryCode, destinationSlug, destinationName, seasonTags) {
  return [
    {
      pageSlug: "restaurants",
      title: `${destinationName}餐廳推薦`,
      summary: `從旅遊動線出發，整理比較好安排的用餐方向。`,
      url: buildDestinationPageUrl(countryCode, destinationSlug, "restaurants")
    },
    {
      pageSlug: "itinerary",
      title: `${destinationName}行程整理`,
      summary: `先看不同版本怎麼玩，再決定要跟哪一份 trip。`,
      url: buildDestinationPageUrl(countryCode, destinationSlug, "itinerary")
    },
    {
      pageSlug: "budget",
      title: `${destinationName}預算整理`,
      summary: `先看花費結構，再決定這趟預算要抓到哪裡。`,
      url: buildDestinationPageUrl(countryCode, destinationSlug, "budget")
    },
    ...seasonTags.map((tag) => ({
      pageSlug: `season-${tag}`,
      title: `${resolveSeasonLabelFromTag(tag)}${destinationName}`,
      summary: `從季節出發，看這段時間適合怎麼安排。`,
      url: buildDestinationPageUrl(countryCode, destinationSlug, `season-${tag}`)
    }))
  ];
}

/* =========================
   PAGE BUILDERS
========================= */

function buildRestaurantsPage({ hub, trips, seed }) {
  const restaurantItems = collectRestaurantItems(trips);
  const areaPhrase = buildAreaPhrase(seed, hub.name);
  const tripCount = hub.featuredTrips.length;

  return {
    type: "destination-seo",
    pageKind: "restaurants",
    countryCode: hub.countryCode,
    destinationSlug: hub.destinationSlug,
    slug: "restaurants",
    hero: {
      title: `${hub.name}餐廳推薦`,
      subtitle: "從行程動線出發，整理比較好安排的用餐選擇"
    },
    seo: {
      title: `${hub.name}餐廳推薦｜${areaPhrase}用餐整理`,
      description: `整理 ${hub.name} 自由行中比較好安排的餐廳與用餐區域，讓你先抓方向，不用一開始就查得很碎。`,
      keywords: [`${hub.name}餐廳推薦`, `${hub.name}美食`, `${hub.name}吃什麼`]
    },
    intro: `如果你在排 ${hub.name} 時，最容易卡住的是「這一區到底要吃什麼」，這頁就是先幫你把方向整理出來。這裡不是單純丟一串店名，而是優先根據目前已建立的 ${tripCount} 份 trip，把實際有出現的餐廳、用餐區域和動線一起整理，讓你比較容易判斷哪些適合排早餐、哪些適合排晚餐。`,
    highlights: [
      "先看區域，再決定吃什麼，通常比追單一名店更順",
      "優先整理已出現在 trip 裡的餐廳與用餐安排",
      "適合先做第一版餐廳規劃，再回頭細修"
    ],
    sections: [
      {
        id: "how-to-use",
        title: `${hub.name}餐廳頁怎麼看比較有效`,
        summary: `如果你還在旅遊前期規劃階段，建議先不要急著選每一餐吃哪一家，而是先看區域分布與行程節奏。`,
        bullets: [
          "先看你主要住哪一區，決定早餐與晚餐重心",
          "中午的餐廳通常跟白天景點綁在一起比較順",
          "熱門店可以最後再精修，不要一開始就綁死整趟行程"
        ]
      },
      {
        id: "restaurant-areas",
        title: `${hub.name}目前比較常出現的用餐區域`,
        summary: `先從目前 trip 裡比較常出現，也比較容易排進旅遊動線的區域開始。`,
        bullets: buildRestaurantAreaBullets(seed, restaurantItems, hub.name)
      }
    ],
    faq: [
      {
        q: `${hub.name}適合先排餐廳還是先排行程？`,
        a: "通常先把景點和區域動線抓出來，再把餐廳塞進去，整體會比較順。"
      },
      {
        q: `${hub.name}這頁的資料怎麼來的？`,
        a: "這頁優先整理目前 trip JSON 裡已經出現的餐廳與用餐安排，所以偏向比較能實際排進行程的選項。"
      }
    ],
    internalLinks: [
      {
        label: `回到${hub.name}目的地首頁`,
        url: buildDestinationUrl(hub.countryCode, hub.destinationSlug)
      },
      {
        label: `查看${hub.name}行程整理`,
        url: buildDestinationPageUrl(hub.countryCode, hub.destinationSlug, "itinerary")
      }
    ],
    cta: {
      title: "餐廳先不用排太滿",
      body: "先把每日路線看順，再回到完整 trip page 把餐廳放進去，通常比一開始就硬塞名店更好用。",
      primaryLabel: "查看完整行程",
      primaryUrl: hub.featuredTrips[0]?.url || "#"
    },
    featuredTrips: hub.featuredTrips,
    featuredPages: hub.featuredPages.filter((x) => x.pageSlug !== "restaurants"),
    restaurantItems
  };
}

function buildItineraryPage({ hub, trips, seed }) {
  const highlights = collectItineraryHighlights(trips);
  const tripCount = hub.featuredTrips.length;

  return {
    type: "destination-seo",
    pageKind: "itinerary",
    countryCode: hub.countryCode,
    destinationSlug: hub.destinationSlug,
    slug: "itinerary",
    hero: {
      title: `${hub.name}行程整理`,
      subtitle: "先看不同版本怎麼玩，再決定要跟哪一份 trip"
    },
    seo: {
      title: `${hub.name}行程整理｜不同版本 trip 的動線與重點`,
      description: `整理 ${hub.name} 不同版本 trip 的安排方式，適合先比較天數、節奏與主題，再決定要看哪一份完整行程。`,
      keywords: [`${hub.name}行程`, `${hub.name}自由行`, `${hub.name}旅遊規劃`]
    },
    intro: `這頁比較像 ${hub.name} 行程的入口。比起一開始就鑽進某一份 trip 的細節，先從這裡看不同版本怎麼排、幾天比較適合、哪些安排比較符合你的節奏，通常會比較省時間。尤其如果你還在猶豫要排幾天，先看這頁會比直接看單篇行程更有方向。`,
    highlights: [
      `目前已整理 ${tripCount} 種 ${hub.name} trip 版本`,
      "適合先比較天數與節奏，再進單一行程",
      "先抓大方向，不必一開始就看很細"
    ],
    sections: [
      {
        id: "how-to-start",
        title: `第一次排 ${hub.name}，建議先看什麼`,
        summary: `如果你現在還沒有很明確的版本，建議先用天數和節奏來篩選。`,
        bullets: [
          "先決定這趟要排幾天，再看對應版本",
          "先看景點密度，確認自己能不能接受那個節奏",
          "選到接近的版本後，再進單一 trip 看每日細節"
        ]
      },
      {
        id: "trip-versions",
        title: "目前可參考的行程版本",
        summary: `${hub.name} 現在已整理的 trip，都可以先從這裡快速比較。`,
        bullets: hub.featuredTrips.map((trip) => {
          const parts = [trip.title];
          if (trip.days) parts.push(`${trip.days}天`);
          if (trip.nights || trip.nights === 0) parts.push(`${trip.nights}晚`);
          if (trip.seasonTags?.length) parts.push(`季節：${trip.seasonTags.join(", ")}`);
          if (trip.tags?.length) parts.push(`主題：${trip.tags.slice(0, 3).join(", ")}`);
          return parts.join("｜");
        })
      },
      {
        id: "route-highlights",
        title: `${hub.name}行程常見亮點`,
        summary: `這些是目前 trip 裡比較常出現的安排，可以幫你快速理解 ${hub.name} 大致會怎麼玩。`,
        bullets: highlights.slice(0, 12)
      }
    ],
    faq: [
      {
        q: `第一次去 ${hub.name}，建議先看幾天版本？`,
        a: "建議先從你最可能安排的天數開始看，不用一開始就追求最完整版本。"
      },
      {
        q: "這頁和單一 trip page 差在哪裡？",
        a: "這頁是比較入口，幫你先看懂不同版本的差異；單一 trip page 則是每天的景點、餐廳、地圖與預算細節。"
      }
    ],
    internalLinks: [
      {
        label: `回到${hub.name}目的地首頁`,
        url: buildDestinationUrl(hub.countryCode, hub.destinationSlug)
      },
      {
        label: `查看${hub.name}餐廳推薦`,
        url: buildDestinationPageUrl(hub.countryCode, hub.destinationSlug, "restaurants")
      }
    ],
    cta: {
      title: "先挑一個最接近你的版本",
      body: "不用一開始就追求完美行程，先選一份最接近你的天數與節奏，再進完整 trip page 微調會更快。",
      primaryLabel: "查看推薦行程",
      primaryUrl: hub.featuredTrips[0]?.url || "#"
    },
    featuredTrips: hub.featuredTrips,
    featuredPages: hub.featuredPages.filter((x) => x.pageSlug !== "itinerary")
  };
}

function buildBudgetPage({ hub, trips, seed }) {
  const budgetSummary = collectBudgetSummary(trips);

  return {
    type: "destination-seo",
    pageKind: "budget",
    countryCode: hub.countryCode,
    destinationSlug: hub.destinationSlug,
    slug: "budget",
    hero: {
      title: `${hub.name}預算整理`,
      subtitle: "先抓大方向，再決定這趟要花到哪裡"
    },
    seo: {
      title: `${hub.name}預算整理｜住宿、交通、餐飲與活動花費`,
      description: `整理 ${hub.name} trip 中已出現的預算結構，讓你先抓出住宿、交通、餐飲與活動的大致分布。`,
      keywords: [`${hub.name}預算`, `${hub.name}花費`, `${hub.name}自由行預算`]
    },
    intro: `排 ${hub.name} 行程時，預算通常不是要抓到每一筆都完全準，而是先知道哪幾塊最容易拉高總花費。這頁會先把目前 trip 裡已經出現的預算分類整理出來，讓你快速判斷住宿、交通、餐飲和活動大概怎麼分配。等你決定了旅行版本，再回到單一 trip page 看更細的明細就好。`,
    highlights: [
      "先看花費結構，不用一開始就算得很細",
      "預算資料直接來自現有 trip JSON",
      "適合拿來比較不同版本 trip 的支出方向"
    ],
    sections: [
      {
        id: "budget-thinking",
        title: `${hub.name}預算怎麼抓比較實際`,
        summary: `規劃前期先看大結構，比死算每一筆更有用。`,
        bullets: [
          "住宿通常最先決定整體預算區間",
          "活動與票券會影響每天的花費密度",
          "餐飲不一定最貴，但很容易因為次數多而累積",
          "交通如果跨區太多，支出也會慢慢拉高"
        ]
      },
      {
        id: "budget-structure",
        title: `${hub.name}目前常見的預算結構`,
        summary: `以下是目前 trip 裡已經出現的預算分類，適合先拿來做大方向判斷。`,
        bullets: budgetSummary
      }
    ],
    faq: [
      {
        q: `${hub.name}預算頁的數字是固定報價嗎？`,
        a: "不是，這頁主要整理目前 trip JSON 裡已經輸入的花費結構，適合當估算與比較基礎。"
      },
      {
        q: "如果我想看更細的花費，應該看哪裡？",
        a: "建議直接進單一 trip page，看該版本拆出的住宿、交通、餐飲與活動明細。"
      }
    ],
    internalLinks: [
      {
        label: `回到${hub.name}目的地首頁`,
        url: buildDestinationUrl(hub.countryCode, hub.destinationSlug)
      },
      {
        label: `查看${hub.name}行程整理`,
        url: buildDestinationPageUrl(hub.countryCode, hub.destinationSlug, "itinerary")
      }
    ],
    cta: {
      title: "先抓方向，不用先算到太細",
      body: "先把總體預算區間抓出來，再進完整 trip page 看每日安排與花費，通常會更好下決定。",
      primaryLabel: "查看完整行程",
      primaryUrl: hub.featuredTrips[0]?.url || "#"
    },
    featuredTrips: hub.featuredTrips,
    featuredPages: hub.featuredPages.filter((x) => x.pageSlug !== "budget")
  };
}

function buildSeasonPages({ hub, trips, seed }) {
  const seasonTags = unique(trips.flatMap((trip) => normalizeSeasonTags(trip)));

  return seasonTags.map((seasonTag) => {
    const seasonTrips = trips.filter((trip) => normalizeSeasonTags(trip).includes(seasonTag));
    const season = findSeason(seed, seasonTag);
    const seasonLabel = season?.label || resolveSeasonLabelFromTag(seasonTag);
    const seasonHighlights = season?.highlights?.length
      ? season.highlights
      : fallbackSeasonHighlights(seasonTag, hub.name);

    return {
      type: "destination-season",
      pageKind: "season",
      countryCode: hub.countryCode,
      destinationSlug: hub.destinationSlug,
      slug: `season-${seasonTag}`,
      seasonTag,
      hero: {
        title: `${seasonLabel}${hub.name}`,
        subtitle: "這個季節適合怎麼玩、怎麼排"
      },
      seo: {
        title: `${seasonLabel}${hub.name}自由行｜行程、節奏與玩法整理`,
        description: `整理 ${hub.name} 在${seasonLabel}的旅遊方式，包含行程安排與這個季節比較適合的節奏。`,
        keywords: [`${seasonLabel}${hub.name}`, `${hub.name}${seasonLabel}`, `${hub.name}季節旅行`]
      },
      intro: `如果你打算在 ${seasonLabel} 去 ${hub.name}，真正有幫助的通常不是知道「能不能去」，而是這個季節適合怎麼排。這頁會先把目前已整理的 ${seasonLabel} trip 集中起來，幫你先抓出這段時間比較適合的安排方向，再決定要不要跟其中一份行程。`,
      highlights: seasonHighlights,
      sections: [
        {
          id: "season-feel",
          title: `${seasonLabel}${hub.name}大概是什麼感覺`,
          summary: `不同季節去同一個城市，體驗會差很多。先抓節奏和感覺，後面排行程會更穩。`,
          bullets: buildSeasonBullets(seed, seasonTag, hub.name)
        },
        {
          id: "season-trips",
          title: `${seasonLabel}可以參考的行程`,
          summary: `以下是目前屬於 ${seasonLabel} 的 trip。`,
          bullets: seasonTrips.map((trip) => trip.title || trip.__tripSlug)
        }
      ],
      faq: [
        {
          q: `${seasonLabel}適合去 ${hub.name} 嗎？`,
          a: "通常可以，重點是看你這趟想要的是什麼節奏，再選對應版本。"
        }
      ],
      internalLinks: [
        {
          label: `回到${hub.name}目的地首頁`,
          url: buildDestinationUrl(hub.countryCode, hub.destinationSlug)
        },
        {
          label: `查看${hub.name}完整行程整理`,
          url: buildDestinationPageUrl(hub.countryCode, hub.destinationSlug, "itinerary")
        }
      ],
      cta: {
        title: "先選一個最接近你的版本",
        body: `先從 ${seasonLabel} 的行程版本挑一個最接近你的，再進完整 trip page 微調，會比從零開始排快很多。`,
        primaryLabel: "查看推薦行程",
        primaryUrl: seasonTrips[0] ? buildTripUrl(seasonTrips[0].__tripSlug) : (hub.featuredTrips[0]?.url || "#")
      },
      featuredTrips: seasonTrips.map((trip) => buildFeaturedTrip(trip)),
      featuredPages: hub.featuredPages.filter((x) => x.pageSlug !== `season-${seasonTag}`)
    };
  });
}

/* =========================
   CATALOG / HOME
========================= */

function generateCatalog(trips) {
  const catalog = {
    defaults: {
      locale: DEFAULT_LOCALE
    },
    title: SITE_NAME,
    subtitle: "Travel planning with food, itinerary and tools",
    trips: trips
      .slice()
      .sort(sortTripsDesc)
      .map((trip) => ({
        slug: trip.__tripSlug,
        title: trip.title || trip.__tripSlug,
        summary: trip.summary || trip.subtitle || "",
        coverImage: trip.coverImage || "",
        days: inferDays(trip),
        nights: inferNights(trip),
        tags: normalizeTags(trip.tags)
      }))
  };

  writeJson(path.join(ROOT, "data", "catalog.json"), catalog);
}

function generateHomePage() {
  const seo = {
    title: `${SITE_NAME}｜旅遊規劃、餐廳與行程整理`,
    description: "整理旅遊行程、餐廳、票券與預算，先從目的地與實際 trip 開始規劃。",
    canonical: `${SITE_URL}/`,
    type: "website"
  };

  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(seo.title)}</title>
  <meta name="description" content="${escapeAttr(seo.description)}">
  <link rel="canonical" href="${escapeAttr(seo.canonical)}">
  <meta property="og:type" content="${escapeAttr(seo.type)}">
  <meta property="og:site_name" content="${escapeAttr(SITE_NAME)}">
  <meta property="og:title" content="${escapeAttr(seo.title)}">
  <meta property="og:description" content="${escapeAttr(seo.description)}">
  <meta property="og:url" content="${escapeAttr(seo.canonical)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/assets/styles.css">
</head>
<body data-page-type="home-static">
  <div id="app"></div>
  <script type="module" src="/assets/app.js"></script>
</body>
</html>`;

  writeFile(path.join(ROOT, "index.html"), html);
}

/* =========================
   SITEMAP / ROBOTS
========================= */

function generateSitemap(trips, destinationUrls) {
  const urls = ["/", "/trips/"];

  for (const trip of trips) {
    urls.push(buildTripUrl(trip.__tripSlug));
  }
  for (const url of destinationUrls) {
    urls.push(url);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${unique(urls)
  .map((u) => `  <url>
    <loc>${escapeXml(`${SITE_URL}${u}`)}</loc>
  </url>`)
  .join("\n")}
</urlset>
`;

  writeFile(path.join(ROOT, "sitemap.xml"), xml);
}

function generateRobots() {
  const content = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
  writeFile(path.join(ROOT, "robots.txt"), content);
}

/* =========================
   RENDERERS
========================= */

function buildDestinationSeo(page) {
  const title = page?.seo?.title || page?.hero?.title || "Destination";
  const description = page?.seo?.description || page?.intro || "";
  const canonical = `${SITE_URL}${buildPageUrl(page)}`;
  const image = page?.hero?.coverImage || page?.featuredTrips?.[0]?.coverImage || "";
  const keywords = ensureArray(page?.seo?.keywords);
  const type = page?.type === "destination-hub" ? "website" : "article";

  return { title, description, canonical, image, keywords, type };
}

function renderDestinationHtml(page, seo) {
  const jsonLd = buildDestinationJsonLd(page, seo);

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(seo.title)}</title>
  <meta name="description" content="${escapeAttr(seo.description)}">
  <link rel="canonical" href="${escapeAttr(seo.canonical)}">
  ${seo.keywords.length ? `<meta name="keywords" content="${escapeAttr(seo.keywords.join(", "))}">` : ""}
  <meta property="og:type" content="${escapeAttr(seo.type)}">
  <meta property="og:site_name" content="${escapeAttr(SITE_NAME)}">
  <meta property="og:title" content="${escapeAttr(seo.title)}">
  <meta property="og:description" content="${escapeAttr(seo.description)}">
  <meta property="og:url" content="${escapeAttr(seo.canonical)}">
  ${seo.image ? `<meta property="og:image" content="${escapeAttr(seo.image)}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(seo.title)}">
  <meta name="twitter:description" content="${escapeAttr(seo.description)}">
  ${seo.image ? `<meta name="twitter:image" content="${escapeAttr(seo.image)}">` : ""}
  <link rel="stylesheet" href="/assets/styles.css">
  <script type="application/ld+json">${escapeJsonForHtml(jsonLd)}</script>
</head>
<body data-page-type="${escapeAttr(page.type === "destination-hub" ? "destination" : "destination-seo")}">
  <div id="app"></div>
  <script id="page-data" type="application/json">${escapeJsonForHtml(page)}</script>
  <script type="module">
    import { renderDestinationPage } from "/assets/destination-view.js";
    const data = JSON.parse(document.getElementById("page-data").textContent);
    renderDestinationPage(data);
  </script>
</body>
</html>`;
}

/* =========================
   JSON-LD
========================= */

function buildTripJsonLd(trip, seo) {
  return {
    "@context": "https://schema.org",
    "@type": "TravelItinerary",
    name: seo.title,
    description: seo.description,
    url: seo.canonical,
    image: seo.image || undefined,
    itinerary: Array.isArray(trip.days)
      ? trip.days.map((day, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: day.title || day.label || `Day ${index + 1}`
        }))
      : undefined
  };
}

function buildDestinationJsonLd(page, seo) {
  const base = {
    "@context": "https://schema.org",
    "@type": page.type === "destination-hub" ? "CollectionPage" : "Article",
    headline: seo.title,
    description: seo.description,
    url: seo.canonical,
    image: seo.image || undefined
  };

  if (page.type === "destination-hub") {
    base.mainEntity = {
      "@type": "ItemList",
      itemListElement: ensureArray(page.featuredTrips).map((trip, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: trip.title,
        url: `${SITE_URL}${trip.url}`
      }))
    };
  }

  if (ensureArray(page.faq).length) {
    base.hasPart = {
      "@type": "FAQPage",
      mainEntity: page.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a
        }
      }))
    };
  }

  return base;
}

/* =========================
   HELPERS
========================= */

function normalizeDestinationSlugs(trip) {
  const raw = trip.destinationSlugs ?? trip.destinationSlug ?? [];
  if (Array.isArray(raw)) return raw.map(String).map((x) => x.trim()).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

function normalizeSeasonTags(trip) {
  const raw = trip.seasonTags ?? [];
  if (Array.isArray(raw)) return raw.map(String).map((x) => x.trim()).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map(String).map((x) => x.trim()).filter(Boolean);
  if (typeof tags === "string" && tags.trim()) return [tags.trim()];
  return [];
}

function buildFeaturedTrip(trip) {
  return {
    tripSlug: trip.__tripSlug,
    title: trip.title || trip.__tripSlug,
    summary: trip.summary || trip.subtitle || "",
    days: inferDays(trip),
    nights: inferNights(trip),
    seasonTags: normalizeSeasonTags(trip),
    tags: normalizeTags(trip.tags),
    coverImage: trip.coverImage || "",
    url: buildTripUrl(trip.__tripSlug)
  };
}

function inferDays(trip) {
  if (Number.isFinite(Number(trip?.days))) return Number(trip.days);
  if (Array.isArray(trip?.days)) return trip.days.length;
  return 0;
}

function inferNights(trip) {
  if (Number.isFinite(Number(trip?.nights))) return Number(trip.nights);
  const days = inferDays(trip);
  return days > 0 ? Math.max(days - 1, 0) : 0;
}

function collectRestaurantItems(trips) {
  const items = [];

  for (const trip of trips) {
    const shops = ensureArray(trip.shops);
    for (const shop of shops) {
      if (!isRestaurantItem(shop)) continue;
      items.push({
        name: shop.name || "",
        area: inferArea(shop),
        note: shop.note || "",
        map: shop.map || "",
        tripSlug: trip.__tripSlug
      });
    }

    const days = ensureArray(trip.days);
    for (const day of days) {
      const stops = ensureArray(day.stops);
      for (const stop of stops) {
        if (!isRestaurantStop(stop)) continue;
        items.push({
          name: stop.name || "",
          area: inferArea(stop),
          note: stop.note || "",
          map: stop.map || "",
          tripSlug: trip.__tripSlug
        });
      }
    }
  }

  const dedup = new Map();
  for (const item of items) {
    const key = `${item.name}::${item.map}`;
    if (!dedup.has(key)) dedup.set(key, item);
  }
  return [...dedup.values()];
}

function isRestaurantItem(shop) {
  const tag = String(shop?.tag || "").toLowerCase();
  const note = String(shop?.note || "").toLowerCase();
  return tag.includes("餐廳") || tag.includes("food") || note.includes("餐") || note.includes("食");
}

function isRestaurantStop(stop) {
  const type = String(stop?.type || "").toLowerCase();
  const name = String(stop?.name || "").toLowerCase();
  return type.includes("餐飲") || name.includes("早餐") || name.includes("午餐") || name.includes("晚餐");
}

function inferArea(item) {
  if (item?.area) return item.area;
  if (item?.address?.short) return item.address.short;
  if (item?.address?.full) return item.address.full;
  return "";
}

function collectItineraryHighlights(trips) {
  const names = [];
  for (const trip of trips) {
    for (const day of ensureArray(trip.days)) {
      for (const stop of ensureArray(day.stops)) {
        if (stop?.name) names.push(stop.name);
      }
    }
  }
  return unique(names);
}

function collectBudgetSummary(trips) {
  const totals = new Map();

  for (const trip of trips) {
    for (const item of ensureArray(trip.budget_items)) {
      const label = item?.label || "其他";
      const value = Number(item?.value || 0);
      totals.set(label, (totals.get(label) || 0) + value);
    }
  }

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount]) => `${label}｜${formatNumber(amount)}`);
}

function buildAreaPhrase(seed, fallbackName) {
  const areaNames = ensureArray(seed?.areas).map((a) => a.name).filter(Boolean);
  if (areaNames.length >= 3) return areaNames.slice(0, 3).join("、");
  if (areaNames.length > 0) return areaNames.join("、");
  return `${fallbackName}各區`;
}

function buildRestaurantAreaBullets(seed, restaurantItems, cityName) {
  const seedAreas = ensureArray(seed?.areas).map((a) => a.name).filter(Boolean);
  const dataAreas = unique(restaurantItems.map((item) => item.area).filter(Boolean));
  const areas = unique([...seedAreas, ...dataAreas]).slice(0, 6);

  if (!areas.length) {
    return [
      `${cityName}住宿區｜適合排早餐與晚餐`,
      `${cityName}熱鬧區｜適合購物後安排晚餐`,
      `${cityName}散步區｜適合白天景點搭配用餐`
    ];
  }

  return areas.map((name) => `${name}｜適合和同區域景點一起安排，不容易把動線切碎`);
}

function buildFallbackSeason(tag) {
  return {
    key: tag,
    label: resolveSeasonLabelFromTag(tag),
    highlights: fallbackSeasonHighlights(tag, "")
  };
}

function fallbackSeasonHighlights(tag, cityName) {
  const map = {
    spring: ["天氣舒服", "適合散步", "戶外安排會比較輕鬆"],
    summer: ["活動感比較強", "適合排海景與夜晚行程", "白天建議留彈性"],
    autumn: ["氣候穩定", "適合慢慢走", "購物和城市散步都舒服"],
    winter: ["適合排美食", "室內行程舒服", "節奏可以放慢一點"]
  };
  return map[tag] || [`${cityName || "這個城市"}在這個季節有不同玩法`];
}

function buildSeasonBullets(seed, seasonTag, cityName) {
  const season = findSeason(seed, seasonTag);
  if (season?.highlights?.length) return season.highlights;
  return fallbackSeasonHighlights(seasonTag, cityName);
}

function findSeason(seed, tag) {
  return ensureArray(seed?.seasons).find((x) => x.key === tag) || null;
}

function resolveSeasonLabelFromTag(tag) {
  const map = {
    spring: "春季",
    summer: "夏季",
    autumn: "秋季",
    fall: "秋季",
    winter: "冬季"
  };
  return map[tag] || tag;
}

function sortTripsDesc(a, b) {
  const aDate = String(a.lastmod || "");
  const bDate = String(b.lastmod || "");
  return bDate.localeCompare(aDate);
}

function generateHomePageUrl() {
  return "/";
}

function buildTripUrl(tripSlug) {
  return `/trips/${encodeURIComponent(tripSlug)}/`;
}

function buildDestinationUrl(countryCode, destinationSlug) {
  return `/destinations/${encodeURIComponent(countryCode)}/${encodeURIComponent(destinationSlug)}/`;
}

function buildDestinationPageUrl(countryCode, destinationSlug, pageSlug) {
  return `/destinations/${encodeURIComponent(countryCode)}/${encodeURIComponent(destinationSlug)}/${encodeURIComponent(pageSlug)}/`;
}

function buildPageUrl(page) {
  if (page.type === "destination-hub") {
    return buildDestinationUrl(page.countryCode, page.destinationSlug);
  }
  return buildDestinationPageUrl(page.countryCode, page.destinationSlug, page.slug);
}

function titleCase(value) {
  return String(value || "")
    .split(/[-_]/g)
    .filter(Boolean)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(arr) {
  return [...new Set(ensureArray(arr).filter(Boolean))];
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString("en-US");
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function writeJson(filePath, data) {
  writeFile(filePath, JSON.stringify(data, null, 2) + "\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeJsonForHtml(obj) {
  return JSON.stringify(obj)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}
