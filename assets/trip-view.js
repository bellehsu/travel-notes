import { defaultDayLabel, makeScheduleRows, schedulePositionPercent, scheduleEventTypeClass, renderSchedulePanel as sharedRenderSchedulePanel, renderLeafletLocationsShared, priceLabel, durationLabel, formatTripMoney, renderMapFocus as sharedRenderMapFocus, mapCenterFromTripData, renderScheduleDetailModal, collectDayMapLocations, tagsForMapStop, visibleMapLocations as sharedVisibleMapLocations, isFavoriteMapLocation, renderMapPanelShell, renderMapListHtml, renderBudgetSummaryHtml, renderReminderDashboardHtml, renderTripShellHtml, bindMainTabControls, renderGoogleMapFrame, renderReferencesPanel as sharedRenderReferencesPanel } from "./trip-render.js";
import { escapeHtml as esc, nonEmpty, isGoogleShortUrl, parseLatLngFromText } from "./dom-helpers.js";
import { timeToMinutes, normalizeTripData, normalizeStayGroups, normalizeShopGroups } from "./trip-normalizers.js";
import { validateTripData } from "./trip-validators.js";

const state = {
  data: null,
  activeMain: "map",
  activeMapSub: "days",
  activeMapDayKey: null,
  activeMapId: "",
  activeMapTag: "__all__",
  activeDay: null,
  currentMapId: "",
  activeDetailId: "",
  activeTag: "__all__",
  mapMode: "single",
  mapDayKey: null,
  leafletMap: null,
  schedulePage: 0,
};

const SCHEDULE_START_MINUTE = 0;
const SCHEDULE_END_MINUTE = 24 * 60;
const SCHEDULE_TOTAL_MINUTES = SCHEDULE_END_MINUTE - SCHEDULE_START_MINUTE;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function formatCurrency(value, data = state.data) {
  return formatTripMoney(value, data);
}

function priceText(price) {
  return priceLabel(price, state.data);
}

function durationText(min) {
  return durationLabel(min);
}

function addressRaw(item) {
  if (typeof item?.address === "string") return item.address;
  return item?.address?.full || item?.address?.short || item?.short_address || "";
}

function searchLabelForItem(item) {
  return [item?.maps_label, item?.name, addressRaw(item)].filter(nonEmpty).join(" ").trim();
}

function mapUrl(item) {
  const latLng = latLngForItem(item);
  if (latLng) return `https://maps.google.com/?q=${latLng.lat},${latLng.lng}`;

  // Google short URLs cannot be expanded reliably in static GitHub Pages without a server.
  // If the JSON has no lat/lng, do not embed the short URL or a fuzzy place query;
  // Google often shows "unable to load place information". Use the global map center instead.
  if (isGoogleShortUrl(item?.map)) return fallbackMapUrl();

  if (nonEmpty(item?.map)) return item.map;
  const label = searchLabelForItem(item) || "台灣";
  return nonEmpty(label) ? `https://maps.google.com/?q=${encodeURIComponent(label)}` : "";
}

function fallbackMapEmbedUrl() {
  const center = typeof defaultMapCenter === "function" ? defaultMapCenter() : { lat: 22.3384, lng: 120.3710, zoom: 13 };
  // 單點模式沒有 map/lat/lng 時，用全域 map_center 顯示 Google marker。
  return `https://www.google.com/maps?q=${center.lat},${center.lng}&z=${center.zoom || 13}&output=embed`;
}

function fallbackMapUrl() {
  const center = defaultMapCenter();
  return `https://maps.google.com/?q=${center.lat},${center.lng}&z=${center.zoom || 13}`;
}


function cleanGooglePlaceQuery(loc) {
  const parts = [loc?.title, loc?.name, loc?.address]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  const seen = new Set();
  return parts.filter((part) => {
    const key = part.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(" ").trim();
}

function googleMapsOpenUrl(loc) {
  if (!loc?.isDefaultMap && nonEmpty(loc?.url)) return loc.url;
  const query = cleanGooglePlaceQuery(loc);
  return query ? `https://maps.google.com/?q=${encodeURIComponent(query)}` : "";
}

function googleSingleEmbedUrl(loc) {
  const center = defaultMapCenter();
  const latLng = loc?.latLng || null;
  const zoom = latLng ? 17 : (center.zoom || DEFAULT_MAP_ZOOM);
  const query = cleanGooglePlaceQuery(loc);

  if (latLng) return `https://www.google.com/maps?q=${latLng.lat},${latLng.lng}&z=${zoom}&output=embed`;
  if (query) return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`;
  return fallbackMapEmbedUrl();
}


const DEFAULT_MAP_ZOOM = 13;
const DEFAULT_MAP_CENTER = { lat: 22.3384, lng: 120.3710, zoom: DEFAULT_MAP_ZOOM };

const TILE_PROVIDER = {
  url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  options: {
    subdomains: "abcd",
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }
};

const mapResolveCache = new Map();

async function fetchTextWithProxy(url) {
  const attempts = [
    `https://r.jina.ai/${url}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`
  ];
  for (const target of attempts) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(target, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const text = await res.text();
        if (text) return text;
      }
    } catch {}
  }
  return "";
}

function extractLatLngFromHtml(text) {
  if (!nonEmpty(text)) return null;
  const patterns = [
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /\[(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)\]/
  ];
  for (const pattern of patterns) {
    const m = String(text).match(pattern);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}

async function resolveShortMapCoordsForItem(item) {
  if (!item || !isGoogleShortUrl(item.map)) return false;
  if (latLngForItem(item)) return false;
  if (mapResolveCache.has(item.map)) {
    const cached = mapResolveCache.get(item.map);
    if (cached?.latLng) { item.lat = cached.latLng.lat; item.lng = cached.latLng.lng; return true; }
    return false;
  }
  const html = await fetchTextWithProxy(item.map);
  const latLng = extractLatLngFromHtml(html);
  mapResolveCache.set(item.map, { latLng });
  if (latLng) {
    item.lat = latLng.lat;
    item.lng = latLng.lng;
    return true;
  }
  return false;
}

async function resolveShortMapsInData(data) {
  const items = [];
  (data.days || []).forEach((day) => (day.stops || []).forEach((stop) => items.push(stop)));
  (data.stays || []).forEach((item) => items.push(item));
  (data.shops || []).forEach((item) => items.push(item));
  (data.stay_groups || []).forEach((group) => (group.items || []).forEach((item) => items.push(item)));
  (data.shop_groups || []).forEach((group) => (group.items || []).forEach((item) => items.push(item)));

  let changed = false;
  for (const item of items) {
    if (await resolveShortMapCoordsForItem(item)) changed = true;
  }
  return changed;
}


function latLngForItem(item) {
  const lat = Number(item?.lat);
  const lng = Number(item?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return parseLatLngFromText(item?.map) || parseLatLngFromText(item?.url) || parseLatLngFromText(item?.address?.full || item?.address || "");
}

function defaultMapCenter() {
  return mapCenterFromTripData(state.data, DEFAULT_MAP_CENTER, {
    includeRootLatLng: true,
    defaultZoom: DEFAULT_MAP_ZOOM,
  });
}

function resetLeaflet() {
  if (state.leafletMap) {
    try { state.leafletMap.remove(); } catch {}
    state.leafletMap = null;
  }
}

function setMapCanvasMode(mode) {
  const canvas = document.getElementById("mapCanvas");
  if (canvas) canvas.dataset.mode = mode;
}

function renderLeafletLocations(locations, options = {}) {
  return renderLeafletLocationsShared(locations, options, {
    mapElementId: "leafletMap",
    frameElementId: "mapFrame",
    loadingText: "地圖載入中…",
    tileProvider: TILE_PROVIDER,
    getMap: () => state.leafletMap,
    setMap: (map) => { state.leafletMap = map; },
    defaultMapCenter,
    setCanvasMode: setMapCanvasMode,
    resetMap: resetLeaflet,
    onLoadError: () => renderGoogleIframe(""),
    popupIcon: true,
    centerPanSelected: true,
    onMarkerClick: (loc) => {
      state.activeMapId = loc.id;
      state.activeDetailId = loc.id;
      state.currentMapId = loc.id;
      const focus = document.getElementById("mapFocus");
      if (focus) focus.innerHTML = renderMapFocus(loc);
      $$(".outline-item,.favorite-item,.detail-card").forEach((el) => {
        const active = el.dataset.detailId === loc.id || el.dataset.mapid === loc.id || el.dataset.mapId === loc.id;
        el.classList.toggle("active-map", active);
        el.classList.toggle("active", active);
      });
    },
  });
}

function renderGoogleIframe(url) {
  renderGoogleMapFrame({
    frameId: "mapFrame",
    url,
    fallbackUrl: fallbackMapEmbedUrl(),
    setCanvasMode: setMapCanvasMode,
    resetMap: resetLeaflet,
  });
}

function updateMapDisplay(active, locations) {
  if (state.mapMode === "day") {
    const dayKey = state.mapDayKey ?? state.activeDay;
    const dayLocations = locations.filter((loc) => String(loc.dayKey) === String(dayKey) && loc.hasCoords);
    // Day route mode uses Leaflet only for stops with coordinates.
    if (dayLocations.length) {
      renderLeafletLocations(dayLocations, {
        polyline: true,
        keepOriginalOrder: true,
        routeMode: true,
        selectedId: active?.id,
        centerSelected: Boolean(active?.hasCoords),
      });
      return;
    }
  }

  // Single-location mode uses a clean Google Maps query instead of embedding short URLs directly.
  const loc = active?.hasMap ? active : {
    id: "global-map-center",
    name: state.data?.title || "地圖中心",
    title: state.data?.title || "地圖中心",
    type: "",
    tags: [],
    url: fallbackMapUrl(),
    latLng: null,
    hasCoords: false,
  };
  renderGoogleIframe(googleSingleEmbedUrl(loc));
}

function dayLabel(day, index) {
  return defaultDayLabel(day, index);
}

export function renderTripPage(rawData) {
  const data = normalizeTripData(rawData);
  const result = validateTripData(data);
  state.data = data;
  state.activeDay = data.days[0]?.key ?? null;
  state.currentMapId = "";

  if (!result.valid) return renderValidationError(result.errors);
  renderShell();
  bindMainTabs();
  renderActivePanel();

  // 參考 index.html：背景解析 maps.app.goo.gl 短網址。
  // 成功解析出 lat/lng 後，重新渲染目前地圖頁，Leaflet 全日路線就會自動帶出 marker。
  resolveShortMapsInData(data).then((changed) => {
    if (changed && state.activeMain === "map") renderActivePanel();
  });
}

function renderShell() {
  const app = document.getElementById("app");
  if (!app) return;
  const data = state.data;
  app.innerHTML = renderTripShellHtml({
    data,
    activeMain: state.activeMain,
    kicker: "Travel Plan",
    title: data.title,
    subtitle: data.subtitle || data.summary || "",
    tabs: [
      { key: "map", label: "地圖資訊" },
      { key: "schedule", label: "行程表" },
      { key: "reminders", label: "行前提醒" },
      { key: "references", label: "參考網站" },
    ],
    meta: [
      { label: "日期", value: data.dates || "-" },
      { label: "人數", value: data.travelers ? `${data.travelers} 人` : "-" },
      { label: "預算", value: data.budget_per_person ? `${formatCurrency(data.budget_per_person)} / 人` : "-" },
      { label: "住宿", value: data.nights || "-" },
    ],
  });
}

function bindMainTabs() {
  bindMainTabControls({
    onChange: (key) => {
      state.activeMain = key;
      renderActivePanel();
    },
  });
}

function renderActivePanel() {
  if (state.activeMain === "map") return renderMapPanel();
  if (state.activeMain === "schedule") return renderSchedulePanel();
  if (state.activeMain === "reminders") return renderRemindersPanel();
  return renderReferencesPanel();
}

function addressText(item) {
  if (typeof item?.address === "string") return item.address;
  return item?.address?.full || item?.address?.short || item?.short_address || "";
}

function timeText(stop) {
  return stop.start_time || stop.time || "";
}

function stopEndTime(stop) {
  const start = timeToMinutes(timeText(stop));
  if (start === null || typeof stop.duration_min !== "number" || stop.duration_min <= 0) return "";
  const end = start + stop.duration_min;
  const hh = String(Math.floor(end / 60) % 24).padStart(2, "0");
  const mm = String(end % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function timeRangeText(stop) {
  const start = timeText(stop);
  const end = stopEndTime(stop);
  return start && end ? `${start}–${end}` : start;
}

function normalizeTagName(tag) {
  const text = String(tag ?? "").trim();
  if (text === "美食") return "餐飲";
  return text;
}

function collectLocations() {
  const data = state.data;
  const locations = collectDayMapLocations(data.days || [], {
    idForStop: (day, _dayIndex, _stop, stopIndex) => `day-${String(day.key).replace(/[^a-zA-Z0-9_-]/g, "_")}-${stopIndex + 1}`,
    dayLabel,
    dayTitle: (day) => day.title || day.theme || "",
    nameForStop: (stop) => stop.name || stop.maps_label || "未命名行程",
    titleForStop: (stop) => stop.maps_label || stop.name,
    typeForStop: (stop) => normalizeTagName(stop.type || ""),
    timeRangeForStop: timeRangeText,
    durationForStop: (stop) => durationText(stop.duration_min),
    priceForStop: (stop) => priceText(stop.price),
    addressForStop: addressText,
    urlForStop: (stop) => {
      const latLng = latLngForItem(stop);
      const hasRawMap = nonEmpty(stop.map);
      const address = addressText(stop);
      if (!latLng && !hasRawMap && !address) return "";
      return latLng || (hasRawMap && !isGoogleShortUrl(stop.map)) ? mapUrl(stop) : fallbackMapUrl();
    },
    latLngForStop: latLngForItem,
    hasMapForStop: (stop, latLng, address) => Boolean(latLng || stop.map || address),
    tagsForStop: (stop) => tagsForMapStop(stop, normalizeTagName),
    extraForStop: (stop) => ({
      group: "每日行程",
      time: timeText(stop),
      transit: durationText(stop.transit_to_next_min),
      next: stop.next || "",
      note: stop.note || "",
      highlight: Boolean(stop.highlight),
    }),
  });

  // Stays and shops are supplemental sources for saved map places.
  normalizeStayGroups(data).forEach((group, gi) => group.items.forEach((item, ii) => {
    const latLng = latLngForItem(item);
    const hasRawMap = nonEmpty(item.map);
    const usesDefaultMap = !latLng && (!hasRawMap || isGoogleShortUrl(item.map));
    const explicitMap = !usesDefaultMap;
    if (!explicitMap || item.show_in_map_info === false) return;
    const url = mapUrl(item);
    const tag = normalizeTagName(item.area || group.label || "住宿");
    locations.push({
      id: `stay-${gi + 1}-${ii + 1}`,
      source: "stay",
      group: "住宿",
      label: group.label,
      title: item.name,
      name: item.name,
      type: "住宿",
      tags: ["住宿", tag].filter(Boolean),
      subtitle: [group.label, item.note].filter(Boolean).join("｜"),
      address: item.address || item.area || "",
      note: item.note || "",
      url,
      latLng,
      hasCoords: Boolean(latLng),
      hasMap: true,
      isDefaultMap: false,
    });
  }));

  normalizeShopGroups(data).forEach((group, gi) => group.items.forEach((item, ii) => {
    const latLng = latLngForItem(item);
    const hasRawMap = nonEmpty(item.map);
    const usesDefaultMap = !latLng && (!hasRawMap || isGoogleShortUrl(item.map));
    const explicitMap = !usesDefaultMap;
    if (!explicitMap || item.show_in_map_info === false) return;
    const url = mapUrl(item);
    const primaryTag = normalizeTagName(item.type || item.tag || group.label || "資訊");
    const tags = [primaryTag, normalizeTagName(group.label)].filter(Boolean);
    locations.push({
      id: `shop-${gi + 1}-${ii + 1}`,
      source: "shop",
      group: "資訊",
      label: group.label,
      title: item.name,
      name: item.name,
      type: primaryTag,
      tags: [...new Set(tags)],
      subtitle: [primaryTag, priceText(item.price), item.note].filter(Boolean).join("｜"),
      address: item.address || "",
      note: item.note || "",
      price: priceText(item.price),
      url,
      latLng,
      hasCoords: Boolean(latLng),
      hasMap: true,
      isDefaultMap: false,
    });
  }));
  return locations;
}

function collectMapLocations() {
  return collectLocations();
}

function visibleMapLocations(locations) {
  return sharedVisibleMapLocations(locations, {
    activeSub: state.activeMapSub,
    activeDayKey: state.activeMapDayKey,
    activeTag: state.activeMapTag,
    favoritePredicate: isFavoriteLocation,
  });
}

function isFavoriteLocation(loc) {
  return isFavoriteMapLocation(loc);
}

function renderMapPanel() {
  const days = state.data.days || [];
  if (!state.activeMapDayKey && days[0]) state.activeMapDayKey = days[0].key;
  if (!state.activeDay && state.activeMapDayKey) state.activeDay = state.activeMapDayKey;
  const locations = collectMapLocations();
  const visible = visibleMapLocations(locations);
  const first = visible.find((loc) => loc.hasMap) || visible[0] || locations.find((loc) => loc.hasMap) || locations[0];
  if (!state.activeMapId || !locations.some((loc) => loc.id === state.activeMapId)) state.activeMapId = first ? first.id : "";
  const active = locations.find((loc) => loc.id === state.activeMapId) || first;

  state.currentMapId = active?.hasMap ? active.id : "";
  state.activeDetailId = active?.id || "";

  $("#panel").innerHTML = renderMapPanelShell({
    activeSub: state.activeMapSub,
    frameSrc: fallbackMapEmbedUrl(),
    focusHtml: active ? renderMapFocus(active) : `<span class="muted">尚未選擇地點</span>`,
    listHtml: renderMapList(locations, days),
    subAttr: "data-sub",
  });

  $$(".sub-tab").forEach((button) => button.addEventListener("click", () => { state.activeMapSub = button.dataset.sub; state.activeMapTag = "__all__"; state.activeTag = "__all__"; state.activeMapId = ""; state.activeDetailId = ""; state.mapMode = "single"; state.mapDayKey = null; renderMapPanel(); }));
  bindMapListEvents(locations);
  updateMapDisplay(active, locations);
}

function renderMapFocus(loc) {
  return sharedRenderMapFocus(loc, {
    activeId: state.activeDetailId,
    googleMapsUrl: googleMapsOpenUrl(loc),
  });
}

function renderMapList(locations, days) {
  return renderMapListHtml(locations, {
    activeSub: state.activeMapSub,
    activeDayKey: state.activeMapDayKey,
    activeTag: state.activeMapTag,
    activeId: state.activeMapId,
    mapMode: state.mapMode,
    mapDayKey: state.mapDayKey,
    days,
    dayLabel,
    dayTitle: (day, index) => day.title || day.theme || dayLabel(day, index),
    dayTabAttr: "data-day-key",
    dayRouteAttr: "data-map-day",
    tagAttr: "data-tag",
    detailAttr: "data-detail-id",
    mapIdAttr: "data-mapid",
    favoritePredicate: isFavoriteLocation,
    typeClass: (type) => eventTypeClass({ type }),
  });
}

function bindMapListEvents(locations) {
  const mapSide = $(".map-side");
  const sheetToggle = $("[data-map-sheet-toggle]");
  if (mapSide && sheetToggle) {
    sheetToggle.addEventListener("click", () => {
      const collapsed = mapSide.classList.toggle("is-collapsed");
      sheetToggle.setAttribute("aria-expanded", String(!collapsed));
      sheetToggle.setAttribute("aria-label", collapsed ? "展開地圖資訊" : "收合地圖資訊");
    });
  }
  $$('[data-day-key]').forEach((el) => el.addEventListener('click', () => {
    state.activeMapDayKey = el.dataset.dayKey;
    state.activeDay = Number.isNaN(Number(el.dataset.dayKey)) ? el.dataset.dayKey : Number(el.dataset.dayKey);
    state.activeMapId = "";
    state.activeDetailId = "";
    state.mapMode = "single";
    state.mapDayKey = null;
    renderMapPanel();
  }));
  $$('[data-tag]').forEach((el) => el.addEventListener('click', () => {
    state.activeMapTag = el.dataset.tag;
    state.activeTag = el.dataset.tag;
    state.activeMapId = "";
    state.activeDetailId = "";
    renderMapPanel();
  }));
  $$('[data-detail-id]').forEach((el) => el.addEventListener('click', () => {
    const loc = locations.find((x) => x.id === el.dataset.detailId);
    const routeMode = state.mapMode === "day" && loc && String(state.mapDayKey ?? state.activeMapDayKey) === String(loc.dayKey);
    if (routeMode && !loc?.hasCoords) return;
    state.activeMapId = el.dataset.detailId;
    state.activeDetailId = el.dataset.detailId;
    focusLocation(el.dataset.detailId, locations);
    if (state.activeMapSub === "days") {
      const box = $("#mapList");
      if (box) {
        box.innerHTML = renderMapList(locations, state.data.days || []);
        bindMapListEvents(locations);
      }
    }
  }));
  $$('[data-mapid]:not([data-detail-id])').forEach((el) => el.addEventListener('click', () => {
    focusMap(el.dataset.mapid, locations);
  }));
  $$('[data-map-day]').forEach((el) => el.addEventListener('click', () => {
    const dayKey = el.dataset.mapDay;
    const already = state.mapMode === "day" && String(state.mapDayKey) === String(dayKey);
    state.mapMode = already ? "single" : "day";
    state.mapDayKey = already ? null : dayKey;
    const firstOfDay = locations.find((loc) => String(loc.dayKey) === String(dayKey));
    const firstMappableOfDay = locations.find((loc) => String(loc.dayKey) === String(dayKey) && loc.hasCoords);
    if (firstOfDay) {
      const target = already ? firstOfDay : (firstMappableOfDay || firstOfDay);
      state.currentMapId = target.hasCoords ? target.id : "";
      state.activeMapId = target.id;
      state.activeDetailId = target.id;
    }
    renderMapPanel();
  }));
}

function focusLocation(id, locations) {
  const loc = locations.find((x) => x.id === id);
  if (!loc) return;

  const frame = $("#mapFrame");
  const focus = $("#mapFocus");

  const keepDayRoute = state.mapMode === "day" && String(state.mapDayKey ?? state.activeDay) === String(loc.dayKey);
  // Day route mode only focuses stops with coordinates.
  if (keepDayRoute && !loc.hasCoords) return;
  if (!loc.hasMap) return;
  state.activeMapId = id;
  state.activeDetailId = id;
  if (!keepDayRoute) {
    state.mapMode = "single";
    state.mapDayKey = null;
  }
  if (keepDayRoute) state.currentMapId = loc.hasCoords ? id : "";
  else state.currentMapId = loc.hasMap ? id : "";

  updateMapDisplay(loc, locations);
  if (focus) focus.innerHTML = renderMapFocus(loc);
  $$(".location,.outline-item,.place-card,.favorite-item,.detail-card").forEach((el) => {
    const active = el.dataset.detailId === id || (loc.hasMap && el.dataset.mapid === id);
    el.classList.toggle("active-map", active);
    el.classList.toggle("active", active);
  });
}

function focusMap(id, locations) {
  focusLocation(id, locations);
}

function scheduleRows() {
  return makeScheduleRows({ startMinute: SCHEDULE_START_MINUTE, endMinute: SCHEDULE_END_MINUTE, formatMinute: formatClockFromMinute });
}

function schedulePosition(minute) {
  return schedulePositionPercent(minute, { startMinute: SCHEDULE_START_MINUTE, totalMinutes: SCHEDULE_TOTAL_MINUTES });
}

function scheduleWindowDays(days) {
  const pageSize = window.matchMedia("(max-width: 700px)").matches ? 1 : 5;
  const totalPages = Math.max(1, Math.ceil(days.length / pageSize));
  state.schedulePage = Math.max(0, Math.min(state.schedulePage || 0, totalPages - 1));
  const start = state.schedulePage * pageSize;
  return { pageSize, totalPages, start, days: days.slice(start, start + pageSize) };
}

function eventTypeClass(type) {
  return scheduleEventTypeClass(normalizeTagName(type?.type || ""));
}

function buildScheduleEvents(day, dayIndex) {
  const raw = (day.stops || []).map((stop, stopIndex) => {
    const startMinute = timeToMinutes(stop.start_time || stop.time);
    if (startMinute === null) return null;
    const duration = typeof stop.duration_min === "number" && stop.duration_min > 0 ? stop.duration_min : 30;
    const endMinute = startMinute + duration;
    if (endMinute <= SCHEDULE_START_MINUTE || startMinute >= SCHEDULE_END_MINUTE) return null;
    return {
      dayIndex,
      stopIndex,
      stop,
      startMinute: Math.max(startMinute, SCHEDULE_START_MINUTE),
      endMinute: Math.min(endMinute, SCHEDULE_END_MINUTE),
      originalStart: startMinute,
      originalEnd: endMinute,
      lane: 0,
      laneCount: 1,
    };
  }).filter(Boolean).sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute);

  const clusters = [];
  for (const ev of raw) {
    let cluster = clusters.find((c) => ev.startMinute < c.end && ev.endMinute > c.start);
    if (!cluster) {
      cluster = { events: [], start: ev.startMinute, end: ev.endMinute };
      clusters.push(cluster);
    }
    cluster.events.push(ev);
    cluster.start = Math.min(cluster.start, ev.startMinute);
    cluster.end = Math.max(cluster.end, ev.endMinute);
  }

  clusters.forEach((cluster) => {
    const lanes = [];
    cluster.events.forEach((ev) => {
      let lane = lanes.findIndex((laneEnd) => laneEnd <= ev.startMinute);
      if (lane === -1) {
        lane = lanes.length;
        lanes.push(ev.endMinute);
      } else {
        lanes[lane] = ev.endMinute;
      }
      ev.lane = lane;
      ev.laneCount = lanes.length;
    });
    cluster.events.forEach((ev) => { ev.laneCount = lanes.length; });
  });

  return raw.map((ev) => {
    const top = schedulePosition(ev.startMinute);
    const height = Math.max(2.8, ((ev.endMinute - ev.startMinute) / SCHEDULE_TOTAL_MINUTES) * 100);
    const laneGap = 1.5;
    const width = 100 / ev.laneCount;
    const left = ev.lane * width;
    const typeClass = eventTypeClass(ev.stop);
    return { ...ev, top, height, left, width: Math.max(12, width), laneGap, typeClass };
  });
}

function formatClockFromMinute(minute) {
  if (!Number.isFinite(minute)) return "";
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function renderSchedulePanel() {
  const allDays = state.data.days || [];
  const rows = scheduleRows();
  const windowData = scheduleWindowDays(allDays);
  const visibleDays = windowData.days;
  const activeDay = visibleDays[0];
  const toolbarLabel = windowData.pageSize === 1 && activeDay
    ? (activeDay.title || activeDay.theme || dayLabel(activeDay, windowData.start))
    : `${state.schedulePage + 1} / ${windowData.totalPages}`;
  const toolbarHtml = windowData.totalPages > 1 ? `<div class="calendar-toolbar calendar-toolbar-compact"><div class="calendar-nav"><button type="button" data-schedule-prev ${state.schedulePage <= 0 ? "disabled" : ""} aria-label="上一天">‹</button><span>${esc(toolbarLabel)}</span><button type="button" data-schedule-next ${state.schedulePage >= windowData.totalPages - 1 ? "disabled" : ""} aria-label="下一天">›</button></div></div>` : "";

  $("#panel").innerHTML = `
    ${sharedRenderSchedulePanel({
      days: visibleDays,
      rows,
      startMinute: SCHEDULE_START_MINUTE,
      totalMinutes: SCHEDULE_TOTAL_MINUTES,
      toolbarHtml,
      modalHostHtml: '<div id="scheduleModalHost"></div>',
      dayOffset: windowData.start,
      dayLabel,
      dayColAttrs: (_day, index) => `data-calendar-day="${index}"`,
      getEvents: buildScheduleEvents,
      eventAttrs: (ev) => {
        const label = ev.stop.name || ev.stop.maps_label || "行程";
        return `data-schedule-day="${ev.dayIndex}" data-schedule-stop="${ev.stopIndex}" aria-label="查看 ${esc(label)} 詳細內容"`;
      },
      eventLabel: (ev) => ev.stop.name || ev.stop.maps_label || "未命名行程",
      eventTime: (ev) => `${formatClockFromMinute(ev.originalStart)}–${formatClockFromMinute(ev.originalEnd)}`,
      positionPercent: schedulePosition,
    })}
  `;

  $('[data-schedule-prev]')?.addEventListener('click', () => { state.schedulePage = Math.max(0, (state.schedulePage || 0) - 1); renderSchedulePanel(); });
  $('[data-schedule-next]')?.addEventListener('click', () => { state.schedulePage = Math.min(windowData.totalPages - 1, (state.schedulePage || 0) + 1); renderSchedulePanel(); });

  $$(".calendar-event").forEach((cell) => {
    const open = () => {
      const dayIndex = Number(cell.dataset.scheduleDay);
      const stopIndex = Number(cell.dataset.scheduleStop);
      openScheduleModal(allDays[dayIndex], allDays[dayIndex]?.stops?.[stopIndex], dayIndex, stopIndex);
    };
    cell.addEventListener("click", open);
    cell.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function stopPriceText(stop) {
  return priceLabel(stop?.price, state.data) || stop?.cost || "";
}

function openScheduleModal(day, stop, dayIndex = 0, stopIndex = 0) {
  if (!day || !stop) return;
  const host = document.getElementById("scheduleModalHost") || document.body;
  const start = stop.start_time || stop.time || "";
  const end = stopEndTime(stop);
  const range = start && end ? `${start}–${end}` : start;
  const price = stopPriceText(stop);
  const address = addressText(stop);
  const map = mapUrl(stop);
  const title = stop.name || stop.maps_label || "未命名行程";
  const hasGoogleMap = nonEmpty(stop.map) || Boolean(latLngForItem(stop));

  host.innerHTML = renderScheduleDetailModal({
    title,
    subtitle: `${dayLabel(day, dayIndex)}${day.title ? `｜${day.title}` : ""}`,
    timeRange: range,
    duration: typeof stop.duration_min === "number" ? durationText(stop.duration_min) : "",
    price,
    address,
    note: stop.note || "",
    next: stop.next || "",
    googleMapsUrl: hasGoogleMap ? map : "",
  });

  const modal = host.querySelector(".schedule-modal");
  const close = () => { host.innerHTML = ""; document.removeEventListener("keydown", onKeyDown); };
  const onKeyDown = (event) => { if (event.key === "Escape") close(); };
  modal.querySelector(".schedule-modal-backdrop")?.addEventListener("click", close);
  modal.querySelector(".schedule-modal-close")?.addEventListener("click", close);
  document.addEventListener("keydown", onKeyDown);
  modal.querySelector(".schedule-modal-close")?.focus();
}

function detailAmount(detail) {
  if (typeof detail?.amount === "number") return detail.amount;
  const p = detail?.price;
  if (typeof p === "number") return p;
  if (typeof p === "string") return Number(String(p).replace(/[^0-9.-]/g, "")) || 0;
  if (p && typeof p === "object") return Number(p.min ?? p.amount ?? 0) || 0;
  return 0;
}

function detailPriceText(detail) {
  if (detail?.price !== undefined) return priceText(detail.price);
  if (typeof detail?.amount === "number") return formatCurrency(detail.amount);
  return "";
}

function renderBudgetSummary(items) {
  return renderBudgetSummaryHtml(items, {
    activeCategory: state.activeBudgetCategory,
    formatCurrency,
    detailAmount,
    detailValue: (detail) => detailPriceText(detail) || formatCurrency(detailAmount(detail)),
    emptyText: "沒有細項",
  });
}

function renderRemindersPanel() {
  const reminders = state.data.reminders || [];
  const budgetItems = state.data.budget_items || [];
  if (!state.activeBudgetCategory) state.activeBudgetCategory = "__total__";
  $("#panel").innerHTML = renderReminderDashboardHtml({
    reminders,
    budgetHtml: renderBudgetSummary(budgetItems),
  });
  $$('[data-budget-tag]').forEach((btn) => btn.addEventListener('click', () => {
    state.activeBudgetCategory = btn.dataset.budgetTag;
    renderRemindersPanel();
  }));
}

function renderReferencesPanel() {
  const refs = state.data.references || [];
  const shopRefs = (state.data.shops || []).filter((s) => s.link).map((s) => ({ title: s.name, url: s.link, source: normalizeTagName(s.tag || "資訊") }));
  const all = [...refs, ...shopRefs];
  $("#panel").innerHTML = sharedRenderReferencesPanel(all, {
    showCount: true,
    typeClass: (type) => eventTypeClass({ type: normalizeTagName(type) }),
  });
}

function renderValidationError(errors) {
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = `<main class="wrap"><section class="validation-error"><h1>JSON 格式驗證失敗</h1><p>請先修正以下欄位：</p><pre>${esc(errors.join("\n"))}</pre></section></main>`;
}
