// Nebula Gateway — an OpenAI-compatible AI model gateway.
// Unifies multiple LLM providers behind one API, with priority routing,
// automatic fallback, per-request usage logging and provider health checks.
// Node.js 20+, zero dependencies.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = process.env.PORT || 8787;
const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY || "";
const LOG_FILE = path.join(ROOT, "logs", "usage.jsonl");
const HEALTH_TIMEOUT_MS = 3000;

function loadProviders() {
  const candidates = [
    process.env.PROVIDERS_FILE,
    path.join(ROOT, "config", "providers.json"),
    path.join(ROOT, "config", "providers.example.json"),
  ].filter(Boolean);
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      const list = JSON.parse(fs.readFileSync(file, "utf8"));
      console.log(`Loaded ${list.length} provider(s) from ${file}`);
      return list;
    }
  }
  console.warn("No providers config found; serving with zero providers.");
  return [];
}

const providers = loadProviders();

function logUsage(entry) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
  } catch (err) {
    console.error("usage log failed:", err.message);
  }
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function authorized(req) {
  if (!GATEWAY_API_KEY) return true;
  return req.headers.authorization === `Bearer ${GATEWAY_API_KEY}`;
}

function providersFor(model) {
  return providers
    .filter((p) => p.models.includes(model) || p.models.includes("*"))
    .sort((a, b) => (a.priority || 99) - (b.priority || 99));
}

async function callProvider(provider, payload) {
  const key = process.env[provider.apiKeyEnv] || "";
  const started = Date.now();
  const resp = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const text = await resp.text();
  return { resp, text, latency: Date.now() - started };
}

async function handleChat(req, res) {
  if (!authorized(req)) {
    return sendJson(res, 401, { error: { message: "Invalid gateway API key" } });
  }
  let payload;
  try {
    payload = JSON.parse((await readBody(req)).toString("utf8"));
  } catch {
    return sendJson(res, 400, { error: { message: "Invalid JSON body" } });
  }
  const model = payload.model;
  const candidates = providersFor(model);
  if (candidates.length === 0) {
    return sendJson(res, 404, {
      error: { message: `No provider configured for model "${model}"` },
    });
  }
  let lastError = "unknown error";
  for (const provider of candidates) {
    const started = Date.now();
    try {
      const { resp, text } = await callProvider(provider, payload);
      if (resp.status >= 500) {
        lastError = `${provider.name} returned ${resp.status}`;
        logUsage({
          ts: new Date().toISOString(), model, provider: provider.name,
          status: resp.status, latency_ms: Date.now() - started, fallback: true,
        });
        continue;
      }
      let usage = null;
      try { usage = JSON.parse(text).usage || null; } catch { /* non-JSON body */ }
      logUsage({
        ts: new Date().toISOString(), model, provider: provider.name,
        status: resp.status, latency_ms: Date.now() - started,
        prompt_tokens: usage?.prompt_tokens ?? null,
        completion_tokens: usage?.completion_tokens ?? null,
      });
      res.writeHead(resp.status, {
        "Content-Type": resp.headers.get("content-type") || "application/json",
        "X-Nebula-Provider": provider.name,
      });
      return res.end(text);
    } catch (err) {
      lastError = `${provider.name}: ${err.message}`;
      logUsage({
        ts: new Date().toISOString(), model, provider: provider.name,
        status: 0, latency_ms: Date.now() - started, error: err.message,
      });
    }
  }
  return sendJson(res, 502, {
    error: { message: `All providers failed for model "${model}": ${lastError}` },
  });
}

function handleModels(req, res) {
  if (!authorized(req)) {
    return sendJson(res, 401, { error: { message: "Invalid gateway API key" } });
  }
  const seen = new Map();
  for (const p of providers) {
    for (const m of p.models) {
      if (m !== "*" && !seen.has(m)) {
        seen.set(m, { id: m, object: "model", owned_by: p.name });
      }
    }
  }
  return sendJson(res, 200, { object: "list", data: [...seen.values()] });
}

async function probeProvider(provider) {
  const started = Date.now();
  try {
    const key = process.env[provider.apiKeyEnv] || "";
    const resp = await fetch(`${provider.baseUrl}/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return {
      name: provider.name, status: resp.ok ? "up" : "degraded",
      http: resp.status, latency_ms: Date.now() - started,
    };
  } catch (err) {
    return {
      name: provider.name, status: "down",
      latency_ms: Date.now() - started, error: err.message,
    };
  }
}

async function handleHealth(req, res) {
  const results = await Promise.all(providers.map(probeProvider));
  const up = results.filter((r) => r.status === "up").length;
  return sendJson(res, 200, {
    gateway: "nebula-gateway", providers_up: up,
    providers_total: results.length, providers: results,
  });
}

function handleHome(req, res) {
  let logged = 0;
  try {
    logged = fs.readFileSync(LOG_FILE, "utf8").trim().split("\n").filter(Boolean).length;
  } catch { /* no log yet */ }
  const rows = providers
    .map((p) => `<tr><td>${p.name}</td><td>${p.baseUrl}</td><td>${p.models.join(", ")}</td><td>${p.priority ?? ""}</td></tr>`)
    .join("");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><title>Nebula Gateway</title>
<h1>🌌 Nebula Gateway</h1>
<p>One OpenAI-compatible API in front of ${providers.length} provider(s). ${logged} request(s) logged.</p>
<table border="1" cellspacing="0" cellpadding="6">
<tr><th>Provider</th><th>Base URL</th><th>Models</th><th>Priority</th></tr>${rows}
</table>
<p>Endpoints: <code>POST /v1/chat/completions</code> · <code>GET /v1/models</code> · <code>GET /health</code></p>`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
      return await handleChat(req, res);
    }
    if (req.method === "GET" && url.pathname === "/v1/models") return handleModels(req, res);
    if (req.method === "GET" && url.pathname === "/health") return await handleHealth(req, res);
    if (req.method === "GET" && url.pathname === "/") return handleHome(req, res);
    return sendJson(res, 404, { error: { message: "Not found" } });
  } catch (err) {
    return sendJson(res, 500, { error: { message: err.message } });
  }
});

server.listen(PORT, () => {
  console.log(`Nebula Gateway listening on http://localhost:${PORT}`);
});
