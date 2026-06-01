import MicrosoftButton from '../components/MicrosoftButton';

export default function Login() {
  return (
    <div className="page">
      <div className="card">
        <div className="brand">
          <div className="brand__logo">✉️</div>
          <h1>Email Automation</h1>
          <p className="muted">
            Sign in with your Microsoft account to register. We&apos;ll keep you
            in the loop by email.
          </p>
        </div>

        <MicrosoftButton />

        <p className="fineprint">
          By continuing you agree to receive a confirmation email. We only read
          your name and email address.
        </p>
      </div>
    </div>
  );
}
