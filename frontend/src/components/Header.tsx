import React, { useState } from 'react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useQueryClient } from '@tanstack/react-query';
import { Menu, X, Hammer, Zap, LayoutDashboard, Search, Globe } from 'lucide-react';
import WalletButton from './WalletButton';

type View = 'home' | 'create' | 'dashboard' | 'forged' | 'lookup';

interface HeaderProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

export default function Header({ currentView, onNavigate }: HeaderProps) {
  const { login, clear, loginStatus, identity, isInitializing } = useInternetIdentity();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthenticated = !!identity && !identity.getPrincipal().isAnonymous();
  const isLoggingIn = loginStatus === 'logging-in';

  const handleAuth = async () => {
    if (isAuthenticated) {
      await clear();
      queryClient.clear();
    } else {
      try {
        await login();
      } catch (error: unknown) {
        const err = error as Error;
        if (err?.message === 'User is already authenticated') {
          await clear();
          setTimeout(() => login(), 300);
        }
      }
    }
  };

  const navItems: { view: View; label: string; icon: React.ReactNode; requiresAuth?: boolean }[] = [
    { view: 'forged', label: 'Forged Tokens', icon: <Globe className="w-4 h-4" /> },
    { view: 'lookup', label: 'Token Lookup', icon: <Search className="w-4 h-4" /> },
    { view: 'create', label: 'Forge Token', icon: <Hammer className="w-4 h-4" />, requiresAuth: true },
    { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, requiresAuth: true },
  ];

  const visibleNavItems = navItems.filter(item => !item.requiresAuth || isAuthenticated);

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        background: 'oklch(0.13 0.012 28 / 0.95)',
        borderColor: 'oklch(0.28 0.025 38)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-3 group"
          >
            <div className="relative">
              <img
                src="/assets/generated/forge-anvil-icon-transparent.dim_64x64.png"
                alt="Digital Forge"
                className="w-9 h-9 object-contain ember-float"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ boxShadow: '0 0 16px oklch(0.72 0.20 42 / 0.6)' }}
              />
            </div>
            <div className="flex flex-col leading-none">
              <span
                className="font-mono text-lg font-bold tracking-widest uppercase"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.82 0.16 80) 0%, oklch(0.72 0.20 42) 50%, oklch(0.65 0.22 35) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Digital Forge
              </span>
              <span
                className="text-xs tracking-widest uppercase font-display"
                style={{ color: 'oklch(0.55 0.03 50)' }}
              >
                ICP Token Factory
              </span>
            </div>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {visibleNavItems.map((item) => (
              <button
                key={item.view}
                onClick={() => onNavigate(item.view)}
                className="flex items-center gap-2 px-4 py-2 rounded-forge text-sm font-display font-semibold tracking-wide uppercase transition-all duration-200"
                style={{
                  color: currentView === item.view
                    ? 'oklch(0.72 0.20 42)'
                    : 'oklch(0.60 0.025 50)',
                  background: currentView === item.view
                    ? 'oklch(0.72 0.20 42 / 0.12)'
                    : 'transparent',
                  borderBottom: currentView === item.view
                    ? '2px solid oklch(0.72 0.20 42)'
                    : '2px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (currentView !== item.view) {
                    (e.currentTarget as HTMLButtonElement).style.color = 'oklch(0.78 0.18 65)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'oklch(0.72 0.20 42 / 0.06)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentView !== item.view) {
                    (e.currentTarget as HTMLButtonElement).style.color = 'oklch(0.60 0.025 50)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right side: Wallet + Auth */}
          <div className="hidden md:flex items-center gap-3">
            <WalletButton />
            <button
              onClick={handleAuth}
              disabled={isLoggingIn || isInitializing}
              className="px-5 py-2 rounded-forge text-sm font-display font-bold tracking-wide uppercase transition-all duration-200 disabled:opacity-50"
              style={{
                background: isAuthenticated
                  ? 'oklch(0.20 0.02 30)'
                  : 'linear-gradient(135deg, oklch(0.72 0.20 42) 0%, oklch(0.65 0.22 35) 100%)',
                color: isAuthenticated
                  ? 'oklch(0.60 0.025 50)'
                  : 'oklch(0.10 0.01 30)',
                border: isAuthenticated
                  ? '1px solid oklch(0.28 0.025 38)'
                  : 'none',
              }}
            >
              {isLoggingIn || isInitializing ? (
                <span className="flex items-center gap-2">
                  <Zap className="w-3 h-3 animate-pulse" />
                  {isInitializing ? 'Loading...' : 'Connecting...'}
                </span>
              ) : isAuthenticated ? (
                'Disconnect'
              ) : (
                <span className="flex items-center gap-2">
                  <Zap className="w-3 h-3" />
                  Connect
                </span>
              )}
            </button>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-forge transition-colors"
            style={{ color: 'oklch(0.60 0.025 50)' }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          className="md:hidden border-t px-4 py-4 space-y-2"
          style={{
            background: 'oklch(0.13 0.012 28)',
            borderColor: 'oklch(0.28 0.025 38)',
          }}
        >
          {visibleNavItems.map((item) => (
            <button
              key={item.view}
              onClick={() => { onNavigate(item.view); setMobileMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-forge text-sm font-display font-semibold tracking-wide uppercase transition-all duration-200"
              style={{
                color: currentView === item.view ? 'oklch(0.72 0.20 42)' : 'oklch(0.60 0.025 50)',
                background: currentView === item.view ? 'oklch(0.72 0.20 42 / 0.1)' : 'transparent',
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <WalletButton />
            <button
              onClick={() => { handleAuth(); setMobileMenuOpen(false); }}
              disabled={isLoggingIn || isInitializing}
              className="w-full px-4 py-3 rounded-forge text-sm font-display font-bold tracking-wide uppercase transition-all duration-200 disabled:opacity-50"
              style={{
                background: isAuthenticated
                  ? 'oklch(0.20 0.02 30)'
                  : 'linear-gradient(135deg, oklch(0.72 0.20 42) 0%, oklch(0.65 0.22 35) 100%)',
                color: isAuthenticated ? 'oklch(0.60 0.025 50)' : 'oklch(0.10 0.01 30)',
                border: isAuthenticated ? '1px solid oklch(0.28 0.025 38)' : 'none',
              }}
            >
              {isLoggingIn || isInitializing ? 'Loading...' : isAuthenticated ? 'Disconnect' : 'Connect Identity'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
