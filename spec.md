# Specification

## Summary
**Goal:** Replace all occurrences of two legacy hex treasury strings in `backend/main.mo` with the correct ICP principal.

**Planned changes:**
- In `backend/main.mo`, find and replace every occurrence of `ab6f9d02f1930037c53b781620754e804b140732f0990cc252fc604915303936` (including any substring such as `ab6f9d02`) with `iyupi-26e6a-z56ra-6a5tz-yyj6i-kvxe4-joccp-pgapo-vpcvb-zxtmq-oae`
- In `backend/main.mo`, find and replace every occurrence of `f2ba368dff8966e6a9977354eb4c3f0f543c3cadb504dc0d4355859888bd2256` (including any substring such as `f2ba368d`) with `iyupi-26e6a-z56ra-6a5tz-yyj6i-kvxe4-joccp-pgapo-vpcvb-zxtmq-oae`
- All other logic, constants, function signatures, and access control remain untouched

**User-visible outcome:** The treasury address throughout the backend now correctly resolves to the ICP principal `iyupi-26e6a-z56ra-6a5tz-yyj6i-kvxe4-joccp-pgapo-vpcvb-zxtmq-oae`, with no remaining hex treasury strings in `backend/main.mo`.
