import { Flame, Zap, Shield, TrendingUp, ArrowRight, Coins, Lock, BarChart3, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from '../hooks/useWallet';
import { useState } from 'react';

type View = 'home' | 'create' | 'dashboard' | 'forged' | 'lookup';

interface HomePageProps {
  onNavigate: (view: View) => void;
}

export default function HomePage({ onNavigate }: HomePageProps) {
  const { connected } = useWallet();
  const [showWalletWarning, setShowWalletWarning] = useState(false);

  const handleForgeClick = () => {
    if (!connected) {
      setShowWalletWarning(true);
      setTimeout(() => setShowWalletWarning(false), 4000);
      return;
    }
    onNavigate('create');
  };

  const features = [
    {
      icon: <Flame className="w-6 h-6" />,
      title: 'Token Forging',
      description: 'Deploy custom ICP tokens with configurable tax modules, treasury management, and burn mechanics.',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Treasury Protection',
      description: 'Built-in treasury fee routing ensures sustainable tokenomics with automatic fee distribution.',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Tax Modules',
      description: 'Choose from reflection, liquidity, burn, yield, and support modules to customize your token economy.',
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Community Explorer',
      description: 'Discover and explore all tokens forged on the platform with real-time stats and analytics.',
    },
    {
      icon: <Coins className="w-6 h-6" />,
      title: 'ICP Native',
      description: 'Built natively on the Internet Computer Protocol for maximum speed, security, and decentralization.',
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: 'Audit Ready',
      description: 'Every token is tracked on-chain with full transparency, audit status, and verification support.',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Connect Wallet',
      description: 'Connect your Plug wallet to authenticate and prepare for token deployment.',
    },
    {
      number: '02',
      title: 'Configure Token',
      description: 'Set your token name, symbol, supply, decimals, and choose your tax modules.',
    },
    {
      number: '03',
      title: 'Pay Mint Fee',
      description: 'Send 1 ICP to the treasury to cover the token deployment and registration fee.',
    },
    {
      number: '04',
      title: 'Token Forged',
      description: 'Your token is deployed on-chain and listed in the community explorer.',
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
            <Flame className="w-3.5 h-3.5" />
            ICP Token Factory
          </div>

          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            <span className="forge-text-gradient">Forge Your</span>
            <br />
            <span className="text-foreground">Token Empire</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Deploy custom tokens on the Internet Computer with advanced tax mechanics, treasury management,
            and community discovery — all in one forge.
          </p>

          {/* Wallet warning message */}
          {showWalletWarning && (
            <div className="flex items-center justify-center gap-2 mb-6 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium max-w-sm mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Connect wallet to forge tokens
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={handleForgeClick}
              size="lg"
              className="forge-button-primary text-base px-8 py-6 h-auto font-bold group"
            >
              <Flame className="w-5 h-5 mr-2 group-hover:animate-pulse" />
              Forge a Token
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              onClick={() => onNavigate('forged')}
              variant="outline"
              size="lg"
              className="text-base px-8 py-6 h-auto border-border/60 hover:border-primary/40"
            >
              <BarChart3 className="w-5 h-5 mr-2" />
              Explore Tokens
            </Button>
          </div>

          {!connected && (
            <p className="text-xs text-muted-foreground mt-4">
              Connect your Plug wallet to start forging
            </p>
          )}
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything You Need to <span className="forge-text-gradient">Forge</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            A complete token factory with professional-grade features built directly on the Internet Computer.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group p-6 rounded-2xl bg-card/50 border border-border/40 hover:border-primary/40 transition-all duration-300 hover:bg-card/80"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 group-hover:bg-primary/20 transition-colors">
                {feature.icon}
              </div>
              <h3 className="font-bold text-lg mb-2 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-card/20 border-y border-border/30">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How the <span className="forge-text-gradient">Forge</span> Works
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From wallet connection to deployed token in four simple steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-primary/40 to-transparent z-10" />
                )}
                <div className="p-6 rounded-2xl bg-card/50 border border-border/40 h-full">
                  <div className="text-4xl font-black forge-text-gradient mb-4 leading-none">{step.number}</div>
                  <h3 className="font-bold text-base mb-2 text-foreground">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="relative overflow-hidden rounded-3xl bg-card/50 border border-border/40 p-12">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/10 rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to <span className="forge-text-gradient">Forge?</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8">
              Join the Digital Forge and deploy your token on the Internet Computer today.
              1 ICP mint fee. Unlimited potential.
            </p>

            {showWalletWarning && (
              <div className="flex items-center justify-center gap-2 mb-6 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium max-w-sm mx-auto">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Connect wallet to forge tokens
              </div>
            )}

            <Button
              onClick={handleForgeClick}
              size="lg"
              className="forge-button-primary text-base px-10 py-6 h-auto font-bold group"
            >
              <Flame className="w-5 h-5 mr-2 group-hover:animate-pulse" />
              Start Forging Now
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
