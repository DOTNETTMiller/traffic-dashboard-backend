import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const ACCESS = 'mailto:matthew@purposebuilt.systems?subject=PurposeBuilt%20ATMS%20beta%20access';

// Cloudflare Turnstile, as the PurposeBuilt account service requires for sign-in.
function useChallenge(siteKey, holder) {
  const [token, setToken] = useState(''), [reset, setReset] = useState(0);
  useEffect(() => {
    if (!siteKey || !holder.current) return undefined;
    let id = null, cancelled = false;
    const render = () => { if (!cancelled && window.turnstile && holder.current) id = window.turnstile.render(holder.current, { sitekey: siteKey, callback: setToken, 'expired-callback': () => setToken(''), 'error-callback': () => setToken(''), size: 'flexible', theme: 'dark' }); };
    if (window.turnstile) render();
    else {
      let script = document.querySelector('script[data-turnstile]');
      if (!script) { script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.dataset.turnstile = '1'; document.head.appendChild(script); }
      script.addEventListener('load', render, { once: true });
    }
    return () => { cancelled = true; setToken(''); if (id !== null) window.turnstile?.remove(id); };
  }, [siteKey, holder, reset]);
  return [token, () => setReset(n => n + 1)];
}

export default function BetaSignIn({ runtime, onSignedIn }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [denied, setDenied] = useState(false);
  const holder = useRef(null);
  const siteKey = runtime.account?.turnstileSiteKey;
  const [challenge, resetChallenge] = useChallenge(siteKey, holder);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setDenied(false);
    try {
      const auth = await fetch(runtime.account.url + '/auth/v1/token?grant_type=password', {
        method: 'POST', credentials: 'omit', signal: AbortSignal.timeout(20000),
        headers: { apikey: runtime.account.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, ...(challenge ? { gotrue_meta_security: { captcha_token: challenge } } : {}) })
      });
      const account = await auth.json().catch(() => ({}));
      if (!auth.ok || !account.access_token) throw new Error(account.error_description || account.msg || 'Sign-in failed. Check your email and password.');
      setPassword('');
      const response = await fetch(base + '/api/atms/beta/session', { method: 'POST', credentials: 'omit', signal: AbortSignal.timeout(30000), headers: { Authorization: 'Bearer ' + account.access_token } });
      const session = await response.json().catch(() => ({}));
      if (response.status === 403) { setDenied(true); throw new Error(session.error); }
      if (!response.ok) throw new Error(session.error || 'The beta could not start your workspace.');
      onSignedIn(session);
    } catch (err) { setError(err.name === 'TimeoutError' ? 'The request timed out. Try again.' : err.message); }
    finally { setBusy(false); resetChallenge(); }
  }
  return <div className="connection-card beta-signin">
    <ShieldCheck size={30} />
    <h2>PurposeBuilt ATMS beta</h2>
    <p>Sign in with your PurposeBuilt account. You get a private training workspace with simulated incidents and sign emulators. It sends no commands to real equipment and is deleted after {runtime.sandbox?.lifetimeHours || 8} hours, or {runtime.sandbox?.idleMinutes || 60} minutes without use.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    {denied && <p><a href={ACCESS}>Request beta access</a></p>}
    <form onSubmit={submit}>
      <label className="form-field">Email<input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="form-field">Password<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      {siteKey && <div ref={holder} />}
      <button className="ops-button" disabled={busy || (siteKey && !challenge)}>{busy ? 'Starting your workspace…' : 'Sign in'}</button>
    </form>
    <p className="form-note">No PurposeBuilt account or no beta access yet? <a href={ACCESS}>Request access</a>. Your account is the same one used for DTCD and StormwaterCheck.</p>
  </div>;
}
