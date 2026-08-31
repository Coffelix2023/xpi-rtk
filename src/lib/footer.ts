// Footer 指示灯:整栏自定义底栏——左:token 统计 + ctx% + 分支 + 模型;右:● rtk:on / ○ rtk:off。
// 数据源:footerData(分支)+ ctx(sessionManager/model/getContextUsage)——统计口径对齐内置 footer。
// 纯函数(formatTokens/statusIndicator/usageTotals)可测;mountFooter 是薄接线。

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

/** 与内置 footer 相同的 token 缩写口径(999→999 / 1000→1.0k / 12345→12k / 1.2M→1.2M)。 */
export function formatTokens(count: number): string {
  if (count < 1000) return String(count);
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
  return `${Math.round(count / 1000000)}M`;
}

/** 从当前会话分支累计 token/成本(assistant 消息口径,同内置 FooterComponent)。 */
export function usageTotals(ctx: Pick<ExtensionContext, "sessionManager">): {
  input: number;
  output: number;
  cost: number;
} {
  let input = 0;
  let output = 0;
  let cost = 0;
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.role === "assistant") {
      const usage = entry.message.usage;
      input += usage.input;
      output += usage.output;
      cost += usage.cost.total;
    }
  }
  return {
    input,
    output,
    cost,
  };
}

/** 状态指示灯文本:●=生效(绿),○=关闭或不可用(灰)。 */
export function statusIndicator(enabled: boolean, probeOk: boolean): string {
  return enabled && probeOk ? "● rtk:on" : "○ rtk:off";
}

/**
 * 挂载自定义 footer(整栏替换内置底栏)。渲染每次重绘时重新读分支/token/context;
 * 开关变化后调用方需自行触发 UI 重绘。返回卸载函数(恢复内置 footer)。
 */
export interface FooterHandle {
  /** 触发一次重绘(probe 结果落地 / 开关切换后由调用方调用)。 */
  requestRender(): void;
  /** 恢复内置 footer。 */
  unmount(): void;
}

/**
 * 挂载自定义 footer(整栏替换内置底栏)。渲染每次重绘时重新读分支/token/context;
 * 状态变化后调用 handle.requestRender()。TUI 之外的 mode 不挂载,返回 no-op handle。
 */
export function mountFooter(
  ctx: ExtensionContext,
  state: {
    enabled: () => boolean;
    probeOk: () => boolean;
  },
): FooterHandle {
  if (ctx.mode !== "tui") {
    return {
      requestRender() {},
      unmount() {},
    };
  }
  let trigger: (() => void) | undefined;
  ctx.ui.setFooter((tui, theme, footerData) => {
    trigger = () => tui.requestRender();
    const unsub = footerData.onBranchChange(() => tui.requestRender());
    return {
      dispose: unsub,
      invalidate() {},
      render(width: number): string[] {
        const { input, output } = usageTotals(ctx);
        const usage = ctx.getContextUsage();
        const context = usage?.percent != null ? `${usage.percent.toFixed(0)}%` : "?";
        const branch = footerData.getGitBranch();

        const left = theme.fg(
          "dim",
          `↑${formatTokens(input)} ↓${formatTokens(output)} ctx ${context}${branch ? ` (${branch})` : ""} · ${ctx.model?.id ?? "no-model"}`,
        );
        const enabled = state.enabled();
        const indicator = theme.fg(
          enabled ? "success" : "dim",
          statusIndicator(enabled, state.probeOk()),
        );

        const gap = width - visibleWidth(left) - visibleWidth(indicator);
        const leftPart =
          gap >= 2 ? left + " ".repeat(gap) : truncateToWidth(left, Math.max(1, gap));
        return [
          leftPart + indicator,
        ];
      },
    };
  });
  return {
    requestRender: () => trigger?.(),
    unmount: () => ctx.ui.setFooter(undefined),
  };
}
