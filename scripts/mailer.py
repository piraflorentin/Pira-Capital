"""Send one email via SMTP (Gmail App Password or Resend SMTP). Stdlib only."""
import os, smtplib
from email.mime.text import MIMEText


def send_email(to, subject, body):
    host = os.environ.get("SMTP_HOST", "")
    port = int(os.environ.get("SMTP_PORT", "587") or 587)
    user = os.environ.get("SMTP_USER", "")
    pw = os.environ.get("SMTP_PASS", "")
    frm = os.environ.get("SMTP_FROM", "") or user
    if not (host and user and pw and to):
        raise RuntimeError("SMTP not configured")
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"], msg["From"], msg["To"] = subject, frm, to
    with smtplib.SMTP(host, port, timeout=30) as s:
        s.starttls()
        s.login(user, pw)
        s.sendmail(frm, [to], msg.as_string())
