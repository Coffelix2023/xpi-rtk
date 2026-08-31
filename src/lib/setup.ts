// 启动自检:rtk 缺失/过旧时征询用户是否安装/升级(D2 零同步 + fail-open)。
// 契约:
//   - rtk 缺失 → 询问安装(官方 install.sh);拒绝写 declinedSetup,之后不再问。
//   - rtk 过旧(< MIN_SUPPORTED_RTK)→ 询问升级;拒绝同样写 declinedSetup。
//   - rtk 可用 → 什么都不做(不强制升级到最新,够用即可)。
//   - 全程不打印命令内容;任何异常静默降级,绝不阻塞会话。

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { MIN_SUPPORTED_RTK, parseRtkVersion, probeRtk, type RtkProbe } from "./rtk.ts";
import { readDeclinedSetup, writeDeclinedSetup } from "./state.ts";

/** rtk 官方安装脚本(INSTALL.md 推荐;macOS/Linux 通用,自动选架构)。 */
export const RTK_INSTALL_CMD =
  "curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh | sh";

export const INSTALL_TIMEOUT_MS = 180_000;

/** 探测结果分类:ok / 缺失(不在 PATH 或 --version 失败)/ 过旧(有版本号但不达标)。 */
export function classifyProbe(probe: RtkProbe): "ok" | "missing" | "outdated" {
  if (probe.ok) return "ok";
  if (probe.version !== null && parseRtkVersion(probe.version)) return "outdated";
  return "missing";
}

/** 征询文案(不含命令内容)。 */
export function setupPrompt(
  probe: RtkProbe,
  kind: "missing" | "outdated",
): {
  title: string;
  message: string;
} {
  if (kind === "missing") {
    return {
      message: `xpi-rtk 需要 rtk (Rust Token Killer) ≥ ${MIN_SUPPORTED_RTK} 才能过滤 bash 输出。\n现在安装最新版 rtk?(安装脚本来自 rtk 官方仓库)`,
      title: "rtk 未安装",
    };
  }
  const min = parseRtkVersion(MIN_SUPPORTED_RTK);
  return {
    message: `本地 rtk ${probe.version} 低于最低要求 ${min?.join(".") ?? MIN_SUPPORTED_RTK}。\n现在升级到最新版 rtk?`,
    title: "rtk 版本过旧",
  };
}

/**
 * 启动自检入口。probe ok → no-op;否则(TUI 且未被拒绝过)confirm 征询,
 * 同意则执行官方安装脚本 + 重探。非 TUI / 拒绝 / 异常 → 静默返回原 probe。
 */
export interface SetupContext {
  mode: "tui" | "rpc" | "json" | "print";
  signal: AbortSignal | undefined;
  ui: {
    confirm(title: string, message: string): Promise<boolean>;
    notify(message: string, type?: "info" | "warning" | "error"): void;
    setWorkingMessage(message?: string): void;
  };
}

/**
 * 启动自检入口。probe ok → no-op;否则(TUI 且未被拒绝过)confirm 征询,
 * 同意则执行官方安装脚本 + 重探。非 TUI / 拒绝 / 异常 → 静默返回原 probe。
 */
export async function runSetupCheck(
  pi: ExtensionAPI,
  ctx: SetupContext,
  probe: RtkProbe,
  statePath: string,
): Promise<RtkProbe> {
  try {
    const kind = classifyProbe(probe);
    if (kind === "ok") return probe;
    if (readDeclinedSetup(statePath)) return probe;
    if (ctx.mode !== "tui") return probe; // print/json/rpc 不弹对话框

    const { title, message } = setupPrompt(probe, kind);
    const confirmed = await ctx.ui.confirm(title, message);
    if (!confirmed) {
      writeDeclinedSetup(true, statePath);
      ctx.ui.notify("已跳过 rtk 安装;xpi-rtk 将保持停用,需要时运行 /rtk setup", "info");
      return probe;
    }

    ctx.ui.setWorkingMessage("正在安装 rtk…");
    const result = await pi.exec(
      "sh",
      [
        "-c",
        RTK_INSTALL_CMD,
      ],
      {
        signal: ctx.signal,
        timeout: INSTALL_TIMEOUT_MS,
      },
    );
    ctx.ui.setWorkingMessage();

    if (result.code !== 0) {
      ctx.ui.notify(
        `rtk 安装脚本失败(退出码 ${result.code});可稍后手动安装后运行 /rtk setup`,
        "error",
      );
      return probe;
    }

    const fresh = await probeRtk(pi);
    if (fresh.ok) {
      ctx.ui.notify(`rtk ${fresh.version} 安装成功,xpi-rtk 已启用`, "info");
    } else {
      ctx.ui.notify(`rtk 安装后探测未通过:${fresh.reason ?? "未知原因"}`, "warning");
    }
    return fresh;
  } catch {
    return probe; // fail-open:征询/安装任何异常都不影响会话
  }
}
