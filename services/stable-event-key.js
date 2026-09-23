/**
 * Stable subject key for a road event whose published id is not stable.
 *
 * WHY THIS EXISTS. WZDx requires a road event `id` to be unique within a feed. It says
 * nothing testable about that id being opaque or immutable, so a publisher is free to
 * build one out of state that moves. Iowa's does: the id carries the event's CURRENT
 * SEGMENTATION, so re-segmenting a zone replaces every id naming it.
 *
 * Measured on the Iowa DOT feed (the FHWA-registered one), 13 snapshots over 18 hours:
 * six events were re-identified and 39 ids were destroyed belonging to zones that never
 * left the feed. Three went one bare id -> 12-14 segmented ids; three went the other way.
 *
 *     OpenTMS-Event22288917199        ->  OpenTMS-Event22288917199-1 ... -14
 *     OpenTMS-Event22566528534-1,-2   ->  OpenTMS-Event22566528534
 *
 * In every case the EVENT NUMBER survived and only the segment suffix moved. That is the
 * whole basis of this module: the core is observed-stable, so key continuity on the core.
 *
 * WHAT IT IS NOT. This is a workaround for one producer's id grammar, not a fix. The fix
 * is upstream -- an id that is opaque and immutable for the life of the event -- and this
 * file should shrink to identity() the day that lands. It is deliberately producer-scoped
 * so that adding a grammar can never change how a feed we have not characterised behaves.
 *
 * DIRECTION IS NOT STRIPPED. `-NB` and `-SB` on one event number are two genuinely
 * separate road events on opposite carriageways. Collapsing them would merge two subjects,
 * which is the very error this module exists to prevent, pointed the other way.
 */

// Each grammar: a producer's id shape, and how to read the stable subject out of it.
// `test` must be tight enough that no other producer's ids can match it.
const GRAMMARS = [
  {
    name: 'opentms',                       // Iowa DOT / Q-Free ATMS, and CARS siblings
    test: /^OpenTMS-Event\d+(-\d+)?(-(NB|SB|EB|WB))?$/,
    parse(id) {
      const m = /^(OpenTMS-Event\d+)(?:-(\d+))?(?:-(NB|SB|EB|WB))?$/.exec(id);
      return { core: m[1], segment: m[2] ? Number(m[2]) : null, direction: m[3] || null };
    }
  }
];

function grammarFor(id) {
  if (typeof id !== 'string' || !id) return null;
  return GRAMMARS.find(g => g.test.test(id)) || null;
}

/**
 * The stable identity of the SUBJECT this id names: the event, on its carriageway,
 * independent of how the publisher happens to be slicing it right now.
 *
 * Returns the id unchanged for any producer we have not characterised. That default is
 * load-bearing: an uncharacterised feed must behave exactly as it does today.
 */
function subjectKey(id) {
  const g = grammarFor(id);
  if (!g) return id;
  const { core, direction } = g.parse(id);
  return direction ? `${core}|${direction}` : core;
}

/** The segment index this id carries, or null. Null means "not segmented", not "segment 0". */
function segmentOf(id) {
  const g = grammarFor(id);
  return g ? g.parse(id).segment : null;
}

/** True when two ids name the same subject but are not the same id -- i.e. a re-identification. */
function isResegmentationOf(oldId, newId) {
  return oldId !== newId && subjectKey(oldId) === subjectKey(newId);
}

/** Whether this id's grammar is one we have characterised (so callers can log the rest). */
function isCharacterised(id) { return !!grammarFor(id); }

module.exports = { subjectKey, segmentOf, isResegmentationOf, isCharacterised, GRAMMARS };
