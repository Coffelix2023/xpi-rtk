import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const VERSION = "0.1.0";

export default function xpiRtk(pi: ExtensionAPI): void {
  pi.registerCommand("xpi-rtk", {
    description: "Show xpi-rtk status",
    handler: async (_args, ctx) => {
      ctx.ui.notify(`xpi-rtk ${VERSION} loaded`);
    },
  });
}
