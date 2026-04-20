export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

export function isValidTimeHHmm(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function validatePrice(price, path, errors) {
  if (!isObject(price)) {
    errors.push(`${path} 必須是 object`);
    return;
  }

  const allowedKinds = ["fixed", "range", "free"];
  if (!allowedKinds.includes(price.kind)) {
    errors.push(`${path}.kind 必須是 fixed / range / free`);
    return;
  }

  if (price.kind === "fixed" && typeof price.amount !== "number") {
    errors.push(`${path}.amount 必須是數字`);
  }

  if (price.kind === "range") {
    if (typeof price.min !== "number") errors.push(`${path}.min 必須是數字`);
    if (typeof price.max !== "number") errors.push(`${path}.max 必須是數字`);
  }

  if (price.unit !== undefined) {
    const allowedUnits = ["per_person", "per_group", "per_night", "none"];
    if (!allowedUnits.includes(price.unit)) {
      errors.push(`${path}.unit 必須是 per_person / per_group / per_night / none`);
    }
  }
}

function validatePhotos(photos, path, errors) {
  if (!Array.isArray(photos)) {
    errors.push(`${path} 必須是陣列`);
    return;
  }

  photos.forEach((photo, index) => {
    const p = `${path}[${index}]`;
    if (!isObject(photo)) {
      errors.push(`${p} 必須是 object`);
      return;
    }
    if (!["static", "url"].includes(photo.type)) {
      errors.push(`${p}.type 必須是 static / url`);
    }
    if (!isNonEmptyString(photo.src)) {
      errors.push(`${p}.src 必填且必須是字串`);
    }
    if (photo.alt !== undefined && typeof photo.alt !== "string") {
      errors.push(`${p}.alt 必須是字串`);
    }
  });
}

export function validateTripData(data) {
  const errors = [];

  if (!isObject(data)) {
    return { valid: false, errors: ["根節點必須是 object"] };
  }

  if (!isNonEmptyString(data.title)) {
    errors.push("title 必填，且必須是非空字串");
  }

  if (data.defaults !== undefined) {
    if (!isObject(data.defaults)) {
      errors.push("defaults 必須是 object");
    } else {
      if (data.defaults.currency !== undefined && typeof data.defaults.currency !== "string") {
        errors.push("defaults.currency 必須是字串");
      }
      if (data.defaults.locale !== undefined && typeof data.defaults.locale !== "string") {
        errors.push("defaults.locale 必須是字串");
      }
      if (
        data.defaults.price_unit !== undefined &&
        !["per_person", "per_group", "per_night", "none"].includes(data.defaults.price_unit)
      ) {
        errors.push("defaults.price_unit 格式錯誤");
      }
    }
  }

  if (data.days !== undefined && !Array.isArray(data.days)) {
    errors.push("days 必須是陣列");
  }

  if (Array.isArray(data.days)) {
    data.days.forEach((day, dayIndex) => {
      if (!isObject(day)) {
        errors.push(`days[${dayIndex}] 必須是 object`);
        return;
      }

      if (day.key !== undefined && !isNonEmptyString(day.key)) {
        errors.push(`days[${dayIndex}].key 若提供必須是非空字串`);
      }

      if (day.stops !== undefined && !Array.isArray(day.stops)) {
        errors.push(`days[${dayIndex}].stops 必須是陣列`);
      }

      if (Array.isArray(day.stops)) {
        day.stops.forEach((stop, stopIndex) => {
          const path = `days[${dayIndex}].stops[${stopIndex}]`;
          if (!isObject(stop)) {
            errors.push(`${path} 必須是 object`);
            return;
          }

          if (stop.name !== undefined && typeof stop.name !== "string") {
            errors.push(`${path}.name 若提供必須是字串`);
          }

          if (stop.start_time !== undefined && !isValidTimeHHmm(stop.start_time)) {
            errors.push(`${path}.start_time 必須是 HH:mm`);
          }

          if (stop.end_time !== undefined && !isValidTimeHHmm(stop.end_time)) {
            errors.push(`${path}.end_time 必須是 HH:mm`);
          }

          if (stop.duration_min !== undefined && typeof stop.duration_min !== "number") {
            errors.push(`${path}.duration_min 必須是數字`);
          }

          if (stop.transit_to_next_min !== undefined && typeof stop.transit_to_next_min !== "number") {
            errors.push(`${path}.transit_to_next_min 必須是數字`);
          }

          if (stop.price !== undefined) {
            validatePrice(stop.price, `${path}.price`, errors);
          }

          if (stop.photos !== undefined) {
            validatePhotos(stop.photos, `${path}.photos`, errors);
          }
        });
      }
    });
  }

  if (data.shop_groups !== undefined && !Array.isArray(data.shop_groups)) {
    errors.push("shop_groups 必須是陣列");
  }

  if (Array.isArray(data.shop_groups)) {
    data.shop_groups.forEach((group, groupIndex) => {
      if (!isObject(group)) {
        errors.push(`shop_groups[${groupIndex}] 必須是 object`);
        return;
      }

      if (!Array.isArray(group.items)) {
        errors.push(`shop_groups[${groupIndex}].items 必須是陣列`);
        return;
      }

      group.items.forEach((item, itemIndex) => {
        const path = `shop_groups[${groupIndex}].items[${itemIndex}]`;
        if (!isObject(item)) {
          errors.push(`${path} 必須是 object`);
          return;
        }

        if (item.name !== undefined && typeof item.name !== "string") {
          errors.push(`${path}.name 若提供必須是字串`);
        }

        if (item.price !== undefined) {
          validatePrice(item.price, `${path}.price`, errors);
        }

        if (item.price_options !== undefined) {
          if (!Array.isArray(item.price_options)) {
            errors.push(`${path}.price_options 必須是陣列`);
          } else {
            item.price_options.forEach((opt, optIndex) => {
              const optPath = `${path}.price_options[${optIndex}]`;
              if (!isObject(opt)) {
                errors.push(`${optPath} 必須是 object`);
                return;
              }
              if (opt.label !== undefined && typeof opt.label !== "string") {
                errors.push(`${optPath}.label 若提供必須是字串`);
              }
              if (typeof opt.amount !== "number") {
                errors.push(`${optPath}.amount 必須是數字`);
              }
            });
          }
        }

        if (item.photos !== undefined) {
          validatePhotos(item.photos, `${path}.photos`, errors);
        }
      });
    });
  }

  return { valid: errors.length === 0, errors };
}
