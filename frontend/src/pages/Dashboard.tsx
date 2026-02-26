import React from 'react';
import {
  Hammer,
  Coins,
  TrendingUp,
  Users,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useGetAllTokens,
  useGetUserActivityMetrics,
  useGetGlobalPlatformStats,
  useGetCallerUserProfile,
} from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import type { TokenMetadata } from '../backend';

type View = 'home' | 'create' | 'dashboard' | 'forged' | 'lookup';

interface DashboardProps {
  onNavigate: (view: View) => void;
}

function formatSupply(n: bigint): string {
  const num = Number(n);
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toLocaleString();
}

function formatICP(e8s: bigint): string {
  return `${(Number(e8s) / 1e8).toFixed(4)} ICP`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'oklch(0.65 0.18 145)';
    case 'pending': return 'oklch(0.78 0.18 65)';
    case 'inactive': return 'oklch(0.55 0.03 50)';
    case 'archived': return 'oklch(0.55 0.22 25)';
    default: return 'oklch(0.55 0.03 50)';
  }
}

function TokenCard({ token, onNavigate }: { token: TokenMetadata; onNavigate: (view: View) => void }) {
  const statusStr = typeof token.status === 'object'
    ? Object.keys(token.status)[0]
    : String(token.status);

  return (
    <div
      className="p-5 rounded-forge transition-all duration-300 group cursor-pointer"
      style={{
        background: 'linear-gradient(135deg, oklch(0.16 0.015 30) 0%, oklch(0.14 0.012 28) 100%)',
        border: '1px solid oklch(0.25 0.02 35)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'oklch(0.72 0.20 42 / 0.5)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 20px oklch(0.72 0.20 42 / 0.1)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'oklch(0.25 0.02 35)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-display font-bold text-lg tracking-wide" style={{ color: 'oklch(0.85 0.02 55)' }}>
            {token.name}
          </h3>
          <span
            className="text-xs font-mono font-bold tracking-widest uppercase"
            style={{ color: 'oklch(0.72 0.20 42)' }}
          >
            ${token.symbol}
          </span>
        </div>
        <div
          className="px-2 py-0.5 rounded-sharp text-xs font-mono font-bold uppercase tracking-wide"
          style={{
            background: `${getStatusColor(statusStr)}20`,
            border: `1px solid ${getStatusColor(statusStr)}60`,
            color: getStatusColor(statusStr),
          }}
        >
          {statusStr}
        </div>
      </div>

      <p className="text-xs mb-4 line-clamp-2" style={{ color: 'oklch(0.50 0.025 45)' }}>
        {token.description || 'No description provided.'}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div
          className="p-2 rounded-sharp"
          style={{ background: 'oklch(0.12 0.01 25)' }}
        >
          <p className="text-xs" style={{ color: 'oklch(0.45 0.02 40)' }}>Supply</p>
          <p className="text-sm font-mono font-bold" style={{ color: 'oklch(0.78 0.18 65)' }}>
            {formatSupply(token.totalSupply)}
          </p>
        </div>
        <div
          className="p-2 rounded-sharp"
          style={{ background: 'oklch(0.12 0.01 25)' }}
        >
          <p className="text-xs" style={{ color: 'oklch(0.45 0.02 40)' }}>Buy/Sell Tax</p>
          <p className="text-sm font-mono font-bold" style={{ color: 'oklch(0.72 0.20 42)' }}>
            {Number(token.buyTax) / 100}% / {Number(token.sellTax) / 100}%
          </p>
        </div>
      </div>

      {token.mintFeePaid && (
        <div className="mt-3 flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" style={{ color: 'oklch(0.65 0.18 145)' }} />
          <span className="text-xs font-mono" style={{ color: 'oklch(0.65 0.18 145)' }}>
            Mint fee paid
          </span>
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { identity } = useInternetIdentity();
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: tokens, isLoading: tokensLoading, error: tokensError, refetch: refetchTokens } = useGetAllTokens();
  const { data: activityMetrics, isLoading: metricsLoading } = useGetUserActivityMetrics();
  const { data: globalStats, isLoading: statsLoading } = useGetGlobalPlatformStats();

  const displayName = userProfile?.name || identity?.getPrincipal().toString().slice(0, 12) + '...' || 'Forger';

  return (
    <div className="min-h-screen" style={{ background: 'oklch(0.12 0.01 30)' }}>
      {/* Header */}
      <div
        className="border-b px-4 sm:px-6 lg:px-8 py-8"
        style={{
          background: 'oklch(0.13 0.012 28)',
          borderColor: 'oklch(0.25 0.02 35)',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xs font-mono font-bold tracking-widest uppercase"
                  style={{ color: 'oklch(0.72 0.20 42)' }}
                >
                  Forge Dashboard
                </span>
              </div>
              <h1
                className="text-3xl font-mono font-black tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.82 0.16 80) 0%, oklch(0.72 0.20 42) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Welcome, {displayName}
              </h1>
            </div>
            <button
              onClick={() => onNavigate('create')}
              className="flex items-center gap-2 px-6 py-3 rounded-forge font-display font-bold tracking-widest uppercase text-sm transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, oklch(0.72 0.20 42) 0%, oklch(0.65 0.22 35) 100%)',
                color: 'oklch(0.10 0.01 30)',
                boxShadow: '0 0 16px oklch(0.72 0.20 42 / 0.3)',
              }}
            >
              <Hammer className="w-4 h-4" />
              Forge New Token
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* User Activity Metrics */}
        <div>
          <h2
            className="text-xs font-mono font-bold tracking-widest uppercase mb-4"
            style={{ color: 'oklch(0.72 0.20 42)' }}
          >
            Your Activity
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Tokens Forged',
                value: metricsLoading ? null : Number(activityMetrics?.tokensMinted ?? 0).toString(),
                icon: <Hammer className="w-5 h-5" />,
                color: 'oklch(0.72 0.20 42)',
              },
              {
                label: 'Treasury Configs',
                value: metricsLoading ? null : Number(activityMetrics?.treasuryConfigurations ?? 0).toString(),
                icon: <Coins className="w-5 h-5" />,
                color: 'oklch(0.78 0.18 65)',
              },
              {
                label: 'Total Fees Paid',
                value: metricsLoading ? null : formatICP(activityMetrics?.totalFeesPaid ?? 0n),
                icon: <TrendingUp className="w-5 h-5" />,
                color: 'oklch(0.65 0.18 145)',
              },
              {
                label: 'Deployments',
                value: metricsLoading ? null : (activityMetrics?.deploymentHistory?.length ?? 0).toString(),
                icon: <BarChart3 className="w-5 h-5" />,
                color: 'oklch(0.72 0.20 42)',
              },
            ].map((metric, i) => (
              <div
                key={i}
                className="p-5 rounded-forge"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.16 0.015 30) 0%, oklch(0.14 0.012 28) 100%)',
                  border: '1px solid oklch(0.25 0.02 35)',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-sharp flex items-center justify-center"
                    style={{
                      background: `${metric.color}15`,
                      border: `1px solid ${metric.color}40`,
                      color: metric.color,
                    }}
                  >
                    {metric.icon}
                  </div>
                </div>
                {metric.value === null ? (
                  <Skeleton className="h-7 w-16 mb-1" style={{ background: 'oklch(0.20 0.02 30)' }} />
                ) : (
                  <p className="text-2xl font-mono font-black" style={{ color: metric.color }}>
                    {metric.value}
                  </p>
                )}
                <p className="text-xs font-display font-semibold tracking-wide uppercase mt-1" style={{ color: 'oklch(0.45 0.02 40)' }}>
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Global Platform Stats */}
        <div>
          <h2
            className="text-xs font-mono font-bold tracking-widest uppercase mb-4"
            style={{ color: 'oklch(0.72 0.20 42)' }}
          >
            Platform Statistics
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Total Tokens',
                value: statsLoading ? null : Number(globalStats?.totalTokensCreated ?? 0).toString(),
                icon: <Coins className="w-4 h-4" />,
              },
              {
                label: 'Total Supply',
                value: statsLoading ? null : formatSupply(globalStats?.totalSupplyAcrossTokens ?? 0n),
                icon: <TrendingUp className="w-4 h-4" />,
              },
              {
                label: 'Treasury Fees',
                value: statsLoading ? null : formatICP(globalStats?.platformTreasuryFees ?? 0n),
                icon: <BarChart3 className="w-4 h-4" />,
              },
              {
                label: 'Total Users',
                value: statsLoading ? null : Number(globalStats?.totalUsers ?? 0).toString(),
                icon: <Users className="w-4 h-4" />,
              },
            ].map((stat, i) => (
              <div
                key={i}
                className="p-4 rounded-forge"
                style={{
                  background: 'oklch(0.14 0.012 28)',
                  border: '1px solid oklch(0.22 0.018 32)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ color: 'oklch(0.55 0.03 50)' }}>{stat.icon}</span>
                  <span className="text-xs font-display font-semibold tracking-wide uppercase" style={{ color: 'oklch(0.45 0.02 40)' }}>
                    {stat.label}
                  </span>
                </div>
                {stat.value === null ? (
                  <Skeleton className="h-6 w-20" style={{ background: 'oklch(0.20 0.02 30)' }} />
                ) : (
                  <p className="text-xl font-mono font-bold" style={{ color: 'oklch(0.78 0.18 65)' }}>
                    {stat.value}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Token List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-xs font-mono font-bold tracking-widest uppercase"
              style={{ color: 'oklch(0.72 0.20 42)' }}
            >
              Your Forged Tokens
            </h2>
            <button
              onClick={() => refetchTokens()}
              className="flex items-center gap-1.5 text-xs font-display font-semibold tracking-wide uppercase transition-colors duration-200"
              style={{ color: 'oklch(0.55 0.03 50)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'oklch(0.72 0.20 42)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'oklch(0.55 0.03 50)'; }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {tokensLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 rounded-forge" style={{ background: 'oklch(0.16 0.015 30)' }} />
              ))}
            </div>
          ) : tokensError ? (
            <div
              className="p-6 rounded-forge flex items-center gap-3"
              style={{
                background: 'oklch(0.55 0.22 25 / 0.1)',
                border: '1px solid oklch(0.55 0.22 25 / 0.3)',
              }}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'oklch(0.65 0.22 25)' }} />
              <p className="text-sm" style={{ color: 'oklch(0.65 0.22 25)' }}>
                Failed to load tokens. Please try refreshing.
              </p>
            </div>
          ) : !tokens || tokens.length === 0 ? (
            <div
              className="p-12 rounded-forge text-center"
              style={{
                background: 'linear-gradient(135deg, oklch(0.16 0.015 30) 0%, oklch(0.14 0.012 28) 100%)',
                border: '1px solid oklch(0.25 0.02 35)',
              }}
            >
              <Hammer className="w-12 h-12 mx-auto mb-4 opacity-30" style={{ color: 'oklch(0.72 0.20 42)' }} />
              <p className="font-display font-bold text-lg tracking-wide mb-2" style={{ color: 'oklch(0.55 0.03 50)' }}>
                No tokens forged yet
              </p>
              <p className="text-sm mb-6" style={{ color: 'oklch(0.40 0.02 40)' }}>
                Create your first ICP token to get started
              </p>
              <button
                onClick={() => onNavigate('create')}
                className="px-6 py-2.5 rounded-forge font-display font-bold tracking-widest uppercase text-sm transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.72 0.20 42) 0%, oklch(0.65 0.22 35) 100%)',
                  color: 'oklch(0.10 0.01 30)',
                }}
              >
                Forge First Token
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tokens.map((token, i) => (
                <TokenCard key={i} token={token} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
