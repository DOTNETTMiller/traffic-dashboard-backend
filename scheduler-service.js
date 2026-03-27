// Scheduler Service
// Handles automated tasks like monthly report card generation

class SchedulerService {
  constructor(reportCardService, cifsService) {
    this.reportCardService = reportCardService;
    this.cifsService = cifsService;
    this.jobs = new Map();
    this.intervals = new Map();
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    console.log('📅 Starting scheduler service...');

    // Monthly Report Cards - Run on 1st of each month at 2:00 AM
    this.scheduleMonthlyReports();

    // CIFS Feed Cleanup - Run daily at 3:00 AM
    this.scheduleCIFSCleanup();

    // CIFS Feed Polling - Run every hour
    this.scheduleCIFSPolling();

    console.log('✅ Scheduler service started');
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    console.log('🛑 Stopping scheduler service...');

    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      console.log(`  ✓ Stopped ${name}`);
    }

    this.intervals.clear();
    this.jobs.clear();

    console.log('✅ Scheduler service stopped');
  }

  /**
   * Schedule monthly report card generation
   * Runs on the 1st of each month at 2:00 AM
   */
  scheduleMonthlyReports() {
    const jobName = 'monthly-reports';

    const runJob = async () => {
      const now = new Date();
      const day = now.getDate();
      const hour = now.getHours();
      const minute = now.getMinutes();

      // Run on 1st day of month between 2:00 AM and 2:59 AM
      if (day === 1 && hour === 2 && minute < 5) {
        console.log('📊 Running monthly report card generation...');

        try {
          // Get previous month in YYYY-MM format
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const monthYear = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

          // Generate monthly scores
          await this.reportCardService.generateMonthlyScores(monthYear);
          console.log(`✅ Generated scores for ${monthYear}`);

          // Wait 5 minutes before sending reports
          setTimeout(async () => {
            console.log('📧 Sending monthly reports to all states...');
            const results = await this.reportCardService.sendAllReports(monthYear);
            console.log(`✅ Sent ${results.length} reports`);
          }, 5 * 60 * 1000);

        } catch (error) {
          console.error('❌ Error in monthly report job:', error);
        }
      }
    };

    // Check every 30 minutes (monthly job doesn't need 5-minute precision)
    const interval = setInterval(runJob, 30 * 60 * 1000);
    this.intervals.set(jobName, interval);
    this.jobs.set(jobName, { interval: '30 minutes', description: 'Monthly report card generation' });

    console.log(`  ✓ Scheduled ${jobName} (checks every 30 minutes, runs on 1st at 2:00 AM)`);
  }

  /**
   * Schedule CIFS message cleanup
   * Runs daily at 3:00 AM
   */
  scheduleCIFSCleanup() {
    const jobName = 'cifs-cleanup';

    const runJob = async () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();

      // Run at 3:00 AM daily
      if (hour === 3 && minute < 15) {
        console.log('🧹 Running CIFS message cleanup...');

        try {
          const result = await this.cifsService.cleanupExpiredTIMMessages();
          console.log(`✅ Cleaned up ${result.deleted_count} expired TIM messages`);
        } catch (error) {
          console.error('❌ Error in CIFS cleanup job:', error);
        }
      }
    };

    // Check every 60 minutes (daily job doesn't need 15-minute precision)
    const interval = setInterval(runJob, 60 * 60 * 1000);
    this.intervals.set(jobName, interval);
    this.jobs.set(jobName, { interval: '60 minutes', description: 'CIFS expired message cleanup' });

    console.log(`  ✓ Scheduled ${jobName} (checks every 60 minutes, runs daily at 3:00 AM)`);
  }

  /**
   * Schedule CIFS feed polling
   * Runs every hour
   */
  scheduleCIFSPolling() {
    const jobName = 'cifs-polling';

    const runJob = async () => {
      // Get all active CIFS feeds from database
      try {
        const feeds = await this.cifsService.db.allAsync(
          `SELECT feed_id, feed_name FROM plugin_data_feeds
           WHERE enabled = 1 AND feed_format IN ('TIM', 'CV-TIM')`,
          []
        );

        if (feeds.length === 0) {
          return; // No feeds configured
        }

        console.log(`🔄 Polling ${feeds.length} CIFS feeds...`);

        for (const feed of feeds) {
          try {
            const result = await this.cifsService.pollCIFSFeed(feed.feed_id);
            console.log(`  ✓ ${feed.feed_name}: ${result.messages_processed} messages`);
          } catch (error) {
            console.error(`  ✗ ${feed.feed_name}: ${error.message}`);
          }
        }

        console.log('✅ CIFS polling complete');
      } catch (error) {
        console.error('❌ Error in CIFS polling job:', error);
      }
    };

    // Run every hour
    const interval = setInterval(runJob, 60 * 60 * 1000);
    this.intervals.set(jobName, interval);
    this.jobs.set(jobName, { interval: '1 hour', description: 'CIFS feed polling' });

    console.log(`  ✓ Scheduled ${jobName} (runs every hour)`);
  }

  /**
   * Get status of all scheduled jobs
   */
  getStatus() {
    const status = [];

    for (const [name, config] of this.jobs) {
      status.push({
        name: name,
        interval: config.interval,
        description: config.description,
        running: this.intervals.has(name)
      });
    }

    return status;
  }

  /**
   * Manually trigger a job
   */
  async triggerJob(jobName) {
    switch (jobName) {
      case 'monthly-reports':
        console.log('📊 Manually triggering monthly reports...');
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const monthYear = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
        await this.reportCardService.generateMonthlyScores(monthYear);
        await this.reportCardService.sendAllReports(monthYear);
        return { success: true, message: 'Monthly reports generated and sent' };

      case 'cifs-cleanup':
        console.log('🧹 Manually triggering CIFS cleanup...');
        const cleanupResult = await this.cifsService.cleanupExpiredTIMMessages();
        return { success: true, ...cleanupResult };

      case 'cifs-polling':
        console.log('🔄 Manually triggering CIFS polling...');
        const feeds = await this.cifsService.db.allAsync(
          `SELECT feed_id FROM plugin_data_feeds
           WHERE enabled = 1 AND feed_format IN ('TIM', 'CV-TIM')`,
          []
        );

        const results = [];
        for (const feed of feeds) {
          const result = await this.cifsService.pollCIFSFeed(feed.feed_id);
          results.push(result);
        }

        return { success: true, feeds_polled: results.length, results: results };

      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }
}

module.exports = SchedulerService;
