// 开关状态(D4:持久开关 + env 优先)。
// 优先级:RTK_DISABLED=1(官方契约,env)> 状态文件 {enabled} > 默认开。
// 状态文件损坏按默认开处理(fail-open),不写坏文件。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export function stateFilePath(): string {
  return (
    process.env.XPI_RTK_STATE_PATH ?? join(homedir(), ".pi", "agent", "xpi-rtk.json")
  );
}

/** 读取持久开关;文件缺失/损坏 → true(默认开)。 */
export function readPersistedEnabled(path: string = stateFilePath()): boolean {
  try {
    if (!existsSync(path)) return true;
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof parsed === "object" && parsed !== null && "enabled" in parsed) {
      return (
        (
          parsed as {
            enabled?: unknown;
          }
        ).enabled !== false
      );
    }
    return true;
  } catch {
    return true;
  }
}

/** 写回持久开关;失败静默(开关写入失败不应中断会话)。 */
export function writePersistedEnabled(
  enabled: boolean,
  path: string = stateFilePath(),
): boolean {
  try {
    mkdirSync(dirname(path), {
      recursive: true,
    });
    writeFileSync(
      path,
      `${JSON.stringify({
        enabled,
      })}\n`,
      "utf8",
    );
    return true;
  } catch {
    return false;
  }
}

/** 当前生效状态(env 覆盖持久开关)。 */
export function effectiveEnabled(
  env: NodeJS.ProcessEnv = process.env,
  path: string = stateFilePath(),
): boolean {
  if (env.RTK_DISABLED === "1") return false;
  return readPersistedEnabled(path);
}

export type ToggleAction = "on" | "off" | "toggle";

/** 执行 on/off/toggle,返回写回后的持久状态。 */
export function applyToggle(
  action: ToggleAction,
  path: string = stateFilePath(),
): boolean {
  const current = readPersistedEnabled(path);
  const next = action === "toggle" ? !current : action === "on";
  writePersistedEnabled(next, path);
  return next;
}
