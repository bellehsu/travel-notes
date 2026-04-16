let currentMapId = "";
let currentLocations = [];

function getTrip() {
  const params = new URLSearchParams(window.location.search);
  const trip = params.get("trip");
  return trip ? trip.trim() : "";
}

function resolveJsonPath() {
  const trip = getTrip();
  return trip ? `./data/${encodeURIComponent(trip)}/trip.json` : "./trip.json";
}

function buildTripUrl(tripKey) {
  const url = new URL(window.location.href);
  url.searchParams.set("trip", tripKey);
  return url.pathname + url.search;
}

async function loadTripIndex() {
  try {
    const res = await fetch("./data/index.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load data/index.json: ${res.status}`);
    const trips = await res.json();
    return Array.isArray(trips) ? trips : [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

function renderTripMenu(trips) {
  const box = document.getElementById("tripMenu");
  if (!box) return;

  const currentTrip = getTrip();
  box.innerHTML = "";

  if (!Array.isArray(trips) || !trips.length) {
    box.innerHTML = '<span class="muted">目前沒有可用行程清單</span>';
    return;
  }

  trips.forEach((trip) => {
    const a = document.createElement("a");
    a.className = "trip-link" + (trip.key === currentTrip ? " active" : "");
    a.href = buildTripUrl(trip.key);
    a.textContent = trip.label || trip.key;
    box.appendChild(a);
  });
}

function nonEmpty(v) {
  return v !== undefined && v !== null && String(v).trim() !== "";
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isValidTimeHHmm(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function embedUrl(url) {
  try {
    const u = new URL(url);
    const q = u.searchParams.get("q") || u.searchParams.get("query") || url;
    return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
  } catch {
    return `https://www.google.com/maps?q=${encodeURIComponent(url || "台灣")}&output=embed`;
  }
}

function setStatus(text) {
  const el = document.getElementById("loadStatus");
  if (el) el.textContent = text;
}

function formatMoney(amount, currency = "TWD", locale = "zh-TW") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function formatUnit(unit) {
  const map = {
    per_person: "/ 人",
    per_group: "/ 組",
    per_night: "/ 晚",
    none: "",
  };
  return map[unit] || "";
}

function getDefaults(data) {
  return {
    currency: data?.defaults?.currency || "TWD",
    locale: data?.defaults?.locale || "zh-TW",
    price_unit: data?.defaults?.price_unit || "per_person",
  };
}

function formatPrice(price, defaults) {
  if (!price) return "";
  if (price.kind === "free") return "免費";

  const unit = formatUnit(price.unit || defaults.price_unit);

  if (price.kind === "fixed") {
    return `${formatMoney(price.amount, defaults.currency, defaults.locale)} ${unit}`.trim();
  }

  if (price.kind === "range") {
    return `${formatMoney(price.min, defaults.currency, defaults.locale)} - ${formatMoney(price.max, defaults.currency, defaults.locale)} ${unit}`.trim();
  }

  return "";
}

function formatPriceOptions(options, defaults) {
  if (!Array.isArray(options) || !options.length) return "";
  return options
    .map((opt) => {
      const unit = formatUnit(opt.unit || defaults.price_unit);
      return `${opt.label || ""}：${formatMoney(opt.amount, defaults.currency, defaults.locale)} ${unit}`.trim();
    })
    .join("；");
}

function formatDuration(min) {
  if (min === undefined || min === null || min === "") return "";
  const value = Number(min);
  if (Number.isNaN(value)) return "";
  if (value < 60) return `${value} 分`;
  const h = Math.floor(value / 60);
  const m = value % 60;
  return m ? `${h} 小時 ${m} 分` : `${h} 小時`;
}

function formatTimeRange(start, end) {
  if (!start && !end) return "";
  if (start && end) return `${start}–${end}`;
  return start || end || "";
}

function resolvePhotoSrc(photo) {
  return photo?.src || "";
}

function renderPhotos(photos) {
  if (!Array.isArray(photos) || !photos.length) return "";
  return `
    <div class="photo-strip">
      ${photos
        .map(
          (photo) => `
            <img
              class="spot-photo"
              src="${escapeHtml(resolvePhotoSrc(photo))}"
              alt="${escapeHtml(photo.alt || "")}"
              loading="lazy"
            />`
        )
        .join("")}
    </div>`;
}

function normalizeStayGroups(data) {
  if (Array.isArray(data.stay_groups) && data.stay_groups.length) return data.stay_groups;
  const grouped = {};
  (data.stays || []).forEach((item) => {
    const key = item.area || "other";
    if (!grouped[key]) grouped[key] = { key, label: key, items: [] };
    grouped[key].items.push(item);
  });
  return Object.values(grouped);
}

function normalizeShopGroups(data) {
  if (Array.isArray(data.shop_groups) && data.shop_groups.length) return data.shop_groups;
  const grouped = {};
  (data.shops || []).forEach((item) => {
    const key = item.tag || "other";
    if (!grouped[key]) grouped[key] = { key, label: key || "資訊", items: [] };
    grouped[key].items.push(item);
  });
  return Object.values(grouped);
}

function makeMapTarget(item) {
  if (nonEmpty(item?.map)) return item.map;
  if (nonEmpty(item?.address)) return `https://www.google.com/maps?q=${encodeURIComponent(item.address)}`;
  return "";
}

function extraFields(obj, hiddenKeys) {
  return Object.entries(obj || {}).filter(([k, v]) => {
    if (hiddenKeys.includes(k)) return false;
    if (!nonEmpty(v)) return false;
    if (typeof v === "object") return false;
    return true;
  });
}

function renderExtraRows(entries) {
  if (!entries.length) return "";
  return `
    <div class="extras">
      ${entries
        .map(
          ([k, v]) => `<div class="extra-row"><strong>${escapeHtml(k)}：</strong>${escapeHtml(Array.isArray(v) ? v.join("、") : v)}</div>`
        )
        .join("")}
    </div>`;
}

function buildMapButton(mapId) {
  if (!nonEmpty(mapId)) return "";
  return `<button type="button" class="btn map-switch-btn" data-mapid="${escapeHtml(mapId)}">切換地圖</button>`;
}

function updateActiveStates() {
  document.querySelectorAll("[data-mapid]").forEach((el) => {
    if (el.classList.contains("map-switch-btn")) return;
    el.classList.toggle("active-map", el.dataset.mapid === currentMapId);
  });
  document.querySelectorAll(".location").forEach((el) => {
    el.classList.toggle("active", el.dataset.mapid === currentMapId);
  });
}

function focusMapById(mapId) {
  const item = currentLocations.find((x) => x.id === mapId);
  if (!item) return;

  currentMapId = mapId;
  document.getElementById("mapFrame").src = embedUrl(item.map);
  document.getElementById("mapFocus").innerHTML = `
    <div class="small muted">${escapeHtml(item.source)}</div>
    <h3>${escapeHtml(item.title)}</h3>
    ${nonEmpty(item.subtitle) ? `<div class="map-focus-subtitle muted">${escapeHtml(item.subtitle)}</div>` : ""}
    ${nonEmpty(item.address) ? `<div class="map-focus-address"><strong>地址：</strong>${escapeHtml(item.address)}</div>` : ""}
    <div class="actions">
      <a class="btn secondary" href="${escapeHtml(item.map)}" target="_blank" rel="noopener noreferrer">開啟 Google Maps</a>
    </div>`;

  updateActiveStates();
}

function rebuildLocationList(locations) {
  currentLocations = locations;
  const box = document.getElementById("locationList");
  box.innerHTML = "";

  if (!locations.length) {
    document.getElementById("mapFrame").src = embedUrl("台灣");
    document.getElementById("mapFocus").innerHTML = '<div class="muted">目前沒有可顯示的 map / address 資料。</div>';
    return;
  }

  locations.forEach((loc, idx) => {
    const div = document.createElement("div");
    div.className = "location" + (idx === 0 ? " active" : "");
    div.dataset.mapid = loc.id;
    div.innerHTML = `
      <div class="loc-title">${escapeHtml(loc.title)}</div>
      ${nonEmpty(loc.address) ? `<div class="loc-sub">${escapeHtml(loc.address)}</div>` : ""}`;
    div.addEventListener("click", () => focusMapById(loc.id));
    box.appendChild(div);
  });

  focusMapById(locations[0].id);
}

function collectLocations(data, stayGroups, shopGroups, defaults) {
  const locations = [];
  let seq = 0;

  (data.days || []).forEach((day, dayIndex) =>
    (day.stops || []).forEach((stop, stopIndex) => {
      const map = makeMapTarget(stop);
      if (!map) return;
      const timeText = formatTimeRange(stop.start_time, stop.end_time) || stop.time || "";
      const priceText = formatPrice(stop.price, defaults) || stop.cost || "";
      locations.push({
        id: `day-${day.key || dayIndex}-${stopIndex}`,
        map,
        source: `${data.day_tabs_name || "每日行程"} / ${day.label || `Day ${dayIndex + 1}`}`,
        title: stop.maps_label || stop.name || "地點",
        subtitle: [stop.type, timeText, priceText].filter(Boolean).join("｜"),
        address: stop.short_address || stop.address || "",
        order: seq++,
      });
    })
  );

  stayGroups.forEach((group, groupIndex) =>
    (group.items || []).forEach((item, itemIndex) => {
      const map = makeMapTarget(item);
      if (!map) return;
      locations.push({
        id: `stay-${group.key || groupIndex}-${itemIndex}`,
        map,
        source: `${data.stay_tabs_name || "住宿資訊"} / ${group.label || "住宿"}`,
        title: item.name || "住宿",
        subtitle: item.note || item.reference || "",
        address: item.address || item.area || "",
        order: seq++,
      });
    })
  );

  shopGroups.forEach((group, groupIndex) =>
    (group.items || []).forEach((item, itemIndex) => {
      const map = makeMapTarget(item);
      if (!map) return;
      const itemPrice = formatPrice(item.price, defaults) || formatPriceOptions(item.price_options, defaults);
      locations.push({
        id: `shop-${group.key || groupIndex}-${itemIndex}`,
        map,
        source: `${data.shop_tabs_name || "資訊分類"} / ${group.label || "資訊"}`,
        title: item.name || "店家",
        subtitle: [item.tag, itemPrice, item.note].filter(Boolean).join("｜"),
        address: item.address || "",
        order: seq++,
      });
    })
  );

  return locations;
}

function attachMapInteractions() {
  document.querySelectorAll(".map-target").forEach((card) => {
    card.addEventListener("click", (event) => {
      const isAnchor = event.target.closest("a");
      if (isAnchor) return;
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

function validatePrice(price, path, errors) {
  if (!isObject(price)) {
    errors.push(`${path} 必須是 object`);
    return;
  }

  const allowedKinds = ["fixed", "range", "free"];
  if (!allowedKinds.includes(price.kind)) {
    errors.push(`${path}.kind 必須是 fixed / range / free`);
    return;
  }

  if (price.kind === "fixed" && typeof price.amount !== "number") {
    errors.push(`${path}.amount 必須是數字`);
  }

  if (price.kind === "range") {
    if (typeof price.min !== "number") errors.push(`${path}.min 必須是數字`);
    if (typeof price.max !== "number") errors.push(`${path}.max 必須是數字`);
  }

  if (price.unit !== undefined) {
    const allowedUnits = ["per_person", "per_group", "per_night", "none"];
    if (!allowedUnits.includes(price.unit)) {
      errors.push(`${path}.unit 必須是 per_person / per_group / per_night / none`);
    }
  }
}

function validatePhotos(photos, path, errors) {
  if (!Array.isArray(photos)) {
    errors.push(`${path} 必須是陣列`);
    return;
  }

  photos.forEach((photo, index) => {
    const p = `${path}[${index}]`;
    if (!isObject(photo)) {
      errors.push(`${p} 必須是 object`);
      return;
    }
    if (!["static", "url"].includes(photo.type)) {
      errors.push(`${p}.type 必須是 static / url`);
    }
    if (!isNonEmptyString(photo.src)) {
      errors.push(`${p}.src 必填且必須是字串`);
    }
    if (photo.alt !== undefined && typeof photo.alt !== "string") {
      errors.push(`${p}.alt 必須是字串`);
    }
  });
}

function validateTripData(data) {
  const errors = [];

  if (!isObject(data)) {
    return { valid: false, errors: ["根節點必須是 object"] };
  }

  if (!isNonEmptyString(data.title)) {
    errors.push("title 必填，且必須是非空字串");
  }

  if (data.defaults !== undefined) {
    if (!isObject(data.defaults)) {
      errors.push("defaults 必須是 object");
    } else {
      if (data.defaults.currency !== undefined && typeof data.defaults.currency !== "string") {
        errors.push("defaults.currency 必須是字串");
      }
      if (data.defaults.locale !== undefined && typeof data.defaults.locale !== "string") {
        errors.push("defaults.locale 必須是字串");
      }
      if (
        data.defaults.price_unit !== undefined &&
        !["per_person", "per_group", "per_night", "none"].includes(data.defaults.price_unit)
      ) {
        errors.push("defaults.price_unit 格式錯誤");
      }
    }
  }

  if (data.days !== undefined && !Array.isArray(data.days)) {
    errors.push("days 必須是陣列");
  }

  if (Array.isArray(data.days)) {
    data.days.forEach((day, dayIndex) => {
      if (!isObject(day)) {
        errors.push(`days[${dayIndex}] 必須是 object`);
        return;
      }

      if (!isNonEmptyString(day.key)) {
        errors.push(`days[${dayIndex}].key 必填`);
      }

      if (day.stops !== undefined && !Array.isArray(day.stops)) {
        errors.push(`days[${dayIndex}].stops 必須是陣列`);
      }

      if (Array.isArray(day.stops)) {
        day.stops.forEach((stop, stopIndex) => {
          const path = `days[${dayIndex}].stops[${stopIndex}]`;
          if (!isObject(stop)) {
            errors.push(`${path} 必須是 object`);
            return;
          }
          if (!isNonEmptyString(stop.name)) {
            errors.push(`${path}.name 必填`);
          }
          if (stop.start_time !== undefined && !isValidTimeHHmm(stop.start_time)) {
            errors.push(`${path}.start_time 必須是 HH:mm`);
          }
          if (stop.end_time !== undefined && !isValidTimeHHmm(stop.end_time)) {
            errors.push(`${path}.end_time 必須是 HH:mm`);
          }
          if (stop.duration_min !== undefined && typeof stop.duration_min !== "number") {
            errors.push(`${path}.duration_min 必須是數字`);
          }
          if (stop.transit_to_next_min !== undefined && typeof stop.transit_to_next_min !== "number") {
            errors.push(`${path}.transit_to_next_min 必須是數字`);
          }
          if (stop.price !== undefined) {
            validatePrice(stop.price, `${path}.price`, errors);
          }
          if (stop.photos !== undefined) {
            validatePhotos(stop.photos, `${path}.photos`, errors);
          }
        });
      }
    });
  }

  if (data.shop_groups !== undefined && !Array.isArray(data.shop_groups)) {
    errors.push("shop_groups 必須是陣列");
  }

  if (Array.isArray(data.shop_groups)) {
    data.shop_groups.forEach((group, groupIndex) => {
      if (!isObject(group)) {
        errors.push(`shop_groups[${groupIndex}] 必須是 object`);
        return;
      }
      if (!Array.isArray(group.items)) {
        errors.push(`shop_groups[${groupIndex}].items 必須是陣列`);
        return;
      }
      group.items.forEach((item, itemIndex) => {
        const path = `shop_groups[${groupIndex}].items[${itemIndex}]`;
        if (!isObject(item)) {
          errors.push(`${path} 必須是 object`);
          return;
        }
        if (!isNonEmptyString(item.name)) {
          errors.push(`${path}.name 必填`);
        }
        if (item.price !== undefined) {
          validatePrice(item.price, `${path}.price`, errors);
        }
        if (item.price_options !== undefined) {
          if (!Array.isArray(item.price_options)) {
            errors.push(`${path}.price_options 必須是陣列`);
          } else {
            item.price_options.forEach((opt, optIndex) => {
              const optPath = `${path}.price_options[${optIndex}]`;
              if (!isObject(opt)) {
                errors.push(`${optPath} 必須是 object`);
                return;
              }
              if (!isNonEmptyString(opt.label)) {
                errors.push(`${optPath}.label 必填`);
              }
              if (typeof opt.amount !== "number") {
                errors.push(`${optPath}.amount 必須是數字`);
              }
            });
          }
        }
        if (item.photos !== undefined) {
          validatePhotos(item.photos, `${path}.photos`, errors);
        }
      });
    });
  }

  return { valid: errors.length === 0, errors };
}

function renderValidationError(errors) {
  const dayContent = document.getElementById("dayContent");
  const reminderList = document.getElementById("reminderList");
  const budgetContent = document.getElementById("budgetContent");
  const stayContent = document.getElementById("stayContent");
  const shopContent = document.getElementById("shopContent");
  const locationList = document.getElementById("locationList");
  const mapFocus = document.getElementById("mapFocus");
  const mapFrame = document.getElementById("mapFrame");

  const html = `
    <div class="error-box">
      <strong>trip.json 結構驗證失敗</strong><br>
      ${errors.map((e) => `- ${escapeHtml(e)}`).join("<br>")}
    </div>`;

  if (dayContent) dayContent.innerHTML = html;
  if (reminderList) reminderList.innerHTML = "";
  if (budgetContent) budgetContent.innerHTML = "";
  if (stayContent) stayContent.innerHTML = "";
  if (shopContent) shopContent.innerHTML = "";
  if (locationList) locationList.innerHTML = "";
  if (mapFocus) mapFocus.innerHTML = '<div class="muted">資料格式錯誤，無法顯示地圖。</div>';
  if (mapFrame) mapFrame.src = "";
}

function render(data) {
  currentMapId = "";
  const defaults = getDefaults(data);

  document.getElementById("title").textContent = data.title || "";
  document.getElementById("subtitle").textContent = data.subtitle || "";
  document.getElementById("dates").textContent = data.dates || "";
  document.getElementById("travelers").textContent = `${data.travelers || 0} 人`;
  document.getElementById("budgetPerPerson").textContent = `${formatMoney(data.budget_per_person || 0, defaults.currency, defaults.locale)} / 人`;
  document.getElementById("nights").textContent = data.nights || "";
  document.getElementById("dayTabsName").textContent = data.day_tabs_name || "每日行程";
  document.getElementById("stayTabsName").textContent = data.stay_tabs_name || "住宿資訊";
  document.getElementById("shopTabsName").textContent = data.shop_tabs_name || "店家 / 活動 / 交通資訊";
  document.getElementById("budgetTabsName").textContent = data.budget_tabs_name || "預算表";

  const reminderList = document.getElementById("reminderList");
  reminderList.innerHTML = "";
  (data.reminders || []).forEach((r) => {
    const div = document.createElement("div");
    div.className = "item-card";
    div.textContent = r;
    reminderList.appendChild(div);
  });

  const stayGroups = normalizeStayGroups(data);
  const shopGroups = normalizeShopGroups(data);

  const dayTabs = document.getElementById("dayTabs");
  const dayContent = document.getElementById("dayContent");
  dayTabs.innerHTML = "";
  let activeDay = (data.days && data.days[0] && data.days[0].key) || "";

  function renderDay(key) {
    const day = (data.days || []).find((d) => d.key === key) || (data.days || [])[0];
    if (!day) {
      dayContent.innerHTML = '<div class="item-card">沒有行程資料</div>';
      return;
    }

    const stopsHtml = (day.stops || [])
      .map((stop, idx) => {
        const mapId = `day-${day.key || "day"}-${idx}`;
        const mapTarget = makeMapTarget(stop);
        const timeText = formatTimeRange(stop.start_time, stop.end_time) || stop.time || "";
        const durationText = formatDuration(stop.duration_min) || stop.stay || "";
        const transitText = formatDuration(stop.transit_to_next_min);
        const priceText = formatPrice(stop.price, defaults) || stop.cost || "";
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
              ${nonEmpty(stop.next_label || stop.next) ? `<span class="pill">前往下一站：${escapeHtml(stop.next_label || stop.next)}</span>` : ""}
            </div>
          </div>`;
      })
      .join("");

    dayContent.innerHTML = `
      <div class="day-header">
        <div class="small muted">${escapeHtml(day.label || "")}</div>
        <div class="day-header-title">${escapeHtml(day.title || "")}</div>
        ${nonEmpty(day.theme) ? `<div class="day-header-theme muted">${escapeHtml(day.theme)}</div>` : ""}
        ${nonEmpty(day.hero) ? `<div class="day-header-hero"><span class="badge">重點：${escapeHtml(day.hero)}</span></div>` : ""}
      </div>
      <div class="stops">${stopsHtml}</div>`;

    [...dayTabs.querySelectorAll(".tab-btn")].forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.key === day.key);
    });

    attachMapInteractions();
    updateActiveStates();
  }

  (data.days || []).forEach((day, index) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (day.key === activeDay ? " active" : "");
    btn.textContent = day.label || `Day ${index + 1}`;
    btn.dataset.key = day.key;
    btn.onclick = () => {
      activeDay = day.key;
      renderDay(day.key);
    };
    dayTabs.appendChild(btn);
  });
  renderDay(activeDay);

  const stayTabs = document.getElementById("stayTabs");
  const stayContent = document.getElementById("stayContent");
  stayTabs.innerHTML = "";
  let activeStay = (stayGroups[0] && stayGroups[0].key) || "";

  function renderStayGroup(key) {
    const group = stayGroups.find((g) => g.key === key) || stayGroups[0];
    if (!group) {
      stayContent.innerHTML = '<div class="item-card">沒有住宿資料</div>';
      return;
    }

    stayContent.innerHTML =
      "<div class='list'>" +
      (group.items || [])
        .map((s, idx) => {
          const mapTarget = makeMapTarget(s);
          const mapId = `stay-${group.key || "stay"}-${idx}`;
          const extras = renderExtraRows(
            extraFields(s, ["area", "name", "note", "link", "map", "address", "photos"])
          );
          const photosHtml = renderPhotos(s.photos);

          return `
            <div class="item-card${mapTarget ? " map-target" : ""}"${mapTarget ? ` data-mapid="${escapeHtml(mapId)}"` : ""}>
              <div class="item-card-top">
                <strong>${escapeHtml(s.name || "")}</strong>
                <span class="badge">${escapeHtml(s.area || group.label || "")}</span>
              </div>
              ${nonEmpty(s.note) ? `<div class="muted small item-card-note">${escapeHtml(s.note)}</div>` : ""}
              ${nonEmpty(s.address) ? `<div class="extra-row item-card-address"><strong>地址：</strong>${escapeHtml(s.address)}</div>` : ""}
              ${photosHtml}
              ${extras}
              <div class="actions">
                ${buildMapButton(mapTarget ? mapId : "")}
                ${nonEmpty(s.link) ? `<a class="btn secondary" href="${escapeHtml(s.link)}" target="_blank" rel="noopener noreferrer">查看住宿</a>` : ""}
              </div>
            </div>`;
        })
        .join("") +
      "</div>";

    [...stayTabs.querySelectorAll(".tab-btn")].forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.key === group.key);
    });

    attachMapInteractions();
    updateActiveStates();
  }

  stayGroups.forEach((group, index) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (group.key === activeStay ? " active" : "");
    btn.textContent = group.label || `群組 ${index + 1}`;
    btn.dataset.key = group.key;
    btn.onclick = () => {
      activeStay = group.key;
      renderStayGroup(group.key);
    };
    stayTabs.appendChild(btn);
  });
  renderStayGroup(activeStay);

  const shopTabs = document.getElementById("shopTabs");
  const shopContent = document.getElementById("shopContent");
  shopTabs.innerHTML = "";
  let activeShop = (shopGroups[0] && shopGroups[0].key) || "";

  function renderShopGroup(key) {
    const group = shopGroups.find((g) => g.key === key) || shopGroups[0];
    if (!group) {
      shopContent.innerHTML = '<div class="item-card">沒有店家 / 活動資料</div>';
      return;
    }

    shopContent.innerHTML =
      "<div class='list'>" +
      (group.items || [])
        .map((s, idx) => {
          const mapTarget = makeMapTarget(s);
          const mapId = `shop-${group.key || "shop"}-${idx}`;
          const itemPrice = formatPrice(s.price, defaults);
          const itemPriceOptions = formatPriceOptions(s.price_options, defaults);
          const extras = renderExtraRows(
            extraFields(s, ["name", "tag", "price", "price_options", "note", "link", "map", "address", "photos"])
          );
          const photosHtml = renderPhotos(s.photos);

          return `
            <div class="item-card${mapTarget ? " map-target" : ""}"${mapTarget ? ` data-mapid="${escapeHtml(mapId)}"` : ""}>
              <div class="item-card-top">
                <strong>${escapeHtml(s.name || "")}</strong>
                <span class="badge">${escapeHtml(s.tag || group.label || "資訊")}</span>
              </div>
              ${itemPrice ? `<div class="item-price">${escapeHtml(itemPrice)}</div>` : ""}
              ${itemPriceOptions ? `<div class="muted small item-price-options">${escapeHtml(itemPriceOptions)}</div>` : ""}
              ${nonEmpty(s.note) ? `<div class="muted small item-card-note">${escapeHtml(s.note)}</div>` : ""}
              ${nonEmpty(s.address) ? `<div class="extra-row item-card-address"><strong>地址：</strong>${escapeHtml(s.address)}</div>` : ""}
              ${photosHtml}
              ${extras}
              <div class="actions">
                ${buildMapButton(mapTarget ? mapId : "")}
                ${nonEmpty(s.link) ? `<a class="btn secondary" href="${escapeHtml(s.link)}" target="_blank" rel="noopener noreferrer">查看連結</a>` : ""}
              </div>
            </div>`;
        })
        .join("") +
      "</div>";

    [...shopTabs.querySelectorAll(".tab-btn")].forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.key === group.key);
    });

    attachMapInteractions();
    updateActiveStates();
  }

  shopGroups.forEach((group, index) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (group.key === activeShop ? " active" : "");
    btn.textContent = group.label || `分類 ${index + 1}`;
    btn.dataset.key = group.key;
    btn.onclick = () => {
      activeShop = group.key;
      renderShopGroup(group.key);
    };
    shopTabs.appendChild(btn);
  });
  renderShopGroup(activeShop);

  const budgetTabs = document.getElementById("budgetTabs");
  const budgetContent = document.getElementById("budgetContent");
  budgetTabs.innerHTML = "";
  const grandTotal = (data.budget_items || []).reduce((a, b) => a + Number(b.value || 0), 0);
  let activeBudget = "總額";

  function renderBudget(label) {
    if (label === "總額") {
      budgetContent.innerHTML = `
        <div class="item-card">
          <div class="budget-summary-row">
            <strong>總額</strong>
            <span class="badge">${formatMoney(grandTotal, defaults.currency, defaults.locale)}</span>
          </div>
          <div class="details-wrap">
            ${(data.budget_items || [])
              .map(
                (item) => `<div class="details-row"><div><strong>${escapeHtml(item.label || "")}</strong></div><div>${formatMoney(item.value || 0, defaults.currency, defaults.locale)}</div></div>`
              )
              .join("")}
          </div>
          <div class="summary-box">
            <div class="summary-box-label small">全部分類加總</div>
            <div class="summary-box-value">${formatMoney(grandTotal, defaults.currency, defaults.locale)}</div>
          </div>
        </div>`;
    } else {
      const item = (data.budget_items || []).find((b) => b.label === label) || (data.budget_items || [])[0];
      if (!item) return;
      const details = Array.isArray(item.details) ? item.details : [];
      const detailsSum = details.reduce((a, b) => a + Number(b.amount || 0), 0);
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
              ? `<div class="details-wrap">
                  ${details
                    .map(
                      (d) => `<div class="details-row"><div><strong>${escapeHtml(d.name || "項目")}</strong>${nonEmpty(d.note) ? `<div class="small muted detail-note">${escapeHtml(d.note)}</div>` : ""}</div><div>${formatMoney(d.amount || 0, defaults.currency, defaults.locale)}</div></div>`
                    )
                    .join("")}
                </div>
                <div class="summary-box">
                  <div class="summary-box-label small">明細加總</div>
                  <div class="summary-box-value">${formatMoney(detailsSum, defaults.currency, defaults.locale)}</div>
                </div>`
              : '<div class="small muted budget-empty-note">尚未提供明細</div>'
          }
        </div>`;
    }

    [...budgetTabs.querySelectorAll(".tab-btn")].forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.key === label);
    });
  }

  const totalBtn = document.createElement("button");
  totalBtn.className = "tab-btn active";
  totalBtn.textContent = "總額";
  totalBtn.dataset.key = "總額";
  totalBtn.onclick = () => {
    activeBudget = "總額";
    renderBudget("總額");
  };
  budgetTabs.appendChild(totalBtn);

  (data.budget_items || []).forEach((item, index) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn";
    btn.textContent = item.label || `分類 ${index + 1}`;
    btn.dataset.key = item.label;
    btn.onclick = () => {
      activeBudget = item.label;
      renderBudget(item.label);
    };
    budgetTabs.appendChild(btn);
  });
  renderBudget(activeBudget);

  const locations = collectLocations(data, stayGroups, shopGroups, defaults);
  rebuildLocationList(locations);
  attachMapInteractions();
  updateActiveStates();
}

async function loadDefaultJson() {
  try {
    const jsonUrl = resolveJsonPath();
    const res = await fetch(jsonUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const validation = validateTripData(data);
    if (!validation.valid) {
      console.error(validation.errors);
      setStatus("資料格式錯誤");
      renderValidationError(validation.errors);
      return;
    }

    render(data);
    const trip = getTrip();
    setStatus(trip ? `目前行程：${trip}` : "預設行程");
  } catch (err) {
    console.error(err);
    setStatus("載入失敗");
    renderValidationError(["無法載入 JSON", err.message || ""]);
  }
}

async function bootstrap() {
  const trips = await loadTripIndex();
  renderTripMenu(trips);
  await loadDefaultJson();
}

bootstrap();
