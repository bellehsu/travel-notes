function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function toNumberOrUndefined(value) {
  if (value === "" || value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (!match) return undefined;
    const n = Number(match[0]);
    return Number.isFinite(n) ? n : undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function timeToMinutes(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return undefined;
  return h * 60 + m;
}

function parseTimeRange(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})$/);
  if (!match) return { start: text, duration: undefined };
  const start = match[1].padStart(5, "0");
  const end = match[2].padStart(5, "0");
  const startMin = timeToMinutes(start);
  let endMin = timeToMinutes(end);
  if (startMin !== undefined && endMin !== undefined) {
    if (endMin < startMin) endMin += 24 * 60;
    return { start, duration: endMin - startMin };
  }
  return { start, duration: undefined };
}

function normalizePhoto(photo) {
  if (!photo) return null;
  if (typeof photo === "string") return { src: photo, alt: "" };
  if (isObject(photo) && typeof photo.src === "string") {
    return { src: photo.src, alt: typeof photo.alt === "string" ? photo.alt : "" };
  }
  return null;
}

function normalizePhotos(photos) {
  return Array.isArray(photos) ? photos.map(normalizePhoto).filter(Boolean) : [];
}

function normalizePrice(price) {
  if (price === "" || price === undefined || price === null) return undefined;
  if (typeof price === "string") return { kind: "text", text: price };
  if (typeof price === "number") return { kind: "fixed", amount: price };
  if (!isObject(price)) return undefined;

  const out = { ...price };
  if (!out.kind) {
    if (typeof out.amount === "number") out.kind = "fixed";
    else if (typeof out.min === "number" || typeof out.max === "number") out.kind = "range";
    else out.kind = "free";
  }
  return out;
}

function normalizeAddress(address, legacyShortAddress) {
  if (isObject(address)) {
    return {
      short: toString(address.short),
      full: toString(address.full),
    };
  }
  if (typeof address === "string" || typeof legacyShortAddress === "string") {
    return {
      short: typeof legacyShortAddress === "string" ? legacyShortAddress : "",
      full: typeof address === "string" ? address : "",
    };
  }
  return { short: "", full: "" };
}

function normalizeStop(stop = {}, stopIndex = 0) {
  const parsedTime = stop.start_time ? { start: toString(stop.start_time), duration: undefined } : parseTimeRange(stop.time);
  const startTime = parsedTime.start;
  const durationMin = toNumberOrUndefined(stop.duration_min) ?? parsedTime.duration ?? toNumberOrUndefined(stop.stay);
  return {
    // 不要求 JSON 寫 id；畫面需要的 item 編號 / DOM id 由 trip-view.js 依 day + index 動態產生。
    name: toString(stop.name),
    maps_label: toString(stop.maps_label),
    type: toString(stop.type),
    start_time: startTime,
    duration_min: durationMin,
    transit_to_next_min: toNumberOrUndefined(stop.transit_to_next_min),
    price: normalizePrice(stop.price ?? stop.cost),
    address: normalizeAddress(stop.address, stop.short_address),
    map: toString(stop.map),
    note: toString(stop.note),
    next: toString(stop.next),
    tags: Array.isArray(stop.tags) ? stop.tags.map((x) => toString(x)).filter(Boolean) : [],
    lat: toNumberOrUndefined(stop.lat),
    lng: toNumberOrUndefined(stop.lng),
    photos: normalizePhotos(stop.photos),
    highlight: Boolean(stop.highlight),
    show_in_map_info: stop.show_in_map_info !== false,
  };
}

function normalizeDay(day = {}, dayIndex = 0) {
  const rawKey = day.key ?? dayIndex + 1;
  const key = typeof rawKey === "number" ? rawKey : Number.isFinite(Number(rawKey)) ? Number(rawKey) : rawKey;
  return {
    key,
    label: toString(day.label) || `Day ${dayIndex + 1}`,
    title: toString(day.title),
    theme: toString(day.theme),
    hero: toString(day.hero),
    stops: Array.isArray(day.stops) ? day.stops.map((stop, i) => normalizeStop(stop, i)) : [],
  };
}

function normalizeStayItem(item = {}) {
  return {
    area: toString(item.area),
    name: toString(item.name),
    note: toString(item.note),
    address: toString(item.address),
    map: toString(item.map),
    link: toString(item.link),
    lat: toNumberOrUndefined(item.lat),
    lng: toNumberOrUndefined(item.lng),
    photos: normalizePhotos(item.photos),
    show_in_map_info: item.show_in_map_info !== false,
  };
}

function normalizeShopItem(item = {}) {
  return {
    tag: toString(item.tag),
    name: toString(item.name),
    price: normalizePrice(item.price),
    price_options: Array.isArray(item.price_options) ? item.price_options : [],
    note: toString(item.note),
    address: toString(item.address),
    map: toString(item.map),
    link: toString(item.link),
    lat: toNumberOrUndefined(item.lat),
    lng: toNumberOrUndefined(item.lng),
    photos: normalizePhotos(item.photos),
    show_in_map_info: item.show_in_map_info !== false,
  };
}

export function normalizeTripData(data = {}) {
  const defaults = isObject(data.defaults) ? data.defaults : {};
  return {
    ...data,
    title: toString(data.title) || "旅遊計畫",
    subtitle: toString(data.subtitle),
    summary: toString(data.summary),
    coverImage: toString(data.coverImage),
    tags: Array.isArray(data.tags) ? data.tags.map((x) => toString(x)).filter(Boolean) : [],
    defaults: {
      currency: toString(defaults.currency) || "TWD",
      locale: toString(defaults.locale) || "zh-TW",
      price_unit: toString(defaults.price_unit) || "per_person",
    },
    dates: toString(data.dates),
    travelers: Number.isFinite(Number(data.travelers)) ? Number(data.travelers) : 0,
    budget_per_person: Number.isFinite(Number(data.budget_per_person)) ? Number(data.budget_per_person) : 0,
    nights: toString(data.nights),
    days: Array.isArray(data.days) ? data.days.map((day, i) => normalizeDay(day, i)) : [],
    reminders: Array.isArray(data.reminders)
      ? data.reminders
          .map((x) => {
            if (typeof x === "string") return x;
            if (isObject(x)) return { text: toString(x.text || x.title || x.name), type: toString(x.type) };
            return toString(x);
          })
          .filter((x) => (typeof x === "string" ? x.trim() : x.text))
      : [],
    budget_items: Array.isArray(data.budget_items) ? data.budget_items : [],
    stays: Array.isArray(data.stays) ? data.stays.map(normalizeStayItem) : [],
    shops: Array.isArray(data.shops) ? data.shops.map(normalizeShopItem) : [],
    references: Array.isArray(data.references) ? data.references.map((r, i) => ({
      title: toString(r?.title) || toString(r?.url) || `參考網站 ${i + 1}`,
      url: toString(r?.url),
      note: toString(r?.note),
      source: toString(r?.source) || "manual",
      type: toString(r?.type),
    })).filter((r) => r.title || r.url) : [],
  };
}

export function normalizeStayGroups(data) {
  const grouped = {};
  (data.stays || []).forEach((item) => {
    const normalized = normalizeStayItem(item);
    const key = normalized.area || "住宿";
    grouped[key] ||= { key, label: key, items: [] };
    grouped[key].items.push(normalized);
  });
  return Object.values(grouped);
}

export function normalizeShopGroups(data) {
  const grouped = {};
  (data.shops || []).forEach((item) => {
    const normalized = normalizeShopItem(item);
    const key = normalized.tag || "其他";
    grouped[key] ||= { key, label: key, items: [] };
    grouped[key].items.push(normalized);
  });
  return Object.values(grouped);
}
