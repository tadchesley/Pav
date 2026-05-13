import Link from 'next/link';
import { Logo } from './Logo';

export const CONTACT_EMAIL = 'hello@pavapp.com';
export const DOMAIN = 'pavapp.com';

export function Footer() {
  return (
    <footer className="mt-32 border-t border-border">
      <div className="max-w-content container-px py-16">
        <div className="grid md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <Logo size="md" />
            <p className="mt-4 text-text-secondary max-w-sm leading-relaxed">
              The pulse of the market. AI-powered predictions across 871 tickers — stocks, crypto, FX, indices, and commodities.
            </p>
            <p className="mt-6 text-xs text-text-tertiary leading-relaxed max-w-md">
              Pav is for informational purposes only and is not financial advice.
              Past performance does not guarantee future results. Always do your own research.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-4">Product</h4>
            <ul className="space-y-3 text-sm text-text-secondary">
              <li><Link href="/#features" className="hover:text-text-primary">Features</Link></li>
              <li><Link href="/#how-it-works" className="hover:text-text-primary">How it works</Link></li>
              <li><Link href="/#pricing" className="hover:text-text-primary">Pricing</Link></li>
              <li><Link href="/#faq" className="hover:text-text-primary">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-4">Legal</h4>
            <ul className="space-y-3 text-sm text-text-secondary">
              <li><Link href="/privacy" className="hover:text-text-primary">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-text-primary">Terms of Service</Link></li>
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-text-primary">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between gap-4 text-xs text-text-tertiary">
          <p>© {new Date().getFullYear()} Pav. All rights reserved.</p>
          <p>Made for traders, by traders.</p>
        </div>
      </div>
    </footer>
  );
}
