import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pavapp.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Pav — The pulse of the market.',
  description:
    'Pav delivers AI-powered stock predictions across 871 tickers. Real-time prices, Claude-powered analysis, and a beautiful mobile experience.',
  keywords: [
    'stock predictions',
    'AI stocks',
    'market sentiment',
    'crypto predictions',
    'investment app',
    'Pav',
  ],
  authors: [{ name: 'Pav' }],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Pav — The pulse of the market.',
    description:
      'AI-powered stock, crypto, FX, and commodity predictions across 871 tickers. Built for serious traders.',
    type: 'website',
    siteName: 'Pav',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pav — The pulse of the market.',
    description:
      'AI-powered stock, crypto, FX, and commodity predictions across 871 tickers.',
  },
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
