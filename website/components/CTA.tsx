import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Logo } from './Logo';

export function CTA() {
  return (
    <section className="py-24">
      <div className="max-w-content container-px">
        <div className="card p-12 md:p-16 text-center relative overflow-hidden">
          <div
            className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(129,140,248,0.5) 0%, transparent 60%)' }}
          />
          <div className="relative">
            <div className="flex justify-center mb-6">
              <Logo size="md" />
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight gradient-text mb-4">
              Feel the pulse.
            </h2>
            <p className="text-text-secondary text-lg max-w-xl mx-auto mb-8 leading-relaxed">
              Download Pav and start exploring AI-powered predictions across 871 tickers — completely free.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/#pricing" className="btn-primary">
                Get Pav free
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
