import { useEffect, useRef, useState } from 'react';

/**
 * Intro splash — logo opens large + centered on a dark chrome backdrop,
 * a PurposeBuilt hazard-stripe sweeps across, then the logo springs down
 * to its final small position in the header.
 *
 * Mechanic (FLIP):
 *   1. Splash element is `position: fixed` covering the viewport, logo at
 *      large size centered.
 *   2. After the hold + sweep, we measure the destination header logo via
 *      `getBoundingClientRect()` and apply a transform that places the
 *      splash logo over the destination at the same size.
 *   3. CSS transition animates the transform smoothly. When it settles we
 *      unmount the splash; the persistent header logo (always rendered)
 *      becomes the live wordmark.
 *
 * Plays once per session (sessionStorage flag) so refreshes don't re-run
 * the intro. Respects `prefers-reduced-motion` — skips animation entirely
 * and just marks the flag so the user lands on the chrome instantly.
 */

const SESSION_KEY = 'pbs-intro-played';

// Phase timing (ms). Tuned so the moment the sweep crosses the logo,
// the shrink starts — feels like the sweep "carries" the logo to the chrome.
// Total ~2.5s. Data loading happens in parallel via useTrafficData on App
// mount, so by the time the splash dismisses the map is usually populated.
const HOLD_MS = 800;        // logo at full size, splash bg solid
const SWEEP_MS = 800;       // hazard stripe wipe duration
const SHRINK_MS = 700;      // logo spring to final position
const FADE_MS = 200;        // overlay fade-out tail

export default function IntroSplash({ targetSelector = '.title-logo' }) {
  const [phase, setPhase] = useState('idle');  // idle | show | sweep | shrink | done
  const [destStyle, setDestStyle] = useState(null);
  const splashLogoRef = useRef(null);

  useEffect(() => {
    // Already played this session, or user prefers reduced motion → skip.
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sessionStorage.setItem(SESSION_KEY, '1');
      return;
    }
    sessionStorage.setItem(SESSION_KEY, '1');

    // All phase transitions scheduled in a single mount-only effect so a
    // mid-flight phase change doesn't cancel the next timer via deps cleanup.
    setPhase('show');

    const t1 = setTimeout(() => setPhase('sweep'), HOLD_MS);
    const t2 = setTimeout(() => {
      // Measure destination header logo right before flying to it. Late
      // measurement means the destination layout has settled (fonts loaded,
      // logo PNG decoded into intrinsic dimensions).
      const dest = document.querySelector(targetSelector);
      const splashLogo = splashLogoRef.current;
      if (dest && splashLogo) {
        const dRect = dest.getBoundingClientRect();
        const sRect = splashLogo.getBoundingClientRect();
        // Guard against unloaded destination (height === 0) — without this,
        // scale would be 0 and the logo would vanish before fade-out.
        if (dRect.height > 0 && sRect.height > 0) {
          const scale = dRect.height / sRect.height;
          const tx = dRect.left + dRect.width / 2 - (sRect.left + sRect.width / 2);
          const ty = dRect.top + dRect.height / 2 - (sRect.top + sRect.height / 2);
          setDestStyle({
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transition: `transform ${SHRINK_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
            filter: 'drop-shadow(0 0 12px rgba(240, 130, 48, 0.25))'
          });
        }
      }
      setPhase('shrink');
    }, HOLD_MS + 200);
    const t3 = setTimeout(() => setPhase('done'), HOLD_MS + 200 + SHRINK_MS + FADE_MS);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [targetSelector]);

  if (phase === 'idle' || phase === 'done') return null;

  return (
    <div
      className={`intro-splash intro-splash--${phase}`}
      aria-hidden="true"
    >
      {/* Hazard-stripe sweep — translates from off-screen left to off-screen
          right during the 'sweep' phase. Sized larger than the viewport so
          the diagonal pattern always covers fully. */}
      <div className="intro-splash__sweep" />

      {/* The logo. During 'shrink' phase, destStyle is applied to fly it to
          the header destination measured via getBoundingClientRect. */}
      <img
        ref={splashLogoRef}
        className="intro-splash__logo"
        src="/assets/sandbox-logo.png"
        alt=""
        style={destStyle || undefined}
      />
    </div>
  );
}
