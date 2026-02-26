import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type TokenCreationResult = {
    __kind__: "error";
    error: {
        message: string;
    };
} | {
    __kind__: "success";
    success: {
        message: string;
        canisterId: string;
    };
};
export type VerifyPaymentResult = {
    __kind__: "error";
    error: {
        message: string;
    };
} | {
    __kind__: "success";
    success: {
        message: string;
    };
};
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export type Time = bigint;
export interface PaymentRecord {
    verified: boolean;
    usedForToken: boolean;
    treasuryAddressUsed: string;
    errorMessage?: string;
    tokenSymbol?: string;
    timestamp: Time;
    payer: Principal;
    amount: bigint;
}
export interface TokenConfig {
    status: TokenStatus;
    emblemAspectRatio?: bigint;
    decimals: bigint;
    featured: boolean;
    thumbnailUrl: string;
    creatorProfileUrl: string;
    circulatingSupply: bigint;
    tokenAddress?: string;
    name: string;
    tags: Array<string>;
    communityExplorer: boolean;
    treasuryFee: TreasuryFeeConfig;
    emblemProcessingMetadata?: EmblemProcessingMetadata;
    description: string;
    totalSupply: bigint;
    creatorName: string;
    mediaUrl: string;
    customFields: Array<CustomField>;
    validationTimestamp?: Time;
    testingStatus?: TestingStatus;
    paymentId?: bigint;
    taxModules: TaxModules;
    mediaType: MediaType;
    chartUrl: string;
    aiAgentCompatible: boolean;
    moduleConfigs: Array<ModuleConfig>;
    rewardTokenAddress?: string;
    symbol: string;
}
export interface EmblemProcessingMetadata {
    originalWidth: bigint;
    cropWidth: bigint;
    originalHeight: bigint;
    cropX: bigint;
    cropY: bigint;
    processedAt: Time;
    cropHeight: bigint;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface TreasuryFeeConfig {
    enabled: boolean;
    sellFee: bigint;
    treasuryAddress: string;
    buyFee: bigint;
}
export interface TokenMetadata {
    status: TokenStatus;
    emblemAspectRatio?: bigint;
    popularityScore: bigint;
    creator: Principal;
    decimals: bigint;
    verified: boolean;
    featured: boolean;
    thumbnailUrl: string;
    fixedTreasuryFee: bigint;
    totalSellTax: bigint;
    creatorProfileUrl: string;
    views: bigint;
    circulatingSupply: bigint;
    deployedAt: Time;
    tokenAddress?: string;
    developerWalletWhitelisted: boolean;
    name: string;
    createdAt: Time;
    tags: Array<string>;
    trendingScore: bigint;
    communityExplorer: boolean;
    lastUpdated: Time;
    treasuryFee: bigint;
    emblemProcessingMetadata?: EmblemProcessingMetadata;
    description: string;
    mintFeePaid: boolean;
    totalSupply: bigint;
    creatorName: string;
    mediaUrl: string;
    likes: bigint;
    version: bigint;
    customFields: Array<CustomField>;
    sellTax: bigint;
    validationTimestamp?: Time;
    testingStatus?: TestingStatus;
    paymentId?: bigint;
    totalBuyTax: bigint;
    taxModules: TaxModules;
    auditStatus: AuditStatus;
    mediaType: MediaType;
    liquidityBurnAddress: string;
    chartUrl: string;
    comments: Array<Comment>;
    treasuryAddress: string;
    aiAgentCompatible: boolean;
    moduleConfigs: Array<ModuleConfig>;
    buyTax: bigint;
    rewardTokenAddress?: string;
    symbol: string;
    canisterId: Principal;
}
export type StripeSessionStatus = {
    __kind__: "completed";
    completed: {
        userPrincipal?: string;
        response: string;
    };
} | {
    __kind__: "failed";
    failed: {
        error: string;
    };
};
export interface StripeConfiguration {
    allowedCountries: Array<string>;
    secretKey: string;
}
export interface Comment {
    content: string;
    authorName: string;
    author: Principal;
    timestamp: Time;
    authorProfileUrl: string;
}
export type PaymentResult = {
    __kind__: "error";
    error: {
        message: string;
    };
} | {
    __kind__: "success";
    success: {
        message: string;
        paymentId: bigint;
    };
};
export interface http_header {
    value: string;
    name: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface GlobalPlatformStats {
    totalSupplyAcrossTokens: bigint;
    totalTokensCreated: bigint;
    platformTreasuryFees: bigint;
    totalUsers: bigint;
}
export interface ShoppingItem {
    productName: string;
    currency: string;
    quantity: bigint;
    priceInCents: bigint;
    productDescription: string;
}
export interface ModuleConfig {
    moduleType: ModuleType;
    tokenAddress?: string;
    reflectionTarget?: Principal;
    split: boolean;
    sellTax: bigint;
    unified: boolean;
    buyTax: bigint;
    rewardTokenAddress?: string;
}
export interface UserActivityMetrics {
    tokensMinted: bigint;
    totalFeesPaid: bigint;
    treasuryConfigurations: bigint;
    deploymentHistory: Array<string>;
}
export interface CustomField {
    key: string;
    value: string;
}
export interface TaxModules {
    support: boolean;
    burn: boolean;
    liquidity: boolean;
    reflection: boolean;
    yield: boolean;
    treasury: boolean;
}
export interface UserProfile {
    username: string;
    name: string;
    email: string;
    linkedPrincipals: Array<Principal>;
}
export enum AuditStatus {
    pending = "pending",
    approved = "approved",
    inReview = "inReview",
    rejected = "rejected"
}
export enum MediaType {
    gif = "gif",
    audio = "audio",
    video = "video",
    image = "image",
    unknown_ = "unknown"
}
export enum ModuleType {
    support = "support",
    burn = "burn",
    liquidity = "liquidity",
    reflection = "reflection",
    yield_ = "yield",
    treasury = "treasury"
}
export enum TestingStatus {
    inProgress = "inProgress",
    failed = "failed",
    passed = "passed"
}
export enum TokenStatus {
    active = "active",
    pending = "pending",
    inactive = "inactive",
    archived = "archived"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createCheckoutSession(items: Array<ShoppingItem>, successUrl: string, cancelUrl: string): Promise<string>;
    createToken(config: TokenConfig): Promise<TokenCreationResult>;
    getAllTokens(): Promise<Array<TokenMetadata>>;
    getBuyMeACoffeeAddress(): Promise<string>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCreationFee(): Promise<bigint>;
    getForgedTokens(): Promise<Array<TokenMetadata>>;
    getGlobalPlatformStats(): Promise<GlobalPlatformStats>;
    getPaymentRecord(paymentId: bigint): Promise<PaymentRecord | null>;
    getStripeSessionStatus(sessionId: string): Promise<StripeSessionStatus>;
    getToken(symbol: string): Promise<TokenMetadata | null>;
    getTokenCount(): Promise<bigint>;
    getTreasuryAddress(): Promise<string>;
    getUserActivityMetrics(): Promise<UserActivityMetrics>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    initializeAccessControl(): Promise<void>;
    isCallerAdmin(): Promise<boolean>;
    isStripeConfigured(): Promise<boolean>;
    lookupToken(canisterId: string): Promise<TokenMetadata | null>;
    markMintFeePaid(symbol: string, paymentId: bigint): Promise<void>;
    recordPayment(amount: bigint, treasuryAddress: string): Promise<PaymentResult>;
    registerToken(metadata: TokenMetadata): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    setStripeConfiguration(config: StripeConfiguration): Promise<void>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
    verifyPaymentWithLedger(transactionId: string, paymentId: bigint): Promise<VerifyPaymentResult>;
}
