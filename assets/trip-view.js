import {
  nonEmpty,
  escapeHtml,
  embedUrl,
  makeMapTarget,
  renderExtraRows,
  extraFields,
  syncActiveTab,
} from "./dom-helpers.js";
import {
  getDefaults,
  formatMoney,
  resolveStopTimeText,
  resolveStopDurationText,
  resolveStopTransitText,
  resolveStopPriceText,
  resolveShopPriceText,
  resolveShopPriceOptionsText,
  renderPhotos,
  buildMapButton,
} from "./formatters.js";
import { normalizeTripData, normalizeStayGroups, normalizeShopGroups } from "./trip-normalizers.js";
import { validateTripData } from "./trip-validators.js";
import { createI18n, resolveLocale } from "./i18n.js";

const state = {
  currentMapId: "",
  currentLocations: [],
  i18n: createI18n("zh-TW"),
};

export function renderTripPage(data) {
  const normalized = normalizeTripData(data);
  const validation = validateTripData(normalized);

  if (!validation.valid) {
    console.error(validation.errors);
    renderValidationError(validation.errors, normalized.defaults?.locale);
    return;
  }

  resetState();

  const locale = resolveLocale(normalized.defaults?.locale || "zh-TW");
  state.i18n = createI18n(locale);

  const defaults = getDefaults(normalized);
  const stayGroups = normalizeStayGroups(normalized);
  const shopGroups = normalizeShopGroups(normalized);

  renderShell();
  renderHeader(normalized, defaults);
  renderReminders(normalized);
  renderDaySection(normalized, defaults);
  renderBudgetSection(normalized, defaults);
  renderStaySection(stayGroups);
  renderShopSection(shopGroups, defaults);
  renderMapSection(normalized, stayGroups, shopGroups, defaults);
}

function resetState() {
  state.currentMapId = "";
  state.currentLocations = [];
}

function t(key) {
  return state.i18n.t(key);
}

function dayLabel(day, index) {
  if (nonEmpty(day.label)) return day.label;
  const key = day.key ?? index + 1;
  return `${t("day")} ${key}`;
}

function renderShell() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="wrap">
      <div class="hero">
        <h1 id="title">讀取中…</h1>
        <p id="subtitle"></p>

        <div class="meta">
          <div class="box"><div class="small">${escapeHtml(t("dates"))}</div><div id="dates"></div></div>
          <div class="box"><div class="small">${escapeHtml(t("travelers"))}</div><div id="travelers"></div></div>
          <div class="box"><div class="small">${escapeHtml(t("budgetLimit"))}</div><div id="budgetPerPerson"></div></div>
          <div class="box"><div class="small">${escapeHtml(t("nights"))}</div><div id="nights"></div></div>
        </div>
      </div>

      <div class="card" style="margin-top:24px">
        <div class="section-head"><h2>${escapeHtml(t("mapInfo"))}</h2></div>
        <div class="section-body">
          <div class="map-shell">
            <div class="map-frame-wrap">
              <iframe
                id="mapFrame"
                src=""
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
              ></iframe>
              <div class="map-focus" id="mapFocus"></div>
            </div>
            <div><div class="map-index" id="locationList"></div></div>
          </div>
        </div>
      </div>

      <div class="layout">
        <div class="stack">
          <div class="card">
            <div class="section-head"><h2 id="dayTabsName">${escapeHtml(t("itinerary"))}</h2></div>
            <div class="section-body">
              <div class="tabs" id="dayTabs"></div>
              <div id="dayContent"></div>
            </div>
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <div class="section-head"><h2 id="budgetTabsName">${escapeHtml(t("budgetTabsName"))}</h2></div>
            <div class="section-body">
              <div class="tabs" id="budgetTabs"></div>
              <div id="budgetContent"></div>
            </div>
          </div>

          <div class="card">
            <div class="section-head"><h2 id="stayTabsName">${escapeHtml(t("stays"))}</h2></div>
            <div class="section-body">
              <div class="tabs" id="stayTabs"></div>
              <div id="stayContent"></div>
            </div>
          </div>

          <div class="card">
            <div class="section-head"><h2>${escapeHtml(t("reminders"))}</h2></div>
            <div class="section-body"><div class="list" id="reminderList"></div></div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:24px">
        <div class="section-head"><h2 id="shopTabsName">${escapeHtml(t("shops"))}</h2></div>
        <div class="section-body">
          <div class="tabs" id="shopTabs"></div>
          <div id="shopContent"></div>
        </div>
      </div>
    </div>
  `;
}

function renderHeader(data, defaults) {
  document.getElementById("title").textContent = data.title || "";
  document.getElementById("subtitle").textContent = data.subtitle || "";
  document.getElementById("dates").textContent = data.dates || "";
  document.getElementById("travelers").textContent = `${data.travelers || 0}`;
  document.getElementById("budgetPerPerson").textContent =
    data.budget_per_person !== undefined
      ? `${formatMoney(data.budget_per_person || 0, defaults.currency, defaults.locale)} / 1`
      : "";
  document.getElementById("nights").textContent = data.nights || "";
}

function renderReminders(data) {
  const reminderList = document.getElementById("reminderList");
  if (!reminderList) return;

  reminderList.innerHTML = "";
  (data.reminders || []).forEach((text) => {
    const div = document.createElement("div");
    div.className = "item-card";
    div.textContent = text;
    reminderList.appendChild(div);
  });
}

function renderDaySection(data, defaults) {
  const dayTabs = document.getElementById("dayTabs");
  const dayContent = document.getElementById("dayContent");
  if (!dayTabs || !dayContent) return;

  const days = Array.isArray(data.days) ? data.days : [];
  dayTabs.innerHTML = "";

  let activeKey = days[0]?.key ?? "";

  days.forEach((day, index) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (day.key === activeKey ? " active" : "");
    btn.textContent = dayLabel(day, index);
    btn.dataset.key = String(day.key);
    btn.onclick = () => {
      activeKey = day.key;
      renderDayContent(days, activeKey, defaults);
      attachPhotoSliders();
      detectImageOrientation();
      syncActiveTab(dayTabs, String(activeKey));
    };
    dayTabs.appendChild(btn);
  });

  renderDayContent(days, activeKey, defaults);
  attachPhotoSliders();
  detectImageOrientation();
  syncActiveTab(dayTabs, String(activeKey));
}

function renderDayContent(days, activeKey, defaults) {
  const dayContent = document.getElementById("dayContent");
  if (!dayContent) return;

  const day = days.find((d) => d.key === activeKey) || days[0];
  if (!day) {
    dayContent.innerHTML = `<div class="item-card">${escapeHtml(t("noData"))}</div>`;
    return;
  }

  const currentIndex = days.findIndex((d) => d.key === day.key);
  const stopsHtml = (day.stops || [])
    .map((stop, idx) => renderStopCard(day, stop, idx, defaults))
    .join("");

  dayContent.innerHTML = `
    <div class="day-header">
      <div class="small muted">${escapeHtml(dayLabel(day, currentIndex))}</div>
      ${nonEmpty(day.title) ? `<div class="day-header-title">${escapeHtml(day.title)}</div>` : ""}
      ${nonEmpty(day.theme) ? `<div class="day-header-theme muted">${escapeHtml(day.theme)}</div>` : ""}
      ${nonEmpty(day.hero) ? `<div class="day-header-hero"><span class="badge">${escapeHtml(t("highlight"))}：${escapeHtml(day.hero)}</span></div>` : ""}
    </div>
    <div class="stops">${stopsHtml}</div>
  `;

  attachMapInteractions();
  updateActiveStates();
}

function renderStopCard(day, stop, idx, defaults) {
  const mapId = `day-${day.key || "day"}-${idx}`;
  const mapTarget = makeMapTarget(stop);

  const timeText = resolveStopTimeText(stop);
  const durationText = resolveStopDurationText(stop);
  const transitText = resolveStopTransitText(stop);
  const priceText = resolveStopPriceText(stop, defaults);
  const photosHtml = renderPhotos(stop.photos);

  const title = stop.name || stop.maps_label || `Stop ${idx + 1}`;
  const address = stop.address?.full?.trim() || stop.address?.short?.trim() || "";
  const note = stop.note?.trim() || "";
  const hasMap = nonEmpty(stop.map);

  const metaParts = [
    timeText ? `<span class="time-pill">${escapeHtml(timeText)}</span>` : "",
    durationText ? `<span class="pill">${escapeHtml(t("duration"))} ${escapeHtml(durationText)}</span>` : "",
    nonEmpty(stop.type) ? `<span class="pill">${escapeHtml(stop.type)}</span>` : "",
    transitText ? `<span class="pill">${escapeHtml(t("transit"))} ${escapeHtml(transitText)}</span>` : "",
  ].filter(Boolean).join("");

  const extras = renderExtraRows(
    extraFields(stop, [
      "id",
      "start_time",
      "duration_min",
      "transit_to_next_min",
      "name",
      "maps_label",
      "type",
      "price",
      "address",
      "note",
      "map",
      "highlight",
      "photos",
      "show_in_map_info",
    ])
  );
  return `
    <div class="stop${mapTarget ? " map-target" : ""}"${mapTarget ? ` data-mapid="${escapeHtml(mapId)}"` : ""}>
      <div class="stop-top">
        <div>
          <div class="stop-title">
            ${escapeHtml(title)}
            ${stop.highlight ? ` <span class="badge">${escapeHtml(t("highlight"))}</span>` : ""}
          </div>
          ${metaParts ? `<div class="stop-meta">${metaParts}</div>` : ""}
        </div>
        ${priceText ? `<div class="cost-pill">${escapeHtml(priceText)}</div>` : ""}
      </div>

      ${address ? `
        <div class="addr-box">
          <div class="box">
            <div class="small muted">Address</div>
            <div>${escapeHtml(address)}</div>
          </div>
        </div>
      ` : ""}

      ${note ? `<div class="stop-note">${escapeHtml(note)}</div>` : ""}
      ${photosHtml}
      ${extras}

      ${hasMap ? `
        <div class="actions">
          ${buildMapButton(mapId)}
        </div>
      ` : ""}
    </div>
  `;
}

function renderBudgetSection(data, defaults) {
  const budgetTabs = document.getElementById("budgetTabs");
  const budgetContent = document.getElementById("budgetContent");
  if (!budgetTabs || !budgetContent) return;

  const items = Array.isArray(data.budget_items) ? data.budget_items : [];
  const grandTotal = items.reduce((sum, item) => sum + Number(item.value || 0), 0);

  budgetTabs.innerHTML = "";
  let activeKey = "total";

  const totalBtn = document.createElement("button");
  totalBtn.className = "tab-btn active";
  totalBtn.textContent = "Total";
  totalBtn.dataset.key = "total";
  totalBtn.onclick = () => {
    activeKey = "total";
    renderBudgetContent(items, activeKey, grandTotal, defaults);
    syncActiveTab(budgetTabs, activeKey);
  };
  budgetTabs.appendChild(totalBtn);

  items.forEach((item, index) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn";
    btn.textContent = item.label || `Category ${index + 1}`;
    btn.dataset.key = item.label || `category-${index + 1}`;
    btn.onclick = () => {
      activeKey = btn.dataset.key;
      renderBudgetContent(items, activeKey, grandTotal, defaults);
      syncActiveTab(budgetTabs, activeKey);
    };
    budgetTabs.appendChild(btn);
  });

  renderBudgetContent(items, activeKey, grandTotal, defaults);
  syncActiveTab(budgetTabs, activeKey);
}

function renderBudgetContent(items, activeKey, grandTotal, defaults) {
  const budgetContent = document.getElementById("budgetContent");
  if (!budgetContent) return;

  if (activeKey === "total") {
    budgetContent.innerHTML = `
      <div class="item-card">
        <div class="budget-summary-row">
          <strong>Total</strong>
          <span class="badge">${formatMoney(grandTotal, defaults.currency, defaults.locale)}</span>
        </div>
        <div class="details-wrap">
          ${items
            .map(
              (item) => `
                <div class="details-row">
                  <div><strong>${escapeHtml(item.label || "")}</strong></div>
                  <div>${formatMoney(item.value || 0, defaults.currency, defaults.locale)}</div>
                </div>
              `
            )
            .join("")}
        </div>
        <div class="summary-box">
          <div class="summary-box-label small">All categories</div>
          <div class="summary-box-value">${formatMoney(grandTotal, defaults.currency, defaults.locale)}</div>
        </div>
      </div>
    `;
    return;
  }

  const item =
    items.find((b, index) => (b.label || `category-${index + 1}`) === activeKey) || items[0];

  if (!item) {
    budgetContent.innerHTML = `<div class="item-card">${escapeHtml(t("noData"))}</div>`;
    return;
  }

  const details = Array.isArray(item.details) ? item.details : [];
  const detailsSum = details.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const pct = grandTotal ? Math.round((Number(item.value || 0) / grandTotal) * 100) : 0;

  budgetContent.innerHTML = `
    <div class="item-card">
      <div class="budget-summary-row">
        <strong>${escapeHtml(item.label || "")}</strong>
        <span class="badge">${formatMoney(item.value || 0, defaults.currency, defaults.locale)}</span>
      </div>
      <div class="budget-bar budget-bar-top-gap"><div style="width:${pct}%"></div></div>
      <div class="budget-percent small muted">Share: ${pct}%</div>
      ${
        details.length
          ? `
            <div class="details-wrap">
              ${details
                .map(
                  (d) => `
                    <div class="details-row">
                      <div>
                        <strong>${escapeHtml(d.name || "Item")}</strong>
                        ${nonEmpty(d.note) ? `<div class="small muted detail-note">${escapeHtml(d.note)}</div>` : ""}
                      </div>
                      <div>${formatMoney(d.amount || 0, defaults.currency, defaults.locale)}</div>
                    </div>
                  `
                )
                .join("")}
            </div>
            <div class="summary-box">
              <div class="summary-box-label small">Details total</div>
              <div class="summary-box-value">${formatMoney(detailsSum, defaults.currency, defaults.locale)}</div>
            </div>
          `
          : `<div class="small muted budget-empty-note">${escapeHtml(t("noData"))}</div>`
      }
    </div>
  `;
}

function renderStaySection(stayGroups) {
  const stayTabs = document.getElementById("stayTabs");
  const stayContent = document.getElementById("stayContent");
  if (!stayTabs || !stayContent) return;

  stayTabs.innerHTML = "";
  let activeKey = stayGroups[0]?.key || "";

  stayGroups.forEach((group, index) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (group.key === activeKey ? " active" : "");
    btn.textContent = group.label || `Stay ${index + 1}`;
    btn.dataset.key = group.key;
    btn.onclick = () => {
      activeKey = group.key;
      renderStayContent(stayGroups, activeKey);
      attachPhotoSliders();
      detectImageOrientation();
      syncActiveTab(stayTabs, activeKey);
    };
    stayTabs.appendChild(btn);
  });

  renderStayContent(stayGroups, activeKey);
  attachPhotoSliders();
  detectImageOrientation();
  syncActiveTab(stayTabs, activeKey);
}

function renderStayContent(stayGroups, activeKey) {
  const stayContent = document.getElementById("stayContent");
  if (!stayContent) return;

  const group = stayGroups.find((g) => g.key === activeKey) || stayGroups[0];
  if (!group) {
    stayContent.innerHTML = `<div class="item-card">${escapeHtml(t("noData"))}</div>`;
    return;
  }

  stayContent.innerHTML =
    `<div class="list">` +
    (group.items || []).map((item, idx) => renderStayCard(group, item, idx)).join("") +
    `</div>`;

  attachMapInteractions();
  updateActiveStates();
}

function renderStayCard(group, item, idx) {
  const mapTarget = makeMapTarget(item);
  const mapId = `stay-${group.key || "stay"}-${idx}`;
  const photosHtml = renderPhotos(item.photos);
  const address = item.address?.trim() || "";
  const hasMap = nonEmpty(item.map);

  const extras = renderExtraRows(
    extraFields(item, ["area", "name", "note", "link", "map", "address", "photos", "show_in_map_info"])
  );

  return `
    <div class="item-card${mapTarget ? " map-target" : ""}"${mapTarget ? ` data-mapid="${escapeHtml(mapId)}"` : ""}>
      <div class="item-card-top">
        <strong>${escapeHtml(item.name || "")}</strong>
        <span class="badge">${escapeHtml(item.area || group.label || "")}</span>
      </div>
      ${nonEmpty(item.note) ? `<div class="muted small item-card-note">${escapeHtml(item.note)}</div>` : ""}
      ${address ? `<div class="extra-row item-card-address"><strong>Address：</strong>${escapeHtml(address)}</div>` : ""}
      ${photosHtml}
      ${extras}
      <div class="actions">
        ${hasMap ? buildMapButton(mapId) : ""}
        ${nonEmpty(item.link)
          ? `<a class="btn secondary" href="${escapeHtml(item.link)}" target="_blank">Open</a>`
          : ""}
      </div>
    </div>
  `;
}

function renderShopSection(shopGroups, defaults) {
  const shopTabs = document.getElementById("shopTabs");
  const shopContent = document.getElementById("shopContent");
  if (!shopTabs || !shopContent) return;

  shopTabs.innerHTML = "";
  let activeKey = shopGroups[0]?.key || "";

  shopGroups.forEach((group, index) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (group.key === activeKey ? " active" : "");
    btn.textContent = group.label || `Info ${index + 1}`;
    btn.dataset.key = group.key;
    btn.onclick = () => {
      activeKey = group.key;
      renderShopContent(shopGroups, activeKey, defaults);
      attachPhotoSliders();
      detectImageOrientation();
      syncActiveTab(shopTabs, activeKey);
    };
    shopTabs.appendChild(btn);
  });

  renderShopContent(shopGroups, activeKey, defaults);
  attachPhotoSliders();
  detectImageOrientation();
  syncActiveTab(shopTabs, activeKey);
}

function renderShopContent(shopGroups, activeKey, defaults) {
  const shopContent = document.getElementById("shopContent");
  if (!shopContent) return;

  const group = shopGroups.find((g) => g.key === activeKey) || shopGroups[0];
  if (!group) {
    shopContent.innerHTML = `<div class="item-card">${escapeHtml(t("noData"))}</div>`;
    return;
  }

  shopContent.innerHTML =
    `<div class="list">` +
    (group.items || []).map((item, idx) => renderShopCard(group, item, idx, defaults)).join("") +
    `</div>`;

  attachMapInteractions();
  updateActiveStates();
}

function renderShopCard(group, item, idx, defaults) {
  const mapTarget = makeMapTarget(item);
  const mapId = `shop-${group.key || "shop"}-${idx}`;
  const itemPrice = resolveShopPriceText(item, defaults);
  const itemPriceOptions = resolveShopPriceOptionsText(item, defaults);
  const photosHtml = renderPhotos(item.photos);
  const address = item.address?.trim() || "";
  const hasMap = nonEmpty(item.map);

  const extras = renderExtraRows(
    extraFields(item, ["name", "tag", "price", "price_options", "note", "link", "map", "address", "photos", "show_in_map_info"])
  );

  return `
    <div class="item-card${mapTarget ? " map-target" : ""}"${mapTarget ? ` data-mapid="${escapeHtml(mapId)}"` : ""}>
      <div class="item-card-top">
        <strong>${escapeHtml(item.name || "")}</strong>
        <span class="badge">${escapeHtml(item.tag || group.label || "Info")}</span>
      </div>
      ${itemPrice ? `<div class="item-price">${escapeHtml(itemPrice)}</div>` : ""}
      ${itemPriceOptions ? `<div class="muted small item-price-options">${escapeHtml(itemPriceOptions)}</div>` : ""}
      ${nonEmpty(item.note) ? `<div class="muted small item-card-note">${escapeHtml(item.note)}</div>` : ""}
      ${address ? `<div class="extra-row item-card-address"><strong>Address：</strong>${escapeHtml(address)}</div>` : ""}
      ${photosHtml}
      ${extras}
      <div class="actions">
        ${hasMap ? buildMapButton(mapId) : ""}
        ${nonEmpty(item.link)
          ? `<a class="btn secondary" href="${escapeHtml(item.link)}" target="_blank">Open</a>`
          : ""}
      </div>
    </div>
  `;
}

function renderMapSection(data, stayGroups, shopGroups, defaults) {
  const allLocations = collectLocations(data, stayGroups, shopGroups, defaults);
  state.currentLocations = allLocations;

  const visibleLocations = allLocations.filter((loc) => loc.showInMapInfo);
  rebuildLocationList(visibleLocations);

  if (visibleLocations.length) {
    focusMapById(visibleLocations[0].id);
  } else if (allLocations.length) {
    focusMapById(allLocations[0].id);
  } else {
    renderEmptyMapState();
  }

  attachMapInteractions();
  updateActiveStates();
}

function shouldShowInMapInfo(item) {
  return item?.show_in_map_info !== false;
}

function collectLocations(data, stayGroups, shopGroups, defaults) {
  const locations = [];
  let seq = 0;

  (data.days || []).forEach((day, dayIndex) => {
    (day.stops || []).forEach((stop, stopIndex) => {
      const map = makeMapTarget(stop);
      if (!map) return;

      const timeText = resolveStopTimeText(stop);
      const priceText = resolveStopPriceText(stop, defaults);

      locations.push({
        id: `day-${day.key || dayIndex}-${stopIndex}`,
        map,
        source: `${t("itinerary")} / ${dayLabel(day, dayIndex)}`,
        title: stop.maps_label || stop.name || "Place",
        subtitle: [stop.type, timeText, priceText].filter(Boolean).join("｜"),
        address: stop.address?.short || stop.address?.full || "",
        order: seq++,
        showInMapInfo: shouldShowInMapInfo(stop),
      });
    });
  });

  stayGroups.forEach((group, groupIndex) => {
    (group.items || []).forEach((item, itemIndex) => {
      const map = makeMapTarget(item);
      if (!map) return;

      locations.push({
        id: `stay-${group.key || groupIndex}-${itemIndex}`,
        map,
        source: `${t("stays")} / ${group.label || "Stay"}`,
        title: item.name || "Stay",
        subtitle: item.note || "",
        address: item.address || item.area || "",
        order: seq++,
        showInMapInfo: shouldShowInMapInfo(item),
      });
    });
  });

  shopGroups.forEach((group, groupIndex) => {
    (group.items || []).forEach((item, itemIndex) => {
      const map = makeMapTarget(item);
      if (!map) return;

      const itemPrice =
        resolveShopPriceText(item, defaults) || resolveShopPriceOptionsText(item, defaults);

      locations.push({
        id: `shop-${group.key || groupIndex}-${itemIndex}`,
        map,
        source: `${t("shops")} / ${group.label || "Info"}`,
        title: item.name || "Shop",
        subtitle: [item.tag, itemPrice, item.note].filter(Boolean).join("｜"),
        address: item.address || "",
        order: seq++,
        showInMapInfo: shouldShowInMapInfo(item),
      });
    });
  });

  return locations;
}

function rebuildLocationList(locations) {
  const box = document.getElementById("locationList");
  if (!box) return;

  box.innerHTML = "";

  locations.forEach((loc) => {
    const div = document.createElement("div");
    div.className = "location";
    div.dataset.mapid = loc.id;
    div.innerHTML = `
      <div class="loc-title">${escapeHtml(loc.title)}</div>
      ${nonEmpty(loc.address) ? `<div class="loc-sub">${escapeHtml(loc.address)}</div>` : ""}
    `;
    div.addEventListener("click", () => focusMapById(loc.id));
    box.appendChild(div);
  });
}

function renderEmptyMapState() {
  const mapFrame = document.getElementById("mapFrame");
  const mapFocus = document.getElementById("mapFocus");
  const box = document.getElementById("locationList");

  if (box) box.innerHTML = "";
  if (mapFrame) mapFrame.src = embedUrl("Taiwan");
  if (mapFocus) {
    mapFocus.innerHTML = `<div class="muted">${escapeHtml(t("noData"))}</div>`;
  }
}

function focusMapById(mapId) {
  const item = state.currentLocations.find((x) => x.id === mapId);
  if (!item) return;

  state.currentMapId = mapId;

  const mapFrame = document.getElementById("mapFrame");
  const mapFocus = document.getElementById("mapFocus");

  if (mapFrame) mapFrame.src = embedUrl(item.map);

  if (mapFocus) {
    mapFocus.innerHTML = `
      <div class="small muted">${escapeHtml(item.source)}</div>
      <h3>${escapeHtml(item.title)}</h3>
      ${nonEmpty(item.subtitle) ? `<div class="map-focus-subtitle muted">${escapeHtml(item.subtitle)}</div>` : ""}
      ${nonEmpty(item.address) ? `<div class="map-focus-address"><strong>Address：</strong>${escapeHtml(item.address)}</div>` : ""}
      <div class="actions">
        <a class="btn secondary" href="${escapeHtml(item.map)}" target="_blank" rel="noopener noreferrer">Open Google Maps</a>
      </div>
    `;
  }

  updateActiveStates();
}

function updateActiveStates() {
  document.querySelectorAll("[data-mapid]").forEach((el) => {
    if (el.classList.contains("map-switch-btn")) return;
    el.classList.toggle("active-map", el.dataset.mapid === state.currentMapId);
  });

  document.querySelectorAll(".location").forEach((el) => {
    el.classList.toggle("active", el.dataset.mapid === state.currentMapId);
  });
}

function attachMapInteractions() {
  document.querySelectorAll(".map-target").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;

      const btn = event.target.closest(".map-switch-btn");
      if (btn) {
        focusMapById(btn.dataset.mapid);
        event.stopPropagation();
        return;
      }

      const id = card.dataset.mapid;
      if (id) focusMapById(id);
    });
  });

  document.querySelectorAll(".map-switch-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      focusMapById(btn.dataset.mapid);
    });
  });
}

function attachPhotoSliders() {
  document.querySelectorAll(".photo-slider").forEach((slider) => {
    const track = slider.querySelector(".slider-track");
    const buttons = slider.querySelectorAll(".slider-btn");
    const slide = track?.querySelector(".slide");

    if (!track || !slide || buttons.length === 0) return;

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const dir = Number(btn.dataset.dir);
        track.scrollBy({
          left: dir * slide.clientWidth,
          behavior: "smooth",
        });
      });
    });
  });
}

function detectImageOrientation() {
  document.querySelectorAll(".slide img").forEach((img) => {
    const apply = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      img.classList.remove("portrait", "landscape");
      if (ratio < 1) {
        img.classList.add("portrait");
      } else {
        img.classList.add("landscape");
      }
    };

    if (img.complete) {
      apply();
    } else {
      img.onload = apply;
    }
  });
}

function renderValidationError(errors, defaultLocale = "zh-TW") {
  const app = document.getElementById("app");
  if (!app) return;

  const locale = resolveLocale(defaultLocale);
  state.i18n = createI18n(locale);

  app.innerHTML = `
    <div class="wrap">
      <div class="card">
        <div class="section-head">
          <h2>${escapeHtml(t("dataError"))}</h2>
        </div>
        <div class="section-body">
          <div class="error-box">
            <strong>trip.json validation failed</strong><br>
            ${errors.map((e) => `- ${escapeHtml(e)}`).join("<br>")}
          </div>
        </div>
      </div>
    </div>
  `;
}
