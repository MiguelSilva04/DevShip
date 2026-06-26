---
name: headroom
description: >
  Context compression expert for AI agents. Knows how to set up, integrate, and
  troubleshoot headroom — the local compression layer that cuts token usage 60–95%
  before prompts reach the LLM, preserving accuracy. Covers all modes: library
  (Python/TS), proxy, MCP server, and agent wrap. Triggers: "headroom", "compress
  context", "compress tokens", "reduce tokens", "token compression", "context
  compression", "headroom wrap", "headroom proxy", "headroom mcp", "too many
  tokens", "context too large", "shrink context", "/headroom".
license: Apache-2.0
---

# Headroom

Headroom compresses everything the agent reads — tool outputs, logs, RAG chunks,
files, conversation history — before it reaches the LLM. Same answers, fraction
of the tokens. Runs locally; your data never leaves.

Source: https://github.com/headroomlabs-ai/headroom  
Docs: https://headroom-docs.vercel.app/docs

## What it does

- **60–95% token reduction** on real agent workloads (code search, SRE debugging, issue triage)
- **Accuracy preserved**: GSM8K ±0.000, TruthfulQA +0.030, BFCL 97% at 32% compression
- **Reversible (CCR)**: originals cached locally, LLM retrieves on demand via `headroom_retrieve`
- **Output shaping**: also trims what the model writes back (preambles, restated code)
- **Cross-agent memory**: shared store across Claude, Codex, Gemini with auto-dedup
- **`headroom learn`**: mines failed sessions, writes corrections to `CLAUDE.md` / `AGENTS.md`

## Install

```bash
pip install "headroom-ai[all]"   # Python (requires 3.10+)
npm install headroom-ai          # TypeScript / Node
```

Update anytime: `headroom update`

## Pick the right mode

| Mode | When to use | Command |
|------|------------|---------|
| **wrap** | Daily Claude Code use — zero config, instant savings | `headroom wrap claude` |
| **proxy** | Any language, zero code changes, drop-in | `headroom proxy --port 8787` |
| **library** | Inline in your own app | `from headroom import compress` / `import { compress }` |
| **MCP** | MCP-native client (Claude Desktop, etc.) | `headroom mcp install` |

Default recommendation: **wrap** for interactive coding, **proxy** for apps.

## Agent wrap (Claude Code)

```bash
headroom wrap claude
# also: headroom wrap codex|cursor|aider|copilot
```

Starts the proxy, sets env vars, launches the agent. Shares memory across agents
if you use multiple.

Useful flags:
- `headroom wrap claude --memory` — enable cross-agent memory
- `headroom wrap claude --code-graph` — enable code graph for codebase exploration

## Proxy mode

```bash
headroom proxy --port 8787
# Point any OpenAI-compatible client at http://localhost:8787
```

Output shaping (trims model verbosity, costs matter on Opus-class):
```bash
export HEADROOM_OUTPUT_SHAPER=1
headroom proxy --port 8787
```

Learn the right terseness level from past sessions:
```bash
headroom learn --verbosity          # preview
headroom learn --verbosity --apply  # save and activate
```

## Library mode

```python
from headroom import compress

compressed = compress(messages, model="claude-opus-4-8")
# pass compressed to your LLM client as normal
```

```typescript
import { compress } from 'headroom-ai'

const compressed = await compress(messages, { model: 'claude-opus-4-8' })
```

SDK wrappers (zero refactor):
```python
from headroom.integrations import withHeadroom
import anthropic

client = withHeadroom(anthropic.Anthropic())
# use client exactly as before
```

## MCP tools (when installed as MCP server)

- `headroom_compress` — compress a payload before sending
- `headroom_retrieve` — retrieve the original of a CCR-compressed chunk
- `headroom_stats` — show compression stats for the current session

## Compressors

Headroom auto-routes by content type — no config needed:

| Content | Compressor | Typical saving |
|---------|-----------|---------------|
| JSON / tool outputs | SmartCrusher | 73–92% |
| Code (Python, JS, Go, Rust, Java, C++) | CodeCompressor (AST-aware) | 47–92% |
| Prose / logs | Kompress-base (HuggingFace model) | varies |
| Images | ML router | 40–90% |

CacheAligner stabilizes prefixes so provider KV caches actually hit — free
latency win on top of compression.

## headroom learn

Mines failed agent sessions and writes corrections back to `CLAUDE.md` / `AGENTS.md`:

```bash
headroom learn                # mine all supported agents
headroom learn --verbosity    # also learn your preferred terseness level
```

Run this periodically. The more sessions it sees, the better the corrections.

## Check savings

```bash
headroom perf           # throughput and compression stats
headroom output-savings # output token reduction estimate (with CI range)
```

## Common integrations

```python
# LangChain
from headroom.integrations.langchain import HeadroomChatModel
model = HeadroomChatModel(your_llm)

# LiteLLM
import litellm
from headroom.integrations.litellm import HeadroomCallback
litellm.callbacks = [HeadroomCallback()]

# ASGI middleware
from headroom.integrations.asgi import CompressionMiddleware
app.add_middleware(CompressionMiddleware)
```

## When NOT to use headroom

- Sandboxed environments where local processes can't run
- You only use a single provider's native compaction and don't need cross-agent memory
- You need guaranteed deterministic token counts (compression introduces variance)

## Troubleshooting

**`CERTIFICATE_VERIFY_FAILED` on install:** SSL inspection network. Install Rust
first (`winget install Rustlang.Rustup && rustup default stable` on Windows), then
re-run pip. Or use prebuilt wheel: `pip install --only-binary headroom-ai headroom-ai`.

**Output shaper not taking effect on running proxy:** set env vars *before*
`headroom wrap`. The wrap command hot-syncs via loopback POST, but only if you
set them before launch.

**`headroom wrap` reused a running proxy:** your new env vars won't be picked up
unless you restart or use `POST /admin/runtime-env`.

## Boundaries

This skill advises on headroom setup, integration, and usage. It does not
compress anything itself — it helps you wire headroom into your stack so it
can. For architecture questions beyond headroom's scope, use normal mode.
