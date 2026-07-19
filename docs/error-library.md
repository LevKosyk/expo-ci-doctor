# Error library

Expo CI Doctor `1.1.0` contains 17 deterministic rules. A diagnosis is emitted only when a build-log line matches a known signal. The analyzer does not send the log to an AI service.

> [!WARNING]
> This library is preserved for reference and is no longer updated. Error wording and recommended fixes may change in newer Expo SDK, Xcode, Android Gradle Plugin, CocoaPods, Metro, and EAS releases.

## iOS

### `ios-missing-privacy-manifest`

**Signals:** `ITMS-91053`, missing API declarations, or `PrivacyInfo.xcprivacy` errors.

**Likely cause:** Apple detected a required-reason API without a matching privacy manifest declaration.

**First steps:** Identify and upgrade the dependency named near the validation error. For application-owned native code, add the required API reason to `PrivacyInfo.xcprivacy`.

### `ios-pod-resolution`

**Signals:** CocoaPods cannot find compatible versions, cannot find a podspec, reports outdated specs, or `pod install` fails.

**Likely cause:** The iOS native dependency graph cannot be resolved.

**First steps:** Inspect the conflicting pods, run `npx expo install --fix`, and for bare projects try `cd ios && pod install --repo-update`.

### `ios-signing`

**Signals:** No provisioning profiles, `CodeSign` failure, missing entitlements, or certificate/keychain errors.

**Likely cause:** Xcode cannot match the bundle identifier, team, certificate, entitlements, and provisioning profile.

**First steps:** Verify `bundleIdentifier`, repair credentials with `eas credentials`, and compare configured capabilities with profile entitlements.

### `ios-deployment-target`

**Signals:** A dependency requires a higher iOS deployment target or `IPHONEOS_DEPLOYMENT_TARGET` is incompatible.

**Likely cause:** A native dependency requires a newer minimum iOS version than the project targets.

**First steps:** Set the required `ios.deploymentTarget` with `expo-build-properties` and regenerate native projects when appropriate.

## Android

### `android-gradle-memory`

**Signals:** Java heap space, GC overhead, `OutOfMemoryError`, or a disappearing Gradle daemon.

**Likely cause:** The Gradle JVM or worker exceeded available build memory.

**First steps:** Review `org.gradle.jvmargs`, reduce worker concurrency, and inspect oversized or duplicated resources and dependencies.

### `android-duplicate-class`

**Signals:** `Duplicate class ... found in modules` or a `check*DuplicateClasses` task failure.

**Likely cause:** Two Android dependencies provide the same Java or Kotlin classes.

**First steps:** Inspect `./gradlew app:dependencies`, then align or exclude the older transitive dependency.

### `android-sdk-license`

**Signals:** Missing Android SDK packages, unaccepted SDK licenses, or an unknown SDK location.

**Likely cause:** The build machine cannot locate or use a required Android SDK component.

**First steps:** Install the named SDK component, accept licenses on self-hosted CI, and verify `ANDROID_HOME`.

### `android-manifest-merge`

**Signals:** `Manifest merger failed`, incompatible `minSdkVersion`, or conflicting manifest attributes.

**Likely cause:** The application and a native dependency declare incompatible manifest values.

**First steps:** Use the manifest paths in the error to identify both owners and upgrade or align the conflicting dependency.

### `android-kotlin-version`

**Signals:** Incompatible Kotlin metadata or inconsistent JVM targets.

**Likely cause:** A native module was compiled with a Kotlin or JVM version incompatible with the app toolchain.

**First steps:** Upgrade the named package to a version supported by the project's Expo SDK and run `npx expo install --fix`.

## Metro and JavaScript

### `metro-module-not-found`

**Signals:** Unable to resolve a module, `Module not found`, or none of the candidate files exist.

**Likely cause:** Metro cannot resolve an application file or dependency on the build machine.

**First steps:** Check case-sensitive filenames, dependency declarations, workspace exports, and Metro cache state.

### `metro-hermes-syntax`

**Signals:** `hermesc` error, transform error, or unexpected JavaScript syntax.

**Likely cause:** Metro or Hermes cannot transform application JavaScript.

**First steps:** Inspect the first application-owned file, Babel configuration, and Reanimated/plugin compatibility.

## Expo and EAS

### `expo-config-plugin`

**Signals:** `PluginError`, `withAndroidManifest`, `withInfoPlist`, or failure to resolve `app.plugin`.

**Likely cause:** An Expo config plugin crashed during native project generation.

**First steps:** Find the first plugin in the stack, upgrade it with `npx expo install`, and reproduce with `npx expo config --type prebuild`.

### `expo-sdk-dependency`

**Signals:** Expo reports expected and installed dependency versions or recommends `expo install --fix`.

**Likely cause:** Installed packages do not match the Expo SDK compatibility set.

**First steps:** Run `npx expo install --fix`, then the official `npx expo-doctor@latest`.

### `eas-auth`

**Signals:** Missing or invalid `EXPO_TOKEN`, not logged in, or an invalid authentication token.

**Likely cause:** A non-interactive build cannot authenticate to the Expo account.

**First steps:** Create or rotate an Expo access token, store it as a CI secret, and confirm access to the configured project owner.

### `eas-env-missing`

**Signals:** A required environment variable is missing, unset, or unexpectedly `undefined`.

**Likely cause:** The build profile does not provide a variable used by configuration or a build script.

**First steps:** Add it to the correct EAS environment/profile and validate the app config with the same environment locally.

## CI installation

### `ci-node-version`

**Signals:** Unsupported Node engine, incompatible Node version, or `EBADENGINE`.

**Likely cause:** CI uses a Node runtime outside a package's supported range.

**First steps:** Pin a supported Node major and keep CI configuration aligned with `package.json#engines`.

### `ci-lockfile`

**Signals:** `ERR_PNPM_OUTDATED_LOCKFILE`, an outdated frozen lockfile, or an `npm ci` manifest mismatch.

**Likely cause:** The committed lockfile and `package.json` describe different dependency graphs.

**First steps:** Regenerate the lockfile locally with the project's package manager and commit it with the manifest change.

## No matching rule

No match does not mean the build is healthy. It means no preserved `1.1.0` rule recognized the supplied text. Use the earliest meaningful error and current official documentation to continue diagnosis.
