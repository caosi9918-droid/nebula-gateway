# Tech steering

## Stack

- Runtime: Node.js 20+ (uses the built-in `fetch`, no runtime dependencies).
- Language: JavaScript (ES modules).
- API style: OpenAI-compatible REST (`/v1/chat/completions`, `/v1/models`).
- Packaging: plain `node` process; a Dockerfile is provided for deployment.
- Storage: append-only JSONL usage log on disk (`logs/usage.jsonl`).

## Conventions

- Zero runtime dependencies: if Node can do it, we do not add a package.
- Configuration lives in `config/providers.json`; secrets are referenced by
  environment-variable name and never written into config files.
- Every proxied request must produce exactly one usage log line, including
  failed attempts (marked with their status), so cost accounting never has
  silent gaps.
- Fallback order is explicit configuration (provider `priority`), never
  implicit or random.
- Health checks probe a real provider endpoint (`GET /models`) with a short
  timeout; a provider is only "up" when that probe succeeds.

## Compatibility notes

Providers differ in small ways (error shapes, usage fields). The gateway
passes request and response bodies through unchanged whenever possible, and
only normalizes what routing and logging need: model name, status, token
usage.
