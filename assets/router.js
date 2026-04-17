import { normalizePath } from "./dom-helpers.js";

export function getRoute(pathname = window.location.pathname) {
  const path = normalizePath(pathname);

  if (path === "/") {
    return { page: "home" };
  }

  const tripMatch = path.match(/^\/trips\/([^/]+)$/);
  if (tripMatch) {
    return {
      page: "trip",
      tripSlug: decodeURIComponent(tripMatch[1]),
    };
  }

  return { page: "not-found" };
}
