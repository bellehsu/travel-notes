export function normalizeStayGroups(data) {
  if (Array.isArray(data.stay_groups) && data.stay_groups.length) {
    return data.stay_groups;
  }

  const grouped = {};
  (data.stays || []).forEach((item) => {
    const key = item.area || "other";
    if (!grouped[key]) {
      grouped[key] = { key, label: key, items: [] };
    }
    grouped[key].items.push(item);
  });

  return Object.values(grouped);
}

export function normalizeShopGroups(data) {
  if (Array.isArray(data.shop_groups) && data.shop_groups.length) {
    return data.shop_groups;
  }

  const grouped = {};
  (data.shops || []).forEach((item) => {
    const key = item.tag || "other";
    if (!grouped[key]) {
      grouped[key] = { key, label: key || "資訊", items: [] };
    }
    grouped[key].items.push(item);
  });

  return Object.values(grouped);
}
