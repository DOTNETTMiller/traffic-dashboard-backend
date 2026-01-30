/**
 * Populate I-80 Corridor Coalition Calendar Events
 * Initial schedule for stakeholder engagement meetings
 */

const db = require('../database');

const events = [
  // Technical Working Group Meetings (4th Thursday, 12:30-2pm PT / 3:30-5pm ET)
  {
    title: 'Technical Working Group Meeting #1',
    description: 'Initial Technical Working Group meeting to establish coordination framework and technical standards.',
    event_type: 'Technical Working Group',
    start_time: '2026-02-12 15:30:00', // 12:30 PT = 15:30 ET = 14:30 CT
    end_time: '2026-02-12 17:00:00',
    timezone: 'America/Chicago',
    location: 'Virtual Meeting',
    virtual_link: null,
    organizer_name: 'I-80 Corridor Coalition',
    organizer_email: null,
    workstream: 'Technical Standards',
    corridor: 'I-80',
    is_tentative: false,
    is_optional: false,
    recurrence_rule: 'Future meetings: 4th Thursday monthly, 12:30-2pm PT'
  },

  // ConOps Workshop
  {
    title: 'ConOps Workshop (Virtual)',
    description: 'Concept of Operations workshop to define operational requirements and use cases for I-80 corridor systems.',
    event_type: 'Workshop',
    start_time: '2026-03-05 11:00:00', // 9am PT = 12pm ET = 11am CT
    end_time: '2026-03-05 15:00:00',   // 1pm PT = 4pm ET = 3pm CT
    timezone: 'America/Chicago',
    location: 'Virtual Meeting',
    virtual_link: null,
    organizer_name: 'I-80 Corridor Coalition',
    organizer_email: null,
    workstream: 'ConOps',
    corridor: 'I-80',
    is_tentative: false,
    is_optional: false,
    recurrence_rule: null
  },

  // Coalition Update Calls (2nd Thursday, 12:30-2pm PT / 3:30-5pm ET)
  {
    title: 'I-80 Corridor Coalition Update Call',
    description: 'Quarterly coalition update call to review progress, discuss challenges, and coordinate activities.',
    event_type: 'Coalition Update',
    start_time: '2026-03-19 14:30:00',
    end_time: '2026-03-19 16:00:00',
    timezone: 'America/Chicago',
    location: 'Virtual Meeting',
    virtual_link: null,
    organizer_name: 'I-80 Corridor Coalition',
    organizer_email: null,
    workstream: 'General',
    corridor: 'I-80',
    is_tentative: false,
    is_optional: false,
    recurrence_rule: 'Future meetings: 2nd Thursday, 12:30-2pm PT'
  },

  // Stakeholder Working Group Meetings
  {
    title: 'Stakeholder Working Group Meeting',
    description: 'Regular stakeholder working group meeting for technical coordination and implementation planning.',
    event_type: 'Working Group',
    start_time: '2026-04-02 14:30:00',
    end_time: '2026-04-02 16:00:00',
    timezone: 'America/Chicago',
    location: 'Virtual Meeting',
    virtual_link: null,
    organizer_name: 'I-80 Corridor Coalition',
    organizer_email: null,
    workstream: 'General',
    corridor: 'I-80',
    is_tentative: false,
    is_optional: false,
    recurrence_rule: null
  },
  {
    title: 'Stakeholder Working Group Meeting',
    description: 'Regular stakeholder working group meeting for technical coordination and implementation planning.',
    event_type: 'Working Group',
    start_time: '2026-04-30 14:30:00',
    end_time: '2026-04-30 16:00:00',
    timezone: 'America/Chicago',
    location: 'Virtual Meeting',
    virtual_link: null,
    organizer_name: 'I-80 Corridor Coalition',
    organizer_email: null,
    workstream: 'General',
    corridor: 'I-80',
    is_tentative: false,
    is_optional: false,
    recurrence_rule: null
  },
  {
    title: 'Stakeholder Working Group Meeting',
    description: 'Regular stakeholder working group meeting for technical coordination and implementation planning.',
    event_type: 'Working Group',
    start_time: '2026-05-28 14:30:00',
    end_time: '2026-05-28 16:00:00',
    timezone: 'America/Chicago',
    location: 'Virtual Meeting',
    virtual_link: null,
    organizer_name: 'I-80 Corridor Coalition',
    organizer_email: null,
    workstream: 'General',
    corridor: 'I-80',
    is_tentative: false,
    is_optional: false,
    recurrence_rule: null
  },
  {
    title: 'Stakeholder Working Group Meeting',
    description: 'Regular stakeholder working group meeting for technical coordination and implementation planning.',
    event_type: 'Working Group',
    start_time: '2026-06-25 14:30:00',
    end_time: '2026-06-25 16:00:00',
    timezone: 'America/Chicago',
    location: 'Virtual Meeting',
    virtual_link: null,
    organizer_name: 'I-80 Corridor Coalition',
    organizer_email: null,
    workstream: 'General',
    corridor: 'I-80',
    is_tentative: false,
    is_optional: false,
    recurrence_rule: null
  },
  {
    title: 'Stakeholder Working Group Meeting (Optional)',
    description: 'Optional stakeholder working group meeting.',
    event_type: 'Working Group',
    start_time: '2026-08-27 14:30:00',
    end_time: '2026-08-27 16:00:00',
    timezone: 'America/Chicago',
    location: 'Virtual Meeting',
    virtual_link: null,
    organizer_name: 'I-80 Corridor Coalition',
    organizer_email: null,
    workstream: 'General',
    corridor: 'I-80',
    is_tentative: false,
    is_optional: true,
    recurrence_rule: null
  },
  {
    title: 'Stakeholder Working Group Meeting (Optional)',
    description: 'Optional stakeholder working group meeting.',
    event_type: 'Working Group',
    start_time: '2026-10-29 14:30:00',
    end_time: '2026-10-29 16:00:00',
    timezone: 'America/Chicago',
    location: 'Virtual Meeting',
    virtual_link: null,
    organizer_name: 'I-80 Corridor Coalition',
    organizer_email: null,
    workstream: 'General',
    corridor: 'I-80',
    is_tentative: false,
    is_optional: true,
    recurrence_rule: null
  },

  // Additional Coalition Update Calls
  {
    title: 'I-80 Corridor Coalition Update Call',
    description: 'Quarterly coalition update call to review progress, discuss challenges, and coordinate activities.',
    event_type: 'Coalition Update',
    start_time: '2026-05-14 14:30:00',
    end_time: '2026-05-14 16:00:00',
    timezone: 'America/Chicago',
    location: 'Virtual Meeting',
    virtual_link: null,
    organizer_name: 'I-80 Corridor Coalition',
    organizer_email: null,
    workstream: 'General',
    corridor: 'I-80',
    is_tentative: false,
    is_optional: false,
    recurrence_rule: null
  },
  {
    title: 'I-80 Corridor Coalition Update Call',
    description: 'Quarterly coalition update call to review progress, discuss challenges, and coordinate activities.',
    event_type: 'Coalition Update',
    start_time: '2026-07-09 14:30:00',
    end_time: '2026-07-09 16:00:00',
    timezone: 'America/Chicago',
    location: 'Virtual Meeting',
    virtual_link: null,
    organizer_name: 'I-80 Corridor Coalition',
    organizer_email: null,
    workstream: 'General',
    corridor: 'I-80',
    is_tentative: false,
    is_optional: false,
    recurrence_rule: null
  },
  {
    title: 'I-80 Corridor Coalition Update Call',
    description: 'Quarterly coalition update call to review progress, discuss challenges, and coordinate activities.',
    event_type: 'Coalition Update',
    start_time: '2026-09-10 14:30:00',
    end_time: '2026-09-10 16:00:00',
    timezone: 'America/Chicago',
    location: 'Virtual Meeting',
    virtual_link: null,
    organizer_name: 'I-80 Corridor Coalition',
    organizer_email: null,
    workstream: 'General',
    corridor: 'I-80',
    is_tentative: false,
    is_optional: false,
    recurrence_rule: null
  },
  {
    title: 'I-80 Corridor Coalition Update Call',
    description: 'Quarterly coalition update call to review progress, discuss challenges, and coordinate activities.',
    event_type: 'Coalition Update',
    start_time: '2026-12-10 14:30:00',
    end_time: '2026-12-10 16:00:00',
    timezone: 'America/Chicago',
    location: 'Virtual Meeting',
    virtual_link: null,
    organizer_name: 'I-80 Corridor Coalition',
    organizer_email: null,
    workstream: 'General',
    corridor: 'I-80',
    is_tentative: false,
    is_optional: false,
    recurrence_rule: null
  },

  // Coalition Summits (tentative dates)
  {
    title: 'I-80 Coalition Summit - UDOT',
    description: 'In-person coalition summit hosted by Utah DOT. Dates to be confirmed with NDOT, UDOT and other partners.',
    event_type: 'Summit',
    start_time: '2026-04-22 08:00:00',
    end_time: '2026-04-23 17:00:00',
    timezone: 'America/Denver',
    location: 'Salt Lake City, UT (UDOT)',
    virtual_link: null,
    organizer_name: 'Utah DOT',
    organizer_email: null,
    workstream: 'General',
    corridor: 'I-80',
    is_tentative: true,
    is_optional: false,
    recurrence_rule: null
  },
  {
    title: 'I-80 Coalition Summit - Iowa DOT',
    description: 'In-person coalition summit hosted by Iowa DOT. Dates to be confirmed with NDOT, UDOT and other partners.',
    event_type: 'Summit',
    start_time: '2026-11-12 08:00:00',
    end_time: '2026-11-13 17:00:00',
    timezone: 'America/Chicago',
    location: 'Des Moines, IA (Iowa DOT)',
    virtual_link: null,
    organizer_name: 'Iowa DOT',
    organizer_email: null,
    workstream: 'General',
    corridor: 'I-80',
    is_tentative: true,
    is_optional: false,
    recurrence_rule: null
  }
];

async function populateEvents() {
  try {
    await db.init();
    console.log('📅 Populating I-80 Coalition Calendar Events...\n');

    // Check if events already exist
    const existing = db.db.prepare('SELECT COUNT(*) as count FROM calendar_events WHERE corridor = ?').get('I-80');

    if (existing && existing.count > 0) {
      console.log(`⚠️  Found ${existing.count} existing I-80 events. Skipping population.`);
      console.log('   To re-populate, run: DELETE FROM calendar_events WHERE corridor = \'I-80\';');
      return;
    }

    const stmt = db.db.prepare(`
      INSERT INTO calendar_events (
        title, description, event_type, start_time, end_time, timezone,
        location, virtual_link, organizer_name, organizer_email,
        workstream, corridor, is_tentative, is_optional, recurrence_rule
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    for (const event of events) {
      try {
        stmt.run(
          event.title,
          event.description,
          event.event_type,
          event.start_time,
          event.end_time,
          event.timezone,
          event.location,
          event.virtual_link,
          event.organizer_name,
          event.organizer_email,
          event.workstream,
          event.corridor,
          event.is_tentative ? 1 : 0,
          event.is_optional ? 1 : 0,
          event.recurrence_rule
        );
        inserted++;
        console.log(`✅ Added: ${event.title} - ${event.start_time}`);
      } catch (err) {
        console.error(`❌ Failed to insert: ${event.title}`, err.message);
      }
    }

    console.log(`\n🎉 Successfully inserted ${inserted} I-80 Coalition events!`);

    // Display summary
    const summary = db.db.prepare(`
      SELECT event_type, COUNT(*) as count
      FROM calendar_events
      WHERE corridor = 'I-80'
      GROUP BY event_type
      ORDER BY count DESC
    `).all();

    console.log('\n📊 Event Summary by Type:');
    summary.forEach(row => {
      console.log(`   ${row.event_type}: ${row.count} events`);
    });

  } catch (error) {
    console.error('❌ Error populating calendar events:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  populateEvents()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { populateEvents };
