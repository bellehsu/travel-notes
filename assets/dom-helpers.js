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

export function embedUrl(url) {
  try {
    const u = new URL(url);
    const q = u.searchParams.get("q") || u.searchParams.get("query") || url;
    return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
  } catch {
    return `https://www.google.com/maps?q=${encodeURIComponent(url || "台灣")}&output=embed`;
  }
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
