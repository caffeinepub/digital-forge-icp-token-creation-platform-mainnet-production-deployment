import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { toast } from 'sonner';
import {
  TokenMetadata,
  TokenConfig,
  UserProfile,
  UserActivityMetrics,
  GlobalPlatformStats,
  PaymentRecord,
} from '../backend';

// ─── User Profile ────────────────────────────────────────────────────────────

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error('Actor not available');
      await actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      toast.success('Profile saved successfully!');
    },
    onError: (error: any) => {
      const msg = error?.message || 'Failed to save profile';
      toast.error(msg);
    },
  });
}

// ─── Token Queries ────────────────────────────────────────────────────────────

export function useGetAllTokens() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<TokenMetadata[]>({
    queryKey: ['allTokens'],
    queryFn: async () => {
      if (!actor) return [];
      try {
        const result = await actor.getAllTokens();
        if (!Array.isArray(result)) {
          console.warn('getAllTokens did not return an array:', result);
          return [];
        }
        return result;
      } catch (err: any) {
        console.error('getAllTokens error:', err?.message || err);
        return [];
      }
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useGetForgedTokens() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<TokenMetadata[]>({
    queryKey: ['forgedTokens'],
    queryFn: async () => {
      if (!actor) return [];
      try {
        const result = await actor.getForgedTokens();
        if (!Array.isArray(result)) {
          console.warn('⚠️ getForgedTokens did not return an array:', result);
          return [];
        }
        console.log(`✅ getForgedTokens returned ${result.length} tokens`);
        return result;
      } catch (err: any) {
        console.error('❌ getForgedTokens error:', err?.message || err);
        return [];
      }
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useGetToken(symbol: string) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<TokenMetadata | null>({
    queryKey: ['token', symbol],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getToken(symbol);
    },
    enabled: !!actor && !actorFetching && !!symbol,
  });
}

// ─── Token Creation ───────────────────────────────────────────────────────────

export function useCreateToken() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: TokenConfig) => {
      if (!actor) throw new Error('Actor not available');
      console.log('🔨 Creating token:', config.symbol);
      const result = await actor.createToken(config);
      console.log('🔨 createToken raw result:', result);

      if (result.__kind__ === 'error') {
        throw new Error(result.error.message);
      }
      return result.success;
    },
    onSuccess: (data) => {
      console.log('✅ Token created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['allTokens'] });
      queryClient.invalidateQueries({ queryKey: ['forgedTokens'] });
      queryClient.invalidateQueries({ queryKey: ['userActivityMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['tokenCount'] });
      toast.success(`Token created! Canister: ${data.canisterId}`);
    },
    onError: (error: any) => {
      const msg = error?.message || 'Token creation failed';
      console.error('❌ Token creation error:', msg);
      toast.error(msg);
    },
  });
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export function useRecordPayment() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount, treasuryAddress }: { amount: bigint; treasuryAddress: string }) => {
      if (!actor) throw new Error('Actor not available');
      console.log('💰 Recording payment:', { amount: amount.toString(), treasuryAddress });
      const result = await actor.recordPayment(amount, treasuryAddress);
      console.log('💰 recordPayment raw result:', result);

      if (result.__kind__ === 'error') {
        throw new Error(result.error.message);
      }
      return { message: result.success.message, paymentId: result.success.paymentId };
    },
    onSuccess: (data) => {
      console.log('✅ Payment recorded:', data);
      queryClient.invalidateQueries({ queryKey: ['paymentRecord'] });
      toast.success('Payment recorded successfully!');
    },
    onError: (error: any) => {
      const msg = error?.message || 'Payment recording failed';
      console.error('❌ Payment recording error:', msg);
      toast.error(msg);
    },
  });
}

export function useGetPaymentRecord(paymentId: bigint | null) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<PaymentRecord | null>({
    queryKey: ['paymentRecord', paymentId?.toString()],
    queryFn: async () => {
      if (!actor || paymentId === null) return null;
      return actor.getPaymentRecord(paymentId);
    },
    enabled: !!actor && !actorFetching && paymentId !== null,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.verified) return false;
      return 5000;
    },
  });
}

// ─── Platform Stats ───────────────────────────────────────────────────────────

export function useGetGlobalPlatformStats() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<GlobalPlatformStats | null>({
    queryKey: ['globalPlatformStats'],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getGlobalPlatformStats();
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useGetUserActivityMetrics() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<UserActivityMetrics | null>({
    queryKey: ['userActivityMetrics'],
    queryFn: async () => {
      if (!actor) return null;
      try {
        return await actor.getUserActivityMetrics();
      } catch (err: any) {
        console.error('getUserActivityMetrics error:', err?.message || err);
        return null;
      }
    },
    enabled: !!actor && !actorFetching,
  });
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export function useIsCallerAdmin() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<boolean>({
    queryKey: ['isCallerAdmin'],
    queryFn: async () => {
      if (!actor) return false;
      return actor.isCallerAdmin();
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useVerifyPaymentWithLedger() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transactionId, paymentId }: { transactionId: string; paymentId: bigint }) => {
      if (!actor) throw new Error('Actor not available');
      console.log('🔍 Verifying payment with ledger:', { transactionId, paymentId: paymentId.toString() });
      const result = await actor.verifyPaymentWithLedger(transactionId, paymentId);
      console.log('🔍 verifyPaymentWithLedger raw result:', result);

      if (result.__kind__ === 'error') {
        throw new Error(result.error.message);
      }
      return result.success;
    },
    onSuccess: (data) => {
      console.log('✅ Payment verified:', data);
      queryClient.invalidateQueries({ queryKey: ['paymentRecord'] });
      toast.success('Payment verified successfully!');
    },
    onError: (error: any) => {
      const msg = error?.message || 'Payment verification failed';
      console.error('❌ Payment verification error:', msg);
      toast.error(msg);
    },
  });
}

export function useGetBuyMeACoffeeAddress() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<string | null>({
    queryKey: ['buyMeACoffeeAddress'],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getBuyMeACoffeeAddress();
    },
    enabled: !!actor && !actorFetching,
  });
}

// ─── Public Platform Info ─────────────────────────────────────────────────────

export function useGetTokenCount() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<bigint>({
    queryKey: ['tokenCount'],
    queryFn: async () => {
      if (!actor) return BigInt(0);
      return actor.getTokenCount();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });
}

export function useGetTreasuryAddress() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<string>({
    queryKey: ['treasuryAddress'],
    queryFn: async () => {
      if (!actor) return '';
      return actor.getTreasuryAddress();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });
}

export function useGetCreationFee() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<bigint>({
    queryKey: ['creationFee'],
    queryFn: async () => {
      if (!actor) return BigInt(0);
      return actor.getCreationFee();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });
}
