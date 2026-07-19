# CI integration

> [!NOTE]
> The package is archived. Pinning a known version is safer for reproducible CI than relying on future compatibility.

## GitHub Actions

Capture the build output and run the analyzer only after a failure:

```yaml
- name: Build
  id: build
  run: your-build-command 2>&1 | tee build.log

- name: Explain failed build
  if: failure()
  run: |
    npx --yes expo-ci-doctor@1.1.0 analyze build.log --markdown \
      >> "$GITHUB_STEP_SUMMARY" || true
```

The analyzer deliberately returns exit code `1` when it finds a diagnosis. `|| true` prevents the reporting command from interfering with later reporting or cleanup steps; it does not change the original build failure.

## JSON artifact

```yaml
- name: Create machine-readable diagnosis
  if: failure()
  run: npx --yes expo-ci-doctor@1.1.0 analyze build.log --json > expo-ci-diagnosis.json || true

- name: Upload diagnosis
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: expo-ci-diagnosis
    path: expo-ci-diagnosis.json
```

## Generic CI shell example

```bash
set +e
your-build-command 2>&1 | tee build.log
build_status=${PIPESTATUS[0]}

if [ "$build_status" -ne 0 ]; then
  npx --yes expo-ci-doctor@1.1.0 analyze build.log --markdown || true
fi

exit "$build_status"
```

Make sure your shell and CI provider support `PIPESTATUS`; otherwise capture the command status using the provider's recommended pattern.

## Operational guidance

- Do not upload logs containing secrets as public artifacts.
- Treat diagnoses as hints and verify them against current official documentation.
- Keep the original build status authoritative.
- Because this package is no longer maintained, do not depend on it as a security or compliance control.

Next: [Commands](commands.md) · [Privacy](privacy.md)
