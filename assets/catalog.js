function getCountry() {
  const params = new URLSearchParams(window.location.search);
  return params.get("country")?.trim() || "";
}

function buildDirectoryUrl(countryKey) {
  const url = new URL(window.location.href);
  url.searchParams.set("country", countryKey);
  return url.pathname + url.search;
}

function buildTripUrl(countryKey, tripKey) {
  const url = new URL("./index.html", window.location.href);
  url.searchParams.set("country", countryKey);
  url.searchParams.set("trip", tripKey);
  return url.pathname + url.search;
}

async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderCountryTabs(countries, activeCountry) {
  const box = document.getElementById("countryTabs");
  box.innerHTML = countries.map((item) => `
    <a
      class="catalog-tab${item.key === activeCountry ? " active" : ""}"
      href="${buildDirectoryUrl(item.key)}"
    >
      ${escapeHtml(item.label)}
    </a>
  `).join("");
}

function renderCountryGrid(countries, activeCountry) {
  const box = document.getElementById("countryGrid");
  box.innerHTML = countries.map((item) => `
    <a
      class="country-card${item.key === activeCountry ? " active" : ""}"
      href="${buildDirectoryUrl(item.key)}"
    >
      <div class="country-cover" style="background-image:url('${escapeHtml(item.cover || "")}')"></div>
      <div class="country-body">
        <h3>${escapeHtml(item.label)}</h3>
        <p>${escapeHtml(item.description || "")}</p>
      </div>
    </a>
  `).join("");
}

function renderTripGrid(countryLabel, countryKey, trips) {
  const title = document.getElementById("tripSectionTitle");
  const box = document.getElementById("tripGrid");

  title.textContent = countryLabel ? `${countryLabel} 行程列表` : "行程列表";

  if (!trips.length) {
    box.innerHTML = `<div class="empty-box">目前沒有行程</div>`;
    return;
  }

  box.innerHTML = trips.map((trip) => `
    <a class="trip-card" href="${buildTripUrl(countryKey, trip.key)}">
      <div class="trip-cover" style="background-image:url('${escapeHtml(trip.cover || "")}')"></div>
      <div class="trip-body">
        <div class="trip-card-top">
          <h3>${escapeHtml(trip.label)}</h3>
          <div class="trip-meta">${trip.days || "-"} 天 / ${trip.nights || "-"} 晚</div>
        </div>
        <p>${escapeHtml(trip.summary || "")}</p>
        <div class="trip-tags">
          ${(trip.tags || []).map(tag => `<span class="trip-tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </div>
    </a>
  `).join("");
}

async function bootstrap() {
  const countries = await fetchJson("./data/catalog.json");
  const activeCountry = getCountry() || countries[0]?.key || "";
  const currentCountry = countries.find((x) => x.key === activeCountry) || countries[0];

  renderCountryTabs(countries, activeCountry);
  renderCountryGrid(countries, activeCountry);

  if (!currentCountry) {
    renderTripGrid("", "", []);
    return;
  }

  const trips = await fetchJson(`./data/${encodeURIComponent(currentCountry.key)}/index.json`);
  renderTripGrid(currentCountry.label, currentCountry.key, Array.isArray(trips) ? trips : []);
}

bootstrap();
