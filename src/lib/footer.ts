// Footer 指示灯:ctx.ui.setStatus 状态芯片——`● rtk:on` / `○ rtk:off`。
// 用 setStatus 而非 setFooter:pi 内核 footer 是"单槽覆盖"语义(后挂者顶掉先挂者),
// 整栏 setFooter 会与 pi-open-tui 等自定义 footer 扩展冲突;setStatus 是官方为扩展
// 留的轻量接口,内置 footer 与 pi-open-tui(extensionStatuses 段)都会渲染它,天然共存。
// setStatus 内部自带 requestRender,状态变化即刷新,无需手动触发重绘。

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export const FOOTER_STATUS_KEY = "rtk";

/** 状态指示灯文本:●=生效(绿),○=关闭或不可用(灰)。 */
export function statusIndicator(enabled: boolean, probeOk: boolean): string {
  return enabled && probeOk ? "● rtk:on" : "○ rtk:off";
}

/** 状态芯片句柄。 */
export interface FooterHandle {
  /** 重新计算并上报状态文本(probe 落地 / 开关切换后调用)。 */
  refresh(): void;
  /** 清除状态文本(session 重挂时先调)。 */
  unmount(): void;
}

/**
 * 上报 rtk 状态芯片。TUI 模式以外 no-op(print/json/rpc 没有 footer)。
 * state 是 getter 形式:refresh() 时重读,probe/enabled 翻转自然生效。
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
      refresh() {},
      unmount() {},
    };
  }
  const refresh = (): void => {
    ctx.ui.setStatus(
      FOOTER_STATUS_KEY,
      statusIndicator(state.enabled(), state.probeOk()),
    );
  };
  refresh();
  return {
    refresh,
    unmount: () => ctx.ui.setStatus(FOOTER_STATUS_KEY, undefined),
  };
}
