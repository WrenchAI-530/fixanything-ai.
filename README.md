# FixAnything AI — English/Spanish MVP (Tesla + photo input)

## Included
- English/Spanish interface and AI replies.
- Server-side OpenAI Responses API integration. The secret key is never sent to the browser.
- Optional single photo input (JPG/JPEG, PNG, WEBP, GIF), resized/compressed in the browser and sent with the diagnostic request. No permanent photo storage is implemented.
- Tesla / electric-vehicle category with explicit high-voltage safety constraints in the AI instructions.
- Local payment-button preview for business payment links. This is NOT yet a verified/automated checkout integration.

## Step 1 — OpenAI API setup
1. Sign in at https://platform.openai.com/ and open API billing/usage settings.
2. Create a dedicated project for FixAnything AI and create a project API key.
3. Set a small usage budget/alert if available. API usage is billed separately from a ChatGPT subscription.
4. Do not send the key in chat, put it in HTML, or commit it to GitHub.
5. In Vercel, open the project → Settings → Environment Variables. Add `OPENAI_API_KEY` with the secret key. Optionally add `OPENAI_MODEL` = `gpt-4.1-mini`. Redeploy after changing environment variables.

## Step 2 — Deploy
1. Upload the contents of this folder to a private or public GitHub repository (do not upload a ZIP as the repo contents).
2. Import the repository into Vercel and deploy.
3. Add the environment variables above, then redeploy.
4. Test text and photo diagnostics in English and Spanish. Try a Tesla-related question and verify the response refuses DIY high-voltage work.

## Step 3 — Configure public payment links (manual links only)
Edit `payment-config.js` and add only your verified public business payment links or public Zelle instructions. This file is intentionally public and must never contain API keys, passwords, bank account credentials, or private tokens. The payment section stays hidden/disabled until links are configured. These links do not verify payment or unlock paid features.

## Step 4 — Payment setup (important distinctions)
This build includes only a local preview of payment links; it does not confirm payment, unlock paid features, or create subscriptions. Do not accept money through it as if checkout were integrated.

- **PayPal:** easiest starting option is to create a PayPal Business payment link or product/checkout in your own PayPal account. Recurring subscriptions require a supported PayPal subscription setup; eligibility and integration options vary. See https://developer.paypal.com/platforms/subscriptions/overview/
- **Venmo:** set up a Venmo Business Profile and use its official business profile/QR. Direct payment links are useful for manual one-off payments, but should not be treated as verified subscription webhooks. See https://venmo.com/business/profiles
- **Cash App:** use your verified business $Cashtag for manual one-time payments. Full Cash App Pay website integration requires merchant onboarding and the Cash App Pay partner/API integration: https://developers.cash.app/cash-app-pay-partner-api/guides/technical-guides/cash-app-pay-integration-basics
- **Zelle:** do not treat Zelle as an automatic website checkout or recurring-subscription API. If you accept it, show business instructions only and manually verify receipt in your bank. Never trust screenshots or emailed payment claims.

For a proper paid product, choose one primary checkout provider first, implement server-side verification/webhooks, and only unlock paid usage after a verified payment event. Keep separate accounting and follow provider terms. Do not collect card or bank details directly on this website.

## Safety and privacy
- Photo input is sent to the AI provider for analysis when the user submits a diagnostic. It is not saved by this app, but provider data handling terms still apply. Tell customers this clearly in a published privacy policy.
- Ask customers not to upload faces, license plates, VINs, documents, or other personal information.
- Tesla and other EV high-voltage repairs can cause fatal injury. The AI is instructed to limit DIY checks and refer high-voltage, battery, orange-cable, charging-system isolation, or drive-unit work to Tesla/qualified EV service. This is not a substitute for service documentation.
- Add production abuse protection (rate limiting, request-size limits, logging that excludes personal data, privacy/terms pages, and cost controls) before public promotion. A simple free serverless deployment alone is not production security.

## Current status
Working code scaffold; not yet deployed, connected to the owner's API key, or processing payments. The payment form is a local preview only and saves nothing to a server. Do not advertise paid access until checkout verification and entitlement logic are implemented and tested.
