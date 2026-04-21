const dictionaries = {
  "zh-TW": {
    /* global */
    siteTitle: "TravelHub",
    noData: "沒有資料",
    untitledTrip: "未命名行程",
    open: "查看",
    total: "總額",
    address: "地址",

    /* catalog */
    catalogKicker: "Travel",
    catalogSubtitle: "旅遊行程分享，包含完整行程、地圖、預算與住宿資訊。",
    trips: "Trips",
    dayUnit: "天",
    nightUnit: "晚",

    /* trip page */
    day: "Day",
    mapInfo: "地圖資訊",
    itinerary: "行程",
    stays: "住宿",
    shops: "資訊",
    reminders: "行前提醒",
    dates: "日期",
    travelers: "同行人數",
    budgetLimit: "預算上限",
    nights: "住宿安排",
    duration: "停留",
    transit: "移動",
    highlight: "重點",
    budgetTabsName: "預算",
    dataError: "資料錯誤",

    /* budget */
    totalLabel: "總額",
    allCategories: "全部分類加總",
    detailsTotal: "明細加總",
    share: "分類占比",
    item: "項目",

    /* fallback labels */
    stop: "Stop",
    stay: "住宿",
    info: "資訊",
    place: "地點",
    shop: "店家",
  },

  en: {
    /* global */
    siteTitle: "TravelHub",
    noData: "No data",
    untitledTrip: "Untitled Trip",
    open: "Open",
    total: "Total",
    address: "Address",

    /* catalog */
    catalogKicker: "Travel",
    catalogSubtitle: "Travel notes with itinerary, maps, budget, stays, and useful places.",
    trips: "Trips",
    dayUnit: "days",
    nightUnit: "nights",

    /* trip page */
    day: "Day",
    mapInfo: "Map",
    itinerary: "Itinerary",
    stays: "Stays",
    shops: "Information",
    reminders: "Reminders",
    dates: "Dates",
    travelers: "Travelers",
    budgetLimit: "Budget Limit",
    nights: "Stays",
    duration: "Duration",
    transit: "Transit",
    highlight: "Highlight",
    budgetTabsName: "Budget",
    dataError: "Data Error",

    /* budget */
    totalLabel: "Total",
    allCategories: "All categories",
    detailsTotal: "Details total",
    share: "Share",
    item: "Item",

    /* fallback labels */
    stop: "Stop",
    stay: "Stay",
    info: "Info",
    place: "Place",
    shop: "Shop",
  },
};

function normalizeLocale(locale) {
  if (!locale || typeof locale !== "string") return "zh-TW";

  if (dictionaries[locale]) return locale;

  const lowered = locale.toLowerCase();

  if (lowered === "zh" || lowered === "zh-tw") return "zh-TW";
  if (lowered === "en" || lowered === "en-us" || lowered === "en-gb") return "en";

  return "zh-TW";
}

export function resolveLocale(defaultLocale = "zh-TW") {
  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang");

  if (lang) {
    const normalized = normalizeLocale(lang);
    if (dictionaries[normalized]) return normalized;
  }

  return normalizeLocale(defaultLocale);
}

export function createI18n(locale = "zh-TW") {
  const normalized = normalizeLocale(locale);
  const dict = dictionaries[normalized] || dictionaries["zh-TW"];

  return {
    locale: normalized,
    t(key) {
      return dict[key] || key;
    },
  };
}

export function getDictionary(locale = "zh-TW") {
  const normalized = normalizeLocale(locale);
  return dictionaries[normalized] || dictionaries["zh-TW"];
}
