# Product: Nebula Gateway

## Overview

Nebula Gateway is an AI model gateway and observability platform. It gives
developers one OpenAI-compatible API in front of many LLM providers, and gives
operators one place to route traffic, watch model health and track usage and
cost.

## Users

- Individual developers and small teams who call several LLM providers and
  want one integration instead of many.
- Operators of AI relay / API services who need routing, fallback and usage
  records to run their service reliably.

## Key capabilities

1. Unified API access to multiple LLM providers.
2. Priority routing with automatic fallback when a provider fails.
3. Per-request usage logging (model, provider, tokens, latency) for cost
   analytics.
4. Health monitoring that probes real model endpoints, because a bare
   HTTP 200 does not prove a model works.
5. Centralized provider configuration, with an optional gateway API key.

## Goals

- Make multi-model integration boring: one endpoint, one key, one log.
- Make failures survivable: a provider outage should not become an app outage.
- Make costs visible: every token accounted for, per model and provider.

## Non-goals

- Training or fine-tuning models.
- A billing/payment system (usage records are exported, not invoiced).
- Replacing provider dashboards for deep per-provider administration.
