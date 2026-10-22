# forme-archive

## GOOD THINGS, editor preview

This branch (`feature/secure-editor-cloud`) is a protected preview of the GOOD THINGS, 1.6 website and editorial editor. Its homepage redirects to `magazine-site-cloud-1.6-preview.html` through `_redirects`.

Pages Functions expect these **runtime** settings in the **Preview** environment:

- `EDITOR_EMAIL`: permitted editor login email
- `ACCESS_TEAM_DOMAIN`: Cloudflare Access team domain
- `ACCESS_AUD`: application audience identifier
- `SANITY_EDITOR_TOKEN`: encrypted server-side secret with only required Sanity write permissions

After configuring environment settings, trigger a new preview deployment before verifying `/api/editor/session`. The brand cloud-save endpoint writes drafts, not published changes. The article and homepage editors are not yet synced to Sanity.

Never add API tokens or other credentials to this repository or HTML files. Keep production `main` untouched until authentication and persistence tests pass.

Preview-only redeployment requested after configuring Cloudflare Access runtime variables. No production source changes.
