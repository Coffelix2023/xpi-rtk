// footer 模块单测:纯函数矩阵 + mountFooter 渲染布局(mock,不依赖真实 pi/rtk)。
import { describe, expect, it, vi } from "vitest";
import { formatTokens, mountFooter, statusIndicator, usageTotals } from "./footer.ts";

describe("formatTokens", () => {
  it("与内置 footer 相同的缩写口径", () => {
    expect(formatTokens(999)).toBe("999");
    expect(formatTokens(1000)).toBe("1.0k");
    expect(formatTokens(1234)).toBe("1.2k");
    expect(formatTokens(12345)).toBe("12k");
    expect(formatTokens(1_234_567)).toBe("1.2M");
    expect(formatTokens(12_345_678)).toBe("12M");
  });
});

describe("statusIndicator", () => {
  it("四态矩阵:on+ok=● / off=○ / on+probe失败=○", () => {
    expect(statusIndicator(true, true)).toBe("● rtk:on");
    expect(statusIndicator(false, true)).toBe("○ rtk:off");
    expect(statusIndicator(true, false)).toBe("○ rtk:off");
    expect(statusIndicator(false, false)).toBe("○ rtk:off");
  });
});

describe("usageTotals", () => {
  it("只累计 assistant 消息的 usage", () => {
    const ctx = {
      sessionManager: {
        getBranch: () => [
          {
            type: "message",
            message: {
              role: "assistant",
              usage: {
                input: 10,
                output: 20,
                cost: {
                  total: 0.5,
                },
              },
            },
          },
          {
            type: "message",
            message: {
              role: "user",
            },
          },
          {
            type: "message",
            message: {
              role: "assistant",
              usage: {
                input: 5,
                output: 5,
                cost: {
                  total: 0.25,
                },
              },
            },
          },
        ],
      },
      // biome 不会检查这里,仅测试用窄对象
    } as unknown as Parameters<typeof usageTotals>[0];
    expect(usageTotals(ctx)).toEqual({
      cost: 0.75,
      input: 15,
      output: 25,
    });
  });
});

describe("mountFooter", () => {
  /** 构造最小 ctx/tui/footerData mock,返回 (render 输出, trigger mock)。 */
  function setup(state: { enabled: boolean; probeOk: boolean }) {
    let renderFn: ((width: number) => string[]) | undefined;
    const requestRender = vi.fn();
    const unsub = vi.fn();
    const setFooter = vi.fn((factory: unknown) => {
      if (typeof factory !== "function") return; // unmount 传 undefined,恢复内置
      const component = (factory as (t: unknown, th: unknown, fd: unknown) => unknown)(
        {
          requestRender,
        },
        {
          fg: (_c: string, s: string) => s,
        },
        {
          getGitBranch: () => "main",
          onBranchChange: () => unsub,
        },
      );
      renderFn = (
        component as {
          render: (w: number) => string[];
        }
      ).render;
    });
    const ctx = {
      mode: "tui",
      getContextUsage: () => ({
        contextWindow: 100,
        percent: 42.4,
        tokens: 1,
      }),
      model: {
        id: "test-model",
      },
      sessionManager: {
        getBranch: () => [],
      },
      ui: {
        setFooter,
      },
    } as unknown as Parameters<typeof mountFooter>[0];
    const handle = mountFooter(ctx, {
      enabled: () => state.enabled,
      probeOk: () => state.probeOk,
    });
    return {
      handle,
      renderFn: renderFn as (w: number) => string[],
      requestRender,
      unsub,
      setFooter,
    };
  }

  it("非 TUI 模式返回 no-op handle,不触碰 setFooter", () => {
    const setFooter = vi.fn();
    const ctx = {
      mode: "print",
      ui: {
        setFooter,
      },
    } as unknown as Parameters<typeof mountFooter>[0];
    const handle = mountFooter(ctx, {
      enabled: () => true,
      probeOk: () => true,
    });
    handle.requestRender();
    handle.unmount();
    expect(setFooter).not.toHaveBeenCalled();
  });

  it("on 状态渲染 ● rtk:on,token/ctx/分支/模型齐全,右侧对齐", () => {
    const { renderFn } = setup({
      enabled: true,
      probeOk: true,
    });
    const lines = renderFn(60);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("● rtk:on");
    expect(lines[0]).toContain("↑0 ↓0 ctx 42% (main) · test-model");
    // 指示灯必须贴右缘
    expect(lines[0].endsWith("● rtk:on")).toBe(true);
  });

  it("off 状态渲染 ○ rtk:off", () => {
    const { renderFn } = setup({
      enabled: false,
      probeOk: true,
    });
    expect(renderFn(60)[0]).toContain("○ rtk:off");
  });

  it("probe 未通过时即使 enabled 也显示 off", () => {
    const { renderFn } = setup({
      enabled: true,
      probeOk: false,
    });
    expect(renderFn(60)[0]).toContain("○ rtk:off");
  });

  it("narrow terminal truncates left but keeps indicator intact", () => {
    const { renderFn } = setup({
      enabled: true,
      probeOk: true,
    });
    const line = renderFn(20)[0];
    expect(line.endsWith("● rtk:on")).toBe(true);
    expect(line.length).toBeLessThanOrEqual(20);
  });

  it("unmount 恢复内置 footer;setFooter 工厂绑定 requestRender", () => {
    const { handle, setFooter, requestRender, unsub } = setup({
      enabled: true,
      probeOk: true,
    });
    expect(setFooter).toHaveBeenCalledTimes(1);
    handle.requestRender();
    expect(requestRender).toHaveBeenCalled();
    handle.unmount();
    expect(setFooter).toHaveBeenLastCalledWith(undefined);
    // dispose 链:footer 卸载时取消分支订阅
    expect(unsub).not.toHaveBeenCalled(); // unmount 走 setFooter(undefined),dispose 由 pi 调
    expect(handle.requestRender).toBeTypeOf("function");
  });
});
