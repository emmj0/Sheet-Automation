/** The official-style "Continue with Microsoft" button (full-page redirect). */
import { MICROSOFT_LOGIN_URL } from '../config';

export default function MicrosoftButton() {
  return (
    <a className="ms-btn" href={MICROSOFT_LOGIN_URL}>
      <svg className="ms-btn__icon" viewBox="0 0 21 21" aria-hidden="true">
        <rect x="1" y="1" width="9" height="9" fill="#F25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
        <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
        <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
      </svg>
      <span>Continue with Microsoft</span>
    </a>
  );
}
