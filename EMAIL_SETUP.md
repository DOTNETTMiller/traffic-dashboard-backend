# Email Notification Setup Guide

This guide explains how to configure email notifications for the DOT Corridor Communicator.

## Features

The system sends automatic email notifications for:

1. **New Messages**: When someone posts a comment on an event in your state
2. **High-Severity Events** *(Coming Soon)*: When a critical event occurs on a major corridor in your state

## Email Configuration

### Option 1: Gmail (Recommended for Testing)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Create an App Password**:
   - Go to [Google Account Settings](https://myaccount.google.com/)
   - Navigate to Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Copy the 16-character password

3. **Set Environment Variables**:

```bash
# On macOS/Linux, add to ~/.zshrc or ~/.bashrc:
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT="587"
export EMAIL_USER="your-email@gmail.com"
export EMAIL_PASSWORD="your-16-char-app-password"

# On Windows (PowerShell):
$env:SMTP_HOST="smtp.gmail.com"
$env:SMTP_PORT="587"
$env:EMAIL_USER="your-email@gmail.com"
$env:EMAIL_PASSWORD="your-16-char-app-password"
```

4. **Restart the backend server** to load the environment variables

### Option 2: SendGrid (Recommended for Production)

1. **Sign up** for [SendGrid](https://sendgrid.com/) (free tier available)
2. **Create an API Key**:
   - Go to Settings → API Keys
   - Create API Key with "Mail Send" permissions
   - Copy the API key

3. **Set Environment Variables**:

```bash
export SMTP_HOST="smtp.sendgrid.net"
export SMTP_PORT="587"
export EMAIL_USER="apikey"
export EMAIL_PASSWORD="your-sendgrid-api-key"
```

### Option 3: Amazon SES

1. **Set up** [Amazon SES](https://aws.amazon.com/ses/)
2. **Get SMTP credentials** from AWS Console
3. **Set Environment Variables**:

```bash
export SMTP_HOST="email-smtp.us-east-1.amazonaws.com"
export SMTP_PORT="587"
export EMAIL_USER="your-smtp-username"
export EMAIL_PASSWORD="your-smtp-password"
```

## Testing Email Configuration

After setting up your email credentials:

1. **Start the backend server**:
   ```bash
   cd "/Users/mattmiller/Projects/DOT Corridor Communicator"
   node backend_proxy_server.js
   ```

2. **Check the startup logs** for:
   - `✅ Email server is ready to send messages` - Email is configured correctly
   - `❌ Email server verification failed` - Check your credentials

3. **Test by posting a comment**:
   - Log in to the dashboard
   - Click on any event in your state
   - Post a comment
   - Check if other users with your state affiliation receive an email

## User Notification Preferences

Users can control which notifications they receive:

### Default Settings
- **Message Notifications**: ✅ Enabled (users receive emails when someone comments on events in their state)
- **High-Severity Alerts**: ✅ Enabled (users receive emails for critical events on major corridors)

### How to Update Preferences

Via API (future UI coming soon):
```bash
curl -X PUT http://localhost:3001/api/users/notifications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notifyOnMessages": true,
    "notifyOnHighSeverity": true
  }'
```

## Email Templates

### Message Notification Email
- **Subject**: "New Message: [Event Type] on [Corridor] in [State]"
- **Content**: Event details, message sender, message content
- **Action**: Link to view event in dashboard

### High-Severity Event Email *(Coming Soon)*
- **Subject**: "⚠️ HIGH SEVERITY: [Event Type] on [Corridor] in [State]"
- **Content**: Event details, severity level, affected corridor
- **Action**: Link to view event and coordinate with neighboring states

## Troubleshooting

### No Emails Being Sent

1. **Check environment variables**:
   ```bash
   echo $SMTP_HOST
   echo $EMAIL_USER
   ```

2. **Check backend logs** for email-related errors

3. **Verify email credentials** are correct

4. **Check spam folder** - emails might be filtered

### Gmail "Less Secure App" Error

- Gmail no longer supports "less secure apps"
- **Solution**: Use an App Password (see Gmail setup above)

### SendGrid "Sender Identity" Error

- SendGrid requires sender verification
- **Solution**: Verify your sender email address in SendGrid dashboard

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate passwords** periodically
4. **Use dedicated email accounts** for automated notifications
5. **Enable 2FA** on email accounts

## Database Schema

Notification preferences are stored in the `users` table:

```sql
-- View a user's notification settings
SELECT username, email, notify_on_messages, notify_on_high_severity
FROM users
WHERE username = 'your-username';

-- Update notification settings manually (if needed)
UPDATE users
SET notify_on_messages = 1, notify_on_high_severity = 1
WHERE username = 'your-username';
```

## Email Service Architecture

- **email-service.js**: Handles email composition and sending
- **nodemailer**: SMTP client library
- **Background processing**: Emails sent asynchronously (non-blocking)
- **Error handling**: Failed emails logged but don't break the application

## Future Enhancements

- [ ] UI for notification preferences in user settings
- [ ] High-severity event detection and alerts
- [ ] Digest emails (daily summary of events)
- [ ] Email templates customization
- [ ] SMS notifications integration
- [ ] Slack/Teams webhook integration

## Support

If you encounter issues:
1. Check the backend server logs for error messages
2. Verify your SMTP credentials
3. Test with a different email provider
4. Check firewall settings (port 587 must be open)

---

**Last Updated**: 2025-10-20
**Email Service Version**: 1.0.0
