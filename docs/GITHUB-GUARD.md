# GITHUB-GUARD

本文件只描述 `xpi-rtk` 的仓库级 GitHub 约束。

- 仓库级 Git / GitHub 通用流程见：`docs/GIT-WORKFLOW.md`
- 当前仓库阶段、ruleset、发布入口都在这里说明

## 当前阶段

- `xpi-rtk` 目前按**阶段一**处理：单人快速迭代优先。
- 当前仓库不启用 `release-please`。
- 阶段一是单人快速迭代：用户显式要求「不设分支」时，允许直接在 `main` 上小粒度提交并推送，不走分支 + PR。这是直推保护分支规则在本仓库的固定例外。
- 删分支只限已验证为 `main` 祖先的分支（先 `git merge-base --is-ancestor <branch> main`，再用 `git branch -d`）；未合并分支一律不删。删除后用 `git remote set-head origin -a` 把 `origin/HEAD` 修正到 `main`。
- 如果以后切到阶段二，再把流程改成“分支 + PR + 人工合并”为主。

## 本仓库约束

- 默认不直推保护分支；用户显式要求「不设分支」时按指令直推 `main`（见「当前阶段」）。
- 不强推、不删未合并分支、不改 GitHub ruleset / branch protection / 仓库 settings。
- 不绕过 git hooks。
- 不把密钥 / Token 写入代码、日志、示例、文档。
- `.github/` 目录的变更必须先告知用户。

## 当前规则状态

- `guard-main` 只保留最小防线：`Block force pushes`、`Restrict deletions`。
- bypass 留空。
- 发布相关约束先按仓库现状执行，未配置 release-please。

## 切到阶段二的条件

当仓库满足以下条件时，再切换：

1. CI 已在 `main` 上稳定通过。
2. 用户显式要求进入更严格的协作流。
3. 再开启：
   - `Require a pull request before merging`
   - `Require status checks to pass`
4. 之后再把 `guard-main.json` 同步回仓库。

## 说明

- 这份文件只放仓库级判断，不重复写详细操作手册。
- 详细步骤统一看 `docs/GIT-WORKFLOW.md`。
