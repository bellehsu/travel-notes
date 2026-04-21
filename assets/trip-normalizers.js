function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizePhoto(photo) {
  if (!photo) return null;

  if (typeof photo === "string") {
    return {
      src: photo,
      alt: "",
    };
  }

  if (isObject(photo) && typeof photo.src === "string") {
    return {
      src: photo.src,
      alt: typeof photo.alt === "string" ? photo.alt : "",
    };
  }

  return null;
}

function normalizePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos.map(normalizePhoto).filter(Boolean);
}

function normalizePrice(price) {
  if (!isObject(price)) return undefined;

  const out = {};

  if (price.kind) {
    out.kind = price.kind;
  } else if (typeof price.amount === "number") {
    out.kind = "fixed";
  } else if (typeof price.min === "number" || typeof price.max === "number") {
    out.kind = "range";
  } else {
    out.kind = "free";
  }

  if (typeof price.amount === "number") out.amount = price.amount;
  if (typeof price.min === "number") out.min = price.min;
  if (typeof price.max === "number") out.max = price.max;
  if (typeof price.unit === "string") out.unit = price.unit;

  return out;
}

function normalizeAddress(address, legacyShortAddress) {
  if (isObject(address)) {
    return {
      short: typeof address.short === "string" ? address.short : "",
      full: typeof address.full === "string" ? address.full : "",
    };
  }

  if (typeof address === "string" || typeof legacyShortAddress === "string") {
    return {
      short: typeof legacyShortAddress === "string" ? legacyShortAddress : "",
      full: typeof address === "string" ? address : "",
    };
  }

  return {
    short: "",
    full: "",
  };
}

function normalizeStop(stop = {}, stopIndex = 0) {
  return {
    id: typeof stop.id === "string" ? stop.id : `stop-${stopIndex + 1}`,

    name: typeof stop.name === "string" ? stop.name : "",
    maps_label: typeof stop.maps_label === "string" ? stop.maps_label : "",
    type: typeof stop.type === "string" ? stop.type : "",

    start_time: typeof stop.start_time === "string" ? stop.start_time : "",
    duration_min: typeof stop.duration_min === "number" ? stop.duration_min : undefined,
    transit_to_next_min:
      typeof stop.transit_to_next_min === "number" ? stop.transit_to_next_min : undefined,

    price: normalizePrice(stop.price),

    address: normalizeAddress(stop.address, stop.short_address),
    map: typeof stop.map === "string" ? stop.map : "",
    note: typeof stop.note === "string" ? stop.note : "",

    photos: normalizePhotos(stop.photos),

    highlight: Boolean(stop.highlight),
    show_in_map_info: stop.show_in_map_info !== false,
  };
}

function normalizeDay(day = {}, dayIndex = 0) {
  const key =
    typeof day.key === "number"
      ? day.key
      : Number.isFinite(Number(day.key))
        ? Number(day.key)
        : dayIndex + 1;

  return {
    key,
    label: typeof day.label === "string" ? day.label : "",
    title: typeof day.title === "string" ? day.title : "",
    theme: typeof day.theme === "string" ? day.theme : "",
    hero: typeof day.hero === "string" ? day.hero : "",
    stops: Array.isArray(day.stops)
      ? day.stops.map((stop, stopIndex) => normalizeStop(stop, stopIndex))
      : [],
  };
}

function normalizeStayItem(item = {}) {
  return {
    area: typeof item.area === "string" ? item.area : "",
    name: typeof item.name === "string" ? item.name : "",
    note: typeof item.note === "string" ? item.note : "",
    address: typeof item.address === "string" ? item.address : "",
    map: typeof item.map === "string" ? item.map : "",
    link: typeof item.link === "string" ? item.link : "",
    photos: normalizePhotos(item.photos),
    show_in_map_info: item.show_in_map_info !== false,
  };
}

function normalizeShopItem(item = {}) {
  return {
    tag: typeof item.tag === "string" ? item.tag : "",
    name: typeof item.name === "string" ? item.name : "",
    price: normalizePrice(item.price),
    price_options: Array.isArray(item.price_options) ? item.price_options : [],
    note: typeof item.note === "string" ? item.note : "",
    address: typeof item.address === "string" ? item.address : "",
    map: typeof item.map === "string" ? item.map : "",
    link: typeof item.link === "string" ? item.link : "",
    photos: normalizePhotos(item.photos),
    show_in_map_info: item.show_in_map_info !== false,
  };
}

export function normalizeTripData(data = {}) {
  return {
    ...data,
    days: Array.isArray(data.days) ? data.days.map((day, dayIndex) => normalizeDay(day, dayIndex)) : [],
    reminders: Array.isArray(data.reminders) ? data.reminders : [],
    budget_items: Array.isArray(data.budget_items) ? data.budget_items : [],
  };
}

export function normalizeStayGroups(data) {
  const grouped = {};

  (data.stays || []).forEach((item) => {
    const normalized = normalizeStayItem(item);
    const key = normalized.area || "other";

    if (!grouped[key]) {
      grouped[key] = {
        key,
        label: key || "住宿",
        items: [],
      };
    }

    grouped[key].items.push(normalized);
  });

  return Object.values(grouped);
}

export function normalizeShopGroups(data) {
  const grouped = {};

  (data.shops || []).forEach((item) => {
    const normalized = normalizeShopItem(item);
    const key = normalized.tag || "other";

    if (!grouped[key]) {
      grouped[key] = {
        key,
        label: key || "資訊",
        items: [],
      };
    }

    grouped[key].items.push(normalized);
  });

  return Object.values(grouped);
}
