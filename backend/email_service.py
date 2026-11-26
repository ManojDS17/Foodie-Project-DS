import os
import smtplib
import html
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Optional
from urllib.parse import quote_plus
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp-relay.brevo.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Foodie Platform")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

def is_smtp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD and SMTP_FROM_EMAIL)

def _dispatch_mime_email(to_email: str, subject: str, plain_content: str, html_content: str) -> dict:
    if not is_smtp_configured():
        print(f"[SMTP Simulation] To: {to_email} | Subject: {subject}")
        return {"sent": True, "method": "simulated"}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = Header(subject, "utf-8")
        msg["From"] = formataddr((str(Header(SMTP_FROM_NAME, "utf-8")), SMTP_FROM_EMAIL))
        msg["To"] = to_email
        msg["Reply-To"] = SMTP_FROM_EMAIL
        msg["MIME-Version"] = "1.0"

        part_plain = MIMEText(plain_content, "plain", "utf-8")
        part_html = MIMEText(html_content, "html", "utf-8")
        msg.attach(part_plain)
        msg.attach(part_html)

        is_ssl = (SMTP_PORT == 465)
        server_class = smtplib.SMTP_SSL if is_ssl else smtplib.SMTP
        with server_class(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if not is_ssl:
                server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)

        print(f"[Brevo SMTP] [OK] Successfully delivered email to {to_email}")
        return {"sent": True, "method": "smtp"}
    except Exception as e:
        print(f"[Brevo SMTP ERROR] [FAIL] {e}")
        return {"sent": False, "method": "smtp", "error": str(e)}

def send_password_reset_email(to_email: str, token: str, recipient_name: str = "") -> dict:
    reset_url = f"{FRONTEND_URL}/login?view=reset&token={token}&email={quote_plus(to_email)}"
    display_name = recipient_name.strip() if recipient_name and recipient_name.strip() else to_email.split('@')[0]
    subject = "Reset your Foodie Dashboard password"

    esc_display_name = html.escape(display_name)
    esc_to_email = html.escape(to_email)
    esc_reset_url = html.escape(reset_url)

    plain_content = f"""Hello {display_name},

We received a request to reset the password for your Foodie account associated with {to_email}.

Click the link below to choose a new password:
{reset_url}

This password reset link will expire in 30 minutes for your security.
If you did not request a password reset, you can safely ignore this email.

Foodie Platform
PowerTech Energy Pty Ltd
"""

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; margin: 0; padding: 40px 20px;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E3E4E6; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden;">
        <tr>
            <td style="padding: 28px 32px; border-bottom: 1px solid #F3F4F6;">
                <span style="font-size: 22px; font-weight: 800; color: #171717; letter-spacing: -0.5px;">FOODIE</span>
                <span style="font-size: 11px; font-weight: 700; color: #E32032; text-transform: uppercase; margin-left: 8px; padding-left: 8px; border-left: 1px solid #D1D5DB;">PowerTech Energy</span>
            </td>
        </tr>
        <tr>
            <td style="padding: 32px;">
                <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">Reset your password</h2>
                <p style="font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0 0 24px 0;">
                    Hello <strong>{esc_display_name}</strong>,<br><br>
                    We received a request to reset the password for your account associated with <strong>{esc_to_email}</strong>. Click the button below to choose a new password:
                </p>
                <table border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                    <tr>
                        <td align="center" style="border-radius: 8px; background-color: #E32032;">
                            <a href="{esc_reset_url}" target="_blank" style="font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block; background-color: #E32032;">
                                Set a new password
                            </a>
                        </td>
                    </tr>
                </table>
                <p style="font-size: 12px; color: #6B7280; line-height: 1.5; margin: 20px 0 0 0;">
                    This password reset link will expire in <strong>30 minutes</strong> for your security.<br>
                    If you did not request a password reset, you can safely ignore this email.
                </p>
                <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 28px 0 20px 0;">
                <p style="font-size: 11px; color: #9CA3AF; line-height: 1.4; margin: 0;">
                    If the button does not work, copy and paste this link into your browser:<br>
                    <a href="{esc_reset_url}" style="color: #E32032; word-break: break-all;">{esc_reset_url}</a>
                </p>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px 32px; background-color: #F9FAFB; border-top: 1px solid #F3F4F6; text-align: center;">
                <p style="font-size: 11px; color: #9CA3AF; margin: 0;">
                    &copy; 2026 PowerTech Energy Pty Ltd. All rights reserved.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>"""

    result = _dispatch_mime_email(to_email, subject, plain_content, html_content)
    result["reset_url"] = reset_url
    return result

def send_client_welcome_email(
    to_email: str,
    company_name: str,
    client_code: str,
    recipient_name: str = "",
    reset_token: Optional[str] = None
) -> dict:
    login_url = f"{FRONTEND_URL}/login?email={quote_plus(to_email)}"
    setup_url = f"{FRONTEND_URL}/login?view=reset&token={reset_token}&email={quote_plus(to_email)}" if reset_token else login_url
    display_name = recipient_name.strip() if recipient_name and recipient_name.strip() else to_email.split('@')[0]
    subject = f"Welcome to Foodie Platform - Set Up Your Account for {company_name}"

    esc_display_name = html.escape(display_name)
    esc_company_name = html.escape(company_name)
    esc_client_code = html.escape(client_code)
    esc_to_email = html.escape(to_email)
    esc_login_url = html.escape(login_url)
    esc_setup_url = html.escape(setup_url)

    plain_content = f"""Hello {display_name},

Welcome to the Foodie Platform! Your client organization {company_name} has been set up successfully.

Your Site Administrator account details:
  - Portal URL: {FRONTEND_URL}/login
  - Email: {to_email}
  - Role: Site Administrator

Use the one-time setup link below to choose your password and activate your account (valid for 7 days):
{setup_url}

Foodie Platform
PowerTech Energy Pty Ltd
"""

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; margin: 0; padding: 40px 20px;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E3E4E6; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden;">
        <tr>
            <td style="padding: 28px 32px; border-bottom: 1px solid #F3F4F6;">
                <span style="font-size: 22px; font-weight: 800; color: #171717; letter-spacing: -0.5px;">FOODIE</span>
                <span style="font-size: 11px; font-weight: 700; color: #E32032; text-transform: uppercase; margin-left: 8px; padding-left: 8px; border-left: 1px solid #D1D5DB;">PowerTech Energy</span>
            </td>
        </tr>
        <tr>
            <td style="padding: 32px;">
                <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">Welcome to Foodie Platform</h2>
                <p style="font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
                    Hello <strong>{esc_display_name}</strong>,<br><br>
                    Your organization account for <strong>{esc_company_name}</strong> has been created on the Foodie Platform. Complete your <strong>Site Administrator</strong> setup using the secure link below:
                </p>

                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; margin: 20px 0; padding: 18px 22px;">
                    <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #6B7280; width: 110px;">Portal:</td>
                        <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 600;">{esc_login_url}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">Email:</td>
                        <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 600; font-family: monospace;">{esc_to_email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">Role:</td>
                        <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 600;">Site Administrator</td>
                    </tr>
                </table>

                <table border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 20px 0;">
                    <tr>
                        <td align="center" style="border-radius: 8px; background-color: #E32032;">
                            <a href="{esc_setup_url}" target="_blank" style="font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none; padding: 13px 30px; border-radius: 8px; display: inline-block; background-color: #E32032;">
                                Set Password &amp; Sign In
                            </a>
                        </td>
                    </tr>
                </table>

                <p style="font-size: 12px; color: #6B7280; line-height: 1.5; margin: 16px 0 0 0;">
                    For your security, passwords are never sent via email. This one-time setup link is valid for <strong>7 days</strong>.
                </p>
                <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 24px 0 18px 0;">
                <p style="font-size: 11px; color: #9CA3AF; line-height: 1.4; margin: 0;">
                    If the button does not work, copy and paste this link into your browser:<br>
                    <a href="{esc_setup_url}" style="color: #E32032; word-break: break-all;">{esc_setup_url}</a>
                </p>
            </td>
        </tr>
        <tr>
            <td style="padding: 18px 32px; background-color: #F9FAFB; border-top: 1px solid #F3F4F6; text-align: center;">
                <p style="font-size: 11px; color: #9CA3AF; margin: 0;">
                    &copy; 2026 PowerTech Energy Pty Ltd. All rights reserved.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>"""

    result = _dispatch_mime_email(to_email, subject, plain_content, html_content)
    result["login_url"] = setup_url
    return result

def send_operator_welcome_email(
    to_email: str,
    company_name: str,
    client_code: str,
    recipient_name: str = "",
    reset_token: Optional[str] = None
) -> dict:
    login_url = f"{FRONTEND_URL}/login?email={quote_plus(to_email)}"
    setup_url = f"{FRONTEND_URL}/login?view=reset&token={reset_token}&email={quote_plus(to_email)}" if reset_token else login_url
    display_name = recipient_name.strip() if recipient_name and recipient_name.strip() else to_email.split('@')[0]
    subject = f"Welcome to Foodie Platform - Set Up Your Operator Account for {company_name}"

    esc_display_name = html.escape(display_name)
    esc_company_name = html.escape(company_name)
    esc_client_code = html.escape(client_code)
    esc_to_email = html.escape(to_email)
    esc_login_url = html.escape(login_url)
    esc_setup_url = html.escape(setup_url)

    plain_content = f"""Hello {display_name},

Welcome to the Foodie Platform! You have been registered as a Facility Operator for {company_name}.

Your Operator account details:
  - Portal URL: {FRONTEND_URL}/login
  - Email: {to_email}
  - Role: Facility Operator
  - Assigned Client: {company_name}

Use the one-time setup link below to choose your password and sign in (valid for 7 days):
{setup_url}

Foodie Platform
PowerTech Energy Pty Ltd
"""

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; margin: 0; padding: 40px 20px;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E3E4E6; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden;">
        <tr>
            <td style="padding: 28px 32px; border-bottom: 1px solid #F3F4F6;">
                <span style="font-size: 22px; font-weight: 800; color: #171717; letter-spacing: -0.5px;">FOODIE</span>
                <span style="font-size: 11px; font-weight: 700; color: #E32032; text-transform: uppercase; margin-left: 8px; padding-left: 8px; border-left: 1px solid #D1D5DB;">PowerTech Energy</span>
            </td>
        </tr>
        <tr>
            <td style="padding: 32px;">
                <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">Welcome to Foodie Platform</h2>
                <p style="font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
                    Hello <strong>{esc_display_name}</strong>,<br><br>
                    You have been onboarded as a <strong>Facility Operator</strong> for <strong>{esc_company_name}</strong>. Use the secure setup link below to choose your password:
                </p>

                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; margin: 20px 0; padding: 18px 22px;">
                    <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #6B7280; width: 110px;">Portal:</td>
                        <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 600;">{esc_login_url}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">Email:</td>
                        <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 600; font-family: monospace;">{esc_to_email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">Role:</td>
                        <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 600;">Facility Operator</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">Client:</td>
                        <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 600;">{esc_company_name}</td>
                    </tr>
                </table>

                <table border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 20px 0;">
                    <tr>
                        <td align="center" style="border-radius: 8px; background-color: #E32032;">
                            <a href="{esc_setup_url}" target="_blank" style="font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none; padding: 13px 30px; border-radius: 8px; display: inline-block; background-color: #E32032;">
                                Set Password &amp; Sign In
                            </a>
                        </td>
                    </tr>
                </table>

                <p style="font-size: 12px; color: #6B7280; line-height: 1.5; margin: 16px 0 0 0;">
                    For your security, passwords are never sent via email. This one-time setup link is valid for <strong>7 days</strong>.
                </p>
                <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 24px 0 18px 0;">
                <p style="font-size: 11px; color: #9CA3AF; line-height: 1.4; margin: 0;">
                    If the button does not work, copy and paste this link into your browser:<br>
                    <a href="{esc_setup_url}" style="color: #E32032; word-break: break-all;">{esc_setup_url}</a>
                </p>
            </td>
        </tr>
        <tr>
            <td style="padding: 18px 32px; background-color: #F9FAFB; border-top: 1px solid #F3F4F6; text-align: center;">
                <p style="font-size: 11px; color: #9CA3AF; margin: 0;">
                    &copy; 2026 PowerTech Energy Pty Ltd. All rights reserved.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>"""

    result = _dispatch_mime_email(to_email, subject, plain_content, html_content)
    result["login_url"] = setup_url
    return result
