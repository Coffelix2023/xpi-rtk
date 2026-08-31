// footer 模块单测:setStatus 状态芯片(mock,不依赖真实 pi)。
import { describe, expect, it, vi } from "vitest";
import { FOOTER_STATUS_KEY, mountFooter, statusIndicator } from "./footer.ts";

describe("statusIndicator", () => {
  it("四态矩阵:on+ok=● / off=○ / on+probe失败=○", () => {
    expect(statusIndicator(true, true)).toBe("● rtk:on");
    expect(statusIndicator(false, true)).toBe("○ rtk:off");
    expect(statusIndicator(true, false)).toBe("○ rtk:off");
    expect(statusIndicator(false, false)).toBe("○ rtk:off");
  });
});

describe("mountFooter(setStatus 状态芯片)", () => {
  function setup(state: { enabled: boolean; probeOk: boolean }) {
    const setStatus = vi.fn();
    const ctx = {
      mode: "tui",
      ui: {
        setStatus,
      },
    } as unknown as Parameters<typeof mountFooter>[0];
    let enabled = state.enabled;
    const handle = mountFooter(ctx, {
      enabled: () => enabled,
      probeOk: () => state.probeOk,
    });
    return {
      handle,
      setStatus,
      setEnabled: (v: boolean) => (enabled = v),
    };
  }

  it("挂载即上报 on/off 状态文本", () => {
    const on = setup({
      enabled: true,
      probeOk: true,
    });
    expect(on.setStatus).toHaveBeenCalledWith(FOOTER_STATUS_KEY, "● rtk:on");

    const off = setup({
      enabled: false,
      probeOk: true,
    });
    expect(off.setStatus).toHaveBeenCalledWith(FOOTER_STATUS_KEY, "○ rtk:off");
  });

  it("probe 未通过时即使 enabled 也显示 off", () => {
    const { setStatus } = setup({
      enabled: true,
      probeOk: false,
    });
    expect(setStatus).toHaveBeenCalledWith(FOOTER_STATUS_KEY, "○ rtk:off");
  });

  it("refresh re-reads getters after toggle", () => {
    const { handle, setStatus, setEnabled } = setup({
      enabled: true,
      probeOk: true,
    });
    setEnabled(false);
    handle.refresh();
    expect(setStatus).toHaveBeenLastCalledWith(FOOTER_STATUS_KEY, "○ rtk:off");
  });

  it("非 TUI 模式 no-op,不触碰 setStatus", () => {
    const setStatus = vi.fn();
    const ctx = {
      mode: "print",
      ui: {
        setStatus,
      },
    } as unknown as Parameters<typeof mountFooter>[0];
    const handle = mountFooter(ctx, {
      enabled: () => true,
      probeOk: () => true,
    });
    handle.refresh();
    handle.unmount();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("卸载清除状态文本;全程不调 setFooter(避免 footer 槽位冲突)", () => {
    const { handle, setStatus } = setup({
      enabled: true,
      probeOk: true,
    });
    handle.unmount();
    expect(setStatus).toHaveBeenLastCalledWith(FOOTER_STATUS_KEY, undefined);
    // mountFooter 不再触碰整栏 footer 槽位——回归测试:与 pi-open-tui 共存
    expect(setStatus.mock.calls.every((c) => c[0] === FOOTER_STATUS_KEY)).toBe(true);
  });
});
