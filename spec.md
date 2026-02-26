# Specification

## Summary
**Goal:** Replace outdated hex string constants in the backend with the correct ICP principal address.

**Planned changes:**
- In `backend/main.mo`, replace all occurrences of the hex string `ab6f9d02f1930037c53b781620754e804b140732f0990cc252fc604915303936` with the ICP principal `iyupi-26e6a-z56ra-6a5tz-yyj6i-kvxe4-joccp-pgapo-vpcvb-zxtmq-oae` (covers `TREASURY_ADDRESS`, `getTreasuryAddress()`, and `getBuyMeACoffeeAddress()`)
- In `backend/main.mo`, replace the `DEVELOPER_WALLET` constant value `f2ba368dff8966e6a9977354eb4c3f0f543c3cadb504dc0d4355859888bd2256` with the ICP principal `iyupi-26e6a-z56ra-6a5tz-yyj6i-kvxe4-joccp-pgapo-vpcvb-zxtmq-oae`

**User-visible outcome:** The treasury and developer wallet addresses in the backend now correctly point to the ICP principal `iyupi-26e6a-z56ra-6a5tz-yyj6i-kvxe4-joccp-pgapo-vpcvb-zxtmq-oae`, so payments and developer fee routing go to the right wallet.
