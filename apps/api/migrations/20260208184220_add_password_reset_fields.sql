-- Add password_reset_token and password_reset_expires_at to local_auths
ALTER TABLE local_auths 
ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
