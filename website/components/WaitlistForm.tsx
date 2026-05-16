'use client';

import { useState } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { track } from '@vercel/analytics';

const LOOPS_FORM_ENDPOINT =
  'https://app.loops.so/api/newsletter-form/cmp80jn5p1bng0j0simq4y633';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === 'loading') return;

    const trimmed = email.trim();
    // Basic client-side email sanity check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus('error');
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const formBody = new URLSearchParams({
        email: trimmed,
        userGroup: 'Pav waitlist',
        source: 'pavapp.com',
      });

      const res = await fetch(LOOPS_FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString(),
      });

      if (!res.ok) {
        let msg = 'Something went wrong. Please try again.';
        try {
          const data = await res.json();
          if (data?.message) msg = String(data.message);
        } catch {
          /* ignore */
        }
        setStatus('error');
        setErrorMsg(msg);
        return;
      }

      track('waitlist_signup', { location: 'pricing_premium' });
      setStatus('success');
      setEmail('');
    } catch (_err) {
      setStatus('error');
      setErrorMsg('Network error. Please try again in a moment.');
    }
  };

  if (status === 'success') {
    return (
      <div className="mb-8">
        <div className="w-full flex items-center gap-3 rounded-xl border border-bull/30 bg-bull/10 px-4 py-3 text-sm text-text-primary">
          <Check className="w-5 h-5 text-bull shrink-0" />
          <div className="leading-snug">
            <div className="font-medium">You&rsquo;re on the list.</div>
            <div className="text-text-secondary text-xs mt-0.5">
              We&rsquo;ll email you the moment Pav launches.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mb-8" noValidate>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === 'error') {
              setStatus('idle');
              setErrorMsg('');
            }
          }}
          disabled={status === 'loading'}
          aria-label="Email address"
          aria-invalid={status === 'error'}
          className="flex-1 min-w-0 rounded-xl bg-elev border border-border px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/30 transition-colors disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium text-bg bg-text-primary hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Joining…</span>
            </>
          ) : (
            <span>Notify me</span>
          )}
        </button>
      </div>
      {status === 'error' && (
        <div className="mt-2 flex items-center gap-2 text-xs text-bear">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {status !== 'error' && (
        <p className="mt-2 text-xs text-text-tertiary">
          No spam. We&rsquo;ll only email you at launch.
        </p>
      )}
    </form>
  );
}
