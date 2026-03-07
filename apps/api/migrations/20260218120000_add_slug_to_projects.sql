ALTER TABLE projects ADD COLUMN slug TEXT;
UPDATE projects SET slug = regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g');
ALTER TABLE projects ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX idx_projects_owner_slug ON projects(owner_id, slug);
