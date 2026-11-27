import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { parentPasskey } from './parentPasskey';

type Props = {
  mode: 'login' | 'setup';
  onUnlocked?: () => void;
};

export default function ParentPasskeyPanel({ mode, onUnlocked }: Props) {
  const [email, setEmail] = useState(
    () => localStorage.getItem('kids-parent-passkey-email') ?? ''
  );
  const [sessionEmail, setSessionEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    void parentPasskey.getSession().then(({ data }) => {
      if (active) {
        setSessionEmail(data.session?.user.email ?? '');
      }
    });

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setSessionEmail(session?.user.email ?? '');
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function sendSetupLink() {
    if (!email.trim()) {
      setMessage('Please enter your email address.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const { error } = await parentPasskey.sendSetupLink(email.trim());

      if (error) throw error;

      localStorage.setItem('kids-parent-passkey-email', email.trim());

      setMessage(
        'Sign-in link sent. Open the email on this phone, then return to Star Rewards.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send the email.');
    } finally {
      setBusy(false);
    }
  }

  async function registerPasskey() {
    setBusy(true);
    setMessage('');

    try {
      const { data: sessionData, error: sessionError } =
        await parentPasskey.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        setMessage('Please open your sign-in email link first.');
        return;
      }

      const { error } = await parentPasskey.register();

      if (error) throw error;

      localStorage.setItem('kids-parent-passkey-registered', 'true');
      setMessage('Face or fingerprint passkey registered successfully!');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Passkey registration failed.');
    } finally {
      setBusy(false);
    }
  }

  async function unlockWithPasskey() {
    setBusy(true);
    setMessage('');

    try {
      const { data, error } = await parentPasskey.signIn();

      if (error) throw error;

      if (!data.session) {
        setMessage('Passkey sign-in did not complete. Please use your password.');
        return;
      }

      onUnlocked?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Passkey sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'login') {
    return (
      <section className="card" style={{ marginTop: '16px' }}>
        <h3>🔐 Face or Fingerprint</h3>
        <p>Unlock Parent Section using your saved phone passkey.</p>

        <button
          type="button"
          disabled={busy}
          onClick={() => void unlockWithPasskey()}
        >
          {busy ? 'Checking...' : '🔓 Unlock with Face or Fingerprint'}
        </button>

        {message && <p role="status">{message}</p>}
      </section>
    );
  }

  return (
    <section className="card" style={{ marginTop: '16px' }}>
      <h3>🔐 Enable Face or Fingerprint</h3>

      <p>
        Verify your email once, then register this phone's passkey.
        Your device handles the biometric check.
      </p>

      {!sessionEmail ? (
        <>
          <label>
            Parent email address
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              required
            />
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={() => void sendSetupLink()}
          >
            {busy ? 'Sending...' : 'Send Verification Email'}
          </button>
        </>
      ) : (
        <>
          <p>Verified account: {sessionEmail}</p>

          <button
            type="button"
            disabled={busy}
            onClick={() => void registerPasskey()}
          >
            {busy ? 'Registering...' : 'Register Face / Fingerprint'}
          </button>
        </>
      )}

      {message && <p role="status">{message}</p>}
    </section>
  );
}
