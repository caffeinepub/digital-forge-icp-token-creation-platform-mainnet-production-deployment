import React, { useState } from 'react';
import { Coffee, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useGetBuyMeACoffeeAddress } from '../hooks/useQueries';

export default function BuyMeACoffee() {
  const { data: address } = useGetBuyMeACoffeeAddress();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-display font-semibold tracking-wide uppercase transition-colors duration-200"
        style={{ color: 'oklch(0.72 0.20 42)' }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'oklch(0.78 0.18 65)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'oklch(0.72 0.20 42)';
        }}
      >
        <Coffee className="w-4 h-4" />
        Support the Forge
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && address && (
        <div
          className="rounded-forge p-3 space-y-2"
          style={{
            background: 'oklch(0.14 0.012 28)',
            border: '1px solid oklch(0.28 0.025 38)',
          }}
        >
          <p className="text-xs" style={{ color: 'oklch(0.55 0.03 50)' }}>
            Send ICP to the treasury:
          </p>
          <div className="flex items-center gap-2">
            <code
              className="text-xs font-mono flex-1 truncate"
              style={{ color: 'oklch(0.72 0.20 42)' }}
            >
              {address}
            </code>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-forge transition-all duration-200 flex-shrink-0"
              style={{
                background: copied ? 'oklch(0.65 0.18 145 / 0.15)' : 'oklch(0.20 0.02 30)',
                border: `1px solid ${copied ? 'oklch(0.65 0.18 145 / 0.5)' : 'oklch(0.28 0.025 38)'}`,
                color: copied ? 'oklch(0.65 0.18 145)' : 'oklch(0.55 0.03 50)',
              }}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
