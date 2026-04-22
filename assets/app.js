import { getRoute } from "./router.js";
import { loadData } from "./data-loader.js";
import { renderHome } from "./catalog-view.js";
import { renderTripPage } from "./trip-view.js";
import { renderDestinationPage } from "./destination-view.js";

function renderNotFound() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="wrap">
      <div class="card">
        <div class="section-head">
          <h2>404</h2>
        </div>
        <div class="section-body">
          <p class="muted">Page not found.</p>
        </div>
      </div>
    </div>
  `;
}

async function bootstrap() {
  const app = document.getElementById("app");
  if (!app) return;

  try {
    const pageType = document.body.dataset.pageType || "";
    const tripSlug = document.body.dataset.tripSlug || "";
    const pageDataEl = document.getElementById("page-data");

    if ((pageType === "destination" || pageType === "destination-seo") && pageDataEl) {
      const data = JSON.parse(pageDataEl.textContent);
      renderDestinationPage(data);
      return;
    }

    if (pageType === "trip" && pageDataEl) {
      const data = JSON.parse(pageDataEl.textContent);
      renderTripPage(data);
      return;
    }

    if (pageType === "home-static") {
      return;
    }

    const route = getRoute();
    const data = await loadData(route);

    switch (route.page) {
      case "home":
        renderHome(data);
        return;
      case "trip":
        renderTripPage(data);
        return;
      default:
        renderNotFound();
    }
  } catch (err) {
    console.error("bootstrap failed:", err);

    app.innerHTML = `
      <div class="wrap">
        <div class="card">
          <div class="section-head">
            <h2>載入失敗</h2>
          </div>
          <div class="section-body">
            <div class="error-box">
              <strong>JS 啟動失敗</strong><br>
              ${String(err?.message || err)}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

bootstrap();
