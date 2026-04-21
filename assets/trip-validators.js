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
  if (price.kind !== undefined && !allowedKinds.includes(price.kind)) {
    errors.push(`${path}.kind 必須是 fixed / range / free`);
  }

  if (price.kind === "fixed" && typeof price.amount !== "number") {
    errors.push(`${path}.amount 必須是數字`);
  }

  if (price.kind === "range") {
    if (price.min !== undefined && typeof price.min !== "number") {
      errors.push(`${path}.min 必須是數字`);
    }
    if (price.max !== undefined && typeof price.max !== "number") {
      errors.push(`${path}.max 必須是數字`);
    }
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

    if (typeof photo === "string") return;

    if (!isObject(photo)) {
      errors.push(`${p} 必須是 string 或 object`);
      return;
    }

    if (!isNonEmptyString(photo.src)) {
      errors.push(`${p}.src 必填且必須是字串`);
    }

    if (photo.alt !== undefined && typeof photo.alt !== "string") {
      errors.push(`${p}.alt 必須是字串`);
    }
  });
}

function validateAddress(address, path, errors) {
  if (!isObject(address)) {
    errors.push(`${path} 必須是 object`);
    return;
  }

  if (address.short !== undefined && typeof address.short !== "string") {
    errors.push(`${path}.short 必須是字串`);
  }

  if (address.full !== undefined && typeof address.full !== "string") {
    errors.push(`${path}.full 必須是字串`);
  }
}

function validateStayItem(item, path, errors) {
  if (!isObject(item)) {
    errors.push(`${path} 必須是 object`);
    return;
  }

  if (item.area !== undefined && typeof item.area !== "string") {
    errors.push(`${path}.area 必須是字串`);
  }

  if (item.name !== undefined && typeof item.name !== "string") {
    errors.push(`${path}.name 必須是字串`);
  }

  if (item.note !== undefined && typeof item.note !== "string") {
    errors.push(`${path}.note 必須是字串`);
  }

  if (item.address !== undefined && typeof item.address !== "string") {
    errors.push(`${path}.address 必須是字串`);
  }

  if (item.map !== undefined && typeof item.map !== "string") {
    errors.push(`${path}.map 必須是字串`);
  }

  if (item.link !== undefined && typeof item.link !== "string") {
    errors.push(`${path}.link 必須是字串`);
  }

  if (item.photos !== undefined) {
    validatePhotos(item.photos, `${path}.photos`, errors);
  }
}

function validateShopItem(item, path, errors) {
  if (!isObject(item)) {
    errors.push(`${path} 必須是 object`);
    return;
  }

  if (item.tag !== undefined && typeof item.tag !== "string") {
    errors.push(`${path}.tag 必須是字串`);
  }

  if (item.name !== undefined && typeof item.name !== "string") {
    errors.push(`${path}.name 必須是字串`);
  }

  if (item.note !== undefined && typeof item.note !== "string") {
    errors.push(`${path}.note 必須是字串`);
  }

  if (item.address !== undefined && typeof item.address !== "string") {
    errors.push(`${path}.address 必須是字串`);
  }

  if (item.map !== undefined && typeof item.map !== "string") {
    errors.push(`${path}.map 必須是字串`);
  }

  if (item.link !== undefined && typeof item.link !== "string") {
    errors.push(`${path}.link 必須是字串`);
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
          errors.push(`${optPath}.label 必須是字串`);
        }

        if (opt.amount !== undefined && typeof opt.amount !== "number") {
          errors.push(`${optPath}.amount 必須是數字`);
        }
      });
    }
  }

  if (item.photos !== undefined) {
    validatePhotos(item.photos, `${path}.photos`, errors);
  }
}

function validateBudgetItem(item, path, errors) {
  if (!isObject(item)) {
    errors.push(`${path} 必須是 object`);
    return;
  }

  if (item.label !== undefined && typeof item.label !== "string") {
    errors.push(`${path}.label 必須是字串`);
  }

  if (item.value !== undefined && typeof item.value !== "number") {
    errors.push(`${path}.value 必須是數字`);
  }

  if (item.details !== undefined) {
    if (!Array.isArray(item.details)) {
      errors.push(`${path}.details 必須是陣列`);
    } else {
      item.details.forEach((detail, detailIndex) => {
        const detailPath = `${path}.details[${detailIndex}]`;

        if (!isObject(detail)) {
          errors.push(`${detailPath} 必須是 object`);
          return;
        }

        if (detail.name !== undefined && typeof detail.name !== "string") {
          errors.push(`${detailPath}.name 必須是字串`);
        }

        if (detail.amount !== undefined && typeof detail.amount !== "number") {
          errors.push(`${detailPath}.amount 必須是數字`);
        }

        if (detail.note !== undefined && typeof detail.note !== "string") {
          errors.push(`${detailPath}.note 必須是字串`);
        }
      });
    }
  }
}

export function validateTripData(data) {
  const errors = [];

  if (!isObject(data)) {
    return { valid: false, errors: ["根節點必須是 object"] };
  }

  if (!isNonEmptyString(data.title)) {
    errors.push("title 必填，且必須是非空字串");
  }

  if (data.subtitle !== undefined && typeof data.subtitle !== "string") {
    errors.push("subtitle 必須是字串");
  }

  if (data.summary !== undefined && typeof data.summary !== "string") {
    errors.push("summary 必須是字串");
  }

  if (data.coverImage !== undefined && typeof data.coverImage !== "string") {
    errors.push("coverImage 必須是字串");
  }

  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags)) {
      errors.push("tags 必須是陣列");
    } else {
      data.tags.forEach((tag, index) => {
        if (typeof tag !== "string") {
          errors.push(`tags[${index}] 必須是字串`);
        }
      });
    }
  }

  if (data.lastmod !== undefined && typeof data.lastmod !== "string") {
    errors.push("lastmod 必須是字串");
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

  if (data.dates !== undefined && typeof data.dates !== "string") {
    errors.push("dates 必須是字串");
  }

  if (data.travelers !== undefined && typeof data.travelers !== "number") {
    errors.push("travelers 必須是數字");
  }

  if (data.budget_per_person !== undefined && typeof data.budget_per_person !== "number") {
    errors.push("budget_per_person 必須是數字");
  }

  if (data.nights !== undefined && typeof data.nights !== "string") {
    errors.push("nights 必須是字串");
  }

  if (data.budget_items !== undefined) {
    if (!Array.isArray(data.budget_items)) {
      errors.push("budget_items 必須是陣列");
    } else {
      data.budget_items.forEach((item, index) => {
        validateBudgetItem(item, `budget_items[${index}]`, errors);
      });
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

      if (day.key !== undefined && typeof day.key !== "number") {
        errors.push(`days[${dayIndex}].key 必須是數字`);
      }

      if (day.label !== undefined && typeof day.label !== "string") {
        errors.push(`days[${dayIndex}].label 若提供必須是字串`);
      }

      if (day.title !== undefined && typeof day.title !== "string") {
        errors.push(`days[${dayIndex}].title 若提供必須是字串`);
      }

      if (day.theme !== undefined && typeof day.theme !== "string") {
        errors.push(`days[${dayIndex}].theme 若提供必須是字串`);
      }

      if (day.hero !== undefined && typeof day.hero !== "string") {
        errors.push(`days[${dayIndex}].hero 若提供必須是字串`);
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

          if (stop.id !== undefined && typeof stop.id !== "string") {
            errors.push(`${path}.id 若提供必須是字串`);
          }

          if (stop.name !== undefined && typeof stop.name !== "string") {
            errors.push(`${path}.name 若提供必須是字串`);
          }

          if (stop.maps_label !== undefined && typeof stop.maps_label !== "string") {
            errors.push(`${path}.maps_label 若提供必須是字串`);
          }

          if (stop.type !== undefined && typeof stop.type !== "string") {
            errors.push(`${path}.type 若提供必須是字串`);
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

          if (stop.address !== undefined) {
            validateAddress(stop.address, `${path}.address`, errors);
          }

          if (stop.map !== undefined && typeof stop.map !== "string") {
            errors.push(`${path}.map 若提供必須是字串`);
          }

          if (stop.note !== undefined && typeof stop.note !== "string") {
            errors.push(`${path}.note 若提供必須是字串`);
          }

          if (stop.price !== undefined) {
            validatePrice(stop.price, `${path}.price`, errors);
          }

          if (stop.photos !== undefined) {
            validatePhotos(stop.photos, `${path}.photos`, errors);
          }

          if (stop.highlight !== undefined && typeof stop.highlight !== "boolean") {
            errors.push(`${path}.highlight 若提供必須是 boolean`);
          }

          if (stop.show_in_map_info !== undefined && typeof stop.show_in_map_info !== "boolean") {
            errors.push(`${path}.show_in_map_info 若提供必須是 boolean`);
          }
        });
      }
    });
  }

  if (data.stays !== undefined) {
    if (!Array.isArray(data.stays)) {
      errors.push("stays 必須是陣列");
    } else {
      data.stays.forEach((item, index) => {
        validateStayItem(item, `stays[${index}]`, errors);
      });
    }
  }

  if (data.shops !== undefined) {
    if (!Array.isArray(data.shops)) {
      errors.push("shops 必須是陣列");
    } else {
      data.shops.forEach((item, index) => {
        validateShopItem(item, `shops[${index}]`, errors);
      });
    }
  }

  if (data.reminders !== undefined) {
    if (!Array.isArray(data.reminders)) {
      errors.push("reminders 必須是陣列");
    } else {
      data.reminders.forEach((item, index) => {
        if (typeof item !== "string") {
          errors.push(`reminders[${index}] 必須是字串`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
