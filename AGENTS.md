<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep recipe versions and nutrition-warning calculations in browser-safe domain modules; selecting a version must update cooking, nutrition and shopping together.
- Keep verified supermarket product mappings separate from generated search terms; never fabricate product IDs or imply searches guarantee stock.
- Treat meal warning thresholds as explicit planning budgets derived from cited daily guidance, not official per-meal medical limits.
- Normalize legacy ingredient preparation through the browser-safe recipe selector and request product-only names during import; preserve preparation in cooking so names stay shopping-ready without losing the original method.
- Nearby store distances come from Google Maps lookups on the server, never invented numbers; why: shoppers rely on them to pick a branch.
- Keep gram/cup unit conversions in the browser-safe `src/lib/units.ts`; when an ingredient's density is unknown, keep grams instead of guessing a cup amount.
- Structured-output schemas for the import model must declare every property as required (optional properties break the AI gateway's response format); use null instead of optional.
- Recompute nutrition and warnings in the browser-safe recipe module using imported ingredient estimates, with narrow mass-based fallbacks for plain added sugar and plain salt; update known totals by known contribution deltas, and when contributions are unknown report a flagged minimum ("at least") where one is provable instead of unknown, so increasing an ingredient never hides the estimate or its warning.
- Derive cooking sections in the browser-safe cooking module without changing the import contract; keep mixed and later preparation steps in source order so section navigation never changes the method.
