/**
 * Calendar API for I-80 Corridor Coalition Events
 * Handles event management, RSVPs, artifacts, and ICS generation
 */

const db = require('./database');

/**
 * Generate ICS (iCalendar) file content for an event
 */
function generateICS(event, includeDescription = true) {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const escapeICS = (str) => {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\')
              .replace(/;/g, '\\;')
              .replace(/,/g, '\\,')
              .replace(/\n/g, '\\n');
  };

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DOT Corridor Communicator//I-80 Coalition//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:I-80 Corridor Coalition Events',
    'X-WR-TIMEZONE:America/Chicago',
    'X-WR-CALDESC:Stakeholder engagement meetings and technical working groups for the I-80 Corridor Coalition',
    'BEGIN:VEVENT',
    `UID:i80-event-${event.id}@corridor-communicator.railway.app`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(event.start_time)}`,
    `DTEND:${formatDate(event.end_time)}`,
    `SUMMARY:${escapeICS(event.title)}${event.is_tentative ? ' (TENTATIVE)' : ''}${event.is_optional ? ' (OPTIONAL)' : ''}`,
  ];

  if (includeDescription && event.description) {
    lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICS(event.location)}`);
  }

  if (event.virtual_link) {
    lines.push(`URL:${event.virtual_link}`);
  }

  if (event.organizer_email) {
    lines.push(`ORGANIZER;CN="${escapeICS(event.organizer_name || 'I-80 Coalition')}":MAILTO:${event.organizer_email}`);
  }

  if (event.workstream) {
    lines.push(`CATEGORIES:${escapeICS(event.workstream)}`);
  }

  if (event.is_tentative) {
    lines.push('STATUS:TENTATIVE');
  }

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Generate ICS file for multiple events (subscription feed)
 */
function generateMultiEventICS(events) {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const escapeICS = (str) => {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\')
              .replace(/;/g, '\\;')
              .replace(/,/g, '\\,')
              .replace(/\n/g, '\\n');
  };

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DOT Corridor Communicator//I-80 Coalition//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:I-80 Corridor Coalition Events',
    'X-WR-TIMEZONE:America/Chicago',
    'X-WR-CALDESC:Stakeholder engagement meetings and technical working groups for the I-80 Corridor Coalition',
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:i80-event-${event.id}@corridor-communicator.railway.app`);
    lines.push(`DTSTAMP:${formatDate(new Date())}`);
    lines.push(`DTSTART:${formatDate(event.start_time)}`);
    lines.push(`DTEND:${formatDate(event.end_time)}`);
    lines.push(`SUMMARY:${escapeICS(event.title)}${event.is_tentative ? ' (TENTATIVE)' : ''}${event.is_optional ? ' (OPTIONAL)' : ''}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
    }

    if (event.location) {
      lines.push(`LOCATION:${escapeICS(event.location)}`);
    }

    if (event.virtual_link) {
      lines.push(`URL:${event.virtual_link}`);
    }

    if (event.organizer_email) {
      lines.push(`ORGANIZER;CN="${escapeICS(event.organizer_name || 'I-80 Coalition')}":MAILTO:${event.organizer_email}`);
    }

    if (event.workstream) {
      lines.push(`CATEGORIES:${escapeICS(event.workstream)}`);
    }

    if (event.is_tentative) {
      lines.push('STATUS:TENTATIVE');
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Get all upcoming events
 */
async function getUpcomingEvents(limit = 50) {
  if (db.isPostgres) {
    const result = await db.db.query(
      `SELECT * FROM calendar_events WHERE start_time >= NOW() ORDER BY start_time ASC LIMIT $1`,
      [limit]
    );
    return result.rows;
  } else {
    return db.db.prepare(
      `SELECT * FROM calendar_events WHERE start_time >= datetime('now') ORDER BY start_time ASC LIMIT ?`
    ).all(limit);
  }
}

/**
 * Get event by ID with RSVPs and artifacts
 */
async function getEventDetails(eventId) {
  const eventQuery = 'SELECT * FROM calendar_events WHERE id = ?';
  const event = db.isPostgres
    ? await db.db.prepare(eventQuery).get(eventId)
    : db.db.prepare(eventQuery).get(eventId);

  if (!event) return null;

  // Get RSVPs
  const rsvpQuery = 'SELECT * FROM calendar_rsvps WHERE event_id = ? ORDER BY created_at DESC';
  const rsvps = db.isPostgres
    ? await db.db.prepare(rsvpQuery).all(eventId)
    : db.db.prepare(rsvpQuery).all(eventId);

  // Get artifacts
  const artifactQuery = 'SELECT * FROM calendar_artifacts WHERE event_id = ? ORDER BY uploaded_at DESC';
  const artifacts = db.isPostgres
    ? await db.db.prepare(artifactQuery).all(eventId)
    : db.db.prepare(artifactQuery).all(eventId);

  // Get action items
  const actionQuery = 'SELECT * FROM calendar_action_items WHERE event_id = ? ORDER BY due_date ASC';
  const actionItems = db.isPostgres
    ? await db.db.prepare(actionQuery).all(eventId)
    : db.db.prepare(actionQuery).all(eventId);

  return {
    ...event,
    rsvps,
    artifacts,
    actionItems
  };
}

/**
 * Create or update RSVP
 */
async function upsertRSVP(eventId, userEmail, userName, response) {
  if (db.isPostgres) {
    await db.db.query(
      `INSERT INTO calendar_rsvps (event_id, user_email, user_name, response, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (event_id, user_email) DO UPDATE SET response = $4, updated_at = NOW()`,
      [eventId, userEmail, userName, response]
    );
  } else {
    db.db.prepare(
      `INSERT OR REPLACE INTO calendar_rsvps (event_id, user_email, user_name, response, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).run(eventId, userEmail, userName, response);
  }

  return { success: true };
}

/**
 * Get RSVP counts for an event
 */
async function getRSVPCounts(eventId) {
  const query = `
    SELECT response, COUNT(*) as count
    FROM calendar_rsvps
    WHERE event_id = ?
    GROUP BY response
  `;

  const counts = db.isPostgres
    ? await db.db.prepare(query).all(eventId)
    : db.db.prepare(query).all(eventId);

  return {
    going: counts.find(c => c.response === 'going')?.count || 0,
    maybe: counts.find(c => c.response === 'maybe')?.count || 0,
    not_going: counts.find(c => c.response === 'not_going')?.count || 0
  };
}

module.exports = {
  generateICS,
  generateMultiEventICS,
  getUpcomingEvents,
  getEventDetails,
  upsertRSVP,
  getRSVPCounts
};
