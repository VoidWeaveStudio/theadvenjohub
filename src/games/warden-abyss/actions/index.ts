//src\games\warden-abyss\actions\index.ts
export { 
  loadProgress, 
  recordAction, 
  saveFullProgress, 
  syncTotalEarned, 
  getLeaderboard 
} from "./gameProgress";
export { getLeaderboardData, type LeaderboardData, type LeaderboardEntry, type GlobalStats } from "./getLeaderboardData";