import { normalizeTripData, normalizeStayGroups, normalizeShopGroups } from "./trip-normalizers.js";
import { validateTripData } from "./trip-validators.js";

const state = { data: null, activeMain: "map", activeMapSub: "days", activeDay: null, currentMapId: "", activeDetailId: "", activeTag: "__all__" };

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const nonEmpty = (v) => v !== undefined && v !== null && String(v).trim() !== "";

function formatMoney(value, data = state.data) {
  const currency = data?.defaults?.currency || "TWD";
  const locale = data?.defaults?.locale || "zh-TW";
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function priceText(price) {
  if (!price) return "";
  if (typeof price === "string") return price;
  if (price.kind === "text") return price.text || "";
  if (price.kind === "free") return "免費";
  const unit = price.unit === "per_night" ? " / 晚" : price.unit === "per_group" ? " / 組" : price.unit === "none" ? "" : " / 人";
  if (price.kind === "fixed" && typeof price.amount === "number") return `${formatMoney(price.amount)}${unit}`;
  if (price.kind === "range") {
    const left = typeof price.min === "number" ? formatMoney(price.min) : "";
    const right = typeof price.max === "number" ? formatMoney(price.max) : "";
    return [left, right].filter(Boolean).join(" - ") + unit;
  }
  return "";
}

function durationText(min) {
  if (typeof min !== "number") return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} 小時` : "", m ? `${m} 分` : ""].filter(Boolean).join(" ") || `${min} 分`;
}

function mapUrl(item) {
  if (nonEmpty(item?.map)) return item.map;
  if (typeof item?.lat === "number" && typeof item?.lng === "number") return `https://maps.google.com/?q=${item.lat},${item.lng}`;
  const label = item?.maps_label || item?.name || item?.address?.full || item?.address || "台灣";
  return nonEmpty(label) ? `https://maps.google.com/?q=${encodeURIComponent(label)}` : "";
}

function embedUrl(url) {
  if (!nonEmpty(url)) return fallbackMapEmbedUrl();
  try {
    const u = new URL(url);
    const q = u.searchParams.get("q") || u.searchParams.get("query") || url;
    return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
  } catch {
    return `https://www.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
  }
}

function fallbackMapEmbedUrl() {
  // 無 map/lat/lng 時只顯示小琉球區域，不用 q 參數，避免產生紅色 marker。
  return "https://www.google.com/maps/@22.3384,120.3710,13z?output=embed";
}

function dayLabel(day, index) { return day.label || `Day ${index + 1}`; }

export function renderTripPage(rawData) {
  const data = normalizeTripData(rawData);
  const result = validateTripData(data);
  state.data = data;
  state.activeDay = data.days[0]?.key ?? null;
  state.currentMapId = "";

  if (!result.valid) return renderValidationError(result.errors);
  renderShell();
  renderHeader();
  bindMainTabs();
  renderActivePanel();
}

function renderShell() {
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = `
    <div class="mobile-topbar">
      <button class="mobile-menu-btn" type="button" aria-label="切換選單">☰</button>
      <strong>${esc(state.data.title)}</strong>
    </div>
    <main class="wrap">
      <section class="hero">
        <div>
          <div class="kicker">Travel Plan</div>
          <h1 id="title"></h1>
          <p id="subtitle"></p>
          <div class="tags" id="tags"></div>
        </div>
        <div class="meta">
          <div class="box"><span>日期</span><strong id="dates"></strong></div>
          <div class="box"><span>人數</span><strong id="travelers"></strong></div>
          <div class="box"><span>預算</span><strong id="budget"></strong></div>
          <div class="box"><span>住宿</span><strong id="nights"></strong></div>
        </div>
      </section>

      <nav class="main-tabs" id="mainTabs" aria-label="旅遊資訊分頁">
        <button class="main-tab active" data-main="map">地圖資訊</button>
        <button class="main-tab" data-main="schedule">時程表</button>
        <button class="main-tab" data-main="reminders">行前提醒</button>
        <button class="main-tab" data-main="references">參考網站</button>
      </nav>

      <section class="panel" id="panel"></section>
    </main>
  `;
}

function renderHeader() {
  const data = state.data;
  $("#title").textContent = data.title;
  $("#subtitle").textContent = data.subtitle || data.summary || "";
  $("#dates").textContent = data.dates || "-";
  $("#travelers").textContent = data.travelers ? `${data.travelers} 人` : "-";
  $("#budget").textContent = data.budget_per_person ? `${formatMoney(data.budget_per_person)} / 人` : "-";
  $("#nights").textContent = data.nights || "-";
  $("#tags").innerHTML = (data.tags || []).map((tag) => `<span class="badge">${esc(tag)}</span>`).join("");
}

function bindMainTabs() {
  $$(".main-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeMain = button.dataset.main;
      $$(".main-tab").forEach((b) => b.classList.toggle("active", b === button));
      renderActivePanel();
      if (window.matchMedia("(max-width: 700px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  $(".mobile-menu-btn")?.addEventListener("click", () => $("#mainTabs")?.classList.toggle("open"));
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
  const start = timeToMinute(timeText(stop));
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

function tagsForStop(stop) {
  const tags = [];
  if (Array.isArray(stop.tags)) tags.push(...stop.tags);
  if (nonEmpty(stop.type)) tags.push(stop.type);
  if (stop.highlight) tags.push("重點");
  return [...new Set(tags.map(normalizeTagName).filter(Boolean))];
}

function allTags(locations) {
  return [...new Set(locations.flatMap((loc) => loc.tags || []).filter(Boolean))];
}

function collectLocations() {
  const data = state.data;
  const locations = [];

  // 以 JSON days 為主：每日行程 / 所有地點都必須列出 Day 1 ~ Day N 的所有 stop。
  // 有明確 map/lat/lng 的 stop 才進入「地點收藏夾」與地圖切換。
  (data.days || []).forEach((day, dayIndex) => {
    (day.stops || []).forEach((stop, stopIndex) => {
      const explicitMap = nonEmpty(stop.map) || typeof stop.lat === "number" || typeof stop.lng === "number";
      const url = explicitMap ? mapUrl(stop) : "";
      const tags = tagsForStop(stop);
      locations.push({
        id: `day-${String(day.key).replace(/[^a-zA-Z0-9_-]/g, "_")}-${stopIndex + 1}`,
        source: "day",
        group: "每日行程",
        dayKey: day.key,
        dayLabel: dayLabel(day, dayIndex),
        dayTitle: day.title || day.theme || "",
        order: stopIndex + 1,
        title: stop.maps_label || stop.name,
        name: stop.name || stop.maps_label || "未命名行程",
        time: timeText(stop),
        timeRange: timeRangeText(stop),
        duration: durationText(stop.duration_min),
        transit: durationText(stop.transit_to_next_min),
        next: stop.next || "",
        type: normalizeTagName(stop.type || ""),
        tags,
        subtitle: [timeRangeText(stop), normalizeTagName(stop.type || ""), priceText(stop.price)].filter(Boolean).join("｜"),
        address: addressText(stop),
        note: stop.note || "",
        price: priceText(stop.price),
        highlight: Boolean(stop.highlight),
        url,
        hasMap: explicitMap,
      });
    });
  });

  // 住宿 / shops 只作為地圖收藏夾補充來源；「所有地點」仍以行程 days 為主。
  normalizeStayGroups(data).forEach((group, gi) => group.items.forEach((item, ii) => {
    const explicitMap = nonEmpty(item.map) || typeof item.lat === "number" || typeof item.lng === "number";
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
      hasMap: true,
    });
  }));

  normalizeShopGroups(data).forEach((group, gi) => group.items.forEach((item, ii) => {
    const explicitMap = nonEmpty(item.map) || typeof item.lat === "number" || typeof item.lng === "number";
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
      hasMap: true,
    });
  }));
  return locations;
}

function renderMapPanel() {
  const days = state.data.days || [];
  const locations = collectLocations();
  const first = locations.find((l) => l.hasMap) || locations[0];
  if (!state.currentMapId && first?.hasMap) state.currentMapId = first.id;
  if (!state.activeDetailId && locations[0]) state.activeDetailId = locations[0].id;
  const active = locations.find((l) => l.id === state.currentMapId && l.hasMap) || locations.find((l) => l.hasMap);

  $("#panel").innerHTML = `
    <div class="map-layout">
      <aside class="map-side">
        <div class="sub-tabs" id="mapSubTabs">
          <button class="sub-tab ${state.activeMapSub === "days" ? "active" : ""}" data-sub="days">每日行程</button>
          <button class="sub-tab ${state.activeMapSub === "all" ? "active" : ""}" data-sub="all">所有地點</button>
          <button class="sub-tab ${state.activeMapSub === "saved" ? "active" : ""}" data-sub="saved">地點收藏夾</button>
        </div>
        <div id="mapList"></div>
      </aside>
      <section class="map-frame-card">
        <iframe id="mapFrame" src="${esc(active ? embedUrl(active.url) : fallbackMapEmbedUrl())}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        <div class="map-focus" id="mapFocus">${active ? renderMapFocus(active) : `<span class="muted">尚未選擇地點</span>`}</div>
      </section>
    </div>
  `;

  $$(".sub-tab").forEach((button) => button.addEventListener("click", () => { state.activeMapSub = button.dataset.sub; state.activeTag = "__all__"; renderMapPanel(); }));
  renderMapList(locations, days);
}

function renderMapFocus(loc) {
  return renderDetailCard(loc, relatedDayLocations(loc), { compact: true, mapFocus: true });
}

function relatedDayLocations(loc) {
  const locations = collectLocations();
  return loc?.dayKey !== undefined ? locations.filter((x) => x.dayKey === loc.dayKey && x.source === "day") : [];
}

function renderMapList(locations, days) {
  const box = $("#mapList");
  if (!box) return;
  if (state.activeMapSub === "days") box.innerHTML = renderDailyItinerary(locations, days);
  else if (state.activeMapSub === "all") box.innerHTML = renderAllPlaces(locations);
  else box.innerHTML = renderFavoritePlaces(locations);
  bindMapListEvents(locations);
}

function renderDailyItinerary(locations, days) {
  const activeDay = days.find((d) => d.key === state.activeDay) || days[0];
  if (!activeDay) return `<div class="empty">尚無每日行程</div>`;
  const dayIndex = days.findIndex((d) => d.key === activeDay.key);
  const dayLocations = locations.filter((loc) => loc.source === "day" && loc.dayKey === activeDay.key);
  const activeDetail = dayLocations.find((loc) => loc.id === state.activeDetailId) || dayLocations[0];
  if (activeDetail && state.activeDetailId !== activeDetail.id) state.activeDetailId = activeDetail.id;
  return `
    <div class="day-tabs">${days.map((day, index) => `
      <button class="day-tab ${day.key === activeDay.key ? "active" : ""}" data-day-key="${esc(day.key)}">${esc(dayLabel(day, index))}</button>`).join("")}</div>
    <article class="day-summary-card">
      <div class="small muted">${esc(dayLabel(activeDay, dayIndex))}</div>
      <h2>${esc(activeDay.title || dayLabel(activeDay, dayIndex))}</h2>
      ${activeDay.theme ? `<p>${esc(activeDay.theme)}</p>` : ""}
      ${activeDay.hero ? `<span class="badge">重點：${esc(activeDay.hero)}</span>` : ""}
      <button class="map-all-day-btn" type="button" data-map-day="${esc(activeDay.key)}">🛫 將當日全部地點顯示在地圖上</button>
      <div class="outline-block">
        <div class="outline-title">▼ 本日行程（${dayLocations.length}）</div>
        <div class="outline-list">${dayLocations.map(renderOutlineItem).join("") || `<div class="empty compact">此日沒有行程</div>`}</div>
      </div>
    </article>
  `;
}

function renderOutlineItem(loc) {
  return `
    <button class="outline-item ${loc.id === state.activeDetailId ? "active" : ""}" data-detail-id="${esc(loc.id)}"${loc.hasMap ? ` data-mapid="${esc(loc.id)}"` : ""}>
      <span class="outline-num">${esc(loc.order || "")}</span>
      ${loc.timeRange ? `<span class="outline-time">${esc(loc.timeRange)}</span>` : ""}
      <span class="outline-name">${esc(loc.name)}</span>
      ${loc.type ? `<span class="outline-type">${esc(loc.type)}</span>` : ""}
    </button>
  `;
}

function renderDetailCard(loc, dayLocations = [], options = {}) {
  const next = loc.next || dayLocations.find((x) => x.order === loc.order + 1)?.name || "";
  const detailTags = (loc.tags || []).filter((tag) => tag !== "重點");
  return `
    <article class="detail-card ${options.mapFocus ? "map-focus-detail" : ""} ${loc.id === state.activeDetailId ? "active-map" : ""}" data-detail-id="${esc(loc.id)}"${loc.hasMap ? ` data-mapid="${esc(loc.id)}"` : ""}>
      <h2>${esc(loc.name)}</h2>
      <div class="detail-meta">
        ${loc.timeRange ? `<span class="time-pill">${esc(loc.timeRange)}</span>` : ""}
        ${loc.duration ? `<span class="pill">${esc(loc.duration)}</span>` : ""}
        ${loc.price ? `<span class="pill">${esc(loc.price)}</span>` : ""}
      </div>
      ${detailTags.length ? `<div class="tag-list">${detailTags.map((tag) => `<span class="tag-chip">${esc(tag)}</span>`).join("")}</div>` : ""}
      ${loc.address ? `<div class="addr-box"><div class="small muted">地址</div><div>${esc(loc.address)}</div></div>` : ""}
      ${loc.note ? `<p class="detail-note">${esc(loc.note)}</p>` : ""}
      ${!loc.hasMap ? `<div class="map-missing-note">尚未填寫地圖位置，右方暫顯示小琉球區域且不顯示 marker。</div>` : ""}
      ${loc.hasMap ? `<a class="btn secondary detail-map-btn" href="${esc(loc.url)}" target="_blank" rel="noopener noreferrer">開啟 Google Maps</a>` : ""}
      ${next ? `<button class="next-btn" type="button" data-next-title="${esc(next)}">下一站：${esc(next)}</button>` : ""}
    </article>
  `;
}

function renderTagFilters(tags, activeTag = state.activeTag || "__all__") {
  return `
    <div class="tag-filter">
      <button class="tag-filter-btn ${activeTag === "__all__" ? "active" : ""}" data-tag="__all__">全部</button>
      ${tags.map((tag) => `<button class="tag-filter-btn ${activeTag === tag ? "active" : ""}" data-tag="${esc(tag)}">${esc(tag)}</button>`).join("")}
    </div>
  `;
}

function filterByActiveTag(locations) {
  const activeTag = state.activeTag || "__all__";
  if (activeTag === "__all__") return locations;
  return locations.filter((loc) => (loc.tags || []).includes(activeTag) || loc.type === activeTag);
}

function renderAllPlaces(locations) {
  const candidates = locations.filter((loc) => loc.source === "day");
  const tags = allTags(candidates);
  const filtered = filterByActiveTag(candidates);
  const active = filtered.find((loc) => loc.id === state.activeDetailId) || filtered[0];
  return `
    ${renderTagFilters(tags)}
    <div class="favorite-list all-place-list">${filtered.map(renderPlaceListItem).join("") || `<div class="empty">此分類沒有地點</div>`}</div>
  `;
}

function renderPlaceListItem(loc) {
  return `
    <button class="favorite-item all-place-item ${loc.id === state.activeDetailId ? "active" : ""}" data-detail-id="${esc(loc.id)}"${loc.hasMap ? ` data-mapid="${esc(loc.id)}"` : ""}>
      <span>${esc(loc.name)}</span>
      ${loc.type ? `<small>${esc(loc.type)}</small>` : loc.tags?.[0] ? `<small>${esc(loc.tags[0])}</small>` : ""}
    </button>
  `;
}

function renderFavoritePlaces(locations) {
  const candidates = locations.filter((loc) => loc.hasMap && nonEmpty(loc.url));
  const tags = allTags(candidates);
  const filtered = filterByActiveTag(candidates);
  const active = filtered.find((loc) => loc.id === state.activeDetailId) || filtered.find((loc) => loc.id === state.currentMapId) || filtered[0];
  return `
    ${renderTagFilters(tags)}
    <div class="favorite-list">${filtered.map((loc) => `
      <button class="favorite-item ${loc.id === state.currentMapId || loc.id === state.activeDetailId ? "active" : ""}" data-mapid="${esc(loc.id)}" data-detail-id="${esc(loc.id)}">
        <span>${esc(loc.title || loc.name)}</span>
        ${loc.type ? `<small>${esc(loc.type)}</small>` : loc.tags?.[0] ? `<small>${esc(loc.tags[0])}</small>` : ""}
      </button>`).join("") || `<div class="empty">尚無可顯示地點</div>`}</div>
  `;
}

function bindMapListEvents(locations) {
  $$('[data-day-key]').forEach((el) => el.addEventListener('click', () => {
    state.activeDay = Number.isNaN(Number(el.dataset.dayKey)) ? el.dataset.dayKey : Number(el.dataset.dayKey);
    state.activeDetailId = "";
    renderMapPanel();
  }));
  $$('[data-tag]').forEach((el) => el.addEventListener('click', () => {
    state.activeTag = el.dataset.tag;
    renderMapPanel();
  }));
  $$('[data-detail-id]').forEach((el) => el.addEventListener('click', () => {
    state.activeDetailId = el.dataset.detailId;
    focusLocation(el.dataset.detailId, locations);
    if (state.activeMapSub === "days" || state.activeMapSub === "all") renderMapList(locations, state.data.days || []);
  }));
  $$('[data-mapid]:not([data-detail-id])').forEach((el) => el.addEventListener('click', () => {
    focusMap(el.dataset.mapid, locations);
  }));
  $$('[data-map-day]').forEach((el) => el.addEventListener('click', () => {
    const firstOfDay = locations.find((loc) => String(loc.dayKey) === String(el.dataset.mapDay) && loc.hasMap);
    if (firstOfDay) focusMap(firstOfDay.id, locations);
  }));
}

function focusLocation(id, locations) {
  const loc = locations.find((x) => x.id === id);
  if (!loc) return;

  const frame = $("#mapFrame");
  const focus = $("#mapFocus");

  state.activeDetailId = id;
  if (loc.hasMap) {
    state.currentMapId = id;
    if (frame) frame.src = embedUrl(loc.url);
  } else {
    state.currentMapId = "";
    if (frame) frame.src = fallbackMapEmbedUrl();
  }

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
  const rows = [];
  for (let minute = 6 * 60; minute <= 24 * 60 + 30; minute += 30) {
    const h24 = Math.floor(minute / 60);
    const hh = String(h24 % 24).padStart(2, "0");
    const mm = String(minute % 60).padStart(2, "0");
    rows.push({ minute, label: `${hh}:${mm}`, half: mm === "30" });
  }
  return rows;
}

function schedulePeriodCell(rowIndex) {
  if (rowIndex === 0) return `<td class="period-cell period-morning" rowspan="14">早</td>`;
  if (rowIndex === 14) return `<td class="period-cell period-afternoon" rowspan="12">午</td>`;
  if (rowIndex === 26) return `<td class="period-cell period-night" rowspan="12">晚</td>`;
  return "";
}

function timeToMinute(value) {
  if (!nonEmpty(value)) return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  let h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || m < 0 || m > 59) return null;
  if (h < 6) h += 24;
  return h * 60 + m;
}

function buildScheduleMatrix(days, rows) {
  const start = rows[0]?.minute ?? 360;
  const last = rows[rows.length - 1]?.minute ?? 1470;
  return days.map((day) => {
    const cells = Array(rows.length).fill(null);
    (day.stops || []).forEach((stop) => {
      const minute = timeToMinute(stop.start_time || stop.time);
      if (minute === null || minute < start || minute > last) return;
      let row = Math.round((minute - start) / 30);
      if (row < 0 || row >= rows.length) return;
      while (row < rows.length && cells[row]?.covered) row += 1;
      if (row >= rows.length) return;
      const duration = typeof stop.duration_min === "number" && stop.duration_min > 0 ? stop.duration_min : 30;
      const span = Math.max(1, Math.min(rows.length - row, Math.ceil(duration / 30)));
      cells[row] = { stop, span };
      for (let i = 1; i < span; i += 1) cells[row + i] = { covered: true };
    });
    return cells;
  });
}

function renderScheduleCell(cell) {
  if (!cell) return `<td class="schedule-empty"></td>`;
  if (cell.covered) return "";
  const stop = cell.stop;
  const start = stop.start_time || stop.time || "";
  const end = stopEndTime(stop);
  const range = start && end ? `${start}–${end}` : start;
  return `
    <td class="schedule-stop-cell" rowspan="${cell.span}">
      <div class="schedule-stop-name">${esc(stop.name || stop.maps_label || "未命名行程")}</div>
      <div class="schedule-stop-time">${esc(range)}</div>
    </td>`;
}

function renderSchedulePanel() {
  const days = state.data.days || [];
  const rows = scheduleRows();
  const matrix = buildScheduleMatrix(days, rows);

  $("#panel").innerHTML = `
    <div class="schedule-card">
      <div class="schedule-scroll">
        <table class="schedule-table timeline-table" aria-label="旅遊時程表">
          <colgroup>
            <col class="col-period" />
            <col class="col-time" />
            ${days.map(() => `<col class="col-day" />`).join("")}
          </colgroup>
          <thead>
            <tr>
              <th class="period-head">時段</th>
              <th class="time-head">時刻</th>
              ${days.map((day, index) => `
                <th class="day-head">
                  <div class="day-head-label">${esc(dayLabel(day, index))}</div>
                  <div class="day-head-title">${esc(day.title || day.theme || "")}</div>
                </th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, rowIndex) => `
              <tr>
                ${schedulePeriodCell(rowIndex)}
                <td class="time-cell ${row.half ? "half" : "whole"}">${esc(row.label)}</td>
                ${days.map((_, dayIndex) => renderScheduleCell(matrix[dayIndex][rowIndex])).join("")}
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function reminderText(item) {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") return item.text || item.title || item.name || "";
  return String(item ?? "");
}

function renderReminderItem(item, index) {
  const text = reminderText(item);
  return `
    <div class="outline-item reminder-item">
      <span class="outline-num">${index + 1}</span>
      <span class="outline-name">${esc(text)}</span>
    </div>`;
}

function renderBudgetTabs(items) {
  const active = state.activeBudgetCategory || "__total__";
  return `
    <div class="budget-tabs">
      <button class="tag-filter-btn ${active === "__total__" ? "active" : ""}" data-budget-tag="__total__">Total</button>
      ${items.map((item) => `<button class="tag-filter-btn ${active === item.label ? "active" : ""}" data-budget-tag="${esc(item.label)}">${esc(item.label)}</button>`).join("")}
    </div>`;
}

function renderBudgetSummary(items) {
  const active = state.activeBudgetCategory || "__total__";
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  if (active === "__total__") {
    return `
      ${renderBudgetTabs(items)}
      <div class="budget-total-card">
        <div class="budget-summary-row"><strong>Total</strong><span>${formatMoney(total)}</span></div>
        ${items.map((item) => `<div class="details-row"><strong>${esc(item.label)}</strong><span>${formatMoney(item.value)}</span></div>`).join("")}
        <div class="summary-box"><div class="small">Details total</div><strong>${formatMoney(total)}</strong></div>
      </div>`;
  }
  const item = items.find((x) => x.label === active) || items[0];
  if (!item) return `<div class="empty">尚無預算資料</div>`;
  const details = Array.isArray(item.details) ? item.details : [];
  const value = Number(item.value || 0);
  const share = total ? Math.round((value / total) * 100) : 0;
  return `
    ${renderBudgetTabs(items)}
    <div class="budget-total-card">
      <div class="budget-summary-row"><strong>${esc(item.label)}</strong><span>${formatMoney(value)}</span></div>
      <div class="budget-bar"><div style="width:${Math.max(0, Math.min(100, share))}%"></div></div>
      <div class="small muted budget-share">Share: ${share}%</div>
      <div class="details-wrap">
        ${details.map((d) => `<div class="details-row"><strong>${esc(d.name || "細項")}</strong><span>${formatMoney(d.amount)}</span></div>`).join("") || `<div class="empty compact">沒有細項</div>`}
      </div>
      <div class="summary-box"><div class="small">Details total</div><strong>${formatMoney(value)}</strong></div>
    </div>`;
}

function renderRemindersPanel() {
  const reminders = state.data.reminders || [];
  const budgetItems = state.data.budget_items || [];
  if (!state.activeBudgetCategory) state.activeBudgetCategory = "__total__";
  $("#panel").innerHTML = `
    <div class="reminder-grid reminder-grid-two">
      <section class="info-card"><h2>行前提醒</h2><div class="outline-list reminder-list">${reminders.map(renderReminderItem).join("") || `<div class="empty">尚無提醒</div>`}</div></section>
      <section class="info-card"><h2>預算摘要</h2>${renderBudgetSummary(budgetItems)}</section>
    </div>
  `;
  $$('[data-budget-tag]').forEach((btn) => btn.addEventListener('click', () => {
    state.activeBudgetCategory = btn.dataset.budgetTag;
    renderRemindersPanel();
  }));
}

function renderReferenceItem(ref, index) {
  const url = ref.url || "#";
  return `
    <a class="outline-item reference-item" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
      <span class="outline-num">${index + 1}</span>
      <span class="outline-name">${esc(ref.title || ref.url || "參考網站")}</span>
      ${ref.type || ref.source ? `<span class="outline-type">${esc(ref.type || ref.source)}</span>` : ""}
    </a>`;
}

function renderReferencesPanel() {
  const refs = state.data.references || [];
  const shopRefs = (state.data.shops || []).filter((s) => s.link).map((s) => ({ title: s.name, url: s.link, source: normalizeTagName(s.tag || "資訊") }));
  const all = [...refs, ...shopRefs];
  $("#panel").innerHTML = `
    <section class="info-card reference-panel-card">
      <div class="card-head"><h2>參考網站</h2><span>${all.length} 筆</span></div>
      <div class="outline-list reference-list-itemized">
        ${all.map(renderReferenceItem).join("") || `<div class="empty">尚無參考網站</div>`}
      </div>
    </section>
  `;
}

function renderValidationError(errors) {
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = `<main class="wrap"><section class="validation-error"><h1>JSON 格式驗證失敗</h1><p>請先修正以下欄位：</p><pre>${esc(errors.join("\n"))}</pre></section></main>`;
}
