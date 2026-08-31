// setup 模块单测:分类矩阵 + 状态持久化 + runSetupCheck 分支(mock,不依赖真实 rtk)。
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyProbe,
  RTK_INSTALL_CMD,
  runSetupCheck,
  type SetupContext,
  setupPrompt,
} from "./setup.ts";
import { stateFilePath } from "./state.ts";

const tmpDirs: string[] = [];
function tmpStatePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "xpi-rtk-test-"));
  tmpDirs.push(dir);
  return join(dir, "state.json");
}
afterEach(() => {
  for (const dir of tmpDirs.splice(0))
    rmSync(dir, {
      force: true,
      recursive: true,
    });
});

const OK: Parameters<typeof classifyProbe>[0] = {
  ok: true,
  reason: null,
  version: "0.46.0",
};
const MISSING: Parameters<typeof classifyProbe>[0] = {
  ok: false,
  reason: "rtk 二进制不在 PATH 中",
  version: null,
};
const OUTDATED: Parameters<typeof classifyProbe>[0] = {
  ok: false,
  reason: "rtk 0.1.0 过旧,需要 >= 0.23.0",
  version: "0.1.0",
};

describe("classifyProbe", () => {
  it("三态矩阵:ok / 缺失(无版本号)/ 过旧(有版本号不达标)", () => {
    expect(classifyProbe(OK)).toBe("ok");
    expect(classifyProbe(MISSING)).toBe("missing");
    expect(classifyProbe(OUTDATED)).toBe("outdated");
  });
});

describe("setupPrompt", () => {
  it("缺失文案提安装;过旧文案含本地版本与最低要求", () => {
    const missing = setupPrompt(MISSING, "missing");
    expect(missing.title).toContain("未安装");
    expect(missing.message).toContain("0.23.0");
    const outdated = setupPrompt(OUTDATED, "outdated");
    expect(outdated.title).toContain("过旧");
    expect(outdated.message).toContain("0.1.0");
    expect(outdated.message).toContain("0.23.0");
  });

  it("安装命令来自 rtk 官方仓库,不经 brew 写死", () => {
    expect(RTK_INSTALL_CMD).toContain("raw.githubusercontent.com/rtk-ai/rtk");
    expect(RTK_INSTALL_CMD).not.toContain("brew");
  });
});

describe("runSetupCheck", () => {
  function makeCtx(mode: SetupContext["mode"] = "tui"): SetupContext & {
    confirmCalls: {
      title: string;
      message: string;
    }[];
    notifyCalls: {
      message: string;
      type?: string;
    }[];
  } {
    const confirmCalls: {
      title: string;
      message: string;
    }[] = [];
    const notifyCalls: {
      message: string;
      type?: string;
    }[] = [];
    return {
      mode,
      signal: undefined,
      confirmCalls,
      notifyCalls,
      ui: {
        confirm: async (title, message) => {
          confirmCalls.push({
            title,
            message,
          });
          return true; // 默认同意,具体用例覆盖
        },
        notify: (message, type) => {
          notifyCalls.push({
            message,
            type,
          });
        },
        setWorkingMessage: () => {},
      },
    };
  }

  const pi = {
    exec: vi.fn(),
  } as unknown as import("@earendil-works/pi-coding-agent").ExtensionAPI;

  it("probe ok → no-op,不弹对话框", async () => {
    const ctx = makeCtx();
    const result = await runSetupCheck(pi, ctx, OK, tmpStatePath());
    expect(ctx.confirmCalls).toHaveLength(0);
    expect(result).toBe(OK);
  });

  it("拒绝安装 → 写 declinedSetup 标记,不执行安装命令", async () => {
    const path = tmpStatePath();
    const ctx = makeCtx();
    ctx.ui.confirm = async () => false;
    const result = await runSetupCheck(pi, ctx, MISSING, path);
    expect(result).toBe(MISSING);
    expect(readFileSync(path, "utf8")).toContain('"declinedSetup":true');
  });

  it("已拒绝过 → 不再弹对话框(静默)", async () => {
    const path = tmpStatePath();
    const ctx = makeCtx();
    ctx.ui.confirm = async () => false;
    await runSetupCheck(pi, ctx, MISSING, path); // 第一次拒绝
    const ctx2 = makeCtx();
    const result = await runSetupCheck(pi, ctx2, MISSING, path); // 第二次启动
    expect(ctx2.confirmCalls).toHaveLength(0);
    expect(result).toBe(MISSING);
  });

  it("同意安装 → 执行官方脚本,安装成功后重探并返回新 probe", async () => {
    const path = tmpStatePath();
    const ctx = makeCtx();
    const exec = vi
      .fn()
      .mockResolvedValueOnce({
        code: 0,
        killed: false,
        stderr: "",
        stdout: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        killed: false,
        stderr: "",
        stdout: "rtk 0.99.0",
      });
    const pi2 = {
      exec,
    } as unknown as typeof pi;
    const result = await runSetupCheck(pi2, ctx, MISSING, path);
    expect(exec).toHaveBeenCalledTimes(2);
    expect(exec.mock.calls[0][0]).toBe("sh");
    expect(String(exec.mock.calls[0][1]?.[1])).toContain("install.sh");
    expect(result.ok).toBe(true);
    expect(result.version).toBe("0.99.0");
  });

  it("安装脚本失败 → 保留原 probe(不假成功)", async () => {
    const ctx = makeCtx();
    const exec = vi.fn().mockResolvedValue({
      code: 1,
      killed: false,
      stderr: "",
      stdout: "",
    });
    const pi2 = {
      exec,
    } as unknown as typeof pi;
    const result = await runSetupCheck(pi2, ctx, MISSING, tmpStatePath());
    expect(exec).toHaveBeenCalledTimes(1);
    expect(result).toBe(MISSING);
    expect(ctx.notifyCalls.some((n) => n.type === "error")).toBe(true);
  });

  it("非 TUI 模式 → 不弹对话框直接放行", async () => {
    const ctx = makeCtx("print");
    const result = await runSetupCheck(pi, ctx, MISSING, tmpStatePath());
    expect(ctx.confirmCalls).toHaveLength(0);
    expect(result).toBe(MISSING);
  });
});

// stateFilePath 仍导出给 index.ts;这里引用防止被误删(运行时默认路径)。
void stateFilePath;
