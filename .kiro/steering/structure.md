# Structure steering

```
.
├── README.md                  project overview and quick start
├── package.json               npm metadata; `npm start` runs the gateway
├── Dockerfile                 container image for the gateway
├── src/
│   └── server.js              the whole gateway: routing, fallback,
│                              health checks, usage logging, status page
├── config/
│   ├── providers.example.json copy to providers.json and edit
│   └── providers.json         local provider config (not committed)
├── logs/
│   └── usage.jsonl            runtime usage records (not committed)
└── .kiro/
    ├── steering/              product.md, tech.md, structure.md
    └── specs/nebula-gateway/  requirements.md, design.md
```

## Rules

- Keep the gateway in one file until it genuinely hurts; clarity beats
  premature modularization for a project of this size.
- New providers are added by configuration, not by code changes.
- Anything secret (API keys) stays in environment variables.
