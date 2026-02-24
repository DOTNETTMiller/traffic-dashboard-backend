const axios = require('axios');

/**
 * Notification Service
 *
 * Handles asset health notifications via multiple channels:
 * - Email (via environment-configured SMTP or API)
 * - SMS (via Twilio or similar)
 * - Slack/Teams webhooks
 * - Ticketing system integration
 */
class NotificationService {
  constructor() {
    this.enabled = process.env.NOTIFICATIONS_ENABLED === 'true';
    this.emailEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
    this.smsEnabled = process.env.SMS_NOTIFICATIONS_ENABLED === 'true';
    this.slackEnabled = process.env.SLACK_WEBHOOK_URL ? true : false;
    this.teamsEnabled = process.env.TEAMS_WEBHOOK_URL ? true : false;

    // Configuration
    this.slackWebhook = process.env.SLACK_WEBHOOK_URL;
    this.teamsWebhook = process.env.TEAMS_WEBHOOK_URL;
    this.emailRecipients = process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [];
    this.smsRecipients = process.env.ALERT_SMS_RECIPIENTS?.split(',') || [];

    // Notification throttling (prevent spam)
    this.recentNotifications = new Map();
    this.throttleWindowMs = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Send asset health alert through all enabled channels
   * @param {Object} alert - Alert data from asset health monitor
   */
  async sendAssetHealthAlert(alert) {
    if (!this.enabled) {
      console.log('📵 Notifications disabled, alert logged only');
      return;
    }

    // Check if we've recently sent this alert (prevent spam)
    const alertKey = `${alert.asset_id}-${alert.alert_type}`;
    const lastSent = this.recentNotifications.get(alertKey);

    if (lastSent && Date.now() - lastSent < this.throttleWindowMs) {
      console.log(`⏸️  Alert throttled for ${alert.asset_id} (sent ${Math.round((Date.now() - lastSent) / 60000)} mins ago)`);
      return;
    }

    // Format alert message
    const message = this.formatAlertMessage(alert);

    // Send through all enabled channels
    const promises = [];

    if (this.slackEnabled) {
      promises.push(this.sendSlackNotification(alert, message));
    }

    if (this.teamsEnabled) {
      promises.push(this.sendTeamsNotification(alert, message));
    }

    if (this.emailEnabled && this.emailRecipients.length > 0) {
      promises.push(this.sendEmailNotification(alert, message));
    }

    if (this.smsEnabled && this.smsRecipients.length > 0 && alert.status === 'FAILED') {
      // Only SMS for critical failures
      promises.push(this.sendSMSNotification(alert, message));
    }

    try {
      await Promise.allSettled(promises);

      // Record this notification
      this.recentNotifications.set(alertKey, Date.now());

      // Clean up old notifications from map
      if (this.recentNotifications.size > 1000) {
        const cutoff = Date.now() - this.throttleWindowMs;
        for (const [key, timestamp] of this.recentNotifications.entries()) {
          if (timestamp < cutoff) {
            this.recentNotifications.delete(key);
          }
        }
      }

      console.log(`✅ Alert sent for ${alert.asset_id} via enabled channels`);
    } catch (error) {
      console.error('❌ Error sending notifications:', error);
    }
  }

  /**
   * Format alert message
   */
  formatAlertMessage(alert) {
    const severity = alert.status === 'FAILED' ? '🔴 CRITICAL' :
                     alert.status === 'DEGRADED' ? '🟡 WARNING' :
                     '🟢 INFO';

    return {
      title: `${severity}: Asset Health Alert - ${alert.state_key.toUpperCase()}`,
      assetId: alert.asset_id,
      assetType: alert.asset_type,
      state: alert.state_key,
      status: alert.status,
      alertType: alert.alert_type,
      description: alert.description,
      performance: alert.performance_metric,
      uptime: `${alert.uptime_percentage}%`,
      lastCheck: new Date(alert.last_check_timestamp).toLocaleString(),
      severity: severity
    };
  }

  /**
   * Send Slack notification
   */
  async sendSlackNotification(alert, message) {
    try {
      const color = alert.status === 'FAILED' ? 'danger' :
                    alert.status === 'DEGRADED' ? 'warning' :
                    'good';

      const slackMessage = {
        text: message.title,
        attachments: [
          {
            color: color,
            fields: [
              {
                title: 'Asset ID',
                value: message.assetId,
                short: true
              },
              {
                title: 'Asset Type',
                value: message.assetType,
                short: true
              },
              {
                title: 'State',
                value: message.state.toUpperCase(),
                short: true
              },
              {
                title: 'Status',
                value: message.status,
                short: true
              },
              {
                title: 'Alert Type',
                value: message.alertType,
                short: true
              },
              {
                title: 'Uptime',
                value: message.uptime,
                short: true
              },
              {
                title: 'Description',
                value: message.description,
                short: false
              },
              {
                title: 'Performance',
                value: message.performance || 'N/A',
                short: false
              }
            ],
            footer: 'DOT Corridor Communicator - Asset Health Monitor',
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      };

      await axios.post(this.slackWebhook, slackMessage);
      console.log('  ✓ Slack notification sent');
    } catch (error) {
      console.error('  ✗ Slack notification failed:', error.message);
    }
  }

  /**
   * Send Microsoft Teams notification
   */
  async sendTeamsNotification(alert, message) {
    try {
      const themeColor = alert.status === 'FAILED' ? 'FF0000' :
                         alert.status === 'DEGRADED' ? 'FFA500' :
                         '00FF00';

      const teamsMessage = {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: message.title,
        themeColor: themeColor,
        title: message.title,
        sections: [
          {
            activityTitle: 'Asset Health Alert',
            activitySubtitle: message.assetId,
            facts: [
              {
                name: 'Asset Type:',
                value: message.assetType
              },
              {
                name: 'State:',
                value: message.state.toUpperCase()
              },
              {
                name: 'Status:',
                value: message.status
              },
              {
                name: 'Alert Type:',
                value: message.alertType
              },
              {
                name: 'Uptime:',
                value: message.uptime
              },
              {
                name: 'Description:',
                value: message.description
              },
              {
                name: 'Performance:',
                value: message.performance || 'N/A'
              },
              {
                name: 'Last Check:',
                value: message.lastCheck
              }
            ]
          }
        ]
      };

      await axios.post(this.teamsWebhook, teamsMessage);
      console.log('  ✓ Teams notification sent');
    } catch (error) {
      console.error('  ✗ Teams notification failed:', error.message);
    }
  }

  /**
   * Send email notification
   * Note: Requires environment configuration for email service
   */
  async sendEmailNotification(alert, message) {
    try {
      // This is a placeholder - actual implementation depends on email service
      // Options: SendGrid, AWS SES, Mailgun, SMTP, etc.

      const emailBody = `
${message.title}

Asset Details:
--------------
Asset ID: ${message.assetId}
Asset Type: ${message.assetType}
State: ${message.state.toUpperCase()}
Status: ${message.status}
Alert Type: ${message.alertType}
Uptime: ${message.uptime}

Description:
${message.description}

Performance Metric:
${message.performance || 'N/A'}

Last Check: ${message.lastCheck}

---
This is an automated alert from DOT Corridor Communicator Asset Health Monitor.
      `.trim();

      // Log email content (actual sending would use configured service)
      console.log('  ℹ️  Email notification prepared (configure EMAIL_SERVICE_* env vars to send):');
      console.log(`     Recipients: ${this.emailRecipients.join(', ')}`);
      console.log(`     Subject: ${message.title}`);

      // Example: SendGrid integration (uncomment and configure)
      /*
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const msg = {
        to: this.emailRecipients,
        from: process.env.ALERT_EMAIL_FROM || 'alerts@corridor-communicator.org',
        subject: message.title,
        text: emailBody,
        html: emailBody.replace(/\n/g, '<br>')
      };

      await sgMail.send(msg);
      console.log('  ✓ Email notification sent');
      */
    } catch (error) {
      console.error('  ✗ Email notification failed:', error.message);
    }
  }

  /**
   * Send SMS notification
   * Note: Requires Twilio or similar service configuration
   */
  async sendSMSNotification(alert, message) {
    try {
      // This is a placeholder - actual implementation requires Twilio setup

      const smsBody = `${message.severity}: ${message.assetType} ${message.assetId} in ${message.state.toUpperCase()} is ${message.status}. ${message.description}`;

      // Log SMS content (actual sending would use Twilio)
      console.log('  ℹ️  SMS notification prepared (configure TWILIO_* env vars to send):');
      console.log(`     Recipients: ${this.smsRecipients.join(', ')}`);
      console.log(`     Message: ${smsBody.substring(0, 100)}...`);

      // Example: Twilio integration (uncomment and configure)
      /*
      const twilio = require('twilio');
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      for (const recipient of this.smsRecipients) {
        await client.messages.create({
          body: smsBody.substring(0, 160), // SMS limit
          from: process.env.TWILIO_PHONE_NUMBER,
          to: recipient
        });
      }

      console.log('  ✓ SMS notification sent');
      */
    } catch (error) {
      console.error('  ✗ SMS notification failed:', error.message);
    }
  }

  /**
   * Create maintenance ticket (integration placeholder)
   * @param {Object} alert - Alert data
   */
  async createMaintenanceTicket(alert) {
    try {
      // This is a placeholder for ticketing system integration
      // Common systems: ServiceNow, Jira Service Desk, Zendesk, etc.

      const ticket = {
        title: `Asset Health Alert: ${alert.asset_id} - ${alert.alert_type}`,
        description: `
Asset: ${alert.asset_id}
Type: ${alert.asset_type}
State: ${alert.state_key.toUpperCase()}
Status: ${alert.status}
Alert Type: ${alert.alert_type}

${alert.description}

Performance Metric: ${alert.performance_metric || 'N/A'}
Uptime: ${alert.uptime_percentage}%
Last Check: ${new Date(alert.last_check_timestamp).toLocaleString()}
        `.trim(),
        priority: alert.status === 'FAILED' ? 'HIGH' : 'MEDIUM',
        category: 'Infrastructure',
        assignee: 'asset-maintenance-team'
      };

      console.log('  ℹ️  Maintenance ticket prepared (configure TICKETING_SYSTEM_* env vars):');
      console.log(`     Title: ${ticket.title}`);
      console.log(`     Priority: ${ticket.priority}`);

      // Example: ServiceNow integration (uncomment and configure)
      /*
      const serviceNowUrl = process.env.SERVICENOW_INSTANCE_URL;
      const auth = Buffer.from(
        `${process.env.SERVICENOW_USERNAME}:${process.env.SERVICENOW_PASSWORD}`
      ).toString('base64');

      const response = await axios.post(
        `${serviceNowUrl}/api/now/table/incident`,
        {
          short_description: ticket.title,
          description: ticket.description,
          urgency: ticket.priority === 'HIGH' ? 1 : 2,
          category: ticket.category,
          assignment_group: ticket.assignee
        },
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`  ✓ Ticket created: ${response.data.result.number}`);
      return response.data.result.number;
      */
    } catch (error) {
      console.error('  ✗ Ticket creation failed:', error.message);
    }
  }
}

module.exports = NotificationService;
