import { Link, useSearchParams } from 'react-router-dom';

export default function Success() {
  const [params] = useSearchParams();
  const status = params.get('status'); // "new" | "existing"
  const email = params.get('email') ?? '';

  const alreadyRegistered = status === 'existing';

  return (
    <div className="page">
      <div className="card">
        <div className={`badge ${alreadyRegistered ? 'badge--info' : 'badge--success'}`}>
          {alreadyRegistered ? 'ℹ️' : '✅'}
        </div>

        {alreadyRegistered ? (
          <>
            <h1>You are already registered.</h1>
            <p className="muted">
              {email ? <strong>{email}</strong> : 'This account'} is already on
              our list — no need to sign up again.
            </p>
          </>
        ) : (
          <>
            <h1>You&apos;re all set! 🎉</h1>
            <p className="muted">
              {email ? <strong>{email}</strong> : 'Your account'} has been
              registered successfully.
            </p>
          </>
        )}

        <Link className="link-btn" to="/">
          Back to home
        </Link>
      </div>
    </div>
  );
}
