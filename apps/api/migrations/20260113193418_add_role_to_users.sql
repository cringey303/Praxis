-- Add role column to users table with default value 'user'
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
