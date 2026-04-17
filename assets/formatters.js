import { nonEmpty, escapeHtml } from "./dom-helpers.js";

export function formatMoney(amount, currency = "TWD", locale = "zh-TW") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

export function formatUnit(unit) {
  return {
    per_person: "/ 人",
    per_group: "/ 組",
    per_night: "/ 晚",
    none: "",
  }[unit] || "";
}

export function getDefaults(data) {
  return {
    currency: data?.defaults?.currency || "TWD",
    locale: data?.defaults?.locale || "zh-TW",
    price_unit: data?.defaults?.price_unit || "per_person",
  };
}

export function formatPrice(price, defaults) {
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

export function formatPriceOptions(options, defaults) {
  if (!Array.isArray(options) || !options.length) return "";
  return options
    .map((opt) => {
      const unit = formatUnit(opt.unit || defaults.price_unit);
      return `${opt.label || ""}：${formatMoney(opt.amount, defaults.currency, defaults.locale)} ${unit}`.trim();
    })
    .join("；");
}

export function formatDuration(min) {
  if (min === undefined || min === null || min === "") return "";
  const value = Number(min);
  if (Number.isNaN(value)) return "";
  if (value < 60) return `${value} 分`;
  const h = Math.floor(value / 60);
  const m = value % 60;
  return m ? `${h} 小時 ${m} 分` : `${h} 小時`;
}

export function formatTimeRange(start, end) {
  if (!start && !end) return "";
  if (start && end) return `${start}–${end}`;
  return start || end || "";
}

export function resolveStopTimeText(stop) {
  return formatTimeRange(stop.start_time, stop.end_time) || stop.time || "";
}

export function resolveStopDurationText(stop) {
  return formatDuration(stop.duration_min) || stop.stay || "";
}

export function resolveStopTransitText(stop) {
  return formatDuration(stop.transit_to_next_min);
}

export function resolveStopPriceText(stop, defaults) {
  return formatPrice(stop.price, defaults) || stop.cost || "";
}

export function resolveShopPriceText(item, defaults) {
  return formatPrice(item.price, defaults) || "";
}

export function resolveShopPriceOptionsText(item, defaults) {
  return formatPriceOptions(item.price_options, defaults) || "";
}

export function resolvePhotoSrc(photo) {
  return photo?.src || "";
}

export function renderPhotos(photos) {
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

export function buildMapButton(mapId) {
  if (!nonEmpty(mapId)) return "";
  return `<button type="button" class="btn map-switch-btn" data-mapid="${escapeHtml(mapId)}">切換地圖</button>`;
}
