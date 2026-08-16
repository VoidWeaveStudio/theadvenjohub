# Прокачка персонажа Tanjo Shooter — состояние работ

Дата: 2026-08-16. Документ для продолжения работы на другой машине.

## Правила работы над этим проектом

- Комментарии в коде не пишем. Единственное исключение — строка с путём файла первой строкой (`// src/features/game/ui/HUD.tsx`).
- Общение с пользователем на русском. Код, комментарии, UI-тексты — на английском.
- Схема БД: только `npm run db:generate` + `npm run db:migrate`. Никогда `db:push` — им однажды сбросило прогресс всем игрокам.
- Сервер и браузер пользователь запускает и проверяет сам. Превью не запускать, в браузер не ходить.
- Для визуальной работы с three.js сначала смотреть примеры three.js на GitHub.

## Два репозитория

| Репо | Путь | Что там |
|---|---|---|
| Клиент | `C:\lock\advenjohub5.5` | Next.js + three.js, ветка `main` |
| Сервер | `C:\lock\game-server` | авторитетный WS-сервер `server.js` (~6900 строк), ветка `main`, remote `VoidWeaveStudio/tanjo-game-server` |

Каталоги навыков лежат в клиенте и копируются в сервер скриптом. Перед деплоем сервера обязательно `npm run sync:progression`.

## Принятые дизайн-решения

- 50 уровней, кривая `xpToNext(L) = 110 * L^1.7`, всего 1 532 599 XP. При 10k XP/час это ~153 часа = 5 часов в день за месяц («хард режим»).
- Две взаимоисключающие ветки: **Gunslinger** (винтовка) и **Arcanist** (посох). Жёсткий выбор, респек за ASH у Sola (бесплатно до 10 уровня, дальше `250 * 1.6^respecCount`).
- Ветка открывается на **2 уровне** после стартового квеста Sola «обойди всех распорядителей».
- 54 очка навыков за всю игру, ёмкость дерева ~80 → взять всё нельзя.
- **Прокачка влияет на PvP полностью** (пользователь отверг нормализацию). Урон абилок по игрокам переводится коэффициентами `pvpScaling` из каталога.
- 10 тиров игрока Shrimp → Kraken, по одному на 5 уровней, каждый автоматически открывает одну из 10 мем-способностей. Отдельной валюты нет.
- Визуальные тиры оружия каждые 10 уровней (6 тиров), делать процедурными аттачментами three.js поверх `rifle.glb` — как уже сделано в `entities/cosmeticModels.ts`, а не отдельными .glb.

## Что уже сделано (фазы 0–3)

### Фаза 0 — каталоги как данные

Новые файлы клиента:
- `src/features/game/data/progression.catalog.json` — кривая XP, тиры, мем-абилки, тиры оружия, PvP-коэффициенты, респек, источники XP
- `src/features/game/data/skills.catalog.json` — 71 узел: Core (6) + Gunslinger (3 колонки) + Arcanist (3 колонки)
- `src/features/game/data/progression.ts`, `src/features/game/data/skills.ts` — типы и расчёты
- `scripts/sync-progression-catalog.js`, `scripts/check-progression-catalog.js`, `scripts/xp-curve.js`

Новые файлы сервера: `progression.js`, `skills.js` + копии обоих JSON.

npm-скрипты: `sync:progression`, `check:progression`, `xp:curve`.

Проверка каталога ловит недостижимые узлы (порог входа выше, чем можно набрать очков в предыдущих рядах) — этот баг уже был и исправлен в 28 узлах.

### Фаза 1 — XP, уровни, тиры

- Миграция `src/core/database/drizzle/0033_mysterious_silver_samurai.sql` — таблица `game_character_progression`. **Ещё не применена к базе.**
- `app/api/internal/game/save-progress/route.ts` и `load-progress/route.ts` возят блок `progression`. Оба устойчивы к отсутствию таблицы: если миграция не применена, прогрессия просто не сохраняется, остальной прогресс работает.
- Сервер: `createProgressionState`, `grantXp`, `grantEnemyKillXp`, `contentLevelFor`, тиры, level-up с немедленным сохранением, рассылка уровня соседям.
- XP начисляется за: мобов (с антифарм-множителем по уровню контента), квесты, первую зачистку сегмента каньона, босса и сундуки пещеры, фракционные квесты.
- Клиент: `ui/XpBar.tsx`, `ui/LevelUpToast.tsx`, `ui/hooks/useProgressionState.ts`, уровень и эмодзи тира над головой других игроков (`entities/OtherPlayer.ts`).

### Фаза 1б — стартовый квест и выбор ветки

- Тип квеста `visit_npcs` и квест `sola_orientation`: Tony (`token-vendor`), Alfredo (`npc-alfredo`), Alaric (`faction-broker`) в главном зале, диспетчер каньона (`canyon-dispatcher`) на первом этаже, Keeper of Gates (`gate-steward`) в подвале.
- Сообщение `npcVisit` проверяет, что игрок на нужном этаже. Отправляется из `Game.ts` при открытии панелей NPC.
- Сдача даёт ровно 110 XP (2 уровень) + 25 Ash, после чего открывается `sola_kill_10` — квесты стали цепочкой через `requiresQuest` и `activeQuestForNpc`.
- `questInteract` теперь принимает `npc: "sola"` вместо конкретного questId.
- Клиент: `ui/SpecializationModal.tsx` (открывается автоматически на 2 уровне), вкладка респека в `ui/SolaPanel.tsx`, чеклист распорядителей там же.

### Фаза 2 — дерево навыков и пассивки

- Сервер: `computeCombatStats(player)` и `refreshCombatStats(player)` — единственное место, где билд превращается в числа. Заменены константы:
  - урон по мобам: было `PLAYER_WEAPON_DAMAGE_TO_ENEMY = 25` → база × бонусы
  - PvP-урон: было `const damage = 5` → урон атакующего × митигация цели
  - урон врагов по игроку → × митигация
  - размер магазина и время перезарядки → из билда
  - лимит скорости в античите → × бонус скорости (иначе Conditioning резался бы как чит)
  - лут в каньоне → × Scavenger
  - Adrenaline (лечение за убийство) с рассылкой `playerHealed`
- Сообщение `skillLearn` полностью валидируется на сервере.
- Клиент: `ui/SkillTreeWindow.tsx` — пять колонок (Foundation, три колонки ветки, лента Degen Track). Открывается клавишей **K** или кликом по полосе XP.
- `Player.applyCombatStats()` применяет maxHealth, множитель скорости, магазин и перезарядку.

### Фаза 3 — панель навыков и колесо

- Хотбар разгружен: остался только слот оружия, четыре пустых. Эмоции и чертёж уехали в колесо.
- `ui/RadialWheel.tsx` — колесо на **T**, две страницы: Actions (5 эмоций + чертёж + placeables) и Degen (10 мем-способностей, заблокированные серые). Переключение колесиком мыши или Tab. Старый `ui/EmoteWheel.tsx` удалён.
- `ui/AbilityBar.tsx` — пять слотов **Q F C V X** с полосой энергии, кулдаунами и обратным отсчётом. Показывается только после выбора ветки.
- Привязка навыков: в дереве у изученного активного навыка ряд кнопок Q F C V X. Сервер валидирует (`abilityBind`) и хранит раскладку.
- Клавиша `Q` освобождена от меню placeables (теперь это пункт колеса).

## Что осталось

### Немедленно, до деплоя

1. **Применить миграцию**: из `C:\lock\advenjohub5.5` выполнить `npm run db:migrate`. Перед этим сделать бэкап базы.
2. Перед деплоем сервера выполнить `npm run sync:progression`, иначе каталоги в двух репозиториях разойдутся. Сервер логирует хеши каталогов при старте.
3. Закоммитить и запушить **оба** репозитория.

### Фаза 4 — исполнение активных навыков (следующая по плану)

Сервер (новый модуль `abilities.js` рядом с `progression.js`):
- обработчик `abilityCast` — клиент уже его шлёт, обработчика ещё нет
- проверка кулдаунов, энергии, зоны (в safe zone боевые абилки запрещены), дистанции
- урон по мобам и игрокам с `progression.scalePvpDamage(damage, damageClass, targetMaxHealth)`
- щиты (Kinetic Barrier / Mana Shield), рывки (Combat Roll / Blink), масс-атаки (Frag Grenade / Chain Lightning), пробитие щитов (Armor Piercing / Shatter Ward)
- рассылка `abilityEffect` соседям по AOI для визуала, `abilityResult` кастеру с кулдауном
- триггеры Second Wind / Soul Tether: в PvP кулдаун 5 минут (`pvpCooldownMs` в каталоге)
- новый rate limit `abilityRateLimit`

Клиент:
- `systems/AbilitySystem.ts` — ввод, локальное предсказание кулдаунов, визуальные эффекты
- приём `abilityResult` / `abilityEffect`, прокидывание кулдаунов в `AbilityBar` (сейчас проп `cooldowns` не заполняется)
- энергия в `AbilityBar` сейчас всегда полная — подключить реальное значение

### Фаза 5 — посох, режимы огня, тиры оружия

- процедурный посох (`entities/Staff.ts`) со снарядами вместо хитскана, серверная обработка снарядов
- переключение режимов огня (single → burst → auto) на клавише `B` с обязательным пересчётом допустимого темпа в античите `handleShoot` — иначе легальная очередь будет отсекаться
- 6 визуальных тиров винтовки и посоха процедурными аттачментами, трансляция `weaponTier` другим игрокам (сервер уже шлёт его в `playerJoin` и `playerLevelUpdate`)

### Фаза 6 — 10 мем-способностей

Shrimp Squeak, Crab Walk, Ink Dump, Bag Holder, Pump It, Rug Pull, Copium Cloud, Whale Splash, Airdrop, Moon Launch. Параметры уже описаны в `progression.catalog.json`, визуал делать на базе `systems/EmoteSystem.ts`. Сейчас колесо на них отвечает заглушкой.

### Фаза 7 — баланс

Проверить на живых данных: PvP-разрыв между новичком и 50 уровнем, множитель антифарма (сейчас 30 уровень в main-world получает всего 15% XP — возможно, слишком жёстко), стоимость респека.

## Как проверять

Из `C:\lock\advenjohub5.5`:

```
npm run check:progression     # валидация каталогов и расхождения с сервером
npm run xp:curve 10000        # таблица уровней и часов при заданной скорости фарма
npx tsc --noEmit              # типы клиента
```

Из `C:\lock\game-server`:

```
node --check server.js
```

## Файлы, относящиеся к прокачке

Клиент — новые:
```
docs/progression-handoff.md
scripts/sync-progression-catalog.js
scripts/check-progression-catalog.js
scripts/xp-curve.js
src/core/database/drizzle/0033_mysterious_silver_samurai.sql
src/core/database/drizzle/meta/0033_snapshot.json
src/features/game/data/progression.catalog.json
src/features/game/data/progression.ts
src/features/game/data/skills.catalog.json
src/features/game/data/skills.ts
src/features/game/ui/AbilityBar.tsx
src/features/game/ui/LevelUpToast.tsx
src/features/game/ui/RadialWheel.tsx
src/features/game/ui/SkillTreeWindow.tsx
src/features/game/ui/SpecializationModal.tsx
src/features/game/ui/XpBar.tsx
src/features/game/ui/hooks/useProgressionState.ts
```

Клиент — изменённые:
```
package.json
app/api/internal/game/save-progress/route.ts
app/api/internal/game/load-progress/route.ts
src/core/database/schema.ts
src/core/database/drizzle/meta/_journal.json
src/features/game/GameClient.tsx
src/features/game/core/Game.ts
src/features/game/core/GameCallbacks.ts
src/features/game/core/GameNetworkHandlers.ts
src/features/game/entities/OtherPlayer.ts
src/features/game/entities/Player.ts
src/features/game/network/NetworkManager.ts
src/features/game/ui/HUD.tsx
src/features/game/ui/QuestTracker.tsx
src/features/game/ui/SolaPanel.tsx
src/features/game/ui/hooks/useQuestState.ts
```

Клиент — удалён: `src/features/game/ui/EmoteWheel.tsx`

Сервер — новые: `progression.js`, `skills.js`, `progression.catalog.json`, `skills.catalog.json`
Сервер — изменён: `server.js`

В обоих репозиториях есть и другие незакоммиченные изменения по open world — они к прокачке отношения не имеют.

## Протокол WebSocket, добавленный для прокачки

Клиент → сервер: `npcVisit`, `branchSelect`, `skillRespec`, `skillLearn`, `abilityBind`, `abilityCast` (обработчика ещё нет).

Сервер → клиент: `progressionState`, `xpGain`, `levelUp`, `playerLevelUpdate`, `branchSelected`, `skillsRespecced`, `skillLearned`, `skillLearnRejected`, `playerHealed`.
