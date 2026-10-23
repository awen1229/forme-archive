# GOOD THINGS, / forme-archive

## Deployment handoff · updated 2026-10-23

**Active development branch:** `feature/secure-editor-cloud`  
**Production GitHub Pages branch:** `main` (intentionally not merged)  
**Cloudflare Pages preview:** https://feature-secure-editor-cloud.forme-archive.pages.dev/  
**Protected editorial access:** `/api/editor/session`  
**Read-only launch audit:** `/api/editor/launch-audit`  
**Isolated release-test interface:** `/release-lab.html`

This handoff is recorded so future ChatGPT sessions can continue from the **launch acceptance** phase instead of repeating editor setup or Release Lab testing.

### What is implemented in the preview branch

- Secure Cloudflare Access identity check in Pages Functions.
- Sanity draft storage for brands, articles, homepage selections and site copy.
- Separate explicit publishing APIs; **production publishing is disabled unless `ENABLE_PRODUCTION_PUBLISH=true`** in the appropriate runtime environment.
- Isolated Release Lab operates only on the Sanity `staging` dataset and fixed test IDs.
- Public content views default to **published Sanity content only**, not browser-local drafts or built-in example articles.
- Initial HTML no longer ships a pre-rendered demo article as a flash of content.
- Main navigation and THE INDEX no longer advertise unimplemented demo stock functionality.
- Cloud-editor controls run on the designated protected preview hostname only; public GitHub Pages content can hydrate from published Sanity data.

### Last known verification, not a live deployment claim

- On **2026-10-22**, the editor reported Release Lab staging draft / publish tests completed for BRANDS, ARTICLES, HOMEPAGE and SITE CONTENT, with test items cleared. **Do not request repeating these tests by default.**
- The last user-shared **production** launch-audit snapshot on 2026-10-22 was **not ready**: 0 published brands, 0 published articles, 4 unpublished drafts, no published homepage selection and no published site-copy document. These counts are historical, **not necessarily today's Sanity state**.
- On **2026-10-23**, GitHub source for the preview branch was inspected. The published-only flag and production publishing gate were present; the corresponding source changes were committed. **Cloudflare's actually served deployment and mobile browser behavior have not yet been verified from this session.**
- **Do not merge to `main` or enable production publishing** based solely on static-code inspection or previously passing staging tests.

### Preview publish-gate rollout · 2026-10-23

- Operator reports adding `ENABLE_PRODUCTION_PUBLISH=true` to **Cloudflare Pages Preview** environment only. This setting has **not** been independently read back from Cloudflare.
- This README-only commit intentionally triggers the GitHub-connected **Preview** redeployment so Pages Functions can load the updated environment configuration. Verify the resulting deployment succeeded and is on this branch before publishing.
- The gate authorizes explicit writes to **Sanity production** from the protected editor. It does *not* turn drafts into published records automatically. Do not publish `GT CLOUD TEST` or other fixture content.
- Before the first real publish, open the COMOLI cloud draft, review its actual content and slug, and publish **that single record only**. Leave GitHub `main` untouched.

### Remaining acceptance workflow

1. Confirm Cloudflare Pages' active preview deployment is built from the latest `feature/secure-editor-cloud` commit and that Access protection works. Review actual mobile and desktop rendering.
2. Confirm that, when Sanity has no published records, public articles/brands appear empty or show an editorial placeholder, with no local drafts or demo articles. Verify no unauthorized `#/admin` editor access from the public GitHub Pages hostname.
3. Review and prepare genuine brand profiles, editorial articles, source credits, and image permissions in **draft** form. Do not publish example or test content to `production`.
4. After explicit release approval, enable the controlled production publish gate only in the intended editor environment, then publish complete brand/article documents, homepage features pointing to published article slugs, and site-copy fields.
5. Re-run `/api/editor/launch-audit` and resolve all launch blockers/errors. Review accessibility, mobile navigation, loading/error states, sources, and public access.
6. Only after acceptance passes, merge the approved release to `main` and confirm the public GitHub Pages deployment.

### Runtime configuration (never store actual values here)

The protected Cloudflare Pages Preview environment uses `EDITOR_EMAIL`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, and secret `SANITY_EDITOR_TOKEN`. Keep tokens, JWTs and personal login details out of GitHub, browser source, screenshots and chat messages.

This README describes **source/release readiness**, not a claim that production content is already published.

### 2026-10-23 Preview variable deployment check

The site operator reports saving the Preview environment variable through Cloudflare Settings (not by editing the browser URL). This documentation-only change requests a fresh branch Preview deployment. The presence and exact value of the variable **must still be verified** using the protected read-only `/api/editor/publish-status` endpoint after deployment. No Sanity publication or GitHub `main` change is authorized by this note.

### Preview variable re-save handoff · 2026-10-23

Operator has now re-entered and saved `ENABLE_PRODUCTION_PUBLISH` as a Text variable with value `true` in the Cloudflare Pages **Preview** settings dialog, following read-only diagnostics that previously returned `flagPresent=false`. This documentation-only commit requests a new Preview build so the setting can be loaded at runtime. This does not prove the value is active: verify the protected `/api/editor/publish-status` response reports `flagPresent=true` and `publishEnabled=true` before any publishing. Do not publish `GT CLOUD TEST`; confirm a genuine COMOLI draft exists first. The `main` branch must remain unchanged.
