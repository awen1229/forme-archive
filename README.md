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


## GOOD THINGS, visual settings handoff · 2026-10-24

- **Protected editor preview only:** `https://feature-secure-editor-cloud.forme-archive.pages.dev/design-settings.html`.
- The admin navigation includes a "視覺設定" link. Initial presets: editorial title font (original/sans/serif/mixed), article reading size (compact/standard/large), site paper (warm original/white).
- Editing options updates an in-page sample; the full-site preview uses a query parameter only honored on the protected editor hostname. This parameter does not save/publish anything.
- `/api/editor/design-settings` reads/writes `drafts.gt-design-settings` in Sanity production under Cloudflare Access identity and same-origin controls. Draft save never changes the published document.
- `/api/public/design-settings` reads published records only, and `gt-design-site.js` on the future public site will apply validated published presets. Existing defaults remain unchanged without a published design document.
- **Publication is intentionally locked:** the editor's publication button is disabled, and the publishing endpoint additionally requires `ENABLE_DESIGN_SETTINGS_PUBLISH=true` AND the existing `ENABLE_PRODUCTION_PUBLISH=true`. Do not set the new flag or unlock the button until `gt-design-site.js`, `gt-design-site.css`, and their `index.html` references have been merged and deployed on public GitHub Pages, followed by authenticated/unauthenticated regression tests.
- No brand, article, homepage, or other existing Sanity document was modified as part of the settings implementation.
- Browser visual/Access testing must still be done by the authorized site owner. JS source syntax was checked; latest Cloudflare build status must be verified independently after the final README commit.

### GOOD THINGS, v1.9 visual settings handoff · 2026-10-24

- The site owner confirmed v1.8 brand-management search, A–Z filtering and sorting appeared in the protected preview. Not all security/publish/mobile tests have been completed.
- v1.9 DESIGN SETTINGS deployed to protected preview: https://feature-secure-editor-cloud.forme-archive.pages.dev/design-settings.html
- Options: heading font (original/sans/serif/mixed), article reading scale (compact/standard/large), background (original/white). Default appearance remains unchanged.
- Editor files: design-settings.html, gt-design-settings.js, gt-design-site.js, gt-design-site.css.
- Cloud API: authenticated draft read/save at /api/editor/design-settings; guarded publish at /api/editor/publish-design-settings; published-only read at /api/public/design-settings.
- Publish requires current draft revision, authorized editor JWT and ENABLE_PRODUCTION_PUBLISH=true. No credentials are stored in source.
- Preview changes are local until saved as a Sanity draft. The public site is not changed until deliberate publish. Preview URL overrides are accepted only on the designated protected editor host.
- Cloudflare Pages preview build reported success; JS source syntax was checked. Authenticated browser workflow, live draft storage and access-denial paths still require interactive checks.
- No Sanity production content was mutated by GitHub authoring. Do not assume main was merged. Earlier v1.8 PRs #4/#5 were still open as of this handoff.
- Next: editor owner should review the new page, try choices and full-site preview, test mobile, optionally save a draft, then approve release when satisfied. Do not publish actual design settings without explicit action.

### THE INDEX / SELECTED BRANDS handoff · 2026-10-24

- Operator reported that THE INDEX > The Directory displayed every published brand as a tall, repetitive full-size card, despite the VIEW ALL BRANDS link. Request: curate a handful of featured brands in the brand manager; do not duplicate the full A-Z directory.
- On the protected preview branch, gt-index-featured.js and gt-index-featured.css now replace only the THE INDEX brand listing with a compact, accessible curated strip. Default is **three alphabetically sorted, published brands**. If a published selection exists, it controls the 1-4 selected brands and their order.
- On phones, the curated items become compact rows with smaller brand artwork/name, founder and arrow. The full `/brands` A-Z directory remains untouched.
- The existing brand management CLOUD/SANITY panel now includes a distinct THE INDEX / CURATION area: selected brands, up/down order, add/remove, preview, reload, draft save and explicit publish. Drafts cannot be shown publicly by regular public URLs.
- New endpoints: GET/POST `/api/editor/index-featured-brands`, POST `/api/editor/publish-index-featured-brands`, GET `/api/public/index-featured-brands`.
- No brand record is mutated by curation; the selection is stored in an independent Sanity document `gt-index-featured-brands` with draft `drafts.gt-index-featured-brands` and `_type=gtIndexFeaturedBrands`. Publish retains Cloudflare Access validation, the ENABLE_PRODUCTION_PUBLISH guard, same-origin check and draft revision check.
- In local JS simulation with 100 published brands, unconfigured THE INDEX rendered 3 items; a four-item selection rendered exactly four in manually specified order; a two-item selection rendered exactly two. The full-list source markup was absent. All new JS modules passed syntax checks.
- GitHub Cloudflare Pages preview deployment reported success for source commit `028e533af28150391b63042c7fdb9dd4a361b878`. Additional API query filtering changes were made afterward, so verify the latest preview deployment commit before final acceptance.
- IMPORTANT: No live Sanity curation draft save, publish, browser screenshot, or authenticated end-to-end check was performed in this session. GitHub main was not merged. Do not claim the public website is updated yet.
- Next: visit https://feature-secure-editor-cloud.forme-archive.pages.dev/#/admin and choose 品牌管理. Check THE INDEX / CURATION, reorder/pick 1-4 published brands, use 預覽精選, then test its small-screen The Directory, and only publish/merge after owner approval.

### GOOD THINGS, v1.10 publishing workflow handoff · 2026-10-24

- User approved continuing upload/publish workflow work following THE INDEX logo preview acceptance. These changes are **preview-branch source edits only**, not live content publication.
- ARTICLE: cloud save now remains in article editor instead of invoking old local-only navigation/reset. Retains the returned Sanity revision for subsequent edits; retains a best-effort local backup; shows inline save status; guards concurrent saves and duplicate publish clicks; warns when trying to publish unsaved content.
- BRAND: cloud save now remains in brand editor, keeps a stable draft slug across retries, saves optional local backup, reports inline status, and guards duplicate publication and unsaved edits. Brand API returns the uploaded image URL so subsequent saves need not re-upload unchanged LOGO.
- HOME and SITE CONTENT: cloud save and publish have in-flight guards, explicit confirmation only on publish, draft-state comparison before publishing, and inline completion/error status. FEATURE issues: duplicate publication protected, unsaved issue changes and reordering block stale publication.
- Client-side image preparation now prevents ARTICLE and BRAND saves before logo/cover compression is finished; HOME slide cover saves are similarly guarded. HOME cover upload is associated with the original slide object to prevent image assignment to another slide after reordering.
- Manual typed PUBLISH prompts remain removed. Backend still requires exact authorization, confirmation marker, draft revision, same-origin checks, and ENABLE_PRODUCTION_PUBLISH gate.
- Syntax checks passed for index.html inline JS, modified client JS and existing API modules. **Authenticated real-browser end-to-end save/upload/publish and security tests were not executed**, so do not claim all workflows have been user verified.
- Deploy URL for owner to test: https://feature-secure-editor-cloud.forme-archive.pages.dev/#/admin . Source is not merged to main, no Sanity production document was changed by this GitHub patch.
- Test checklist: create a brand with logo, save as draft, stay on editor, adjust and save again; open cloud draft and publish once; repeat for ARTICLE with cover and continue edit; verify HOME, SITE CONTENT and FEATURES save failures preserve fields; verify publish shows only one confirmation and never asks for manual PUBLISH typing. Avoid publishing test documents to actual production dataset.

### GOOD THINGS, v1.11 editorial media and FEATURES navigation · 2026-10-24

- Four requests: separate inline images from cover crop accordion; match HOME crop preview to actual display ratio; make FEATURES 3 series explicit; permit Word-like independently adjustable picture proportions.
- ARTICLE: independent collapsible inline-media and cover panels, with inline image control adjacent to body. The cover remains a separate fold and desktop no longer forces it open.
- HOME: mini previews model photo viewport geometry at 485px desktop (56% of 90vw) and 315px mobile (90vw full width); image can be panned and proportionally zoomed via drag, with independently saved desktop and mobile fit, zoom, x/y settings. Home carousel frame itself is fixed-aspect.
- Inline ARTICLE photos: new independent width/height-aspect preview with drag handle and sliders. Optional strict numeric tokens width=40..100 and ratio=50..250, preserving old image tokens and no source image deformation.
- FEATURES: three clear in-page navigation items BEHIND THE BRAND / GOOD PICKUPS / SEASONAL NOTES linked to their sections, without extra primary navigation branches.
- Code parsing, safe numeric bounds and both legacy/new inline-image rendering were statically checked, along with homepage crop metadata round-tripping across Sanity functions.
- Owner needs to inspect actual mobile/desktop layouts and authenticated draft save, reload and publish. No Sanity data was intentionally mutated by source authoring. Changes remain on protected preview branch; public main remains untouched.
- Preview: https://feature-secure-editor-cloud.forme-archive.pages.dev/ . Next: verify independent folds, actual image drag/resize, HOME crop persistence, FEATURE three group navigation, then decide whether to merge.

### GOOD THINGS, v1.12 protected font library · 2026-10-24

- User requested to install the **functionality for their many fonts first**, before choosing specific typefaces. Implemented an admin-only FONT LIBRARY reachable from the editorial CMS or DESIGN SETTINGS.
- UI at https://feature-secure-editor-cloud.forme-archive.pages.dev/font-library.html supports multi-file uploads (up to 30 per batch), live sample gallery with lazy preview loading, search by font name/file, and independent HEADLINES / BODY / NAVIGATION selection. Upload types WOFF2, WOFF, OTF, TTF; strict font signature validation; 9 MB/file; 150 font catalog entries. Each upload requires acknowledgement of web embedding licensing.
- Cloudflare Pages Functions: `/api/editor/font-library` GET/POST for guarded Sanity metadata and asset file upload; `/api/editor/font-settings` GET/POST for a separate Sanity draft `drafts.gt-font-assignments` with revision checks and validated role references.
- Sources: `font-library.html`, `gt-font-library.css`, `gt-font-library.js`, `gt-font-preview.js`, and the two Pages Functions above. `index.html` loads `gt-font-preview.js` but only operates on the exact protected preview host. `gt-design-site.js` includes a FONT LIBRARY link in admin navigation; `design-settings.html` links to font library.
- Preview on the full site uses protected-host URL argument `gt-font-preview=<JSON encoded roles>` and an authenticated font catalog read. The actual `FontFace` sources are Sanity file CDN assets and not GitHub-committed binaries. Fonts without Chinese glyphs fall back to the usual CJK family.
- Uploaded webfont files are public CDN assets accessible to anyone with the URL. Upload ONLY fonts with a license permitting web embedding; user must verify licenses. These font assets are not packaged in assistant responses.
- There is no public font publishing API or button. Draft assignments are stored separately and do not alter formal `gt-design-settings` or any existing brand/article content. GitHub main remains unchanged.
- Static syntax checks passed for the nine touched page/module/API files; Cloudflare Pages preview deployment for commit `7af998e1b334790e568a1d0fa3185ce099f830ae` reported success. Real authenticated font upload, Sanity file-storage/CORS rendering, iOS font rendering and live draft round trip have NOT been exercised end-to-end.
- Future: when the owner verifies WOFF2 upload and browser font rendering, implement explicit production-only font release procedure and optional catalog rename/delete, without inadvertently publishing unapproved assets or overriding brand LOGOs.

### GOOD THINGS, v1.13 font catalog organization

- Added authenticated edit endpoint /api/editor/font-metadata for safe, revision-checked modification of a font catalog's display name and category; no file bytes or reference IDs change.
- Catalog GET now returns font _rev and category. Newly uploaded fonts default to uncategorized. Existing catalog entries without a category are treated as uncategorized.
- Font Library UI now offers per-font 名稱／分類, editable display name and category with save/cancel, filtering by category in addition to search, and labeled category in results.
- Categories: uncategorized, serif, sans, display, handwriting, other. Editing a category never changes content already published on the main site.
- Existing Delete safeguards, single-font retry, local-only font test and custom font preview remain. Full-site preview uses the secured host and GET of protected font catalog; no production font release action was created.
- Source deployment passed Cloudflare Pages check for commit 4c4c7da39743dacfba31217fd077cb2bbce61d59. JS syntax and frontend/backend wiring checked statically. Real authenticated rename, category filter, save/read, full-site visual parity, and mobile behavior still need hands-on owner verification.
- Preview: https://feature-secure-editor-cloud.forme-archive.pages.dev/font-library.html. Do not claim production GitHub Pages main was updated.

### THE INDEX Profile 02 / Black Frame handoff · 2026-10-28

- User selected A: single black-framed EDITOR'S NOTE. Keep uploaded brand LOGO and dark MENU; metadata, brand story, related articles remain unboxed.
- Preview-only source: gt-index-profile-v2.css, gt-index-profile-v2.js, and references in index.html. The JS renderer is restricted to the protected preview hostname. GitHub main was not modified.
- Brand layout: breadcrumb, logo/name, founder/year/tags/official link, THE STORY, optional black-framed Editor's Note, genuine related published stories or next-brand fallback.
- Authenticated BRAND editor now exposes optional editorNoteTitle (max 180 chars) and editorNote (max 3000 chars). Both pass through brand draft save and published-only reader. Empty notes hide the frame. No Sanity records were changed or published by this commit.
- Responsive review: https://feature-secure-editor-cloud.forme-archive.pages.dev/index-profile-v2-review.html . Static sample index-profile-v2-demo.html loads the same CSS and is not a published Sanity record.
- Syntax checks passed for preview JS, Pages Functions and inline index HTML. Mock render assertions passed for present/absent note, safe escaping, and missing brand.
- Cloudflare Pages check concluded successful for commit ac98e389cb035c33b834aaf3778b043bc6fd7d41. This confirms build/deployment, not browser acceptance or authentication.
- Next: owner visually checks desktop/mobile, opens authenticated brand editor, saves and reloads draft-only editor note, checks brand logo positioning, verifies public published-only behavior. Do not publish testing content, merge to main or alter production without explicit approval.

### Integrated V30 Homepage Opening · 2026-10-28

- User requested that the previously discussed homepage opening animation and accepted design be applied to the protected test website together with THE INDEX Profile 02. GitHub main and published Sanity content remain unchanged.
- On `feature/secure-editor-cloud`, first default homepage visit now uses V30 DRAW THE COMMA: draw by pointer/touch, handwritten stroke morphs to the ORIGINAL image-derived comma, then original glyphs form the unchanged GOOD THINGS, logo and the page enters automatically. A keyboard/accessible SEE IT WITHOUT DRAWING fallback, top SKIP, Escape, error watchdog and reduced-motion bypass remain.
- V30 is embedded via `opening-draw-comma-embed-v30.html` (derived from `opening-lab-draw-comma-v30.html`), with same-origin progress/completion messages, and mounted by `gt-home-intro-draw-v30.js` and corresponding CSS. The earlier `gt-home-intro.js` now exits if V30 owns the overlay.
- First-view display uses sessionStorage key `gt-draw-entry-v30`, not a persistent tracking record. Preview utility bar provides REPLAY OPENING; direct link `/?intro=draw-replay#/` forces replay. `/?intro=off#/` bypasses animations. Legacy V21 scroll-assisted physics study stays available at `/?intro=pinnedstage21#/` and V10 via `/?intro=physics#/`.
- The accepted BLACK FRAME EDITION styles are loaded on the protected preview hostname by default, layered in the order `gt-curated-edition-01.css`, `gt-soft-edges-study.css`, `gt-ink-frame-study.css`, then `gt-index-profile-v2.css`. Original logo, dark MENU and CMS behavior are preserved. The visual comparison laboratory `gt-editorial-edition.html` passes `edition=none` to its iframe to avoid conflicting baseline styles.
- Static syntax checks passed for index inline scripts, intro scripts, V30 iframe engine and comparison page. Preview bootstrap simulations passed first visit, already-seen visit, forced replay, V21 opt-in, disabled intro, reduced motion and direct brand route.
- Cloudflare deployment success does not constitute interactive browser proof. Owner still needs to verify actual iOS/desktop drawing, iframe asset loading, smooth transition, menu and admin behavior after entry, and A black-framed note with real published content. Do not merge or publish without explicit approval.

### Opening Studio / selectable experiments · 2026-10-28

- User requested all previously discussed homepage opening motion studies in one place, with freely switchable selection on the **protected preview only**. `opening-studio.html` now lists 24 allowlisted entries: V30 draw, V21 scroll physics, V10 tumble, V24 eight print/editorial variants, V25–V26 three variants each, V27 four kinetic/paper/light variants, V28/V29 editorial anchor, and OFF.
- Uses `gt-opening-registry.js` for `localStorage` selected mode and optional `gt-opening-repeat-v1` preference; first-view state is in `sessionStorage` keyed per mode. These browser-local settings are NOT CMS/ Sanity records and are not shared between browsers/users.
- `index.html` boots exactly one selected engine on the protected hostname. Draw V30 retains its original logo-to-comma handwriting, physics V21 retains scroll handoff, and V10 remains an independent fallback. Generic studies are embedded by `gt-home-intro-lab.js` with same-origin `gt-opening-embed.css` and robust SKIP / Escape / timeout handling; V25–V27 have an opt-in query-based variant picker via `gt-opening-study-param.js`. No original logo bitmaps or Sanity content were changed.
- The studio is reachable from the preview utility bar, drawer menu, and Design Settings page. It previews each original archived study and provides select / save / test-homepage / phone-width / playback-frequency controls. The original archive study pages remain independently accessible for deeper playback and scrubbing.
- URL overrides: `/?opening=magnetic&replay=1#/` tests any allowlisted mode (removes override after completion); `/?intro=off#/` always bypasses opening; existing legacy V21 `/?intro=pinnedstage21#/` remains. `opening=none` bypasses intro altogether.
- Syntax checks passed for all newly added JS, new inline studio script, and main index HTML. Boot simulation passed 12 switching/replay/reduced-motion cases. External Cloudflare build and browser touch/iframe behavior should be checked independently; all changes stay on `feature/secure-editor-cloud`. Do not merge to main or publish Sanity data without explicit user approval.
