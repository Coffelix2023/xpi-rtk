# xpi-rtk

> **给 pi 的每条 bash 命令瘦身** — 把 [rtk](https://github.com/rtk-ai/rtk) 的 100+ 条输出过滤规则,
> 一根线接进 [pi coding agent](https://github.com/earendil-works/pi),让 agent 的上下文窗口不再生吞原始终端输出。

[English](README.md)

## 为什么

Agent 会读到自己工具打印的每一个 token。一条 `git status` 就是 15 行样板,其中大部分是
LLM 每次调用都在付费的噪音。

| 命令 | 原始输出 | 经过 rtk |
|------|---------|----------|
| `git status` | `On branch…` + 15 行 | `* main` + `clean — nothing to commit` |
| `ls` | 纯文件名 | 文件名 + 大小,一行紧凑输出 |

## 安装

要求 [rtk](https://github.com/rtk-ai/rtk) ≥ 0.23.0 在 `PATH` 中
(`brew install rtk-ai/tap/rtk`)。

```bash
pi install git:github.com/Coffelix2023/xpi-rtk@v0.1.0
```

免安装试用:

```bash
pi -e git:github.com/Coffelix2023/xpi-rtk
```

## 使用

零配置。加载后,每次 `bash` 工具调用都会先经 `rtk rewrite` 透明改写再执行。
Fail-open:rtk 缺失、过旧或超时,命令原样执行,永不阻塞。

### `/rtk` 命令

| 子命令 | 作用 |
|--------|------|
| `/rtk status` | 版本 + 开关状态 + 累计 token 收益(`rtk gain -p`) |
| `/rtk on` / `/rtk off` | 持久开关(重启后仍生效) |
| `/rtk toggle` | 切换开关 |

Footer 指示灯实时显示状态:`● rtk:on` / `○ rtk:off`。

### 关闭优先级

1. `RTK_DISABLED=1` 环境变量(最高优先)
2. 持久开关(`~/.pi/agent/xpi-rtk.json`)
3. 默认:**开**

## 工作原理

一个薄 hook,仅此而已——全部过滤逻辑都在官方 Rust 二进制里:

```
tool_call (bash) ──> rtk rewrite <cmd> ──exit 0/3──> 执行改写后的命令
                       │                            ──exit 1──> 原样执行
                       └─ 缺失 / 过旧 / 超时 / 关 ── 放行(fail-open)
```

- 零同步:规则更新来自 `brew upgrade rtk`,仓库内不内置规则表。
- 仅 bash:pi 的 `read` 工具按行号锚定编辑,其输出绝不能被改写——这是正确性约束。
- 范围:开关 + 面板 + 接线。不做本地规则、不做 `/rtk sync`、不改写 read。

## 许可证

MIT — 见 [LICENSE](LICENSE)。rtk 是外部依赖,由其上游项目以 Apache-2.0 授权;见 [NOTICE.md](NOTICE.md)。
