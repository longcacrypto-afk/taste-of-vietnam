-- Event metadata lives on the redirect itself: no separate click insert to double count.
ALTER TABLE order_redirects ADD COLUMN IF NOT EXISTS action_type VARCHAR(16);
ALTER TABLE order_redirects ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
ALTER TABLE order_redirects ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
UPDATE order_redirects SET action_type = CASE partner WHEN 'maps' THEN 'direction' WHEN 'phone' THEN 'call' ELSE 'order' END
 WHERE action_type IS NULL;
UPDATE order_redirects SET clicked_at = created_at WHERE clicked_at IS NULL;
-- Historical rows have no trustworthy confirmation timestamp; do not invent one.
ALTER TABLE order_redirects ALTER COLUMN action_type SET NOT NULL;
ALTER TABLE order_redirects ALTER COLUMN clicked_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_redirect_action_clicked ON order_redirects(action_type, clicked_at);
