//src\games\warden-abyss\components\Leaderboard.tsx
"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { ICONS } from "../data/icons";
import { getLeaderboardData, type LeaderboardData } from "@/games/warden-abyss/actions/getLeaderboardData";

export function Leaderboard() {
  const { t } = useLanguage();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const result = await getLeaderboardData(100);
        if (mounted) {
          setData(result);
          setError(null);
        }
      } catch (e: any) {
        if (mounted) setError(t("leaderboard.loadError"));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 5 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [t]);

  if (loading && !data) {
    return (
      <div className="space-y-3">
        <h3 className="game-section-title">
          <img src={ICONS.leaderboard} alt="" className="w-5 h-5" />
          {t("tabs.leaderboard")}
        </h3>
        <div className="flex justify-center py-8">
          <div className="game-loader" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h3 className="game-section-title">
          <img src={ICONS.leaderboard} alt="" className="w-5 h-5" />
          {t("tabs.leaderboard")}
        </h3>
        <p className="text-center text-sm text-red-400">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="game-back-btn w-full"
        >
          {t("actions.refresh")}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { globalStats, topPlayers } = data;

  return (
    <div className="space-y-4">
      <h3 className="game-section-title">
        <img src={ICONS.leaderboard} alt="" className="w-5 h-5" />
        {t("tabs.leaderboard")}
      </h3>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="game-action-stat">
          <span className="game-action-stat-icon">🔥</span>
          <span className="game-action-stat-label">{t("stats.burned")}</span>
          <span className="game-action-stat-value burn text-sm">
            {globalStats.totalBurned.toLocaleString()}
          </span>
        </div>
        <div className="game-action-stat">
          <span className="game-action-stat-icon">💰</span>
          <span className="game-action-stat-label">{t("stats.withdrawn")}</span>
          <span className="game-action-stat-value withdraw text-sm">
            {globalStats.totalWithdrawn.toLocaleString()}
          </span>
        </div>
        <div className="game-action-stat">
          <span className="game-action-stat-icon">🔒</span>
          <span className="game-action-stat-label">{t("stats.blocked")}</span>
          <span className="game-action-stat-value block text-sm">
            {globalStats.totalBlocked.toLocaleString()}
          </span>
        </div>
      </div>

      <p className="text-center text-xs text-zinc-500">
        {t("leaderboard.players")}: {globalStats.totalPlayers.toLocaleString()} • {t("leaderboard.autoUpdate")}
      </p>

      <div className="game-leaderboard-list max-h-96 overflow-y-auto pr-1">
        {topPlayers.map((player) => (
          <div key={player.rank} className="game-leaderboard-item">
            <span className="game-leaderboard-rank">
              {player.rank === 1 ? "🥇" : 
               player.rank === 2 ? "🥈" : 
               player.rank === 3 ? "🥉" : 
               `#${player.rank}`}
            </span>
            <span className="game-leaderboard-player font-mono text-xs" title={player.wallet}>
              {player.wallet}
            </span>
            <span className="game-leaderboard-score font-bold">
              {player.totalEarned.toLocaleString()}
            </span>
          </div>
        ))}
        
        {topPlayers.length === 0 && (
          <p className="text-center text-sm text-zinc-500 py-4">
            {t("leaderboard.empty")}
          </p>
        )}
      </div>

      <div className="text-center text-xs text-zinc-600 pt-2 border-t border-zinc-700">
        {t("leaderboard.rankingBy")}: {t("stats.totalEarned")} (TNJ)
      </div>
    </div>
  );
}