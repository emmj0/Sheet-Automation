import { FormEvent, useState } from 'react';
import MicrosoftButton from '../components/MicrosoftButton';
import { ADMIN_PASS, ADMIN_USER } from '../config';

const GATE_KEY = 'admin_gate_ok';

export default function Login() {
  // Remember the gate within this browser session so a back-navigation from
  // the Microsoft flow doesn't force re-entry.
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(GATE_KEY) === '1'
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (username.trim() === ADMIN_USER && password === ADMIN_PASS) {
      sessionStorage.setItem(GATE_KEY, '1');
      setUnlocked(true);
      setError('');
    } else {
      setError('Incorrect username or password.');
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="brand">
          <div className="brand__logo">✉️</div>
          <h1>Email Automation</h1>
          <p className="muted">
            {unlocked
              ? 'Signed in. Continue with your Microsoft account to register.'
              : 'Please sign in to continue.'}
          </p>
        </div>

        {unlocked ? (
          <MicrosoftButton />
        ) : (
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
        )}

        <p className="fineprint">
          By continuing you agree to receive a confirmation email. We only read
          your name and email address.
        </p>
      </div>
    </div>
  );
}
