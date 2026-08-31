# xpi-rtk

> **Put every bash command on a diet.** xpi-rtk wires [rtk](https://github.com/rtk-ai/rtk)'s
> 100+ output filters into the [pi coding agent](https://github.com/earendil-works/pi), so your
> agent's context window stops eating raw terminal output.

[中文说明](README.zh-CN.md)

**Put every bash command on a diet** — 给 pi 的每条 bash 命令瘦身。rtk 的 100+ 条输出过滤规则,一根线接进 pi。

## Why

Your agent reads every token its tools print. `git status` alone is 15 lines of boilerplate;
most of it is noise your LLM pays for on every call.

| command | plain output | with rtk |
|---------|-------------|----------|
| `git status` | `On branch…` + 15 lines | `* main` + `clean — nothing to commit` |
| `ls` | bare names, no size | names + sizes in one compact line |

## Install

Requires [rtk](https://github.com/rtk-ai/rtk) ≥ 0.23.0 in your `PATH`
(`brew install rtk-ai/tap/rtk`).

```bash
pi install git:github.com/Coffelix2023/xpi-rtk@v0.1.0
```

Try without installing:

```bash
pi -e git:github.com/Coffelix2023/xpi-rtk
```

## Usage

No configuration. Once loaded, every `bash` tool call is transparently rewritten
through `rtk rewrite` before execution. Fail-open: if rtk is missing, outdated,
or slow, commands run unchanged.

### `/rtk` command

| subcommand | what it does |
|-----------|--------------|
| `/rtk status` | version + on/off state + cumulative token gain (`rtk gain -p`) |
| `/rtk on` / `/rtk off` | persistent switch (survives restarts) |
| `/rtk toggle` | flip the switch |

The footer indicator shows the live state: `● rtk:on` / `○ rtk:off`.

### Disable hierarchy

1. `RTK_DISABLED=1` env (highest priority)
2. persisted switch (`~/.pi/agent/xpi-rtk.json`)
3. default: **on**

## How it works

A thin hook, nothing more — all filtering lives in the official Rust binary:

```
tool_call (bash) ──> rtk rewrite <cmd> ──exit 0/3──> run rewritten command
                       │                            ──exit 1──> run as-is
                       └─ missing / slow / off ──── pass-through (fail-open)
```

- Zero-sync: rule updates come from `brew upgrade rtk`; no bundled rule table.
- bash-only by design: pi's `read` tool anchors edits by line number, so its
  output must never be rewritten.
- Scope: switch + panel + wiring. No local rules, no `/rtk sync`, no read rewrite.

## License

MIT — see [LICENSE](LICENSE). rtk is an external dependency licensed under
Apache-2.0 by its own project; see [NOTICE.md](NOTICE.md).
