import { escapeHtml } from "./utils.js";
import { createI18n, resolveLocale } from "./i18n.js";

export function renderHome(data) {
  const locale = resolveLocale(data?.defaults?.locale || "zh-TW");
  const i18n = createI18n(locale);

  const app = document.getElementById("app");
  if (!app) return;

  const trips = Array.isArray(data?.trips) ? data.trips : [];

  app.innerHTML = `
    <div class="catalog-wrap">
      <div class="catalog-hero">
        <p class="catalog-kicker">${escapeHtml(safeT(i18n, "catalogKicker", "Travel"))}</p>
        <h1>${escapeHtml(data?.title || safeT(i18n, "siteTitle", "FoodneTravel"))}</h1>
        <p class="catalog-subtitle">
          ${escapeHtml(data?.subtitle || safeT(i18n, "catalogSubtitle", "Travel notes"))}
        </p>
      </div>

      <section class="catalog-section">
        <div class="catalog-section-head">
          <h2>${escapeHtml(safeT(i18n, "trips", "Trips"))}</h2>
        </div>

        ${
          trips.length
            ? `<div class="trip-grid">${trips.map((trip) => renderTripCard(trip, i18n)).join("")}</div>`
            : `<div class="empty-box">${escapeHtml(safeT(i18n, "noData", "No data"))}</div>`
        }
      </section>
    </div>
  `;
}

function safeT(i18n, key, fallback) {
  const value = i18n?.t?.(key);
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

function renderTripCard(trip, i18n) {
  const slug = trip?.slug || "";
  const href = `/trips/${encodeURIComponent(slug)}/`;

  const title = trip?.title || slug || safeT(i18n, "untitledTrip", "Untitled Trip");
  const summary = trip?.summary || "";
  const coverImage = trip?.coverImage || "";
  const days = Number.isFinite(Number(trip?.days)) ? Number(trip.days) : "";
  const nights = Number.isFinite(Number(trip?.nights)) ? Number(trip.nights) : "";
  const tags = Array.isArray(trip?.tags) ? trip.tags : [];

  const dayUnit = safeT(i18n, "dayUnit", "days");
  const nightUnit = safeT(i18n, "nightUnit", "nights");

  const metaParts = [];
  if (days !== "") metaParts.push(`${days} ${dayUnit}`);
  if (nights !== "") metaParts.push(`${nights} ${nightUnit}`);

  return `
    <a class="trip-card" href="${href}">
      <div
        class="trip-cover"
        ${coverImage ? `style="background-image:url('${escapeHtml(coverImage)}')"` : ""}
      ></div>

      <div class="trip-body">
        <div class="trip-card-top">
          <h3>${escapeHtml(title)}</h3>
          ${metaParts.length ? `<div class="trip-meta">${escapeHtml(metaParts.join(" / "))}</div>` : ""}
        </div>

        ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}

        ${
          tags.length
            ? `
              <div class="trip-tags">
                ${tags.map((tag) => `<span class="trip-tag">${escapeHtml(tag)}</span>`).join("")}
              </div>
            `
            : ""
        }
      </div>
    </a>
  `;
}
