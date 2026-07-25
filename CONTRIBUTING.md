# Contributing

Thanks for your interest. Bug reports, feature requests, and pull requests are welcome.

## Getting started

Clone the repo and follow the development setup in the [README](README.md).

## Pull requests

1. Branch off `main`.
2. Keep the change focused — one concern per PR.
3. Add or update tests for behaviour you change, and make sure the existing
   suite passes (see the README for the test command).
4. Never commit credentials, tokens, internal hostnames, or customer data.
   `refresh.token`, `config.json`, and `sessions/` are gitignored for this
   reason — keep them that way.
5. Open the PR against `main` and describe what changed and why. A maintainer
   review is required before merge.

## Reporting bugs

Open an issue with your platform, the plugin/extension version, the steps to
reproduce, and what you expected instead. For anything security-related, follow
[SECURITY.md](SECURITY.md) rather than opening an issue.

## License

By contributing you agree that your contribution is licensed under the
[MIT License](LICENSE).
