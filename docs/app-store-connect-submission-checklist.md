# Mrktfy App Store Connect Submission Checklist

Use this checklist when filling out App Store Connect for the next public release.

## App Information
- [ ] **App Name**
  - Current expected name: `mrktfy`
- [ ] **Subtitle**
  - Add a concise one-line value proposition.
- [ ] **Category**
  - Primary category: choose the best fit for a real-estate discovery app.
  - Secondary category: add only if it clearly helps discovery.
- [ ] **Content Rights**
  - Confirm you have rights for the app content.
- [ ] **Age Rating**
  - Complete the questionnaire and confirm the result is correct.

## Description Fields
- [ ] **Description**
  - Explain the core user journey: discover listings, shortlist properties, create decks, and receive alerts.
- [ ] **Keywords**
  - Add search-relevant terms for real estate, home search, listings, alerts, and property matching.
- [ ] **Marketing URL**
  - Add only if you have a live public landing page.
- [ ] **Support URL**
  - Required; point to a working support/contact page.
- [ ] **Privacy Policy URL**
  - Required; point to a live privacy policy page.

## Review Information
- [ ] **Reviewer Sign-In**
  - Provide login credentials if the reviewer must authenticate.
- [ ] **Review Notes**
  - Include a short explanation of the app and the flows Apple should test.
  - Mention that the app supports email/password, Google, and Apple Sign-In.
  - Mention that location is used for nearby listings and search radius behavior.
  - Mention that notifications are used for property alerts.
- [ ] **Demo Account Steps**
  - Provide step-by-step instructions to reach the main review flows.
- [ ] **Subscription / Paywall Steps**
  - Include exact taps to reach any subscription purchase flow if it is part of review.

## App Privacy
- [ ] **Data Collection Details**
  - Verify every data type collected is accurately represented.
- [ ] **Tracking**
  - Confirm whether the app tracks users across apps or websites.
- [ ] **Linked Data**
  - Confirm whether any collected data is linked to the user.
- [ ] **Purpose Strings / Usage Notes**
  - Ensure the listed purposes match the actual product behavior.

## Screenshots and Media
- [ ] **iPhone Screenshots**
  - Upload all required device sizes.
- [ ] **iPad Screenshots**
  - Upload if the app supports iPad distribution or if App Store Connect requires them for the target setup.
- [ ] **App Preview Video**
  - Optional, only if you plan to use one.

## Compliance / Legal
- [ ] **Export Compliance**
  - Confirm encryption answers for the binary.
- [ ] **Advertising ID**
  - Confirm whether the app uses IDFA or not.
- [ ] **Apple Pay / Stripe**
  - Verify production payment behavior if public release includes payments.

## Technical Release Checks
- [ ] **Bundle Identifier**
  - Confirm: `com.mrktfy.mrktfy`
- [ ] **Version**
  - Confirm App Store version is intentional for this release train.
- [ ] **Build Number**
  - Confirm the latest uploaded build number is unique.
- [ ] **TestFlight Build**
  - Re-check that the uploaded build appears after Apple processing completes.

## Final Submission Checklist
- [ ] All required metadata fields completed in App Store Connect.
- [ ] Review notes include any credentials and setup instructions.
- [ ] Screenshots uploaded and match the current UI.
- [ ] Privacy policy and support links are live.
- [ ] Build uploaded successfully and is available for review or TestFlight.
- [ ] No unresolved review blockers remain.

## Repo Notes
- The repo already confirms the iOS bundle identifier is `com.mrktfy.mrktfy`.
- EAS production builds use remote versioning with auto-increment.
- Native iOS capabilities already include Apple Sign-In, location, and notifications.
- The latest successful upload is build `58`, and future builds should be generated automatically by EAS remote versioning.
