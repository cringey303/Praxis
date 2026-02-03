use aws_config::BehaviorVersion;
use aws_credential_types::Credentials;
use aws_sdk_s3::{
    config::{Builder, Region},
    primitives::ByteStream,
    Client,
};
use std::env;

/// Creates an S3 client configured for Cloudflare R2
pub fn create_r2_client() -> Client {
    let account_id = env::var("R2_ACCOUNT_ID").expect("R2_ACCOUNT_ID must be set");
    let access_key_id = env::var("R2_ACCESS_KEY_ID").expect("R2_ACCESS_KEY_ID must be set");
    let secret_access_key =
        env::var("R2_SECRET_ACCESS_KEY").expect("R2_SECRET_ACCESS_KEY must be set");

    let credentials = Credentials::new(
        access_key_id,
        secret_access_key,
        None, // session token
        None, // expiry
        "r2-credentials",
    );

    let config = Builder::new()
        .behavior_version(BehaviorVersion::latest())
        .region(Region::new("auto")) // R2 uses "auto" region
        .endpoint_url(format!("https://{}.r2.cloudflarestorage.com", account_id))
        .credentials_provider(credentials)
        .build();

    Client::from_conf(config)
}

/// Uploads bytes to R2 and returns the public URL
pub async fn upload_to_r2(
    client: &Client,
    bucket: &str,
    key: &str,
    data: Vec<u8>,
    content_type: &str,
) -> Result<String, aws_sdk_s3::Error> {
    let public_url = env::var("R2_PUBLIC_URL").expect("R2_PUBLIC_URL must be set");

    client
        .put_object()
        .bucket(bucket)
        .key(key)
        .body(ByteStream::from(data))
        .content_type(content_type)
        .send()
        .await?;

    // Return the public URL for the uploaded file
    Ok(format!("{}/{}", public_url, key))
}
