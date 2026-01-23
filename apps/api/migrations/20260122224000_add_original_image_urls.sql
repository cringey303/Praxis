-- Add optional original image URL columns to users table
ALTER TABLE users ADD COLUMN avatar_original_url TEXT;
ALTER TABLE users ADD COLUMN banner_original_url TEXT;
