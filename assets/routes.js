export function buildTripUrl(tripSlug) {
  return `/trips/${encodeURIComponent(tripSlug)}/`;
}
