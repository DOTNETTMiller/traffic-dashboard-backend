import { useMemo, useState } from 'react';

/**
 * DMS Sign Playground — type a message, see it rendered like a real overhead
 * Dynamic Message Sign with amber LED-dot lettering on a black panel.
 *
 * Visual mechanic:
 *   - VT323 chunky retro monospace + a bold weight gives the pixel-cell shape
 *   - CSS mask-image layers a 4px radial-gradient dot grid over the text so
 *     each lit pixel reads as an individual LED dot, not a smooth glyph
 *   - Amber #FFB000 with a layered text-shadow bloom mimics the real
 *     overdriven LED + Fresnel-lens glow you see at night
 *
 * The playground is a small workbench: textarea on the left, live preview
 * on the right. Typical commercial DMS sign limits (3 lines, ~18 chars per
 * line) are surfaced as soft hints — over the limit shows a warning chip,
 * doesn't truncate, since the user might be modeling a different sign size.
 */

const RECOMMENDED_LINES = 3;
const RECOMMENDED_CHARS_PER_LINE = 18;

export default function DMSSignPlayground() {
  const [message, setMessage] = useState(
    'CRASH AHEAD\nUSE CAUTION\nEXPECT 15 MIN DELAY'
  );

  // Stats for the soft hint chips below the textarea.
  const stats = useMemo(() => {
    const lines = message.split('\n');
    const longestLine = lines.reduce((m, l) => Math.max(m, l.length), 0);
    return {
      lines: lines.length,
      longestLine,
      overLines: lines.length > RECOMMENDED_LINES,
      overChars: longestLine > RECOMMENDED_CHARS_PER_LINE
    };
  }, [message]);

  return (
    <div style={{
      flex: 1,
      overflow: 'auto',
      padding: '24px',
      fontFamily: 'var(--font-sans)',
      maxWidth: 1200,
      margin: '0 auto',
      width: '100%'
    }}>
      {/* Section header — matches the rest of the chrome's display treatment */}
      <h2 style={{
        margin: '0 0 4px',
        fontFamily: 'var(--font-display)',
        fontSize: '28px',
        fontWeight: 700,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        color: 'var(--accent)'
      }}>
        DMS Sign Preview
      </h2>
      <p style={{ margin: '0 0 24px', color: 'var(--fg-muted)', fontSize: '13px' }}>
        Type a message to see how it would render on a roadway overhead sign.
        Amber LED on black — the actual visual you get on US-spec dynamic
        message signs.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* === Editor === */}
        <div>
          <SectionLabel>Message</SectionLabel>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.toUpperCase())}
            placeholder="TYPE YOUR DMS MESSAGE&#10;ONE LINE PER ROW"
            spellCheck={false}
            rows={6}
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1px solid var(--border-strong)',
              borderRadius: '8px',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontSize: '14px',
              lineHeight: 1.5,
              letterSpacing: '0.02em',
              outline: 'none',
              resize: 'vertical',
              color: 'var(--fg)',
              background: '#ffffff'
            }}
          />

          {/* Soft-limit hint chips */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginTop: '8px'
          }}>
            <Chip
              tone={stats.overLines ? 'warn' : 'ok'}
              label={`${stats.lines} ${stats.lines === 1 ? 'line' : 'lines'}`}
              hint={`recommended ≤${RECOMMENDED_LINES}`}
            />
            <Chip
              tone={stats.overChars ? 'warn' : 'ok'}
              label={`${stats.longestLine} chars`}
              hint={`recommended ≤${RECOMMENDED_CHARS_PER_LINE} per line`}
            />
            <Chip
              tone="info"
              label="UPPERCASE auto"
              hint="Real DMS firmware does the same"
            />
          </div>

          <div style={{ marginTop: '20px' }}>
            <SectionLabel>Quick Templates</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <TemplateChip onClick={() => setMessage('CRASH AHEAD\nUSE CAUTION\nEXPECT 15 MIN DELAY')}>
                Crash · 15 min delay
              </TemplateChip>
              <TemplateChip onClick={() => setMessage('ROAD WORK AHEAD\nLEFT LANE CLOSED\nMERGE RIGHT')}>
                Lane closure
              </TemplateChip>
              <TemplateChip onClick={() => setMessage('WINTER WEATHER\nREDUCE SPEED\nUSE CAUTION')}>
                Winter weather
              </TemplateChip>
              <TemplateChip onClick={() => setMessage('AMBER ALERT\nLIC ABC123\nIA - CALL 511')}>
                Amber alert
              </TemplateChip>
              <TemplateChip onClick={() => setMessage('I-80 CLOSED\nAT EXIT 142\nUSE I-380 NORTH')}>
                Closure + detour
              </TemplateChip>
              <TemplateChip onClick={() => setMessage('CLICK IT\nOR\nTICKET')}>
                Public safety
              </TemplateChip>
            </div>
          </div>
        </div>

        {/* === Preview === */}
        <div>
          <SectionLabel>Preview</SectionLabel>
          <DMSSign message={message} />
          <p style={{
            marginTop: '10px',
            fontSize: '11px',
            color: 'var(--fg-muted)',
            lineHeight: 1.5
          }}>
            Rendered with amber LED-dot mask over a VT323 monospace face on a
            black panel. Your local roadway sign will use the same color
            temperature and similar dot pitch.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Sign component — pure presentational, takes a message string.
   ============================================================ */

export function DMSSign({ message }) {
  const lines = message.split('\n');

  return (
    <div style={{
      // Outer "gantry" — the hooded sign frame an operator sees on a real
      // overhead truss. Subtle bevel + drop shadow so it sits on the page.
      padding: '14px',
      background: 'linear-gradient(#2b2b2f, #1a1a1d)',
      borderRadius: '10px',
      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 8px 24px rgba(0, 0, 0, 0.18)',
      border: '1px solid #0a0a0a'
    }}>
      <div style={{
        // Inner panel — the actual LED face. Slight inner shadow + gradient
        // simulates the recessed sign cavity and stray ambient bounce.
        background: 'radial-gradient(ellipse at center, #0c0c0c 0%, #050505 80%, #000000 100%)',
        borderRadius: '4px',
        padding: '20px 24px',
        minHeight: '220px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: 'inset 0 0 18px rgba(0, 0, 0, 0.85), inset 0 0 0 1px rgba(255, 255, 255, 0.03)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle ambient amber tint at the panel edges, sells the "this
            sign is on" feel without overpowering the dotted text. */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(255, 176, 0, 0.02) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              fontFamily: "'VT323', ui-monospace, monospace",
              fontSize: '52px',
              lineHeight: 1.1,
              letterSpacing: '0.06em',
              color: '#FFB000',
              textShadow: [
                '0 0 4px rgba(255, 176, 0, 0.85)',   // tight halo
                '0 0 10px rgba(255, 176, 0, 0.45)',  // mid bloom
                '0 0 22px rgba(255, 140, 0, 0.25)'   // outer glow
              ].join(', '),
              // The LED-dot mask — radial-gradient repeated as a 3px grid so
              // the lit text shows through only where the dots are. Each dot
              // is ~1.5px lit center with 1.5px dark gap, mimicking a 5mm-pitch
              // amber LED panel viewed from a few feet away.
              WebkitMaskImage: 'radial-gradient(circle at center, #000 40%, transparent 60%)',
              maskImage: 'radial-gradient(circle at center, #000 40%, transparent 60%)',
              WebkitMaskSize: '3px 3px',
              maskSize: '3px 3px',
              WebkitMaskRepeat: 'repeat',
              maskRepeat: 'repeat',
              whiteSpace: 'pre',
              textAlign: 'center',
              fontWeight: 'normal',
              userSelect: 'none'
            }}
          >
            {line || ' '}
          </div>
        ))}

        {/* Faint horizontal scanline overlay, sells the camera-glance look */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.08) 0px, rgba(0, 0, 0, 0.08) 1px, transparent 1px, transparent 3px)',
          pointerEvents: 'none',
          mixBlendMode: 'multiply'
        }} />
      </div>
    </div>
  );
}

/* ============================================================
   Local UI bits — keeps DMS playground self-contained without
   pulling in a UI primitive that doesn't exist yet.
   ============================================================ */

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--fg-muted)',
      marginBottom: '6px'
    }}>
      {children}
    </div>
  );
}

function Chip({ tone, label, hint }) {
  const palette = {
    ok:   { bg: 'rgba(22, 163, 74, 0.10)',  border: 'rgba(22, 163, 74, 0.28)',  fg: '#15803d' },
    warn: { bg: 'rgba(201, 122, 22, 0.10)', border: 'rgba(201, 122, 22, 0.32)', fg: '#a55e10' },
    info: { bg: 'rgba(0, 0, 0, 0.04)',      border: 'rgba(0, 0, 0, 0.10)',      fg: 'var(--fg-muted)' }
  }[tone];

  return (
    <span
      title={hint}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 9px',
        borderRadius: 999,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
        fontSize: 11,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums'
      }}
    >
      {label}
    </span>
  );
}

function TemplateChip({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 999,
        background: '#ffffff',
        border: '1px solid var(--border-strong)',
        fontSize: 11,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        color: 'var(--fg)'
      }}
    >
      {children}
    </button>
  );
}
