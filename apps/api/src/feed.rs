use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Deserialize)]
pub struct FeedQuery {
    #[serde(rename = "type")]
    pub feed_type: Option<String>, // "posts", "projects", or None for all
}

#[derive(Serialize)]
pub struct FeedItem {
    pub id: uuid::Uuid,
    #[serde(rename = "type")]
    pub item_type: String, // "post" or "project"
    pub content: Option<String>,      // post content
    pub title: Option<String>,        // project title
    pub description: Option<String>,  // project description
    pub image_url: Option<String>,
    pub status: Option<String>,       // project status
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub author_id: uuid::Uuid,
    pub author_name: String,
    pub author_username: String,
    pub author_avatar: Option<String>,
}

/// Get unified feed of posts and projects
pub async fn get_feed(
    State(pool): State<PgPool>,
    Query(query): Query<FeedQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let feed = match query.feed_type.as_deref() {
        Some("posts") => get_posts_only(&pool).await?,
        Some("projects") => get_projects_only(&pool).await?,
        _ => get_all_items(&pool).await?,
    };

    Ok(Json(feed))
}

async fn get_posts_only(pool: &PgPool) -> Result<Vec<FeedItem>, (StatusCode, String)> {
    let items = sqlx::query_as!(
        FeedItem,
        r#"
        SELECT
            p.id,
            'post' as "item_type!",
            p.content,
            NULL::text as title,
            NULL::text as description,
            p.image_url,
            NULL::text as status,
            p.created_at,
            p.author_id,
            u.display_name as author_name,
            u.username as author_username,
            u.avatar_url as author_avatar
        FROM posts p
        JOIN users u ON p.author_id = u.id
        ORDER BY p.created_at DESC
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(items)
}

async fn get_projects_only(pool: &PgPool) -> Result<Vec<FeedItem>, (StatusCode, String)> {
    let items = sqlx::query_as!(
        FeedItem,
        r#"
        SELECT
            p.id,
            'project' as "item_type!",
            NULL::text as content,
            p.title,
            p.description,
            p.image_url,
            p.status,
            p.created_at,
            p.owner_id as author_id,
            u.display_name as author_name,
            u.username as author_username,
            u.avatar_url as author_avatar
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        ORDER BY p.created_at DESC
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(items)
}

async fn get_all_items(pool: &PgPool) -> Result<Vec<FeedItem>, (StatusCode, String)> {
    let items = sqlx::query_as!(
        FeedItem,
        r#"
        SELECT
            id as "id!",
            item_type as "item_type!",
            content,
            title,
            description,
            image_url,
            status,
            created_at as "created_at!",
            author_id as "author_id!",
            author_name as "author_name!",
            author_username as "author_username!",
            author_avatar
        FROM (
            SELECT
                p.id,
                'post'::text as item_type,
                p.content,
                NULL::text as title,
                NULL::text as description,
                p.image_url,
                NULL::text as status,
                p.created_at,
                p.author_id,
                u.display_name as author_name,
                u.username as author_username,
                u.avatar_url as author_avatar
            FROM posts p
            JOIN users u ON p.author_id = u.id

            UNION ALL

            SELECT
                p.id,
                'project'::text as item_type,
                NULL::text as content,
                p.title,
                p.description,
                p.image_url,
                p.status,
                p.created_at,
                p.owner_id as author_id,
                u.display_name as author_name,
                u.username as author_username,
                u.avatar_url as author_avatar
            FROM projects p
            JOIN users u ON p.owner_id = u.id
        ) combined
        ORDER BY created_at DESC
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(items)
}
