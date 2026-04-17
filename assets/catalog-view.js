import { escapeHtml } from "./utils.js";
import { buildTripUrl } from "./routes.js";

function validateCatalogTrips(trips) {
  trips.forEach(t => {
    if (!t.slug) {
      console.error("Trip missing slug:", t);
    }
  });
}

function renderTripGrid(trips) {
  if (!Array.isArray(trips) || !trips.length) {
    return `<div class="empty-box">目前沒有行程</div>`;
  }

  return `
    <div class="trip-grid">
      ${trips
        .map(
          (trip) => `
            <a class="trip-card" href="${buildTripUrl(trip.slug)}">
              <div class="trip-cover" style="background-image:url('${escapeHtml(trip.cover || trip.coverImage || "")}')"></div>
              <div class="trip-body">
                <div class="trip-card-top">
                  <h3>${escapeHtml(trip.label || trip.title || trip.slug)}</h3>
                  <div class="trip-meta">${trip.days || "-"} 天 / ${trip.nights || "-"} 晚</div>
                </div>
                <p>${escapeHtml(trip.summary || "")}</p>
                <div class="trip-tags">
                  ${(trip.tags || []).map((tag) => `<span class="trip-tag">${escapeHtml(tag)}</span>`).join("")}
                </div>
              </div>
            </a>
          `
        )
        .join("")}
    </div>
  `;
}

export function renderHome(data) {
  const app = document.getElementById("app");
  if (!app) return;
  
  const trips = Array.isArray(data?.trips) ? data.trips : Array.isArray(data) ? data : [];
  validateCatalogTrips(trips);

  app.innerHTML = `
    <div class="catalog-wrap">
      <div class="catalog-hero">
        <p class="catalog-kicker">Travel</p>
        <h1>Travel Directory</h1>
        <p class="catalog-subtitle">所有行程總覽</p>
      </div>

      <section class="catalog-section">
        <div class="catalog-section-head">
          <h2>Trips</h2>
        </div>
        ${renderTripGrid(trips)}
      </section>
    </div>
  `;
}
