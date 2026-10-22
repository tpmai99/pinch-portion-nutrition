# Roadmap

- [x] Show full missing-item coverage before supermarket selection, without presenting unverified products as available; verified with a real three-ingredient import
- [ ] Confirm live supermarket inventory for every missing product — blocked: no supported retailer inventory connection is available; product links are not stock evidence

- [x] Fix Facebook post extraction so topping ingredients, including beef, are not lost behind shortened previews; verified the exact shared link includes beef and noodles

- [x] Verify saved-reel analysis of on-screen text and narration, and let users review extracted ingredients and instructions before importing

- [x] Correct TikTok shared-link handling and verify upload guidance instead of claiming the video contains no recipe

- [x] Show estimated kcal per portion beside ingredients and verify amount changes and removal
- [ ] Confirm whether the user's video serves three but lists noodles for one — blocked: original video is not available in chat uploads

- [x] Keep sugar estimates and warnings recalculating when sugar amounts change, including older or partially estimated recipes

- [x] Recalculate salt and free sugars when ingredients change and use those totals for warnings

- [x] Group cooking into Preparation and Cooking with an overview, optional details and a choice of where to start

- [x] Mark substituted ingredients in the healthier version with "Changed · was: …" (overview, shop sheet, store lists)
- [x] Recalculate per-portion macros when the user removes or rescales ingredients on the overview screen
- [x] Let the user adjust ingredient amounts (eat more/less); adjustments update the macros and shopping amounts
- [x] Healthier-version badges: same-ingredient amount changes read "Decreased/Increased by X g or ml"; real swaps keep "Changed · was: …"

- [x] Treat "to taste" / unquantified ingredients as optional; let the user add grams and update kcal and shopping from that amount (verified on the pho import; AI-gateway import check blocked later by 402 credits)

- [ ] Sign in / create account screen with Skip option
- [ ] Save recipes and reopen them quickly
