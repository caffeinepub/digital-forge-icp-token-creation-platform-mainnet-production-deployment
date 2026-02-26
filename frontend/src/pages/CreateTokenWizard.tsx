import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  ChevronRight,
  ChevronLeft,
  Hammer,
  Coins,
  Shield,
  CheckCircle,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Zap,
  Info,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCreateToken,
  useRecordPayment,
  useGetPaymentRecord,
  useGetCallerUserProfile,
} from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import type { TokenConfig, TaxModules, ModuleConfig, TreasuryFeeConfig } from '../backend';
import { MediaType, TokenStatus, ModuleType } from '../backend';

type View = 'home' | 'create' | 'dashboard' | 'forged' | 'lookup';

interface CreateTokenWizardProps {
  onNavigate: (view: View) => void;
}

const TREASURY_ADDRESS = 'ab6f9d02f1930037c53b781620754e804b140732f0990cc252fc604915303936';
const MINT_FEE_E8S = 1_000_000_000n;

const DEFAULT_TAX_MODULES: TaxModules = {
  treasury: false,
  burn: false,
  reflection: false,
  liquidity: false,
  yield: false,
  support: false,
};

const DEFAULT_TREASURY_FEE: TreasuryFeeConfig = {
  treasuryAddress: TREASURY_ADDRESS,
  buyFee: 25n,
  sellFee: 25n,
  enabled: true,
};

interface WizardFormData {
  // Step 1: Basic Info
  name: string;
  symbol: string;
  description: string;
  totalSupply: string;
  decimals: string;
  // Step 2: Tax Modules
  taxModules: TaxModules;
  moduleConfigs: ModuleConfig[];
  // Step 3: Media & Meta
  mediaUrl: string;
  thumbnailUrl: string;
  chartUrl: string;
  creatorName: string;
  tags: string;
  communityExplorer: boolean;
  aiAgentCompatible: boolean;
  featured: boolean;
}

const DEFAULT_FORM: WizardFormData = {
  name: '',
  symbol: '',
  description: '',
  totalSupply: '1000000000',
  decimals: '8',
  taxModules: DEFAULT_TAX_MODULES,
  moduleConfigs: [],
  mediaUrl: '',
  thumbnailUrl: '',
  chartUrl: '',
  creatorName: '',
  tags: '',
  communityExplorer: true,
  aiAgentCompatible: false,
  featured: false,
};

const MODULE_TYPES: { key: keyof TaxModules; label: string; description: string }[] = [
  { key: 'treasury', label: 'Treasury', description: 'Collect fees to a treasury wallet on buy/sell.' },
  { key: 'burn', label: 'Burn', description: 'Permanently burn tokens on each transaction.' },
  { key: 'reflection', label: 'Reflection', description: 'Redistribute tokens to all holders.' },
  { key: 'liquidity', label: 'Liquidity', description: 'Auto-add liquidity on each transaction.' },
  { key: 'yield', label: 'Yield', description: 'Distribute yield rewards to stakers.' },
  { key: 'support', label: 'Support', description: 'Fund project development and support.' },
];

function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: totalSteps }, (_, i) => (
        <React.Fragment key={i}>
          <div
            className="flex items-center justify-center w-8 h-8 rounded-forge text-xs font-mono font-bold transition-all duration-300"
            style={{
              background: i < currentStep
                ? 'linear-gradient(135deg, oklch(0.72 0.20 42) 0%, oklch(0.65 0.22 35) 100%)'
                : i === currentStep
                  ? 'oklch(0.72 0.20 42 / 0.15)'
                  : 'oklch(0.16 0.015 30)',
              border: i <= currentStep
                ? '1px solid oklch(0.72 0.20 42)'
                : '1px solid oklch(0.25 0.02 35)',
              color: i < currentStep
                ? 'oklch(0.10 0.01 30)'
                : i === currentStep
                  ? 'oklch(0.72 0.20 42)'
                  : 'oklch(0.40 0.02 40)',
              boxShadow: i === currentStep ? '0 0 12px oklch(0.72 0.20 42 / 0.4)' : 'none',
            }}
          >
            {i < currentStep ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          {i < totalSteps - 1 && (
            <div
              className="h-px w-8 transition-all duration-300"
              style={{
                background: i < currentStep
                  ? 'oklch(0.72 0.20 42)'
                  : 'oklch(0.25 0.02 35)',
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function FormField({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        className="text-xs font-mono font-bold tracking-widest uppercase"
        style={{ color: 'oklch(0.72 0.20 42)' }}
      >
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-xs" style={{ color: 'oklch(0.45 0.02 40)' }}>{hint}</p>
      )}
      {error && (
        <p className="text-xs flex items-center gap-1" style={{ color: 'oklch(0.65 0.22 25)' }}>
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

export default function CreateTokenWizard({ onNavigate }: CreateTokenWizardProps) {
  const { identity } = useInternetIdentity();
  const { data: userProfile } = useGetCallerUserProfile();
  const createToken = useCreateToken();
  const recordPayment = useRecordPayment();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardFormData>({
    ...DEFAULT_FORM,
    creatorName: userProfile?.name || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentId, setPaymentId] = useState<bigint | null>(null);
  const [createdCanisterId, setCreatedCanisterId] = useState<string | null>(null);
  const [copiedCanister, setCopiedCanister] = useState(false);

  const { data: paymentRecord, isLoading: paymentLoading } = useGetPaymentRecord(paymentId);

  const isAuthenticated = !!identity && !identity.getPrincipal().isAnonymous();

  useEffect(() => {
    if (userProfile?.name && !form.creatorName) {
      setForm((f) => ({ ...f, creatorName: userProfile.name }));
    }
  }, [userProfile]);

  // ── Validation ──────────────────────────────────────────────────────────────
  const validateStep0 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Token name is required';
    else if (form.name.trim().length > 100) errs.name = 'Max 100 characters';
    if (!form.symbol.trim()) errs.symbol = 'Symbol is required';
    else if (form.symbol.trim().length > 10) errs.symbol = 'Max 10 characters';
    if (!form.totalSupply || isNaN(Number(form.totalSupply)) || Number(form.totalSupply) <= 0)
      errs.totalSupply = 'Valid total supply required';
    if (!form.decimals || isNaN(Number(form.decimals)) || Number(form.decimals) > 18)
      errs.decimals = 'Decimals must be 0–18';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    const enabledModules = form.moduleConfigs;
    let totalBuy = 0;
    let totalSell = 0;
    for (const mc of enabledModules) {
      totalBuy += Number(mc.buyTax);
      totalSell += Number(mc.sellTax);
    }
    if (totalBuy < 25) errs.tax = 'Total buy tax must be at least 0.25% (25 bps)';
    if (totalBuy > 2500) errs.tax = 'Total buy tax cannot exceed 25% (2500 bps)';
    if (totalSell < 25) errs.taxSell = 'Total sell tax must be at least 0.25% (25 bps)';
    if (totalSell > 2500) errs.taxSell = 'Total sell tax cannot exceed 25% (2500 bps)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Module Config Helpers ───────────────────────────────────────────────────
  const toggleModule = (key: keyof TaxModules) => {
    const enabled = !form.taxModules[key];
    const newModules = { ...form.taxModules, [key]: enabled };

    let newConfigs = [...form.moduleConfigs];
    if (enabled) {
      const moduleTypeMap: Record<keyof TaxModules, ModuleType> = {
        treasury: ModuleType.treasury,
        burn: ModuleType.burn,
        reflection: ModuleType.reflection,
        liquidity: ModuleType.liquidity,
        yield: ModuleType.yield_,
        support: ModuleType.support,
      };
      newConfigs.push({
        moduleType: moduleTypeMap[key],
        buyTax: 25n,
        sellTax: 25n,
        unified: true,
        split: false,
        rewardTokenAddress: undefined,
        tokenAddress: undefined,
        reflectionTarget: undefined,
      });
    } else {
      const moduleTypeMap: Record<keyof TaxModules, ModuleType> = {
        treasury: ModuleType.treasury,
        burn: ModuleType.burn,
        reflection: ModuleType.reflection,
        liquidity: ModuleType.liquidity,
        yield: ModuleType.yield_,
        support: ModuleType.support,
      };
      newConfigs = newConfigs.filter(
        (mc) => {
          const mcType = typeof mc.moduleType === 'object'
            ? Object.keys(mc.moduleType)[0]
            : String(mc.moduleType);
          return mcType !== moduleTypeMap[key];
        }
      );
    }

    setForm((f) => ({ ...f, taxModules: newModules, moduleConfigs: newConfigs }));
  };

  const updateModuleConfig = (index: number, field: 'buyTax' | 'sellTax', value: string) => {
    const parsed = Math.max(0, Math.min(5000, parseInt(value) || 0));
    const newConfigs = [...form.moduleConfigs];
    newConfigs[index] = { ...newConfigs[index], [field]: BigInt(parsed) };
    setForm((f) => ({ ...f, moduleConfigs: newConfigs }));
  };

  // ── Payment Flow ────────────────────────────────────────────────────────────
  const handleRecordPayment = async () => {
    if (!isAuthenticated) {
      toast.error('Please connect your identity first');
      return;
    }
    try {
      const result = await recordPayment.mutateAsync({
        amount: MINT_FEE_E8S,
        treasuryAddress: TREASURY_ADDRESS,
      });
      // result is { message: string; paymentId: bigint }
      setPaymentId(result.paymentId);
    } catch {
      // Error handled by mutation hook
    }
  };

  // ── Token Creation ──────────────────────────────────────────────────────────
  const handleCreateToken = async () => {
    if (!isAuthenticated) {
      toast.error('Please connect your identity first');
      return;
    }

    if (paymentId === null) {
      toast.error('Payment required before creating token');
      return;
    }

    if (!paymentRecord?.verified) {
      toast.error('Payment not yet verified by admin. Please wait.');
      return;
    }

    const config: TokenConfig = {
      name: form.name.trim(),
      symbol: form.symbol.trim().toUpperCase(),
      description: form.description.trim(),
      totalSupply: BigInt(form.totalSupply),
      decimals: BigInt(form.decimals),
      treasuryFee: DEFAULT_TREASURY_FEE,
      taxModules: form.taxModules,
      moduleConfigs: form.moduleConfigs,
      mediaUrl: form.mediaUrl,
      thumbnailUrl: form.thumbnailUrl,
      status: TokenStatus.active,
      circulatingSupply: BigInt(form.totalSupply),
      rewardTokenAddress: undefined,
      tokenAddress: undefined,
      validationTimestamp: undefined,
      testingStatus: undefined,
      communityExplorer: form.communityExplorer,
      aiAgentCompatible: form.aiAgentCompatible,
      mediaType: MediaType.image,
      chartUrl: form.chartUrl,
      creatorName: form.creatorName,
      creatorProfileUrl: '',
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      featured: form.featured,
      customFields: [],
      emblemAspectRatio: undefined,
      emblemProcessingMetadata: undefined,
      paymentId: paymentId,
    };

    try {
      const result = await createToken.mutateAsync(config);
      setCreatedCanisterId(result.canisterId);
      setStep(4); // Success step
    } catch {
      // Error handled by mutation hook
    }
  };

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleNext = () => {
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    setStep((s) => Math.min(s + 1, 3));
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'oklch(0.12 0.01 30)' }}>
        <div
          className="max-w-md w-full p-8 rounded-forge text-center space-y-4"
          style={{
            background: 'oklch(0.15 0.012 28)',
            border: '1px solid oklch(0.28 0.025 38)',
          }}
        >
          <Hammer className="w-12 h-12 mx-auto" style={{ color: 'oklch(0.72 0.20 42)' }} />
          <h2 className="text-2xl font-mono font-bold" style={{ color: 'oklch(0.85 0.02 55)' }}>
            Authentication Required
          </h2>
          <p className="text-sm" style={{ color: 'oklch(0.55 0.03 50)' }}>
            Connect your Internet Identity to access the token forge.
          </p>
          <button
            onClick={() => onNavigate('home')}
            className="px-6 py-2.5 rounded-forge font-display font-bold tracking-widest uppercase text-sm transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, oklch(0.72 0.20 42) 0%, oklch(0.65 0.22 35) 100%)',
              color: 'oklch(0.10 0.01 30)',
            }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Success screen
  if (step === 4 && createdCanisterId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'oklch(0.12 0.01 30)' }}>
        <div
          className="max-w-lg w-full p-8 rounded-forge text-center space-y-6"
          style={{
            background: 'oklch(0.15 0.012 28)',
            border: '1px solid oklch(0.72 0.20 42 / 0.5)',
            boxShadow: '0 0 40px oklch(0.72 0.20 42 / 0.2)',
          }}
        >
          <div
            className="w-16 h-16 rounded-forge flex items-center justify-center mx-auto ember-float"
            style={{
              background: 'oklch(0.72 0.20 42 / 0.15)',
              border: '1px solid oklch(0.72 0.20 42 / 0.5)',
            }}
          >
            <CheckCircle className="w-8 h-8" style={{ color: 'oklch(0.65 0.18 145)' }} />
          </div>

          <div>
            <h2
              className="text-3xl font-mono font-black tracking-tight mb-2"
              style={{
                background: 'linear-gradient(135deg, oklch(0.82 0.16 80) 0%, oklch(0.72 0.20 42) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Token Forged!
            </h2>
            <p className="text-sm" style={{ color: 'oklch(0.55 0.03 50)' }}>
              Your token has been successfully deployed on the Internet Computer.
            </p>
          </div>

          <div
            className="p-4 rounded-sharp text-left"
            style={{
              background: 'oklch(0.12 0.01 25)',
              border: '1px solid oklch(0.25 0.02 35)',
            }}
          >
            <p className="text-xs font-mono mb-1" style={{ color: 'oklch(0.45 0.02 40)' }}>Canister ID</p>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono flex-1 break-all" style={{ color: 'oklch(0.72 0.20 42)' }}>
                {createdCanisterId}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdCanisterId);
                  setCopiedCanister(true);
                  setTimeout(() => setCopiedCanister(false), 2000);
                }}
                className="p-1.5 rounded-sharp flex-shrink-0 transition-colors duration-200"
                style={{
                  background: copiedCanister ? 'oklch(0.65 0.18 145 / 0.15)' : 'oklch(0.20 0.02 30)',
                  border: `1px solid ${copiedCanister ? 'oklch(0.65 0.18 145 / 0.5)' : 'oklch(0.28 0.025 38)'}`,
                  color: copiedCanister ? 'oklch(0.65 0.18 145)' : 'oklch(0.55 0.03 50)',
                }}
              >
                {copiedCanister ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onNavigate('dashboard')}
              className="flex-1 py-3 rounded-forge font-display font-bold tracking-widest uppercase text-sm transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, oklch(0.72 0.20 42) 0%, oklch(0.65 0.22 35) 100%)',
                color: 'oklch(0.10 0.01 30)',
              }}
            >
              View Dashboard
            </button>
            <button
              onClick={() => onNavigate('forged')}
              className="flex-1 py-3 rounded-forge font-display font-bold tracking-widest uppercase text-sm transition-all duration-200"
              style={{
                background: 'transparent',
                border: '1px solid oklch(0.72 0.20 42 / 0.5)',
                color: 'oklch(0.72 0.20 42)',
              }}
            >
              Explore Tokens
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: 'oklch(0.12 0.01 30)' }}>
      <div className="max-w-2xl mx-auto">
        {/* Hero image */}
        <div className="mb-8 rounded-forge overflow-hidden opacity-60">
          <img
            src="/assets/generated/token-wizard-hero.dim_800x400.png"
            alt=""
            className="w-full h-32 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1
            className="text-4xl font-mono font-black tracking-tight mb-2"
            style={{
              background: 'linear-gradient(135deg, oklch(0.82 0.16 80) 0%, oklch(0.72 0.20 42) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Token Forge
          </h1>
          <p className="text-sm" style={{ color: 'oklch(0.55 0.03 50)' }}>
            Configure and deploy your ICP token in 4 steps
          </p>
        </div>

        <StepIndicator currentStep={step} totalSteps={4} />

        {/* Step Container */}
        <div
          className="rounded-forge p-6 sm:p-8"
          style={{
            background: 'linear-gradient(135deg, oklch(0.16 0.015 30) 0%, oklch(0.14 0.012 28) 100%)',
            border: '1px solid oklch(0.25 0.02 35)',
          }}
        >
          {/* ── Step 0: Basic Info ── */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-xl font-display font-bold tracking-wide" style={{ color: 'oklch(0.85 0.02 55)' }}>
                Basic Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Token Name" error={errors.name}>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="My Forge Token"
                    maxLength={100}
                    style={{
                      background: 'oklch(0.14 0.012 28)',
                      border: errors.name ? '1px solid oklch(0.55 0.22 25)' : '1px solid oklch(0.28 0.025 38)',
                      color: 'oklch(0.88 0.02 60)',
                    }}
                  />
                </FormField>

                <FormField label="Symbol" error={errors.symbol} hint="Max 10 characters, e.g. FORGE">
                  <Input
                    value={form.symbol}
                    onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                    placeholder="FORGE"
                    maxLength={10}
                    style={{
                      background: 'oklch(0.14 0.012 28)',
                      border: errors.symbol ? '1px solid oklch(0.55 0.22 25)' : '1px solid oklch(0.28 0.025 38)',
                      color: 'oklch(0.88 0.02 60)',
                    }}
                  />
                </FormField>
              </div>

              <FormField label="Description">
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe your token..."
                  rows={3}
                  maxLength={2000}
                  style={{
                    background: 'oklch(0.14 0.012 28)',
                    border: '1px solid oklch(0.28 0.025 38)',
                    color: 'oklch(0.88 0.02 60)',
                    resize: 'none',
                  }}
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Total Supply" error={errors.totalSupply}>
                  <Input
                    type="number"
                    value={form.totalSupply}
                    onChange={(e) => setForm((f) => ({ ...f, totalSupply: e.target.value }))}
                    placeholder="1000000000"
                    min="1"
                    style={{
                      background: 'oklch(0.14 0.012 28)',
                      border: errors.totalSupply ? '1px solid oklch(0.55 0.22 25)' : '1px solid oklch(0.28 0.025 38)',
                      color: 'oklch(0.88 0.02 60)',
                    }}
                  />
                </FormField>

                <FormField label="Decimals" error={errors.decimals} hint="0–18, typically 8">
                  <Input
                    type="number"
                    value={form.decimals}
                    onChange={(e) => setForm((f) => ({ ...f, decimals: e.target.value }))}
                    placeholder="8"
                    min="0"
                    max="18"
                    style={{
                      background: 'oklch(0.14 0.012 28)',
                      border: errors.decimals ? '1px solid oklch(0.55 0.22 25)' : '1px solid oklch(0.28 0.025 38)',
                      color: 'oklch(0.88 0.02 60)',
                    }}
                  />
                </FormField>
              </div>

              <FormField label="Creator Name">
                <Input
                  value={form.creatorName}
                  onChange={(e) => setForm((f) => ({ ...f, creatorName: e.target.value }))}
                  placeholder="Your name or handle"
                  maxLength={100}
                  style={{
                    background: 'oklch(0.14 0.012 28)',
                    border: '1px solid oklch(0.28 0.025 38)',
                    color: 'oklch(0.88 0.02 60)',
                  }}
                />
              </FormField>
            </div>
          )}

          {/* ── Step 1: Tax Modules ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-display font-bold tracking-wide mb-1" style={{ color: 'oklch(0.85 0.02 55)' }}>
                  Tax Modules
                </h2>
                <p className="text-xs" style={{ color: 'oklch(0.50 0.025 45)' }}>
                  Configure buy/sell tax mechanisms. Total must be 0.25%–25% (25–2500 bps).
                </p>
              </div>

              {errors.tax && (
                <div
                  className="p-3 rounded-sharp flex items-center gap-2"
                  style={{ background: 'oklch(0.55 0.22 25 / 0.1)', border: '1px solid oklch(0.55 0.22 25 / 0.3)' }}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'oklch(0.65 0.22 25)' }} />
                  <p className="text-xs" style={{ color: 'oklch(0.65 0.22 25)' }}>{errors.tax}</p>
                </div>
              )}

              <div className="space-y-3">
                {MODULE_TYPES.map(({ key, label, description }) => {
                  const enabled = form.taxModules[key];
                  const configIndex = form.moduleConfigs.findIndex((mc) => {
                    const mcType = typeof mc.moduleType === 'object'
                      ? Object.keys(mc.moduleType)[0]
                      : String(mc.moduleType);
                    const moduleTypeMap: Record<keyof TaxModules, string> = {
                      treasury: 'treasury',
                      burn: 'burn',
                      reflection: 'reflection',
                      liquidity: 'liquidity',
                      yield: 'yield_',
                      support: 'support',
                    };
                    return mcType === moduleTypeMap[key];
                  });
                  const config = configIndex >= 0 ? form.moduleConfigs[configIndex] : null;

                  return (
                    <div
                      key={key}
                      className="rounded-forge p-4 transition-all duration-200"
                      style={{
                        background: enabled ? 'oklch(0.72 0.20 42 / 0.05)' : 'oklch(0.14 0.012 28)',
                        border: enabled ? '1px solid oklch(0.72 0.20 42 / 0.4)' : '1px solid oklch(0.22 0.018 32)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-display font-bold text-sm tracking-wide" style={{ color: 'oklch(0.85 0.02 55)' }}>
                            {label}
                          </p>
                          <p className="text-xs" style={{ color: 'oklch(0.45 0.02 40)' }}>{description}</p>
                        </div>
                        <Switch
                          checked={enabled}
                          onCheckedChange={() => toggleModule(key)}
                        />
                      </div>

                      {enabled && config && (
                        <div className="grid grid-cols-2 gap-3 mt-3 pt-3" style={{ borderTop: '1px solid oklch(0.22 0.018 32)' }}>
                          <FormField label="Buy Tax (bps)">
                            <Input
                              type="number"
                              value={Number(config.buyTax)}
                              onChange={(e) => updateModuleConfig(configIndex, 'buyTax', e.target.value)}
                              min="0"
                              max="5000"
                              style={{
                                background: 'oklch(0.12 0.01 25)',
                                border: '1px solid oklch(0.25 0.02 35)',
                                color: 'oklch(0.88 0.02 60)',
                              }}
                            />
                          </FormField>
                          <FormField label="Sell Tax (bps)">
                            <Input
                              type="number"
                              value={Number(config.sellTax)}
                              onChange={(e) => updateModuleConfig(configIndex, 'sellTax', e.target.value)}
                              min="0"
                              max="5000"
                              style={{
                                background: 'oklch(0.12 0.01 25)',
                                border: '1px solid oklch(0.25 0.02 35)',
                                color: 'oklch(0.88 0.02 60)',
                              }}
                            />
                          </FormField>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 2: Media & Meta ── */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-display font-bold tracking-wide" style={{ color: 'oklch(0.85 0.02 55)' }}>
                Media & Metadata
              </h2>

              <FormField label="Media URL" hint="Image or GIF URL for your token">
                <Input
                  value={form.mediaUrl}
                  onChange={(e) => setForm((f) => ({ ...f, mediaUrl: e.target.value }))}
                  placeholder="https://..."
                  style={{
                    background: 'oklch(0.14 0.012 28)',
                    border: '1px solid oklch(0.28 0.025 38)',
                    color: 'oklch(0.88 0.02 60)',
                  }}
                />
              </FormField>

              <FormField label="Thumbnail URL">
                <Input
                  value={form.thumbnailUrl}
                  onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
                  placeholder="https://..."
                  style={{
                    background: 'oklch(0.14 0.012 28)',
                    border: '1px solid oklch(0.28 0.025 38)',
                    color: 'oklch(0.88 0.02 60)',
                  }}
                />
              </FormField>

              <FormField label="Chart URL" hint="Optional DEX chart link">
                <Input
                  value={form.chartUrl}
                  onChange={(e) => setForm((f) => ({ ...f, chartUrl: e.target.value }))}
                  placeholder="https://..."
                  style={{
                    background: 'oklch(0.14 0.012 28)',
                    border: '1px solid oklch(0.28 0.025 38)',
                    color: 'oklch(0.88 0.02 60)',
                  }}
                />
              </FormField>

              <FormField label="Tags" hint="Comma-separated, e.g. defi, meme, utility">
                <Input
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="defi, meme, utility"
                  style={{
                    background: 'oklch(0.14 0.012 28)',
                    border: '1px solid oklch(0.28 0.025 38)',
                    color: 'oklch(0.88 0.02 60)',
                  }}
                />
              </FormField>

              <div className="space-y-3">
                {[
                  { key: 'communityExplorer' as const, label: 'List in Community Explorer', desc: 'Make your token discoverable in the public gallery' },
                  { key: 'aiAgentCompatible' as const, label: 'AI Agent Compatible', desc: 'Mark as compatible with AI agent integrations' },
                  { key: 'featured' as const, label: 'Request Featured Listing', desc: 'Request admin review for featured placement' },
                ].map(({ key, label, desc }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-4 rounded-forge"
                    style={{
                      background: 'oklch(0.14 0.012 28)',
                      border: '1px solid oklch(0.22 0.018 32)',
                    }}
                  >
                    <div>
                      <p className="text-sm font-display font-semibold tracking-wide" style={{ color: 'oklch(0.80 0.02 55)' }}>
                        {label}
                      </p>
                      <p className="text-xs" style={{ color: 'oklch(0.45 0.02 40)' }}>{desc}</p>
                    </div>
                    <Switch
                      checked={form[key]}
                      onCheckedChange={(checked) => setForm((f) => ({ ...f, [key]: checked }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: Payment & Deploy ── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-display font-bold tracking-wide mb-1" style={{ color: 'oklch(0.85 0.02 55)' }}>
                  Payment & Deploy
                </h2>
                <p className="text-xs" style={{ color: 'oklch(0.50 0.025 45)' }}>
                  Pay the 1 ICP forge fee and deploy your token canister.
                </p>
              </div>

              {/* Token Summary */}
              <div
                className="p-4 rounded-forge space-y-2"
                style={{
                  background: 'oklch(0.12 0.01 25)',
                  border: '1px solid oklch(0.25 0.02 35)',
                }}
              >
                <p className="text-xs font-mono font-bold tracking-widest uppercase mb-3" style={{ color: 'oklch(0.55 0.03 50)' }}>
                  Token Summary
                </p>
                {[
                  { label: 'Name', value: form.name },
                  { label: 'Symbol', value: form.symbol },
                  { label: 'Supply', value: Number(form.totalSupply).toLocaleString() },
                  { label: 'Decimals', value: form.decimals },
                  { label: 'Modules', value: Object.entries(form.taxModules).filter(([, v]) => v).map(([k]) => k).join(', ') || 'None' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span style={{ color: 'oklch(0.45 0.02 40)' }}>{label}</span>
                    <span className="font-mono font-bold" style={{ color: 'oklch(0.78 0.18 65)' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Fee Info */}
              <div
                className="p-4 rounded-forge"
                style={{
                  background: 'oklch(0.72 0.20 42 / 0.05)',
                  border: '1px solid oklch(0.72 0.20 42 / 0.3)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-4 h-4" style={{ color: 'oklch(0.72 0.20 42)' }} />
                  <span className="text-sm font-display font-bold tracking-wide" style={{ color: 'oklch(0.78 0.18 65)' }}>
                    Forge Fee: 1 ICP
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'oklch(0.50 0.025 45)' }}>
                  Treasury: <code className="font-mono text-xs" style={{ color: 'oklch(0.72 0.20 42)' }}>{TREASURY_ADDRESS.slice(0, 20)}...</code>
                </p>
              </div>

              {/* Payment Status */}
              {paymentId === null ? (
                <button
                  onClick={handleRecordPayment}
                  disabled={recordPayment.isPending}
                  className="w-full py-3 rounded-forge font-display font-bold tracking-widest uppercase text-sm transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, oklch(0.72 0.20 42) 0%, oklch(0.65 0.22 35) 100%)',
                    color: 'oklch(0.10 0.01 30)',
                  }}
                >
                  {recordPayment.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Recording Payment...
                    </>
                  ) : (
                    <>
                      <Coins className="w-4 h-4" />
                      Record Payment (1 ICP)
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-4">
                  <div
                    className="p-4 rounded-forge flex items-center gap-3"
                    style={{
                      background: paymentRecord?.verified
                        ? 'oklch(0.65 0.18 145 / 0.1)'
                        : 'oklch(0.78 0.18 65 / 0.1)',
                      border: `1px solid ${paymentRecord?.verified ? 'oklch(0.65 0.18 145 / 0.4)' : 'oklch(0.78 0.18 65 / 0.4)'}`,
                    }}
                  >
                    {paymentLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'oklch(0.78 0.18 65)' }} />
                    ) : paymentRecord?.verified ? (
                      <CheckCircle className="w-4 h-4" style={{ color: 'oklch(0.65 0.18 145)' }} />
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'oklch(0.78 0.18 65)' }} />
                    )}
                    <div>
                      <p className="text-sm font-display font-bold tracking-wide" style={{ color: paymentRecord?.verified ? 'oklch(0.65 0.18 145)' : 'oklch(0.78 0.18 65)' }}>
                        {paymentRecord?.verified ? 'Payment Verified' : 'Awaiting Admin Verification'}
                      </p>
                      <p className="text-xs" style={{ color: 'oklch(0.50 0.025 45)' }}>
                        Payment ID: {paymentId.toString()}
                      </p>
                    </div>
                  </div>

                  {paymentRecord?.verified && (
                    <button
                      onClick={handleCreateToken}
                      disabled={createToken.isPending}
                      className="w-full py-3 rounded-forge font-display font-bold tracking-widest uppercase text-sm transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{
                        background: 'linear-gradient(135deg, oklch(0.72 0.20 42) 0%, oklch(0.65 0.22 35) 100%)',
                        color: 'oklch(0.10 0.01 30)',
                        boxShadow: '0 0 20px oklch(0.72 0.20 42 / 0.3)',
                      }}
                    >
                      {createToken.isPending ? (
                        <>
                          <img
                            src="/assets/generated/molten-spinner-transparent.dim_100x100.gif"
                            alt=""
                            className="w-5 h-5 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Forging Token...
                        </>
                      ) : (
                        <>
                          <Hammer className="w-4 h-4" />
                          Forge Token
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          {step < 4 && (
            <div className="flex items-center justify-between mt-8 pt-6" style={{ borderTop: '1px solid oklch(0.22 0.018 32)' }}>
              <button
                onClick={handleBack}
                disabled={step === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-forge font-display font-bold tracking-widest uppercase text-sm transition-all duration-200 disabled:opacity-30"
                style={{
                  background: 'transparent',
                  border: '1px solid oklch(0.28 0.025 38)',
                  color: 'oklch(0.55 0.03 50)',
                }}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              {step < 3 && (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-forge font-display font-bold tracking-widests uppercase text-sm transition-all duration-200"
                  style={{
                    background: 'linear-gradient(135deg, oklch(0.72 0.20 42) 0%, oklch(0.65 0.22 35) 100%)',
                    color: 'oklch(0.10 0.01 30)',
                  }}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
