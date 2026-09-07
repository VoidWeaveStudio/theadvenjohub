CREATE TABLE IF NOT EXISTS faction_page_stats (
  faction_id uuid NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  day date NOT NULL,
  views integer NOT NULL DEFAULT 0,
  connects integer NOT NULL DEFAULT 0,
  eligible integer NOT NULL DEFAULT 0,
  PRIMARY KEY (faction_id, day)
);

CREATE INDEX IF NOT EXISTS idx_faction_page_stats_day ON faction_page_stats (faction_id, day DESC);
