-- Add verification_token to local_auths
ALTER TABLE local_auths ADD COLUMN IF NOT EXISTS verification_token TEXT;
