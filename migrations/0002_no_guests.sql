-- Guests no longer have rows. Their attempts live in the browser until they sign in.
DELETE FROM attempts WHERE user_id IN (SELECT id FROM users WHERE status = 'guest');
DELETE FROM ai_log WHERE user_id IN (SELECT id FROM users WHERE status = 'guest');
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE status = 'guest');
DELETE FROM users WHERE status = 'guest';
