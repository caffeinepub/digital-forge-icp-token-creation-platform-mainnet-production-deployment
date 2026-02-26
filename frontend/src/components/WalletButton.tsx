import React, { useState } from 'react';
import { Wallet, ChevronDown, Copy, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function WalletButton() {
  const { connected, detected, detecting, address, connectPlug, disconnect, reconnectWallet } = useWallet();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  if (detecting) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-forge text-xs font-display font-semibold tracking-wide uppercase"
        style={{
          background: 'oklch(0.20 0.02 30)',
          border: '1px solid oklch(0.28 0.025 38)',
          color: 'oklch(0.55 0.03 50)',
        }}
      >
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: 'oklch(0.78 0.18 65)' }}
        />
        Detecting...
      </div>
    );
  }

  if (!detected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href="https://plugwallet.ooo/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-forge text-xs font-display font-semibold tracking-wide uppercase transition-all duration-200"
              style={{
                background: 'oklch(0.20 0.02 30)',
                border: '1px solid oklch(0.28 0.025 38)',
                color: 'oklch(0.55 0.03 50)',
              }}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Install Plug
              <ExternalLink className="w-3 h-3" />
            </a>
          </TooltipTrigger>
          <TooltipContent
            style={{
              background: 'oklch(0.16 0.015 30)',
              border: '1px solid oklch(0.28 0.025 38)',
              color: 'oklch(0.88 0.02 60)',
            }}
          >
            Install Plug Wallet to connect
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!connected) {
    return (
      <button
        onClick={connectPlug}
        className="flex items-center gap-2 px-3 py-2 rounded-forge text-xs font-display font-semibold tracking-wide uppercase transition-all duration-200"
        style={{
          background: 'oklch(0.20 0.02 30)',
          border: '1px solid oklch(0.72 0.20 42 / 0.4)',
          color: 'oklch(0.72 0.20 42)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'oklch(0.72 0.20 42 / 0.1)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'oklch(0.72 0.20 42)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'oklch(0.20 0.02 30)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'oklch(0.72 0.20 42 / 0.4)';
        }}
      >
        <Wallet className="w-3.5 h-3.5" />
        Connect Wallet
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-forge text-xs font-display font-semibold tracking-wide uppercase transition-all duration-200"
          style={{
            background: 'oklch(0.72 0.20 42 / 0.12)',
            border: '1px solid oklch(0.72 0.20 42 / 0.5)',
            color: 'oklch(0.78 0.18 65)',
          }}
        >
          <div
            className="w-2 h-2 rounded-full forge-pulse"
            style={{ background: 'oklch(0.65 0.18 145)' }}
          />
          {shortAddress}
          <ChevronDown className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52"
        style={{
          background: 'oklch(0.15 0.012 28)',
          border: '1px solid oklch(0.28 0.025 38)',
        }}
      >
        <div className="px-3 py-2">
          <p className="text-xs font-mono" style={{ color: 'oklch(0.55 0.03 50)' }}>
            Plug Wallet
          </p>
          <p className="text-xs font-mono mt-0.5 truncate" style={{ color: 'oklch(0.72 0.20 42)' }}>
            {address}
          </p>
        </div>
        <DropdownMenuSeparator style={{ background: 'oklch(0.25 0.02 35)' }} />
        <DropdownMenuItem
          onClick={handleCopy}
          className="cursor-pointer text-xs font-display font-semibold tracking-wide uppercase"
          style={{ color: 'oklch(0.60 0.025 50)' }}
        >
          <Copy className="w-3.5 h-3.5 mr-2" />
          {copied ? 'Copied!' : 'Copy Address'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={reconnectWallet}
          className="cursor-pointer text-xs font-display font-semibold tracking-wide uppercase"
          style={{ color: 'oklch(0.60 0.025 50)' }}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-2" />
          Reconnect
        </DropdownMenuItem>
        <DropdownMenuSeparator style={{ background: 'oklch(0.25 0.02 35)' }} />
        <DropdownMenuItem
          onClick={disconnect}
          className="cursor-pointer text-xs font-display font-semibold tracking-wide uppercase"
          style={{ color: 'oklch(0.65 0.22 25)' }}
        >
          <Wallet className="w-3.5 h-3.5 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
