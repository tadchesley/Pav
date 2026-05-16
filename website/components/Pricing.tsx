import { Check, Sparkles } from 'lucide-react';
import { ComingSoonButton } from './ComingSoonButton';

const freeFeatures = [
  'Up to 15 symbols on watchlist',
  'Weekly AI predictions',
  'Basic screener (top 100 names)',
  'Live prices across all 871 tickers',
  'Price alerts',
];

const premiumFeatures = [
  'Unlimited watchlist symbols',
  'Real-time AI predictions',
  'Advanced screener with custom filters',
  'Confidence-threshold alerts',
  'Priority data refresh',
  'Early access to new features',
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24">
      <div className="max-w-content container-px">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="badge border-border bg-surface/60 text-text-secondary mb-4">
            <span>Pricing</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight gradient-text mb-4">
            Start free. Upgrade when you&apos;re ready.
          </h2>
          <p className="text-text-secondary text-lg leading-relaxed">
            No credit card to get started.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {/* Free */}
          <div className="card p-8">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-text-primary mb-1">Free</h3>
              <p className="text-sm text-text-secondary">Everything to get started.</p>
            </div>
            <div className="mb-6">
              <span className="text-5xl font-bold text-text-primary">$0</span>
              <span className="text-text-tertiary ml-2">/ forever</span>
            </div>
            <ComingSoonButton variant="secondary" className="w-full mb-8" location="pricing_free">
              Download Pav
            </ComingSoonButton>
            <ul className="space-y-3">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-text-secondary">
                  <Check className="w-4 h-4 text-bull shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Premium — Coming Soon */}
          <div className="card p-8 relative overflow-hidden border-indigo/30">
            <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-indigo to-transparent opacity-50" />
            <div
              className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-30 blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(129,140,248,0.4) 0%, transparent 70%)' }}
            />
            <div className="relative">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-text-primary mb-1 flex items-center gap-2">
                    Premium
                    <Sparkles className="w-4 h-4 text-indigo" />
                  </h3>
                  <p className="text-sm text-text-secondary">For serious traders.</p>
                </div>
                <span className="badge border-indigo/30 bg-indigo/10 text-indigo">
                  Coming Soon
                </span>
              </div>
              <div className="mb-2">
                <span className="text-5xl font-bold text-text-primary">$4.99</span>
                <span className="text-text-tertiary ml-2">/ month</span>
              </div>
              <p className="text-sm text-text-tertiary mb-6">
                or <span className="text-text-secondary">$49.99/year</span> — save 17%
              </p>
              <button
                disabled
                className="btn-secondary w-full mb-8 opacity-60 cursor-not-allowed"
              >
                Notify me at launch
              </button>
              <ul className="space-y-3">
                {premiumFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-text-secondary">
                    <Check className="w-4 h-4 text-indigo shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-text-tertiary mt-8">
          Pav is for informational purposes only and is not financial advice.
        </p>
      </div>
    </section>
  );
}
