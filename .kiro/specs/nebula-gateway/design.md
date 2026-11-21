# Design: Nebula Gateway (core)

## Architecture

A single Node.js HTTP server (`src/server.js`, zero dependencies) sits
between clients and LLM providers:

```
client ──▶ Nebula Gateway ──▶ provider A (priority 1)
                    │    └───▶ provider B (priority 2, fallback)
                    ├─ usage log (logs/usage.jsonl)
                    └─ /health probes provider /models endpoints
```

## Components

- **Router** — reads the request's `model`, selects configured providers
  serving it, ordered by `priority`.
- **Proxy** — forwards the request with the provider's API key (from the
  environment variable named in config), streams or buffers the response
  back unchanged, and falls back on network errors / 5xx.
- **Usage logger** — appends one JSONL record per completed or failed
  request: timestamp, model, provider, token usage, latency, status.
- **Health checker** — `GET /health` probes each provider's `/models`
  endpoint with a 3-second timeout and reports status + latency. A real
  endpoint is used because a bare TCP/HTTP success does not prove the model
  service works.
- **Status page** — `GET /` renders a small HTML summary: providers, models,
  and the number of logged requests.

## Configuration

`config/providers.json`:

```json
[
  {
    "name": "provider-a",
    "baseUrl": "https://api.example.com/v1",
    "apiKeyEnv": "PROVIDER_A_API_KEY",
    "models": ["model-x", "model-y"],
    "priority": 1
  }
]
```

Secrets are never stored in the file — only the name of the environment
variable that holds the key.

## Error handling

- Unknown model → 404. All providers down → 502. Missing/invalid gateway
  key (when `GATEWAY_API_KEY` is set) → 401.
- Failed attempts are still usage-logged with their status, so cost and
  reliability reporting have no silent gaps.
