'use client';

import { useEffect, useState } from 'react';
import { Apple, Play, X, ArrowRight } from 'lucide-react';
import { track } from '@vercel/analytics';
import { WaitlistForm } from './WaitlistForm';

type Variant = 'primary' | 'secondary';

export function ComingSoonButton({
  children,
  variant = 'primary',
  className = '',
  withArrow = false,
  location = 'unknown',
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  withArrow?: boolean;
  location?: string;
}) {
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    // Track the click in Vercel Analytics (no-op locally, live on Vercel)
    track('get_pav_clicked', { location });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const base = variant === 'primary' ? 'btn-primary' : 'btn-secondary';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`${base} ${className}`}
      >
        {children}
        {withArrow && <ArrowRight className="w-4 h-4" />}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="coming-soon-title"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="relative card max-w-md w-full p-8 text-center animate-fade-in-up">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close dialog"
              className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex justify-center mb-5">
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-full opacity-40 blur-2xl"
                  style={{ background: 'radial-gradient(circle, rgba(129,140,248,0.6) 0%, transparent 70%)' }}
                />
                <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-elev border border-border">
                  <span className="text-2xl font-bold gradient-text">P</span>
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-bull heartbeat" />
                </div>
              </div>
            </div>

            <h3
              id="coming-soon-title"
              className="text-2xl font-bold tracking-tight text-text-primary mb-3"
            >
              Coming soon
            </h3>
            <p className="text-text-secondary leading-relaxed mb-6">
              Pav is launching on the{' '}
              <span className="text-text-primary font-medium">Apple App Store</span> and{' '}
              <span className="text-text-primary font-medium">Google Play</span> soon.
              Drop your email and we&rsquo;ll let you know the moment it&rsquo;s live.
            </p>

            <div className="text-left">
              <WaitlistForm location={`modal_${location}`} />
            </div>

            <div className="flex items-center justify-center gap-3 text-xs text-text-tertiary -mt-2">
              <div className="flex items-center gap-1.5">
                <Apple className="w-3.5 h-3.5" />
                <span>App Store</span>
              </div>
              <span className="text-text-tertiary/50">•</span>
              <div className="flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5" />
                <span>Google Play</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
