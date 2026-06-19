/*
 * AccountPanel — local v2 copy emitting the canonical `data-oriz-account-*`
 * selector hooks. Datasheet white + archival blue paint via
 * `src/styles/oriz-ui-overrides.css`.
 *
 * Mirrors oriz-home/src/components/AccountPanel.tsx. Verbatim except for the
 * relative import path to `../lib/firebase` (oriz-home uses the `~` alias).
 */
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';

type Provider = 'google' | 'github' | 'email-link' | 'anonymous';
const DEFAULT_PROVIDERS: Provider[] = [
  'google',
  'github',
  'email-link',
  'anonymous',
];

interface Props {
  finishSignInPath?: string;
  emailStorageKey?: string;
  providers?: Provider[];
  siteName?: string;
}

export default function AccountPanel({
  finishSignInPath = '/account/finish-sign-in/',
  emailStorageKey = 'oriz:emailForSignIn',
  providers = DEFAULT_PROVIDERS,
  siteName = 'oriz / me',
}: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<
    'google' | 'github' | 'email' | 'anon' | 'out' | null
  >(null);
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      }),
    [],
  );

  const wrap = async (
    key: 'google' | 'github' | 'email' | 'anon' | 'out',
    fn: () => Promise<unknown>,
  ) => {
    setError(null);
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onGoogle = () =>
    wrap('google', () => signInWithPopup(auth, new GoogleAuthProvider()));
  const onGithub = () =>
    wrap('github', () => signInWithPopup(auth, new GithubAuthProvider()));
  const onAnon = () => wrap('anon', () => signInAnonymously(auth));
  const onSignOut = () => wrap('out', () => signOut(auth));
  const onEmail = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return wrap('email', async () => {
      const url = `${window.location.origin}${finishSignInPath}`;
      await sendSignInLinkToEmail(auth, email, { url, handleCodeInApp: true });
      window.localStorage.setItem(emailStorageKey, email);
      setLinkSent(true);
    });
  };

  const showGoogle = providers.includes('google');
  const showGithub = providers.includes('github');
  const showEmailLink = providers.includes('email-link');
  const showAnon = providers.includes('anonymous');

  if (loading) {
    return (
      <div data-oriz-account data-oriz-account-state="loading">
        <span data-oriz-account-spinner aria-hidden="true">
          ⟳
        </span>
        <p>Loading…</p>
      </div>
    );
  }

  if (user) {
    return (
      <div data-oriz-account data-oriz-account-state="signed-in">
        <div data-oriz-account-me>
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt=""
              data-oriz-account-avatar
              referrerPolicy="no-referrer"
            />
          )}
          <div>
            <p data-oriz-account-name>
              {user.displayName ?? user.email ?? 'Signed in'}
            </p>
            {user.email && <p data-oriz-account-email>{user.email}</p>}
            {user.isAnonymous && (
              <p data-oriz-account-email>Anonymous session on {siteName}</p>
            )}
          </div>
        </div>
        <p data-oriz-account-note>
          You are signed in across every oriz site. Visit any subdomain and your
          session is already there.
        </p>
        <button
          type="button"
          data-oriz-account-action="sign-out"
          data-oriz-account-provider="out"
          onClick={onSignOut}
          disabled={busy === 'out'}
        >
          Sign out
        </button>
        {error && (
          <p data-oriz-account-error role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div data-oriz-account data-oriz-account-state="signed-out">
      <h2 data-oriz-account-heading>Sign in</h2>
      <div data-oriz-account-providers>
        {showGoogle && (
          <button
            type="button"
            data-oriz-account-provider="google"
            onClick={onGoogle}
            disabled={busy !== null}
          >
            {busy === 'google' ? 'Signing in…' : 'Continue with Google'}
          </button>
        )}
        {showGithub && (
          <button
            type="button"
            data-oriz-account-provider="github"
            onClick={onGithub}
            disabled={busy !== null}
          >
            {busy === 'github' ? 'Signing in…' : 'Continue with GitHub'}
          </button>
        )}
      </div>
      {showEmailLink && (
        <>
          <div data-oriz-account-separator>
            <span>or with email</span>
          </div>
          <form onSubmit={onEmail} data-oriz-account-email-form>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy !== null || linkSent}
            />
            <button
              type="submit"
              data-oriz-account-provider="email"
              disabled={busy !== null || linkSent}
            >
              {busy === 'email'
                ? 'Sending…'
                : linkSent
                  ? 'Link sent'
                  : 'Send sign-in link'}
            </button>
          </form>
          {linkSent && (
            <p data-oriz-account-link-sent role="status">
              Check your inbox at <strong>{email}</strong>. The link is valid
              for 1 hour.
            </p>
          )}
        </>
      )}
      {showAnon && (
        <button
          type="button"
          data-oriz-account-provider="anon"
          onClick={onAnon}
          disabled={busy !== null}
        >
          Just browsing — continue anonymously
        </button>
      )}
      {error && (
        <p data-oriz-account-error role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
