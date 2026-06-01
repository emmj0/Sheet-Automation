import { Link, useSearchParams } from 'react-router-dom';

const REASONS: Record<string, string> = {
  missing_code: 'Microsoft did not send an authorization code. Please try again.',
  oauth_failed: 'We could not complete sign-in with Microsoft. Please try again.',
  access_denied: 'You cancelled the Microsoft sign-in.',
};

export default function ErrorPage() {
  const [params] = useSearchParams();
  const reason = params.get('reason') ?? '';
  const message = REASONS[reason] ?? 'Something went wrong during sign-in.';

  return (
    <div className="page">
      <div className="card">
        <div className="badge badge--error">⚠️</div>
        <h1>Sign-in failed</h1>
        <p className="muted">{message}</p>
        <Link className="link-btn" to="/">
          Try again
        </Link>
      </div>
    </div>
  );
}
