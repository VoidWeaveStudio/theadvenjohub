ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "store_links" jsonb DEFAULT '{}'::jsonb NOT NULL;

UPDATE "games"
SET "platform" = 'pc', "updated_at" = now()
WHERE "slug" = 'into-the-void'
  AND ("platform" IS NULL OR lower("platform") NOT IN ('web', 'pc', 'telegram', 'google_play', 'app_store'));

UPDATE "games"
SET "platform" = lower("platform"), "updated_at" = now()
WHERE "platform" IS NOT NULL
  AND "platform" <> lower("platform")
  AND lower("platform") IN ('web', 'pc', 'telegram', 'google_play', 'app_store');

INSERT INTO "games" (
  "title", "slug", "cover_image", "background_image", "publisher", "developer",
  "price", "price_currency", "price_usd_cents", "platform", "store_links", "status", "is_active"
)
VALUES
  (
    'MEMETIC', 'memetic', '/assets/memetic/cover.webp', '/assets/memetic/hero.webp',
    'VoidWeave Studio', 'VoidWeave Studio', 0, 'tnj', 0, 'telegram',
    '{"telegram": "https://t.me/memeticplay_bot/app"}'::jsonb, 'released', true
  ),
  (
    'BLOXARO', 'bloxaro', '/assets/bloxaro/cover.webp', '/assets/bloxaro/hero.webp',
    'VoidWeave Studio', 'VoidWeave Studio', 0, 'tnj', 0, 'telegram',
    '{"telegram": "https://t.me/bloxaro_bot"}'::jsonb, 'released', true
  ),
  (
    'Skerra', 'skerra', '/assets/skerra/cover.webp', '/assets/skerra/hero.webp',
    'VoidWeave Studio', 'VoidWeave Studio', 0, 'tnj', 0, 'telegram',
    '{"telegram": "https://t.me/skerraplay_bot"}'::jsonb, 'maintenance', true
  )
ON CONFLICT DO NOTHING;

INSERT INTO "game_descriptions" ("game_id", "language", "short_description", "full_description")
SELECT g."id", d."language", d."short_description", d."full_description"
FROM "games" g
JOIN (
  VALUES
    (
      'memetic', 'en',
      'Launch a memecoin and spread it through the crowd — a narrative simulator in Telegram.',
      E'MEMETIC is a spread simulator built around a memecoin launch. You release a coin and steer it across a graph of audience segments, spending Attention on three branches of growth while Suspicion creeps toward 100%.\n\nIt is a single-player game with a fully in-game economy: nothing to withdraw and no real money involved. Runs are played in the Telegram mini app, with a leaderboard and a shop tied to your account.'
    ),
    (
      'memetic', 'ru',
      'Запусти мемкоин и распространи его по толпе — симулятор нарратива в Telegram.',
      E'MEMETIC — симулятор распространения, построенный вокруг запуска мемкоина. Ты выпускаешь монету и ведёшь её по графу сегментов аудитории, распределяя Внимание между тремя ветвями роста, пока Подозрение ползёт к 100%.\n\nЭто одиночная игра с полностью внутриигровой экономикой: ничего не выводится и реальные деньги не участвуют. Забеги проходят в мини-приложении Telegram, с таблицей лидеров и магазином, привязанными к твоему аккаунту.'
    ),
    (
      'bloxaro', 'en',
      'A voxel shooter in Telegram: squad up, raid the station and extract with the loot.',
      E'BLOXARO is a voxel shooter that runs as a Telegram mini app. Gather a squad in the lobby, then drop into a raid on the station: up to ten players per shard, one hour per run, loot in crates, PvP between raiders and extraction by lift. Die or run out of time and everything in your bag is lost.\n\nPrefer to fight the horde? Survival pits you against a rising swarm of mobs in the same catacombs.\n\nCollect a daily login reward, customise your fighter with colours and skins, and team up with friends through party links.'
    ),
    (
      'bloxaro', 'ru',
      'Воксельный шутер в Telegram: собери отряд, зайди в рейд на станцию и выйди с добычей.',
      E'BLOXARO — воксельный шутер, который работает как мини-приложение Telegram. Собери отряд в лобби и отправляйся в рейд на станцию: до десяти игроков на шарде, час на забег, добыча в ящиках, PvP между рейдерами и эвакуация на лифте. Погибнешь или не успеешь — всё из рюкзака пропадёт.\n\nПредпочитаешь бой с ордой? В режиме выживания тебя ждёт растущий рой мобов в тех же катакомбах.\n\nЗаходи за ежедневной наградой, меняй облик бойца цветами и скинами и играй с друзьями по ссылкам на пати.'
    ),
    (
      'skerra', 'en',
      'Build a base on a shard drifting in the void — a base-builder for Telegram.',
      E'Skerra is a base-building strategy game for Telegram. You hold a hex shard in the void, clear the fog ring by ring, build and upgrade your base, work deposits that run dry and send your squad to raid camps and ruins.\n\nSkerra is currently down for an update and a rework. Your island, squad and progress are kept safe and will be waiting when the game returns.'
    ),
    (
      'skerra', 'ru',
      'Построй базу на осколке, дрейфующем в пустоте, — градостроительная игра для Telegram.',
      E'Skerra — стратегия со строительством базы для Telegram. Ты владеешь шестигранным осколком в пустоте, шаг за шагом расчищаешь туман, строишь и улучшаешь базу, добываешь жилы, которые истощаются, и отправляешь отряд в рейды на лагеря и руины.\n\nСейчас Skerra закрыта на обновление и переработку. Остров, отряд и прогресс сохранены и дождутся возвращения игры.'
    )
) AS d("slug", "language", "short_description", "full_description")
  ON d."slug" = g."slug"
ON CONFLICT DO NOTHING;
