# GOOD THINGS, / Opening selector official-site release candidate

This is an isolated **draft** release from GitHub `main`. It is **not** the protected preview branch and deliberately does **not** merge the BLACK FRAME editorial design, brand editor changes or other CMS experiments.

## Scope
- Adds an allowlisted published-setting opening selector (24 modes including OFF).
- Keeps official site's existing original-logo V30 iframe and CSS.
- Includes only the public-facing historical original-LOGO animation experiments (V10/V21/V24/V25/V26/V27/V28/V29), plus one helper and embedding stylesheet.
- Replaces one script reference in `index.html`, leaving the rest of the official site's HTML/JS intact.
- Reads Sanity project `8nqupq9u` with `perspective=published`, never draft content. If no published configuration or network fails, falls back to existing V30 semantics.
- SKIP, Escape, network timeout and reduced-motion preference must all leave the site usable.

## Deployment gates
1. Inspect GitHub PR changed-file list and verify there are **no** brand/article/editorial-CSS/CMS data modifications.
2. Validate the origin `https://awen1229.github.io` can fetch the published Sanity settings (CORS) and that the published document is visible only after explicit editor publish.
3. On a temporary test deployment **of this release branch**, exercise: V30, physics V21, at least one V24 print variant, V27 magnetic, V29 editorial, OFF, once/always, SKIP, Escape, direct article deep-link, slow/mobile network, iOS/Android touch and prefers-reduced-motion. Do not infer browser success from a GitHub static syntax test.
4. Confirm the original official homepage's drawer, carousel, article links, brand pages, and current homepage logo are unchanged.
5. Obtain owner approval to merge the reviewed draft PR into `main`. **Do not merge automatically.**
6. After actual official-site deployment is verified, enable the preview editing environment flags `PRODUCTION_OPENING_ASSETS_READY=true`, `ENABLE_OPENING_PUBLISH=true` (and existing `ENABLE_PRODUCTION_PUBLISH=true` only if deliberately authorized). Redeploy preview.
7. Then the editor may save a selected mode as a Sanity draft, preview it, and explicitly one-click publish with revision/confirmation checks. Restore previous published mode via a new draft if necessary.

## Outstanding note
The Cloudflare private preview cannot prove the public Sanity cross-origin request; validate the public browser request before unlocking the publish flag. Existing public pages must always fail open to V30.


## Automated QA review · 2026-10-28 (not browser acceptance)

- Verified isolated PR diff against current main: only one `index.html` script reference changes; no articles, brand data, layouts, main LOGO or editor scripts changed.
- Verified JavaScript parser accepts all public release assets and original study inline scripts.
- Simulated the official controller for seven states, all passing: no published setting with legacy seen flag, published DRAW with legacy seen flag, published MAGNETIC with always, published OFF, network failure fallback to existing V30, direct article deep-link, and reduced-motion bypass.
- Fixed a migration bug: old V30 `localStorage` "seen forever" is now respected **only** when no published cloud configuration exists; published `repeat=once` correctly means first play per tab, even for returning V30 visitors.
- Browser-level acceptance is still open. No external browser network access was available to verify Sanity CORS, Cloudflare Access, GitHub Pages asset deployment, phone touch or real animation visuals.
- PR **must remain draft and unmerged** until browser acceptance and explicit production deployment approval.
