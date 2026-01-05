-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id CHAR(128) PRIMARY KEY, -- unique session id
    expires_at TIMESTAMPTZ NOT NULL, -- session expiration
    data TEXT NOT NULL -- actual data (e.g., {"user_id": "..."})
);

-- users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- generate unique user id
    username TEXT UNIQUE NOT NULL,            -- unique username
    display_name TEXT NOT NULL,
    avatar_url TEXT,                          -- profile picture link
    created_at TIMESTAMPTZ DEFAULT NOW()      -- set to current time
);

-- Email/Password
-- seperate from 'users' to allow Google/Github logins later without passwords
CREATE TABLE IF NOT EXISTS local_auths (
    -- `REFERENCES users(id)` gets id from 'users' table
    -- `ON DELETE CASCADE` deletes password too if user is deleted
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,     -- unique email
    password_hash TEXT NOT NULL,    -- Argon2 encrypted string
    verified BOOLEAN DEFAULT FALSE  -- email verification
);

-- OAuth Creds: connection details for GitHub/Google
CREATE TABLE IF NOT EXISTS oauth_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Link to user
    provider TEXT NOT NULL,             -- e.g., 'github'
    provider_id TEXT NOT NULL,          -- e.g., GitHub User ID '69420'
    access_token TEXT NOT NULL,         -- their key to fetch their repos
    refresh_token TEXT,                 -- key to get a new access token
    expires_at TIMESTAMPTZ,             -- when the token expires
    UNIQUE(provider, provider_id)       -- make sure GitHub accounts are only linked once max
);