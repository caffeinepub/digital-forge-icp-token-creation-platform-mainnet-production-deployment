import React from 'react';
import { Heart, Hammer } from 'lucide-react';
import BuyMeACoffee from './BuyMeACoffee';

type View = 'home' | 'create' | 'dashboard' | 'forged' | 'lookup';

interface FooterProps {
  currentView?: View;
  onNavigate?: (view: View) => void;
}

export default function Footer({ currentView, onNavigate }: FooterProps) {
  const year = new Date().getFullYear();
  const appId = encodeURIComponent(window.location.hostname || 'digital-forge-icp');

  return (
    <footer
      className="border-t mt-auto"
      style={{
        background: 'oklch(0.13 0.012 28)',
        borderColor: 'oklch(0.25 0.02 35)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Hammer className="w-5 h-5" style={{ color: 'oklch(0.72 0.20 42)' }} />
              <span
                className="font-mono font-bold text-lg tracking-widest uppercase"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.82 0.16 80) 0%, oklch(0.72 0.20 42) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Digital Forge
              </span>
            </div>
            <p className="text-sm" style={{ color: 'oklch(0.50 0.025 45)' }}>
              ICP Token Factory with 6 tax mechanisms. Built on the Internet Computer Protocol.
            </p>
          </div>

          {/* Navigation */}
          <div className="space-y-3">
            <h4
              className="text-xs font-mono font-bold tracking-widest uppercase"
              style={{ color: 'oklch(0.72 0.20 42)' }}
            >
              Navigate
            </h4>
            <div className="flex flex-col gap-2">
              {[
                { view: 'home' as View, label: 'Home' },
                { view: 'forged' as View, label: 'Forged Tokens' },
                { view: 'lookup' as View, label: 'Token Lookup' },
                { view: 'create' as View, label: 'Forge Token' },
              ].map(({ view, label }) => (
                <button
                  key={view}
                  onClick={() => onNavigate?.(view)}
                  className="text-left text-sm transition-colors duration-200 w-fit"
                  style={{ color: 'oklch(0.50 0.025 45)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'oklch(0.72 0.20 42)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'oklch(0.50 0.025 45)';
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Support */}
          <div className="space-y-3">
            <h4
              className="text-xs font-mono font-bold tracking-widest uppercase"
              style={{ color: 'oklch(0.72 0.20 42)' }}
            >
              Support the Forge
            </h4>
            <BuyMeACoffee />
          </div>
        </div>

        {/* Divider */}
        <div
          className="h-px mb-6"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, oklch(0.72 0.20 42 / 0.4) 50%, transparent 100%)',
          }}
        />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs" style={{ color: 'oklch(0.40 0.02 40)' }}>
            © {year} Digital Forge ICP — Paisley Protocol / THE pHuD FARM
          </p>
          <p className="text-xs flex items-center gap-1" style={{ color: 'oklch(0.40 0.02 40)' }}>
            Built with{' '}
            <Heart
              className="w-3 h-3 inline"
              style={{ color: 'oklch(0.72 0.20 42)', fill: 'oklch(0.72 0.20 42)' }}
            />{' '}
            using{' '}
            <a
              href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${appId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors duration-200"
              style={{ color: 'oklch(0.72 0.20 42)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = 'oklch(0.78 0.18 65)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = 'oklch(0.72 0.20 42)';
              }}
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
