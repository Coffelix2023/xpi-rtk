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

**已有 `rtk init`,为什么还要这个扩展?** 官方 `rtk init -g` 靠改写目标 CLI 的 settings.json、
注入 RTK.md 指令文件来接入 rtk——那是给没有扩展机制的 CLI 准备的。pi 有原生扩展系统,xpi-rtk 就是原生方式:

- **免 `rtk init`** —— 扩展本身就是 hook。不改 settings.json、不注入 RTK.md、卸载无残留。
- **一键开关** —— `/rtk off`(或 footer 指示灯)即时停止改写,重启后仍生效。`rtk init` 做不到。
- **零维护** —— 规则更新随 `brew upgrade rtk` 自动同步,扩展不内置、不同步任何规则表。
- **首启自举** —— rtk 缺失或过旧?扩展用 rtk 官方安装脚本帮你装/升。

### 特性一览

- 透明拦截 `bash` → `rtk rewrite`(fail-open,仅 bash)
- 持久开关 + 环境变量覆盖(`RTK_DISABLED=1`)
- Footer 状态芯片:`● rtk:on` / `○ rtk:off`(与其他 footer 扩展友好共存)
- `/rtk status` 面板:来自 `rtk gain -p` 的累计 token 收益
- 首启安装助手(官方脚本安装/升级 rtk)

## 安装

```bash
pi install git:github.com/Coffelix2023/xpi-rtk
```

免安装试用:

```bash
pi -e git:github.com/Coffelix2023/xpi-rtk
```

首次启动时,扩展会检查 `PATH` 中是否有 [rtk](https://github.com/rtk-ai/rtk)(≥ 0.23.0)。
若缺失,xpi-rtk 会询问是否帮你安装最新版 rtk
(`curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh | sh`);
拒绝则本扩展保持停用。若本地 rtk 版本较旧但仍 ≥ 0.23.0,可正常使用,不强制升级。

## 使用

零配置。加载后,每次 `bash` 工具调用都会先经 `rtk rewrite` 透明改写再执行。
Fail-open:rtk 缺失、过旧或超时,命令原样执行,永不阻塞。

### `/rtk` 命令

| 子命令 | 作用 |
|--------|------|
| `/rtk status` | 版本 + 开关状态 + 累计 token 收益(`rtk gain -p`) |
| `/rtk on` / `/rtk off` | 持久开关(重启后仍生效) |
| `/rtk toggle` | 切换开关 |
| `/rtk setup` | 重新触发 rtk 安装/升级询问(清除之前的拒绝标记) |

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

- 零同步:规则更新来自升级 rtk 本身,仓库内不内置规则表。
- 仅 bash:pi 的 `read` 工具按行号锚定编辑,其输出绝不能被改写——这是正确性约束。
- 范围:开关 + 面板 + 接线。不做本地规则、不做 `/rtk sync`、不改写 read。

## 许可证

MIT — 见 [LICENSE](LICENSE)。rtk 是外部依赖,由其上游项目以 Apache-2.0 授权;见 [NOTICE.md](NOTICE.md)。

## 致谢

真正的重活——100+ 条输出过滤规则——全部由 [rtk](https://github.com/rtk-ai/rtk)
(Rust Token Killer)完成,这是一个优秀的 Apache-2.0 项目。xpi-rtk 只是开关、面板和接线。感谢 rtk 团队。
