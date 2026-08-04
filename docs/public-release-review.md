# Mrktfy Public Release Review

This checklist captures the App Store-facing metadata and review-note items that should be verified before a public release.

## Confirmed in the repo
- The iOS bundle identifier is `com.mrktfy.mrktfy`.
- EAS production builds use remote app versioning with auto-increment enabled.
- Apple Sign-In, location, and notification capabilities are already configured in the native iOS project.
- The latest successful TestFlight/App Store Connect upload is build `58`, and future builds should now be generated automatically by EAS remote versioning.

## Must be completed in App Store Connect
- App name, subtitle, description, and keywords.
- Primary category and any secondary category.
- Support URL.
- Privacy Policy URL.
- Marketing URL, if used.
- App privacy details.
- Age rating and content rights declarations.
- Required screenshots for all supported device sizes.
- Export compliance and encryption answers.
- Review notes.
- Reviewer account credentials, if the app requires authentication.

## Review notes to provide
- The app is a real-estate discovery and matching product.
- Sign-in options include email/password, Google, and Apple Sign-In.
- If the reviewer needs access to protected areas, provide a review login with clear steps.
- Dev-only test user bypasses are not part of the production experience.
- Location is used to show nearby listings and power search radius behavior.
- Notifications are used for property alerts.
- If any paid subscription flow is enabled for review, include exact steps to reach it.

## Gaps / watchouts
- No support URL or privacy policy URL is documented in the repository yet.
- No App Store review account details are stored in the repo.
- The Apple Pay / Stripe setup should be verified in the production flow if it is part of the public release.
- The README still references `npm run start:prod`, but that script is not currently present in `package.json`.

## Recommended next actions
- Fill in all required App Store Connect metadata.
- Add review notes with any account credentials needed by Apple.
- Confirm screenshots and app privacy answers before public release.
- Recheck the uploaded build in TestFlight after processing completes.
