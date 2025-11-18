const sgMail = require('@sendgrid/mail');

// Configure SendGrid with API key from environment variables
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid configured with API key');
} else {
  console.warn('⚠️  SENDGRID_API_KEY not set - emails will not be sent');
}

// Default sender email
const FROM_EMAIL = process.env.EMAIL_USER || 'DOT.Corridor.Communicator@gmail.com';

/**
 * Generic email sending function
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text body
 * @param {string} html - Optional HTML body
 */
async function sendEmail(to, subject, text, html = null) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('⚠️  SendGrid not configured - email not sent');
    return { success: false, error: 'SendGrid not configured' };
  }

  const msg = {
    to,
    from: {
      email: FROM_EMAIL,
      name: 'DOT Corridor Communicator'
    },
    subject,
    text,
    ...(html && { html })
  };

  try {
    const response = await sgMail.send(msg);
    console.log(`✅ Email sent: ${response[0].statusCode}`);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('❌ Error sending email:', error.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send email notification for new message on event
 */
async function sendMessageNotification(recipientEmail, recipientName, event, message) {
  const msg = {
    to: recipientEmail,
    from: {
      email: FROM_EMAIL,
      name: 'DOT Corridor Communicator'
    },
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
    const response = await sgMail.send(msg);
    console.log('✅ Message notification sent:', response[0].statusCode);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('❌ Error sending message notification:', error.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send email notification for high-severity event
 */
async function sendHighSeverityEventNotification(recipientEmail, recipientName, event) {
  const msg = {
    to: recipientEmail,
    from: {
      email: FROM_EMAIL,
      name: 'DOT Corridor Communicator'
    },
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
    const response = await sgMail.send(msg);
    console.log('✅ High-severity event notification sent:', response[0].statusCode);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('❌ Error sending high-severity notification:', error.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

async function sendDetourAlertNotification(recipientEmail, recipientName, alert) {
  const msg = {
    to: recipientEmail,
    from: {
      email: FROM_EMAIL,
      name: 'DOT Corridor Communicator'
    },
    subject: `🚗 Detour Advisory: ${alert.interchangeName} (${alert.eventCorridor || alert.interchangeCorridor})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">🚗 Detour Advisory</h2>
          <p style="margin: 8px 0 0 0;">Significant congestion detected near ${alert.interchangeName}</p>
        </div>

        <div style="background-color: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Hello ${recipientName},</p>
          <p>A major backup has been detected near <strong>${alert.interchangeName}</strong> on <strong>${alert.eventCorridor || alert.interchangeCorridor || 'the monitored corridor'}</strong>.</p>

          <div style="background-color: #eff6ff; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb; margin: 18px 0;">
            <h3 style="margin: 0 0 10px 0; color: #1e3a8a;">Event Details</h3>
            <p style="margin: 4px 0; color: #475569;"><strong>Event:</strong> ${alert.eventDescription || 'See dashboard for details'}</p>
            ${alert.eventLocation ? `<p style="margin: 4px 0; color: #475569;"><strong>Location:</strong> ${alert.eventLocation}</p>` : ''}
            ${alert.severity ? `<p style="margin: 4px 0; color: #475569;"><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>` : ''}
            ${alert.lanesAffected ? `<p style="margin: 4px 0; color: #475569;"><strong>Lanes:</strong> ${alert.lanesAffected}</p>` : ''}
          </div>

          <div style="background-color: #fefce8; padding: 15px; border-radius: 6px; border: 1px solid #facc15;">
            <p style="margin: 0; color: #854d0e; font-weight: 600;">Recommended Action</p>
            <p style="margin: 6px 0 0 0; color: #92400e;">
              ${alert.message || 'Consider activating detour messaging to route drivers around the congestion and coordinate with neighboring DOTs.'}
            </p>
          </div>

          <p style="margin-top: 20px;">
            <a href="http://localhost:5173" style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600;">Open Dashboard →</a>
          </p>

          <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
            You're receiving this advisory because your state is subscribed to detour alerts for ${alert.interchangeName}.
          </p>
        </div>
      </div>
    `
  };

  try {
    const response = await sgMail.send(msg);
    console.log('✅ Detour alert notification sent:', response[0].statusCode);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('❌ Error sending detour alert notification:', error.response?.body || error.message);
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
 * Generic email sender
 */
async function sendEmail(to, subject, text, html) {
  // If SendGrid is not configured, just log and return error
  if (!process.env.SENDGRID_API_KEY) {
    console.log('⚠️  SendGrid not configured, would have sent:');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${text}`);
    return { success: false, error: 'SendGrid not configured' };
  }

  const msg = {
    to,
    from: {
      email: FROM_EMAIL,
      name: 'DOT Corridor Communicator'
    },
    subject,
    text,
    html: html || text
  };

  try {
    const response = await sgMail.send(msg);
    console.log('✅ Email sent:', response[0].statusCode);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('❌ Error sending email:', error.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Verify email configuration
 */
async function verifyEmailConfig() {
  if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ SendGrid API key not configured');
    console.log('💡 To enable email notifications:');
    console.log('   1. Sign up at https://sendgrid.com');
    console.log('   2. Create an API key with Mail Send permissions');
    console.log('   3. Set environment variable: SENDGRID_API_KEY');
    return false;
  }

  console.log('✅ SendGrid is configured and ready');
  return true;
}

/**
 * Send daily digest email with all notifications from the past 24 hours
 */
async function sendDailyDigest(recipientEmail, recipientName, notifications) {
  const { messages, highSeverityEvents, detourAlerts } = notifications;
  const totalCount = (messages?.length || 0) + (highSeverityEvents?.length || 0) + (detourAlerts?.length || 0);

  // Don't send empty digests
  if (totalCount === 0) {
    return { success: true, messageId: 'no-notifications' };
  }

  const msg = {
    to: recipientEmail,
    from: {
      email: FROM_EMAIL,
      name: 'DOT Corridor Communicator'
    },
    subject: `Daily Digest: ${totalCount} Update${totalCount > 1 ? 's' : ''} from DOT Corridor Communicator`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">📬 Your Daily Digest</h2>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Hello ${recipientName},</p>
          <p>Here's your summary of activity from the past 24 hours:</p>

          ${highSeverityEvents && highSeverityEvents.length > 0 ? `
          <div style="background-color: #fee2e2; padding: 15px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 20px 0;">
            <h3 style="margin: 0 0 12px 0; color: #991b1b;">🚨 High Severity Events (${highSeverityEvents.length})</h3>
            ${highSeverityEvents.slice(0, 5).map(event => `
              <div style="background-color: white; padding: 12px; border-radius: 4px; margin: 8px 0;">
                <p style="margin: 0; font-weight: 600; color: #1f2937;">${event.eventDetails?.eventType || 'Traffic Event'} - ${event.eventDetails?.state}</p>
                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">${event.eventDetails?.location || 'Unknown location'}</p>
              </div>
            `).join('')}
            ${highSeverityEvents.length > 5 ? `<p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">+ ${highSeverityEvents.length - 5} more</p>` : ''}
          </div>
          ` : ''}

          ${detourAlerts && detourAlerts.length > 0 ? `
          <div style="background-color: #dbeafe; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb; margin: 20px 0;">
            <h3 style="margin: 0 0 12px 0; color: #1e40af;">🚗 Detour Alerts (${detourAlerts.length})</h3>
            ${detourAlerts.slice(0, 5).map(alert => `
              <div style="background-color: white; padding: 12px; border-radius: 4px; margin: 8px 0;">
                <p style="margin: 0; font-weight: 600; color: #1f2937;">${alert.alertDetails?.interchangeName || 'Interchange'}</p>
                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">${alert.alertDetails?.message || 'Congestion detected'}</p>
              </div>
            `).join('')}
            ${detourAlerts.length > 5 ? `<p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">+ ${detourAlerts.length - 5} more</p>` : ''}
          </div>
          ` : ''}

          ${messages && messages.length > 0 ? `
          <div style="background-color: #f0f9ff; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6; margin: 20px 0;">
            <h3 style="margin: 0 0 12px 0; color: #1e40af;">💬 Messages (${messages.length})</h3>
            ${messages.slice(0, 5).map(msg => `
              <div style="background-color: white; padding: 12px; border-radius: 4px; margin: 8px 0;">
                <p style="margin: 0; font-weight: 600; color: #1f2937;">${msg.eventDetails?.eventType || 'Event'} - ${msg.eventDetails?.state}</p>
                <p style="margin: 4px 0; color: #6b7280; font-size: 14px;">${msg.messageDetails?.message || 'New message'}</p>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #9ca3af;">From: ${msg.messageDetails?.sender || 'Unknown'}</p>
              </div>
            `).join('')}
            ${messages.length > 5 ? `<p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">+ ${messages.length - 5} more</p>` : ''}
          </div>
          ` : ''}

          <p style="margin-top: 24px;">
            <a href="http://localhost:5173" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              View Dashboard →
            </a>
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

          <p style="font-size: 12px; color: #6b7280;">
            You're receiving this daily digest because you have notifications enabled.
            <a href="http://localhost:5173" style="color: #3b82f6;">Update your notification preferences</a>
          </p>
        </div>
      </div>
    `
  };

  try {
    const response = await sgMail.send(msg);
    console.log('✅ Daily digest sent:', response[0].statusCode);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('❌ Error sending daily digest:', error.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendEmail,
  sendMessageNotification,
  sendHighSeverityEventNotification,
  sendDetourAlertNotification,
  sendDailyDigest,
  verifyEmailConfig
};
