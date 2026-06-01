import { FormEvent, useCallback, useEffect, useState } from 'react';
import MicrosoftButton from '../components/MicrosoftButton';
import {
  ADMIN_DISCONNECT_URL,
  ADMIN_PASS,
  ADMIN_STATUS_URL,
  ADMIN_USER,
} from '../config';

const GATE_KEY = 'admin_gate_ok';
const SECRET_KEY = 'admin_secret';

interface Status {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
}

export default function Login() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(GATE_KEY) === '1'
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const adminSecret = sessionStorage.getItem(SECRET_KEY) || '';

  const fetchStatus = useCallback(async () => {
    const secret = sessionStorage.getItem(SECRET_KEY) || '';
    if (!secret) return;
    setLoading(true);
    try {
      const res = await fetch(ADMIN_STATUS_URL, {
        headers: { 'x-admin-secret': secret },
      });
      if (res.ok) {
        setStatus(await res.json());
      } else {
        setStatus(null);
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // When unlocked (incl. returning from the Microsoft redirect), load status.
  useEffect(() => {
    if (unlocked) fetchStatus();
  }, [unlocked, fetchStatus]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (username.trim() === ADMIN_USER && password === ADMIN_PASS) {
      sessionStorage.setItem(GATE_KEY, '1');
      sessionStorage.setItem(SECRET_KEY, password);
      setUnlocked(true);
      setError('');
    } else {
      setError('Incorrect username or password.');
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Disconnect the Microsoft account? Email sending will stop until you reconnect.')) {
      return;
    }
    setBusy(true);
    try {
      await fetch(ADMIN_DISCONNECT_URL, {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret },
      });
      await fetchStatus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="brand">
          <div className="brand__logo">✉️</div>
          <h1>Email Automation</h1>
          <p className="muted">
            {unlocked ? 'Admin dashboard' : 'Please sign in to continue.'}
          </p>
        </div>

        {!unlocked ? (
          <form className="form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Username</span>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoFocus
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </label>
            {error && <p className="form__error">{error}</p>}
            <button type="submit" className="submit-btn">
              Sign in
            </button>
          </form>
        ) : (
          <div className="panel">
            <div className="status">
              <span className="status__label">Microsoft connection</span>
              {loading ? (
                <span className="status__pill status__pill--idle">Checking…</span>
              ) : status?.connected ? (
                <span className="status__pill status__pill--ok">Connected</span>
              ) : (
                <span className="status__pill status__pill--off">Not connected</span>
              )}
            </div>

            {status?.connected ? (
              <>
                <p className="muted">
                  Connected as <strong>{status.email}</strong>. Welcome emails
                  are sent from this account.
                </p>
                <button
                  className="danger-btn"
                  onClick={handleDisconnect}
                  disabled={busy}
                >
                  {busy ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </>
            ) : (
              <>
                <p className="muted">
                  No Microsoft account is connected. Connect one to enable
                  sign-in registration and sending.
                </p>
                <MicrosoftButton />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
