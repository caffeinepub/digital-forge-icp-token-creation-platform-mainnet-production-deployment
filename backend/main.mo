import AccessControl "authorization/access-control";
import Principal "mo:base/Principal";
import OrderedMap "mo:base/OrderedMap";
import Debug "mo:base/Debug";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Time "mo:base/Time";
import Array "mo:base/Array";
import OutCall "http-outcalls/outcall";
import Stripe "stripe/stripe";
import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";
import Char "mo:base/Char";
import Iter "mo:base/Iter";
import Error "mo:base/Error";
import Int "mo:base/Int";

actor DigitalForgeICP {
  let accessControlState = AccessControl.initState();
  let storage = Storage.new();
  include MixinStorage(storage);

  let MINT_FEE_AMOUNT : Nat = 1_000_000_000; // 1 ICP in e8s
  let TREASURY_ADDRESS : Text = "iyupi-26e6a-z56ra-6a5tz-yyj6i-kvxe4-joccp-pgapo-vpcvb-zxtmq-oae";
  let MIN_TOTAL_TAX : Nat = 25; // 0.25% in basis points
  let MAX_TOTAL_TAX : Nat = 2500; // 25% in basis points
  let LIQUIDITY_BURN_ADDRESS : Text = "aaaaa-aa"; // Permanent burn address for all liquidity
  let DEVELOPER_WALLET : Text = "iyupi-26e6a-z56ra-6a5tz-yyj6i-kvxe4-joccp-pgapo-vpcvb-zxtmq-oae";
  let FIXED_TREASURY_FEE : Nat = 25; // 0.25% in basis points
  let PAYMENT_VALIDITY_WINDOW : Time.Time = 3_600_000_000_000; // 1 hour in nanoseconds
  let TOKEN_CREATION_RATE_LIMIT : Time.Time = 30_000_000_000; // 30 seconds

  // Track initialization to prevent re-initialization attacks
  var isInitialized : Bool = false;

  // Track payment usage to prevent race conditions
  var paymentLocks = OrderedMap.Make<Nat>(Nat.compare).empty<Bool>();

  // Track token creation rate limiting
  var lastTokenCreation = OrderedMap.Make<Text>(Text.compare).empty<Time.Time>();

  // Helper function to sanitize text input
  func sanitizeText(input : Text) : Text {
    let chars = Text.toArray(input);
    let sanitized = Array.filter<Char>(chars, func(c : Char) : Bool {
      let code = Char.toNat32(c);
      // Allow alphanumeric, spaces, and common punctuation
      (code >= 32 and code <= 126) or code == 10 or code == 13
    });
    Text.fromArray(sanitized);
  };

  // Helper function to check if caller is the whitelisted developer wallet
  func isDeveloperWallet(caller : Principal) : Bool {
    Principal.toText(caller) == DEVELOPER_WALLET;
  };

  // Helper function to log errors with context
  func logError(context : Text, error : Text, caller : Principal) {
    Debug.print("ERROR [" # context # "] Caller: " # Principal.toText(caller) # " | " # error);
  };

  public shared ({ caller }) func initializeAccessControl() : async () {
    let isTreasuryPrincipal = Principal.toText(caller) == TREASURY_ADDRESS;
    if (not isInitialized or isTreasuryPrincipal) {
      // Allow treasury principal to force add themselves as admin
      if (Principal.isAnonymous(caller)) {
        Debug.trap("Unauthorized: Anonymous principals cannot initialize access control");
      };
      AccessControl.initialize(accessControlState, caller);
      isInitialized := true;
    } else {
      Debug.trap("Unauthorized: Access control already initialized");
    };
  };

  public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
    AccessControl.getUserRole(accessControlState, caller);
  };

  public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
    // AUTHORIZATION: Ensure system is initialized
    if (not isInitialized) {
      Debug.trap("Unauthorized: Access control not initialized");
    };

    // AUTHORIZATION: Prevent assigning roles to anonymous principals
    if (Principal.isAnonymous(user)) {
      Debug.trap("Unauthorized: Cannot assign roles to anonymous principals");
    };

    // AUTHORIZATION: Prevent anonymous callers
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous principals cannot assign roles");
    };

    // AUTHORIZATION: Only admins can assign roles (enforced in AccessControl.assignRole)
    AccessControl.assignRole(accessControlState, caller, user, role);
  };

  public query ({ caller }) func isCallerAdmin() : async Bool {
    if (not isInitialized) {
      return false;
    };
    AccessControl.isAdmin(accessControlState, caller);
  };

  public type UserProfile = {
    name : Text;
    username : Text;
    email : Text;
    linkedPrincipals : [Principal];
  };

  var userProfiles = OrderedMap.Make<Principal>(Principal.compare).empty<UserProfile>();

  // Helper function to find a profile by principal
  func findProfileByPrincipal(principal : Principal) : ?UserProfile {
    for ((_, profile) in OrderedMap.Make<Principal>(Principal.compare).entries(userProfiles)) {
      for (linkedPrincipal in profile.linkedPrincipals.vals()) {
        if (linkedPrincipal == principal) {
          return ?profile;
        };
      };
    };
    null;
  };

  // Helper function to link a principal to an existing profile
  func linkPrincipalToProfile(profile : UserProfile, principal : Principal) : UserProfile {
    let alreadyLinked = Array.find<Principal>(profile.linkedPrincipals, func(p) { p == principal });
    switch (alreadyLinked) {
      case (?_) { profile };
      case (null) {
        {
          profile with
          linkedPrincipals = Array.append(profile.linkedPrincipals, [principal]);
        };
      };
    };
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    // AUTHORIZATION: Anonymous principals cannot have profiles
    if (Principal.isAnonymous(caller)) {
      return null;
    };

    // First, try to find a direct match
    switch (OrderedMap.Make<Principal>(Principal.compare).get(userProfiles, caller)) {
      case (?profile) { ?profile };
      case (null) {
        // If not found, try to find a linked profile
        findProfileByPrincipal(caller);
      };
    };
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    // AUTHORIZATION: Anonymous principals cannot view profiles
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot view profiles");
    };
    // AUTHORIZATION: Users can only view their own profile or admins can view any
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Debug.trap("Unauthorized: Can only view your own profile");
    };
    OrderedMap.Make<Principal>(Principal.compare).get(userProfiles, user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    // AUTHORIZATION: Prevent anonymous principals from creating profiles
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot save profiles");
    };

    // AUTHORIZATION: Validate and sanitize profile data
    let sanitizedName = sanitizeText(profile.name);
    let sanitizedUsername = sanitizeText(profile.username);
    let sanitizedEmail = sanitizeText(profile.email);

    if (Text.size(sanitizedName) == 0) {
      Debug.trap("Profile name cannot be empty");
    };
    if (Text.size(sanitizedName) > 100) {
      Debug.trap("Profile name too long (max 100 characters)");
    };
    if (Text.size(sanitizedUsername) == 0) {
      Debug.trap("Username cannot be empty");
    };
    if (Text.size(sanitizedUsername) > 50) {
      Debug.trap("Username too long (max 50 characters)");
    };
    if (Text.size(sanitizedEmail) == 0) {
      Debug.trap("Email cannot be empty");
    };
    if (Text.size(sanitizedEmail) > 100) {
      Debug.trap("Email too long (max 100 characters)");
    };

    let sanitizedProfile : UserProfile = {
      name = sanitizedName;
      username = sanitizedUsername;
      email = sanitizedEmail;
      linkedPrincipals = [caller];
    };

    // Check if this principal is already linked to another profile
    switch (findProfileByPrincipal(caller)) {
      case (?_existingProfile) {
        // Update the existing profile with new data and link the principal
        let updatedProfile = linkPrincipalToProfile(sanitizedProfile, caller);
        userProfiles := OrderedMap.Make<Principal>(Principal.compare).put(userProfiles, caller, updatedProfile);
      };
      case (null) {
        // Create a new profile and link the principal
        userProfiles := OrderedMap.Make<Principal>(Principal.compare).put(userProfiles, caller, sanitizedProfile);
      };
    };
  };

  // Token Factory Types
  public type TokenMetadata = {
    name : Text;
    symbol : Text;
    description : Text;
    totalSupply : Nat;
    decimals : Nat;
    buyTax : Nat;
    sellTax : Nat;
    creator : Principal;
    deployedAt : Time.Time;
    canisterId : Principal;
    treasuryFee : Nat;
    treasuryAddress : Text;
    mintFeePaid : Bool;
    taxModules : TaxModules;
    moduleConfigs : [ModuleConfig];
    mediaUrl : Text;
    thumbnailUrl : Text;
    status : TokenStatus;
    circulatingSupply : Nat;
    rewardTokenAddress : ?Text;
    tokenAddress : ?Text;
    validationTimestamp : ?Time.Time;
    testingStatus : ?TestingStatus;
    communityExplorer : Bool;
    aiAgentCompatible : Bool;
    mediaType : MediaType;
    chartUrl : Text;
    creatorName : Text;
    creatorProfileUrl : Text;
    createdAt : Time.Time;
    lastUpdated : Time.Time;
    views : Nat;
    likes : Nat;
    comments : [Comment];
    tags : [Text];
    featured : Bool;
    trendingScore : Nat;
    popularityScore : Nat;
    verified : Bool;
    auditStatus : AuditStatus;
    customFields : [CustomField];
    version : Nat;
    emblemAspectRatio : ?Nat;
    emblemProcessingMetadata : ?EmblemProcessingMetadata;
    totalBuyTax : Nat;
    totalSellTax : Nat;
    liquidityBurnAddress : Text;
    developerWalletWhitelisted : Bool;
    fixedTreasuryFee : Nat;
    paymentId : ?Nat;
  };

  public type PaymentRecord = {
    payer : Principal;
    amount : Nat;
    timestamp : Time.Time;
    verified : Bool;
    tokenSymbol : ?Text;
    usedForToken : Bool;
    treasuryAddressUsed : Text;
    errorMessage : ?Text;
  };

  public type TaxModules = {
    treasury : Bool;
    burn : Bool;
    reflection : Bool;
    liquidity : Bool;
    yield : Bool;
    support : Bool;
  };

  public type ModuleConfig = {
    moduleType : ModuleType;
    buyTax : Nat;
    sellTax : Nat;
    unified : Bool;
    split : Bool;
    rewardTokenAddress : ?Text;
    tokenAddress : ?Text;
    reflectionTarget : ?Principal;
  };

  public type ModuleType = {
    #treasury;
    #burn;
    #reflection;
    #liquidity;
    #yield;
    #support;
  };

  public type TokenStatus = {
    #active;
    #inactive;
    #pending;
    #archived;
  };

  public type TestingStatus = {
    #passed;
    #failed;
    #inProgress;
  };

  public type MediaType = {
    #image;
    #video;
    #audio;
    #gif;
    #unknown;
  };

  public type Comment = {
    author : Principal;
    content : Text;
    timestamp : Time.Time;
    authorName : Text;
    authorProfileUrl : Text;
  };

  public type AuditStatus = {
    #pending;
    #approved;
    #rejected;
    #inReview;
  };

  public type CustomField = {
    key : Text;
    value : Text;
  };

  public type EmblemProcessingMetadata = {
    originalWidth : Nat;
    originalHeight : Nat;
    cropX : Nat;
    cropY : Nat;
    cropWidth : Nat;
    cropHeight : Nat;
    processedAt : Time.Time;
  };

  public type UserActivityMetrics = {
    tokensMinted : Nat;
    treasuryConfigurations : Nat;
    totalFeesPaid : Nat;
    deploymentHistory : [Text];
  };

  public type GlobalPlatformStats = {
    totalTokensCreated : Nat;
    totalSupplyAcrossTokens : Nat;
    platformTreasuryFees : Nat;
    totalUsers : Nat;
  };

  // Token Factory Storage
  var tokenRegistry = OrderedMap.Make<Text>(Text.compare).empty<TokenMetadata>();
  var paymentRecords = OrderedMap.Make<Nat>(Nat.compare).empty<PaymentRecord>();
  var nextPaymentId : Nat = 0;

  // Track user interactions to prevent abuse
  var userLikes = OrderedMap.Make<Text>(Text.compare).empty<[Text]>();
  var lastViewIncrement = OrderedMap.Make<Text>(Text.compare).empty<Time.Time>();
  var lastCommentTime = OrderedMap.Make<Text>(Text.compare).empty<Time.Time>();
  var lastPaymentTime = OrderedMap.Make<Text>(Text.compare).empty<Time.Time>();

  // Track total interactions per user to prevent spam
  var userTotalLikes = OrderedMap.Make<Text>(Text.compare).empty<Nat>();
  var userTotalComments = OrderedMap.Make<Text>(Text.compare).empty<Nat>();
  var userTotalViews = OrderedMap.Make<Text>(Text.compare).empty<Nat>();

  let MAX_LIKES_PER_USER : Nat = 1000;
  let MAX_COMMENTS_PER_USER : Nat = 500;
  let MAX_VIEWS_PER_USER_PER_DAY : Nat = 10000;

  // Helper function to validate principal text format
  func isValidPrincipal(principalText : Text) : Bool {
    if (Text.size(principalText) == 0 or Text.size(principalText) > 100) {
      return false;
    };
    switch (Principal.fromText(principalText)) {
      case (_) { true };
    };
  };

  // Helper function to calculate total buy and sell tax from module configs
  func calculateTotalTax(moduleConfigs : [ModuleConfig]) : (Nat, Nat) {
    var totalBuyTax : Nat = 0;
    var totalSellTax : Nat = 0;
    for (config in Iter.fromArray(moduleConfigs)) {
      totalBuyTax += config.buyTax;
      totalSellTax += config.sellTax;
    };
    (totalBuyTax, totalSellTax);
  };

  // Helper function to count treasury configurations for a user
  func countTreasuryConfigs(creator : Principal) : Nat {
    var count : Nat = 0;
    for ((_, metadata) in OrderedMap.Make<Text>(Text.compare).entries(tokenRegistry)) {
      if (metadata.creator == creator) {
        for (config in Iter.fromArray(metadata.moduleConfigs)) {
          switch (config.moduleType) {
            case (#treasury) { count += 1 };
            case (_) {};
          };
        };
      };
    };
    count;
  };

  // Helper function to calculate total fees paid by a user
  func calculateTotalFeesPaid(payer : Principal) : Nat {
    var total : Nat = 0;
    for ((_, record) in OrderedMap.Make<Nat>(Nat.compare).entries(paymentRecords)) {
      if (record.payer == payer and record.verified and record.usedForToken) {
        total += record.amount;
      };
    };
    total;
  };

  // Helper function to release payment lock safely
  func releasePaymentLock(paymentId : Nat) {
    paymentLocks := OrderedMap.Make<Nat>(Nat.compare).delete(paymentLocks, paymentId);
  };

  // Token Factory Functions
  public shared ({ caller }) func registerToken(metadata : TokenMetadata) : async () {
    // AUTHORIZATION: Ensure system is initialized
    if (not isInitialized) {
      Debug.trap("Unauthorized: Access control not initialized");
    };

    // AUTHORIZATION: Prevent anonymous principals
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot register tokens");
    };

    // AUTHORIZATION: Only admins can register tokens directly
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can register tokens directly");
    };

    // AUTHORIZATION: Developer wallet bypass for mint fee requirement
    if (not isDeveloperWallet(metadata.creator)) {
      if (not metadata.mintFeePaid) {
        Debug.trap("Unauthorized: Mint fee must be paid before registering token");
      };
    };

    // AUTHORIZATION: Validate tax ranges
    if (metadata.totalBuyTax < MIN_TOTAL_TAX or metadata.totalBuyTax > MAX_TOTAL_TAX) {
      Debug.trap("Total buy tax must be between 0.25% and 25%");
    };
    if (metadata.totalSellTax < MIN_TOTAL_TAX or metadata.totalSellTax > MAX_TOTAL_TAX) {
      Debug.trap("Total sell tax must be between 0.25% and 25%");
    };

    // AUTHORIZATION: Validate creator is not anonymous
    if (Principal.isAnonymous(metadata.creator)) {
      Debug.trap("Unauthorized: Token creator cannot be anonymous");
    };

    tokenRegistry := OrderedMap.Make<Text>(Text.compare).put(tokenRegistry, metadata.symbol, metadata);
  };

  public query ({ caller }) func getToken(symbol : Text) : async ?TokenMetadata {
    // AUTHORIZATION: Allow viewing if token is public in community explorer, OR caller is creator, OR caller is admin
    switch (OrderedMap.Make<Text>(Text.compare).get(tokenRegistry, symbol)) {
      case (null) { null };
      case (?metadata) {
        // Public tokens in community explorer can be viewed by anyone (including guests)
        if (metadata.communityExplorer and metadata.status == #active) {
          ?metadata;
        } else {
          // Private tokens require authentication and ownership/admin
          if (Principal.isAnonymous(caller)) {
            Debug.trap("Unauthorized: Anonymous users cannot view private tokens");
          };
          if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
            Debug.trap("Unauthorized: Only users can view private tokens");
          };
          if (caller == metadata.creator or AccessControl.isAdmin(accessControlState, caller)) {
            ?metadata;
          } else {
            Debug.trap("Unauthorized: Can only view your own private tokens");
          };
        };
      };
    };
  };

  public query func getAllTokens() : async [TokenMetadata] {
    var tokens : [TokenMetadata] = [];
    for ((_, metadata) in OrderedMap.Make<Text>(Text.compare).entries(tokenRegistry)) {
      tokens := Array.append(tokens, [metadata]);
    };
    tokens;
  };

  // Public community explorer - no authentication required for discovery
  public query func getForgedTokens() : async [TokenMetadata] {
    var tokens : [TokenMetadata] = [];
    for ((_, metadata) in OrderedMap.Make<Text>(Text.compare).entries(tokenRegistry)) {
      if (metadata.communityExplorer and metadata.status == #active) {
        tokens := Array.append(tokens, [metadata]);
      };
    };
    tokens;
  };

  // Token lookup by canister ID - public for community discovery
  public query func lookupToken(canisterId : Text) : async ?TokenMetadata {
    // AUTHORIZATION: Validate canister ID format to prevent injection
    if (not isValidPrincipal(canisterId)) {
      return null;
    };

    for ((_, metadata) in OrderedMap.Make<Text>(Text.compare).entries(tokenRegistry)) {
      if (Principal.toText(metadata.canisterId) == canisterId) {
        // Only return if token is public in community explorer
        if (metadata.communityExplorer and metadata.status == #active) {
          return ?metadata;
        };
      };
    };
    null;
  };

  // User activity metrics - users can only view their own metrics
  public query ({ caller }) func getUserActivityMetrics() : async UserActivityMetrics {
    // AUTHORIZATION: Only authenticated users can view activity metrics
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot view activity metrics");
    };
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can view activity metrics");
    };

    var tokensMinted : Nat = 0;
    var deploymentHistory : [Text] = [];

    for ((symbol, metadata) in OrderedMap.Make<Text>(Text.compare).entries(tokenRegistry)) {
      if (metadata.creator == caller) {
        tokensMinted += 1;
        deploymentHistory := Array.append(deploymentHistory, [symbol]);
      };
    };

    let treasuryConfigurations = countTreasuryConfigs(caller);
    let totalFeesPaid = calculateTotalFeesPaid(caller);

    {
      tokensMinted;
      treasuryConfigurations;
      totalFeesPaid;
      deploymentHistory;
    };
  };

  // Global platform statistics - public for all users including guests
  public query func getGlobalPlatformStats() : async GlobalPlatformStats {
    var totalTokensCreated : Nat = 0;
    var totalSupplyAcrossTokens : Nat = 0;
    var platformTreasuryFees : Nat = 0;

    for ((_, metadata) in OrderedMap.Make<Text>(Text.compare).entries(tokenRegistry)) {
      totalTokensCreated += 1;
      totalSupplyAcrossTokens += metadata.totalSupply;
    };

    for ((_, record) in OrderedMap.Make<Nat>(Nat.compare).entries(paymentRecords)) {
      if (record.verified and record.usedForToken) {
        platformTreasuryFees += record.amount;
      };
    };

    let totalUsers = OrderedMap.Make<Principal>(Principal.compare).size(userProfiles);

    {
      totalTokensCreated;
      totalSupplyAcrossTokens;
      platformTreasuryFees;
      totalUsers;
    };
  };

  public type PaymentResult = {
    #success : { paymentId : Nat; message : Text };
    #error : { message : Text };
  };

  public shared ({ caller }) func recordPayment(amount : Nat, treasuryAddress : Text) : async PaymentResult {
    try {
      // AUTHORIZATION: Only authenticated users can record payments
      if (Principal.isAnonymous(caller)) {
        return #error { message = "Unauthorized: Anonymous users cannot record payments" };
      };
      if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
        return #error { message = "Unauthorized: Only authenticated users can record payments" };
      };

      // AUTHORIZATION: Developer wallet is exempt from payment requirements
      if (isDeveloperWallet(caller)) {
        return #error { message = "Developer wallet is exempt from mint fees" };
      };

      // AUTHORIZATION: Validate payment amount EXACTLY before recording
      if (amount != MINT_FEE_AMOUNT) {
        logError("recordPayment", "Invalid payment amount: " # Nat.toText(amount), caller);
        return #error { message = "Unauthorized: Payment amount must be exactly 1 ICP (1,000,000,000 e8s)" };
      };

      // AUTHORIZATION: Validate treasury address matches the required address EXACTLY
      if (treasuryAddress != TREASURY_ADDRESS) {
        logError("recordPayment", "Invalid treasury address: " # treasuryAddress, caller);
        return #error { message = "Unauthorized: Payments must be sent to the official treasury wallet" };
      };

      // AUTHORIZATION: Rate limiting to prevent spam
      let callerText = Principal.toText(caller);
      let now = Time.now();
      let minInterval : Time.Time = 5_000_000_000; // 5 seconds

      switch (OrderedMap.Make<Text>(Text.compare).get(lastPaymentTime, callerText)) {
        case (?lastTime) {
          if (now - lastTime < minInterval) {
            return #error { message = "Rate limit: Please wait before recording another payment" };
          };
        };
        case (null) {};
      };

      let paymentId = nextPaymentId;
      let record : PaymentRecord = {
        payer = caller;
        amount;
        timestamp = now;
        verified = false;
        tokenSymbol = null;
        usedForToken = false;
        treasuryAddressUsed = treasuryAddress;
        errorMessage = null;
      };
      paymentRecords := OrderedMap.Make<Nat>(Nat.compare).put(paymentRecords, paymentId, record);
      nextPaymentId += 1;
      lastPaymentTime := OrderedMap.Make<Text>(Text.compare).put(lastPaymentTime, callerText, now);

      Debug.print("Payment recorded successfully - PaymentID: " # Nat.toText(paymentId) # " | Payer: " # Principal.toText(caller) # " | Amount: " # Nat.toText(amount));

      #success { paymentId; message = "Payment recorded successfully" };
    } catch (e) {
      logError("recordPayment", "Unexpected error during payment recording: " # Error.message(e), caller);
      #error { message = "An unexpected error occurred while recording payment. Please try again." };
    };
  };

  public type TokenCreationResult = {
    #success : { message : Text; canisterId : Text };
    #error : { message : Text };
  };

  public type TreasuryFeeConfig = {
    treasuryAddress : Text;
    buyFee : Nat;
    sellFee : Nat;
    enabled : Bool;
  };

  public type TokenConfig = {
    name : Text;
    symbol : Text;
    description : Text;
    totalSupply : Nat;
    decimals : Nat;
    treasuryFee : TreasuryFeeConfig;
    taxModules : TaxModules;
    moduleConfigs : [ModuleConfig];
    mediaUrl : Text;
    thumbnailUrl : Text;
    status : TokenStatus;
    circulatingSupply : Nat;
    rewardTokenAddress : ?Text;
    tokenAddress : ?Text;
    validationTimestamp : ?Time.Time;
    testingStatus : ?TestingStatus;
    communityExplorer : Bool;
    aiAgentCompatible : Bool;
    mediaType : MediaType;
    chartUrl : Text;
    creatorName : Text;
    creatorProfileUrl : Text;
    tags : [Text];
    featured : Bool;
    customFields : [CustomField];
    emblemAspectRatio : ?Nat;
    emblemProcessingMetadata : ?EmblemProcessingMetadata;
    paymentId : ?Nat;
  };

  public shared ({ caller }) func createToken(config : TokenConfig) : async TokenCreationResult {
    var paymentIdToUse : ?Nat = null;

    try {
      // AUTHORIZATION: Only authenticated users can create tokens
      if (Principal.isAnonymous(caller)) {
        return #error { message = "Unauthorized: Anonymous users cannot create tokens" };
      };
      if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
        return #error { message = "Unauthorized: Only authenticated users can create tokens" };
      };

      // AUTHORIZATION: Rate limiting for token creation
      let callerText = Principal.toText(caller);
      let now = Time.now();
      switch (OrderedMap.Make<Text>(Text.compare).get(lastTokenCreation, callerText)) {
        case (?lastTime) {
          if (now - lastTime < TOKEN_CREATION_RATE_LIMIT) {
            return #error { message = "Rate limit: Please wait before creating another token" };
          };
        };
        case (null) {};
      };

      // AUTHORIZATION: Validate and sanitize token name and symbol first (needed for payment marking)
      let sanitizedName = sanitizeText(config.name);
      let sanitizedSymbol = sanitizeText(config.symbol);

      if (Text.size(sanitizedName) == 0 or Text.size(sanitizedName) > 100) {
        return #error { message = "Token name must be between 1 and 100 characters" };
      };
      if (Text.size(sanitizedSymbol) == 0 or Text.size(sanitizedSymbol) > 10) {
        return #error { message = "Token symbol must be between 1 and 10 characters" };
      };

      // AUTHORIZATION: Prevent duplicate token symbols
      switch (OrderedMap.Make<Text>(Text.compare).get(tokenRegistry, sanitizedSymbol)) {
        case (?_) { return #error { message = "Token with this symbol already exists" } };
        case (null) {};
      };

      // AUTHORIZATION: Validate total supply is reasonable
      if (config.totalSupply == 0 or config.totalSupply > 1_000_000_000_000_000) {
        return #error { message = "Total supply must be between 1 and 1 quadrillion" };
      };

      // AUTHORIZATION: Validate decimals
      if (config.decimals > 18) {
        return #error { message = "Decimals cannot exceed 18" };
      };

      // AUTHORIZATION: CRITICAL - Verify payment before allowing token creation
      let mintFeePaid = if (isDeveloperWallet(caller)) {
        Debug.print("Developer wallet creating token - fee exempt | Caller: " # Principal.toText(caller));
        true; // Developer wallet is exempt
      } else {
        // Non-developer users MUST provide a valid, verified, unused payment
        switch (config.paymentId) {
          case (null) {
            logError("createToken", "No payment ID provided", caller);
            return #error { message = "Unauthorized: Payment ID required for token creation" };
          };
          case (?paymentId) {
            // AUTHORIZATION: Check if payment is already locked (race condition prevention)
            switch (OrderedMap.Make<Nat>(Nat.compare).get(paymentLocks, paymentId)) {
              case (?true) {
                logError("createToken", "Payment already locked - PaymentID: " # Nat.toText(paymentId), caller);
                return #error { message = "Unauthorized: Payment is already being used by another transaction" };
              };
              case (_) {
                // Lock the payment to prevent concurrent usage
                paymentLocks := OrderedMap.Make<Nat>(Nat.compare).put(paymentLocks, paymentId, true);
              };
            };

            switch (OrderedMap.Make<Nat>(Nat.compare).get(paymentRecords, paymentId)) {
              case (null) {
                // Release lock on error
                releasePaymentLock(paymentId);
                logError("createToken", "Payment record not found - PaymentID: " # Nat.toText(paymentId), caller);
                return #error { message = "Unauthorized: Payment record not found" };
              };
              case (?record) {
                // AUTHORIZATION: CRITICAL - Verify payment ownership matches caller
                if (record.payer != caller) {
                  releasePaymentLock(paymentId);
                  logError("createToken", "Payment ownership mismatch - PaymentID: " # Nat.toText(paymentId) # " | Payer: " # Principal.toText(record.payer), caller);
                  return #error { message = "Unauthorized: Payment does not belong to caller" };
                };
                // AUTHORIZATION: Verify payment is verified by admin
                if (not record.verified) {
                  releasePaymentLock(paymentId);
                  logError("createToken", "Payment not verified - PaymentID: " # Nat.toText(paymentId), caller);
                  return #error { message = "Unauthorized: Payment not yet verified by admin. Please wait for admin verification." };
                };
                // AUTHORIZATION: Verify payment amount EXACTLY
                if (record.amount != MINT_FEE_AMOUNT) {
                  releasePaymentLock(paymentId);
                  logError("createToken", "Invalid payment amount - PaymentID: " # Nat.toText(paymentId) # " | Amount: " # Nat.toText(record.amount), caller);
                  return #error { message = "Unauthorized: Payment amount does not match required mint fee (1 ICP)" };
                };
                // AUTHORIZATION: Verify treasury address EXACTLY
                if (record.treasuryAddressUsed != TREASURY_ADDRESS) {
                  releasePaymentLock(paymentId);
                  logError("createToken", "Invalid treasury address - PaymentID: " # Nat.toText(paymentId) # " | Address: " # record.treasuryAddressUsed, caller);
                  return #error { message = "Unauthorized: Payment was not sent to the correct treasury address" };
                };
                // AUTHORIZATION: Verify payment hasn't been used
                if (record.usedForToken) {
                  releasePaymentLock(paymentId);
                  logError("createToken", "Payment already used - PaymentID: " # Nat.toText(paymentId), caller);
                  return #error { message = "Unauthorized: Payment has already been used for another token" };
                };
                // AUTHORIZATION: Verify payment is recent
                if (now - record.timestamp > PAYMENT_VALIDITY_WINDOW) {
                  releasePaymentLock(paymentId);
                  logError("createToken", "Payment expired - PaymentID: " # Nat.toText(paymentId) # " | Timestamp: " # Int.toText(record.timestamp), caller);
                  return #error { message = "Unauthorized: Payment has expired (must be used within 1 hour of verification)" };
                };

                // Mark payment as used IMMEDIATELY to prevent race conditions
                let updatedPayment : PaymentRecord = {
                  payer = record.payer;
                  amount = record.amount;
                  timestamp = record.timestamp;
                  verified = record.verified;
                  tokenSymbol = ?sanitizedSymbol;
                  usedForToken = true;
                  treasuryAddressUsed = record.treasuryAddressUsed;
                  errorMessage = null;
                };
                paymentRecords := OrderedMap.Make<Nat>(Nat.compare).put(paymentRecords, paymentId, updatedPayment);
                paymentIdToUse := ?paymentId;

                Debug.print("Payment verified and marked as used - PaymentID: " # Nat.toText(paymentId) # " | Caller: " # Principal.toText(caller) # " | Symbol: " # sanitizedSymbol);

                true; // Payment verified and marked as used
              };
            };
          };
        };
      };

      // AUTHORIZATION: Validate treasury fee configuration
      if (config.treasuryFee.enabled) {
        if (config.treasuryFee.buyFee > 5000 or config.treasuryFee.sellFee > 5000) {
          // Release payment lock on error
          switch (paymentIdToUse) {
            case (?pid) { releasePaymentLock(pid) };
            case (null) {};
          };
          return #error { message = "Treasury fees cannot exceed 50% (5000 basis points)" };
        };
        // AUTHORIZATION: Validate treasury address format if provided
        if (config.treasuryFee.treasuryAddress != "" and not isValidPrincipal(config.treasuryFee.treasuryAddress)) {
          // Release payment lock on error
          switch (paymentIdToUse) {
            case (?pid) { releasePaymentLock(pid) };
            case (null) {};
          };
          return #error { message = "Invalid treasury address format" };
        };
      };

      // AUTHORIZATION: Validate module configurations
      for (moduleConfig in Iter.fromArray(config.moduleConfigs)) {
        // AUTHORIZATION: Validate tax percentages
        if (moduleConfig.buyTax > 5000 or moduleConfig.sellTax > 5000) {
          // Release payment lock on error
          switch (paymentIdToUse) {
            case (?pid) { releasePaymentLock(pid) };
            case (null) {};
          };
          return #error { message = "Module tax cannot exceed 50% (5000 basis points)" };
        };

        // Validate reward token addresses for Yield modules
        switch (moduleConfig.rewardTokenAddress) {
          case (?address) {
            if (address != "" and not isValidPrincipal(address)) {
              // Release payment lock on error
              switch (paymentIdToUse) {
                case (?pid) { releasePaymentLock(pid) };
                case (null) {};
              };
              return #error { message = "Invalid reward token address format in module configuration" };
            };
          };
          case (null) {};
        };

        // AUTHORIZATION: Validate token addresses for Support modules
        switch (moduleConfig.tokenAddress) {
          case (?address) {
            if (address != "" and not isValidPrincipal(address)) {
              // Release payment lock on error
              switch (paymentIdToUse) {
                case (?pid) { releasePaymentLock(pid) };
                case (null) {};
              };
              return #error { message = "Invalid token address format in Support module configuration" };
            };
          };
          case (null) {};
        };
      };

      // AUTHORIZATION: Validate tax totals
      let (totalBuyTax, totalSellTax) = calculateTotalTax(config.moduleConfigs);

      if (totalBuyTax < MIN_TOTAL_TAX or totalBuyTax > MAX_TOTAL_TAX) {
        // Release payment lock on error
        switch (paymentIdToUse) {
          case (?pid) { releasePaymentLock(pid) };
          case (null) {};
        };
        return #error { message = "Total buy tax must be between 0.25% and 25%" };
      };
      if (totalSellTax < MIN_TOTAL_TAX or totalSellTax > MAX_TOTAL_TAX) {
        // Release payment lock on error
        switch (paymentIdToUse) {
          case (?pid) { releasePaymentLock(pid) };
          case (null) {};
        };
        return #error { message = "Total sell tax must be between 0.25% and 25%" };
      };

      // Update reflection modules to use the token's own canister ID (caller)
      let updatedModuleConfigs = Array.map<ModuleConfig, ModuleConfig>(
        config.moduleConfigs,
        func(moduleConfig : ModuleConfig) : ModuleConfig {
          switch (moduleConfig.moduleType) {
            case (#reflection) {
              {
                moduleConfig with
                reflectionTarget = ?caller;
              };
            };
            case (_) { moduleConfig };
          };
        },
      );

      // AUTHORIZATION: Always use authenticated caller as creator (ignore config.creator from frontend)
      // AUTHORIZATION: Developer wallet gets special whitelist flag
      let metadata : TokenMetadata = {
        name = sanitizedName;
        symbol = sanitizedSymbol;
        description = sanitizeText(config.description);
        totalSupply = config.totalSupply;
        decimals = config.decimals;
        buyTax = totalBuyTax;
        sellTax = totalSellTax;
        creator = caller;
        deployedAt = now;
        canisterId = caller;
        treasuryFee = (if (config.treasuryFee.enabled) config.treasuryFee.buyFee else 0);
        treasuryAddress = config.treasuryFee.treasuryAddress;
        mintFeePaid;
        taxModules = config.taxModules;
        moduleConfigs = updatedModuleConfigs;
        mediaUrl = config.mediaUrl;
        thumbnailUrl = config.thumbnailUrl;
        status = config.status;
        circulatingSupply = config.circulatingSupply;
        rewardTokenAddress = config.rewardTokenAddress;
        tokenAddress = config.tokenAddress;
        validationTimestamp = config.validationTimestamp;
        testingStatus = config.testingStatus;
        communityExplorer = true;
        aiAgentCompatible = config.aiAgentCompatible;
        mediaType = config.mediaType;
        chartUrl = config.chartUrl;
        creatorName = sanitizeText(config.creatorName);
        creatorProfileUrl = config.creatorProfileUrl;
        createdAt = now;
        lastUpdated = now;
        views = 0;
        likes = 0;
        comments = [];
        tags = Array.map<Text, Text>(config.tags, sanitizeText);
        featured = config.featured;
        trendingScore = 0;
        popularityScore = 0;
        verified = false;
        auditStatus = #pending;
        customFields = config.customFields;
        version = 4;
        emblemAspectRatio = config.emblemAspectRatio;
        emblemProcessingMetadata = config.emblemProcessingMetadata;
        totalBuyTax;
        totalSellTax;
        liquidityBurnAddress = LIQUIDITY_BURN_ADDRESS;
        developerWalletWhitelisted = isDeveloperWallet(caller);
        fixedTreasuryFee = FIXED_TREASURY_FEE;
        paymentId = paymentIdToUse;
      };

      tokenRegistry := OrderedMap.Make<Text>(Text.compare).put(tokenRegistry, sanitizedSymbol, metadata);
      lastTokenCreation := OrderedMap.Make<Text>(Text.compare).put(lastTokenCreation, callerText, now);

      // Release payment lock after successful token creation
      switch (paymentIdToUse) {
        case (?pid) { releasePaymentLock(pid) };
        case (null) {};
      };

      Debug.print("Token created successfully - Symbol: " # sanitizedSymbol # " | Creator: " # Principal.toText(caller) # " | CanisterID: " # Principal.toText(caller));

      #success {
        message = "Token created successfully";
        canisterId = Principal.toText(caller);
      };
    } catch (e) {
      // Release payment lock on any error
      switch (paymentIdToUse) {
        case (?pid) { releasePaymentLock(pid) };
        case (null) {};
      };

      logError("createToken", "Unexpected error during token creation: " # Error.message(e), caller);
      #error { message = "An unexpected error occurred during token creation. Please try again or contact support." };
    };
  };

  public type VerifyPaymentResult = {
    #success : { message : Text };
    #error : { message : Text };
  };

  public shared ({ caller }) func verifyPaymentWithLedger(transactionId : Text, paymentId : Nat) : async VerifyPaymentResult {
    try {
      // AUTHORIZATION: Ensure system is initialized
      if (not isInitialized) {
        return #error { message = "Unauthorized: Access control not initialized" };
      };

      // AUTHORIZATION: Only admins can verify payments with ledger (prevents user manipulation)
      if (Principal.isAnonymous(caller)) {
        return #error { message = "Unauthorized: Anonymous users cannot verify payments with ledger" };
      };
      if (not AccessControl.isAdmin(accessControlState, caller)) {
        return #error { message = "Unauthorized: Only admins can verify payments with ledger" };
      };

      // AUTHORIZATION: Validate transaction ID format
      if (Text.size(transactionId) == 0 or Text.size(transactionId) > 100) {
        return #error { message = "Invalid transaction ID format" };
      };

      // Verify payment exists
      let record = switch (OrderedMap.Make<Nat>(Nat.compare).get(paymentRecords, paymentId)) {
        case (null) {
          logError("verifyPaymentWithLedger", "Payment record not found - PaymentID: " # Nat.toText(paymentId), caller);
          return #error { message = "Payment record not found" };
        };
        case (?r) { r };
      };

      // AUTHORIZATION: Prevent re-verification
      if (record.verified) {
        return #error { message = "Payment already verified" };
      };

      // AUTHORIZATION: Validate payment amount EXACTLY
      if (record.amount != MINT_FEE_AMOUNT) {
        logError("verifyPaymentWithLedger", "Invalid payment amount - PaymentID: " # Nat.toText(paymentId) # " | Amount: " # Nat.toText(record.amount), caller);
        return #error { message = "Payment amount does not match required mint fee (1 ICP)" };
      };

      // AUTHORIZATION: Validate treasury address EXACTLY
      if (record.treasuryAddressUsed != TREASURY_ADDRESS) {
        logError("verifyPaymentWithLedger", "Invalid treasury address - PaymentID: " # Nat.toText(paymentId) # " | Address: " # record.treasuryAddressUsed, caller);
        return #error { message = "Payment was not sent to the correct treasury address" };
      };

      // AUTHORIZATION: Prevent verification for developer wallet
      if (isDeveloperWallet(record.payer)) {
        return #error { message = "Developer wallet payments cannot be verified (exempt from fees)" };
      };

      // AUTHORIZATION: Prevent verification for anonymous principals
      if (Principal.isAnonymous(record.payer)) {
        return #error { message = "Cannot verify payments from anonymous principals" };
      };

      let ledgerUrl = "https://icp0.io/ledger/transaction/" # transactionId;
      let response = await OutCall.httpGetRequest(ledgerUrl, [], transform);

      let hasSuccess = Text.contains(response, #text "success");
      let hasCorrectAddress = Text.contains(response, #text (TREASURY_ADDRESS));
      let hasCorrectAmount = Text.contains(response, #text (Nat.toText(MINT_FEE_AMOUNT)));

      let isValid = hasSuccess and hasCorrectAddress and hasCorrectAmount;

      if (isValid) {
        let updatedRecord : PaymentRecord = {
          payer = record.payer;
          amount = record.amount;
          timestamp = record.timestamp;
          verified = true;
          tokenSymbol = record.tokenSymbol;
          usedForToken = record.usedForToken;
          treasuryAddressUsed = record.treasuryAddressUsed;
          errorMessage = null;
        };
        paymentRecords := OrderedMap.Make<Nat>(Nat.compare).put(paymentRecords, paymentId, updatedRecord);

        Debug.print("Payment verified successfully - PaymentID: " # Nat.toText(paymentId) # " | Payer: " # Principal.toText(record.payer) # " | TransactionID: " # transactionId);

        #success { message = "Payment verified successfully" };
      } else {
        let errorMsg = "Payment verification failed - transaction does not match requirements";
        logError("verifyPaymentWithLedger", errorMsg # " - PaymentID: " # Nat.toText(paymentId) # " | TransactionID: " # transactionId, caller);

        let updatedRecord : PaymentRecord = {
          payer = record.payer;
          amount = record.amount;
          timestamp = record.timestamp;
          verified = false;
          tokenSymbol = record.tokenSymbol;
          usedForToken = record.usedForToken;
          treasuryAddressUsed = record.treasuryAddressUsed;
          errorMessage = ?errorMsg;
        };
        paymentRecords := OrderedMap.Make<Nat>(Nat.compare).put(paymentRecords, paymentId, updatedRecord);

        #error { message = errorMsg };
      };
    } catch (e) {
      logError("verifyPaymentWithLedger", "Unexpected error during payment verification: " # Error.message(e), caller);
      #error { message = "An unexpected error occurred during payment verification. Please try again." };
    };
  };

  // DEPRECATED: This function is no longer needed as payment verification happens in createToken
  public shared ({ caller }) func markMintFeePaid(symbol : Text, paymentId : Nat) : async () {
    Debug.trap("Deprecated: Payment verification now happens during token creation");
  };

  // Public query - no authentication required for donation address
  public query func getBuyMeACoffeeAddress() : async Text {
    TREASURY_ADDRESS;
  };

  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  var stripeConfig : ?Stripe.StripeConfiguration = null;

  public query ({ caller }) func isStripeConfigured() : async Bool {
    // AUTHORIZATION: Only authenticated users can check Stripe configuration
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot check Stripe configuration");
    };
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can check Stripe configuration");
    };
    stripeConfig != null;
  };

  public shared ({ caller }) func setStripeConfiguration(config : Stripe.StripeConfiguration) : async () {
    // AUTHORIZATION: Ensure system is initialized
    if (not isInitialized) {
      Debug.trap("Unauthorized: Access control not initialized");
    };

    // AUTHORIZATION: Only admins can set Stripe configuration
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot set Stripe configuration");
    };
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can set Stripe configuration");
    };
    stripeConfig := ?config;
  };

  func getStripeConfiguration() : Stripe.StripeConfiguration {
    switch (stripeConfig) {
      case (null) { Debug.trap("Stripe configuration not set") };
      case (?config) { config };
    };
  };

  public shared ({ caller }) func getStripeSessionStatus(sessionId : Text) : async Stripe.StripeSessionStatus {
    // AUTHORIZATION: Only authenticated users can check Stripe session status
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot check Stripe session status");
    };
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can check Stripe session status");
    };

    // AUTHORIZATION: Validate session ID format
    if (Text.size(sessionId) == 0 or Text.size(sessionId) > 200) {
      Debug.trap("Invalid session ID format");
    };

    await Stripe.getSessionStatus(getStripeConfiguration(), sessionId, transform);
  };

  public shared ({ caller }) func createCheckoutSession(items : [Stripe.ShoppingItem], successUrl : Text, cancelUrl : Text) : async Text {
    // AUTHORIZATION: Only authenticated users can create checkout sessions
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot create checkout sessions");
    };
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can create checkout sessions");
    };

    // AUTHORIZATION: Validate URLs
    if (Text.size(successUrl) == 0 or Text.size(successUrl) > 500) {
      Debug.trap("Invalid success URL");
    };
    if (Text.size(cancelUrl) == 0 or Text.size(cancelUrl) > 500) {
      Debug.trap("Invalid cancel URL");
    };

    await Stripe.createCheckoutSession(getStripeConfiguration(), caller, items, successUrl, cancelUrl, transform);
  };

  // New query function to get payment record by ID
  public query ({ caller }) func getPaymentRecord(paymentId : Nat) : async ?PaymentRecord {
    // AUTHORIZATION: Only authenticated users can get payment records
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot get payment records");
    };
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can get payment records");
    };

    switch (OrderedMap.Make<Nat>(Nat.compare).get(paymentRecords, paymentId)) {
      case (null) { null };
      case (?record) {
        // Only allow the payer or admin to view the record
        if (record.payer == caller or AccessControl.isAdmin(accessControlState, caller)) {
          ?record;
        } else {
          Debug.trap("Unauthorized: Can only view your own payment records");
        };
      };
    };
  };

  // New query function to get total token count
  public query func getTokenCount() : async Nat {
    OrderedMap.Make<Text>(Text.compare).size(tokenRegistry);
  };

  // New query function to get treasury address
  public query func getTreasuryAddress() : async Text {
    TREASURY_ADDRESS;
  };

  // New query function to get creation fee amount
  public query func getCreationFee() : async Nat {
    MINT_FEE_AMOUNT;
  };
};

