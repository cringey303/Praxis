-- Add provider_email column to oauth_connections for display in linked accounts UI
ALTER TABLE oauth_connections ADD COLUMN IF NOT EXISTS provider_email TEXT;
