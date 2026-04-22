import { escapeHtml } from "./utils.js";

export function renderDestinationPage(data) {
  const app = document.getElementById("app");
  if (!app) return;

  const pageType = data?.type || "destination-hub";
  const hero = data?.hero || {};
  const seo = data?.seo || {};

  const featuredTrips = ensureArray(data?.featuredTrips);
  const featuredPages = ensureArray(data?.featuredPages);
  const highlights = ensureArray(data?.highlights);
  const sections = ensureArray(data?.sections);
  const faq = ensureArray(data?.faq);
  const internalLinks = ensureArray(data?.internalLinks);
  const restaurantItems = ensureArray(data?.restaurantItems);
  const areas = ensureArray(data?.areas);
  const collections = ensureArray(data?.collections);
  const cta = data?.cta || null;

  const title = hero.title || data?.displayName || data?.name || seo.title || "Destination";
  const subtitle = hero.subtitle || data?.description || seo.description || "";
  const intro = data?.intro || "";

  app.innerHTML = `
    <div class="catalog-wrap destination-page">
      ${renderHero(pageType, title, subtitle)}

      ${
        intro || highlights.length
          ? `
          <section class="catalog-section">
            <div class="section-head">
              <h2>總覽</h2>
            </div>
            <div class="section-body">
              ${intro ? `<div class="destination-intro">${renderParagraphs(intro)}</div>` : ""}
              ${
                highlights.length
                  ? `
                  <div class="highlight-row">
                    ${highlights.map(renderHighlightChip).join("")}
                  </div>
                `
                  : ""
              }
            </div>
          </section>
        `
          : ""
      }

      ${
        featuredTrips.length
          ? `
          <section class="catalog-section">
            <div class="section-head">
              <h2>推薦行程</h2>
            </div>
            <div class="trip-grid">
              ${featuredTrips.map(renderFeaturedTripCard).join("")}
            </div>
          </section>
        `
          : ""
      }

      ${
        featuredPages.length
          ? `
          <section class="catalog-section">
            <div class="section-head">
              <h2>主題內容</h2>
            </div>
            <div class="section-body">
              <div class="destination-link-list">
                ${featuredPages.map(renderFeaturedPageLink).join("")}
              </div>
            </div>
          </section>
        `
          : ""
      }

      ${
        collections.length
          ? collections.map(renderCollectionSection).join("")
          : ""
      }

      ${
        areas.length
          ? `
          <section class="catalog-section">
            <div class="section-head">
              <h2>重點區域</h2>
            </div>
            <div class="section-body">
              <div class="destination-area-grid">
                ${areas.map(renderAreaCard).join("")}
              </div>
            </div>
          </section>
        `
          : ""
      }

      ${
        restaurantItems.length
          ? `
          <section class="catalog-section">
            <div class="section-head">
              <h2>餐廳整理</h2>
            </div>
            <div class="section-body">
              <div class="list">
                ${restaurantItems.map(renderRestaurantCard).join("")}
              </div>
            </div>
          </section>
        `
          : ""
      }

      ${
        sections.length
          ? sections.map(renderContentSection).join("")
          : ""
      }

      ${
        internalLinks.length
          ? `
          <section class="catalog-section">
            <div class="section-head">
              <h2>延伸閱讀</h2>
            </div>
            <div class="section-body">
              <div class="destination-link-list compact">
                ${internalLinks.map(renderInternalLinkItem).join("")}
              </div>
            </div>
          </section>
        `
          : ""
      }

      ${cta ? renderCtaSection(cta) : ""}

      ${
        faq.length
          ? `
          <section class="catalog-section">
            <div class="section-head">
              <h2>常見問題</h2>
            </div>
            <div class="section-body">
              <div class="faq-list">
                ${faq.map(renderFaqCard).join("")}
              </div>
            </div>
          </section>
        `
          : ""
      }
    </div>
  `;
}

function renderHero(pageType, title, subtitle) {
  return `
    <section class="catalog-hero">
      <p class="catalog-kicker">${escapeHtml(resolveKicker(pageType))}</p>
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<p class="catalog-subtitle">${escapeHtml(subtitle)}</p>` : ""}
    </section>
  `;
}

function renderFeaturedTripCard(trip) {
  const title = trip?.title || "Untitled Trip";
  const summary = trip?.summary || "";
  const coverImage = trip?.coverImage || "";
  const tags = [
    ...ensureArray(trip?.seasonTags),
    ...ensureArray(trip?.themeTags)
  ].slice(0, 6);

  return `
    <a class="trip-card" href="${escapeHtml(trip?.url || "#")}">
      <div
        class="trip-cover"
        ${coverImage ? `style="background-image:url('${escapeHtml(coverImage)}')"` : ""}
      ></div>
      <div class="trip-body">
        <div class="trip-card-top">
          <h3>${escapeHtml(title)}</h3>
          <div class="trip-meta">${escapeHtml(formatTripMeta(trip))}</div>
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

function renderFeaturedPageLink(page) {
  return `
    <a class="destination-link-item" href="${escapeHtml(page?.url || "#")}">
      <div class="destination-link-main">
        <strong>${escapeHtml(page?.title || "內容頁")}</strong>
        ${page?.summary ? `<div class="muted small destination-link-note">${escapeHtml(page.summary)}</div>` : ""}
      </div>
      <span class="destination-link-arrow">→</span>
    </a>
  `;
}

function renderCollectionSection(collection) {
  const items = ensureArray(collection?.items);

  return `
    <section class="catalog-section">
      <div class="section-head">
        <h2>${escapeHtml(collection?.title || "內容集合")}</h2>
      </div>
      <div class="section-body">
        ${
          items.length
            ? `
            <div class="destination-link-list compact">
              ${items
                .map(
                  (item) => `
                  <a class="destination-link-item" href="${escapeHtml(item?.url || "#")}">
                    <div class="destination-link-main">
                      <strong>${escapeHtml(item?.label || item?.title || "內容")}</strong>
                    </div>
                    <span class="destination-link-arrow">→</span>
                  </a>
                `
                )
                .join("")}
            </div>
          `
            : `<div class="empty-box">No data</div>`
        }
      </div>
    </section>
  `;
}

function renderAreaCard(area) {
  const tags = ensureArray(area?.tags);

  return `
    <div class="destination-area-card">
      <div class="item-card-top">
        <strong>${escapeHtml(area?.name || "區域")}</strong>
      </div>
      ${area?.summary ? `<div class="muted small item-card-note">${escapeHtml(area.summary)}</div>` : ""}
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
  `;
}

function renderRestaurantCard(item) {
  return `
    <div class="item-card">
      <div class="item-card-top">
        <strong>${escapeHtml(item?.name || "餐廳")}</strong>
        ${item?.area ? `<span class="badge">${escapeHtml(item.area)}</span>` : ""}
      </div>
      ${item?.note ? `<div class="muted small item-card-note">${escapeHtml(item.note)}</div>` : ""}
      <div class="actions">
        ${item?.map ? `<a class="btn secondary" href="${escapeHtml(item.map)}" target="_blank" rel="noopener noreferrer">Open Map</a>` : ""}
        ${item?.tripSlug ? `<a class="btn secondary" href="/trips/${encodeURIComponent(item.tripSlug)}/">Trip</a>` : ""}
      </div>
    </div>
  `;
}

function renderContentSection(section) {
  const bullets = ensureArray(section?.bullets);

  return `
    <section class="catalog-section">
      <div class="section-head">
        <h2>${escapeHtml(section?.title || "內容")}</h2>
      </div>
      <div class="section-body">
        ${
          section?.summary
            ? `<div class="destination-section-summary">${renderParagraphs(section.summary)}</div>`
            : ""
        }
        ${
          bullets.length
            ? `
            <ul class="destination-bullet-list">
              ${bullets.map((bullet) => `<li>${escapeHtml(String(bullet))}</li>`).join("")}
            </ul>
          `
            : ""
        }
      </div>
    </section>
  `;
}

function renderInternalLinkItem(item) {
  return `
    <a class="destination-link-item" href="${escapeHtml(item?.url || "#")}">
      <div class="destination-link-main">
        <strong>${escapeHtml(item?.label || "前往內容")}</strong>
      </div>
      <span class="destination-link-arrow">→</span>
    </a>
  `;
}

function renderCtaSection(cta) {
  return `
    <section class="catalog-section destination-cta-section">
      <div class="section-body">
        <div class="destination-cta-box">
          <div class="destination-cta-copy">
            <h2>${escapeHtml(cta?.title || "下一步")}</h2>
            ${cta?.body ? `<p>${escapeHtml(cta.body)}</p>` : ""}
          </div>
          ${
            cta?.primaryUrl
              ? `
              <div class="destination-cta-actions">
                <a class="btn" href="${escapeHtml(cta.primaryUrl)}">
                  ${escapeHtml(cta?.primaryLabel || "查看")}
                </a>
              </div>
            `
              : ""
          }
        </div>
      </div>
    </section>
  `;
}

function renderFaqCard(item) {
  return `
    <div class="faq-item">
      <strong>${escapeHtml(item?.q || "")}</strong>
      ${item?.a ? `<p>${escapeHtml(item.a)}</p>` : ""}
    </div>
  `;
}

function renderHighlightChip(text) {
  return `<span class="destination-highlight">${escapeHtml(String(text || ""))}</span>`;
}

function renderParagraphs(text) {
  const parts = String(text || "")
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (!parts.length) return "";

  return parts.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatTripMeta(trip) {
  const parts = [];
  if (Number.isFinite(Number(trip?.days))) parts.push(`${Number(trip.days)} days`);
  if (Number.isFinite(Number(trip?.nights))) parts.push(`${Number(trip.nights)} nights`);
  return parts.join(" / ");
}

function resolveKicker(pageType) {
  if (pageType === "destination-season") return "SEASONAL GUIDE";
  if (pageType === "destination-seo") return "GUIDE";
  return "DESTINATION";
}
