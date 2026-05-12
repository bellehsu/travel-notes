export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

export function isValidTimeHHmm(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function pushType(errors, path, type) {
  errors.push(`${path} 必須是 ${type}`);
}

function validatePrice(price, path, errors) {
  if (price === undefined || price === null || price === "") return;
  if (typeof price === "string" || typeof price === "number") return;
  if (!isObject(price)) return pushType(errors, path, "object / string / number");

  const allowedKinds = ["fixed", "range", "free", "text"];
  if (price.kind !== undefined && !allowedKinds.includes(price.kind)) {
    errors.push(`${path}.kind 必須是 fixed / range / free / text`);
  }
  ["amount", "min", "max"].forEach((key) => {
    if (price[key] !== undefined && typeof price[key] !== "number") errors.push(`${path}.${key} 必須是數字`);
  });
  if (price.text !== undefined && typeof price.text !== "string") errors.push(`${path}.text 必須是字串`);
}

function validateAddress(address, path, errors) {
  if (address === undefined) return;
  if (typeof address === "string") return;
  if (!isObject(address)) return pushType(errors, path, "object 或 string");
  if (address.short !== undefined && typeof address.short !== "string") pushType(errors, `${path}.short`, "字串");
  if (address.full !== undefined && typeof address.full !== "string") pushType(errors, `${path}.full`, "字串");
}

function validatePhotos(photos, path, errors) {
  if (photos === undefined) return;
  if (!Array.isArray(photos)) return pushType(errors, path, "陣列");
  photos.forEach((photo, index) => {
    const p = `${path}[${index}]`;
    if (typeof photo === "string") return;
    if (!isObject(photo)) return pushType(errors, p, "string 或 object");
    if (!isNonEmptyString(photo.src)) errors.push(`${p}.src 必填且必須是非空字串`);
    if (photo.alt !== undefined && typeof photo.alt !== "string") pushType(errors, `${p}.alt`, "字串");
  });
}

function validateMapLike(item, path, errors) {
  if (item.name !== undefined && typeof item.name !== "string") pushType(errors, `${path}.name`, "字串");
  if (item.map !== undefined && typeof item.map !== "string") pushType(errors, `${path}.map`, "字串");
  if (item.link !== undefined && typeof item.link !== "string") pushType(errors, `${path}.link`, "字串");
  if (item.note !== undefined && typeof item.note !== "string") pushType(errors, `${path}.note`, "字串");
  if (item.lat !== undefined && typeof item.lat !== "number") pushType(errors, `${path}.lat`, "數字");
  if (item.lng !== undefined && typeof item.lng !== "number") pushType(errors, `${path}.lng`, "數字");
  if (item.show_in_map_info !== undefined && typeof item.show_in_map_info !== "boolean") pushType(errors, `${path}.show_in_map_info`, "boolean");
  validatePhotos(item.photos, `${path}.photos`, errors);
}

function validateStop(stop, path, errors) {
  if (!isObject(stop)) return pushType(errors, path, "object");
  validateMapLike(stop, path, errors);
  if (stop.type !== undefined && typeof stop.type !== "string") pushType(errors, `${path}.type`, "字串");
  if (stop.maps_label !== undefined && typeof stop.maps_label !== "string") pushType(errors, `${path}.maps_label`, "字串");
  if (stop.start_time !== undefined && stop.start_time !== "" && !isValidTimeHHmm(stop.start_time)) errors.push(`${path}.start_time 必須是 HH:mm`);
  if (stop.time !== undefined && stop.time !== "" && !isValidTimeHHmm(stop.time)) errors.push(`${path}.time 必須是 HH:mm`);
  if (stop.duration_min !== undefined && stop.duration_min !== "" && typeof stop.duration_min !== "number") pushType(errors, `${path}.duration_min`, "數字");
  if (stop.transit_to_next_min !== undefined && stop.transit_to_next_min !== "" && typeof stop.transit_to_next_min !== "number") pushType(errors, `${path}.transit_to_next_min`, "數字或空字串");
  validatePrice(stop.price ?? stop.cost, `${path}.price`, errors);
  validateAddress(stop.address, `${path}.address`, errors);
  if (stop.short_address !== undefined && typeof stop.short_address !== "string") pushType(errors, `${path}.short_address`, "字串");
  if (stop.highlight !== undefined && typeof stop.highlight !== "boolean") pushType(errors, `${path}.highlight`, "boolean");
  if (stop.tags !== undefined && (!Array.isArray(stop.tags) || stop.tags.some((x) => typeof x !== "string"))) errors.push(`${path}.tags 必須是字串陣列`);
}

function validateBudgetItem(item, path, errors) {
  if (!isObject(item)) return pushType(errors, path, "object");
  if (item.label !== undefined && typeof item.label !== "string") pushType(errors, `${path}.label`, "字串");
  if (item.value !== undefined && typeof item.value !== "number") pushType(errors, `${path}.value`, "數字");
  if (item.details !== undefined) {
    if (!Array.isArray(item.details)) return pushType(errors, `${path}.details`, "陣列");
    item.details.forEach((detail, i) => {
      if (!isObject(detail)) return pushType(errors, `${path}.details[${i}]`, "object");
      if (detail.name !== undefined && typeof detail.name !== "string") pushType(errors, `${path}.details[${i}].name`, "字串");
      if (detail.amount !== undefined && typeof detail.amount !== "number") pushType(errors, `${path}.details[${i}].amount`, "數字");
      if (detail.note !== undefined && typeof detail.note !== "string") pushType(errors, `${path}.details[${i}].note`, "字串");
    });
  }
}

export function validateTripData(data) {
  const errors = [];
  if (!isObject(data)) return { valid: false, errors: ["根節點必須是 object"] };

  if (!isNonEmptyString(data.title)) errors.push("title 必填，且必須是非空字串");
  ["subtitle", "summary", "coverImage", "lastmod", "dates", "nights"].forEach((key) => {
    if (data[key] !== undefined && typeof data[key] !== "string") pushType(errors, key, "字串");
  });
  ["travelers", "budget_per_person"].forEach((key) => {
    if (data[key] !== undefined && typeof data[key] !== "number") pushType(errors, key, "數字");
  });
  if (data.tags !== undefined && (!Array.isArray(data.tags) || data.tags.some((x) => typeof x !== "string"))) errors.push("tags 必須是字串陣列");
  if (data.defaults !== undefined && !isObject(data.defaults)) pushType(errors, "defaults", "object");
  if (data.lat !== undefined && typeof data.lat !== "number") pushType(errors, "lat", "數字");
  if (data.lng !== undefined && typeof data.lng !== "number") pushType(errors, "lng", "數字");
  if (isObject(data.defaults)) {
    const center = data.defaults.map_center ?? data.defaults.map_default_center;
    const centerPath = data.defaults.map_center !== undefined ? "defaults.map_center" : "defaults.map_default_center";
    if (center !== undefined) {
      if (!isObject(center)) pushType(errors, centerPath, "object");
      else {
        if (center.lat !== undefined && typeof center.lat !== "number") pushType(errors, `${centerPath}.lat`, "數字");
        if (center.lng !== undefined && typeof center.lng !== "number") pushType(errors, `${centerPath}.lng`, "數字");
        if (center.zoom !== undefined && typeof center.zoom !== "number") pushType(errors, `${centerPath}.zoom`, "數字");
      }
    }
    if (data.defaults.map_zoom !== undefined && typeof data.defaults.map_zoom !== "number") pushType(errors, "defaults.map_zoom", "數字");
    if (data.defaults.map_default_zoom !== undefined && typeof data.defaults.map_default_zoom !== "number") pushType(errors, "defaults.map_default_zoom", "數字");
  }
  if (data.budget_items !== undefined) {
    if (!Array.isArray(data.budget_items)) pushType(errors, "budget_items", "陣列");
    else data.budget_items.forEach((item, i) => validateBudgetItem(item, `budget_items[${i}]`, errors));
  }
  if (!Array.isArray(data.days)) errors.push("days 必填且必須是陣列");
  else data.days.forEach((day, i) => {
    if (!isObject(day)) return pushType(errors, `days[${i}]`, "object");
    if (day.key !== undefined && typeof day.key !== "number" && typeof day.key !== "string") pushType(errors, `days[${i}].key`, "數字或字串");
    ["label", "title", "theme", "hero"].forEach((key) => {
      if (day[key] !== undefined && typeof day[key] !== "string") pushType(errors, `days[${i}].${key}`, "字串");
    });
    if (!Array.isArray(day.stops)) errors.push(`days[${i}].stops 必填且必須是陣列`);
    else day.stops.forEach((stop, j) => validateStop(stop, `days[${i}].stops[${j}]`, errors));
  });
  if (data.reminders !== undefined) {
    if (!Array.isArray(data.reminders)) errors.push("reminders 必須是陣列");
    else data.reminders.forEach((item, i) => {
      if (typeof item === "string") return;
      if (!isObject(item)) return pushType(errors, `reminders[${i}]`, "字串或 object");
      if (item.text !== undefined && typeof item.text !== "string") pushType(errors, `reminders[${i}].text`, "字串");
      if (item.title !== undefined && typeof item.title !== "string") pushType(errors, `reminders[${i}].title`, "字串");
    });
  }
  if (data.stays !== undefined) {
    if (!Array.isArray(data.stays)) pushType(errors, "stays", "陣列");
    else data.stays.forEach((item, i) => { if (!isObject(item)) return pushType(errors, `stays[${i}]`, "object"); validateMapLike(item, `stays[${i}]`, errors); if (item.area !== undefined && typeof item.area !== "string") pushType(errors, `stays[${i}].area`, "字串"); });
  }
  if (data.shops !== undefined) {
    if (!Array.isArray(data.shops)) pushType(errors, "shops", "陣列");
    else data.shops.forEach((item, i) => { if (!isObject(item)) return pushType(errors, `shops[${i}]`, "object"); validateMapLike(item, `shops[${i}]`, errors); if (item.tag !== undefined && typeof item.tag !== "string") pushType(errors, `shops[${i}].tag`, "字串"); validatePrice(item.price, `shops[${i}].price`, errors); });
  }
  if (data.references !== undefined) {
    if (!Array.isArray(data.references)) pushType(errors, "references", "陣列");
    else data.references.forEach((r, i) => { if (!isObject(r)) return pushType(errors, `references[${i}]`, "object"); if (r.title !== undefined && typeof r.title !== "string") pushType(errors, `references[${i}].title`, "字串"); if (r.url !== undefined && typeof r.url !== "string") pushType(errors, `references[${i}].url`, "字串"); if (r.type !== undefined && typeof r.type !== "string") pushType(errors, `references[${i}].type`, "字串"); });
  }

  return { valid: errors.length === 0, errors };
}
