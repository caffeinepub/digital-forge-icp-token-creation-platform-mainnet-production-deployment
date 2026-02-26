import { useState } from 'react';
import { Search, Copy, ExternalLink, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useActor } from '../hooks/useActor';
import { TokenMetadata } from '../backend';

type View = 'home' | 'create' | 'dashboard' | 'forged' | 'lookup';

interface TokenLookupProps {
  onNavigate: (view: View) => void;
}

export default function TokenLookup({ onNavigate }: TokenLookupProps) {
  const { actor } = useActor();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<TokenMetadata | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    if (!actor) {
      setSearchError('Actor not ready. Please wait a moment and try again.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const result = await actor.lookupToken(searchQuery.trim());
      if (result) {
        setSearchResult(result);
      } else {
        setSearchError('No token found with that canister ID. Make sure the token is active and listed in the community explorer.');
      }
    } catch (err: any) {
      setSearchError(err?.message || 'An error occurred while searching. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore
    }
  };

  const formatTax = (bps: bigint) => `${(Number(bps) / 100).toFixed(2)}%`;
  const formatSupply = (supply: bigint, decimals: bigint) => {
    const divisor = Math.pow(10, Number(decimals));
    return (Number(supply) / divisor).toLocaleString();
  };
  const formatDate = (ts: bigint) => new Date(Number(ts) / 1_000_000).toLocaleDateString();

  const getStatusColor = (status: any) => {
    if (status?.__kind__ === 'active' || status === 'active') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (status?.__kind__ === 'pending' || status === 'pending') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const getStatusLabel = (status: any) => {
    if (status?.__kind__ === 'active' || status === 'active') return 'Active';
    if (status?.__kind__ === 'pending' || status === 'pending') return 'Pending';
    if (status?.__kind__ === 'inactive' || status === 'inactive') return 'Inactive';
    return 'Unknown';
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
          <h1 className="text-3xl font-bold forge-text-gradient mb-2">Token Lookup</h1>
          <p className="text-muted-foreground">Search for any token deployed on the Digital Forge by its canister ID.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Search Bar */}
        <Card className="bg-card/50 border-border/40 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="xxxxx-xxxxx-xxxxx-xxxxx-cai"
                  className="pl-10 bg-background/50 border-border/60 focus:border-primary/60 font-mono text-sm"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="forge-button-primary px-6"
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Search'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Enter a canister ID to look up token details. Only tokens listed in the community explorer are searchable.
            </p>
          </CardContent>
        </Card>

        {/* Error State */}
        {searchError && (
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Token Not Found</p>
                  <p className="text-sm text-muted-foreground mt-1">{searchError}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Token Result */}
        {searchResult && (
          <div className="space-y-4">
            {/* Token Header */}
            <Card className="bg-card/50 border-border/40 backdrop-blur-sm overflow-hidden">
              <div className="h-1 w-full forge-gradient-bar" />
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  {searchResult.mediaUrl && (
                    <img
                      src={searchResult.mediaUrl}
                      alt={searchResult.name}
                      className="w-16 h-16 rounded-lg object-cover border border-border/40"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-2xl font-bold text-foreground">{searchResult.name}</h2>
                      <Badge variant="outline" className="font-mono text-xs">{searchResult.symbol}</Badge>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getStatusColor(searchResult.status)}`}>
                        {getStatusLabel(searchResult.status)}
                      </span>
                      {searchResult.verified && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle className="w-3 h-3" /> Verified
                        </span>
                      )}
                    </div>
                    {searchResult.description && (
                      <p className="text-muted-foreground text-sm mt-2 line-clamp-3">{searchResult.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {searchResult.tags?.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* General Info */}
            <Card className="bg-card/50 border-border/40 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-base">General Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Total Supply</p>
                  <p className="font-mono font-medium">{formatSupply(searchResult.totalSupply, searchResult.decimals)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Decimals</p>
                  <p className="font-mono font-medium">{Number(searchResult.decimals)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Circulating Supply</p>
                  <p className="font-mono font-medium">{formatSupply(searchResult.circulatingSupply, searchResult.decimals)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Created</p>
                  <p className="font-medium">{formatDate(searchResult.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Version</p>
                  <p className="font-mono font-medium">v{Number(searchResult.version)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">AI Agent Compatible</p>
                  <p className="font-medium">{searchResult.aiAgentCompatible ? 'Yes' : 'No'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Tax Configuration */}
            <Card className="bg-card/50 border-border/40 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-base">Tax Configuration</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Buy Tax</p>
                  <p className="font-mono font-medium text-emerald-400">{formatTax(searchResult.totalBuyTax)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Sell Tax</p>
                  <p className="font-mono font-medium text-rose-400">{formatTax(searchResult.totalSellTax)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Treasury Fee</p>
                  <p className="font-mono font-medium">{formatTax(searchResult.fixedTreasuryFee)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Liquidity Burn</p>
                  <p className="font-mono font-medium text-xs truncate">{searchResult.liquidityBurnAddress}</p>
                </div>
              </CardContent>
            </Card>

            {/* Module Details */}
            {searchResult.moduleConfigs && searchResult.moduleConfigs.length > 0 && (
              <Card className="bg-card/50 border-border/40 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-base">Tax Modules ({searchResult.moduleConfigs.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {searchResult.moduleConfigs.map((mod, i) => {
                    const modType = (mod.moduleType as any)?.__kind__ || mod.moduleType;
                    return (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-border/30">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="capitalize text-xs">{modType}</Badge>
                          {mod.unified && <span className="text-xs text-muted-foreground">Unified</span>}
                          {mod.split && <span className="text-xs text-muted-foreground">Split</span>}
                        </div>
                        <div className="flex gap-4 text-xs font-mono">
                          <span className="text-emerald-400">Buy: {formatTax(mod.buyTax)}</span>
                          <span className="text-rose-400">Sell: {formatTax(mod.sellTax)}</span>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Creator Information */}
            <Card className="bg-card/50 border-border/40 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-base">Creator Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {searchResult.creatorName && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Creator Name</p>
                    <p className="font-medium">{searchResult.creatorName}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Creator Principal</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xs truncate flex-1">{searchResult.creator?.toString()}</p>
                    <button
                      onClick={() => copyToClipboard(searchResult.creator?.toString() || '', 'creator')}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      {copiedField === 'creator' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Canister ID</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xs truncate flex-1">{searchResult.canisterId?.toString()}</p>
                    <button
                      onClick={() => copyToClipboard(searchResult.canisterId?.toString() || '', 'canisterId')}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      {copiedField === 'canisterId' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                {searchResult.developerWalletWhitelisted && (
                  <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30">Developer Wallet</Badge>
                )}
              </CardContent>
            </Card>

            {/* External Links */}
            {(searchResult.chartUrl || searchResult.creatorProfileUrl) && (
              <Card className="bg-card/50 border-border/40 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-base">External Resources</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  {searchResult.chartUrl && (
                    <a
                      href={searchResult.chartUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Chart
                    </a>
                  )}
                  {searchResult.creatorProfileUrl && (
                    <a
                      href={searchResult.creatorProfileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Creator Profile
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Empty State */}
        {!searchResult && !searchError && !isSearching && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">Search for a Token</p>
            <p className="text-sm">Enter a canister ID above to look up token details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
