const emailService = require('./email-service');
const db = require('./database');

// In-memory queue for pending notifications (for development)
// In production, this should be stored in the database
const notificationQueue = new Map(); // user_id -> array of notifications

/**
 * Queue a notification for the daily digest instead of sending immediately
 */
function queueNotification(userId, notification) {
  if (!notificationQueue.has(userId)) {
    notificationQueue.set(userId, []);
  }

  notificationQueue.get(userId).push({
    ...notification,
    timestamp: new Date()
  });

  console.log(`📋 Queued notification for user ${userId}. Queue size: ${notificationQueue.get(userId).length}`);
}

/**
 * Send daily digest emails to all users with pending notifications
 */
async function sendDailyDigests() {
  console.log(`\n📧 Starting daily digest send at ${new Date().toLocaleString()}`);
  console.log(`   Users with pending notifications: ${notificationQueue.size}`);

  let sentCount = 0;
  let errorCount = 0;

  for (const [userId, notifications] of notificationQueue.entries()) {
    if (notifications.length === 0) continue;

    try {
      const user = await db.getUserById(userId);
      if (!user || !user.active) {
        console.log(`   ⏭️  Skipping inactive user ${userId}`);
        continue;
      }

      // Group notifications by type
      const messages = notifications.filter(n => n.type === 'message');
      const highSeverityEvents = notifications.filter(n => n.type === 'high_severity');
      const detourAlerts = notifications.filter(n => n.type === 'detour');

      // Send the digest email
      const result = await emailService.sendDailyDigest(
        user.email,
        user.fullName || user.username,
        {
          messages,
          highSeverityEvents,
          detourAlerts
        }
      );

      if (result.success) {
        sentCount++;
        console.log(`   ✅ Sent digest to ${user.email} (${notifications.length} notifications)`);
      } else {
        errorCount++;
        console.error(`   ❌ Failed to send digest to ${user.email}:`, result.error);
      }

    } catch (error) {
      errorCount++;
      console.error(`   ❌ Error sending digest to user ${userId}:`, error.message);
    }
  }

  // Clear the queue after sending
  notificationQueue.clear();

  console.log(`\n📊 Daily digest summary:`);
  console.log(`   ✅ Sent: ${sentCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   🧹 Queue cleared\n`);

  return { sent: sentCount, failed: errorCount };
}

/**
 * Schedule daily digest to run at specified time (default: 8 AM)
 */
function scheduleDailyDigest(hour = 8, minute = 0) {
  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(hour, minute, 0, 0);

  // If we've already passed today's scheduled time, schedule for tomorrow
  if (scheduledTime <= now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }

  const msUntilNext = scheduledTime - now;

  console.log(`\n⏰ Daily digest scheduled for ${scheduledTime.toLocaleString()}`);
  console.log(`   (in ${Math.round(msUntilNext / 1000 / 60)} minutes)\n`);

  // Schedule the first digest
  setTimeout(async () => {
    await sendDailyDigests();

    // Then schedule it to run daily
    setInterval(async () => {
      await sendDailyDigests();
    }, 24 * 60 * 60 * 1000); // Every 24 hours

  }, msUntilNext);
}

/**
 * Get current queue stats (for debugging/monitoring)
 */
function getQueueStats() {
  const stats = {
    totalUsers: notificationQueue.size,
    totalNotifications: 0,
    byType: {
      message: 0,
      high_severity: 0,
      detour: 0
    }
  };

  for (const notifications of notificationQueue.values()) {
    stats.totalNotifications += notifications.length;
    for (const n of notifications) {
      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
    }
  }

  return stats;
}

module.exports = {
  queueNotification,
  sendDailyDigests,
  scheduleDailyDigest,
  getQueueStats
};
