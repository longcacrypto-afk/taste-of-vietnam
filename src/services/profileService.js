// Profile fields mirror the existing M1 screens. No inferred allergies or consent.
export function defaultProfile(id, name = 'Bạn mới', phone = null) {
  return { id, name, phone, lat: 10.9574, lng: 106.8426, radius_m: 3000,
    regions: [], spice_level: 0, hard_allergies: [], diet_mode: 'balanced',
    budget_min: 0, budget_max: 1000000, disliked_dish_ids: [], pdpd_consent: false,
    meal_reminders: { lunch: '10:30', dinner: '17:00', max_per_day: 0 } };
}
const enums = {
  regions: ['bac', 'trung', 'nam'],
  hard_allergies: ['shrimp', 'peanut', 'shrimp_paste', 'dairy', 'egg', 'gluten', 'fish', 'soy', 'shellfish'],
  diet_mode: ['balanced', 'vegetarian', 'vegan', 'low_carb', 'eat_clean']
};
const ranges = { spice_level: [0, 3], budget_min: [0, 1000000000], budget_max: [0, 1000000000], lat: [-90, 90], lng: [-180, 180], radius_m: [100, 100000] };
const reserved = ['id', 'phone', 'role']; // old clients send these; never writable
export function validateProfilePatch(profile, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { error: 'Hồ sơ phải là đối tượng JSON' };
  const changes = {};
  for (const [key, value] of Object.entries(patch)) {
    if (reserved.includes(key)) continue;
    let valid = false;
    if (Object.hasOwn(enums, key)) {
      const allowed = enums[key];
      valid = key === 'diet_mode' ? typeof value === 'string' && allowed.includes(value)
        : Array.isArray(value) && value.length <= allowed.length && value.every(v => allowed.includes(v));
      if (valid) changes[key] = Array.isArray(value) ? [...new Set(value)] : value;
    } else if (Object.hasOwn(ranges, key)) {
      const [min, max] = ranges[key];
      valid = typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
        && (['lat', 'lng'].includes(key) || Number.isInteger(value));
    } else if (key === 'name') {
      valid = typeof value === 'string' && value.trim().length > 0 && value.length <= 120 && !/[<>\u0000-\u001f]/.test(value);
    } else if (key === 'pdpd_consent') valid = typeof value === 'boolean';
    else if (key === 'disliked_dish_ids') valid = Array.isArray(value) && value.length <= 1000 && value.every(v => typeof v === 'string' && /^DISH-[\w-]{1,50}$/.test(v));
    else if (key === 'meal_reminders') valid = value && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).every(k => ['lunch', 'dinner', 'max_per_day'].includes(k))
      && ['lunch', 'dinner'].every(k => typeof value[k] === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value[k]))
      && Number.isInteger(value.max_per_day) && value.max_per_day >= 0 && value.max_per_day <= 2;
    if (!valid) return { error: `Trường hồ sơ không hợp lệ: ${key}` };
    if (!(Object.hasOwn(changes, key))) changes[key] = structuredClone(value);
  }
  const next = { ...profile, ...changes };
  if (next.budget_min > next.budget_max) return { error: 'Ngân sách tối thiểu không được lớn hơn tối đa' };
  return { profile: next };
}

// Same id: union saved dishes, preserving the account collection's name/order.
export function mergeCollections(account, guest) {
  const out = structuredClone(account);
  for (const col of guest) {
    const existing = out.find(c => c.id === col.id);
    if (existing) existing.dish_ids = [...new Set([...existing.dish_ids, ...col.dish_ids])];
    else out.push(structuredClone(col));
  }
  return out;
}
export function mergeProfile(account, guest, isNew) {
  // Existing account preferences win; never discard a recorded allergy/dislike.
  const source = isNew ? guest : account;
  return { ...source, id: account.id, phone: account.phone,
    hard_allergies: [...new Set([...(account.hard_allergies || []), ...(guest.hard_allergies || [])])],
    disliked_dish_ids: [...new Set([...(account.disliked_dish_ids || []), ...(guest.disliked_dish_ids || [])])],
    // Consent belongs to this account, not a transferable guest flag.
    pdpd_consent: account.pdpd_consent === true };
}
