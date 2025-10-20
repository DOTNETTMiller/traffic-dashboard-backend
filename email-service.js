const nodemailer = require('nodemailer');

// Email configuration
// NOTE: For production, use environment variables for sensitive data
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password'
  }
};

// Create reusable transporter
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransporter(EMAIL_CONFIG);
  }
  return transporter;
}

/**
 * Send email notification for new message on event
 */
async function sendMessageNotification(recipientEmail, recipientName, event, message) {
  const transport = getTransporter();

  const mailOptions = {
    from: `"DOT Corridor Communicator" <${EMAIL_CONFIG.auth.user}>`,
    to: recipientEmail,
    subject: `New Message: ${event.eventType} on ${event.corridor} in ${event.state}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">🚦 New Message on Traffic Event</h2>
        </div>

        <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Hello ${recipientName},</p>

          <p>A new message has been posted on an event in your state:</p>

          <div style="background-color: white; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6; margin: 15px 0;">
            <h3 style="margin: 0 0 10px 0; color: #1f2937;">📍 ${event.eventType} - ${event.state}</h3>
            <p style="margin: 5px 0; color: #6b7280;"><strong>Location:</strong> ${event.location}</p>
            <p style="margin: 5px 0; color: #6b7280;"><strong>Corridor:</strong> ${event.corridor}</p>
            ${event.severity ? `<p style="margin: 5px 0;"><strong>Severity:</strong> <span style="color: ${getSeverityColor(event.severity)};">${event.severity.toUpperCase()}</span></p>` : ''}
          </div>

          <div style="background-color: #dbeafe; padding: 12px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af;">💬 Message from ${message.sender}:</p>
            <p style="margin: 0; color: #1f2937;">${message.message}</p>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">${new Date(message.timestamp).toLocaleString()}</p>
          </div>

          <p style="margin-top: 20px;">
            <a href="http://localhost:5173" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              View in Dashboard →
            </a>
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

          <p style="font-size: 12px; color: #6b7280;">
            You're receiving this email because you have message notifications enabled for your state.
            <a href="http://localhost:5173" style="color: #3b82f6;">Update your notification preferences</a>
          </p>
        </div>
      </div>
    `
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log('✅ Message notification sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending message notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send email notification for high-severity event
 */
async function sendHighSeverityEventNotification(recipientEmail, recipientName, event) {
  const transport = getTransporter();

  const mailOptions = {
    from: `"DOT Corridor Communicator" <${EMAIL_CONFIG.auth.user}>`,
    to: recipientEmail,
    subject: `⚠️ HIGH SEVERITY: ${event.eventType} on ${event.corridor} in ${event.state}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">⚠️ High Severity Traffic Event Alert</h2>
        </div>

        <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Hello ${recipientName},</p>

          <p>A <strong style="color: #dc2626;">HIGH SEVERITY</strong> event has been detected on a major corridor in your state that may significantly disrupt travel:</p>

          <div style="background-color: #fee2e2; padding: 15px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 15px 0;">
            <h3 style="margin: 0 0 10px 0; color: #991b1b;">🚨 ${event.eventType} - ${event.state}</h3>
            <p style="margin: 5px 0; color: #6b7280;"><strong>Location:</strong> ${event.location}</p>
            <p style="margin: 5px 0; color: #6b7280;"><strong>Corridor:</strong> <span style="color: #dc2626; font-weight: 600;">${event.corridor}</span></p>
            <p style="margin: 5px 0;"><strong>Severity:</strong> <span style="color: #dc2626; font-weight: 700; text-transform: uppercase;">${event.severity}</span></p>
            ${event.direction ? `<p style="margin: 5px 0; color: #6b7280;"><strong>Direction:</strong> ${event.direction}</p>` : ''}
            ${event.lanesAffected ? `<p style="margin: 5px 0; color: #6b7280;"><strong>Lanes Affected:</strong> ${event.lanesAffected}</p>` : ''}
          </div>

          ${event.description ? `
          <div style="background-color: white; padding: 12px; border-radius: 6px; margin: 15px 0; border: 1px solid #e5e7eb;">
            <p style="margin: 0 0 5px 0; font-weight: 600; color: #1f2937;">Description:</p>
            <p style="margin: 0; color: #6b7280;">${event.description}</p>
          </div>
          ` : ''}

          <div style="background-color: #fef3c7; padding: 12px; border-radius: 6px; margin: 15px 0; border: 1px solid #f59e0b;">
            <p style="margin: 0; color: #92400e;">
              <strong>⚡ Action Recommended:</strong> Review this event and consider coordinating with neighboring states if this corridor crosses state boundaries.
            </p>
          </div>

          <p style="margin-top: 20px;">
            <a href="http://localhost:5173" style="display: inline-block; background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              View Event Details →
            </a>
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

          <p style="font-size: 12px; color: #6b7280;">
            You're receiving this alert because you have high-severity event notifications enabled for your state.
            <a href="http://localhost:5173" style="color: #3b82f6;">Update your notification preferences</a>
          </p>
        </div>
      </div>
    `
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log('✅ High-severity event notification sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending high-severity notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper function to get color based on severity
 */
function getSeverityColor(severity) {
  const colors = {
    high: '#dc2626',
    medium: '#f59e0b',
    low: '#10b981'
  };
  return colors[severity?.toLowerCase()] || '#6b7280';
}

/**
 * Verify email configuration
 */
async function verifyEmailConfig() {
  try {
    const transport = getTransporter();
    await transport.verify();
    console.log('✅ Email server is ready to send messages');
    return true;
  } catch (error) {
    console.error('❌ Email server verification failed:', error.message);
    console.log('💡 To enable email notifications:');
    console.log('   1. Set up SMTP credentials (Gmail, SendGrid, etc.)');
    console.log('   2. Set environment variables: SMTP_HOST, EMAIL_USER, EMAIL_PASSWORD');
    console.log('   3. For Gmail: Use an App Password (not your regular password)');
    return false;
  }
}

module.exports = {
  sendMessageNotification,
  sendHighSeverityEventNotification,
  verifyEmailConfig
};
