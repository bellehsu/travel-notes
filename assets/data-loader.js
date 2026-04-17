async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${url}`);
  }
  return res.json();
}

export async function loadData(route) {
  switch (route.page) {
    case "home":
      return fetchJson("/data/catalog.json");
    case "trip":
      return fetchJson(`/data/trips/${encodeURIComponent(route.tripSlug)}.json`);
    default:
      return null;
  }
}
