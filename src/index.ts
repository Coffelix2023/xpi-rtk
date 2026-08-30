// xpi-rtk — rtk(Rust Token Killer)Pi 扩展 MVP。
// 薄委托架构(D1):规则 100% 在官方 Rust 二进制,本扩展只做开关(D4)+ 面板(D5)。
// 全路径 fail-open:任何异常不阻塞命令执行。

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { probeRtk, REWRITE_TIMEOUT_MS, rewriteCommand } from "./lib/rtk.ts";
import { applyToggle, effectiveEnabled } from "./lib/state.ts";

const VERSION = "0.1.0";
const WS_SPLIT_RE = /\s+/;

export default function xpiRtk(pi: ExtensionAPI): void {
  // 启动探测一次;后续 tool_call 直接 await 已完成的 promise(微秒级)。
  const probePromise = probeRtk(pi);
  void probePromise.then((probe) => {
    if (!probe.ok) {
      console.warn(`[xpi-rtk] ${probe.reason} — 改写功能停用(命令将原样执行)`);
    }
  });

  pi.on("tool_call", async (event, ctx) => {
    try {
      if (event.toolName !== "bash") return; // D3:仅 bash(read 锚点是编辑回路的正确性约束)
      const cmd = event.input.command;
      if (typeof cmd !== "string" || cmd.trim() === "") return;
      if (cmd.startsWith("rtk ")) return; // 已是 rtk 命令,防递归
      if (process.env.RTK_DISABLED === "1") return; // 官方契约优先
      if (!effectiveEnabled(process.env)) return; // D4:持久开关
      const probe = await probePromise;
      if (!probe.ok) return; // rtk 不可用 → 放行

      const rewritten = await rewriteCommand(pi, cmd, ctx.signal);
      if (rewritten && rewritten !== cmd) {
        event.input.command = rewritten; // 原地改写,pi 主进程不再重新校验
      }
    } catch (err) {
      console.warn("[xpi-rtk] tool_call 处理异常,命令放行", err);
      return;
    }
  });

  pi.registerCommand("rtk", {
    description: `rtk 开关与信息面板 ${VERSION}(on | off | toggle | status)`,
    handler: async (args, ctx) => {
      const sub = args.trim().split(WS_SPLIT_RE)[0] || "status";
      switch (sub) {
        case "on": {
          const enabled = applyToggle("on");
          ctx.ui.notify(
            enabled ? "rtk 已开启" : "rtk 已开启(状态文件写入失败,本次会话仍可能放行)",
            "info",
          );
          break;
        }
        case "off": {
          const enabled = applyToggle("off");
          ctx.ui.notify(enabled ? "rtk 已开启" : "rtk 已关闭(重启后仍生效)", "info");
          break;
        }
        case "toggle": {
          const enabled = applyToggle("toggle");
          ctx.ui.notify(enabled ? "rtk 已开启" : "rtk 已关闭(重启后仍生效)", "info");
          break;
        }
        case "status": {
          const probe = await probePromise;
          // D5:委托 rtk gain -p 原文,格式化代码 0 行
          const result = await pi.exec(
            "rtk",
            [
              "gain",
              "-p",
            ],
            {
              timeout: REWRITE_TIMEOUT_MS,
            },
          );
          const gain =
            result.code === 0
              ? `\n${result.stdout.trim()}`
              : `\n(rtk gain 执行失败,退出码 ${result.code})`;
          ctx.ui.notify(
            `rtk ${probe.version ?? "未检测到"} · ${effectiveEnabled(process.env) ? "开启" : "关闭"}${gain}`,
            "info",
          );
          break;
        }
        default:
          ctx.ui.notify(
            `未知子命令: ${sub}(可用: on | off | toggle | status)`,
            "warning",
          );
      }
    },
  });
}
