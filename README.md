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

**Why an extension, when `rtk init` exists?** The official `rtk init -g` wires rtk into
a CLI by patching its settings.json and injecting an RTK.md instruction file. That works
for CLIs without an extension system — but pi has one. xpi-rtk is the native way:

- **No `rtk init` needed** — the extension *is* the hook. No settings.json patching,
  no RTK.md injection, nothing to undo when you remove it.
- **One-key switch** — `/rtk off` (or the footer indicator) silences rewriting instantly,
  persisted across restarts. `rtk init` offers no equivalent.
- **Zero maintenance** — rule updates ride along with `brew upgrade rtk`; the extension
  never bundles or syncs rules.
- **First-run bootstrap** — missing or outdated rtk? xpi-rtk offers to install/upgrade it
  for you, using rtk's official installer.

### Features at a glance

- Transparent `bash` → `rtk rewrite` interception (fail-open, bash-only)
- Persistent on/off switch with env override (`RTK_DISABLED=1`)
- Footer status chip: `● rtk:on` / `○ rtk:off` (plays nice with other footer extensions)
- `/rtk status` panel with cumulative token gain from `rtk gain -p`
- First-run setup assistant (install/upgrade rtk via official script)

## Install

```bash
pi install git:github.com/Coffelix2023/xpi-rtk
```

Try without installing:

```bash
pi -e git:github.com/Coffelix2023/xpi-rtk
```


On first startup the extension checks for [rtk](https://github.com/rtk-ai/rtk) (≥ 0.23.0)
in your `PATH`. If it's missing, xpi-rtk asks whether to install the latest rtk for you
(`curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh | sh`);
decline and the extension stays inactive. If your rtk is old but still ≥ 0.23.0, it
keeps working — no forced upgrade.
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
| `/rtk setup` | re-run the rtk install/upgrade prompt (clears a previous decline) |

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

- Zero-sync: rule updates come from upgrading rtk itself; no bundled rule table.
- bash-only by design: pi's `read` tool anchors edits by line number, so its
  output must never be rewritten.
- Scope: switch + panel + wiring. No local rules, no `/rtk sync`, no read rewrite.

## License

MIT — see [LICENSE](LICENSE). rtk is an external dependency licensed under
Apache-2.0 by its own project; see [NOTICE.md](NOTICE.md).

## Acknowledgments

All the heavy lifting — the 100+ output filters — is done by [rtk](https://github.com/rtk-ai/rtk)
(Rust Token Killer), an excellent Apache-2.0 project. xpi-rtk is just the switch,
the panel, and the wiring. Thanks to the rtk team.
