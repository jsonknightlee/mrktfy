# Mrktfy Release Handoff

This checklist captures the minimum steps to repeat the iOS TestFlight/App Store release flow safely.

## Before each build
- Confirm the production build profile is still using `appVersionSource: "remote"`.
- Confirm `eas.json` production uses `autoIncrement: true`.
- Verify the production bundle identifier remains `com.mrktfy.mrktfy`.
- Check that production environment variables still point to the live API and required client IDs.
- Make sure any release-only credentials or App Store Connect IDs are still present.

## Build and submit flow
- Run `eas build --platform ios --profile production`.
- Wait for the new build to finish and note the generated build number.
- Run `eas submit --platform ios --profile production`.
- If EAS asks which build to submit, choose the newest production build.
- Confirm App Store Connect accepts the upload and begins processing.

## After submission
- Verify the build appears in App Store Connect and TestFlight.
- Check for App Store Connect warnings, missing metadata, or export compliance prompts.
- Watch for Apple processing failures or review feedback.
- Keep the App Store Connect app ID available for future submissions.

## Launch readiness checks
- Confirm the release version and build number match the intended train.
- Verify production login, map browsing, deck creation, and submission flows on iOS.
- Ensure any test-user or dev-only shortcuts remain disabled in production.
- Review privacy, screenshots, support info, and review notes before public release.

## Notes
- The current App Store Connect app ID is `6751080168`.
- The current production bundle identifier is `com.mrktfy.mrktfy`.
- The iOS release now uses remote EAS app versioning, so future build numbers should be generated automatically.
