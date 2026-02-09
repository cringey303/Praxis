CREATE TABLE post_tags (
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tagged_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tagged_user_id)
);

CREATE INDEX idx_post_tags_tagged_user ON post_tags(tagged_user_id);
