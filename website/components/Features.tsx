import {
  Brain,
  TrendingUp,
  Bell,
  Filter,
  Heart,
  LineChart,
} from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'AI reasoning, not just signals',
    desc: 'Claude Sonnet 4.5 writes a clear narrative for every prediction — direction, confidence, key factors, and risks. No black boxes.',
    accent: 'text-indigo',
  },
  {
    icon: TrendingUp,
    title: 'Real prices, real data',
    desc: 'Live Finnhub stock prices, Yahoo Finance for crypto, FX, indices, and commodities. RSI, SMA, momentum, volatility — all computed fresh.',
    accent: 'text-bull',
  },
  {
    icon: Filter,
    title: 'Powerful screener',
    desc: 'Filter the top 100 most-liquid names by direction, confidence, and sector. See live result counts as you tap.',
    accent: 'text-amber',
  },
  {
    icon: Heart,
    title: 'Watchlist that travels',
    desc: 'Add up to 871 tickers across asset classes. Pin your favorites, get fresh predictions, and never miss a move.',
    accent: 'text-bear',
  },
  {
    icon: Bell,
    title: 'Smart alerts',
    desc: 'Price-above, price-below, or confidence-threshold alerts. Set once, get notified when the market moves.',
    accent: 'text-amber',
  },
  {
    icon: LineChart,
    title: 'Beautiful candle charts',
    desc: '60-day candlestick charts with technical overlays, rendered natively in SVG. Smooth on every device.',
    accent: 'text-indigo',
  },
];

export function Features() {
  return (
    <section id="features" className="py-24">
      <div className="max-w-content container-px">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="badge border-border bg-surface/60 text-text-secondary mb-4">
            <span>Features</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight gradient-text mb-4">
            Everything you need to read the market.
          </h2>
          <p className="text-text-secondary text-lg leading-relaxed">
            Built for traders who want signal, not noise.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="card p-6 hover:border-text-tertiary transition-colors group"
            >
              <div className={`${f.accent} mb-4`}>
                <f.icon className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
