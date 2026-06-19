/*
 * FinishSignIn — local v2 copy emitting `data-oriz-finish-sign-in-*` hooks.
 * Mirrors oriz-home/src/components/FinishSignIn.tsx with relative imports.
 */
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import { auth } from '../lib/firebase';

interface Props {
  successPath?: string;
  emailStorageKey?: string;
}

export default function FinishSignIn({
  successPath = '/account/',
  emailStorageKey = 'oriz:emailForSignIn',
}: Props) {
  const [status, setStatus] = useState<
    'working' | 'need-email' | 'done' | 'error'
  >('working');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const finish = useCallback(
    async (e: string) => {
      setStatus('working');
      setError(null);
      try {
        await signInWithEmailLink(auth, e, window.location.href);
        window.localStorage.removeItem(emailStorageKey);
        setStatus('done');
        window.setTimeout(() => {
          window.location.href = successPath;
        }, 1200);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [emailStorageKey, successPath],
  );

  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      setStatus('error');
      setError('This link is invalid or expired.');
      return;
    }
    const stored = window.localStorage.getItem(emailStorageKey);
    if (stored) void finish(stored);
    else setStatus('need-email');
  }, [emailStorageKey, finish]);

  if (status === 'working') {
    return (
      <p
        data-oriz-finish-sign-in
        data-oriz-finish-sign-in-state="working"
        role="status"
      >
        Signing you in…
      </p>
    );
  }
  if (status === 'done') {
    return (
      <p
        data-oriz-finish-sign-in
        data-oriz-finish-sign-in-state="done"
        role="status"
      >
        Signed in. Redirecting…
      </p>
    );
  }
  if (status === 'need-email') {
    return (
      <form
        data-oriz-finish-sign-in
        data-oriz-finish-sign-in-state="need-email"
        onSubmit={(e) => {
          e.preventDefault();
          void finish(email);
        }}
      >
        <p>Please confirm the email address you used:</p>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <button type="submit" data-oriz-account-provider="email">
          Continue
        </button>
      </form>
    );
  }
  return (
    <div data-oriz-finish-sign-in data-oriz-finish-sign-in-state="error">
      <p data-oriz-finish-sign-in-error role="alert">
        {error ?? 'Sign-in failed.'}
      </p>
      <a href="/account/" data-oriz-account-provider="email">
        Back to sign in
      </a>
    </div>
  );
}
