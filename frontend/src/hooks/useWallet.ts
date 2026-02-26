import { useState, useEffect, useCallback, useRef } from 'react';
import { Principal } from '@icp-sdk/core/principal';
import { Actor, HttpAgent } from '@dfinity/agent';
import type { backendInterface, TokenConfig } from '../backend';
import { toast } from 'sonner';

export interface WalletState {
  connected: boolean;
  connecting: boolean;
  address: string | null;
  principal: Principal | null;
  walletType: 'plug' | null;
  detecting: boolean;
  detected: boolean;
  waitingForConfirmation: boolean;
}

export interface TransferParams {
  to: string;
  amount: bigint;
  memo?: bigint;
}

export interface TransferResult {
  success: boolean;
  blockHeight?: bigint;
  error?: string;
}

declare global {
  interface Window {
    ic?: {
      plug?: {
        isConnected: () => Promise<boolean>;
        requestConnect: (params?: { whitelist?: string[]; host?: string }) => Promise<boolean>;
        disconnect: () => Promise<void>;
        getPrincipal: () => Promise<Principal>;
        requestBalance: () => Promise<Array<{ amount: number; canisterId: string; decimals: number; name: string; symbol: string }>>;
        requestTransfer: (params: {
          to: string;
          amount: number;
          opts?: { fee?: number; memo?: bigint; from_subaccount?: number; created_at_time?: bigint };
        }) => Promise<{ height: bigint }>;
        sessionManager?: {
          sessionData?: any;
        };
        agent: any;
        createActor: (canisterId: string) => Promise<any>;
      };
    };
    plug?: {
      isConnected: () => Promise<boolean>;
      requestConnect: (params?: { whitelist?: string[]; host?: string }) => Promise<boolean>;
      disconnect: () => Promise<void>;
      getPrincipal: () => Promise<Principal>;
      requestBalance: () => Promise<Array<{ amount: number; canisterId: string; decimals: number; name: string; symbol: string }>>;
      requestTransfer: (params: {
        to: string;
        amount: number;
        opts?: { fee?: number; memo?: bigint; from_subaccount?: number; created_at_time?: bigint };
      }) => Promise<{ height: bigint }>;
      sessionManager?: {
        sessionData?: any;
      };
      agent: any;
      createActor: (canisterId: string) => Promise<any>;
    };
    __plugWalletState?: {
      detected: boolean;
      detectionStartTime: number;
      detectionAttempts: number;
      intervalId: number | null;
    };
  }
}

const ICP_LEDGER_CANISTER_ID = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
const DEFAULT_HOST = 'https://icp0.io';
const SESSION_STORAGE_KEY = 'plug_wallet_connected';
const LAST_PRINCIPAL_KEY = 'plug_wallet_last_principal';
const CONNECTION_TIMEOUT = 30000; // 30 seconds
const DETECTION_TIMEOUT = 30000; // 30 seconds for detection
const WALLET_APPROVAL_TIMEOUT = 60000; // 60 seconds for wallet approval

// Helper function to wrap promises with timeout
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

export function useWallet() {
  const [walletState, setWalletState] = useState<WalletState>({
    connected: false,
    connecting: false,
    address: null,
    principal: null,
    walletType: null,
    detecting: true,
    detected: false,
    waitingForConfirmation: false,
  });

  const [actor, setActor] = useState<backendInterface | null>(null);

  const hasAttemptedAutoReconnect = useRef(false);
  const mountedRef = useRef(true);
  const detectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingTransferRef = useRef<{
    resolve: (result: TransferResult) => void;
    reject: (error: any) => void;
  } | null>(null);

  const logDebug = useCallback((message: string, data?: any) => {
    console.log(`🔌 [Plug Wallet] ${message}`, data || '');
  }, []);

  // Safe Plug detection with Brave browser compatibility
  const getPlugInstance = useCallback(() => {
    try {
      if (window.ic?.plug) {
        return window.ic.plug;
      }
    } catch (error) {
      // Brave may block access, continue to fallback
    }

    try {
      if (window.plug) {
        return window.plug;
      }
    } catch (error) {
      // Silently handle errors
    }

    return null;
  }, []);

  const hasExistingSession = useCallback((): boolean => {
    const plug = getPlugInstance();
    if (!plug) return false;
    
    try {
      if (plug.sessionManager?.sessionData) {
        logDebug('Session found in sessionManager');
        return true;
      }
    } catch (error) {
      // Ignore errors
    }
    
    const cachedConnection = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const lastPrincipal = localStorage.getItem(LAST_PRINCIPAL_KEY);
    
    if (cachedConnection === 'true' || lastPrincipal) {
      logDebug('Session found in storage', { cachedConnection, lastPrincipal: !!lastPrincipal });
      return true;
    }
    
    return false;
  }, [getPlugInstance, logDebug]);

  const saveConnectionState = useCallback((connected: boolean, principal?: Principal) => {
    if (connected) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
      if (principal) {
        localStorage.setItem(LAST_PRINCIPAL_KEY, principal.toString());
        logDebug('💾 Connection state saved', { principal: principal.toString() });
      }
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(LAST_PRINCIPAL_KEY);
      logDebug('🗑️ Connection state cleared');
    }
  }, [logDebug]);

  // Create Actor using Plug's createActor method
  const createActor = useCallback(async (): Promise<backendInterface | null> => {
    try {
      const plug = getPlugInstance();
      if (!plug) {
        logDebug('❌ Cannot create actor: Plug not available');
        return null;
      }

      const backendCanisterId = import.meta.env.VITE_CANISTER_ID_BACKEND;
      if (!backendCanisterId) {
        logDebug('❌ Cannot create actor: VITE_CANISTER_ID_BACKEND not defined');
        toast.error('Backend canister ID not configured');
        return null;
      }

      logDebug('🔨 Creating actor with Plug createActor', { backendCanisterId });

      // Use Plug's built-in createActor method which handles the IDL factory internally
      const newActor = await plug.createActor(backendCanisterId) as backendInterface;

      logDebug('✅ Actor created successfully');
      return newActor;
    } catch (error: any) {
      logDebug('❌ Actor creation error', error);
      toast.error('Failed to create backend actor', {
        description: error?.message || 'Unknown error',
      });
      return null;
    }
  }, [getPlugInstance, logDebug]);

  // Check if Plug is connected before backend operations
  const ensureConnected = useCallback(async (): Promise<boolean> => {
    const plug = getPlugInstance();
    if (!plug) {
      logDebug('❌ Plug not available');
      toast.error('Wallet not accessible', {
        description: 'Please reconnect your wallet.',
      });
      return false;
    }

    try {
      const isConnected = await plug.isConnected();
      if (!isConnected) {
        logDebug('⚠️ Plug not connected - triggering reconnect');
        toast.warning('Wallet disconnected', {
          description: 'Attempting to reconnect...',
        });
        
        // Attempt automatic reconnection
        const reconnected = await reconnectWallet();
        return reconnected;
      }
      return true;
    } catch (error: any) {
      logDebug('❌ Connection check failed', error);
      toast.error('Connection check failed', {
        description: 'Please reconnect your wallet.',
      });
      return false;
    }
  }, [getPlugInstance, logDebug]);

  // Reconnect wallet function - attempts to restore or rebuild the Plug actor
  const reconnectWallet = useCallback(async (): Promise<boolean> => {
    logDebug('🔄 Manual reconnect triggered');
    
    try {
      const plug = getPlugInstance();
      if (!plug) {
        logDebug('❌ Reconnect failed: Plug not available');
        toast.error('Plug wallet not accessible', {
          description: 'Please refresh the page and try again.',
        });
        
        // Clear state and prompt reconnection
        setWalletState({
          connected: false,
          connecting: false,
          address: null,
          principal: null,
          walletType: null,
          detecting: false,
          detected: false,
          waitingForConfirmation: false,
        });
        setActor(null);
        saveConnectionState(false);
        return false;
      }

      const isConnected = await plug.isConnected();
      logDebug('🔍 Reconnect: Current connection status', { isConnected });
      
      if (isConnected) {
        // Session is still valid - rebuild actor
        const principal = await plug.getPrincipal();
        const address = principal.toString();

        // Rebuild actor
        const newActor = await createActor();

        setWalletState({
          connected: true,
          connecting: false,
          address,
          principal,
          walletType: 'plug',
          detecting: false,
          detected: true,
          waitingForConfirmation: false,
        });

        setActor(newActor);
        saveConnectionState(true, principal);
        
        logDebug('✅ Reconnect successful - actor rebuilt', { address });
        
        toast.success('Wallet reconnected successfully!', {
          description: 'Your session has been restored.',
        });
        return true;
      } else {
        // Session expired - clear state and prompt reconnection
        logDebug('⚠️ Session expired - clearing state');
        
        setWalletState({
          connected: false,
          connecting: false,
          address: null,
          principal: null,
          walletType: null,
          detecting: false,
          detected: true,
          waitingForConfirmation: false,
        });
        setActor(null);
        saveConnectionState(false);
        
        toast.info('Session expired', {
          description: 'Please connect your wallet again.',
        });
        return false;
      }
    } catch (error: any) {
      logDebug('❌ Reconnect error', error);
      
      // Clear state on error
      setWalletState({
        connected: false,
        connecting: false,
        address: null,
        principal: null,
        walletType: null,
        detecting: false,
        detected: true,
        waitingForConfirmation: false,
      });
      setActor(null);
      saveConnectionState(false);
      
      toast.error('Failed to reconnect wallet', {
        description: 'Please try connecting manually.',
      });
      return false;
    }
  }, [getPlugInstance, createActor, saveConnectionState, logDebug]);

  // Backend function wrappers with connection checks
  const recordPayment = useCallback(
    async (amount: bigint, treasuryAddress: string): Promise<bigint> => {
      // Check connection before operation
      const connected = await ensureConnected();
      if (!connected) {
        throw new Error('Wallet not connected - please reconnect');
      }

      if (!actor) {
        throw new Error('Actor not available - please reconnect wallet');
      }

      try {
        logDebug('💰 Recording payment', { amount: amount.toString(), treasuryAddress });
        const result = await actor.recordPayment(amount, treasuryAddress);

        if ('error' in result) {
          logDebug('❌ Payment recording failed', result.error);
          throw new Error(result.error.message);
        }

        logDebug('✅ Payment recorded', { paymentId: result.success.paymentId.toString() });
        return result.success.paymentId;
      } catch (error: any) {
        logDebug('❌ recordPayment error', error);
        
        // Handle transaction failures
        if (error?.message?.includes('rejected') || error?.message?.includes('cancelled')) {
          toast.error('Payment recording cancelled', {
            description: 'You cancelled the operation. Please try again when ready.',
          });
          // Trigger reconnect on rejection
          await reconnectWallet();
        } else if (error?.message?.includes('insufficient')) {
          toast.error('Insufficient balance', {
            description: 'Please add funds to your wallet and try again.',
          });
        }
        
        throw new Error(error?.message || 'Failed to record payment');
      }
    },
    [actor, ensureConnected, reconnectWallet, logDebug]
  );

  const createToken = useCallback(
    async (config: TokenConfig): Promise<{ message: string; canisterId: string }> => {
      // Check connection before operation
      const connected = await ensureConnected();
      if (!connected) {
        throw new Error('Wallet not connected - please reconnect');
      }

      if (!actor) {
        throw new Error('Actor not available - please reconnect wallet');
      }

      try {
        logDebug('🪙 Creating token', { symbol: config.symbol });
        const result = await actor.createToken(config);

        if ('error' in result) {
          logDebug('❌ Token creation failed', result.error);
          throw new Error(result.error.message);
        }

        logDebug('✅ Token created', { canisterId: result.success.canisterId });
        return {
          message: result.success.message,
          canisterId: result.success.canisterId,
        };
      } catch (error: any) {
        logDebug('❌ createToken error', error);
        
        // Handle transaction failures
        if (error?.message?.includes('rejected') || error?.message?.includes('cancelled')) {
          toast.error('Token creation cancelled', {
            description: 'You cancelled the operation. Your form data is preserved.',
          });
          // Trigger reconnect on rejection
          await reconnectWallet();
        } else if (error?.message?.includes('insufficient')) {
          toast.error('Insufficient balance', {
            description: 'Please add funds to your wallet and try again.',
          });
        }
        
        throw new Error(error?.message || 'Failed to create token');
      }
    },
    [actor, ensureConnected, reconnectWallet, logDebug]
  );

  const initializeAccessControl = useCallback(async (): Promise<void> => {
    // Check connection before operation
    const connected = await ensureConnected();
    if (!connected) {
      throw new Error('Wallet not connected - please reconnect');
    }

    if (!actor) {
      throw new Error('Actor not available - please reconnect wallet');
    }

    try {
      logDebug('🔐 Initializing access control');
      await actor.initializeAccessControl();
      logDebug('✅ Access control initialized');
    } catch (error: any) {
      logDebug('❌ initializeAccessControl error', error);
      throw new Error(error?.message || 'Failed to initialize access control');
    }
  }, [actor, ensureConnected, logDebug]);

  // Immediate detection on mount
  const detectPlugWallet = useCallback((): boolean => {
    // Check global state first
    if (typeof window !== 'undefined' && window.__plugWalletState?.detected) {
      return true;
    }

    // Direct detection
    const plug = getPlugInstance();
    return !!plug;
  }, [getPlugInstance]);

  // Auto-revalidate wallet session before operations
  const revalidateSession = useCallback(async (): Promise<boolean> => {
    logDebug('🔄 Revalidating wallet session...');
    
    try {
      const plug = getPlugInstance();
      if (!plug) {
        logDebug('❌ Revalidation failed: Plug not available');
        return false;
      }

      const isConnected = await plug.isConnected();
      logDebug('🔍 Revalidation check', { isConnected });
      
      if (isConnected) {
        const principal = await plug.getPrincipal();
        const address = principal.toString();

        // Create actor after successful revalidation
        const newActor = await createActor();

        setWalletState((prev) => ({
          ...prev,
          connected: true,
          address,
          principal,
          walletType: 'plug',
        }));

        setActor(newActor);
        saveConnectionState(true, principal);
        
        logDebug('✅ Session revalidated successfully', { address });
        return true;
      } else {
        logDebug('⚠️ Session not active, reconnection required');
        setWalletState((prev) => ({
          ...prev,
          connected: false,
          address: null,
          principal: null,
          walletType: null,
        }));
        setActor(null);
        saveConnectionState(false);
        return false;
      }
    } catch (error: any) {
      logDebug('❌ Revalidation error', error);
      setWalletState((prev) => ({
        ...prev,
        connected: false,
        address: null,
        principal: null,
        walletType: null,
      }));
      setActor(null);
      saveConnectionState(false);
      return false;
    }
  }, [getPlugInstance, createActor, saveConnectionState, logDebug]);

  const autoReconnect = useCallback(async () => {
    logDebug('🔄 Attempting auto-reconnect...');
    
    try {
      const plug = getPlugInstance();
      if (!plug) {
        logDebug('❌ Auto-reconnect failed: Plug not available');
        return false;
      }

      if (!hasExistingSession()) {
        logDebug('⏭️ Auto-reconnect skipped: No existing session');
        return false;
      }

      const isConnected = await plug.isConnected();
      logDebug('🔍 Plug connection status', { isConnected });
      
      if (isConnected) {
        const principal = await plug.getPrincipal();
        const address = principal.toString();

        // Create actor after successful reconnection
        const newActor = await createActor();

        setWalletState({
          connected: true,
          connecting: false,
          address,
          principal,
          walletType: 'plug',
          detecting: false,
          detected: true,
          waitingForConfirmation: false,
        });

        setActor(newActor);
        saveConnectionState(true, principal);
        
        logDebug('✅ Auto-reconnect successful', { address });
        
        toast.success('Wallet automatically reconnected!', {
          description: 'Your previous session has been restored.',
        });
        return true;
      } else {
        // Try to reconnect if we have a previous session
        const lastPrincipal = localStorage.getItem(LAST_PRINCIPAL_KEY);
        if (lastPrincipal) {
          logDebug('🔄 Attempting to restore session with requestConnect', { lastPrincipal });
          
          const whitelist = [ICP_LEDGER_CANISTER_ID];
          const host = DEFAULT_HOST;
          
          const connected = await plug.requestConnect({ whitelist, host });
          
          if (connected) {
            const principal = await plug.getPrincipal();
            const address = principal.toString();

            // Create actor after successful reconnection
            const newActor = await createActor();

            setWalletState({
              connected: true,
              connecting: false,
              address,
              principal,
              walletType: 'plug',
              detecting: false,
              detected: true,
              waitingForConfirmation: false,
            });

            setActor(newActor);
            saveConnectionState(true, principal);
            
            logDebug('✅ Session restored via requestConnect', { address });
            
            toast.success('Wallet session restored!', {
              description: 'Your wallet has been reconnected.',
            });
            return true;
          }
        }
      }
      
      logDebug('⏭️ Auto-reconnect: No active session to restore');
      return false;
    } catch (error: any) {
      logDebug('❌ Auto-reconnect error', error);
      saveConnectionState(false);
      return false;
    }
  }, [getPlugInstance, hasExistingSession, createActor, saveConnectionState, logDebug]);

  const connectPlug = useCallback(async () => {
    logDebug('🔌 Connect Plug initiated');
    setWalletState((prev) => ({ ...prev, connecting: true }));

    // Clear any existing timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }

    try {
      const plug = getPlugInstance();
      if (!plug) {
        toast.error('Plug wallet not detected', {
          description: 'Please install the Plug browser extension and refresh the page.',
          action: {
            label: 'Install Plug',
            onClick: () => window.open('https://plugwallet.ooo/', '_blank'),
          },
        });
        setWalletState((prev) => ({ ...prev, connecting: false }));
        return false;
      }

      // Set connection timeout (30 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        connectionTimeoutRef.current = setTimeout(() => {
          reject(new Error('Connection timeout - please try again'));
        }, CONNECTION_TIMEOUT);
      });

      const alreadyConnected = await plug.isConnected();
      logDebug('🔍 Connect: Already connected check', { alreadyConnected });
      
      if (alreadyConnected) {
        const principal = await plug.getPrincipal();
        const address = principal.toString();

        // Create actor after successful connection
        const newActor = await createActor();

        setWalletState({
          connected: true,
          connecting: false,
          address,
          principal,
          walletType: 'plug',
          detecting: false,
          detected: true,
          waitingForConfirmation: false,
        });

        setActor(newActor);
        saveConnectionState(true, principal);
        
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
        
        logDebug('✅ Connected (already connected)', { address });
        
        toast.success('Wallet connected successfully!');
        return true;
      }

      const whitelist = [ICP_LEDGER_CANISTER_ID];
      const host = DEFAULT_HOST;

      logDebug('📡 Requesting connection...', { whitelist, host });

      // Race between connection and timeout
      const connected = await Promise.race([
        plug.requestConnect({ whitelist, host }),
        timeoutPromise,
      ]);

      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }

      if (connected) {
        const principal = await plug.getPrincipal();
        const address = principal.toString();

        // Create actor after successful connection
        const newActor = await createActor();

        setWalletState({
          connected: true,
          connecting: false,
          address,
          principal,
          walletType: 'plug',
          detecting: false,
          detected: true,
          waitingForConfirmation: false,
        });

        setActor(newActor);
        saveConnectionState(true, principal);
        
        logDebug('✅ Connection successful', { address });
        
        toast.success('Wallet connected successfully!');
        return true;
      } else {
        setWalletState((prev) => ({ ...prev, connecting: false }));
        
        logDebug('❌ Connection rejected by user');
        
        toast.error('Connection rejected', {
          description: 'Please approve the connection in your Plug wallet.',
        });
        return false;
      }
    } catch (error: any) {
      logDebug('❌ Connection error', error);
      
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      
      setWalletState((prev) => ({ ...prev, connecting: false }));
      
      let errorMessage = 'Failed to connect wallet';
      let errorDescription = 'Please try again or refresh the page.';
      
      if (error?.message?.includes('timeout')) {
        errorMessage = 'Connection timeout';
        errorDescription = 'The connection request took too long. Please try again.';
      } else if (error?.message?.includes('locked')) {
        errorMessage = 'Wallet is locked';
        errorDescription = 'Please unlock your Plug wallet and try again.';
      } else if (error?.message?.includes('rejected') || error?.message?.includes('denied')) {
        errorMessage = 'Connection rejected';
        errorDescription = 'You rejected the connection request. Your form data is preserved - click Connect Wallet to try again.';
      }
      
      toast.error(errorMessage, { description: errorDescription });
      return false;
    }
  }, [getPlugInstance, createActor, saveConnectionState, logDebug]);

  const disconnect = useCallback(async () => {
    logDebug('🔌 Disconnect initiated');
    
    try {
      const plug = getPlugInstance();
      if (walletState.walletType === 'plug' && plug) {
        await plug.disconnect();
      }

      setWalletState({
        connected: false,
        connecting: false,
        address: null,
        principal: null,
        walletType: null,
        detecting: false,
        detected: walletState.detected,
        waitingForConfirmation: false,
      });

      setActor(null);
      saveConnectionState(false);
      
      logDebug('✅ Disconnected successfully');
      
      toast.success('Wallet disconnected');
    } catch (error: any) {
      logDebug('❌ Disconnect error', error);
      toast.error('Failed to disconnect wallet');
    }
  }, [walletState.walletType, walletState.detected, getPlugInstance, saveConnectionState, logDebug]);

  const transferICP = useCallback(
    async (params: TransferParams): Promise<TransferResult> => {
      if (!walletState.connected || !walletState.walletType) {
        toast.error('Wallet not connected', {
          description: 'Please connect your wallet first. Your form data is preserved.',
        });
        return { success: false, error: 'Wallet not connected' };
      }

      // Check connection before signing
      const connected = await ensureConnected();
      if (!connected) {
        toast.error('Wallet session expired', {
          description: 'Please reconnect your wallet and try again. Your form data is preserved.',
        });
        return { success: false, error: 'Session expired - reconnection required' };
      }

      const plug = getPlugInstance();
      if (!plug) {
        toast.error('Wallet not accessible', {
          description: 'Please reconnect your wallet. Your form data is preserved.',
        });
        return { success: false, error: 'Wallet not accessible' };
      }

      // Set waiting state for UI overlay
      setWalletState((prev) => ({ ...prev, waitingForConfirmation: true }));

      try {
        const amountNumber = Number(params.amount);

        logDebug('💸 Initiating transfer with timeout protection', { to: params.to, amount: amountNumber });

        // Wrap Plug approval with timeout (~60s)
        const transferPromise = withTimeout(
          plug.requestTransfer({
            to: params.to,
            amount: amountNumber,
            opts: {
              fee: 10000,
              memo: params.memo,
            },
          }),
          WALLET_APPROVAL_TIMEOUT,
          'Wallet approval timed out after 60 seconds. Please try again.'
        );

        // Show persistent notification
        toast.info('Waiting for Wallet Confirmation…', {
          description: 'Please review and approve the 1 ICP payment in your Plug wallet popup. The request will timeout after 60 seconds if not confirmed.',
          duration: Infinity,
          id: 'wallet-confirmation',
        });

        // Await the transfer with timeout protection
        const result = await transferPromise;

        // Dismiss the waiting toast
        toast.dismiss('wallet-confirmation');

        if (!result.height || result.height <= 0n) {
          throw new Error('Transaction not confirmed - no block height returned');
        }

        logDebug('✅ Transfer successful', { blockHeight: result.height });

        setWalletState((prev) => ({ ...prev, waitingForConfirmation: false }));

        toast.success('✅ Payment confirmed on-chain!', {
          description: `Transaction completed at block ${result.height}`,
        });

        return {
          success: true,
          blockHeight: result.height,
        };
      } catch (error: any) {
        logDebug('❌ Transfer error', error);
        
        // Dismiss the waiting toast
        toast.dismiss('wallet-confirmation');
        
        setWalletState((prev) => ({ ...prev, waitingForConfirmation: false }));
        
        let errorMessage = 'Transfer failed';
        let errorDescription = 'Your form data is preserved. Please try again.';
        
        if (error?.message?.includes('timeout') || error?.message?.includes('timed out')) {
          errorMessage = 'Wallet approval timeout';
          errorDescription = 'The wallet approval request timed out after 60 seconds. Your form data is preserved - click "Confirm Payment & Deploy" to try again.';
          // Trigger reconnect on timeout
          await reconnectWallet();
        } else if (error?.message?.includes('locked')) {
          errorMessage = 'Wallet is locked';
          errorDescription = 'Please unlock your Plug wallet and try again. Your form data is preserved.';
        } else if (error?.message?.includes('rejected') || error?.message?.includes('denied') || error?.message?.includes('User rejected')) {
          errorMessage = 'Transaction rejected';
          errorDescription = 'You rejected the transaction. Your form data is preserved - click "Confirm Payment & Deploy" when ready.';
          // Trigger reconnect on rejection
          await reconnectWallet();
        } else if (error?.message?.includes('Insufficient') || error?.message?.includes('insufficient')) {
          errorMessage = 'Insufficient balance';
          errorDescription = 'Please add ICP to your wallet and try again. Your form data is preserved.';
        } else if (error?.message) {
          errorDescription = `${error.message}. Your form data is preserved.`;
        }
        
        toast.error(errorMessage, { description: errorDescription });
        return { success: false, error: errorMessage };
      }
    },
    [walletState.connected, walletState.walletType, getPlugInstance, ensureConnected, reconnectWallet, logDebug]
  );

  const getBalance = useCallback(async (): Promise<bigint | null> => {
    if (!walletState.connected || !walletState.walletType) {
      return null;
    }

    const plug = getPlugInstance();
    if (!plug) return null;

    try {
      const balances = await plug.requestBalance();
      const icpBalance = balances.find((b) => b.symbol === 'ICP');
      if (icpBalance) {
        return BigInt(Math.floor(icpBalance.amount * 100000000));
      }

      return null;
    } catch (error: any) {
      logDebug('❌ Balance fetch error', error);
      return null;
    }
  }, [walletState.connected, walletState.walletType, getPlugInstance, logDebug]);

  const isPlugInstalled = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    return detectPlugWallet();
  }, [detectPlugWallet]);

  // Account switch detection - listen for ic-plug-account-changed events
  useEffect(() => {
    const handleAccountChanged = async (event: Event) => {
      logDebug('🔄 Account switch detected', event);
      
      const plug = getPlugInstance();
      if (!plug) {
        logDebug('❌ Account switch: Plug not available');
        return;
      }

      try {
        const isConnected = await plug.isConnected();
        
        if (isConnected) {
          const principal = await plug.getPrincipal();
          const address = principal.toString();

          // Check if address actually changed
          if (address !== walletState.address) {
            logDebug('🔄 Address changed, rebuilding actor', { oldAddress: walletState.address, newAddress: address });
            
            // Rebuild actor with new account
            const newActor = await createActor();

            setWalletState((prev) => ({
              ...prev,
              connected: true,
              address,
              principal,
              walletType: 'plug',
            }));

            setActor(newActor);
            saveConnectionState(true, principal);
            
            toast.info('Wallet account switched', {
              description: `Now using ${address.slice(0, 8)}...${address.slice(-6)}`,
            });
          }
        } else {
          logDebug('⚠️ Account switch: Not connected anymore');
          
          // Clear state if disconnected
          setWalletState({
            connected: false,
            connecting: false,
            address: null,
            principal: null,
            walletType: null,
            detecting: false,
            detected: true,
            waitingForConfirmation: false,
          });
          setActor(null);
          saveConnectionState(false);
          
          toast.warning('Wallet disconnected', {
            description: 'Please reconnect your wallet.',
          });
        }
      } catch (error: any) {
        logDebug('❌ Account switch error', error);
      }
    };

    // Listen for Plug account change events
    window.addEventListener('ic-plug-account-changed', handleAccountChanged);

    return () => {
      window.removeEventListener('ic-plug-account-changed', handleAccountChanged);
    };
  }, [walletState.address, getPlugInstance, createActor, saveConnectionState, logDebug]);

  // Initialize detection on mount with timeout
  useEffect(() => {
    mountedRef.current = true;
    logDebug('🚀 Wallet hook mounted - starting detection');

    // Immediate detection check
    const isDetected = detectPlugWallet();
    
    if (isDetected) {
      logDebug('✅ Plug detected immediately');
      setWalletState((prev) => ({
        ...prev,
        detected: true,
        detecting: false,
      }));
      
      toast.success('Plug wallet detected!', {
        description: 'Your wallet is ready to connect.',
      });
    } else {
      logDebug('⏳ Plug not detected, starting detection interval...');
      
      // Set detection timeout (30 seconds)
      detectionTimeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        
        const finalCheck = detectPlugWallet();
        
        if (!finalCheck) {
          logDebug('❌ Detection timeout - Plug not found after 30 seconds');
          setWalletState((prev) => ({
            ...prev,
            detected: false,
            detecting: false,
          }));
          
          toast.error('Plug wallet not detected', {
            description: 'Please install the Plug browser extension.',
            action: {
              label: 'Install Plug',
              onClick: () => window.open('https://plugwallet.ooo/', '_blank'),
            },
          });
        }
      }, DETECTION_TIMEOUT);

      // Poll for detection every 300ms
      const detectionInterval = setInterval(() => {
        if (!mountedRef.current) return;

        const detected = detectPlugWallet();
        
        if (detected) {
          logDebug('✅ Plug detected during polling');
          
          if (detectionTimeoutRef.current) {
            clearTimeout(detectionTimeoutRef.current);
          }
          clearInterval(detectionInterval);
          
          setWalletState((prev) => ({
            ...prev,
            detected: true,
            detecting: false,
          }));
          
          toast.success('Plug wallet detected!', {
            description: 'Your wallet is ready to connect.',
          });
        }
      }, 300);

      // Cleanup function
      return () => {
        if (detectionTimeoutRef.current) {
          clearTimeout(detectionTimeoutRef.current);
        }
        clearInterval(detectionInterval);
      };
    }

    return () => {
      mountedRef.current = false;
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      if (pendingTransferRef.current) {
        pendingTransferRef.current.reject(new Error('Component unmounted'));
        pendingTransferRef.current = null;
      }
      logDebug('🔌 Wallet hook unmounted');
    };
  }, [detectPlugWallet, logDebug]);

  // Auto-reconnect when wallet is detected
  useEffect(() => {
    if (!walletState.detected || hasAttemptedAutoReconnect.current || walletState.connected) return;

    const attemptAutoReconnect = async () => {
      hasAttemptedAutoReconnect.current = true;
      
      logDebug('🔄 Wallet detected, attempting auto-reconnect after delay');
      
      // Wait a bit to ensure Plug is fully initialized
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const plug = getPlugInstance();
      
      if (plug) {
        await autoReconnect();
      }
    };

    attemptAutoReconnect();
  }, [walletState.detected, walletState.connected, getPlugInstance, autoReconnect, logDebug]);

  return {
    ...walletState,
    actor,
    connectPlug,
    disconnect,
    transferICP,
    getBalance,
    isPlugInstalled,
    reconnectWallet,
    revalidateSession,
    recordPayment,
    createToken,
    initializeAccessControl,
  };
}
