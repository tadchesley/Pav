import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Logo } from './Logo';
import { ComingSoonButton } from './ComingSoonButton';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-content container-px pt-20 pb-24 md:pt-32 md:pb-40 text-center">
        <div className="badge border-border bg-surface/60 text-text-secondary mx-auto mb-8">
          <Sparkles className="w-3.5 h-3.5 text-indigo" />
          <span>Powered by Claude Sonnet 4.5</span>
        </div>

        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight gradient-text mb-6 leading-[1.05]">
          The pulse of<br />the market.
        </h1>

        <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed mb-10">
          AI-powered predictions across <span className="text-text-primary font-medium">871 tickers</span> — stocks, crypto, FX, indices, and commodities. Real prices. Real reasoning. Beautiful on mobile.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <ComingSoonButton variant="primary" className="w-full sm:w-auto" withArrow location="hero">
            Get Pav
          </ComingSoonButton>
          <Link href="/#how-it-works" className="btn-secondary w-full sm:w-auto">
            See how it works
          </Link>
        </div>

        <div className="mt-20 max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden border border-border">
            <Stat value="871" label="Tickers covered" />
            <Stat value="60s" label="Live price refresh" />
            <Stat value="7d" label="AI prediction horizon" />
            <Stat value="24/7" label="Crypto & FX coverage" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-bg p-6 text-center">
      <div className="text-3xl md:text-4xl font-bold text-text-primary mb-1">{value}</div>
      <div className="text-xs md:text-sm text-text-tertiary">{label}</div>
    </div>
  );
}
