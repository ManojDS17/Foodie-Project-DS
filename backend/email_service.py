import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Brevo (Sendinblue) Production SMTP Server Configurations
SMTP_HOST = os.getenv("SMTP_HOST", "smtp-relay.brevo.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Foodie Platform")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

def is_smtp_configured() -> bool:
    """Check if SMTP credentials have been provided."""
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD and SMTP_FROM_EMAIL)

def send_password_reset_email(to_email: str, token: str, recipient_name: str = "") -> dict:
    """
    Sends a branded password reset email with a 30-minute expiration token via Brevo SMTP relay.
    """
    reset_url = f"{FRONTEND_URL}/login?view=reset&token={token}&email={to_email}"
    display_name = recipient_name.strip() if recipient_name and recipient_name.strip() else to_email.split('@')[0]

    subject = "Reset your Foodie Dashboard password"

    plain_content = f"""Hello {display_name},

We received a request to reset the password for your Foodie account associated with {to_email}.

Click the link below (or copy and paste it into your browser) to choose a new password:
{reset_url}

This password reset link will expire in 30 minutes for your security.
If you did not request a password reset, you can safely ignore this email — your account remains completely secure.

© 2026 PowerTech Energy Pty Ltd. All rights reserved.
Foodie Platform
"""

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; margin: 0; padding: 40px 20px;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E3E4E6; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden;">
            <!-- Brand Header -->
            <tr>
                <td style="padding: 32px 32px 24px 32px; border-bottom: 1px solid #F3F4F6;">
                    <span style="font-size: 24px; font-weight: 800; color: #171717; letter-spacing: -0.5px;">FOODIE<span style="color: #00C951;">™</span></span>
                    <span style="font-size: 11px; font-weight: 700; color: #E32032; text-transform: uppercase; margin-left: 8px; padding-left: 8px; border-left: 1px solid #D1D5DB;">PowerTech Energy</span>
                </td>
            </tr>
            <!-- Main Content -->
            <tr>
                <td style="padding: 32px;">
                    <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">Reset your password</h2>
                    <p style="font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0 0 24px 0;">
                        Hello {display_name},<br><br>
                        We received a request to reset the password for your Foodie account associated with <strong>{to_email}</strong>. Click the button below to choose a new password:
                    </p>
                    <!-- CTA Button -->
                    <table border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                        <tr>
                            <td align="center" style="border-radius: 8px; background-color: #E32032;">
                                <a href="{reset_url}" target="_blank" style="font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block; background-color: #E32032;">
                                    Set a new password
                                </a>
                            </td>
                        </tr>
                    </table>
                    <p style="font-size: 12px; color: #6B7280; line-height: 1.5; margin: 20px 0 0 0;">
                        This password reset link will expire in <strong>30 minutes</strong> for your security.<br>
                        If you didn't request a password reset, you can safely ignore this email.
                    </p>
                    <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 28px 0 20px 0;">
                    <p style="font-size: 11px; color: #9CA3AF; line-height: 1.4; margin: 0;">
                        If the button doesn't work, copy and paste this link into your browser:<br>
                        <a href="{reset_url}" style="color: #E32032; word-break: break-all;">{reset_url}</a>
                    </p>
                </td>
            </tr>
            <!-- Footer -->
            <tr>
                <td style="padding: 20px 32px; background-color: #F9FAFB; border-top: 1px solid #F3F4F6; text-align: center;">
                    <p style="font-size: 11px; color: #9CA3AF; margin: 0;">
                        © 2026 PowerTech Energy Pty Ltd. All rights reserved.
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    if not is_smtp_configured():
        print(f"[Brevo SMTP Simulation] Password Reset Link for {to_email}: {reset_url}")
        return {"sent": True, "method": "simulated", "reset_url": reset_url}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        msg["Reply-To"] = SMTP_FROM_EMAIL

        # Attach text version then HTML version for spam score optimization
        msg.attach(MIMEText(plain_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        print(f"[Brevo SMTP] Connecting to {SMTP_HOST}:{SMTP_PORT} ...")
        print(f"[Brevo SMTP] Authenticating as: {SMTP_USER}")
        print(f"[Brevo SMTP] Sending FROM: {SMTP_FROM_EMAIL} TO: {to_email}")

        is_ssl = (SMTP_PORT == 465)
        server_class = smtplib.SMTP_SSL if is_ssl else smtplib.SMTP
        with server_class(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if not is_ssl:
                server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, [to_email], msg.as_string())

        print(f"[Brevo SMTP] [OK] Successfully dispatched password reset email to {to_email}")
        return {"sent": True, "method": "smtp", "reset_url": reset_url}
    except Exception as e:
        print(f"[Brevo SMTP ERROR] [FAIL] {e}")
        print(f"[Brevo SMTP ERROR] Host={SMTP_HOST} Port={SMTP_PORT} User={SMTP_USER} From={SMTP_FROM_EMAIL}")
        return {"sent": False, "method": "smtp", "reset_url": reset_url, "error": str(e)}

def send_client_welcome_email(
    to_email: str,
    raw_password: str,
    company_name: str,
    client_code: str,
    recipient_name: str = ""
) -> dict:
    from urllib.parse import quote_plus
    login_url = f"{FRONTEND_URL}/login?email={to_email}&password={quote_plus(raw_password)}"
    display_name = recipient_name.strip() if recipient_name and recipient_name.strip() else to_email.split('@')[0]
    subject = f"Welcome to Foodie Platform — Account Credentials for {company_name}"

    plain_content = f"""Hello {display_name},

Welcome to the Foodie Platform! Your client organization {company_name} ({client_code}) has been set up successfully.

Your Site Admin account credentials are:
  - Portal URL: {FRONTEND_URL}/login
  - Email: {to_email}
  - Password: {raw_password}
  - Role: Site Admin

Click the link below to log in directly to your client dashboard:
{login_url}

© 2026 PowerTech Energy Pty Ltd. All rights reserved.
Foodie Platform
"""

    html_content = f"""
    <!DOCTYPE html>
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
                    <span style="font-size: 24px; font-weight: 800; color: #171717; letter-spacing: -0.5px;">FOODIE<span style="color: #00C951;">™</span></span>
                    <span style="font-size: 11px; font-weight: 700; color: #E32032; text-transform: uppercase; margin-left: 8px; padding-left: 8px; border-left: 1px solid #D1D5DB;">PowerTech Energy</span>
                </td>
            </tr>
            <tr>
                <td style="padding: 32px;">
                    <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">Welcome to Foodie Platform</h2>
                    <p style="font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
                        Hello <strong>{display_name}</strong>,<br><br>
                        Your organization account for <strong>{company_name}</strong> ({client_code}) has been created on the Foodie Platform. Your <strong>Site Admin</strong> credentials have been configured:
                    </p>

                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; margin: 20px 0; padding: 18px 22px;">
                        <tr>
                            <td style="padding: 6px 0; font-size: 13px; color: #6B7280; width: 110px;">Portal:</td>
                            <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 600;">{FRONTEND_URL}/login</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">Email:</td>
                            <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 600; font-family: monospace;">{to_email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">Password:</td>
                            <td style="padding: 6px 0; font-size: 13px; color: #E32032; font-weight: 700; font-family: monospace;">{raw_password}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">Role:</td>
                            <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 600;">Site Administrator</td>
                        </tr>
                    </table>

                    <table border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 20px 0;">
                        <tr>
                            <td align="center" style="border-radius: 8px; background-color: #E32032;">
                                <a href="{login_url}" target="_blank" style="font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none; padding: 13px 30px; border-radius: 8px; display: inline-block; background-color: #E32032;">
                                    Log in to Foodie Platform
                                </a>
                            </td>
                        </tr>
                    </table>

                    <p style="font-size: 12px; color: #6B7280; line-height: 1.5; margin: 16px 0 0 0;">
                        Clicking the button will open the login page with your email and password ready for sign in.
                    </p>
                    <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 24px 0 18px 0;">
                    <p style="font-size: 11px; color: #9CA3AF; line-height: 1.4; margin: 0;">
                        If the button doesn't work, copy and paste this link into your browser:<br>
                        <a href="{login_url}" style="color: #E32032; word-break: break-all;">{login_url}</a>
                    </p>
                </td>
            </tr>
            <tr>
                <td style="padding: 18px 32px; background-color: #F9FAFB; border-top: 1px solid #F3F4F6; text-align: center;">
                    <p style="font-size: 11px; color: #9CA3AF; margin: 0;">
                        © 2026 PowerTech Energy Pty Ltd. All rights reserved.
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    if not is_smtp_configured():
        print(f"[Client Welcome Email] (SMTP not configured, simulated send) To: {to_email} | Password: {raw_password} | Login URL: {login_url}")
        return {"sent": True, "method": "simulated", "login_url": login_url}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        msg["Reply-To"] = SMTP_FROM_EMAIL

        msg.attach(MIMEText(plain_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        is_ssl = (SMTP_PORT == 465)
        server_class = smtplib.SMTP_SSL if is_ssl else smtplib.SMTP
        with server_class(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if not is_ssl:
                server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, [to_email], msg.as_string())

        print(f"[Brevo SMTP] [OK] Successfully sent welcome email with credentials to {to_email}")
        return {"sent": True, "method": "smtp", "login_url": login_url}
    except Exception as e:
        print(f"[Brevo SMTP ERROR] [FAIL] {e}")
        return {"sent": False, "method": "smtp", "login_url": login_url, "error": str(e)}

def send_operator_welcome_email(
    to_email: str,
    raw_password: str,
    company_name: str,
    client_code: str,
    recipient_name: str = ""
) -> dict:
    from urllib.parse import quote_plus
    login_url = f"{FRONTEND_URL}/login?email={to_email}&password={quote_plus(raw_password)}"
    display_name = recipient_name.strip() if recipient_name and recipient_name.strip() else to_email.split('@')[0]
    subject = f"Welcome to Foodie Platform — Operator Credentials for {company_name}"

    plain_content = f"""Hello {display_name},

Welcome to the Foodie Platform! You have been assigned as an Operator for {company_name} ({client_code}).

Your Operator account credentials are:
  - Portal URL: {FRONTEND_URL}/login
  - Email: {to_email}
  - Password: {raw_password}
  - Role: Facility Operator
  - Assigned Client: {company_name} ({client_code})

All machines assigned to {company_name} are connected to your account and accessible on your dashboard.

Click the link below to log in directly to your operator dashboard:
{login_url}

© 2026 PowerTech Energy Pty Ltd. All rights reserved.
Foodie Platform
"""

    html_content = f"""
    <!DOCTYPE html>
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
                    <span style="font-size: 24px; font-weight: 800; color: #171717; letter-spacing: -0.5px;">FOODIE<span style="color: #00C951;">™</span></span>
                    <span style="font-size: 11px; font-weight: 700; color: #E32032; text-transform: uppercase; margin-left: 8px; padding-left: 8px; border-left: 1px solid #D1D5DB;">PowerTech Energy</span>
                </td>
            </tr>
            <tr>
                <td style="padding: 32px;">
                    <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">Welcome to Foodie Platform</h2>
                    <p style="font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
                        Hello <strong>{display_name}</strong>,<br><br>
                        You have been registered as a <strong>Facility Operator</strong> for <strong>{company_name}</strong> ({client_code}) on the Foodie Platform. Your login credentials have been provisioned:
                    </p>

                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; margin: 20px 0; padding: 18px 22px;">
                        <tr>
                            <td style="padding: 6px 0; font-size: 13px; color: #6B7280; width: 120px;">Portal:</td>
                            <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 600;">{FRONTEND_URL}/login</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">Email:</td>
                            <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 600; font-family: monospace;">{to_email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">Password:</td>
                            <td style="padding: 6px 0; font-size: 13px; color: #E32032; font-weight: 700; font-family: monospace;">{raw_password}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">Assigned Client:</td>
                            <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 600;">{company_name} ({client_code})</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">Role:</td>
                            <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 600;">Facility Operator</td>
                        </tr>
                    </table>

                    <p style="font-size: 13px; color: #4B5563; line-height: 1.5; margin: 16px 0 20px 0;">
                        All composter machines assigned to {company_name} are connected to your account and accessible on your dashboard.
                    </p>

                    <table border="0" cellpadding="0" cellspacing="0" style="margin: 24px 0 20px 0;">
                        <tr>
                            <td align="center" style="border-radius: 8px; background-color: #E32032;">
                                <a href="{login_url}" target="_blank" style="font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none; padding: 13px 30px; border-radius: 8px; display: inline-block; background-color: #E32032;">
                                    Log in to Operator Dashboard
                                </a>
                            </td>
                        </tr>
                    </table>

                    <p style="font-size: 12px; color: #6B7280; line-height: 1.5; margin: 16px 0 0 0;">
                        Clicking the button will open the login page with your email and password ready for sign in.
                    </p>
                    <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 24px 0 18px 0;">
                    <p style="font-size: 11px; color: #9CA3AF; line-height: 1.4; margin: 0;">
                        If the button doesn't work, copy and paste this link into your browser:<br>
                        <a href="{login_url}" style="color: #E32032; word-break: break-all;">{login_url}</a>
                    </p>
                </td>
            </tr>
            <tr>
                <td style="padding: 18px 32px; background-color: #F9FAFB; border-top: 1px solid #F3F4F6; text-align: center;">
                    <p style="font-size: 11px; color: #9CA3AF; margin: 0;">
                        © 2026 PowerTech Energy Pty Ltd. All rights reserved.
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    if not is_smtp_configured():
        print(f"[Operator Welcome Email] (SMTP not configured, simulated send) To: {to_email} | Password: {raw_password} | Login URL: {login_url}")
        return {"sent": True, "method": "simulated", "login_url": login_url}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        msg["Reply-To"] = SMTP_FROM_EMAIL

        msg.attach(MIMEText(plain_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        is_ssl = (SMTP_PORT == 465)
        server_class = smtplib.SMTP_SSL if is_ssl else smtplib.SMTP
        with server_class(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if not is_ssl:
                server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, [to_email], msg.as_string())

        print(f"[Brevo SMTP] [OK] Successfully sent operator welcome email with credentials to {to_email}")
        return {"sent": True, "method": "smtp", "login_url": login_url}
    except Exception as e:
        print(f"[Brevo SMTP ERROR] [FAIL] {e}")
        return {"sent": False, "method": "smtp", "login_url": login_url, "error": str(e)}

