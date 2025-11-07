-- Migration script to add user_state_subscriptions table
-- This fixes the "relation user_state_subscriptions does not exist" error

CREATE TABLE IF NOT EXISTS user_state_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  state_key TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, state_key),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_state_subscriptions_user_id ON user_state_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_state_subscriptions_state_key ON user_state_subscriptions(state_key);
