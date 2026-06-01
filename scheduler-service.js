// Scheduler Service
// Handles automated tasks like monthly report card generation

class SchedulerService {
  constructor(reportCardService, cifsService, options = {}) {
    this.reportCardService = reportCardService;
    this.cifsService = cifsService;
    // Optional async fn that refreshes corridor crash data (FARS). Injected by
    // the server so the scheduler stays decoupled from the db/geometry.
    this.crashRefreshFn = options.crashRefreshFn || null;
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

    // Corridor crash data (FARS) - Run on the 2nd of each month at 4:00 AM
    if (this.crashRefreshFn) {
      this.scheduleCrashDataRefresh();
    }

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
   * Schedule corridor crash-data refresh (NHTSA FARS).
   * Runs on the 2nd of each month at 4:00 AM — offset from the report-card and
   * cleanup jobs, and monthly is plenty since FARS publishes annually. Each run
   * re-downloads the (small) year window and upserts, so it self-heals and
   * automatically picks up newly published FARS years.
   */
  scheduleCrashDataRefresh() {
    const jobName = 'crash-refresh';

    const runJob = async () => {
      const now = new Date();
      if (now.getDate() === 2 && now.getHours() === 4 && now.getMinutes() < 30) {
        console.log('🚗 Running monthly corridor crash-data refresh...');
        try {
          const result = await this.crashRefreshFn();
          console.log(`✅ Crash refresh: ${result?.total ?? 0} records`);
        } catch (error) {
          console.error('❌ Error in crash-refresh job:', error.message);
        }
      }
    };

    // Check every 30 minutes (monthly job doesn't need finer precision)
    const interval = setInterval(runJob, 30 * 60 * 1000);
    this.intervals.set(jobName, interval);
    this.jobs.set(jobName, { interval: '30 minutes', description: 'Corridor crash data (FARS) refresh' });

    console.log(`  ✓ Scheduled ${jobName} (checks every 30 minutes, runs on 2nd at 4:00 AM)`);
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

      case 'crash-refresh':
        console.log('🚗 Manually triggering crash-data refresh...');
        if (!this.crashRefreshFn) throw new Error('crash refresh not configured');
        const crashResult = await this.crashRefreshFn();
        return { success: true, ...crashResult };

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
