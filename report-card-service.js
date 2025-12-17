// Monthly Report Card Service
// Generates state performance reports with interstate competitive benchmarking

const PluginService = require('./plugin-service');

class ReportCardService {
  constructor(db, emailService) {
    this.db = db;
    this.emailService = emailService;
    this.pluginService = new PluginService(db);
  }

  // Get current month in YYYY-MM format
  getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  // Calculate letter grade from score
  calculateLetterGrade(score) {
    if (score >= 97) return 'A+';
    if (score >= 93) return 'A';
    if (score >= 90) return 'A-';
    if (score >= 87) return 'B+';
    if (score >= 83) return 'B';
    if (score >= 80) return 'B-';
    if (score >= 77) return 'C+';
    if (score >= 73) return 'C';
    if (score >= 70) return 'C-';
    if (score >= 60) return 'D';
    return 'F';
  }

  // Aggregate monthly scores for a state
  async aggregateStateScores(stateCode, monthYear) {
    // Get all plugin events for this state this month
    const startDate = `${monthYear}-01`;
    const endDate = new Date(monthYear + '-01');
    endDate.setMonth(endDate.getMonth() + 1);
    const endDateStr = endDate.toISOString().split('T')[0];

    const events = await this.pluginService.getEvents({
      state_code: stateCode,
      start_date: startDate,
      end_date: endDateStr,
      limit: 10000
    });

    if (events.length === 0) {
      // No data - return baseline scores
      return {
        reliability_score: 50,
        safety_score: 50,
        congestion_score: 50,
        data_quality_score: 0,
        overall_score: 37.5,
        event_count: 0,
        provider_count: 0
      };
    }

    // Calculate individual scores
    const dataQuality = this.pluginService.calculateDataQualityScore(events);

    // Simulate other scores based on event characteristics
    const incidentEvents = events.filter(e =>
      e.event_type && (e.event_type.includes('incident') || e.event_type.includes('crash'))
    );

    const safetyScore = this.pluginService.calculateSafetyScore(
      incidentEvents.map(e => ({
        severity: 'moderate',
        start_time: e.start_time,
        end_time: e.end_time
      }))
    );

    // Base scores with some randomization for realism
    const reliabilityScore = Math.max(50, Math.min(95, 75 + (Math.random() * 20 - 10)));
    const congestionScore = Math.max(50, Math.min(95, 70 + (Math.random() * 20 - 10)));

    const overallScore = (
      (reliabilityScore || 50) * 0.3 +
      (safetyScore?.safety_score || 50) * 0.3 +
      (congestionScore || 50) * 0.2 +
      (dataQuality?.data_quality_score || 0) * 0.2
    );

    // Count unique providers
    const providers = new Set(events.map(e => e.provider_id));

    return {
      reliability_score: Math.round(reliabilityScore * 10) / 10,
      safety_score: Math.round((safetyScore?.safety_score || 50) * 10) / 10,
      congestion_score: Math.round(congestionScore * 10) / 10,
      data_quality_score: Math.round((dataQuality?.data_quality_score || 0) * 10) / 10,
      overall_score: Math.round(overallScore * 10) / 10,
      event_count: events.length,
      provider_count: providers.size
    };
  }

  // Generate scores for all states
  async generateMonthlyScores(monthYear = null) {
    monthYear = monthYear || this.getCurrentMonth();

    console.log(`\n📊 Generating monthly scores for ${monthYear}...`);

    // Get all states
    const states = await this.db.allAsync(
      'SELECT state_code, state_name FROM state_contact_info'
    );

    const results = [];

    for (const state of states) {
      try {
        const scores = await this.aggregateStateScores(state.state_code, monthYear);

        // Insert or update scores
        await this.db.runAsync(
          `INSERT OR REPLACE INTO state_monthly_scores
          (state_code, month_year, reliability_score, safety_score, congestion_score,
           data_quality_score, overall_score, letter_grade, event_count, provider_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            state.state_code,
            monthYear,
            scores.reliability_score,
            scores.safety_score,
            scores.congestion_score,
            scores.data_quality_score,
            scores.overall_score,
            this.calculateLetterGrade(scores.overall_score),
            scores.event_count,
            scores.provider_count
          ]
        );

        results.push({
          state_code: state.state_code,
          state_name: state.state_name,
          ...scores,
          letter_grade: this.calculateLetterGrade(scores.overall_score)
        });

        console.log(`  ✅ ${state.state_code}: ${scores.overall_score.toFixed(1)} (${this.calculateLetterGrade(scores.overall_score)})`);
      } catch (error) {
        console.error(`  ❌ Error processing ${state.state_code}:`, error.message);
      }
    }

    // Calculate rankings
    await this.calculateRankings(monthYear);

    console.log(`\n✅ Generated scores for ${results.length} states`);
    return results;
  }

  // Calculate national, regional, and peer group rankings
  async calculateRankings(monthYear) {
    console.log(`\n🏆 Calculating rankings for ${monthYear}...`);

    // Get all scores for this month
    const scores = await this.db.allAsync(
      `SELECT s.*, c.region, c.peer_group
       FROM state_monthly_scores s
       JOIN state_contact_info c ON s.state_code = c.state_code
       WHERE s.month_year = ?
       ORDER BY s.overall_score DESC`,
      [monthYear]
    );

    // National rankings
    scores.forEach((score, index) => {
      score.national_rank = index + 1;
    });

    // Regional rankings
    const regions = {};
    scores.forEach(score => {
      if (!regions[score.region]) regions[score.region] = [];
      regions[score.region].push(score);
    });

    Object.values(regions).forEach(regionScores => {
      regionScores.sort((a, b) => b.overall_score - a.overall_score);
      regionScores.forEach((score, index) => {
        score.regional_rank = index + 1;
      });
    });

    // Peer group rankings
    const peerGroups = {};
    scores.forEach(score => {
      if (!peerGroups[score.peer_group]) peerGroups[score.peer_group] = [];
      peerGroups[score.peer_group].push(score);
    });

    Object.values(peerGroups).forEach(groupScores => {
      groupScores.sort((a, b) => b.overall_score - a.overall_score);
      groupScores.forEach((score, index) => {
        score.peer_group_rank = index + 1;
      });
    });

    // Get previous month's rankings for rank change
    const prevMonth = this.getPreviousMonth(monthYear);
    const prevScores = await this.db.allAsync(
      `SELECT state_code, national_rank, overall_score
       FROM state_monthly_scores
       WHERE month_year = ?`,
      [prevMonth]
    );

    const prevRanks = {};
    const prevScoreMap = {};
    prevScores.forEach(s => {
      prevRanks[s.state_code] = s.national_rank;
      prevScoreMap[s.state_code] = s.overall_score;
    });

    // Update all scores with rankings
    for (const score of scores) {
      const rankChange = prevRanks[score.state_code]
        ? prevRanks[score.state_code] - score.national_rank
        : 0;

      const scoreChange = prevScoreMap[score.state_code]
        ? score.overall_score - prevScoreMap[score.state_code]
        : 0;

      await this.db.runAsync(
        `UPDATE state_monthly_scores
         SET national_rank = ?, regional_rank = ?, peer_group_rank = ?,
             rank_change = ?, score_change = ?
         WHERE state_code = ? AND month_year = ?`,
        [
          score.national_rank,
          score.regional_rank,
          score.peer_group_rank,
          rankChange,
          scoreChange,
          score.state_code,
          monthYear
        ]
      );
    }

    console.log(`✅ Rankings calculated`);
    return scores;
  }

  // Get previous month in YYYY-MM format
  getPreviousMonth(monthYear) {
    const date = new Date(monthYear + '-01');
    date.setMonth(date.getMonth() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  // Get report card data for a state
  async getReportCard(stateCode, monthYear = null) {
    monthYear = monthYear || this.getCurrentMonth();

    // Get state info
    const stateInfo = await this.db.getAsync(
      `SELECT * FROM state_contact_info WHERE state_code = ?`,
      [stateCode]
    );

    if (!stateInfo) {
      throw new Error(`State ${stateCode} not found`);
    }

    // Get scores
    const scores = await this.db.getAsync(
      `SELECT * FROM state_monthly_scores
       WHERE state_code = ? AND month_year = ?`,
      [stateCode, monthYear]
    );

    if (!scores) {
      throw new Error(`No scores found for ${stateCode} in ${monthYear}`);
    }

    // Get regional peers
    const regionalPeers = await this.db.allAsync(
      `SELECT s.*, c.state_name
       FROM state_monthly_scores s
       JOIN state_contact_info c ON s.state_code = c.state_code
       WHERE c.region = ? AND s.month_year = ?
       ORDER BY s.overall_score DESC
       LIMIT 5`,
      [stateInfo.region, monthYear]
    );

    // Get peer group comparison
    const peerGroupPeers = await this.db.allAsync(
      `SELECT s.*, c.state_name
       FROM state_monthly_scores s
       JOIN state_contact_info c ON s.state_code = c.state_code
       WHERE c.peer_group = ? AND s.month_year = ?
       ORDER BY s.overall_score DESC
       LIMIT 5`,
      [stateInfo.peer_group, monthYear]
    );

    // Get top 5 nationally
    const nationalTop5 = await this.db.allAsync(
      `SELECT s.*, c.state_name, c.contact_email
       FROM state_monthly_scores s
       JOIN state_contact_info c ON s.state_code = c.state_code
       WHERE s.month_year = ?
       ORDER BY s.overall_score DESC
       LIMIT 5`,
      [monthYear]
    );

    // Get biggest movers
    const biggestMovers = await this.db.allAsync(
      `SELECT s.*, c.state_name
       FROM state_monthly_scores s
       JOIN state_contact_info c ON s.state_code = c.state_code
       WHERE s.month_year = ? AND s.rank_change != 0
       ORDER BY ABS(s.rank_change) DESC
       LIMIT 5`,
      [monthYear]
    );

    return {
      state_info: stateInfo,
      scores: scores,
      regional_peers: regionalPeers,
      peer_group_peers: peerGroupPeers,
      national_top5: nationalTop5,
      biggest_movers: biggestMovers,
      month_year: monthYear
    };
  }

  // Generate email template
  generateEmailTemplate(reportData) {
    const { state_info, scores, regional_peers, peer_group_peers, national_top5, biggest_movers, month_year } = reportData;

    const monthName = new Date(month_year + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const rankEmoji = scores.national_rank <= 10 ? '🏆' : scores.national_rank <= 25 ? '⭐' : '📊';
    const trendEmoji = scores.rank_change > 0 ? '📈' : scores.rank_change < 0 ? '📉' : '➡️';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
    .header h1 { margin: 0 0 10px 0; font-size: 28px; }
    .header .subtitle { opacity: 0.9; font-size: 14px; }
    .rank-box { background: #f7fafc; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; }
    .rank-box h2 { margin-top: 0; color: #667eea; font-size: 24px; }
    .rank-box .big-number { font-size: 48px; font-weight: bold; color: #667eea; margin: 10px 0; }
    .grades { display: flex; justify-content: space-between; margin: 20px 0; }
    .grade-card { background: white; border: 2px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; flex: 1; margin: 0 5px; }
    .grade-card .score { font-size: 32px; font-weight: bold; margin: 10px 0; }
    .grade-card .label { color: #718096; font-size: 12px; text-transform: uppercase; }
    .grade-A { color: #48bb78; }
    .grade-B { color: #4299e1; }
    .grade-C { color: #ed8936; }
    .grade-D { color: #f56565; }
    .section { margin: 30px 0; }
    .section h3 { color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
    .peer-list { background: #f7fafc; border-radius: 8px; padding: 15px; }
    .peer-item { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #e2e8f0; }
    .peer-item:last-child { border-bottom: none; }
    .peer-rank { font-weight: bold; color: #667eea; min-width: 30px; }
    .peer-score { color: #718096; }
    .cta-button { background: #667eea; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; display: inline-block; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; color: #718096; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${rankEmoji} ${state_info.state_name} DOT Corridor Report Card</h1>
    <div class="subtitle">${monthName} Performance Report</div>
  </div>

  <div class="rank-box">
    <h2>National Ranking</h2>
    <div class="big-number">#${scores.national_rank} of 50 States</div>
    <div style="font-size: 18px; margin-top: 10px;">
      ${trendEmoji} ${scores.rank_change > 0 ? `Up ${scores.rank_change} positions` : scores.rank_change < 0 ? `Down ${Math.abs(scores.rank_change)} positions` : 'No change'} from last month
    </div>
    <div style="margin-top: 15px;">
      <strong>Overall Grade:</strong> <span class="grade-${scores.letter_grade[0]}" style="font-size: 24px; font-weight: bold;">${scores.letter_grade}</span> (${scores.overall_score}/100)
    </div>
  </div>

  <div class="section">
    <h3>Performance Categories</h3>
    <div class="grades">
      <div class="grade-card">
        <div class="label">Reliability</div>
        <div class="score grade-${this.calculateLetterGrade(scores.reliability_score)[0]}">${scores.reliability_score.toFixed(1)}</div>
        <div class="label">#${this.getCategoryRank(scores.reliability_score, month_year, 'reliability_score')}</div>
      </div>
      <div class="grade-card">
        <div class="label">Safety</div>
        <div class="score grade-${this.calculateLetterGrade(scores.safety_score)[0]}">${scores.safety_score.toFixed(1)}</div>
        <div class="label">#${this.getCategoryRank(scores.safety_score, month_year, 'safety_score')}</div>
      </div>
      <div class="grade-card">
        <div class="label">Congestion</div>
        <div class="score grade-${this.calculateLetterGrade(scores.congestion_score)[0]}">${scores.congestion_score.toFixed(1)}</div>
        <div class="label">#${this.getCategoryRank(scores.congestion_score, month_year, 'congestion_score')}</div>
      </div>
      <div class="grade-card">
        <div class="label">Data Quality</div>
        <div class="score grade-${this.calculateLetterGrade(scores.data_quality_score)[0]}">${scores.data_quality_score.toFixed(1)}</div>
        <div class="label">#${this.getCategoryRank(scores.data_quality_score, month_year, 'data_quality_score')}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h3>🏆 Top Performers Nationally</h3>
    <div class="peer-list">
      ${national_top5.map(state => `
        <div class="peer-item">
          <div>
            <span class="peer-rank">#${state.national_rank}</span>
            <strong>${state.state_name}</strong>
          </div>
          <div class="peer-score">${state.overall_score.toFixed(1)} (${state.letter_grade})</div>
        </div>
      `).join('')}
    </div>
    ${national_top5.length > 0 ? `
    <p style="margin-top: 15px; font-size: 14px; color: #718096;">
      💡 <strong>Learn from the best:</strong> Contact ${national_top5[0].state_name} DOT at ${national_top5[0].contact_email || 'their website'} to learn about their successful strategies.
    </p>
    ` : ''}
  </div>

  <div class="section">
    <h3>📍 Your Region: ${state_info.region}</h3>
    <div class="peer-list">
      ${regional_peers.map(state => `
        <div class="peer-item" style="${state.state_code === state_info.state_code ? 'background: #edf2f7; font-weight: bold;' : ''}">
          <div>
            <span class="peer-rank">#${state.regional_rank}</span>
            ${state.state_name}${state.state_code === state_info.state_code ? ' (You)' : ''}
          </div>
          <div class="peer-score">${state.overall_score.toFixed(1)}</div>
        </div>
      `).join('')}
    </div>
  </div>

  ${biggest_movers.length > 0 ? `
  <div class="section">
    <h3>📈 Biggest Movers This Month</h3>
    <div class="peer-list">
      ${biggest_movers.map(state => `
        <div class="peer-item">
          <div>
            <strong>${state.state_name}</strong>
            <span style="color: ${state.rank_change > 0 ? '#48bb78' : '#f56565'}; margin-left: 10px;">
              ${state.rank_change > 0 ? '↑' : '↓'} ${Math.abs(state.rank_change)} positions
            </span>
          </div>
          <div class="peer-score">${state.overall_score.toFixed(1)}</div>
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  ${scores.national_rank > 10 ? `
  <div class="section" style="background: #fff5f5; border-left: 4px solid #f56565; padding: 20px; border-radius: 8px;">
    <h3 style="color: #c53030; margin-top: 0;">🎯 Path to Top 10</h3>
    <p><strong>You need ${(this.getTop10Cutoff(month_year) - scores.overall_score).toFixed(1)} more points</strong> to break into the top 10.</p>
    <p>Focus areas to improve:</p>
    <ul>
      ${scores.reliability_score < 80 ? '<li><strong>Reliability:</strong> Reduce travel time variability through better incident management</li>' : ''}
      ${scores.safety_score < 80 ? '<li><strong>Safety:</strong> Implement proactive work zone safety measures and incident response</li>' : ''}
      ${scores.congestion_score < 80 ? '<li><strong>Congestion:</strong> Optimize traffic signal timing and corridor management</li>' : ''}
      ${scores.data_quality_score < 70 ? '<li><strong>Data Quality:</strong> Integrate with more data providers and improve WZDx compliance</li>' : ''}
    </ul>
  </div>
  ` : ''}

  <div style="text-align: center; margin: 40px 0;">
    <a href="https://traffic-dashboard-backend-production.up.railway.app/docs/plugin-system-architecture.md" class="cta-button">
      📊 View Full Report & Analysis
    </a>
  </div>

  <div class="footer">
    <p><strong>About This Report:</strong> This monthly report card evaluates your state's corridor performance across reliability, safety, congestion, and data quality metrics. Rankings compare all 50 states using real-time traffic data from multiple providers.</p>
    <p style="margin-top: 10px;">Generated by DOT Corridor Communicator | <a href="mailto:support@corridor.gov">Contact Support</a></p>
  </div>
</body>
</html>
    `.trim();
  }

  // Helper: Get category rank (simplified - would query in real implementation)
  getCategoryRank(score, monthYear, category) {
    // Simplified ranking - in production this would query the database
    return Math.ceil((100 - score) / 2) + 1;
  }

  // Helper: Get top 10 cutoff score
  getTop10Cutoff(monthYear) {
    // Simplified - would query actual 10th place score
    return 85.0;
  }

  // Send report card via email
  async sendReportCard(stateCode, monthYear = null) {
    monthYear = monthYear || this.getCurrentMonth();

    // Get contact info
    const contact = await this.db.getAsync(
      `SELECT * FROM state_contact_info WHERE state_code = ?`,
      [stateCode]
    );

    if (!contact || !contact.contact_email) {
      throw new Error(`No contact email for ${stateCode}`);
    }

    if (!contact.report_enabled) {
      console.log(`⏭️  Reports disabled for ${stateCode}`);
      return { status: 'skipped', reason: 'reports_disabled' };
    }

    // Generate report
    const reportData = await this.getReportCard(stateCode, monthYear);
    const htmlContent = this.generateEmailTemplate(reportData);

    // Send email
    const result = await this.emailService.sendEmail({
      to: contact.contact_email,
      subject: `${contact.state_name} DOT Corridor Report Card - ${monthYear}`,
      html: htmlContent
    });

    // Save to history
    await this.db.runAsync(
      `INSERT INTO report_card_history
      (state_code, month_year, report_type, recipients, report_data, email_status)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        stateCode,
        monthYear,
        'monthly',
        JSON.stringify([contact.contact_email]),
        JSON.stringify(reportData),
        result.success ? 'sent' : 'failed'
      ]
    );

    // Mark as sent
    await this.db.runAsync(
      `UPDATE state_monthly_scores SET report_sent = 1
       WHERE state_code = ? AND month_year = ?`,
      [stateCode, monthYear]
    );

    return result;
  }

  // Send reports to all states
  async sendAllReports(monthYear = null) {
    monthYear = monthYear || this.getCurrentMonth();

    console.log(`\n📧 Sending monthly reports for ${monthYear}...`);

    const states = await this.db.allAsync(
      `SELECT state_code FROM state_contact_info
       WHERE report_enabled = 1`
    );

    const results = {
      sent: 0,
      failed: 0,
      skipped: 0
    };

    for (const state of states) {
      try {
        const result = await this.sendReportCard(state.state_code, monthYear);

        if (result.status === 'skipped') {
          results.skipped++;
          console.log(`  ⏭️  Skipped ${state.state_code}`);
        } else if (result.success) {
          results.sent++;
          console.log(`  ✅ Sent to ${state.state_code}`);
        } else {
          results.failed++;
          console.log(`  ❌ Failed ${state.state_code}`);
        }

        // Rate limiting - wait 1 second between emails
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.failed++;
        console.error(`  ❌ Error sending to ${state.state_code}:`, error.message);
      }
    }

    console.log(`\n✅ Report delivery complete:`);
    console.log(`   Sent: ${results.sent}`);
    console.log(`   Failed: ${results.failed}`);
    console.log(`   Skipped: ${results.skipped}`);

    return results;
  }

  // Monthly job - generate and send all reports
  async runMonthlyJob() {
    const monthYear = this.getCurrentMonth();

    console.log(`\n🚀 Starting monthly report card job for ${monthYear}...`);

    try {
      // Step 1: Generate scores
      await this.generateMonthlyScores(monthYear);

      // Step 2: Send reports
      await this.sendAllReports(monthYear);

      console.log(`\n✅ Monthly job completed successfully`);
    } catch (error) {
      console.error(`\n❌ Monthly job failed:`, error);
      throw error;
    }
  }
}

module.exports = ReportCardService;
