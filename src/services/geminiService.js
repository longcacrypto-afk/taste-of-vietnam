// =============================================================================
// GEMINI AI SERVICE — Măm AI Chat & Dish Cultural Story Generator
// Module M3-S04: Vietnamese NLU via Gemini 2.0 Flash + Fallback Engine
// =============================================================================

import { extractVietnameseIntent } from './intentParser.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const MAM_SYSTEM_PROMPT = `Bạn là Măm — trợ lý ẩm thực AI của ứng dụng "Hôm nay ăn gì · Taste of Vietnam".
Nhiệm vụ của bạn khi nhận câu hỏi tiếng Việt tự nhiên về ẩm thực:
1. Trích xuất intent thành JSON với các trường:
   - party_size: số người (int, mặc định 1)
   - total_budget_vnd: tổng ngân sách VND (int, mặc định 60000)
   - has_kids: có trẻ nhỏ không (bool)
   - spice_max: mức cay tối đa 0-3 (int, 0 nếu có trẻ nhỏ hoặc người dùng nói không cay)
   - meal_slot: "breakfast" | "lunch" | "dinner" | "snack"
   - detected_ingredients: mảng nguyên liệu được đề cập (string[])
2. Trả lời ngắn gọn, thân thiện bằng tiếng Việt.
QUAN TRỌNG: Chỉ trả về JSON theo đúng format sau, không có markdown, không có text thêm:
{"intent":{"party_size":1,"total_budget_vnd":60000,"has_kids":false,"spice_max":2,"meal_slot":"lunch","detected_ingredients":[]},"response_vi":"Lời giải thích ngắn gọn của Măm"}`;

// ─── Gemini API caller ────────────────────────────────────────────────────────
export async function callGeminiChat(queryText = '', userProfile = {}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const res = await fetch(`${GEMINI_API_BASE}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: queryText }] }],
          systemInstruction: { parts: [{ text: MAM_SYSTEM_PROMPT }] },
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 512,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);

      const json = await res.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(rawText);

      return {
        intent: {
          party_size: parsed.intent?.party_size ?? 1,
          total_budget_vnd: parsed.intent?.total_budget_vnd ?? 60000,
          has_kids: parsed.intent?.has_kids ?? false,
          spice_max: parsed.intent?.spice_max ?? 2,
          meal_slot: parsed.intent?.meal_slot ?? 'lunch',
          detected_ingredients: parsed.intent?.detected_ingredients ?? [],
          hard_allergies_applied: userProfile.hard_allergies || [],
          raw_query: queryText
        },
        response_vi: parsed.response_vi || 'Măm đã phân tích yêu cầu của anh!',
        source: 'gemini'
      };
    } catch (err) {
      console.error('[GeminiService] Fallback to local engine:', err.message);
    }
  }

  // ── Fallback: local Vietnamese NLU engine ──────────────────────────────────
  const intent = extractVietnameseIntent(queryText, userProfile);
  const msgParts = [
    `${intent.party_size} người`,
    `ngân sách ${intent.total_budget_vnd.toLocaleString('vi-VN')}đ`,
    intent.has_kids ? '· có trẻ nhỏ (không cay)' : '',
    intent.detected_ingredients.length ? `· có: ${intent.detected_ingredients.join(', ')}` : ''
  ].filter(Boolean);

  return {
    intent,
    response_vi: `Măm đã phân tích: ${msgParts.join(' ')}. Dưới đây là ${intent.mode === 'cook' ? 'công thức nấu tại nhà' : '3 phương án thực tế'} an toàn dị ứng:`,
    source: 'fallback'
  };
}

// ─── Dish Cultural Story Generator ────────────────────────────────────────────
const STORY_FALLBACKS = {
  bac: (name) => `${name} là di sản ẩm thực phương Bắc hàng trăm năm tuổi, nơi từng thìa nước dùng trong vắt kể câu chuyện của người Hà Nội thức dậy lúc mờ sáng để ninh xương suốt đêm. Mỗi bát là sự cân bằng hoàn hảo giữa vị ngọt thanh, hương thảo quả dịu nhẹ và sợi phở mềm mà dai — một triết lý ẩm thực tối giản mà tinh tế.`,
  trung: (name) => `${name} sinh ra từ đất Cố đô Huế — nơi hoàng gia và dân gian cùng nhau tạo ra thứ ẩm thực cay nồng mà quyến rũ nhất Việt Nam. Vị sả, ruốc và ớt Huế hòa quyện tạo nên tầng tầng hương vị không thể lẫn với bất kỳ vùng đất nào.`,
  nam: (name) => `${name} là linh hồn của Sài Gòn hoa lệ — nơi dòng người di cư từ khắp miền đã góp vào đây cả kho nguyên liệu phong phú nhất nước. Vị ngọt tự nhiên, đậm đà nhưng không gắt, ăn kèm rổ rau thơm tươi mát — đó là triết lý "ăn thoải mái" của người phương Nam.`,
  default: (name) => `${name} là một trong những tinh hoa của nền ẩm thực Việt Nam đa dạng và phong phú — kết tinh từ văn hóa, lịch sử và tình yêu với nguyên liệu địa phương qua hàng thế kỷ. Mỗi lần thưởng thức là một hành trình khám phá bản sắc văn hóa độc đáo.`
};

export async function generateDishStory(dish) {
  const apiKey = process.env.GEMINI_API_KEY;
  const dishName = dish?.name || 'Món ăn Việt Nam';
  const region = dish?.region || 'default';

  if (apiKey) {
    try {
      const prompt = `Viết đúng 2 câu giới thiệu hấp dẫn về món "${dishName}" của ẩm thực Việt Nam vùng ${region === 'bac' ? 'Miền Bắc' : region === 'trung' ? 'Miền Trung' : 'Miền Nam'}. Phong cách truyền cảm hứng, giàu hình ảnh, không dùng bullet point. Chỉ trả về 2 câu văn thuần tuý.`;

      const res = await fetch(`${GEMINI_API_BASE}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 200 }
        })
      });

      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const json = await res.json();
      const story = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (story) {
        return { dish_id: dish.id, story_vi: story, source: 'gemini' };
      }
    } catch (err) {
      console.error('[GeminiService] Story fallback:', err.message);
    }
  }

  const storyFn = STORY_FALLBACKS[region] || STORY_FALLBACKS.default;
  return { dish_id: dish?.id, story_vi: storyFn(dishName), source: 'fallback' };
}
