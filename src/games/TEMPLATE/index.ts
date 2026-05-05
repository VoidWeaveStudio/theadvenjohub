//src\games\TEMPLATE\index.ts
import TemplatePage from "./TemplatePage";
import { config } from "./config";
import type { GameModule } from "@/games/registry";

export const templateModule: GameModule = {
  ...config,
  module: () => Promise.resolve({ default: TemplatePage }),
  assetsManifest: () => import("./assets/manifest.json"),
};

export default TemplatePage;