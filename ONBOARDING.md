# Shared sauna owner onboarding

The landing page and SaunaApp portal use the same onboarding HTML, JavaScript and CSS. The old Formspree enquiry has been replaced by the existing Clerk-authenticated workflow: claim or add a location, verify ownership, complete location details and connect Stripe.

Brand colours match SaunaApp constants/colors.ts: #0F1114 charcoal, #1A1D23 surfaces, #C8785A copper-orange and #F0ECE6 text. portal/brand.css is a copy of styles.css used by the application portal; keep them in sync when changing shared styling.

## Release dependency

The live Railway service was still serving the old Formspree page during this change. Deploy the corresponding SaunaApp changes before live account onboarding can work. The application adds ownerOnboardingEnabled to /api/public-config and permits the exact private review origin through CORS. Clerk must allow the production website and review origin for sign-in redirects. No authentication bypass or sample account is provided by the static site. The page fails visibly if the service is unavailable or not ready.

The static preview on port 4173 uses the configured Railway API, not Python's static server. The application-hosted portal uses its same-origin API. Dashboard links go to the application host when using the standalone landing site. Backend and payment deployment are separate from this static website release.

## Account access during backend rollout

If the public configuration request fails, Create owner account and Owner sign in open the corresponding fixed accounts.seana.ie page. Static account links also work without JavaScript. No untrusted redirect parameters are accepted, no tokens are passed in URLs, and no ownership permissions are granted. A successful configuration response that disables onboarding still blocks embedded setup. Full onboarding still requires the Railway backend release.
