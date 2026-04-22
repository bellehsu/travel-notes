export function buildTripUrl(tripSlug) {
  return `/trips/${encodeURIComponent(tripSlug)}/`;
}

export function buildDestinationUrl(countryCode, destinationSlug) {
  return `/destinations/${encodeURIComponent(countryCode)}/${encodeURIComponent(destinationSlug)}/`;
}

export function buildDestinationPageUrl(countryCode, destinationSlug, pageSlug) {
  return `/destinations/${encodeURIComponent(countryCode)}/${encodeURIComponent(destinationSlug)}/${encodeURIComponent(pageSlug)}/`;
}
