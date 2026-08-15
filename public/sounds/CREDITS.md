# Звуки

Все файлы получены с OpenGameArt под лицензией CC0 (общественное достояние).
Атрибуция не требуется — раздел ведётся для прослеживаемости происхождения.

| файлы | пак | автор | источник |
|---|---|---|---|
| footstep-1..3, footstep-stone-1..2 | Different steps on wood, stone, leaves, gravel and mud | kdd | https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud |
| ambient-ocean-1..4 | Beach ocean waves | jasinski | https://opengameart.org/content/beach-ocean-waves |
| ambient-water | Water waves | transitking | https://opengameart.org/content/water-waves |

Остальные звуковые эффекты синтезируются в рантайме, см. `src/features/game/core/proceduralSfx.ts`.
Чтобы заменить любой из них файлом, положите сюда файл с тем же именем — загрузчик
перекроет процедурный звук. Поддерживаются ogg, flac, mp3 и wav.
