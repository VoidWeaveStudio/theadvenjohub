//src\games\warden-abyss\index.ts
import WardenAbyssPage from "./WardenAbyssPage";
import { config } from "./config";
import { loadProgress, saveFullProgress, syncTotalEarned, getLeaderboard } from "./actions/gameProgress";
import type { GameModule } from "@/games/registry";

export const wardenAbyssModule: GameModule = {
  ...config,
  module: () => Promise.resolve({ default: WardenAbyssPage }),
  assetsManifest: () => import("./assets/manifest.json"),
};

export { loadProgress, saveFullProgress, syncTotalEarned, getLeaderboard };
export default WardenAbyssPage;