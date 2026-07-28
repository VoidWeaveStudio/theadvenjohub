INSERT INTO "users" ("id", "wallet", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001', 'SYSTEM_FACTION_KICK_BOT', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "game_nicknames" ("user_id", "game_id", "nickname", "created_at", "updated_at")
SELECT '00000000-0000-0000-0000-000000000001', "id", 'Faction Council', now(), now()
FROM "games"
ON CONFLICT (user_id, game_id) DO NOTHING;
