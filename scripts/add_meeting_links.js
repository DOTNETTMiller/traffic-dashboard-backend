#!/usr/bin/env node

/**
 * Add Virtual Meeting Links to I-80 Coalition Events
 *
 * This script updates existing calendar events with virtual meeting links.
 * Replace the placeholder URLs with actual Teams/Zoom/Google Meet links.
 */

const db = require('../database');

const meetingLinks = {
  'Technical Working Group': 'https://teams.microsoft.com/l/meetup-join/i80-tech-working-group',
  'Workshop': 'https://zoom.us/j/i80-conops-workshop',
  'Coalition Update': 'https://meet.google.com/i80-coalition-update',
  'Working Group': 'https://teams.microsoft.com/l/meetup-join/i80-stakeholder-wg',
  'Summit': null // In-person events - no virtual link
};

const organizerEmails = {
  'Technical Working Group': 'techgroup@i80coalition.org',
  'Workshop': 'workshops@i80coalition.org',
  'Coalition Update': 'updates@i80coalition.org',
  'Working Group': 'stakeholders@i80coalition.org',
  'Summit': 'summits@i80coalition.org'
};

async function addMeetingLinks() {
  try {
    await db.init();
    console.log('📅 Adding virtual meeting links to I-80 Coalition events...\n');

    // Get all I-80 Coalition events
    const events = db.db.prepare(`
      SELECT id, title, event_type, location, virtual_link
      FROM calendar_events
      WHERE corridor = 'I-80'
      ORDER BY start_time
    `).all();

    console.log(`Found ${events.length} I-80 Coalition events\n`);

    const updateStmt = db.db.prepare(`
      UPDATE calendar_events
      SET virtual_link = ?, organizer_email = ?
      WHERE id = ?
    `);

    let updated = 0;
    let skipped = 0;

    for (const event of events) {
      const meetingLink = meetingLinks[event.event_type];
      const organizerEmail = organizerEmails[event.event_type];

      if (meetingLink) {
        updateStmt.run(meetingLink, organizerEmail, event.id);
        console.log(`✅ ${event.title}`);
        console.log(`   Link: ${meetingLink}`);
        console.log(`   Email: ${organizerEmail}\n`);
        updated++;
      } else {
        console.log(`⏭️  ${event.title}`);
        console.log(`   (In-person event - no virtual link)\n`);
        skipped++;
      }
    }

    console.log('─'.repeat(80));
    console.log(`✅ Updated ${updated} events with virtual meeting links`);
    console.log(`⏭️  Skipped ${skipped} in-person events`);
    console.log('\n📝 Next Steps:');
    console.log('   1. Replace placeholder URLs with actual Teams/Zoom/Google Meet links');
    console.log('   2. Update organizer email addresses');
    console.log('   3. Run this script again to apply changes\n');
    console.log('💡 To update links, edit the meetingLinks object in this script\n');

  } catch (error) {
    console.error('❌ Error adding meeting links:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  addMeetingLinks()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { addMeetingLinks };
