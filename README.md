# Nebula Gateway

An intelligent AI model gateway that unifies multiple LLM providers behind one
OpenAI-compatible API, with smart routing, fallback, usage & cost analytics,
and real-time model health observability.

## Why

Developers integrating several LLM providers have to juggle different API
formats, keys, rate limits and pricing, and usually have no single place to
see what is being spent or whether a model is actually healthy. Nebula Gateway
puts one consistent API in front of all of them.

## Features

- **Unified API access** — one OpenAI-compatible endpoint (`/v1/chat/completions`,
  `/v1/models`) in front of many providers.
- **Intelligent routing & fallback** — requests are routed by model to the
  configured providers in priority order; if one fails, the next takes over.
- **Usage analytics** — every request is logged with model, provider, token
  usage and latency (JSONL), ready for cost reporting.
- **Model monitoring** — `/health` probes every provider and reports status
  and latency, using real model endpoints instead of bare HTTP pings.
- **Centralized management** — providers, models and priorities live in one
  config file; an optional gateway API key protects the endpoints.

## Quick start

```bash
cp config/providers.example.json config/providers.json
# edit config/providers.json, export the provider keys it references, e.g.
export OPENAI_API_KEY=sk-...
npm start            # listens on http://localhost:8787
```

Call it like any OpenAI-compatible API:

```bash
curl http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "Hello!"}]}'
```

Check provider health and the model catalogue:

```bash
curl http://localhost:8787/health
curl http://localhost:8787/v1/models
```

## How routing works

`config/providers.json` lists providers with a base URL, the environment
variable holding their API key, the models they serve and a priority.
For a request, Nebula filters the providers that serve the requested model,
tries them in priority order, and falls back on network errors or 5xx
responses. The response is returned unchanged, and the call is recorded in
`logs/usage.jsonl`.

## Project structure

```
src/server.js            the gateway (Node.js, zero dependencies)
config/                  provider configuration (example included)
.kiro/steering/          product, tech and structure steering docs
.kiro/specs/             feature specs (requirements + design)
logs/                    usage records (created at runtime)
```

## Built with Kiro

This project was developed with [Kiro](https://kiro.dev) as the AI coding
partner. The `.kiro` directory is committed on purpose: it holds the steering
documents and specs that guided the implementation, as required by the
Kiroween 2026 hackathon rules.

## Tech stack

Node.js 20+, JavaScript, Docker. No runtime dependencies.

## License

MIT
