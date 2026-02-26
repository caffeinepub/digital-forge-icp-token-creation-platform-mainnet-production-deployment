import React, { useState, useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { useInternetIdentity } from './hooks/useInternetIdentity';
import Header from './components/Header';
import Footer from './components/Footer';
import ProfileSetupModal from './components/ProfileSetupModal';
import HomePage from './pages/HomePage';
import CreateTokenWizard from './pages/CreateTokenWizard';
import Dashboard from './pages/Dashboard';
import ForgedTokens from './pages/ForgedTokens';
import TokenLookup from './pages/TokenLookup';
import { useGetCallerUserProfile } from './hooks/useQueries';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
});

type View = 'home' | 'create' | 'dashboard' | 'forged' | 'lookup';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('home');
  const { identity, isInitializing } = useInternetIdentity();

  const isAuthenticated = !!identity && !identity.getPrincipal().isAnonymous();

  const { data: userProfile, isLoading: profileLoading, isFetched: profileFetched } = useGetCallerUserProfile();

  const showProfileSetup =
    isAuthenticated &&
    !isInitializing &&
    !profileLoading &&
    profileFetched &&
    userProfile === null;

  const navigate = (view: View) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isAuthenticated && (currentView === 'create' || currentView === 'dashboard')) {
      setCurrentView('home');
    }
  }, [isAuthenticated, currentView]);

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <HomePage onNavigate={navigate} />;
      case 'create':
        return isAuthenticated ? <CreateTokenWizard onNavigate={navigate} /> : <HomePage onNavigate={navigate} />;
      case 'dashboard':
        return isAuthenticated ? <Dashboard onNavigate={navigate} /> : <HomePage onNavigate={navigate} />;
      case 'forged':
        return <ForgedTokens onNavigate={navigate} />;
      case 'lookup':
        return <TokenLookup onNavigate={navigate} />;
      default:
        return <HomePage onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--forge-obsidian)' }}>
      <Header currentView={currentView} onNavigate={navigate} />
      <main className="flex-1">
        {renderView()}
      </main>
      <Footer currentView={currentView} onNavigate={navigate} />
      {showProfileSetup && (
        <ProfileSetupModal
          open={showProfileSetup}
          onComplete={() => {}}
        />
      )}
      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: 'oklch(0.16 0.015 30)',
            border: '1px solid oklch(0.28 0.025 38)',
            color: 'oklch(0.88 0.02 60)',
          },
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
