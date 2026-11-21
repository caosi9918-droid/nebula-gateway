# Requirements: Nebula Gateway (core)

## Introduction

Nebula Gateway exposes one OpenAI-compatible API in front of multiple LLM
providers, with routing, fallback, usage logging and health monitoring.

## Requirements

### Requirement 1: Unified chat endpoint

**User story:** As a developer, I want to call one endpoint for any model, so
that I do not integrate each provider separately.

#### Acceptance criteria

1. WHEN a client posts a valid request to `/v1/chat/completions` THEN the
   gateway SHALL forward it to a configured provider that serves the
   requested model and return the provider's response unchanged.
2. WHEN the requested model is not served by any provider THEN the gateway
   SHALL respond 404 with an explanatory error body.
3. WHEN `GATEWAY_API_KEY` is set and the request lacks a matching
   `Authorization: Bearer` header THEN the gateway SHALL respond 401.

### Requirement 2: Routing with fallback

**User story:** As an operator, I want a provider outage to be invisible to
my users.

#### Acceptance criteria

1. WHEN several providers serve the requested model THEN the gateway SHALL
   try them in ascending `priority` order.
2. WHEN a provider attempt fails with a network error or a 5xx response
   THEN the gateway SHALL try the next provider.
3. WHEN every provider attempt fails THEN the gateway SHALL respond 502.

### Requirement 3: Usage logging

**User story:** As an operator, I want every call accounted for, so that I
can analyze token usage and cost per model and provider.

#### Acceptance criteria

1. WHEN a proxied request completes or fails THEN the gateway SHALL append
   exactly one JSON line to `logs/usage.jsonl` containing timestamp, model,
   provider, token usage (when reported), latency and status.

### Requirement 4: Health monitoring

**User story:** As an operator, I want to know which providers are really
working, not just reachable.

#### Acceptance criteria

1. WHEN a client calls `/health` THEN the gateway SHALL probe each
   provider's `/models` endpoint with a short timeout and report per-provider
   status and latency.

### Requirement 5: Model catalogue

1. WHEN a client calls `/v1/models` THEN the gateway SHALL return the union
   of models from all configured providers in OpenAI list format.
