import { Navbar } from '@/components/Navbar';
import { Footer, CONTACT_EMAIL } from '@/components/Footer';

export const metadata = {
  title: 'Privacy Policy — Pav',
  description: 'How Pav collects, uses, and protects your information.',
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto container-px py-20">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight gradient-text mb-4">
          Privacy Policy
        </h1>
        <p className="text-text-tertiary text-sm mb-12">Last updated: November 2025</p>

        <Section title="1. Introduction">
          <p>
            Welcome to Pav (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;). This Privacy Policy explains how we collect, use, and protect your information when you use the Pav mobile application and related services (the &ldquo;Service&rdquo;).
          </p>
          <p>
            By using Pav, you agree to the practices described here. If you do not agree, please do not use the Service.
          </p>
        </Section>

        <Section title="2. Information we collect">
          <p>We collect only what is necessary to operate Pav:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-text-primary">Account information:</strong> email address and a securely hashed password (we never store your password in plain text).</li>
            <li><strong className="text-text-primary">Usage data:</strong> your watchlist symbols, alerts you create, and theme preference.</li>
            <li><strong className="text-text-primary">Device information:</strong> basic technical info (operating system, app version) used to keep the app running smoothly.</li>
            <li><strong className="text-text-primary">Subscription information:</strong> if you upgrade to Premium, your subscription tier and plan. Payments are processed by a third-party provider; we do not store full payment card data.</li>
          </ul>
        </Section>

        <Section title="3. How we use information">
          <p>We use your information to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Authenticate you and operate your account.</li>
            <li>Provide predictions, alerts, and watchlist functionality.</li>
            <li>Fix bugs, improve performance, and develop new features.</li>
            <li>Communicate important account or service updates.</li>
          </ul>
          <p>We never sell your personal data.</p>
        </Section>

        <Section title="4. Third-party services">
          <p>Pav relies on a small number of third-party services to function:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-text-primary">Market data providers</strong> (Finnhub, Yahoo Finance) — to fetch real-time prices and historical data. Symbol lookups are sent to these providers; no personal account data is shared.</li>
            <li><strong className="text-text-primary">AI provider</strong> (Anthropic Claude via the Emergent platform) — to generate prediction narratives. Only the symbol, computed indicators, and historical data are sent; we do not send your identity.</li>
            <li><strong className="text-text-primary">Database hosting</strong> (MongoDB) — to securely store your account and watchlist.</li>
          </ul>
        </Section>

        <Section title="5. Data retention">
          <p>
            We retain your account information for as long as your account is active. You may request deletion of your account and associated data at any time by emailing <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo hover:underline">{CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <Section title="6. Security">
          <p>
            We use industry-standard security practices: passwords are hashed with bcrypt, sessions are managed via JWTs, and all traffic is encrypted in transit (HTTPS). No system is 100% secure, so we encourage you to use a strong, unique password.
          </p>
        </Section>

        <Section title="7. Children's privacy">
          <p>
            Pav is not intended for users under 18. We do not knowingly collect data from children. If you believe a child has provided us information, please contact us so we can remove it.
          </p>
        </Section>

        <Section title="8. Your rights">
          <p>
            Depending on your location, you may have the right to access, correct, or delete the personal data we hold about you, and to object to or restrict certain processing. To exercise any of these rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo hover:underline">{CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>
            We may update this Privacy Policy from time to time. Material changes will be communicated in-app or by email. The &ldquo;Last updated&rdquo; date at the top reflects the most recent revision.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            Questions about this policy? Email <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo hover:underline">{CONTACT_EMAIL}</a>.
          </p>
        </Section>
      </main>
      <Footer />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl md:text-2xl font-semibold text-text-primary mb-3">{title}</h2>
      <div className="text-text-secondary leading-relaxed space-y-3 text-[15px]">{children}</div>
    </section>
  );
}
