import { escapeHtml as esc, nonEmpty, embedUrl } from "./dom-helpers.js";
import { formatMoney } from "./formatters.js";

const DEFAULT_TILE_PROVIDER = {
  url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  options: {
    subdomains: "abcd",
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

let leafletLoadPromise = null;


export function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function defaultDayLabel(day, index) {
  return day?.label || `Day ${index + 1}`;
}

export function makeScheduleRows({ startMinute = 0, endMinute = 24 * 60, stepMinute = 60, formatMinute }) {
  const formatter = formatMinute || formatClockFromMinute;
  const rows = [];
  for (let minute = startMinute; minute < endMinute; minute += stepMinute) {
    rows.push({ minute, label: formatter(minute) });
  }
  return rows;
}

export function schedulePositionPercent(minute, { startMinute = 0, totalMinutes = 24 * 60 } = {}) {
  return ((minute - startMinute) / totalMinutes) * 100;
}

export function renderScheduleTimeLabelsHtml(rows, { startMinute = 0, totalMinutes = 24 * 60, endLabel = "23:59" } = {}) {
  return `
    ${rows.map((row, index) => `<div class="calendar-time-label ${index === 0 ? "calendar-time-label-start" : ""}" style="top:${schedulePositionPercent(row.minute, { startMinute, totalMinutes })}%">${esc(row.label)}</div>`).join("")}
    <div class="calendar-time-label calendar-time-label-end" style="top:100%">${esc(endLabel)}</div>
  `;
}

export function renderSchedulePanel(options = {}) {
  const {
    days = [],
    rows = [],
    totalMinutes = 24 * 60,
    startMinute = 0,
    cardClass = "",
    toolbarHtml = "",
    cornerHtml = "",
    modalHostHtml = "",
    dayOffset = 0,
    dayHeadClass = "",
    dayHeadTag = "div",
    dayHeadAttrs = () => "",
    dayLabel = defaultDayLabel,
    dayColClass = "",
    dayColAttrs = (_day, index) => `data-calendar-day="${index}"`,
    eventClass = "",
    getEvents = () => [],
    eventAttrs = () => "",
    eventLabel = (ev) => ev?.stop?.name || ev?.stop?.maps_label || "未命名行程",
    eventTime = () => "",
    positionPercent = (minute) => schedulePositionPercent(minute, { startMinute, totalMinutes }),
  } = options;

  return `
    <div class="calendar-schedule-card ${esc(cardClass)}">
      ${toolbarHtml}
      ${renderCalendar({
        days,
        rows,
        totalMinutes,
        startMinute,
        cornerHtml,
        dayOffset,
        dayHeadClass,
        dayHeadTag,
        dayHeadAttrs,
        dayLabel,
        dayColClass,
        dayColAttrs,
        eventClass,
        getEvents,
        eventAttrs,
        eventLabel,
        eventTime,
        positionPercent,
      })}
      ${modalHostHtml}
    </div>
  `;
}

export function renderCalendar(options = {}) {
  const {
    days = [],
    rows = [],
    totalMinutes = 24 * 60,
    startMinute = 0,
    cornerHtml = "",
    dayOffset = 0,
    dayHeadClass = "",
    dayHeadTag = "div",
    dayHeadAttrs = () => "",
    dayLabel = defaultDayLabel,
    dayColClass = "",
    dayColAttrs = (_day, index) => `data-calendar-day="${index}"`,
    eventClass = "",
    getEvents = () => [],
    eventAttrs = () => "",
    eventLabel = (ev) => ev?.stop?.name || ev?.stop?.maps_label || "未命名行程",
    eventTime = () => "",
    positionPercent = (minute) => schedulePositionPercent(minute, { startMinute, totalMinutes }),
  } = options;
  const HeadTag = dayHeadTag === "button" ? "button" : "div";

  return `
    <div class="calendar-scroll">
      <div class="calendar-grid" style="--day-count:${days.length};">
        <div class="calendar-corner">${cornerHtml}</div>
        ${days.map((day, index) => {
          const absoluteIndex = dayOffset + index;
          const attrs = dayHeadAttrs(day, absoluteIndex, index);
          const type = HeadTag === "button" ? ' type="button"' : "";
          return `
            <${HeadTag} class="calendar-day-head ${esc(dayHeadClass)}"${type}${attrs ? ` ${attrs}` : ""}>
              <strong>${esc(dayLabel(day, absoluteIndex))}</strong>
            </${HeadTag}>
          `;
        }).join("")}
        <div class="calendar-time-col">
          ${renderScheduleTimeLabelsHtml(rows, { startMinute, totalMinutes })}
        </div>
        ${days.map((day, index) => {
          const absoluteIndex = dayOffset + index;
          return `
            <div class="calendar-day-col ${esc(dayColClass)}" ${dayColAttrs(day, absoluteIndex, index)}>
              ${rows.map((row) => `<div class="calendar-hour-line" style="top:${positionPercent(row.minute)}%"></div>`).join("")}
              ${rows.map((row) => `<div class="calendar-half-line" style="top:${positionPercent(row.minute + 30)}%"></div>`).join("")}
              ${getEvents(day, absoluteIndex, index).map((ev) => renderScheduleEvent(ev, {
                totalMinutes,
                eventClass,
                eventAttrs,
                eventLabel,
                eventTime,
              })).join("")}
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderScheduleEvent(ev, options) {
  const {
    totalMinutes,
    eventClass,
    eventAttrs,
    eventLabel,
    eventTime,
  } = options;
  const top = Number(ev?.top) || 0;
  const height = Number(ev?.height) || 0;
  const compactClass = height < (45 / totalMinutes) * 100 ? " calendar-event-compact" : "";
  const styleParts = [`top:${top}%`, `height:${height}%`];
  if (ev.left !== undefined) styleParts.push(`left:calc(${ev.left}% + ${Number(ev.laneGap || 0)}px)`);
  if (ev.width !== undefined) styleParts.push(`width:calc(${ev.width}% - ${Number(ev.laneGap || 0) * 2}px)`);
  const time = eventTime(ev);

  return `
    <button class="calendar-event ${esc(eventClass)} ${esc(ev.typeClass || "")}${compactClass}" type="button"
      ${eventAttrs(ev)}
      style="${styleParts.join(";")};">
      <span class="calendar-event-name">${esc(eventLabel(ev))}</span>
      ${time ? `<span class="calendar-event-time">${esc(time)}</span>` : ""}
    </button>
  `;
}

export function formatClockFromMinute(minute) {
  if (!Number.isFinite(minute)) return "";
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function durationLabel(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return "";
  const h = Math.floor(value / 60);
  const m = value % 60;
  return [h ? `${h} 小時` : "", m ? `${m} 分` : ""].filter(Boolean).join(" ") || `${value} 分`;
}

export function priceLabel(price, dataOrDefaults = {}) {
  if (!price) return "";
  if (typeof price === "string") return price;
  if (price.kind === "text") return price.text || "";
  if (price.kind === "free") return "免費";

  const defaults = dataOrDefaults?.defaults || dataOrDefaults || {};
  const currency = defaults.currency || "TWD";
  const locale = defaults.locale || "zh-TW";
  const defaultUnit = defaults.price_unit || "per_person";
  const unitKey = price.unit || defaultUnit;
  const unit = unitKey === "per_night" ? " / 晚" : unitKey === "per_group" ? " / 組" : unitKey === "none" ? "" : " / 人";

  const toNumber = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    if (value === "" || value == null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const min = toNumber(price.min);
  const max = toNumber(price.max);
  const amount = toNumber(price.amount) ?? min;

  if ((price.kind === "fixed" || (!price.kind && min !== undefined && max === undefined)) && amount !== undefined) return `${formatMoney(amount, currency, locale)}${unit}`;
  if (price.kind === "range" || min !== undefined || max !== undefined) {
    const left = min !== undefined ? formatMoney(min, currency, locale) : "";
    const right = max !== undefined ? formatMoney(max, currency, locale) : "";
    return [left, right].filter(Boolean).join(" - ") + unit;
  }
  return "";
}

export function formatTripMoney(value, dataOrDefaults = {}) {
  const defaults = dataOrDefaults?.defaults || dataOrDefaults || {};
  return formatMoney(value, defaults.currency || "TWD", defaults.locale || "zh-TW");
}

export function renderDetailCard(loc, options = {}) {
  const {
    activeId = "",
    googleMapsUrl = "",
    mapFocus = false,
    extraClass = "",
    includeMissingNote = false,
  } = options;
  const source = loc?.stop || loc || {};
  const tags = (loc?.tags || []).filter((tag) => tag !== "重點" && tag !== loc?.type);
  const address = addressTextForMap(loc?.address) || addressTextForMap(source.address);
  const note = loc?.note || source.note || "";
  return `
    <article class="detail-card ${mapFocus ? "map-focus-detail" : ""} ${extraClass} ${String(loc?.id) === String(activeId) ? "active-map" : ""}" data-detail-id="${esc(loc?.id || "")}"${loc?.hasMap ? ` data-mapid="${esc(loc.id)}"` : ""}>
      <header class="detail-header">
        <div class="detail-title-row">
          <h2>${esc(loc?.name || source.name || "未命名行程")}</h2>
          ${googleMapsUrl ? `<a class="btn secondary detail-map-btn" href="${esc(googleMapsUrl)}" target="_blank" rel="noopener noreferrer">開啟 Google Maps</a>` : ""}
        </div>
      </header>
      ${(loc?.timeRange || loc?.duration || loc?.price) ? `<div class="detail-meta detail-secondary-meta">
        ${loc.timeRange ? `<span class="time-pill">${esc(loc.timeRange)}</span>` : ""}
        ${loc.duration ? `<span class="time-pill">${esc(loc.duration)}</span>` : ""}
        ${loc.price ? `<span class="pill price-pill">${esc(loc.price)}</span>` : ""}
      </div>` : ""}
      ${tags.length ? `<div class="tag-list">${tags.map((tag) => `<span class="tag-chip">${esc(tag)}</span>`).join("")}</div>` : ""}
      ${address ? `<div class="addr-box"><div class="small muted">地址</div><div>${esc(address)}</div></div>` : ""}
      ${note ? `<p class="detail-note">${esc(note)}</p>` : ""}
      ${includeMissingNote && !loc?.hasMap ? `<div class="map-missing-note">此活動尚未填入地址、地圖連結或座標。</div>` : ""}
    </article>
  `;
}

function addressTextForMap(address) {
  if (!address) return "";
  if (typeof address === "string") return address;
  return address.full || address.short || address.name || "";
}

export function renderMapFocus(loc, options = {}) {
  return renderDetailCard(loc, { ...options, mapFocus: true });
}

export function mapCenterFromTripData(data, fallback, options = {}) {
  const { includeRootLatLng = false, defaultZoom = fallback?.zoom || 13 } = options;
  const center = data?.defaults?.map_center;
  const zoom = Number(data?.defaults?.map_zoom ?? data?.defaults?.zoom ?? defaultZoom);
  const normalizedZoom = Number.isFinite(zoom) ? zoom : defaultZoom;
  const lat = Number(center?.lat);
  const lng = Number(center?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, zoom: normalizedZoom };
  if (includeRootLatLng) {
    const rootLat = Number(data?.lat);
    const rootLng = Number(data?.lng);
    if (Number.isFinite(rootLat) && Number.isFinite(rootLng)) return { lat: rootLat, lng: rootLng, zoom: normalizedZoom };
  }
  return fallback;
}

export function renderScheduleDetailModal(detail = {}) {
  const {
    title = "未命名行程",
    subtitle = "",
    timeRange = "",
    duration = "",
    price = "",
    address = "",
    note = "",
    next = "",
    googleMapsUrl = "",
    labelledBy = "scheduleModalTitle",
  } = detail;
  return `
    <div class="schedule-modal" role="dialog" aria-modal="true" aria-labelledby="${esc(labelledBy)}">
      <button class="schedule-modal-backdrop" type="button" aria-label="關閉行程詳細內容"></button>
      <article class="schedule-modal-card schedule-detail-modal detail-card map-focus-detail">
        <button class="schedule-modal-close" type="button" aria-label="關閉"><img src="/assets/icon/cross.svg" alt=""></button>
        <header class="detail-header">
          <div class="detail-title-row schedule-detail-title-row">
            <div>
              ${subtitle ? `<div class="small muted">${esc(subtitle)}</div>` : ""}
              <h2 id="${esc(labelledBy)}">${esc(title)}</h2>
            </div>
            ${googleMapsUrl ? `<a class="btn secondary detail-map-btn schedule-detail-map-btn" href="${esc(googleMapsUrl)}" target="_blank" rel="noopener noreferrer">開啟 Google Maps</a>` : ""}
          </div>
        </header>
        ${(timeRange || duration || price) ? `<div class="detail-meta detail-secondary-meta schedule-detail-meta">
          ${timeRange ? `<span class="time-pill">${esc(timeRange)}</span>` : ""}
          ${duration ? `<span class="pill">${esc(duration)}</span>` : ""}
          ${price ? `<span class="pill price-pill">${esc(price)}</span>` : ""}
        </div>` : ""}
        <div class="schedule-modal-body">
          ${address ? `<div class="addr-box"><div class="small muted">地址</div><div>${esc(address)}</div></div>` : ""}
          ${note ? `<p class="detail-note">${esc(note)}</p>` : ""}
          ${next ? `<p class="detail-note"><span class="small muted">下一站</span><br>${esc(next)}</p>` : ""}
        </div>
      </article>
    </div>
  `;
}

export function tagsForMapStop(stop, normalizeTag = (tag) => String(tag || "").trim()) {
  const tags = [];
  if (Array.isArray(stop?.tags)) tags.push(...stop.tags);
  if (stop?.type) tags.push(stop.type);
  if (stop?.highlight) tags.push("重點");
  return Array.from(new Set(tags.map(normalizeTag).filter(Boolean)));
}

export function collectDayMapLocations(days = [], options = {}) {
  const {
    idForStop = (day, dayIndex, stop, stopIndex) => `day-${dayIndex}-stop-${stopIndex}`,
    dayLabel = defaultDayLabel,
    dayTitle = (day, index) => day?.title || day?.theme || dayLabel(day, index),
    nameForStop = (stop) => stop?.name || stop?.maps_label || "未命名活動",
    titleForStop = (stop) => stop?.maps_label || stop?.name || "",
    typeForStop = (stop) => stop?.type || "",
    timeRangeForStop = () => "",
    durationForStop = (stop) => stop?.duration || "",
    priceForStop = (stop) => stop?.price || "",
    addressForStop = (stop) => stop?.address?.full || stop?.address || "",
    urlForStop = (stop) => stop?.map || "",
    latLngForStop = latLngForItem,
    hasMapForStop = (stop, latLng, address) => Boolean(latLng || stop?.map || address),
    tagsForStop = tagsForMapStop,
    subtitleForStop = (stop, loc) => [loc.timeRange, loc.type, loc.price].filter(Boolean).join("｜"),
    extraForStop = () => ({}),
  } = options;

  return (days || []).flatMap((day, dayIndex) => (day?.stops || []).map((stop, stopIndex) => {
    const latLng = latLngForStop(stop, day, dayIndex, stopIndex);
    const address = addressForStop(stop, day, dayIndex, stopIndex);
    const hasMap = hasMapForStop(stop, latLng, address, day, dayIndex, stopIndex);
    const loc = {
      id: idForStop(day, dayIndex, stop, stopIndex),
      source: "day",
      day,
      dayIndex,
      dayKey: day?.key,
      dayLabel: dayLabel(day, dayIndex),
      dayTitle: dayTitle(day, dayIndex),
      stop,
      stopIndex,
      order: stopIndex + 1,
      title: titleForStop(stop, day, dayIndex, stopIndex),
      name: nameForStop(stop, day, dayIndex, stopIndex),
      type: typeForStop(stop, day, dayIndex, stopIndex),
      timeRange: timeRangeForStop(stop, day, dayIndex, stopIndex),
      duration: durationForStop(stop, day, dayIndex, stopIndex),
      price: priceForStop(stop, day, dayIndex, stopIndex),
      address,
      url: urlForStop(stop, day, dayIndex, stopIndex),
      latLng,
      tags: tagsForStop(stop, day, dayIndex, stopIndex),
      hasMap,
      hasCoords: Boolean(latLng),
    };
    return { ...loc, subtitle: subtitleForStop(stop, loc, day, dayIndex, stopIndex), ...extraForStop(stop, loc, day, dayIndex, stopIndex) };
  }));
}

export function allMapTags(locations = []) {
  return Array.from(new Set((locations || []).flatMap((loc) => loc.tags || []))).filter(Boolean);
}

export function filterMapLocationsByTag(locations = [], activeTag = "__all__") {
  if (activeTag === "__all__") return locations;
  return locations.filter((loc) => (loc.tags || []).includes(activeTag) || loc.type === activeTag);
}

export function isFavoriteMapLocation(loc) {
  const type = String(loc?.type || "");
  return Boolean(loc?.stop?.highlight || loc?.highlight || type === "餐飲" || type === "活動" || type === "景點");
}

export function visibleMapLocations(locations = [], options = {}) {
  const {
    activeSub = "days",
    activeDayKey = "",
    activeTag = "__all__",
    favoritePredicate = isFavoriteMapLocation,
  } = options;
  if (activeSub === "days") return locations.filter((loc) => String(loc.dayKey) === String(activeDayKey));
  const source = locations.filter((loc) => loc.hasMap && favoritePredicate(loc));
  return filterMapLocationsByTag(source, activeTag);
}

export function renderMapPanelShell(options = {}) {
  const {
    activeSub = "days",
    layoutClass = "",
    mapCanvasId = "mapCanvas",
    mapFrameId = "mapFrame",
    leafletMapId = "leafletMap",
    focusId = "mapFocus",
    listHtml = "",
    focusHtml = "",
    frameSrc = "",
    subAttr = "data-map-sub",
  } = options;
  return `
    <div class="map-layout ${esc(layoutClass)}">
      <aside class="map-side">
        <div class="sub-tabs" id="mapSubTabs">
          <button class="sub-tab ${activeSub === "days" ? "active" : ""}" type="button" ${subAttr}="days">每日行程</button>
          <button class="sub-tab ${activeSub === "saved" ? "active" : ""}" type="button" ${subAttr}="saved">收藏夾</button>
        </div>
        <div id="mapList">${listHtml}</div>
      </aside>
      <section class="map-frame-card">
        <div class="map-canvas" id="${esc(mapCanvasId)}" data-mode="iframe">
          <iframe id="${esc(mapFrameId)}" title="地圖預覽" src="${esc(frameSrc)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
          <div id="${esc(leafletMapId)}" aria-label="行程地圖"></div>
        </div>
        <div class="map-focus" id="${esc(focusId)}">${focusHtml}</div>
      </section>
    </div>
  `;
}

export function renderMapListHtml(locations = [], options = {}) {
  const { activeSub = "days" } = options;
  if (activeSub === "days") return renderDailyMapList(locations, options);
  return renderFavoriteMapPlaces(locations, options);
}

export function renderDailyMapList(locations = [], options = {}) {
  const {
    days = [],
    activeDayKey = "",
    activeId = "",
    mapMode = "single",
    mapDayKey = "",
    dayLabel = defaultDayLabel,
    dayTitle = (day, index) => day?.title || day?.theme || dayLabel(day, index),
    dayTabAttr = "data-map-day-key",
    dayRouteAttr = "data-map-day-route",
    editDayAttr = "",
    editableDay = false,
  } = options;
  const activeDay = days.find((day) => String(day.key) === String(activeDayKey)) || days[0];
  if (!activeDay) return `<div class="empty">尚無每日行程</div>`;
  const dayIndex = days.findIndex((day) => day === activeDay);
  const dayLocations = locations.filter((loc) => String(loc.dayKey) === String(activeDay.key));
  const titleHtml = editableDay
    ? `<button class="trip-plan-day-edit" type="button" ${editDayAttr}="${dayIndex}"><strong>${esc(dayTitle(activeDay, dayIndex))}</strong></button>`
    : `<h2>${esc(dayTitle(activeDay, dayIndex))}</h2>`;
  return `
    <div class="day-tabs">
      ${days.map((day, index) => `
        <button class="day-tab ${String(day.key) === String(activeDay.key) ? "active" : ""}" type="button" ${dayTabAttr}="${esc(day.key)}">
          ${esc(dayLabel(day, index))}
        </button>
      `).join("")}
    </div>
    <section class="day-summary-card">
      <header class="detail-header">
        <div class="detail-title-row">
          ${titleHtml}
          <button class="btn secondary detail-map-btn map-all-day-btn ${mapMode === "day" && String(mapDayKey) === String(activeDay.key) ? "active" : ""}" type="button" ${dayRouteAttr}="${esc(activeDay.key)}">${mapMode === "day" && String(mapDayKey) === String(activeDay.key) ? "已顯示全日路徑" : "顯示全日路徑"}</button>
        </div>
      </header>
      ${activeDay.theme ? `<p>${esc(activeDay.theme)}</p>` : ""}
      ${activeDay.hero ? `<span class="time-pill">重點：${esc(activeDay.hero)}</span>` : ""}
      <div class="outline-block">
        <div class="outline-title">本日行程（${dayLocations.length}）</div>
        <div class="outline-list">
          ${dayLocations.map((loc, index) => renderMapOutlineItem(loc, index, { ...options, activeId })).join("") || `<div class="empty compact"></div>`}
        </div>
      </div>
    </section>
  `;
}

export function renderFavoriteMapPlaces(locations = [], options = {}) {
  const favoritePredicate = options.favoritePredicate || isFavoriteMapLocation;
  const tags = options.favoriteTags || allMapTags(locations.filter((loc) => loc.hasMap && favoritePredicate(loc))).filter((tag) => tag !== "重點" && tag !== "全部");
  const places = visibleMapLocations(locations, options);
  return `
    ${renderMapTagFilter(tags, options)}
    <div class="favorite-list">
      ${places.map((loc, index) => renderMapPlaceItem(loc, index, options)).join("") || `<div class="empty"></div>`}
    </div>
    ${options.afterListHtml || ""}
  `;
}

export function renderMapTagFilter(tags = [], options = {}) {
  const { activeTag = "__all__", tagAttr = "data-map-tag", showAll = true } = options;
  const cleanTags = Array.from(new Set(tags.filter(Boolean)));
  if (!cleanTags.length && !showAll) return "";
  return `
    <div class="tag-filter">
      ${showAll ? `<button class="tag-filter-btn ${activeTag === "__all__" ? "active" : ""}" type="button" ${tagAttr}="__all__">全部</button>` : ""}
      ${cleanTags.map((tag) => `<button class="tag-filter-btn ${activeTag === tag ? "active" : ""}" type="button" ${tagAttr}="${esc(tag)}">${esc(tag)}</button>`).join("")}
    </div>
  `;
}

export function renderMapPlaceItem(loc, index, options = {}) {
  const { activeId = "", detailAttr = "data-detail-id", mapIdAttr = "data-map-id", typeClass = scheduleEventTypeClass } = options;
  const disabled = !loc.hasMap;
  return `
    <button class="outline-item map-place-item ${String(loc.id) === String(activeId) ? "active active-map" : ""} ${disabled ? "route-disabled" : ""}" type="button"${disabled ? "" : ` ${detailAttr}="${esc(loc.id)}" ${mapIdAttr}="${esc(loc.id)}"`} ${disabled ? `aria-disabled="true"` : ""}>
      <span class="outline-num">${index + 1}</span>
      <span class="outline-name">${esc(loc.title || loc.name)}</span>
      ${renderMapTypeLabel(loc.type || loc.tags?.[0], typeClass)}
    </button>
  `;
}

export function renderMapOutlineItem(loc, index, options = {}) {
  const { activeId = "", detailAttr = "data-detail-id", mapIdAttr = "data-map-id", typeClass = scheduleEventTypeClass, mapMode = "single", mapDayKey = "" } = options;
  const disabled = !loc.hasMap || (mapMode === "day" && String(mapDayKey) === String(loc.dayKey) && !loc.hasCoords);
  return `
    <button class="outline-item ${String(loc.id) === String(activeId) ? "active active-map" : ""} ${disabled ? "route-disabled" : ""}" type="button"${disabled ? "" : ` ${detailAttr}="${esc(loc.id)}" ${mapIdAttr}="${esc(loc.id)}"`} ${disabled ? `aria-disabled="true"` : ""}>
      <span class="outline-num">${esc(loc.order || index + 1)}</span>
      ${loc.timeRange ? `<span class="outline-time">${esc(loc.timeRange)}</span>` : ""}
      <span class="outline-name">${esc(loc.name)}</span>
      ${renderMapTypeLabel(loc.type, typeClass)}
    </button>
  `;
}

export function renderMapTypeLabel(value, typeClass = scheduleEventTypeClass) {
  const label = String(value || "").trim();
  if (!label) return "";
  return `<span class="outline-type ${esc(typeClass(label))}">${esc(label)}</span>`;
}

export function reminderText(item) {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") return item.text || item.title || item.name || "";
  return String(item ?? "");
}

export function renderReminderListHtml(reminders = [], options = {}) {
  const {
    editable = false,
    editAttr = "data-edit-reminder",
    deleteAttr = "data-remove-reminder",
    addAttr = "data-add-reminder",
    editIcon = "/assets/icon/document-edit.svg",
    deleteIcon = "/assets/icon/cross.svg",
    addIcon = "/assets/icon/plus.svg",
    emptyText = "尚無提醒",
    addLabel = "新增提醒",
  } = options;
  const rows = (reminders || []).map((item, index) => {
    const text = reminderText(item) || "未命名提醒";
    return `
      <div class="reminder-details-row">
        <strong>${esc(text)}</strong>
        ${editable ? `<span class="reminder-row-actions">
          <button class="icon-action" type="button" ${editAttr}="${index}" aria-label="修改提醒"><img src="${esc(editIcon)}" alt=""></button>
          <button class="icon-action danger" type="button" ${deleteAttr}="${index}" aria-label="刪除提醒"><img src="${esc(deleteIcon)}" alt=""></button>
        </span>` : ""}
      </div>
    `;
  }).join("");
  const addRow = editable ? `
    <button class="reminder-details-row reminder-add-row" type="button" ${addAttr}>
      ${addLabel ? `<strong>${esc(addLabel)}</strong>` : ""}
      <span class="icon-action add"><img src="${esc(addIcon)}" alt=""></span>
    </button>
  ` : "";

  return `
    <div class="budget-total-card reminder-total-card">
      <div class="reminder-details-wrap">
        ${rows || `<div class="empty compact">${esc(emptyText)}</div>`}
        ${addRow}
      </div>
    </div>
  `;
}

export function renderBudgetSummaryHtml(items = [], options = {}) {
  const {
    activeCategory = "__total__",
    tabAttr = "data-budget-tag",
    formatCurrency = (value) => String(value ?? ""),
    detailAmount = (detail) => detail?.amount ?? detail?.price ?? 0,
    detailLabel = (detail) => detail?.name || "細項",
    detailValue = (detail) => formatCurrency(detailAmount(detail)),
    editable = false,
    editAttr = "data-budget-index",
    editLabel = (item) => `編輯${item?.label || ""}預算`,
    emptyText = "沒有細項",
  } = options;
  const list = Array.isArray(items) ? items : [];
  const active = activeCategory || "__total__";
  const total = list.reduce((sum, item) => sum + Number(item?.value || 0), 0);
  const tabs = `
    <div class="budget-tabs">
      <button class="tag-filter-btn ${active === "__total__" ? "active" : ""}" type="button" ${tabAttr}="__total__">Total</button>
      ${list.map((item) => `<button class="tag-filter-btn ${active === item.label ? "active" : ""}" type="button" ${tabAttr}="${esc(item.label)}">${esc(item.label)}</button>`).join("")}
    </div>
  `;

  if (active === "__total__" || !list.length) {
    return `
      ${tabs}
      <div class="budget-total-card">
        <div class="budget-summary-row"><strong>Total</strong><span>${formatCurrency(total)}</span></div>
        ${list.map((item) => `<div class="details-row"><strong>${esc(item.label)}</strong><span>${formatCurrency(item.value || 0)}</span></div>`).join("") || `<div class="empty compact">${esc(emptyText)}</div>`}
      </div>
    `;
  }

  const item = list.find((budgetItem) => budgetItem.label === active) || list[0];
  const index = list.indexOf(item);
  const value = Number(item?.value || 0);
  const share = total ? Math.round((value / total) * 100) : 0;
  const details = Array.isArray(item?.details) ? item.details : [];
  return `
    ${tabs}
    <div class="budget-total-card">
      <div class="budget-summary-row"><strong>${esc(item.label)}</strong><span>${formatCurrency(value)}</span></div>
      <div class="budget-bar"><div style="width:${Math.max(0, Math.min(100, share))}%"></div></div>
      <div class="small muted budget-share">Share: ${share}%</div>
      <div class="details-wrap">
        ${details.map((detail) => `<div class="details-row"><strong>${esc(detailLabel(detail))}</strong><span>${esc(detailValue(detail))}</span></div>`).join("") || `<div class="empty compact">${esc(emptyText)}</div>`}
      </div>
      ${editable ? `<button class="btn secondary trip-plan-budget-edit-action" type="button" ${editAttr}="${index}">${esc(editLabel(item, index))}</button>` : ""}
    </div>
  `;
}

export function renderReminderDashboardHtml(options = {}) {
  const {
    reminders = [],
    reminderTitle = "行前提醒",
    reminderHtml = "",
    budgetTitle = "預算摘要",
    budgetHtml = "",
    editableReminders = false,
    reminderOptions = {},
    sectionClass = "info-card",
  } = options;
  const cardHead = (title) => `<div class="card-head"><h2>${esc(title)}</h2></div>`;
  return `
    <div class="reminder-grid reminder-grid-two">
      <section class="${esc(sectionClass)}">
        ${sectionClass.includes("trip-plan-section-card") ? cardHead(reminderTitle) : `<h2>${esc(reminderTitle)}</h2>`}
        ${reminderHtml || renderReminderListHtml(reminders, { editable: editableReminders, ...reminderOptions })}
      </section>
      <section class="${esc(sectionClass)}">
        ${sectionClass.includes("trip-plan-section-card") ? cardHead(budgetTitle) : `<h2>${esc(budgetTitle)}</h2>`}
        ${budgetHtml}
      </section>
    </div>
  `;
}

export function renderTripShellHtml(options = {}) {
  const {
    data = {},
    activeMain = "",
    kicker = "Travel Plan",
    title = data.title || "",
    subtitle = data.subtitle || data.summary || "",
    tags = data.tags || [],
    tabs = [],
    meta = [],
    heroActionsHtml = "",
    panelId = "panel",
    navLabel = "旅遊資訊分頁",
    afterPanelHtml = "",
  } = options;
  return `
    <div class="mobile-topbar">
      <button class="mobile-menu-btn" type="button" aria-label="切換選單">☰</button>
      <strong>${esc(title)}</strong>
    </div>
    <main class="wrap">
      <section class="hero">
        <div>
          <div class="kicker">${esc(kicker)}</div>
          <h1 id="title">${esc(title)}</h1>
          <p id="subtitle">${esc(subtitle)}</p>
          <div class="tags" id="tags">${tags.map((tag) => `<span class="badge">${esc(tag)}</span>`).join("")}</div>
          ${heroActionsHtml}
        </div>
        <div class="meta">
          ${meta.map((item) => `<div class="box"><span>${esc(item.label)}</span><strong>${esc(item.value ?? "-")}</strong></div>`).join("")}
        </div>
      </section>

      <nav class="main-tabs" id="mainTabs" aria-label="${esc(navLabel)}">
        ${tabs.map((tab) => `<button class="main-tab ${String(activeMain) === String(tab.key) ? "active" : ""}" data-main="${esc(tab.key)}">${esc(tab.label)}</button>`).join("")}
      </nav>

      <section class="panel" id="${esc(panelId)}"></section>
      ${afterPanelHtml}
    </main>
  `;
}

export function bindMainTabControls(options = {}) {
  const {
    tabSelector = ".main-tab",
    menuSelector = ".mobile-menu-btn",
    tabsContainerSelector = "#mainTabs",
    activeClass = "active",
    onChange = () => {},
    updateActiveClass = true,
    rerenderOnChange = false,
  } = options;
  document.querySelectorAll(tabSelector).forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.main;
      if (updateActiveClass && !rerenderOnChange) {
        document.querySelectorAll(tabSelector).forEach((item) => item.classList.toggle(activeClass, item === button));
      }
      onChange(key, button);
      if (window.matchMedia("(max-width: 700px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  document.querySelector(menuSelector)?.addEventListener("click", () => {
    document.querySelector(tabsContainerSelector)?.classList.toggle("open");
  });
}

export function renderGoogleMapFrame(options = {}) {
  const {
    frameId = "mapFrame",
    url = "",
    fallbackUrl = "",
    setCanvasMode = () => {},
    resetMap = () => {},
    shouldEmbed = true,
  } = options;
  setCanvasMode("iframe");
  resetMap();
  const frame = document.getElementById(frameId);
  if (!frame) return;
  const value = nonEmpty(url) ? String(url) : fallbackUrl;
  frame.src = shouldEmbed && !/[?&]output=embed\b/.test(value) ? embedUrl(value) : value;
}

export function referenceTitle(ref) {
  return ref?.title || ref?.name || ref?.url || "參考網站";
}

export function renderReferencesPanel(references = [], options = {}) {
  const {
    editable = false,
    editAttr = "data-edit-reference",
    deleteAttr = "data-remove-reference",
    addAttr = "data-add-reference",
    editIcon = "/assets/icon/document-edit.svg",
    deleteIcon = "/assets/icon/cross.svg",
    addIcon = "/assets/icon/plus.svg",
    emptyText = "尚無參考網站",
    addLabel = "",
    typeClass = scheduleEventTypeClass,
    showCount = false,
  } = options;
  const refs = references || [];
  const rows = refs.map((ref, index) => {
    const title = referenceTitle(ref);
    const type = ref?.type || ref?.source || "";
    const url = ref?.url || "#";
    const content = `
      <strong>${esc(title)}</strong>
      <span class="reference-row-type">${type ? renderMapTypeLabel(type, typeClass) : ""}</span>
    `;
    return editable ? `
      <div class="reference-details-row">
        <span class="reference-row-main">${content}</span>
        <span class="reference-row-actions">
          <button class="icon-action" type="button" ${editAttr}="${index}" aria-label="修改參考網站"><img src="${esc(editIcon)}" alt=""></button>
          <button class="icon-action danger" type="button" ${deleteAttr}="${index}" aria-label="刪除參考網站"><img src="${esc(deleteIcon)}" alt=""></button>
        </span>
      </div>
    ` : `
      <a class="reference-details-row reference-link-row" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
        <span class="reference-row-main">${content}</span>
      </a>
    `;
  }).join("");
  const addRow = editable ? `
    <button class="reference-details-row reference-add-row" type="button" ${addAttr}>
      ${addLabel ? `<strong>${esc(addLabel)}</strong>` : ""}
      <span class="icon-action add"><img src="${esc(addIcon)}" alt=""></span>
    </button>
  ` : "";

  return `
    <section class="info-card reference-panel-card">
      ${showCount ? `<div class="card-head"><span>${refs.length} 筆</span></div>` : ""}
      <div class="budget-total-card reference-total-card">
        <div class="reference-details-wrap">
          ${rows || `<div class="empty compact">${esc(emptyText)}</div>`}
          ${addRow}
        </div>
      </div>
    </section>
  `;
}

export function scheduleEventTypeClass(type) {
  const normalized = String(type || "").trim();
  const classes = {
    "交通": "event-type-transport",
    "住宿": "event-type-stay",
    "餐飲": "event-type-food",
    "美食": "event-type-food",
    "咖啡廳": "event-type-food",
    "活動": "event-type-activity",
    "景點": "event-type-activity",
    "自由活動": "event-type-activity",
    "購物": "event-type-other",
  };
  return classes[normalized] || "event-type-other";
}

export function parseLatLngFromText(text) {
  if (!nonEmpty(text)) return null;
  const value = String(text);
  const patterns = [
    /[?&](?:q|query)=(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/i,
    /@(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/i,
    /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/i,
    /(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}

export function latLngForItem(item) {
  const lat = Number(item?.lat);
  const lng = Number(item?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return parseLatLngFromText(item?.map) || parseLatLngFromText(item?.url) || parseLatLngFromText(item?.address?.full || item?.address || "");
}

export function leafletReady() {
  return typeof window !== "undefined" && window.L && typeof window.L.map === "function";
}

export function ensureLeafletLoaded() {
  if (leafletReady()) return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;
  leafletLoadPromise = new Promise((resolve, reject) => {
    if (typeof document === "undefined") { reject(new Error("document unavailable")); return; }
    if (!document.querySelector('link[data-trip-leaflet-css]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.dataset.tripLeafletCss = "1";
      document.head.appendChild(link);
    }
    const existing = document.querySelector('script[data-trip-leaflet-js]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.defer = true;
    script.dataset.tripLeafletJs = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Leaflet 載入失敗"));
    document.head.appendChild(script);
  });
  return leafletLoadPromise;
}

export function numberedIcon(number, extraClass = "") {
  if (!leafletReady()) return undefined;
  return L.divIcon({
    className: "trip-div-icon",
    html: `<div class="num-marker ${extraClass}"><span>${esc(number)}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30],
  });
}

export function renderLeafletLocationsShared(locations, options = {}, config = {}) {
  const {
    mapElementId = "leafletMap",
    frameElementId = "mapFrame",
    loadingText = "地圖載入中…",
    tileProvider = DEFAULT_TILE_PROVIDER,
    getMap,
    setMap,
    defaultMapCenter = () => ({ lat: 23.6978, lng: 120.9605, zoom: 13 }),
    setCanvasMode = () => {},
    resetMap = () => {
      const map = getMap?.();
      if (map) {
        try { map.remove(); } catch {}
        setMap?.(null);
      }
    },
    onLoadError = () => {},
    onMarkerClick = () => {},
    popupIcon = true,
    centerPanSelected = false,
  } = config;

  const mapEl = document.getElementById(mapElementId);
  const frame = document.getElementById(frameElementId);
  if (!mapEl) return false;

  const points = (locations || [])
    .map((loc, sourceIndex) => ({ ...loc, __sourceIndex: sourceIndex }))
    .filter((loc) => loc.latLng && Number.isFinite(Number(loc.latLng.lat)) && Number.isFinite(Number(loc.latLng.lng)));

  setCanvasMode("leaflet");
  if (frame) frame.src = "about:blank";

  if (!leafletReady()) {
    mapEl.innerHTML = `<div class="map-loading">${esc(loadingText)}</div>`;
    ensureLeafletLoaded()
      .then(() => renderLeafletLocationsShared(locations, options, config))
      .catch((error) => {
        console.error(error);
        onLoadError(error, points);
      });
    return true;
  }

  resetMap();
  mapEl.innerHTML = "";

  const fallbackCenter = defaultMapCenter();
  const center = points[0]?.latLng || fallbackCenter;
  const zoom = points.length === 1 ? 15 : (points.length > 1 ? 13 : fallbackCenter.zoom);
  const map = L.map(mapEl, {
    scrollWheelZoom: true,
    zoomControl: true,
    minZoom: options.routeMode ? 7 : 10,
    maxZoom: 18,
    maxBoundsViscosity: 0.8,
  }).setView([center.lat, center.lng], zoom);
  setMap?.(map);
  L.tileLayer(tileProvider.url, tileProvider.options).addTo(map);

  if (!points.length) {
    setTimeout(() => map?.invalidateSize(), 80);
    return true;
  }

  const bounds = [];
  let selectedMarker = null;
  let selectedPoint = null;
  points.forEach((loc, visibleIndex) => {
    const label = options.keepOriginalOrder ? (loc.order || loc.__sourceIndex + 1) : (loc.order || visibleIndex + 1);
    const isSelected = options.selectedId && String(options.selectedId) === String(loc.id);
    const markerClass = isSelected ? "selected" : (options.routeMode ? "route" : (visibleIndex === 0 ? "first" : visibleIndex === points.length - 1 ? "last" : ""));
    const marker = L.marker([loc.latLng.lat, loc.latLng.lng], { icon: numberedIcon(label, markerClass) })
      .addTo(map)
      .bindPopup(`
        <div class="pop-title">${esc(label)}. ${esc(loc.name)}</div>
        ${loc.timeRange ? `<div class="pop-meta">${popupIcon ? "⏰ " : ""}${esc(loc.timeRange)}</div>` : ""}
        ${loc.type ? `<div class="pop-meta">${popupIcon ? "🏷 " : ""}${esc(loc.type)}</div>` : ""}
        ${loc.address ? `<div class="pop-meta">${popupIcon ? "📍 " : ""}${esc(loc.address)}</div>` : ""}
        ${loc.url ? `<div class="pop-meta"><a href="${esc(loc.url)}" target="_blank" rel="noopener noreferrer">在 Google Maps 開啟</a></div>` : ""}
      `, { autoPan: false });

    if (isSelected) {
      selectedMarker = marker;
      selectedPoint = loc;
    }

    marker.on("click", () => onMarkerClick(loc));
    bounds.push([loc.latLng.lat, loc.latLng.lng]);
  });

  if (options.polyline && points.length > 1) {
    L.polyline(points.map((loc) => [loc.latLng.lat, loc.latLng.lng]), {
      color: cssVar("--accent", "#2b90d9"),
      weight: 4,
      opacity: 0.78,
      dashArray: "9 9",
      lineJoin: "round",
      lineCap: "round",
    }).addTo(map);
  }

  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
    const routeBounds = L.latLngBounds(bounds);
    map.setMaxBounds(routeBounds.pad(0.45));
    const routeMinZoom = map.getBoundsZoom(routeBounds, false, [48, 48]);
    if (Number.isFinite(routeMinZoom)) map.setMinZoom(Math.max(6, routeMinZoom));
  } else if (bounds.length === 1) {
    map.setMaxBounds(L.latLngBounds(bounds).pad(0.08));
  }

  if (selectedPoint && options.centerSelected) {
    const targetZoom = Math.min(Math.max(map.getZoom(), 16), 18);
    const latlng = [selectedPoint.latLng.lat, selectedPoint.latLng.lng];
    setTimeout(() => {
      map?.invalidateSize();
      map?.setView(latlng, targetZoom, { animate: true });
      setTimeout(() => {
        if (centerPanSelected) map?.panTo(latlng, { animate: true });
        selectedMarker?.openPopup();
      }, 180);
    }, 80);
  }

  setTimeout(() => map?.invalidateSize(), 100);
  return true;
}
