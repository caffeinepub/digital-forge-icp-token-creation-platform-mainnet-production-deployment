# Specification

## Summary
**Goal:** Hardcode the correct treasury principal and permanent admin in `backend/main.mo` by applying targeted find-and-replace patches to the existing file.

**Planned changes:**
- Replace all occurrences of the hex string `ab6f9d02...` (treasuryAddress) with the ICP principal `iyupi-26e6a-z56ra-6a5tz-yyj6i-kvxe4-joccp-pgapo-vpcvb-zxtmq-oae` everywhere in `backend/main.mo`, including the constant declaration, `getTreasuryAddress()`, `getBuyMeACoffeeAddress()`, and any inline comments
- Replace all occurrences of the hex string `f2ba368d...` (developerAddress) with the same ICP principal `iyupi-26e6a-z56ra-6a5tz-yyj6i-kvxe4-joccp-pgapo-vpcvb-zxtmq-oae` everywhere in `backend/main.mo`
- Hardcode the principal `r7e75-6gjbk-2hu53-tcwcn-gppkv-2prfn-os6xt-eocak-oy4sa-qnejo-kae` as a permanent admin in `initializeAccessControl` (or the actor's initialization block), making it non-removable at runtime
- Verify all other constants and functionality remain unchanged (`MINT_FEE_AMOUNT`, tax bounds, payment rails, rate limiting, query functions, non-stable var declarations, etc.)

**User-visible outcome:** The backend canister uses the correct ICP principals for treasury and developer addresses, and the specified principal is permanently assigned the admin role and cannot be removed, while all existing logic and constants remain intact.
