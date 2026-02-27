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

  // Hardcoded permanent admin principal - must always have admin role
  let HARDCODED_ADMIN_PRINCIPAL : Text = "r7e75-6gjbk-2hu53-tcwcn-gppkv-2prfn-os6xt-eocak-oy4sa-qnejo-kae";

  var isInitialized : Bool = false;
  var paymentLocks = OrderedMap.Make<Nat>(Nat.compare).empty<Bool>();
  var lastTokenCreation = OrderedMap.Make<Text>(Text.compare).empty<Time.Time>();

  func sanitizeText(input : Text) : Text {
    let chars = Text.toArray(input);
    let sanitized = Array.filter<Char>(chars, func(c : Char) : Bool {
      let code = Char.toNat32(c);
      (code >= 32 and code <= 126) or code == 10 or code == 13
    });
    Text.fromArray(sanitized);
  };

  func isDeveloperWallet(caller : Principal) : Bool {
    Principal.toText(caller) == DEVELOPER_WALLET;
  };

  func logError(context : Text, error : Text, caller : Principal) {
    Debug.print("ERROR [" # context # "] Caller: " # Principal.toText(caller) # " | " # error);
  };

  // Ensure the hardcoded admin always has the admin role.
  // This is called after AccessControl.initialize so that the initializing caller
  // is already an admin and can assign roles.
  func ensureHardcodedAdmin(initializingCaller : Principal) {
    let hardcodedAdmin = Principal.fromText(HARDCODED_ADMIN_PRINCIPAL);
    AccessControl.assignRole(
      accessControlState,
      initializingCaller,
      hardcodedAdmin,
      #admin,
    );
  };

  public shared ({ caller }) func initializeAccessControl() : async () {
    let isTreasuryPrincipal = Principal.toText(caller) == TREASURY_ADDRESS;
    if (not isInitialized or isTreasuryPrincipal) {
      if (Principal.isAnonymous(caller)) {
        Debug.trap("Unauthorized: Anonymous principals cannot initialize access control");
      };
      // First call to initialize makes caller an admin
      AccessControl.initialize(accessControlState, caller);

      // Ensure the hardcoded permanent admin is always assigned
      ensureHardcodedAdmin(caller);

      isInitialized := true;
    } else {
      Debug.trap("Unauthorized: Access control already initialized");
    };
  };

  public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
    AccessControl.getUserRole(accessControlState, caller);
  };

  public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
    if (not isInitialized) {
      Debug.trap("Unauthorized: Access control not initialized");
    };

    if (Principal.isAnonymous(user)) {
      Debug.trap("Unauthorized: Cannot assign roles to anonymous principals");
    };

    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous principals cannot assign roles");
    };

    // Prevent removing admin role from the hardcoded admin
    if (Principal.toText(user) == HARDCODED_ADMIN_PRINCIPAL and role != #admin) {
      Debug.trap("Unauthorized: Cannot remove admin role from the permanent hardcoded admin");
    };

    // Admin-only check is enforced inside AccessControl.assignRole
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
    if (Principal.isAnonymous(caller)) {
      return null;
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can view profiles");
    };

    switch (OrderedMap.Make<Principal>(Principal.compare).get(userProfiles, caller)) {
      case (?profile) { ?profile };
      case (null) {
        findProfileByPrincipal(caller);
      };
    };
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot view profiles");
    };
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Debug.trap("Unauthorized: Can only view your own profile");
    };
    OrderedMap.Make<Principal>(Principal.compare).get(userProfiles, user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot save profiles");
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can save profiles");
    };

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

    switch (findProfileByPrincipal(caller)) {
      case (?_existingProfile) {
        let updatedProfile = linkPrincipalToProfile(sanitizedProfile, caller);
        userProfiles := OrderedMap.Make<Principal>(Principal.compare).put(userProfiles, caller, updatedProfile);
      };
      case (null) {
        userProfiles := OrderedMap.Make<Principal>(Principal.compare).put(userProfiles, caller, sanitizedProfile);
      };
    };
  };

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

  var tokenRegistry = OrderedMap.Make<Text>(Text.compare).empty<TokenMetadata>();
  var paymentRecords = OrderedMap.Make<Nat>(Nat.compare).empty<PaymentRecord>();
  var nextPaymentId : Nat = 0;

  var userLikes = OrderedMap.Make<Text>(Text.compare).empty<[Text]>();
  var lastViewIncrement = OrderedMap.Make<Text>(Text.compare).empty<Time.Time>();
  var lastCommentTime = OrderedMap.Make<Text>(Text.compare).empty<Time.Time>();
  var lastPaymentTime = OrderedMap.Make<Text>(Text.compare).empty<Time.Time>();

  var userTotalLikes = OrderedMap.Make<Text>(Text.compare).empty<Nat>();
  var userTotalComments = OrderedMap.Make<Text>(Text.compare).empty<Nat>();
  var userTotalViews = OrderedMap.Make<Text>(Text.compare).empty<Nat>();

  let MAX_LIKES_PER_USER : Nat = 1000;
  let MAX_COMMENTS_PER_USER : Nat = 500;
  let MAX_VIEWS_PER_USER_PER_DAY : Nat = 10000;

  func isValidPrincipal(principalText : Text) : Bool {
    if (Text.size(principalText) == 0 or Text.size(principalText) > 100) {
      return false;
    };
    switch (Principal.fromText(principalText)) {
      case (_) { true };
    };
  };

  func calculateTotalTax(moduleConfigs : [ModuleConfig]) : (Nat, Nat) {
    var totalBuyTax : Nat = 0;
    var totalSellTax : Nat = 0;
    for (config in Iter.fromArray(moduleConfigs)) {
      totalBuyTax += config.buyTax;
      totalSellTax += config.sellTax;
    };
    (totalBuyTax, totalSellTax);
  };

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

  func calculateTotalFeesPaid(payer : Principal) : Nat {
    var total : Nat = 0;
    for ((_, record) in OrderedMap.Make<Nat>(Nat.compare).entries(paymentRecords)) {
      if (record.payer == payer and record.verified and record.usedForToken) {
        total += record.amount;
      };
    };
    total;
  };

  func releasePaymentLock(paymentId : Nat) {
    paymentLocks := OrderedMap.Make<Nat>(Nat.compare).delete(paymentLocks, paymentId);
  };

  public shared ({ caller }) func registerToken(metadata : TokenMetadata) : async () {
    if (not isInitialized) {
      Debug.trap("Unauthorized: Access control not initialized");
    };

    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot register tokens");
    };

    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can register tokens directly");
    };

    if (not isDeveloperWallet(metadata.creator)) {
      if (not metadata.mintFeePaid) {
        Debug.trap("Unauthorized: Mint fee must be paid before registering token");
      };
    };

    if (metadata.totalBuyTax < MIN_TOTAL_TAX or metadata.totalBuyTax > MAX_TOTAL_TAX) {
      Debug.trap("Total buy tax must be between 0.25% and 25%");
    };
    if (metadata.totalSellTax < MIN_TOTAL_TAX or metadata.totalSellTax > MAX_TOTAL_TAX) {
      Debug.trap("Total sell tax must be between 0.25% and 25%");
    };

    if (Principal.isAnonymous(metadata.creator)) {
      Debug.trap("Unauthorized: Token creator cannot be anonymous");
    };

    tokenRegistry := OrderedMap.Make<Text>(Text.compare).put(tokenRegistry, metadata.symbol, metadata);
  };

  public query ({ caller }) func getToken(symbol : Text) : async ?TokenMetadata {
    switch (OrderedMap.Make<Text>(Text.compare).get(tokenRegistry, symbol)) {
      case (null) { null };
      case (?metadata) {
        if (metadata.communityExplorer and metadata.status == #active) {
          ?metadata;
        } else {
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

  // Admin-only: returns all tokens including private ones
  public query ({ caller }) func getAllTokens() : async [TokenMetadata] {
    if (not isInitialized) {
      Debug.trap("Unauthorized: Access control not initialized");
    };
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot list all tokens");
    };
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can list all tokens");
    };
    var tokens : [TokenMetadata] = [];
    for ((_, metadata) in OrderedMap.Make<Text>(Text.compare).entries(tokenRegistry)) {
      tokens := Array.append(tokens, [metadata]);
    };
    tokens;
  };

  // Public: returns only community-explorer active tokens
  public query func getForgedTokens() : async [TokenMetadata] {
    var tokens : [TokenMetadata] = [];
    for ((_, metadata) in OrderedMap.Make<Text>(Text.compare).entries(tokenRegistry)) {
      if (metadata.communityExplorer and metadata.status == #active) {
        tokens := Array.append(tokens, [metadata]);
      };
    };
    tokens;
  };

  public query func lookupToken(canisterId : Text) : async ?TokenMetadata {
    if (not isValidPrincipal(canisterId)) {
      return null;
    };

    for ((_, metadata) in OrderedMap.Make<Text>(Text.compare).entries(tokenRegistry)) {
      if (Principal.toText(metadata.canisterId) == canisterId) {
        if (metadata.communityExplorer and metadata.status == #active) {
          return ?metadata;
        };
      };
    };
    null;
  };

  public query ({ caller }) func getUserActivityMetrics() : async UserActivityMetrics {
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
      if (Principal.isAnonymous(caller)) {
        return #error { message = "Unauthorized: Anonymous users cannot record payments" };
      };
      if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
        return #error { message = "Unauthorized: Only authenticated users can record payments" };
      };

      if (isDeveloperWallet(caller)) {
        return #error { message = "Developer wallet is exempt from mint fees" };
      };

      if (amount != MINT_FEE_AMOUNT) {
        logError("recordPayment", "Invalid payment amount: " # Nat.toText(amount), caller);
        return #error { message = "Unauthorized: Payment amount must be exactly 1 ICP (1,000,000,000 e8s)" };
      };

      if (treasuryAddress != TREASURY_ADDRESS) {
        logError("recordPayment", "Invalid treasury address: " # treasuryAddress, caller);
        return #error { message = "Unauthorized: Payments must be sent to the official treasury wallet" };
      };

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
      if (Principal.isAnonymous(caller)) {
        return #error { message = "Unauthorized: Anonymous users cannot create tokens" };
      };
      if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
        return #error { message = "Unauthorized: Only authenticated users can create tokens" };
      };

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

      let sanitizedName = sanitizeText(config.name);
      let sanitizedSymbol = sanitizeText(config.symbol);

      if (Text.size(sanitizedName) == 0 or Text.size(sanitizedName) > 100) {
        return #error { message = "Token name must be between 1 and 100 characters" };
      };
      if (Text.size(sanitizedSymbol) == 0 or Text.size(sanitizedSymbol) > 10) {
        return #error { message = "Token symbol must be between 1 and 10 characters" };
      };

      switch (OrderedMap.Make<Text>(Text.compare).get(tokenRegistry, sanitizedSymbol)) {
        case (?_) { return #error { message = "Token with this symbol already exists" } };
        case (null) {};
      };

      if (config.totalSupply == 0 or config.totalSupply > 1_000_000_000_000_000) {
        return #error { message = "Total supply must be between 1 and 1 quadrillion" };
      };

      if (config.decimals > 18) {
        return #error { message = "Decimals cannot exceed 18" };
      };

      let mintFeePaid = if (isDeveloperWallet(caller)) {
        Debug.print("Developer wallet creating token - fee exempt | Caller: " # Principal.toText(caller));
        true;
      } else {
        switch (config.paymentId) {
          case (null) {
            logError("createToken", "No payment ID provided", caller);
            return #error { message = "Unauthorized: Payment ID required for token creation" };
          };
          case (?paymentId) {
            switch (OrderedMap.Make<Nat>(Nat.compare).get(paymentLocks, paymentId)) {
              case (?true) {
                logError("createToken", "Payment already locked - PaymentID: " # Nat.toText(paymentId), caller);
                return #error { message = "Unauthorized: Payment is already being used by another transaction" };
              };
              case (_) {
                paymentLocks := OrderedMap.Make<Nat>(Nat.compare).put(paymentLocks, paymentId, true);
              };
            };

            switch (OrderedMap.Make<Nat>(Nat.compare).get(paymentRecords, paymentId)) {
              case (null) {
                releasePaymentLock(paymentId);
                logError("createToken", "Payment record not found - PaymentID: " # Nat.toText(paymentId), caller);
                return #error { message = "Unauthorized: Payment record not found" };
              };
              case (?record) {
                if (record.payer != caller) {
                  releasePaymentLock(paymentId);
                  logError("createToken", "Payment ownership mismatch - PaymentID: " # Nat.toText(paymentId) # " | Payer: " # Principal.toText(record.payer), caller);
                  return #error { message = "Unauthorized: Payment does not belong to caller" };
                };
                if (not record.verified) {
                  releasePaymentLock(paymentId);
                  logError("createToken", "Payment not verified - PaymentID: " # Nat.toText(paymentId), caller);
                  return #error { message = "Unauthorized: Payment not yet verified by admin. Please wait for admin verification." };
                };
                if (record.amount != MINT_FEE_AMOUNT) {
                  releasePaymentLock(paymentId);
                  logError("createToken", "Invalid payment amount - PaymentID: " # Nat.toText(paymentId) # " | Amount: " # Nat.toText(record.amount), caller);
                  return #error { message = "Unauthorized: Payment amount does not match required mint fee (1 ICP)" };
                };
                if (record.treasuryAddressUsed != TREASURY_ADDRESS) {
                  releasePaymentLock(paymentId);
                  logError("createToken", "Invalid treasury address - PaymentID: " # Nat.toText(paymentId) # " | Address: " # record.treasuryAddressUsed, caller);
                  return #error { message = "Unauthorized: Payment was not sent to the correct treasury address" };
                };
                if (record.usedForToken) {
                  releasePaymentLock(paymentId);
                  logError("createToken", "Payment already used - PaymentID: " # Nat.toText(paymentId), caller);
                  return #error { message = "Unauthorized: Payment has already been used for another token" };
                };
                if (now - record.timestamp > PAYMENT_VALIDITY_WINDOW) {
                  releasePaymentLock(paymentId);
                  logError("createToken", "Payment expired - PaymentID: " # Nat.toText(paymentId) # " | Timestamp: " # Int.toText(record.timestamp), caller);
                  return #error { message = "Unauthorized: Payment has expired (must be used within 1 hour of verification)" };
                };

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

                true;
              };
            };
          };
        };
      };

      if (config.treasuryFee.enabled) {
        if (config.treasuryFee.buyFee > 5000 or config.treasuryFee.sellFee > 5000) {
          switch (paymentIdToUse) {
            case (?pid) { releasePaymentLock(pid) };
            case (null) {};
          };
          return #error { message = "Treasury fees cannot exceed 50% (5000 basis points)" };
        };
        if (config.treasuryFee.treasuryAddress != "" and not isValidPrincipal(config.treasuryFee.treasuryAddress)) {
          switch (paymentIdToUse) {
            case (?pid) { releasePaymentLock(pid) };
            case (null) {};
          };
          return #error { message = "Invalid treasury address format" };
        };
      };

      for (moduleConfig in Iter.fromArray(config.moduleConfigs)) {
        if (moduleConfig.buyTax > 5000 or moduleConfig.sellTax > 5000) {
          switch (paymentIdToUse) {
            case (?pid) { releasePaymentLock(pid) };
            case (null) {};
          };
          return #error { message = "Module tax cannot exceed 50% (5000 basis points)" };
        };

        switch (moduleConfig.rewardTokenAddress) {
          case (?address) {
            if (address != "" and not isValidPrincipal(address)) {
              switch (paymentIdToUse) {
                case (?pid) { releasePaymentLock(pid) };
                case (null) {};
              };
              return #error { message = "Invalid reward token address format in module configuration" };
            };
          };
          case (null) {};
        };

        switch (moduleConfig.tokenAddress) {
          case (?address) {
            if (address != "" and not isValidPrincipal(address)) {
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

      let (totalBuyTax, totalSellTax) = calculateTotalTax(config.moduleConfigs);

      if (totalBuyTax < MIN_TOTAL_TAX or totalBuyTax > MAX_TOTAL_TAX) {
        switch (paymentIdToUse) {
          case (?pid) { releasePaymentLock(pid) };
          case (null) {};
        };
        return #error { message = "Total buy tax must be between 0.25% and 25%" };
      };
      if (totalSellTax < MIN_TOTAL_TAX or totalSellTax > MAX_TOTAL_TAX) {
        switch (paymentIdToUse) {
          case (?pid) { releasePaymentLock(pid) };
          case (null) {};
        };
        return #error { message = "Total sell tax must be between 0.25% and 25%" };
      };

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
      if (not isInitialized) {
        return #error { message = "Unauthorized: Access control not initialized" };
      };

      if (Principal.isAnonymous(caller)) {
        return #error { message = "Unauthorized: Anonymous users cannot verify payments with ledger" };
      };
      if (not AccessControl.isAdmin(accessControlState, caller)) {
        return #error { message = "Unauthorized: Only admins can verify payments with ledger" };
      };

      if (Text.size(transactionId) == 0 or Text.size(transactionId) > 100) {
        return #error { message = "Invalid transaction ID format" };
      };

      switch (OrderedMap.Make<Nat>(Nat.compare).get(paymentRecords, paymentId)) {
        case (null) {
          logError("verifyPaymentWithLedger", "Payment record not found - PaymentID: " # Nat.toText(paymentId), caller);
          return #error { message = "Payment record not found" };
        };
        case (?record) {
          if (record.verified) {
            return #error { message = "Payment already verified" };
          };

          if (record.amount != MINT_FEE_AMOUNT) {
            logError("verifyPaymentWithLedger", "Invalid payment amount - PaymentID: " # Nat.toText(paymentId) # " | Amount: " # Nat.toText(record.amount), caller);
            return #error { message = "Payment amount does not match required mint fee (1 ICP)" };
          };

          if (record.treasuryAddressUsed != TREASURY_ADDRESS) {
            logError("verifyPaymentWithLedger", "Invalid treasury address - PaymentID: " # Nat.toText(paymentId) # " | Address: " # record.treasuryAddressUsed, caller);
            return #error { message = "Payment was not sent to the correct treasury address" };
          };

          if (isDeveloperWallet(record.payer)) {
            return #error { message = "Developer wallet payments cannot be verified (exempt from fees)" };
          };

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
        };
      };
    } catch (e) {
      logError("verifyPaymentWithLedger", "Unexpected error during payment verification: " # Error.message(e), caller);
      #error { message = "An unexpected error occurred during payment verification. Please try again." };
    };
  };

  public shared ({ caller }) func markMintFeePaid(symbol : Text, paymentId : Nat) : async () {
    Debug.trap("Deprecated: Payment verification now happens during token creation");
  };

  public query func getBuyMeACoffeeAddress() : async Text {
    TREASURY_ADDRESS;
  };

  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  var stripeConfig : ?Stripe.StripeConfiguration = null;

  public query ({ caller }) func isStripeConfigured() : async Bool {
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot check Stripe configuration");
    };
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can check Stripe configuration");
    };
    stripeConfig != null;
  };

  public shared ({ caller }) func setStripeConfiguration(config : Stripe.StripeConfiguration) : async () {
    if (not isInitialized) {
      Debug.trap("Unauthorized: Access control not initialized");
    };

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
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot check Stripe session status");
    };
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can check Stripe session status");
    };

    if (Text.size(sessionId) == 0 or Text.size(sessionId) > 200) {
      Debug.trap("Invalid session ID format");
    };

    await Stripe.getSessionStatus(getStripeConfiguration(), sessionId, transform);
  };

  public shared ({ caller }) func createCheckoutSession(items : [Stripe.ShoppingItem], successUrl : Text, cancelUrl : Text) : async Text {
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot create checkout sessions");
    };
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can create checkout sessions");
    };

    if (Text.size(successUrl) == 0 or Text.size(successUrl) > 500) {
      Debug.trap("Invalid success URL");
    };
    if (Text.size(cancelUrl) == 0 or Text.size(cancelUrl) > 500) {
      Debug.trap("Invalid cancel URL");
    };

    await Stripe.createCheckoutSession(getStripeConfiguration(), caller, items, successUrl, cancelUrl, transform);
  };

  public query ({ caller }) func getPaymentRecord(paymentId : Nat) : async ?PaymentRecord {
    if (Principal.isAnonymous(caller)) {
      Debug.trap("Unauthorized: Anonymous users cannot get payment records");
    };
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only authenticated users can get payment records");
    };

    switch (OrderedMap.Make<Nat>(Nat.compare).get(paymentRecords, paymentId)) {
      case (null) { null };
      case (?record) {
        if (record.payer == caller or AccessControl.isAdmin(accessControlState, caller)) {
          ?record;
        } else {
          Debug.trap("Unauthorized: Can only view your own payment records");
        };
      };
    };
  };

  public query func getTokenCount() : async Nat {
    OrderedMap.Make<Text>(Text.compare).size(tokenRegistry);
  };

  public query func getTreasuryAddress() : async Text {
    TREASURY_ADDRESS;
  };

  public query func getCreationFee() : async Nat {
    MINT_FEE_AMOUNT;
  };
};

