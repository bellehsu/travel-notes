export function normalizePath(pathname) {
  if (!pathname) return "/";
  let path = pathname.trim();
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return path || "/";
}

export function nonEmpty(v) {
  return v !== undefined && v !== null && String(v).trim() !== "";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

export function isGoogleShortUrl(url) {
  if (!nonEmpty(url)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "maps.app.goo.gl" || host === "goo.gl" || host.endsWith("goo.gl");
  } catch {
    return false;
  }
}

export function embedUrl(url, fallbackQuery = "台灣") {
  if (!nonEmpty(url)) return `https://www.google.com/maps?q=${encodeURIComponent(fallbackQuery)}&output=embed`;
  try {
    const u = new URL(url);
    if (isGoogleShortUrl(url)) return `https://www.google.com/maps?q=${encodeURIComponent(fallbackQuery)}&output=embed`;
    const q = u.searchParams.get("q") || u.searchParams.get("query") || parseLatLngFromText(url);
    if (typeof q === "object" && q?.lat !== undefined) return `https://www.google.com/maps?q=${q.lat},${q.lng}&output=embed`;
    return `https://www.google.com/maps?q=${encodeURIComponent(q || url)}&output=embed`;
  } catch {
    return `https://www.google.com/maps?q=${encodeURIComponent(url || fallbackQuery)}&output=embed`;
  }
}

export function mapEmbedUrl(item, fallbackQuery = "台灣") {
  const lat = Number(item?.lat);
  const lng = Number(item?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
  const query = item?.address?.full || item?.address || item?.map || item?.name || fallbackQuery;
  return embedUrl(query, fallbackQuery);
}

export function mapOpenUrl(item, fallbackQuery = "") {
  const lat = Number(item?.lat);
  const lng = Number(item?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return `https://maps.google.com/?q=${lat},${lng}`;
  if (nonEmpty(item?.map) && !isGoogleShortUrl(item?.map)) return item.map;
  const query = item?.address?.full || item?.address || item?.name || fallbackQuery;
  return nonEmpty(query) ? `https://maps.google.com/?q=${encodeURIComponent(query)}` : "";
}

export function makeMapTarget(item) {
  if (nonEmpty(item?.map)) return item.map;
  if (nonEmpty(item?.address)) {
    return `https://www.google.com/maps?q=${encodeURIComponent(item.address)}`;
  }
  return "";
}

export function extraFields(obj, hiddenKeys) {
  return Object.entries(obj || {}).filter(([k, v]) => {
    if (hiddenKeys.includes(k)) return false;
    if (!nonEmpty(v)) return false;
    if (typeof v === "object") return false;
    return true;
  });
}

export function renderExtraRows(entries) {
  if (!entries.length) return "";
  return `
    <div class="extras">
      ${entries
        .map(
          ([k, v]) =>
            `<div class="extra-row"><strong>${escapeHtml(k)}：</strong>${escapeHtml(Array.isArray(v) ? v.join("、") : v)}</div>`
        )
        .join("")}
    </div>
  `;
}

export function syncActiveTab(tabContainer, activeKey) {
  [...tabContainer.querySelectorAll(".tab-btn")].forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.key === activeKey);
  });
}
