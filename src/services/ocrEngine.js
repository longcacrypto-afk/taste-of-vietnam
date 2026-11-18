// =============================================================================
// MODULE M6-S06 & M9-S05 AI MENU OCR PARSER & DISH LIBRARY MATCHER
// =============================================================================

import { computeStringSimilarity } from './textUtils.js';

export function parseMenuOcrText(store, placeId, rawMenuText = '') {
  const lines = String(rawMenuText)
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const place = store.places.find(p => p.id === placeId) || store.places[0];
  const extractedItems = [];

  for (const line of lines) {
    // Match price patterns like "45k", "45K", "45.000", "45,000đ", "45000"
    const priceMatch = line.match(/(\d{2,3})(?:[.,](\d{3}))?\s*(k|ngan|d|đ|vnd)?\b/i);
    let priceVnd = 45000;
    if (priceMatch) {
      const major = parseInt(priceMatch[1], 10);
      const minor = priceMatch[2] ? parseInt(priceMatch[2], 10) : null;
      if (minor !== null) {
        priceVnd = major * 1000 + minor;
      } else if (major < 1000) {
        priceVnd = major * 1000;
      } else {
        priceVnd = major;
      }
    }

    const cleanName = line
      .replace(/^\d+[.)\s-]*/, '')
      .replace(/[-–:]?\s*\d{2,3}(?:[.,]\d{3})?\s*(?:k|ngan|d|đ|vnd)?\b.*$/i, '')
      .trim() || line;

    // Find best match in M2 Dish Library
    let bestDish = store.dishes[0];
    let bestScore = 0;
    for (const dish of store.dishes) {
      const sim = computeStringSimilarity(cleanName, dish.name);
      if (sim > bestScore) {
        bestScore = sim;
        bestDish = dish;
      }
    }

    const confidence = Number(Math.min(0.99, Math.max(0.86, 0.85 + bestScore * 0.18)).toFixed(2));
    const autoApproved = confidence >= 0.95;

    const itemRecord = {
      id: `ocr-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
      place_id: place.id,
      place_name: place.name,
      raw_text: line,
      extracted_name: cleanName,
      extracted_price: priceVnd,
      matched_dish_id: bestDish.id,
      matched_dish_name: bestDish.name,
      inherited_allergens: bestDish.allergen_tags || [],
      confidence,
      status: autoApproved ? 'approved' : 'pending_review'
    };

    extractedItems.push(itemRecord);

    if (autoApproved) {
      place.menu.push({
        dish_id: bestDish.id,
        name: cleanName,
        price: priceVnd,
        available: true
      });
    } else {
      store.ocrQueue.unshift(itemRecord);
    }
  }

  return {
    place_id: place.id,
    place_name: place.name,
    total_extracted: extractedItems.length,
    auto_approved_count: extractedItems.filter(i => i.status === 'approved').length,
    queued_for_admin_count: extractedItems.filter(i => i.status === 'pending_review').length,
    items: extractedItems
  };
}
