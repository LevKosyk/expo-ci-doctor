# Privacy and local processing

Expo CI Doctor `1.1.0` performs log analysis inside the local Node.js process.

The analyzer:

- reads the file path supplied on the command line;
- matches log lines against bundled deterministic rules;
- writes terminal, JSON, or Markdown output;
- does not upload build logs or source code;
- includes no telemetry SDK;
- performs no network request during analysis.

## Your responsibility

Build logs can contain credentials, filesystem paths, internal hostnames, email addresses, bundle identifiers, and environment values. Review and redact logs before posting them to issues, pull requests, chat systems, or public CI artifacts.

The package's local-only behavior does not make third-party CI logs or artifacts private. Apply your CI provider's secret-masking, retention, and access-control settings independently.

## Maintenance limitation

The package is archived and is no longer receiving guaranteed security fixes. Do not treat it as a security boundary or compliance control. Review the source and pin the exact version if you continue using it in sensitive environments.

See [Maintenance status](maintenance.md).
