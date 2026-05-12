import { defaultDayLabel, makeScheduleRows, schedulePositionPercent, scheduleEventTypeClass, renderSchedulePanel as sharedRenderSchedulePanel, renderLeafletLocationsShared, priceLabel, durationLabel, renderDetailCard as sharedRenderDetailCard, renderMapFocus as sharedRenderMapFocus, collectDayMapLocations, tagsForMapStop, visibleMapLocations as sharedVisibleMapLocations, isFavoriteMapLocation, renderMapPanelShell, renderMapListHtml, renderReminderListHtml, renderReferencesPanel as sharedRenderReferencesPanel } from "./trip-render.js";
import { escapeHtml as esc, mapEmbedUrl, mapOpenUrl } from "./dom-helpers.js";
import { formatMoney } from "./formatters.js";
import { timeToMinutes } from "./trip-normalizers.js";
const STORAGE_KEY = "foodnetravel.tripPlan.v2";
const LEGACY_STORAGE_KEY = "foodnetravel.tripPlan.v1";
const DAY_START = 0;
const DAY_END = 24 * 60;
const SCHEDULE_TOTAL_MINUTES = DAY_END - DAY_START;
const STEP = 15;
const BUDGET_CATEGORIES = [
  { key: "transport", label: "交通" },
  { key: "stay", label: "住宿" },
  { key: "food", label: "餐飲" },
  { key: "activity", label: "活動" },
  { key: "other", label: "其他" },
];
const CURRENCY_OPTIONS = ["TWD", "JPY", "USD", "KRW", "EUR", "CNY", "HKD", "SGD", "THB"];
const CATEGORY_OPTIONS = ["交通", "住宿", "餐飲", "活動", "其他"];
const DEFAULT_MAP_ZOOM = 13;
const DEFAULT_MAP_CENTER = { lat: 23.6978, lng: 120.9605, zoom: DEFAULT_MAP_ZOOM };
const TILE_PROVIDER = {
  url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  options: {
    subdomains: "abcd",
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

const state = {
  data: null,
  activeMain: "schedule",
  activeDayKey: null,
  activeMapSub: "days",
  activeMapDayKey: null,
  activeMapTag: "__all__",
  activeMapId: "",
  mapMode: "single",
  mapDayKey: null,
  leafletMap: null,
  activeBudgetCategory: "__total__",
  selection: null,
  dragging: null,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function renderCategorySelect(name, value, fallback = "其他") {
  const selected = CATEGORY_OPTIONS.includes(value) ? value : fallback;
  return `<select name="${esc(name)}">${CATEGORY_OPTIONS.map((option) => `<option value="${esc(option)}" ${option === selected ? "selected" : ""}>${esc(option)}</option>`).join("")}</select>`;
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundToStep(minute) {
  return clamp(Math.round(minute / STEP) * STEP, DAY_START, DAY_END);
}

function minuteToTime(minute) {
  const normalized = clamp(minute, 0, 24 * 60 - 1);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function stopEndMinute(stop) {
  return timeToMinutes(stop.start_time) + Math.max(15, Number(stop.duration_min || 60));
}

function eventRange(stop) {
  return `${stop.start_time || "09:00"} - ${minuteToTime(stopEndMinute(stop))}`;
}

function durationText(min) {
  return durationLabel(min);
}

function priceText(price) {
  return priceLabel(price, state.data);
}

function createStop(values) {
  return Object.assign({
    id: uid("stop"),
    name: "",
    type: "活動",
    start_time: "09:00",
    duration_min: 60,
    address: "",
    map: "",
    note: "",
    price: { min: "" },
    highlight: false,
  }, values || {});
}

function seedData() {
  return {
    title: "行程規劃",
    subtitle: "拖曳時程、整理提醒與參考資料",
    summary: "",
    coverImage: "",
    defaults: {
      currency: "TWD",
      locale: "zh-TW",
      price_unit: "per_person",
    },
    dates: "未設定",
    travelers: "",
    budget_per_person: "",
    nights: "",
    tags: ["Trip Planner", "Local Draft"],
    days: [
    ],
    reminders: [
    ],
    budget_items: defaultBudgetItems(),
    references: [
    ],
    shops: [],
  };
}

function normalizeImportedData(raw) {
  const base = seedData();
  const data = Array.isArray(raw) ? Object.assign(base, { days: raw }) : Object.assign(base, raw || {});
  data.days = Array.isArray(data.days) ? data.days : [];
  data.reminders = Array.isArray(data.reminders) ? data.reminders : [];
  data.budget_items = Array.isArray(data.budget_items) ? data.budget_items : [];
  data.references = Array.isArray(data.references) ? data.references : [];
  data.shops = Array.isArray(data.shops) ? data.shops : [];
  data.defaults = Object.assign({ currency: "TWD", locale: "zh-TW", price_unit: "per_person" }, data.defaults || {});
  if (!CURRENCY_OPTIONS.includes(data.defaults.currency)) data.defaults.currency = "TWD";
  data.days.forEach((day, index) => {
    day.key = day.key || `day-${index + 1}`;
    const defaultLabel = `Day ${index + 1}`;
    day.label = day.label || (/^Day\s+\d+$/i.test(String(day.title || "").trim()) ? day.title : defaultLabel);
    if (/^Day\s+\d+$/i.test(String(day.title || "").trim())) day.title = "";
    day.stops = Array.isArray(day.stops) ? day.stops.map((stop) => createStop(stop)) : [];
  });
  data.reminders = data.reminders.map((item) => typeof item === "string" ? { id: uid("reminder"), text: item } : Object.assign({ id: uid("reminder"), text: "" }, item));
  data.budget_items = normalizeBudgetItems(data.budget_items);
  data.references = data.references.map((item) => Object.assign({ id: uid("reference"), title: "", url: "", type: "" }, item));
  data.shops = data.shops.map((item) => normalizeShopItem(item));
  return data;
}

function normalizeShopItem(item) {
  return Object.assign({
    id: uid("shop"),
    tag: "其他",
    name: "",
    address: "",
    map: "",
    url: "",
    note: "",
    lat: "",
    lng: "",
  }, item || {});
}

function defaultBudgetItems() {
  return BUDGET_CATEGORIES.map((category) => ({
    id: uid("budget"),
    key: category.key,
    label: category.label,
    value: 0,
    details: [],
  }));
}

function normalizeBudgetItems(items) {
  const source = Array.isArray(items) ? items : [];
  return BUDGET_CATEGORIES.map((category) => {
    const matched = source.find((item) => item.key === category.key || item.label === category.label) || {};
    const details = Array.isArray(matched.details) ? matched.details : [];
    const normalizedDetails = details.map((detail) => ({
      id: detail.id || uid("budget-detail"),
      name: detail.name || "",
      amount: Number(detail.amount != null ? detail.amount : detail.value != null ? detail.value : detail.price && detail.price.min != null ? detail.price.min : 0) || 0,
      note: detail.note || "",
    }));
    const detailTotal = normalizedDetails.reduce((sum, detail) => sum + Number(detail.amount || 0), 0);
    return {
      id: matched.id || uid("budget"),
      key: category.key,
      label: category.label,
      value: detailTotal || Number(matched.value || 0) || 0,
      details: normalizedDetails,
    };
  });
}

function syncBudgetValue(item) {
  item.value = (item.details || []).reduce((sum, detail) => sum + Number(detail.amount || 0), 0);
}

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved) return normalizeImportedData(saved);
  } catch {}
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "null");
    if (Array.isArray(legacy) && legacy.length) return normalizeImportedData({ days: legacy });
  } catch {}
  return seedData();
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function renumberDays() {
  state.data.days.forEach((day, index) => {
    day.key = `day-${index + 1}`;
    day.label = `Day ${index + 1}`;
    if (/^Day\s+\d+$/i.test(String(day.title || "").trim())) day.title = "";
    day.order = index + 1;
  });
}

function exportPayload() {
  const data = JSON.parse(JSON.stringify(state.data));
  data.days = (data.days || []).map((day, index) => {
    const exportedDay = Object.assign({}, day, {
      key: index + 1,
      title: day.title || day.theme || `Day ${index + 1}`,
      order: index + 1,
    });
    if (!exportedDay.label || exportedDay.label === `Day ${index + 1}`) delete exportedDay.label;
    return exportedDay;
  });
  data.budget_items = normalizeBudgetItems(data.budget_items);
  return data;
}

function exportJsonText() {
  return JSON.stringify(exportPayload(), null, 2);
}

function dayLabel(day, index) {
  return defaultDayLabel(day, index);
}

function dayTitle(day, index) {
  return day.title || day.theme || dayLabel(day, index);
}

function mapDayTabLabel(day, index) {
  return dayLabel(day, index);
}

function leafletReady() {
  return typeof window !== "undefined" && window.L && typeof window.L.map === "function";
}

let leafletLoadPromise = null;

function ensureLeafletLoaded() {
  if (leafletReady()) return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;
  leafletLoadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector("link[data-trip-leaflet-css]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.dataset.tripLeafletCss = "1";
      document.head.appendChild(link);
    }
    const existing = document.querySelector("script[data-trip-leaflet-js]");
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.defer = true;
    script.dataset.tripLeafletJs = "1";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Leaflet 載入失敗"));
    document.head.appendChild(script);
  });
  return leafletLoadPromise;
}

function resetLeaflet() {
  if (!state.leafletMap) return;
  try { state.leafletMap.remove(); } catch {}
  state.leafletMap = null;
}

function setMapCanvasMode(mode) {
  const canvas = $("#planMapCanvas");
  if (canvas) canvas.dataset.mode = mode;
}

function defaultMapCenter() {
  const center = state.data?.defaults?.map_center;
  const lat = Number(center?.lat);
  const lng = Number(center?.lng);
  const zoom = Number(state.data?.defaults?.map_zoom || state.data?.defaults?.zoom || DEFAULT_MAP_ZOOM);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, zoom: Number.isFinite(zoom) ? zoom : DEFAULT_MAP_ZOOM };
  return DEFAULT_MAP_CENTER;
}

function numberedIcon(number, extraClass = "") {
  if (!leafletReady()) return undefined;
  return L.divIcon({
    className: "trip-div-icon",
    html: `<div class="num-marker ${extraClass}"><span>${esc(number)}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30],
  });
}

function headerBudgetText() {
  const value = state.data.budget_per_person;
  return value ? `${formatCurrency(value)} / 人` : "-";
}

function travelersText() {
  const value = state.data.travelers;
  return value ? `${esc(value)} 人` : "-";
}

function scheduleRows() {
  return makeScheduleRows({ startMinute: DAY_START, endMinute: DAY_END, formatMinute: minuteToTime });
}

function schedulePosition(minute) {
  return schedulePositionPercent(minute, { startMinute: DAY_START, totalMinutes: SCHEDULE_TOTAL_MINUTES });
}

function eventTypeClass(type) {
  return scheduleEventTypeClass(type);
}

function buildEvents(day, dayIndex) {
  return (day.stops || []).map((stop, stopIndex) => {
    const start = clamp(timeToMinutes(stop.start_time), DAY_START, DAY_END - 15);
    const end = clamp(stopEndMinute(stop), start + 15, DAY_END);
    return {
      dayIndex,
      stopIndex,
      stop,
      top: schedulePosition(start),
      height: Math.max(2.8, ((end - start) / SCHEDULE_TOTAL_MINUTES) * 100),
      typeClass: eventTypeClass(stop.type || ""),
    };
  }).sort((a, b) => timeToMinutes(a.stop.start_time) - timeToMinutes(b.stop.start_time));
}

function render() {
  const app = $("#app");
  app.innerHTML = `
    <div class="mobile-topbar">
      <button class="mobile-menu-btn" type="button" aria-label="切換選單">☰</button>
      <strong>${esc(state.data.title)}</strong>
    </div>
    <main class="wrap">
      <section class="hero">
        <div>
          <div class="kicker">Trip Planner</div>
          <h1 id="title">${esc(state.data.title)}</h1>
          <p id="subtitle">${esc(state.data.subtitle || "規劃時程、提醒、參考網站與地圖資訊。")}</p>
          <div class="tags" id="tags">${(state.data.tags || []).map((tag) => `<span class="badge">${esc(tag)}</span>`).join("")}</div>
          <div class="trip-plan-hero-actions">
            <button class="btn secondary" type="button" data-edit-hero>修改資訊</button>
            <button class="btn secondary" type="button" data-import-json>Import JSON</button>
            <button class="btn secondary" type="button" data-export-json>Export JSON</button>
          </div>
        </div>
        <div class="meta">
          <div class="box"><span>日期</span><strong>${esc(state.data.dates || "-")}</strong></div>
          <div class="box"><span>人數</span><strong>${travelersText()}</strong></div>
          <div class="box"><span>預算</span><strong>${headerBudgetText()}</strong></div>
          <div class="box"><span>住宿</span><strong>${esc(state.data.nights || `${state.data.days.length} Days`)}</strong></div>
        </div>
      </section>

      <nav class="main-tabs" id="mainTabs" aria-label="行程規劃分頁">
        <button class="main-tab ${state.activeMain === "schedule" ? "active" : ""}" data-main="schedule">行程表</button>
        <button class="main-tab ${state.activeMain === "reminders" ? "active" : ""}" data-main="reminders">行前提醒</button>
        <button class="main-tab ${state.activeMain === "references" ? "active" : ""}" data-main="references">參考網站</button>
        <button class="main-tab ${state.activeMain === "map" ? "active" : ""}" data-main="map">地圖資訊</button>
      </nav>

      <section class="panel" id="panel"></section>
      <div id="planModalHost"></div>
      <input class="trip-plan-file" type="file" accept="application/json,.json" data-import-input>
    </main>
  `;
  bindShell();
  renderActivePanel();
}

function bindShell() {
  $$(".main-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeMain = button.dataset.main;
      render();
      if (window.matchMedia("(max-width: 700px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  const menuButton = $(".mobile-menu-btn");
  if (menuButton) menuButton.addEventListener("click", () => $("#mainTabs").classList.toggle("open"));
  const editHeroButton = $("[data-edit-hero]");
  const importButton = $("[data-import-json]");
  const exportButton = $("[data-export-json]");
  if (editHeroButton) editHeroButton.addEventListener("click", openHeroModal);
  if (importButton) importButton.addEventListener("click", () => $("[data-import-input]").click());
  if (exportButton) exportButton.addEventListener("click", exportJsonFile);
  bindImportInput();
}

function renderActivePanel() {
  if (state.activeMain === "schedule") return renderSchedulePanel();
  if (state.activeMain === "reminders") return renderReminderPanel();
  if (state.activeMain === "references") return renderReferencePanel();
  return renderMapPanel();
}

function renderSchedulePanel() {
  $("#panel").innerHTML = `
    ${sharedRenderSchedulePanel({
      days: state.data.days,
      rows: scheduleRows(),
      startMinute: DAY_START,
      totalMinutes: SCHEDULE_TOTAL_MINUTES,
      cardClass: "trip-plan-calendar",
      cornerHtml: '<button class="calendar-add-day" type="button" data-add-day aria-label="新增 Day"><img src="/assets/icon/plus.svg" alt=""></button>',
      dayHeadTag: "button",
      dayHeadClass: "trip-plan-calendar-day-head",
      dayHeadAttrs: (_day, index) => `data-edit-calendar-day="${index}"`,
      dayLabel,
      dayColClass: "trip-plan-day-col",
      dayColAttrs: (_day, index) => `data-day-index="${index}"`,
      eventClass: "trip-plan-event",
      getEvents: buildEvents,
      eventAttrs: (ev) => `draggable="true" data-day-index="${ev.dayIndex}" data-stop-index="${ev.stopIndex}"`,
      eventLabel: (ev) => ev.stop.name || "未命名活動",
      eventTime: (ev) => eventRange(ev.stop),
      positionPercent: schedulePosition,
    })}
  `;
  bindSchedulePanel();
}

function bindSchedulePanel() {
  const addDayButton = $("[data-add-day]");
  if (addDayButton) addDayButton.addEventListener("click", addDay);
  $$("[data-edit-calendar-day]").forEach((button) => {
    button.addEventListener("click", () => {
      openDayModal(Number(button.dataset.editCalendarDay), { refresh: "schedule" });
    });
  });
  $$(".trip-plan-event").forEach((eventButton) => {
    eventButton.addEventListener("click", () => openEventModal(Number(eventButton.dataset.dayIndex), Number(eventButton.dataset.stopIndex)));
    eventButton.addEventListener("dragstart", (event) => {
      state.dragging = {
        dayIndex: Number(eventButton.dataset.dayIndex),
        stopIndex: Number(eventButton.dataset.stopIndex),
      };
      event.dataTransfer.effectAllowed = "move";
    });
  });
  $$(".trip-plan-day-col").forEach((column) => {
    column.addEventListener("pointerdown", startSelection);
    column.addEventListener("pointermove", updateSelection);
    column.addEventListener("pointerup", finishSelection);
    column.addEventListener("pointercancel", clearSelection);
    column.addEventListener("dragover", (event) => event.preventDefault());
    column.addEventListener("drop", dropEvent);
  });
}

function bindImportInput() {
  const input = $("[data-import-input]");
  if (!input || input.dataset.bound) return;
  input.dataset.bound = "1";
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      state.data = normalizeImportedData(JSON.parse(text));
      renumberDays();
      state.activeDayKey = state.data.days[0] ? state.data.days[0].key : null;
      saveData();
      render();
    } catch (error) {
      alert(`JSON 匯入失敗：${error.message || error}`);
    } finally {
      input.value = "";
    }
  });
}

function minuteFromPointer(event, column) {
  const rect = column.getBoundingClientRect();
  const ratio = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  return roundToStep(DAY_START + ratio * (DAY_END - DAY_START));
}

function startSelection(event) {
  if (event.button !== 0 || event.target.closest(".trip-plan-event")) return;
  const column = event.currentTarget;
  column.setPointerCapture(event.pointerId);
  const dayIndex = Number(column.dataset.dayIndex);
  const start = minuteFromPointer(event, column);
  state.selection = { dayIndex, start, end: start + 60, pointerId: event.pointerId };
  drawSelection(column);
}

function updateSelection(event) {
  if (!state.selection || state.selection.pointerId !== event.pointerId) return;
  const column = event.currentTarget;
  const current = minuteFromPointer(event, column);
  state.selection.end = current === state.selection.start ? current + 60 : current;
  drawSelection(column);
}

function finishSelection(event) {
  if (!state.selection || state.selection.pointerId !== event.pointerId) return;
  const selection = state.selection;
  let start = Math.min(selection.start, selection.end);
  let end = Math.max(selection.start, selection.end);
  if (end - start < 15) end = start + 60;
  clearSelection();
  openEventModal(selection.dayIndex, null, start, end);
}

function removeSelectionMarker() {
  $$(".trip-plan-selection").forEach((el) => el.remove());
}

function clearSelection() {
  state.selection = null;
  removeSelectionMarker();
}

function drawSelection(column) {
  const selection = state.selection;
  if (!selection) return;
  removeSelectionMarker();
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  const total = DAY_END - DAY_START;
  const marker = document.createElement("div");
  marker.className = "trip-plan-selection";
  marker.style.top = `${((start - DAY_START) / total) * 100}%`;
  marker.style.height = `${Math.max(3.5, ((end - start) / total) * 100)}%`;
  column.appendChild(marker);
}

function dropEvent(event) {
  event.preventDefault();
  if (!state.dragging) return;
  const targetDayIndex = Number(event.currentTarget.dataset.dayIndex);
  const sourceDay = state.data.days[state.dragging.dayIndex];
  const targetDay = state.data.days[targetDayIndex];
  const stop = sourceDay && sourceDay.stops ? sourceDay.stops[state.dragging.stopIndex] : null;
  if (!sourceDay || !targetDay || !stop) return;
  const duration = Math.max(15, Number(stop.duration_min || 60));
  const start = clamp(minuteFromPointer(event, event.currentTarget), DAY_START, DAY_END - duration);
  stop.start_time = minuteToTime(start);
  sourceDay.stops.splice(state.dragging.stopIndex, 1);
  targetDay.stops.push(stop);
  targetDay.stops.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  state.activeDayKey = targetDay.key;
  state.dragging = null;
  saveData();
  renderActivePanel();
}

function addDay() {
  const day = { key: uid("day"), label: `Day ${state.data.days.length + 1}`, title: "", theme: "", stops: [] };
  state.data.days.push(day);
  renumberDays();
  state.activeDayKey = day.key;
  state.activeMapDayKey = day.key;
  saveData();
  renderActivePanel();
}

function deleteActiveDay() {
  const index = state.data.days.findIndex((day) => day.key === state.activeDayKey);
  if (index < 0) return;
  deleteDayAt(index);
}

function deleteDayAt(index) {
  if (index < 0 || index >= state.data.days.length) return;
  if (!confirm(`刪除 ${dayLabel(state.data.days[index], index)}？`)) return;
  state.data.days.splice(index, 1);
  renumberDays();
  const nextActiveDay = state.data.days[Math.max(0, index - 1)];
  state.activeDayKey = nextActiveDay ? nextActiveDay.key : null;
  state.activeMapDayKey = state.activeDayKey;
  saveData();
  render();
}

function exportJsonFile() {
  const blob = new Blob([exportJsonText()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "trip-plan.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function copyJson() {
  const output = $("[data-json-output]");
  if (!output) return;
  output.focus();
  output.select();
  document.execCommand("copy");
}

function openHeroModal() {
  state.data.defaults = Object.assign({ currency: "TWD", locale: "zh-TW", price_unit: "per_person" }, state.data.defaults || {});
  openModal(`
    <form class="schedule-modal-card trip-plan-form" data-hero-form>
      ${modalHead("修改行程規劃", "Hero")}
      <div class="trip-plan-form-grid">
        <label>標題<input name="title" required value="${esc(state.data.title || "")}"></label>
        <label>幣別<select name="currency">
          ${CURRENCY_OPTIONS.map((currency) => `<option value="${esc(currency)}" ${state.data.defaults.currency === currency ? "selected" : ""}>${esc(currency)}</option>`).join("")}
        </select></label>
        <label>日期<input name="dates" value="${esc(state.data.dates || "")}"></label>
        <label>人數<input name="travelers" value="${esc(state.data.travelers || "")}"></label>
        <label>預算<input name="budget_per_person" value="${esc(state.data.budget_per_person || "")}"></label>
        <label>天數/住宿<input name="nights" value="${esc(state.data.nights || "")}"></label>
        <label>標籤<input name="tags" value="${esc((state.data.tags || []).join(", "))}"></label>
        <label class="trip-plan-wide">副標<textarea name="subtitle">${esc(state.data.subtitle || "")}</textarea></label>
        <label class="trip-plan-wide">摘要<textarea name="summary">${esc(state.data.summary || "")}</textarea></label>
        <label class="trip-plan-wide">封面圖片 URL<input name="coverImage" value="${esc(state.data.coverImage || "")}"></label>
      </div>
      <footer class="schedule-modal-actions">
        <button class="btn secondary" type="button" data-cancel>取消</button>
        <button class="btn" type="submit">儲存</button>
      </footer>
    </form>
  `);
  const modal = $(".schedule-modal");
  $("[data-hero-form]", modal).addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.data.title = String(form.get("title") || "").trim();
    state.data.subtitle = String(form.get("subtitle") || "").trim();
    state.data.summary = String(form.get("summary") || "").trim();
    state.data.coverImage = String(form.get("coverImage") || "").trim();
    state.data.dates = String(form.get("dates") || "").trim();
    state.data.travelers = numericValue(form.get("travelers"));
    state.data.budget_per_person = numericValue(form.get("budget_per_person"));
    state.data.nights = String(form.get("nights") || "").trim();
    state.data.tags = String(form.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean);
    state.data.defaults = Object.assign({}, state.data.defaults || {}, {
      currency: CURRENCY_OPTIONS.includes(String(form.get("currency"))) ? String(form.get("currency")) : "TWD",
      locale: "zh-TW",
      price_unit: "per_person",
    });
    saveData();
    closeModal();
    render();
  });
  $("[name='title']", modal).focus();
}

function openDayModal(dayIndex, options = {}) {
  const day = state.data.days[dayIndex];
  if (!day) return;
  openModal(`
    <form class="schedule-modal-card trip-plan-form" data-day-form>
      ${modalHead(dayLabel(day, dayIndex), "")}
      <div class="trip-plan-form-grid">
        <label>Title<input name="title" value="${esc(day.title || "")}" placeholder=""></label>
        <label>主題<input name="theme" value="${esc(day.theme || "")}"></label>
      </div>
      <footer class="schedule-modal-actions">
        <button class="btn secondary danger" type="button" data-delete-day-in-modal>刪除本日</button>
        <button class="btn secondary" type="button" data-cancel>取消</button>
        <button class="btn" type="submit">儲存</button>
      </footer>
    </form>
  `);
  const modal = $(".schedule-modal");
  $("[data-day-form]", modal).addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    day.title = String(form.get("title") || "").trim();
    day.theme = String(form.get("theme") || "").trim();
    saveData();
    closeModal();
    if (options.refresh === "schedule") renderActivePanel();
    else renderMapPanel();
  });
  $("[data-delete-day-in-modal]", modal).addEventListener("click", () => {
    closeModal();
    deleteDayAt(dayIndex);
  });
  $("[name='title']", modal).focus();
}

function openEventModal(dayIndex, stopIndex, start, end) {
  const day = state.data.days[dayIndex];
  if (!day) return;
  const isEdit = Number.isInteger(stopIndex);
  const stop = isEdit ? day.stops[stopIndex] : createStop({
    start_time: minuteToTime(start || 9 * 60),
    duration_min: Math.max(15, (end || 10 * 60) - (start || 9 * 60)),
  });
  openModal(`
    <form class="schedule-modal-card trip-plan-form" data-event-form>
      ${modalHead(isEdit ? dayLabel(day, dayIndex) : dayLabel(day, dayIndex), "")}
      <div class="trip-plan-form-grid">
        <label>名稱<input name="name" required value="${esc(stop.name || "")}"></label>
        <label>分類${renderCategorySelect("type", stop.type || "活動", "活動")}</label>
        <label>開始時間<input name="start_time" type="time" required value="${esc(stop.start_time || "09:00")}"></label>
        <label>結束時間<input name="end_time" type="time" required value="${esc(minuteToTime(stopEndMinute(stop)))}"></label>
        <label>地址<input name="address" value="${esc(stop.address || "")}"></label>
        <label>地圖連結<input name="map" value="${esc(stop.map || "")}"></label>
        <label>緯度<input name="lat" inputmode="decimal" value="${esc(stop.lat == null ? "" : stop.lat)}"></label>
        <label>經度<input name="lng" inputmode="decimal" value="${esc(stop.lng == null ? "" : stop.lng)}"></label>
        <label>最低費用<input name="price_min" inputmode="numeric" value="${esc(stop.price && stop.price.min != null ? stop.price.min : "")}"></label>
        <label>最高費用<input name="price_max" inputmode="numeric" value="${esc(stop.price && stop.price.max != null ? stop.price.max : "")}"></label>
        <label class="trip-plan-wide">備註<textarea name="note">${esc(stop.note || "")}</textarea></label>
        <label class="trip-plan-check"><input name="highlight" type="checkbox" ${stop.highlight ? "checked" : ""}> 標記重點</label>
      </div>
      <footer class="schedule-modal-actions">
        <button class="btn secondary danger" type="button" data-delete-event>刪除</button>
        <button class="btn secondary" type="button" data-cancel>取消</button>
        <button class="btn" type="submit">儲存</button>
      </footer>
    </form>
  `);
  const modal = $(".schedule-modal");
  $("[data-event-form]", modal).addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startMinute = timeToMinutes(form.get("start_time"));
    const endMinute = timeToMinutes(form.get("end_time"));
    const nextStop = Object.assign({}, stop, {
      name: String(form.get("name") || "").trim(),
      type: String(form.get("type") || "").trim(),
      start_time: minuteToTime(startMinute),
      duration_min: Math.max(15, endMinute - startMinute),
      address: String(form.get("address") || "").trim(),
      map: String(form.get("map") || "").trim(),
      note: String(form.get("note") || "").trim(),
      price: {
        min: numericValue(form.get("price_min")),
        max: numericValue(form.get("price_max")),
      },
      highlight: form.get("highlight") === "on",
    });
    setOptionalNumber(nextStop, "lat", form.get("lat"));
    setOptionalNumber(nextStop, "lng", form.get("lng"));
    if (isEdit) day.stops[stopIndex] = nextStop;
    else day.stops.push(nextStop);
    day.stops.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    state.activeDayKey = day.key;
    saveData();
    closeModal();
    renderActivePanel();
  });
  const deleteButton = $("[data-delete-event]", modal);
  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      if (!isEdit) {
        closeModal();
        return;
      }
      if (!confirm("刪除這個活動？")) return;
      day.stops.splice(stopIndex, 1);
      saveData();
      closeModal();
      renderActivePanel();
    });
  }
  $("[name='name']", modal).focus();
}

function renderReminderPanel() {
  $("#panel").innerHTML = `
    <div class="reminder-grid reminder-grid-two">
      <section class="info-card trip-plan-section-card">
        <div class="card-head">
          <h2>行前提醒</h2>
        </div>
        ${renderReminderListHtml(state.data.reminders, { editable: true, emptyText: "", addLabel: "" })}
      </section>
      <section class="info-card trip-plan-section-card">
        <div class="card-head">
          <h2>預算摘要</h2>
        </div>
        ${renderBudgetSummaryPanel()}
      </section>
    </div>
  `;
  $("[data-add-reminder]").addEventListener("click", () => openReminderModal(null));
  $$("[data-edit-reminder]").forEach((button) => button.addEventListener("click", () => openReminderModal(Number(button.dataset.editReminder))));
  $$("[data-remove-reminder]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.removeReminder);
    if (!Number.isInteger(index) || !confirm("刪除這個提醒？")) return;
    state.data.reminders.splice(index, 1);
    saveData();
    renderReminderPanel();
  }));
  $$("[data-budget-tag]").forEach((button) => button.addEventListener("click", () => {
    state.activeBudgetCategory = button.dataset.budgetTag;
    renderReminderPanel();
  }));
  $$("[data-budget-index]").forEach((button) => button.addEventListener("click", () => openBudgetModal(Number(button.dataset.budgetIndex))));
}

function renderBudgetSummaryPanel() {
  state.data.budget_items = normalizeBudgetItems(state.data.budget_items);
  const items = state.data.budget_items || [];
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const active = state.activeBudgetCategory || "__total__";
  if (active !== "__total__" && !items.some((item) => item.label === active)) state.activeBudgetCategory = "__total__";
  if (state.activeBudgetCategory === "__total__") {
    return `
      ${renderBudgetTabs(items)}
      <div class="budget-total-card">
        <div class="budget-summary-row"><strong>Total</strong><span>${formatCurrency(total)}</span></div>
        ${items.map((item) => `<div class="details-row"><strong>${esc(item.label)}</strong><span>${formatCurrency(item.value || 0)}</span></div>`).join("")}
      </div>
    `;
  }
  const item = items.find((budgetItem) => budgetItem.label === state.activeBudgetCategory) || items[0];
  if (!item) return `<div class="empty">尚無預算資料</div>`;
  const index = items.indexOf(item);
  const value = Number(item.value || 0);
  const share = total ? Math.round((value / total) * 100) : 0;
  const details = Array.isArray(item.details) ? item.details : [];
  return `
    ${renderBudgetTabs(items)}
    <div class="budget-total-card">
      <div class="budget-summary-row"><strong>${esc(item.label)}</strong><span>${formatCurrency(value)}</span></div>
      <div class="budget-bar"><div style="width:${Math.max(0, Math.min(100, share))}%"></div></div>
      <div class="small muted budget-share">Share: ${share}%</div>
      <div class="details-wrap">
        ${details.map((detail) => `<div class="details-row"><strong>${esc(detail.name || "細項")}</strong><span>${formatCurrency(detail.amount || 0)}</span></div>`).join("") || `<div class="empty compact"></div>`}
      </div>
      <button class="btn secondary trip-plan-budget-edit-action" type="button" data-budget-index="${index}">編輯${esc(item.label)}預算</button>
    </div>
  `;
}

function renderBudgetTabs(items) {
  const active = state.activeBudgetCategory || "__total__";
  return `
    <div class="budget-tabs">
      <button class="tag-filter-btn ${active === "__total__" ? "active" : ""}" type="button" data-budget-tag="__total__">Total</button>
      ${items.map((item) => `<button class="tag-filter-btn ${active === item.label ? "active" : ""}" type="button" data-budget-tag="${esc(item.label)}">${esc(item.label)}</button>`).join("")}
    </div>
  `;
}

function formatCurrency(value, data = state.data) {
  const currency = data?.defaults?.currency || "TWD";
  const locale = data?.defaults?.locale || "zh-TW";
  return formatMoney(value, currency, locale);
}

function openReminderModal(index) {
  const isEdit = Number.isInteger(index);
  const item = isEdit ? state.data.reminders[index] : { id: uid("reminder"), text: "" };
  openModal(`
    <form class="schedule-modal-card trip-plan-form" data-reminder-form>
      ${modalHead(isEdit ? "行前提醒" : "行前提醒", "")}
      <div class="trip-plan-form-grid">
        <label class="trip-plan-wide">內容<textarea name="text" required>${esc(item.text || "")}</textarea></label>
      </div>
      <footer class="schedule-modal-actions">
        <button class="btn secondary danger" type="button" data-delete-reminder>刪除</button>
        <button class="btn secondary" type="button" data-cancel>取消</button>
        <button class="btn" type="submit">儲存</button>
      </footer>
    </form>
  `);
  const modal = $(".schedule-modal");
  $("[data-reminder-form]", modal).addEventListener("submit", (event) => {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("text") || "").trim();
    if (isEdit) state.data.reminders[index] = Object.assign({}, item, { text });
    else state.data.reminders.push(Object.assign(item, { text }));
    saveData();
    closeModal();
    renderReminderPanel();
  });
  const deleteButton = $("[data-delete-reminder]", modal);
  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      if (!isEdit) {
        closeModal();
        return;
      }
      if (!confirm("刪除這個提醒？")) return;
      state.data.reminders.splice(index, 1);
      saveData();
      closeModal();
      renderReminderPanel();
    });
  }
  $("[name='text']", modal).focus();
}

function openBudgetModal(index) {
  state.data.budget_items = normalizeBudgetItems(state.data.budget_items);
  const item = state.data.budget_items[index];
  if (!item) return;
  openModal(`
    <form class="schedule-modal-card trip-plan-form" data-budget-form>
      ${modalHead(`${item.label}預算`, "")}
      <div class="trip-plan-budget-editor" data-budget-details>
        ${renderBudgetDetailInputs(item.details || [])}
      </div>
      <footer class="schedule-modal-actions">
        <button class="btn secondary" type="button" data-add-budget-detail>新增子項目</button>
        <button class="btn secondary" type="button" data-cancel>取消</button>
        <button class="btn" type="submit">儲存</button>
      </footer>
    </form>
  `);
  const modal = $(".schedule-modal");
  $("[data-add-budget-detail]", modal).addEventListener("click", () => {
    const box = $("[data-budget-details]", modal);
    box.insertAdjacentHTML("beforeend", renderBudgetDetailInput({ id: uid("budget-detail"), name: "", amount: 0, note: "" }, box.children.length));
    bindBudgetDetailRemove(modal);
  });
  bindBudgetDetailRemove(modal);
  $("[data-budget-form]", modal).addEventListener("submit", (event) => {
    event.preventDefault();
    const details = $$("[data-budget-detail-row]", modal).map((row) => ({
      id: row.dataset.detailId || uid("budget-detail"),
      name: String($("[name='detail_name']", row).value || "").trim(),
      amount: Number($("[name='detail_amount']", row).value || 0) || 0,
      note: String($("[name='detail_note']", row).value || "").trim(),
    })).filter((detail) => detail.name || detail.amount || detail.note);
    item.details = details;
    syncBudgetValue(item);
    saveData();
    closeModal();
    renderReminderPanel();
  });
  const firstName = $("[name='detail_name']", modal);
  if (firstName) firstName.focus();
}

function renderBudgetDetailInputs(details) {
  const rows = details.length ? details : [{ id: uid("budget-detail"), name: "", amount: 0, note: "" }];
  return rows.map(renderBudgetDetailInput).join("");
}

function renderBudgetDetailInput(detail, index) {
  return `
    <div class="trip-plan-budget-detail-edit" data-budget-detail-row data-detail-id="${esc(detail.id || uid("budget-detail"))}">
      <label>子項目<input name="detail_name" value="${esc(detail.name || "")}" placeholder=""></label>
      <label>金額<input name="detail_amount" inputmode="numeric" value="${esc(detail.amount || "")}"></label>
      <label class="trip-plan-wide">備註<input name="detail_note" value="${esc(detail.note || "")}"></label>
      <button class="trip-plan-icon-danger" type="button" data-remove-budget-detail>刪除</button>
    </div>
  `;
}

function bindBudgetDetailRemove(root) {
  $$("[data-remove-budget-detail]", root).forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = "1";
    button.addEventListener("click", () => {
      const rows = $$("[data-budget-detail-row]", root);
      if (rows.length <= 1) {
        const row = button.closest("[data-budget-detail-row]");
        $$("input", row).forEach((input) => { input.value = ""; });
        return;
      }
      button.closest("[data-budget-detail-row]").remove();
    });
  });
}

function renderReferencePanel() {
  $("#panel").innerHTML = sharedRenderReferencesPanel(state.data.references, {
    editable: true,
    emptyText: "",
  });
  $("[data-add-reference]").addEventListener("click", () => openReferenceModal(null));
  $$("[data-edit-reference]").forEach((button) => button.addEventListener("click", () => openReferenceModal(Number(button.dataset.editReference))));
  $$("[data-remove-reference]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.removeReference);
    if (!Number.isInteger(index) || !confirm("刪除這個參考網站？")) return;
    state.data.references.splice(index, 1);
    saveData();
    renderReferencePanel();
  }));
}

function openReferenceModal(index) {
  const isEdit = Number.isInteger(index);
  const item = isEdit ? state.data.references[index] : { id: uid("reference"), title: "", url: "", type: "" };
  openModal(`
    <form class="schedule-modal-card trip-plan-form" data-reference-form>
      ${modalHead(isEdit ? "參考網站" : "參考網站", "")}
      <div class="trip-plan-form-grid">
        <label>標題<input name="title" required value="${esc(item.title || "")}"></label>
        <label>分類${renderCategorySelect("type", item.type || "其他")}</label>
        <label class="trip-plan-wide">網址<input name="url" type="url" value="${esc(item.url || "")}"></label>
      </div>
      <footer class="schedule-modal-actions">
        <button class="btn secondary danger" type="button" data-delete-reference>刪除</button>
        <button class="btn secondary" type="button" data-cancel>取消</button>
        <button class="btn" type="submit">儲存</button>
      </footer>
    </form>
  `);
  const modal = $(".schedule-modal");
  $("[data-reference-form]", modal).addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextItem = Object.assign({}, item, {
      title: String(form.get("title") || "").trim(),
      type: String(form.get("type") || "").trim(),
      url: String(form.get("url") || "").trim(),
    });
    if (isEdit) state.data.references[index] = nextItem;
    else state.data.references.push(nextItem);
    saveData();
    closeModal();
    renderReferencePanel();
  });
  const deleteButton = $("[data-delete-reference]", modal);
  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      if (!isEdit) {
        closeModal();
        return;
      }
      if (!confirm("刪除這個網站？")) return;
      state.data.references.splice(index, 1);
      saveData();
      closeModal();
      renderReferencePanel();
    });
  }
  $("[name='title']", modal).focus();
}

function renderMapPanel() {
  const days = state.data.days || [];
  if (!state.activeMapDayKey && days[0]) state.activeMapDayKey = days[0].key;
  const locations = collectMapLocations();
  const visible = visibleMapLocations(locations);
  const first = visible.find((loc) => loc.hasMap) || visible[0] || locations.find((loc) => loc.hasMap) || locations[0];
  if (!state.activeMapId || !locations.some((loc) => loc.id === state.activeMapId)) state.activeMapId = first ? first.id : "";
  const active = locations.find((loc) => loc.id === state.activeMapId) || first;

  $("#panel").innerHTML = renderMapPanelShell({
    activeSub: state.activeMapSub,
    layoutClass: "trip-plan-map-layout",
    mapCanvasId: "planMapCanvas",
    mapFrameId: "planMapFrame",
    leafletMapId: "planLeafletMap",
    focusId: "planMapFocus",
    frameSrc: active && active.hasMap ? mapEmbedUrl(active.stop) : fallbackPlanMapUrl(),
    focusHtml: active ? renderMapFocus(active) : "",
    listHtml: renderMapList(locations),
  });
  bindMapPanel(locations);
  updateMapDisplay(active, locations);
}

function collectMapLocations() {
  const dayLocations = collectDayMapLocations(state.data.days || [], {
    idForStop: (_day, dayIndex, _stop, stopIndex) => `day-${dayIndex}-stop-${stopIndex}`,
    dayLabel,
    dayTitle,
    nameForStop: (stop) => stop.name || "未命名活動",
    typeForStop: (stop) => stop.type || "",
    timeRangeForStop: eventRange,
    durationForStop: (stop) => durationText(stop.duration_min),
    priceForStop: (stop) => priceText(stop.price),
    addressForStop: (stop) => stop.address || "",
    urlForStop: (stop) => stop.map || "",
    latLngForStop: (stop) => hasLatLng(stop) ? { lat: Number(stop.lat), lng: Number(stop.lng) } : null,
    hasMapForStop: (stop, latLng, address) => Boolean(latLng || stop.map || address),
    tagsForStop,
  });
  const shopLocations = (state.data.shops || []).map((shop, index) => {
    const latLng = hasLatLng(shop) ? { lat: Number(shop.lat), lng: Number(shop.lng) } : null;
    const type = shop.tag || shop.type || "其他";
    const hasMap = Boolean(latLng || shop.map || shop.address);
    return {
      id: `shop-${index}`,
      source: "shop",
      stop: shop,
      shop,
      shopIndex: index,
      order: index + 1,
      name: shop.name || "未命名地點",
      title: shop.name || "未命名地點",
      type,
      tags: tagsForMapStop({ type }),
      address: shop.address || "",
      url: shop.map || shop.url || "",
      latLng,
      note: shop.note || "",
      price: priceText(shop.price),
      hasMap,
      hasCoords: Boolean(latLng),
      highlight: true,
    };
  });
  return [...dayLocations, ...shopLocations];
}

function tagsForStop(stop) {
  return tagsForMapStop(stop);
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
  return loc.source === "shop" || isFavoriteMapLocation(loc);
}

function renderMapList(locations) {
  return renderMapListHtml(locations, {
    activeSub: state.activeMapSub,
    activeDayKey: state.activeMapDayKey,
    activeTag: state.activeMapTag,
    activeId: state.activeMapId,
    mapMode: state.mapMode,
    mapDayKey: state.mapDayKey,
    days: state.data.days || [],
    dayLabel: mapDayTabLabel,
    dayTitle,
    dayTabAttr: "data-map-day-key",
    dayRouteAttr: "data-map-day-route",
    editDayAttr: "data-edit-map-day",
    editableDay: true,
    favoritePredicate: isFavoriteLocation,
    favoriteTags: CATEGORY_OPTIONS,
    afterListHtml: state.activeMapSub === "saved" ? `<button class="reminder-details-row reminder-add-row map-add-place-row" type="button" data-add-shop><span class="icon-action add"><img src="/assets/icon/plus.svg" alt=""></span></button>` : "",
    typeClass: eventTypeClass,
  });
}

function renderDetailCard(loc) {
  return sharedRenderDetailCard(loc, {
    activeId: state.activeMapId,
    googleMapsUrl: googleMapsOpenUrl(loc.stop),
    extraClass: "trip-plan-map-detail",
    includeMissingNote: true,
  });
}

function bindMapPanel(locations) {
  $$("[data-map-sub]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeMapSub = button.dataset.mapSub;
      state.activeMapTag = "__all__";
      state.activeMapId = "";
      state.mapMode = "single";
      state.mapDayKey = null;
      renderMapPanel();
    });
  });
  $$("[data-map-day-key]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeMapDayKey = button.dataset.mapDayKey;
      state.activeMapId = "";
      state.mapMode = "single";
      state.mapDayKey = null;
      renderMapPanel();
    });
  });
  $$("[data-edit-map-day]").forEach((button) => {
    button.addEventListener("click", () => openDayModal(Number(button.dataset.editMapDay)));
  });
  $("[data-add-shop]")?.addEventListener("click", () => openShopModal());
  $$("[data-map-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeMapTag = button.dataset.mapTag;
      state.activeMapId = "";
      state.mapMode = "single";
      state.mapDayKey = null;
      renderMapPanel();
    });
  });
  $$("[data-detail-id]").forEach((el) => {
    el.addEventListener("click", () => focusMapLocation(el.dataset.detailId, locations));
  });
  $$("[data-map-id]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      focusMapLocation(el.dataset.mapId, locations);
    });
  });
  $$("[data-next-id]").forEach((button) => {
    button.addEventListener("click", () => focusMapLocation(button.dataset.nextId, locations));
  });
  $$("[data-map-day-route]").forEach((button) => {
    button.addEventListener("click", () => {
      const dayKey = button.dataset.mapDayRoute;
      const already = state.mapMode === "day" && String(state.mapDayKey) === String(dayKey);
      state.mapMode = already ? "single" : "day";
      state.mapDayKey = already ? null : dayKey;
      const first = locations.find((loc) => String(loc.dayKey) === String(dayKey) && (already ? loc.hasMap : loc.hasCoords))
        || locations.find((loc) => String(loc.dayKey) === String(dayKey) && loc.hasMap);
      if (first) state.activeMapId = first.id;
      renderMapPanel();
    });
  });
}

function openShopModal() {
  const item = normalizeShopItem({ tag: state.activeMapTag !== "__all__" ? state.activeMapTag : "餐飲" });
  openModal(`
    <form class="schedule-modal-card trip-plan-form" data-shop-form>
      ${modalHead("新增收藏地點", "收藏夾")}
      <div class="trip-plan-form-grid">
        <label>名稱<input name="name" value="${esc(item.name)}" required></label>
        <label>分類${renderCategorySelect("tag", item.tag, "其他")}</label>
        <label class="trip-plan-wide">地址<input name="address" value="${esc(item.address || "")}" placeholder="可留空"></label>
        <label class="trip-plan-wide">Google Maps / 地圖連結<input name="map" value="${esc(item.map || "")}" placeholder="https://maps.google.com/..."></label>
        <label>緯度<input name="lat" inputmode="decimal" value="${esc(item.lat || "")}"></label>
        <label>經度<input name="lng" inputmode="decimal" value="${esc(item.lng || "")}"></label>
        <label class="trip-plan-wide">參考網址<input name="url" value="${esc(item.url || "")}" placeholder="可留空"></label>
        <label class="trip-plan-wide">備註<textarea name="note">${esc(item.note || "")}</textarea></label>
      </div>
      <footer class="schedule-modal-actions">
        <button class="btn secondary" type="button" data-cancel>取消</button>
        <button class="btn" type="submit">儲存</button>
      </footer>
    </form>
  `);
  const modal = $(".schedule-modal");
  $("[data-shop-form]", modal).addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextItem = normalizeShopItem({
      tag: String(form.get("tag") || "其他").trim(),
      name: String(form.get("name") || "").trim(),
      address: String(form.get("address") || "").trim(),
      map: String(form.get("map") || "").trim(),
      url: String(form.get("url") || "").trim(),
      note: String(form.get("note") || "").trim(),
    });
    setOptionalNumber(nextItem, "lat", form.get("lat"));
    setOptionalNumber(nextItem, "lng", form.get("lng"));
    state.data.shops.push(nextItem);
    state.activeMapSub = "saved";
    state.activeMapTag = nextItem.tag || "__all__";
    state.activeMapId = `shop-${state.data.shops.length - 1}`;
    saveData();
    closeModal();
    renderMapPanel();
  });
  $("[name='name']", modal).focus();
}

function focusMapLocation(id, locations) {
  const loc = locations.find((item) => item.id === id);
  if (!loc || !loc.hasMap) return;
  const keepDayRoute = state.mapMode === "day" && String(state.mapDayKey) === String(loc.dayKey);
  if (keepDayRoute && !loc.hasCoords) return;
  state.activeMapId = id;
  const focus = $("#planMapFocus");
  if (focus) focus.innerHTML = renderMapFocus(loc);
  if (!keepDayRoute) {
    state.mapMode = "single";
    state.mapDayKey = null;
  }
  updateMapDisplay(loc, locations);
  $$(".outline-item,.place-card,.favorite-item,.detail-card").forEach((el) => {
    const active = el.dataset.detailId === id || el.dataset.mapId === id;
    el.classList.toggle("active-map", active);
  });
}

function renderMapFocus(loc) {
  return sharedRenderMapFocus(loc, {
    activeId: state.activeMapId,
    googleMapsUrl: googleMapsOpenUrl(loc.stop),
    extraClass: "trip-plan-map-detail",
    includeMissingNote: true,
  });
}

function hasLatLng(stop) {
  const lat = Number(stop.lat);
  const lng = Number(stop.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function googleMapsOpenUrl(stop) {
  return mapOpenUrl(stop);
}

function fallbackPlanMapUrl() {
  return "https://www.google.com/maps?q=Taiwan&output=embed";
}

function renderGoogleIframe(url) {
  setMapCanvasMode("iframe");
  resetLeaflet();
  const frame = $("#planMapFrame");
  if (frame) frame.src = url || fallbackPlanMapUrl();
}

function renderLeafletLocations(locations, options = {}) {
  return renderLeafletLocationsShared(locations, options, {
    mapElementId: "planLeafletMap",
    frameElementId: "planMapFrame",
    loadingText: "地圖載入中",
    tileProvider: TILE_PROVIDER,
    getMap: () => state.leafletMap,
    setMap: (map) => { state.leafletMap = map; },
    defaultMapCenter,
    setCanvasMode: setMapCanvasMode,
    resetMap: resetLeaflet,
    onLoadError: (_error, points) => renderGoogleIframe(activeMapFallbackUrl(points?.[0])),
    popupIcon: false,
    onMarkerClick: (loc) => {
      state.activeMapId = loc.id;
      const focus = $("#planMapFocus");
      if (focus) focus.innerHTML = renderMapFocus(loc);
      $$(".outline-item,.place-card,.favorite-item,.detail-card").forEach((el) => {
        const active = el.dataset.detailId === loc.id || el.dataset.mapId === loc.id || el.dataset.mapid === loc.id;
        el.classList.toggle("active-map", active);
        el.classList.toggle("active", active);
      });
    },
  });
}

function updateMapDisplay(active, locations) {
  if (state.mapMode === "day") {
    const dayKey = state.mapDayKey ?? state.activeMapDayKey;
    const dayLocations = locations.filter((loc) => String(loc.dayKey) === String(dayKey) && loc.hasCoords);
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

  renderGoogleIframe(active?.stop ? mapEmbedUrl(active.stop) : fallbackPlanMapUrl());
}

function modalHead(title, subtitle) {
  return `
    <div class="schedule-modal-bar"></div>
    <header class="schedule-modal-head">
      <div>
        <div class="small muted">${esc(subtitle || "")}</div>
        <h2>${esc(title)}</h2>
      </div>
      <button class="schedule-modal-close" type="button" aria-label="關閉"><img src="/assets/icon/cross.svg" alt=""></button>
    </header>
  `;
}

function openModal(content) {
  const host = $("#planModalHost");
  host.innerHTML = `
    <div class="schedule-modal" role="dialog" aria-modal="true">
      <button class="schedule-modal-backdrop" type="button" aria-label="關閉"></button>
      ${content}
    </div>
  `;
  const modal = $(".schedule-modal", host);
  const close = () => closeModal();
  const onKeyDown = (event) => { if (event.key === "Escape") close(); };
  modal.dataset.keydown = "1";
  modal._onKeyDown = onKeyDown;
  $(".schedule-modal-backdrop", modal).addEventListener("click", close);
  $(".schedule-modal-close", modal).addEventListener("click", close);
  const cancelButton = $("[data-cancel]", modal);
  if (cancelButton) cancelButton.addEventListener("click", close);
  document.addEventListener("keydown", onKeyDown);
}

function closeModal() {
  const modal = $(".schedule-modal");
  if (modal && modal._onKeyDown) document.removeEventListener("keydown", modal._onKeyDown);
  $("#planModalHost").innerHTML = "";
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && String(value).trim() !== "" ? number : "";
}

function setOptionalNumber(target, key, value) {
  const number = Number(value);
  if (Number.isFinite(number) && String(value).trim() !== "") target[key] = number;
  else delete target[key];
}

state.data = loadData();
renumberDays();
state.activeDayKey = state.data.days[0] ? state.data.days[0].key : null;
saveData();
render();
