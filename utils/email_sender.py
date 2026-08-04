import asyncio
import smtplib
import ssl
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from loguru import logger
from core.config import settings

code_store: dict[str, dict] = {}

def generate_code() -> str:
    import random
    digits = "0123456789"
    code = "".join(random.choices(digits, k=6))
    return code

def store_code(email: str, code: str) -> None:
    expires_at = datetime.now() + timedelta(minutes=settings.CODE_EXPIRE_MINUTES)
    code_store[email] = {
        "code": code,
        "expires_at": expires_at,
        "created_at": datetime.now(),
        "attempts": 0
    }
    logger.info(f"Stored verification code for {email}, expires at {expires_at}")

def get_code(email: str) -> Optional[dict]:
    return code_store.get(email)

def verify_code(email: str, code: str) -> bool:
    record = code_store.get(email)
    if not record:
        logger.warning(f"No code found for email: {email}")
        return False

    if datetime.now() > record["expires_at"]:
        logger.warning(f"Code expired for email: {email}")
        del code_store[email]
        return False

    if record["attempts"] >= 3:
        logger.warning(f"Too many attempts for email: {email}")
        del code_store[email]
        return False

    if record["code"] == code:
        logger.info(f"Code verified successfully for email: {email}")
        del code_store[email]
        return True

    record["attempts"] += 1
    logger.warning(f"Invalid code attempt {record['attempts']}/3 for email: {email}")
    return False

def send_email(to_email: str, subject: str, html_content: str) -> bool:
    try:
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.warning("SMTP credentials not configured, skipping email send")
            return True

        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = settings.SMTP_SENDER or settings.SMTP_USER
        message["To"] = to_email

        part = MIMEText(html_content, "html", "utf-8")
        message.attach(part)

        context = ssl.create_default_context()

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls(context=context)
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(
                settings.SMTP_SENDER or settings.SMTP_USER,
                to_email,
                message.as_string()
            )

        logger.info(f"Email sent successfully to: {to_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False

def send_verification_email(to_email: str) -> Optional[str]:
    code = generate_code()
    store_code(to_email, code)

    subject = "智识RAG文档问答中台 - 邮箱验证码"
    html_content = f"""
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <title>邮箱验证码</title>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f5f7fa; margin: 0; padding: 20px; }}
            .container {{ max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }}
            .logo {{ font-size: 20px; font-weight: 600; color: #2B5EA7; margin-bottom: 8px; }}
            .subtitle {{ font-size: 14px; color: #8C96A3; margin-bottom: 24px; }}
            .code-box {{ background: #F5F7FA; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }}
            .code {{ font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #1A2332; font-family: 'SF Mono', 'Consolas', monospace; }}
            .hint {{ font-size: 12px; color: #8C96A3; margin-top: 12px; }}
            .footer {{ font-size: 12px; color: #8C96A3; margin-top: 24px; padding-top: 16px; border-top: 1px solid #F0F2F5; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">智识RAG文档问答中台</div>
            <div class="subtitle">欢迎注册使用 智识RAG文档问答中台</div>
            <p style="font-size: 14px; color: #5A6B7F; line-height: 1.6;">
                您好！您正在注册 智识RAG文档问答中台账户，请使用以下验证码完成验证：
            </p>
            <div class="code-box">
                <div class="code">{code}</div>
                <div class="hint">验证码有效期 {settings.CODE_EXPIRE_MINUTES} 分钟</div>
            </div>
            <p style="font-size: 14px; color: #8C96A3; line-height: 1.6;">
                如果这不是您本人的操作，请忽略此邮件。
            </p>
            <div class="footer">
                智识RAG文档问答中台 · 企业级智能文档检索与管理平台
            </div>
        </div>
    </body>
    </html>
    """

    if send_email(to_email, subject, html_content):
        return code
    return None