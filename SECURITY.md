# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately via [GitHub private vulnerability reporting](https://github.com/testsigmahq/arcus-cursor-extension/security/advisories/new),
or email <security@testsigma.com>.

Include the version or commit, reproduction steps, and impact. We aim to
acknowledge within 3 business days and to ship a fix or mitigation plan
within 30 days.

## Supported versions

Only the latest release on the default branch receives security fixes.

## Scope

This repository handles authentication tokens for a Testsigma account. Token
handling, the local credential store, and the loopback SSO listener are all in
scope. Issues in the Testsigma platform itself should go to
<security@testsigma.com>.
