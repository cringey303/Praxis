CREATE TABLE applications (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    applicant_id UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    message      TEXT        NOT NULL,
    links        TEXT[]      NOT NULL DEFAULT '{}',
    status       TEXT        NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, applicant_id)
);
CREATE INDEX idx_applications_project_id   ON applications(project_id);
CREATE INDEX idx_applications_applicant_id ON applications(applicant_id);
