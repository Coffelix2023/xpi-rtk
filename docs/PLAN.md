# PLAN — xpi-rtk MVP

> 本文档是 MVP 实现契约(来自 2025 设计 deck 的 5 项决策)+ 任务拆分。
> 执行时逐项对照,完成后勾选。与 AGENTS.md 冲突时以 AGENTS.md 为准。

## 0. 背景一页纸

- rtk(Rust Token Killer):官方 Rust CLI 代理,`rtk rewrite` 内置 100+ 命令过滤规则,拦截 agent bash 输出省 token。
- 官方已有 Pi hook(`hooks/pi/rtk.ts`,~93 行):`tool_call` → `rtk rewrite` → 原地改写 command。
- xpi-rtk 定位:**开关 + 面板 + 生命周期管理**,不复刻过滤逻辑。
- 本地环境:rtk 0.46.0(brew);`~/.pi/agent/extensions/` 为空,无双载风险。

## 1. 实现契约(deck 选定,不得漂移)

| # | 决策 | 契约 |
|---|------|------|
| D1 架构 | 薄委托 | 规则 100% 在官方 Rust 二进制;扩展只做 `rtk rewrite` 委托;无本地规则表 |
| D2 同步 | 零同步架构 | exit-code 协议(0/3=改写,1=放行)+ 最低版本下限 `0.23.0`;`brew upgrade rtk` 即同步 |
| D3 范围 | 仅 bash | 只拦截 `tool_name === "bash"`;pi 的 read 带行锚点,不碰是正确性约束 |
| D4 开关 | 持久开关 + env 优先 | 优先级:`RTK_DISABLED=1`(env,官方契约)> `~/.pi/agent/xpi-rtk.json` `{enabled}` > 默认开 |
| D5 面板 | 委托 `rtk gain -p` 原文 | 格式化代码 0 行;多行 notify 渲染不行则退单行 |

### 全局守则

- fail-open:任何异常路径不阻塞命令执行(官方 hook 同款契约)。
- rtk 不在 PATH / 版本过旧:启动探测后降级 no-op,不 crash。
- 不打印用户命令内容到日志(隐私);错误信息不含 Token。

### 非目标(明确不做)

- 本地规则表 / TS 过滤引擎 / `/rtk sync` / 版本雷达(GitHub API)/ 会话级 mute / read 工具改写。

## 2. 任务拆分

- [x] T0 建立计划文档(本文)
- [x] T1 读 Pi 类型定义:`ExtensionAPI.registerCommand` / `tool_call` 事件 / `pi.exec` / `ctx.ui.notify`,以 `.d.ts` 为准,不猜 API
- [x] T2 `src/lib/rtk.ts`:二进制探测(版本解析 + ≥0.23 下限)+ rewrite 委托(timeout 2s,exit-code 0/1/3 映射)
- [x] T3 `src/lib/state.ts`:开关状态(状态文件单字段 + `RTK_DISABLED` env 优先级 + `rtk on|off|toggle` 写回)
- [x] T4 `src/index.ts` 接线:`tool_call` hook(bash-only guard + 开关检查 + fail-open)+ `/rtk` 命令(`status` 委托 `rtk gain -p`)
- [x] T5 vitest 测试:state 优先级矩阵 / rewrite exit-code 映射 / bash-only guard(mock,不依赖真实 rtk)
- [x] T6 三绿:`pnpm typecheck` + `pnpm -w run lint` + `pnpm test`
- [x] T7 冒烟:`pi -e ./src/index.ts`(print 模式:`git status` 输出已是 rtk 紧凑格式 `* main`;TUI 冒烟留给安装后循环)
- [ ] T8 git:`feat/rtk-mvp` 分支 + 小粒度 Conventional Commits(显式 add;推送/发布等用户确认)

## 3. 验证门(每个 T 后运行)

```bash
pnpm typecheck && pnpm -w run lint && pnpm test
```

冒烟检查点(T7):`git status` 被 agent 跑时改写为 `rtk git status`?`/rtk off` 后放行?`RTK_DISABLED=1` 优先于开关文件?`/rtk status` 显示 gain 数据?卸载 rtk 二进制后 pi 正常启动?

## 4. 发布回路(实现完成后,需用户参与)

1. 用户在 GitHub UI 建远端仓库 → 本地加 origin(我不代建远端)
2. 推送 `feat/rtk-mvp` 分支 → 打 tag `v0.1.0`(与 package.json 同步)
3. 试用:`pi -e git:github.com/<user>/xpi-rtk`
4. 安装:`pi install git:github.com/<user>/xpi-rtk@v0.1.0`(pin 不自动跟新,升级用 `pi install ...@v0.1.1`)
5. 循环调试:改代码 → 提交 → 新 tag → `pi install git:...@新tag`

## 5. 记录

- 2025:deck 5 项决策全部按推荐方向选定;本文档创建。
