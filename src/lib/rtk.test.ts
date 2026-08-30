import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compareSemver, parseRtkVersion, rewriteFromResult } from "./rtk.ts";
import {
  applyToggle,
  effectiveEnabled,
  readPersistedEnabled,
  writePersistedEnabled,
} from "./state.ts";

// ---- 临时状态目录(每个测试隔离) ----
let tmpDir: string | null = null;
function makeStatePath(): string {
  tmpDir ??= mkdtempSync(join(tmpdir(), "xpi-rtk-test-"));
  return join(
    tmpDir,
    `state-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  );
}
afterEach(() => {
  if (tmpDir) {
    rmSync(tmpDir, {
      force: true,
      recursive: true,
    });
    tmpDir = null;
  }
});

describe("parseRtkVersion", () => {
  it("解析 rtk 前缀版本", () => {
    expect(parseRtkVersion("rtk 0.46.0")).toEqual([
      0,
      46,
      0,
    ]);
  });
  it("解析裸版本", () => {
    expect(parseRtkVersion("1.2.3")).toEqual([
      1,
      2,
      3,
    ]);
  });
  it("无版本号返回 null", () => {
    expect(parseRtkVersion("rtk")).toBeNull();
  });
});

describe("compareSemver", () => {
  it("相等为 0", () => {
    expect(
      compareSemver(
        [
          0,
          23,
          0,
        ],
        [
          0,
          23,
          0,
        ],
      ),
    ).toBe(0);
  });
  it("minor 更小为 -1", () => {
    expect(
      compareSemver(
        [
          0,
          22,
          9,
        ],
        [
          0,
          23,
          0,
        ],
      ),
    ).toBe(-1);
  });
  it("major 更大为 1", () => {
    expect(
      compareSemver(
        [
          1,
          0,
          0,
        ],
        [
          0,
          99,
          99,
        ],
      ),
    ).toBe(1);
  });
});

describe("rewriteFromResult(exit-code 协议)", () => {
  const base = {
    killed: false,
    stderr: "",
  };
  it("exit 0 → 改写", () => {
    expect(
      rewriteFromResult({
        ...base,
        code: 0,
        stdout: "rtk git status\n",
      }),
    ).toBe("rtk git status");
  });
  it("exit 3(advisory)→ 改写", () => {
    expect(
      rewriteFromResult({
        ...base,
        code: 3,
        stdout: "rtk err cargo test\n",
      }),
    ).toBe("rtk err cargo test");
  });
  it("exit 1(无规则)→ 放行", () => {
    expect(
      rewriteFromResult({
        ...base,
        code: 1,
        stdout: "",
      }),
    ).toBeNull();
  });
  it("exit 0 但空 stdout → 放行", () => {
    expect(
      rewriteFromResult({
        ...base,
        code: 0,
        stdout: "  \n",
      }),
    ).toBeNull();
  });
  it("killed(超时)→ 放行", () => {
    expect(
      rewriteFromResult({
        ...base,
        code: 0,
        killed: true,
        stdout: "rtk x",
      }),
    ).toBeNull();
  });
  it("其他非零退出码 → 放行", () => {
    expect(
      rewriteFromResult({
        ...base,
        code: 2,
        stdout: "anything",
      }),
    ).toBeNull();
  });
});

describe("开关状态优先级(D4)", () => {
  it("默认开:文件缺失 → true", () => {
    const p = makeStatePath();
    expect(readPersistedEnabled(p)).toBe(true);
  });

  it("文件损坏 → 默认开(fail-open)", () => {
    const p = makeStatePath();
    writeFileSync(p, "{not json", "utf8");
    expect(readPersistedEnabled(p)).toBe(true);
  });

  it("enabled:false 持久关闭", () => {
    const p = makeStatePath();
    writePersistedEnabled(false, p);
    expect(readPersistedEnabled(p)).toBe(false);
  });

  it("env RTK_DISABLED=1 优先于开关文件", () => {
    const p = makeStatePath();
    writePersistedEnabled(true, p);
    expect(
      effectiveEnabled(
        {
          RTK_DISABLED: "1",
        },
        p,
      ),
    ).toBe(false);
  });

  it("env 未设置时以开关文件为准", () => {
    const p = makeStatePath();
    writePersistedEnabled(false, p);
    expect(effectiveEnabled({}, p)).toBe(false);
    expect(
      effectiveEnabled(
        {
          RTK_DISABLED: "0",
        },
        p,
      ),
    ).toBe(false);
  });

  it("toggle 往返", () => {
    const p = makeStatePath();
    expect(applyToggle("off", p)).toBe(false);
    expect(applyToggle("toggle", p)).toBe(true);
    expect(applyToggle("on", p)).toBe(true);
  });
});
