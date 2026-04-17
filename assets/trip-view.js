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
import { normalizeStayGroups, normalizeShopGroups } from "./trip-normalizers.js";
import { validateTripData } from "./trip-validators.js";

const state = {
  currentMapId: "",
  currentLocations: [],
};

export function renderTripPage(data) {
  const validation = validateTripData(data);
  if (!validation.valid) {
    console.error(validation.errors);
    renderValidationError(validation.errors);
    return;
  }

  resetState();

  const defaults = getDefaults(data);
  const stayGroups = normalizeStayGroups(data);
  const shopGroups = normalizeShopGroups(data);

  renderShell();
  renderHeader(data, defaults);
  renderReminders(data);
  renderDaySection(data, defaults);
  renderBudgetSection(data, defaults);
  renderStaySection(stayGroups);
  renderShopSection(shopGroups, defaults);
  renderMapSection(data, stayGroups, shopGroups, defaults);
}

function resetState() {
  state.currentMapId = "";
  state.currentLocations = [];
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
          <div class="box"><div class="small">日期</div><div id="dates"></div></div>
          <div class="box"><div class="small">同行人數</div><div id="travelers"></div></div>
          <div class="box"><div class="small">預算上限</div><div id="budgetPerPerson"></div></div>
          <div class="box"><div class="small">住宿安排</div><div id="nights"></div></div>
        </div>
      </div>

      <div class="card" style="margin-top:24px">
        <div class="section-head"><h2>地圖資訊</h2></div>
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
            <div class="section-head"><h2 id="dayTabsName">每日行程</h2></div>
            <div class="section-body">
              <div class="tabs" id="dayTabs"></div>
              <div id="dayContent"></div>
            </div>
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <div class="section-head"><h2 id="budgetTabsName">預算</h2></div>
            <div class="section-body">
              <div class="tabs" id="budgetTabs"></div>
              <div id="budgetContent"></div>
            </div>
          </div>

          <div class="card">
            <div class="section-head"><h2 id="stayTabsName">住宿資訊卡</h2></div>
            <div class="section-body">
              <div class="tabs" id="stayTabs"></div>
              <div id="stayContent"></div>
            </div>
          </div>

          <div class="card">
            <div class="section-head"><h2>行前提醒</h2></div>
            <div class="section-body"><div class="list" id="reminderList"></div></div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:24px">
        <div class="section-head"><h2 id="shopTabsName">店家 / 活動 / 交通資訊卡</h2></div>
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
  document.getElementById("travelers").textContent = `${data.travelers || 0} 人`;
  document.getElementById("budgetPerPerson").textContent =
    `${formatMoney(data.budget_per_person || 0, defaults.currency, defaults.locale)} / 人`;
  document.getElementById("nights").textContent = data.nights || "";

  document.getElementById("dayTabsName").textContent = data.day_tabs_name || "每日行程";
  document.getElementById("stayTabsName").textContent = data.stay_tabs_name || "住宿資訊卡";
  document.getElementById("shopTabsName").textContent = data.shop_tabs_name || "店家 / 活動 / 交通資訊卡";
  document.getElementById("budgetTabsName").textContent = data.budget_tabs_name || "預算";
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

  let activeKey = days[0]?.key || "";

  days.forEach((day, index) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (day.key === activeKey ? " active" : "");
    btn.textContent = day.label || `Day ${index + 1}`;
    btn.dataset.key = day.key;
    btn.onclick = () => {
      activeKey = day.key;
      renderDayContent(days, activeKey, defaults);
      syncActiveTab(dayTabs, activeKey);
    };
    dayTabs.appendChild(btn);
  });

  renderDayContent(days, activeKey, defaults);
  syncActiveTab(dayTabs, activeKey);
}

function renderDayContent(days, activeKey, defaults) {
  const dayContent = document.getElementById("dayContent");
  if (!dayContent) return;

  const day = days.find((d) => d.key === activeKey) || days[0];
  if (!day) {
    dayContent.innerHTML = `<div class="item-card">沒有行程資料</div>`;
    return;
  }

  const stopsHtml = (day.stops || [])
    .map((stop, idx) => renderStopCard(day, stop, idx, defaults))
    .join("");

  dayContent.innerHTML = `
    <div class="day-header">
      <div class="small muted">${escapeHtml(day.label || "")}</div>
      <div class="day-header-title">${escapeHtml(day.title || "")}</div>
      ${nonEmpty(day.theme) ? `<div class="day-header-theme muted">${escapeHtml(day.theme)}</div>` : ""}
      ${nonEmpty(day.hero) ? `<div class="day-header-hero"><span class="badge">重點：${escapeHtml(day.hero)}</span></div>` : ""}
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

  const extras = renderExtraRows(
    extraFields(stop, [
      "id",
      "time",
      "start_time",
      "end_time",
      "duration_min",
      "transit_to_next_min",
      "name",
      "maps_label",
      "short_address",
      "type",
      "stay",
      "cost",
      "price",
      "address",
      "note",
      "next",
      "next_label",
      "next_stop_id",
      "map",
      "highlight",
      "photos",
    ])
  );

  return `
    <div class="stop${mapTarget ? " map-target" : ""}"${mapTarget ? ` data-mapid="${escapeHtml(mapId)}"` : ""}>
      <div class="stop-top">
        <div>
          <div class="stop-title">
            ${escapeHtml(stop.name || "")}
            ${stop.highlight ? ' <span class="badge">重點</span>' : ""}
          </div>
          <div class="stop-meta">
            ${timeText ? `<span class="time-pill">${escapeHtml(timeText)}</span>` : ""}
            ${durationText ? `<span class="pill">停留 ${escapeHtml(durationText)}</span>` : ""}
            ${nonEmpty(stop.type) ? `<span class="pill">${escapeHtml(stop.type)}</span>` : ""}
            ${transitText ? `<span class="pill">移動 ${escapeHtml(transitText)}</span>` : ""}
          </div>
        </div>
        ${priceText ? `<div class="cost-pill">${escapeHtml(priceText)}</div>` : ""}
      </div>

      <div class="addr-box">
        <div class="box">
          <div class="small muted">地址</div>
          <div>${escapeHtml(stop.address || "—")}</div>
        </div>
      </div>

      ${nonEmpty(stop.note) ? `<div class="stop-note">${escapeHtml(stop.note)}</div>` : ""}
      ${photosHtml}
      ${extras}

      <div class="actions">
        ${buildMapButton(mapTarget ? mapId : "")}
        ${nonEmpty(stop.next_label || stop.next)
          ? `<span class="pill">前往下一站：${escapeHtml(stop.next_label || stop.next)}</span>`
          : ""}
      </div>
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
  let activeKey = "總額";

  const totalBtn = document.createElement("button");
  totalBtn.className = "tab-btn active";
  totalBtn.textContent = "總額";
  totalBtn.dataset.key = "總額";
  totalBtn.onclick = () => {
    activeKey = "總額";
    renderBudgetContent(items, activeKey, grandTotal, defaults);
    syncActiveTab(budgetTabs, activeKey);
  };
  budgetTabs.appendChild(totalBtn);

  items.forEach((item, index) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn";
    btn.textContent = item.label || `分類 ${index + 1}`;
    btn.dataset.key = item.label;
    btn.onclick = () => {
      activeKey = item.label;
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

  if (activeKey === "總額") {
    budgetContent.innerHTML = `
      <div class="item-card">
        <div class="budget-summary-row">
          <strong>總額</strong>
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
          <div class="summary-box-label small">全部分類加總</div>
          <div class="summary-box-value">${formatMoney(grandTotal, defaults.currency, defaults.locale)}</div>
        </div>
      </div>
    `;
    return;
  }

  const item = items.find((b) => b.label === activeKey) || items[0];
  if (!item) {
    budgetContent.innerHTML = `<div class="item-card">沒有預算資料</div>`;
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
      <div class="budget-percent small muted">分類占比：${pct}%</div>
      ${
        details.length
          ? `
            <div class="details-wrap">
              ${details
                .map(
                  (d) => `
                    <div class="details-row">
                      <div>
                        <strong>${escapeHtml(d.name || "項目")}</strong>
                        ${nonEmpty(d.note) ? `<div class="small muted detail-note">${escapeHtml(d.note)}</div>` : ""}
                      </div>
                      <div>${formatMoney(d.amount || 0, defaults.currency, defaults.locale)}</div>
                    </div>
                  `
                )
                .join("")}
            </div>
            <div class="summary-box">
              <div class="summary-box-label small">明細加總</div>
              <div class="summary-box-value">${formatMoney(detailsSum, defaults.currency, defaults.locale)}</div>
            </div>
          `
          : `<div class="small muted budget-empty-note">尚未提供明細</div>`
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
    btn.textContent = group.label || `群組 ${index + 1}`;
    btn.dataset.key = group.key;
    btn.onclick = () => {
      activeKey = group.key;
      renderStayContent(stayGroups, activeKey);
      syncActiveTab(stayTabs, activeKey);
    };
    stayTabs.appendChild(btn);
  });

  renderStayContent(stayGroups, activeKey);
  syncActiveTab(stayTabs, activeKey);
}

function renderStayContent(stayGroups, activeKey) {
  const stayContent = document.getElementById("stayContent");
  if (!stayContent) return;

  const group = stayGroups.find((g) => g.key === activeKey) || stayGroups[0];
  if (!group) {
    stayContent.innerHTML = `<div class="item-card">沒有住宿資料</div>`;
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

  const extras = renderExtraRows(
    extraFields(item, ["area", "name", "note", "link", "map", "address", "photos"])
  );

  return `
    <div class="item-card${mapTarget ? " map-target" : ""}"${mapTarget ? ` data-mapid="${escapeHtml(mapId)}"` : ""}>
      <div class="item-card-top">
        <strong>${escapeHtml(item.name || "")}</strong>
        <span class="badge">${escapeHtml(item.area || group.label || "")}</span>
      </div>
      ${nonEmpty(item.note) ? `<div class="muted small item-card-note">${escapeHtml(item.note)}</div>` : ""}
      ${nonEmpty(item.address) ? `<div class="extra-row item-card-address"><strong>地址：</strong>${escapeHtml(item.address)}</div>` : ""}
      ${photosHtml}
      ${extras}
      <div class="actions">
        ${buildMapButton(mapTarget ? mapId : "")}
        ${nonEmpty(item.link)
          ? `<a class="btn secondary" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">查看住宿</a>`
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
    btn.textContent = group.label || `分類 ${index + 1}`;
    btn.dataset.key = group.key;
    btn.onclick = () => {
      activeKey = group.key;
      renderShopContent(shopGroups, activeKey, defaults);
      syncActiveTab(shopTabs, activeKey);
    };
    shopTabs.appendChild(btn);
  });

  renderShopContent(shopGroups, activeKey, defaults);
  syncActiveTab(shopTabs, activeKey);
}

function renderShopContent(shopGroups, activeKey, defaults) {
  const shopContent = document.getElementById("shopContent");
  if (!shopContent) return;

  const group = shopGroups.find((g) => g.key === activeKey) || shopGroups[0];
  if (!group) {
    shopContent.innerHTML = `<div class="item-card">沒有店家 / 活動資料</div>`;
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

  const extras = renderExtraRows(
    extraFields(item, ["name", "tag", "price", "price_options", "note", "link", "map", "address", "photos"])
  );

  return `
    <div class="item-card${mapTarget ? " map-target" : ""}"${mapTarget ? ` data-mapid="${escapeHtml(mapId)}"` : ""}>
      <div class="item-card-top">
        <strong>${escapeHtml(item.name || "")}</strong>
        <span class="badge">${escapeHtml(item.tag || group.label || "資訊")}</span>
      </div>
      ${itemPrice ? `<div class="item-price">${escapeHtml(itemPrice)}</div>` : ""}
      ${itemPriceOptions ? `<div class="muted small item-price-options">${escapeHtml(itemPriceOptions)}</div>` : ""}
      ${nonEmpty(item.note) ? `<div class="muted small item-card-note">${escapeHtml(item.note)}</div>` : ""}
      ${nonEmpty(item.address) ? `<div class="extra-row item-card-address"><strong>地址：</strong>${escapeHtml(item.address)}</div>` : ""}
      ${photosHtml}
      ${extras}
      <div class="actions">
        ${buildMapButton(mapTarget ? mapId : "")}
        ${nonEmpty(item.link)
          ? `<a class="btn secondary" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">查看連結</a>`
          : ""}
      </div>
    </div>
  `;
}

function renderMapSection(data, stayGroups, shopGroups, defaults) {
  const locations = collectLocations(data, stayGroups, shopGroups, defaults);
  rebuildLocationList(locations);
  attachMapInteractions();
  updateActiveStates();
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
        source: `${data.day_tabs_name || "每日行程"} / ${day.label || `Day ${dayIndex + 1}`}`,
        title: stop.maps_label || stop.name || "地點",
        subtitle: [stop.type, timeText, priceText].filter(Boolean).join("｜"),
        address: stop.short_address || stop.address || "",
        order: seq++,
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
        source: `${document.getElementById("stayTabsName")?.textContent || "住宿資訊"} / ${group.label || "住宿"}`,
        title: item.name || "住宿",
        subtitle: item.note || item.reference || "",
        address: item.address || item.area || "",
        order: seq++,
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
        source: `${document.getElementById("shopTabsName")?.textContent || "資訊分類"} / ${group.label || "資訊"}`,
        title: item.name || "店家",
        subtitle: [item.tag, itemPrice, item.note].filter(Boolean).join("｜"),
        address: item.address || "",
        order: seq++,
      });
    });
  });

  return locations;
}

function rebuildLocationList(locations) {
  state.currentLocations = locations;

  const box = document.getElementById("locationList");
  const mapFrame = document.getElementById("mapFrame");
  const mapFocus = document.getElementById("mapFocus");

  if (!box || !mapFrame || !mapFocus) return;

  box.innerHTML = "";

  if (!locations.length) {
    mapFrame.src = embedUrl("台灣");
    mapFocus.innerHTML = `<div class="muted">目前沒有可顯示的 map / address 資料。</div>`;
    return;
  }

  locations.forEach((loc, idx) => {
    const div = document.createElement("div");
    div.className = "location" + (idx === 0 ? " active" : "");
    div.dataset.mapid = loc.id;
    div.innerHTML = `
      <div class="loc-title">${escapeHtml(loc.title)}</div>
      ${nonEmpty(loc.address) ? `<div class="loc-sub">${escapeHtml(loc.address)}</div>` : ""}
    `;
    div.addEventListener("click", () => focusMapById(loc.id));
    box.appendChild(div);
  });

  focusMapById(locations[0].id);
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
      ${nonEmpty(item.address) ? `<div class="map-focus-address"><strong>地址：</strong>${escapeHtml(item.address)}</div>` : ""}
      <div class="actions">
        <a class="btn secondary" href="${escapeHtml(item.map)}" target="_blank" rel="noopener noreferrer">開啟 Google Maps</a>
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

function renderValidationError(errors) {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="wrap">
      <div class="card">
        <div class="section-head">
          <h2>資料格式錯誤</h2>
        </div>
        <div class="section-body">
          <div class="error-box">
            <strong>trip.json 結構驗證失敗</strong><br>
            ${errors.map((e) => `- ${escapeHtml(e)}`).join("<br>")}
          </div>
        </div>
      </div>
    </div>
  `;
}
