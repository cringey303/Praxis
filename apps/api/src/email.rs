use lettre::{
    message::header::ContentType, transport::smtp::authentication::Credentials, AsyncSmtpTransport,
    AsyncTransport, Message, Tokio1Executor,
};
use std::env;

/// Sends an email using SMTP configuration from environment variables
pub async fn send_email(to: &str, subject: &str, body: String) -> Result<(), String> {
    let smtp_host = env::var("SMTP_HOST").map_err(|_| "SMTP_HOST not set")?;
    let smtp_port: u16 = env::var("SMTP_PORT")
        .unwrap_or_else(|_| "465".to_string())
        .parse()
        .map_err(|_| "Invalid SMTP_PORT")?;
    let smtp_username = env::var("SMTP_USERNAME").map_err(|_| "SMTP_USERNAME not set")?;
    let smtp_password = env::var("SMTP_PASSWORD").map_err(|_| "SMTP_PASSWORD not set")?;
    let from_address = env::var("SMTP_FROM").map_err(|_| "SMTP_FROM not set")?;

    let email = Message::builder()
        .from(
            from_address
                .parse()
                .map_err(|e| format!("Invalid from address: {}", e))?,
        )
        .to(to
            .parse()
            .map_err(|e| format!("Invalid to address: {}", e))?)
        .subject(subject)
        .header(ContentType::TEXT_HTML)
        .body(body)
        .map_err(|e| format!("Failed to build email: {}", e))?;

    let creds = Credentials::new(smtp_username, smtp_password);

    // Use SMTPS (TLS) for port 465, STARTTLS for others
    let mailer = if smtp_port == 465 {
        AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp_host)
            .map_err(|e| format!("Failed to create mailer: {}", e))?
            .credentials(creds)
            .build()
    } else {
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&smtp_host)
            .map_err(|e| format!("Failed to create mailer: {}", e))?
            .credentials(creds)
            .port(smtp_port)
            .build()
    };

    mailer
        .send(email)
        .await
        .map_err(|e| format!("Failed to send email: {}", e))?;

    Ok(())
}

/// Sends a verification email with the token link
pub async fn send_verification_email(to: &str, token: &str) -> Result<(), String> {
    let frontend_url =
        env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    let frontend_url = frontend_url
        .split(',')
        .next()
        .unwrap_or("http://localhost:3000")
        .trim();

    let verify_link = format!("{}/verify-email?token={}", frontend_url, token);

    let body = format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <style>
        @media (prefers-color-scheme: dark) {{
            .email-wrapper {{ background-color: #1a1a1a !important; }}
            .email-header {{ background-color: #262626 !important; border-color: #333 !important; }}
            .email-content {{ background-color: #1a1a1a !important; border-color: #333 !important; }}
            .text-heading {{ color: #f5f5f5 !important; }}
            .text-body {{ color: #e5e5e5 !important; }}
            .text-muted {{ color: #888 !important; }}
            .divider {{ border-color: #333 !important; }}
            .btn {{ background-color: #f5f5f5 !important; color: #111 !important; }}
        }}
    </style>
</head>
<body class="email-wrapper" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff;">
    <div class="email-header" style="background-color: #f5f5f5; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; border: 1px solid #e5e5e5; border-bottom: none;">
        <h1 class="text-heading" style="color: #111; margin: 0; font-size: 28px;">Welcome to Praxis!</h1>
    </div>
    <div class="email-content" style="background-color: #fff; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e5e5; border-top: none;">
        <p class="text-body" style="font-size: 16px; margin-bottom: 20px; color: #333;">Thanks for signing up! Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{}" class="btn" style="background-color: #111; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Verify Email</a>
        </div>
        <p class="text-muted" style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
        <p class="text-muted" style="font-size: 12px; color: #888; word-break: break-all;">{}</p>
        <hr class="divider" style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
        <p class="text-muted" style="font-size: 12px; color: #888; text-align: center;">If you didn't create an account, you can safely ignore this email.</p>
    </div>
</body>
</html>"#,
        verify_link, verify_link
    );

    send_email(to, "Verify your email - Praxis", body).await
}

/// Sends a password reset email (for future use)
pub async fn send_password_reset_email(to: &str, token: &str) -> Result<(), String> {
    let frontend_url =
        env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    let frontend_url = frontend_url
        .split(',')
        .next()
        .unwrap_or("http://localhost:3000")
        .trim();

    let reset_link = format!("{}/reset-password?token={}", frontend_url, token);

    let body = format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <style>
        @media (prefers-color-scheme: dark) {{
            .email-wrapper {{ background-color: #1a1a1a !important; }}
            .email-header {{ background-color: #262626 !important; border-color: #333 !important; }}
            .email-content {{ background-color: #1a1a1a !important; border-color: #333 !important; }}
            .text-heading {{ color: #f5f5f5 !important; }}
            .text-body {{ color: #e5e5e5 !important; }}
            .text-muted {{ color: #888 !important; }}
            .divider {{ border-color: #333 !important; }}
            .btn {{ background-color: #f5f5f5 !important; color: #111 !important; }}
        }}
    </style>
</head>
<body class="email-wrapper" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff;">
    <div class="email-header" style="background-color: #f5f5f5; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; border: 1px solid #e5e5e5; border-bottom: none;">
        <h1 class="text-heading" style="color: #111; margin: 0; font-size: 28px;">Password Reset</h1>
    </div>
    <div class="email-content" style="background-color: #fff; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e5e5; border-top: none;">
        <p class="text-body" style="font-size: 16px; margin-bottom: 20px; color: #333;">We received a request to reset your password. Click the button below to choose a new one:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{}" class="btn" style="background-color: #111; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Reset Password</a>
        </div>
        <p class="text-muted" style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
        <p class="text-muted" style="font-size: 12px; color: #888; word-break: break-all;">{}</p>
        <hr class="divider" style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
        <p class="text-muted" style="font-size: 12px; color: #888; text-align: center;">If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
</body>
</html>"#,
        reset_link, reset_link
    );

    send_email(to, "Reset your password - Praxis", body).await
}
