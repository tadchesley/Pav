'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'What is Pav?',
    a: "Pav is a mobile app that delivers AI-powered predictions for 871 tickers across stocks, ETFs, crypto, FX, indices, and commodities. It combines real-time market data with Claude Sonnet 4.5 reasoning to give you a clear read on direction, confidence, and risks.",
  },
  {
    q: 'How accurate are the predictions?',
    a: "No model is perfect, and no one can predict markets with certainty. Pav surfaces a 7-day directional bias with a confidence score and the reasoning behind it. Treat predictions as one input among many — never the only one. Pav is for informational purposes and is not financial advice.",
  },
  {
    q: 'Where does the price data come from?',
    a: "Pav uses Finnhub for real-time stock prices and Yahoo Finance for crypto, FX, indices, and commodities. Prices refresh roughly every 60 seconds. We compute technical indicators (RSI, SMA, momentum, volatility) fresh on every prediction.",
  },
  {
    q: 'Do I need to pay to use Pav?',
    a: "No. The Free plan gives you up to 15 watchlist symbols, weekly AI predictions, live prices across all 871 tickers, the basic screener, and price alerts. Premium ($4.99/mo or $49.99/yr) unlocks unlimited symbols, real-time predictions, the advanced screener, and confidence alerts — and is coming soon.",
  },
  {
    q: 'When does Premium launch?',
    a: "Premium is in final polish. Sign up for the Free tier today and you'll be the first to know when Premium goes live.",
  },
  {
    q: 'Is my data private?',
    a: "Yes. We only collect what's needed to run your account — email, watchlist, and alerts. We never sell your data. See our Privacy Policy for full details.",
  },
  {
    q: 'Which platforms is Pav on?',
    a: "Pav is built natively for iOS and Android using Expo. We're rolling out on the App Store and Play Store soon — join the waitlist and we'll send you the link the moment it's live.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-24">
      <div className="max-w-3xl mx-auto container-px">
        <div className="text-center mb-16">
          <div className="badge border-border bg-surface/60 text-text-secondary mb-4">
            <span>FAQ</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight gradient-text mb-4">
            Questions, answered.
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="card overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-elev/40 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-medium text-text-primary pr-4">
                    {f.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-text-tertiary shrink-0 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm text-text-secondary leading-relaxed">
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
