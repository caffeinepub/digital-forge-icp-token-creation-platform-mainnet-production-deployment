import { useState } from 'react';
import { Search, Flame, ArrowLeft, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useGetForgedTokens } from '../hooks/useQueries';
import { TokenMetadata } from '../backend';

type View = 'home' | 'create' | 'dashboard' | 'forged' | 'lookup';

interface ForgedTokensProps {
  onNavigate: (view: View) => void;
}

function TokenCard({ token }: { token: TokenMetadata }) {
  const formatTax = (bps: bigint) => `${(Number(bps) / 100).toFixed(2)}%`;
  const formatSupply = (supply: bigint, decimals: bigint) => {
    const divisor = Math.pow(10, Number(decimals));
    const num = Number(supply) / divisor;
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toLocaleString();
  };
  const formatDate = (ts: bigint) => new Date(Number(ts) / 1_000_000).toLocaleDateString();

  const canisterIdStr = token.canisterId?.toString() || '';

  return (
    <Card className="bg-card/50 border-border/40 backdrop-blur-sm hover:border-primary/40 transition-all duration-300 group overflow-hidden">
      <div className="h-0.5 w-full forge-gradient-bar opacity-60 group-hover:opacity-100 transition-opacity" />
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start gap-3 mb-4">
          {token.mediaUrl ? (
            <img
              src={token.mediaUrl}
              alt={token.name}
              className="w-12 h-12 rounded-lg object-cover border border-border/40 shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 text-primary/60" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-foreground truncate">{token.name}</h3>
              <Badge variant="outline" className="font-mono text-xs shrink-0">{token.symbol}</Badge>
              {token.verified && (
                <Badge variant="secondary" className="text-xs shrink-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  Verified
                </Badge>
              )}
            </div>
            {token.description && (
              <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{token.description}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs mb-4">
          <div className="bg-background/40 rounded-lg p-2.5 border border-border/20">
            <p className="text-muted-foreground mb-0.5">Total Supply</p>
            <p className="font-mono font-semibold text-foreground">{formatSupply(token.totalSupply, token.decimals)}</p>
          </div>
          <div className="bg-background/40 rounded-lg p-2.5 border border-border/20">
            <p className="text-muted-foreground mb-0.5">Buy / Sell Tax</p>
            <p className="font-mono font-semibold">
              <span className="text-emerald-400">{formatTax(token.totalBuyTax)}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-rose-400">{formatTax(token.totalSellTax)}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {token.taxModules?.treasury && <Badge variant="secondary" className="text-xs">Treasury</Badge>}
          {token.taxModules?.burn && <Badge variant="secondary" className="text-xs">Burn</Badge>}
          {token.taxModules?.reflection && <Badge variant="secondary" className="text-xs">Reflection</Badge>}
          {token.taxModules?.liquidity && <Badge variant="secondary" className="text-xs">Liquidity</Badge>}
          {token.taxModules?.yield && <Badge variant="secondary" className="text-xs">Yield</Badge>}
          {token.taxModules?.support && <Badge variant="secondary" className="text-xs">Support</Badge>}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Deployed {formatDate(token.deployedAt)}</span>
          <div className="flex items-center gap-2">
            {token.creatorName && <span className="truncate max-w-[100px]">by {token.creatorName}</span>}
            {token.chartUrl && (
              <a
                href={token.chartUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {canisterIdStr && (
          <div className="mt-3 pt-3 border-t border-border/20">
            <p className="text-xs text-muted-foreground font-mono truncate">{canisterIdStr}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ForgedTokens({ onNavigate }: ForgedTokensProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data, isLoading, isError, error, refetch, isFetching } = useGetForgedTokens();

  // Defensive: always work with an array
  const tokens: TokenMetadata[] = Array.isArray(data) ? data : [];

  const filteredTokens = tokens.filter((token) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      token.name?.toLowerCase().includes(q) ||
      token.symbol?.toLowerCase().includes(q) ||
      token.description?.toLowerCase().includes(q) ||
      token.tags?.some((tag) => tag.toLowerCase().includes(q)) ||
      token.creatorName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold forge-text-gradient mb-2">Forged Tokens</h1>
              <p className="text-muted-foreground">
                Community-deployed tokens on the Digital Forge.
                {!isLoading && !isError && (
                  <span className="ml-2 text-primary font-medium">{tokens.length} token{tokens.length !== 1 ? 's' : ''} forged</span>
                )}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="border-border/60 hover:border-primary/40"
            >
              {isFetching ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="relative mb-8 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, symbol, or tag..."
            className="pl-10 bg-card/50 border-border/60 focus:border-primary/60"
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading forged tokens...</p>
          </div>
        )}

        {/* Error State */}
        {isError && !isLoading && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center mx-auto mb-4">
              <Flame className="w-7 h-7 text-destructive/60" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Failed to Load Tokens</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {(error as any)?.message || 'An error occurred while loading tokens.'}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && tokens.length === 0 && (
          <div className="text-center py-24">
            <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
              <Flame className="w-9 h-9 text-primary/40" />
            </div>
            <h3 className="text-xl font-semibold mb-3">No Tokens Forged Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Be the first to forge a token on the Digital Forge. Connect your wallet and start creating.
            </p>
            <Button onClick={() => onNavigate('create')} className="forge-button-primary">
              <Flame className="w-4 h-4 mr-2" />
              Forge the First Token
            </Button>
          </div>
        )}

        {/* No Search Results */}
        {!isLoading && !isError && tokens.length > 0 && filteredTokens.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-10 h-10 mx-auto mb-4 text-muted-foreground opacity-40" />
            <h3 className="text-lg font-semibold mb-2">No Tokens Match</h3>
            <p className="text-muted-foreground text-sm">Try a different search term.</p>
          </div>
        )}

        {/* Token Grid */}
        {!isLoading && !isError && filteredTokens.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTokens.map((token, index) => (
              <TokenCard key={`${token.symbol}-${index}`} token={token} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
