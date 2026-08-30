// rtk 二进制探测与 rewrite 委托(D1 薄委托 / D2 零同步架构)。
// 所有过滤规则在官方 Rust 二进制内,本模块只负责协议对接:
//   exit 0 / 3 → 改写(exit 3 为 advisory 改写);exit 1 → 无规则,放行。
// 契约:rtk >= 0.23.0(`rtk rewrite` 引入版本)。

import type { ExecResult, ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const MIN_SUPPORTED_RTK = "0.23.0";
export const REWRITE_TIMEOUT_MS = 2_000;

export type Semver = [
  number,
  number,
  number,
];

const VERSION_RE = /(\d+)\.(\d+)\.(\d+)/;

/** 解析 "rtk X.Y.Z" 或 "X.Y.Z",返回 [major, minor, patch];无法解析返回 null。 */
export function parseRtkVersion(raw: string): Semver | null {
  const m = raw.trim().match(VERSION_RE);
  if (!m) return null;
  return [
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
  ];
}

/** 主版本比较:a < b 返回 -1,a > b 返回 1,相等返回 0。 */
export function compareSemver(a: Semver, b: Semver): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

export interface RtkProbe {
  /** rtk 可用(在 PATH 且版本满足下限)。 */
  ok: boolean;
  /** 不可用时的原因(面向用户的短句,不含命令内容)。 */
  reason: string | null;
  version: string | null;
}

/** 启动时探测:`rtk --version` + 版本下限检查。失败即降级 no-op,不 crash。 */
export async function probeRtk(pi: ExtensionAPI): Promise<RtkProbe> {
  let result: ExecResult;
  try {
    result = await pi.exec(
      "rtk",
      [
        "--version",
      ],
      {
        timeout: REWRITE_TIMEOUT_MS,
      },
    );
  } catch {
    return {
      ok: false,
      reason: "rtk 二进制不在 PATH 中",
      version: null,
    };
  }
  if (result.code !== 0) {
    return {
      ok: false,
      reason: `rtk --version 退出码 ${result.code}`,
      version: null,
    };
  }
  const version = result.stdout.trim();
  const parsed = parseRtkVersion(version);
  if (!parsed) {
    return {
      ok: false,
      version,
      reason: `无法解析版本号: ${version}`,
    };
  }
  const min = parseRtkVersion(MIN_SUPPORTED_RTK);
  if (min && compareSemver(parsed, min) < 0) {
    return {
      ok: false,
      version,
      reason: `rtk ${parsed.join(".")} 过旧,需要 >= ${MIN_SUPPORTED_RTK}`,
    };
  }
  return {
    ok: true,
    reason: null,
    version: parsed.join("."),
  };
}

/** `rtk rewrite` 结果的判定;返回改写后的命令,放行返回 null。 */
export function rewriteFromResult(result: ExecResult): string | null {
  if (result.killed) return null; // 超时/中止 → fail-open 放行
  if (result.code === 0 || result.code === 3) {
    const rewritten = result.stdout.trim();
    return rewritten === "" ? null : rewritten;
  }
  return null; // exit 1(无规则)或其他非零 → 放行
}

/** 调用 `rtk rewrite <cmd>`;任何异常都放行(fail-open,永不阻塞)。 */
export async function rewriteCommand(
  pi: ExtensionAPI,
  command: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const result = await pi.exec(
      "rtk",
      [
        "rewrite",
        command,
      ],
      {
        timeout: REWRITE_TIMEOUT_MS,
        signal,
      },
    );
    return rewriteFromResult(result);
  } catch {
    return null;
  }
}
