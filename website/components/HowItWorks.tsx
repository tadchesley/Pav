import { Search, Cpu, Bell } from 'lucide-react';

const steps = [
  {
    n: '01',
    icon: Search,
    title: 'Pick your tickers',
    desc: 'Search across 871 symbols — stocks, ETFs, crypto, FX, indices, and commodities. Add them to your watchlist with one tap.',
  },
  {
    n: '02',
    icon: Cpu,
    title: 'Get the AI read',
    desc: 'Pav computes RSI, momentum, and volatility, then asks Claude Sonnet 4.5 to weigh the evidence and produce a 7-day direction with confidence.',
  },
  {
    n: '03',
    icon: Bell,
    title: 'Stay ahead with alerts',
    desc: 'Set price-above, price-below, or confidence-threshold alerts. Get notified when the setup you care about actually triggers.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="max-w-content container-px">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="badge border-border bg-surface/60 text-text-secondary mb-4">
            <span>How it works</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight gradient-text mb-4">
            From zero to insight in three taps.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5 relative">
          {steps.map((s, i) => (
            <div key={s.n} className="card p-8 relative">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-sm font-mono text-text-tertiary">{s.n}</span>
                <div className="h-px flex-1 bg-border" />
                <s.icon className="w-5 h-5 text-indigo" />
              </div>
              <h3 className="text-xl font-semibold text-text-primary mb-3">
                {s.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {s.desc}
              </p>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-px bg-border" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
