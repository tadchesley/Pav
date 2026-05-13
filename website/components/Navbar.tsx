'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { ComingSoonButton } from './ComingSoonButton';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all ${
        scrolled ? 'glass border-b border-border' : ''
      }`}
    >
      <nav className="max-w-content container-px h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Logo size="md" />
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-text-secondary">
          <Link href="/#features" className="hover:text-text-primary transition-colors">
            Features
          </Link>
          <Link href="/#how-it-works" className="hover:text-text-primary transition-colors">
            How it works
          </Link>
          <Link href="/#pricing" className="hover:text-text-primary transition-colors">
            Pricing
          </Link>
          <Link href="/#faq" className="hover:text-text-primary transition-colors">
            FAQ
          </Link>
        </div>
        <ComingSoonButton variant="primary" className="!py-2 !px-4 text-sm">
          Get Pav
        </ComingSoonButton>
      </nav>
    </header>
  );
}
