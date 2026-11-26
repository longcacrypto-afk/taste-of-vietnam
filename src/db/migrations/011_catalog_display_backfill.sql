-- Fill display fields that older databases never received.
-- Rows seeded before 002 kept NULL/empty photo keys, descriptions, macros,
-- difficulty and tags, so every card fell back to the same placeholder photo.
-- Values are the repo's own original catalogue (src/data/seed.js), applied only
-- where the field is still empty: admin edits are never overwritten and no
-- safety-relevant column (allergens, diet, ingredients, steps) is touched.
UPDATE dishes SET
  img_key = COALESCE(img_key, '298'),
  description = CASE WHEN description = '' THEN 'Nước dùng xương bò ninh thảo quả thơm dịu, thịt bò thăn mềm ngọt chuẩn vị truyền thống.' ELSE description END,
  macros = CASE WHEN macros = '{}'::jsonb THEN '{"carbs":59,"protein":32,"fat":18}'::jsonb ELSE macros END,
  difficulty = COALESCE(difficulty, 'Dễ nấu'),
  tags = CASE WHEN tags = '{}' THEN ARRAY['Nhanh 15p','Healthy']::TEXT[] ELSE tags END
WHERE id = 'DISH-101';
UPDATE dishes SET
  img_key = COALESCE(img_key, '304'),
  description = CASE WHEN description = '' THEN 'Sườn cốt lết ướp mật ong nướng than hoa thơm lừng, ăn kèm bì thính, chả trứng và đồ chua.' ELSE description END,
  macros = CASE WHEN macros = '{}'::jsonb THEN '{"carbs":68,"protein":34,"fat":22}'::jsonb ELSE macros END,
  difficulty = COALESCE(difficulty, 'Trung bình'),
  tags = CASE WHEN tags = '{}' THEN ARRAY['Phổ biến','Chắc bụng']::TEXT[] ELSE tags END
WHERE id = 'DISH-102';
UPDATE dishes SET
  img_key = COALESCE(img_key, '310'),
  description = CASE WHEN description = '' THEN 'Nước dùng dậy mùi sả và mắm ruốc Huế dịu nhẹ, bắp bò giòn ngọt và chả cua bò.' ELSE description END,
  macros = CASE WHEN macros = '{}'::jsonb THEN '{"carbs":58,"protein":35,"fat":16}'::jsonb ELSE macros END,
  difficulty = COALESCE(difficulty, 'Trung bình'),
  tags = CASE WHEN tags = '{}' THEN ARRAY['Giàu Đạm','Đậm đà']::TEXT[] ELSE tags END
WHERE id = 'DISH-103';
UPDATE dishes SET
  img_key = COALESCE(img_key, '470'),
  description = CASE WHEN description = '' THEN 'Bánh mì vỏ giòn rụm kẹp thịt nướng sả thơm lừng, đồ chua, dưa leo và ngò rí.' ELSE description END,
  macros = CASE WHEN macros = '{}'::jsonb THEN '{"carbs":44,"protein":21,"fat":14}'::jsonb ELSE macros END,
  difficulty = COALESCE(difficulty, 'Dễ nấu'),
  tags = CASE WHEN tags = '{}' THEN ARRAY['Ăn nhanh 10p','Tiết kiệm']::TEXT[] ELSE tags END
WHERE id = 'DISH-104';
UPDATE dishes SET
  img_key = COALESCE(img_key, '592'),
  description = CASE WHEN description = '' THEN 'Vị chua thanh từ me chín và thơm (dứa), cá lóc đồng chắc thịt cùng bạc hà, đậu bắp, giá đỗ.' ELSE description END,
  macros = CASE WHEN macros = '{}'::jsonb THEN '{"carbs":28,"protein":30,"fat":11}'::jsonb ELSE macros END,
  difficulty = COALESCE(difficulty, 'Dễ nấu'),
  tags = CASE WHEN tags = '{}' THEN ARRAY['Cơm gia đình','Ít béo']::TEXT[] ELSE tags END
WHERE id = 'DISH-105';
UPDATE dishes SET
  img_key = COALESCE(img_key, '310'),
  description = CASE WHEN description = '' THEN 'Món chứa tôm và cua đồng (dùng để kiểm thử bộ lọc cứng dị ứng QA-10).' ELSE description END,
  macros = CASE WHEN macros = '{}'::jsonb THEN '{"carbs":52,"protein":29,"fat":15}'::jsonb ELSE macros END,
  difficulty = COALESCE(difficulty, 'Trung bình'),
  tags = CASE WHEN tags = '{}' THEN ARRAY['Truyền thống','Hải sản']::TEXT[] ELSE tags END
WHERE id = 'DISH-106';
UPDATE dishes SET
  img_key = COALESCE(img_key, '034'),
  description = CASE WHEN description = '' THEN 'Món chứa tôm và đậu phộng (dùng để kiểm thử bộ lọc cứng dị ứng QA-10).' ELSE description END,
  macros = CASE WHEN macros = '{}'::jsonb THEN '{"carbs":36,"protein":18,"fat":8}'::jsonb ELSE macros END,
  difficulty = COALESCE(difficulty, 'Dễ nấu'),
  tags = CASE WHEN tags = '{}' THEN ARRAY['Thanh mát','Low Calorie']::TEXT[] ELSE tags END
WHERE id = 'DISH-107';
UPDATE dishes SET
  img_key = COALESCE(img_key, '034'),
  description = CASE WHEN description = '' THEN 'Thịt bò hầm mềm ngọt cùng khoai tây, cà rốt, hoàn toàn không cay, rất hợp gia đình có trẻ nhỏ.' ELSE description END,
  macros = CASE WHEN macros = '{}'::jsonb THEN '{"carbs":48,"protein":36,"fat":16}'::jsonb ELSE macros END,
  difficulty = COALESCE(difficulty, 'Dễ nấu'),
  tags = CASE WHEN tags = '{}' THEN ARRAY['Gia đình & Bé','Giàu Đạm']::TEXT[] ELSE tags END
WHERE id = 'DISH-108';
UPDATE dishes SET
  img_key = COALESCE(img_key, '310'),
  description = CASE WHEN description = '' THEN 'Vỏ bánh vàng ươm giòn tan đúc tôm thịt, giá đỗ, cuốn bánh tráng rau rừng chấm nước mắm chua ngọt.' ELSE description END,
  macros = CASE WHEN macros = '{}'::jsonb THEN '{"carbs":54,"protein":24,"fat":22}'::jsonb ELSE macros END,
  difficulty = COALESCE(difficulty, 'Trung bình'),
  tags = CASE WHEN tags = '{}' THEN ARRAY['Đặc sản','Giòn ngon']::TEXT[] ELSE tags END
WHERE id = 'DISH-109';
UPDATE dishes SET
  img_key = COALESCE(img_key, '034'),
  description = CASE WHEN description = '' THEN 'Nước canh chua thanh vị me non kết hợp cá lóc đồng tươi ngọt, bạc hà, cà chua và bông điên điển.' ELSE description END,
  macros = CASE WHEN macros = '{}'::jsonb THEN '{"carbs":32,"protein":35,"fat":12}'::jsonb ELSE macros END,
  difficulty = COALESCE(difficulty, 'Dễ nấu'),
  tags = CASE WHEN tags = '{}' THEN ARRAY['Thanh mát','Cơm nhà']::TEXT[] ELSE tags END
WHERE id = 'DISH-110';
UPDATE dishes SET
  img_key = COALESCE(img_key, '298'),
  description = CASE WHEN description = '' THEN 'Sợi mì gạo mềm mượt chan nước nhưỡng gà ta đậm đà, ăn kèm bánh tráng mè nướng giòn và đậu phộng rang.' ELSE description END,
  macros = CASE WHEN macros = '{}'::jsonb THEN '{"carbs":58,"protein":34,"fat":14}'::jsonb ELSE macros END,
  difficulty = COALESCE(difficulty, 'Trung bình'),
  tags = CASE WHEN tags = '{}' THEN ARRAY['Đậm đà','Đặc sản']::TEXT[] ELSE tags END
WHERE id = 'DISH-111';
UPDATE dishes SET
  img_key = COALESCE(img_key, '304'),
  description = CASE WHEN description = '' THEN 'Bánh tráng xốp bọc nấm đùi gà, khoai môn và hạt sen bùi béo chiên vàng rụm, thanh tịnh cho ngày rằm.' ELSE description END,
  macros = CASE WHEN macros = '{}'::jsonb THEN '{"carbs":38,"protein":14,"fat":11}'::jsonb ELSE macros END,
  difficulty = COALESCE(difficulty, 'Dễ nấu'),
  tags = CASE WHEN tags = '{}' THEN ARRAY['Thực dưỡng','Ăn chay']::TEXT[] ELSE tags END
WHERE id = 'DISH-112';
UPDATE places SET img_key = '477' WHERE id = 'PLACE-401' AND img_key IS NULL;
UPDATE places SET img_key = '304' WHERE id = 'PLACE-402' AND img_key IS NULL;
UPDATE places SET img_key = '310' WHERE id = 'PLACE-403' AND img_key IS NULL;
UPDATE places SET img_key = '470' WHERE id = 'PLACE-404' AND img_key IS NULL;
UPDATE places SET img_key = '477' WHERE id = 'PLACE-405' AND img_key IS NULL;
UPDATE places SET img_key = '310' WHERE id = 'PLACE-406' AND img_key IS NULL;
UPDATE places SET img_key = '034' WHERE id = 'PLACE-407' AND img_key IS NULL;
UPDATE places SET img_key = '298' WHERE id = 'PLACE-408' AND img_key IS NULL;
