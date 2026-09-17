# TANJO World trailer: story, voice-over, teaser

Written 2026-09-17. The seven showcase sets stay seven separate locations, each
with its own atmosphere — the trailer is assembled in the edit, not in one camera
move. Everything is shot inside the game with the admin cinema camera; the cast
is NPC actors. The only external elements are two titles, the logo and the voice.

---

## 1. Format

**Genre: field documentary.** The camera does not follow a hero, it observes a
population. The narrator talks about memecoin people in exactly the tone used for
antelope migration: calm, respectful, straight-faced. The comedy comes from the
gap between that tone and what is happening on screen.

The voice must stay **serious**. The satire is already built into the sets, and
narrating it with jokes on top would double up and kill both. `JUST HOLD` on a
stained-glass window is funnier than any line the narrator could add.

**Runtime:** 1:55. **Voice:** one narrator, ~160 words. **Channels:** X, YouTube,
the game page.

---

## 2. What the sets already contain

The key finding from re-reading the room code: the sets carry **built-in signage**,
and it beats anything we could invent. A third of the shots below are simply a
close-up of a sign that is already standing there.

| Set | Scripted beat (loop length) | Signage in frame |
|---|---|---|
| Bazaar | `1000x GUARANTEED` → `PRESALE ENDS TONIGHT` → `TRUST ME BRO` → `AUDITED BY MY COUSIN` (14.8 s); `FLOOR IS RISING` → the trader vanishes → `SEE YOU NEVER` (27.5 s) | `RUGS — PULLED FRESH DAILY`, `EXCHANGE — 1 $BONK = 1 $BONK`, `LOT 404 — 1 000 000 $HOPIUM`, `PRICE ORACLE — TOP IS IN. PROBABLY.` |
| Church | `BLESS MY BAGS` → `JUST HOLD` → `AMEN` (22 s) | `TITHE — SEND IT`, `IN MEMORIAM — RUGGED, NOT FORGOTTEN` |
| Casino | `JUST A DIP...` → `SOLD!` → `IT PUMPED 40x` (17.5 s) | `1000x SLOTS — NO REFUNDS`, `CASHIER — CHIPS IN · HOPE OUT`, `LIQUIDATED TODAY — $4 208 991` |
| Moon | `SEND IT` → `3 / 2 / 1` → `LIFTOFF` (30.4 s) | `$MOON MINE — PROOF OF SHOVEL`, `WE ARE EARLY — CLAIMED IN THE NAME OF THE BAGS` |
| War | `NOT MY BAGS!` (8 s); `STAY WITH ME, JOHNNY` → `HE BOUGHT THE TOP` (16 s) | banners `$DOGE`, `$PEPE`, `$WIF`, `$BONK`; plaque `$JOHNNY · 2021–2026` |
| Graveyard | `IT WAS MY RENT` → `IT'S JUST A DIP` → `WE'RE ALL GONNA MAKE IT` (21 s) | headstones `$WOJAK — HE KNEW, HE BOUGHT ANYWAY`, `$HODLR — HELD ALL THE WAY DOWN`, `$MOONZ — DEV WENT DARK`, `$GEMZ — 100x GUARANTEED`; crypt `$LUNA — 40B GONE · 2022`; fresh grave `$NEXT — SOON`; board `OBITUARIES — TODAY: 14 · ALL TIME: 1.2M`; monument `THE GREAT UNWIND — 1 204 881 TOKENS BURIED HERE` |
| Garden | `DIAMOND HANDS` → `ONE MORE, SIR?` (49 s) | no signs; a hedge trimmed into a candlestick chart instead |

**The rhyme we must use.** In the war set a wounded soldier is told
`STAY WITH ME, JOHNNY`, and the graveyard has a headstone reading
`$JOHNNY · 2021–2026`. That is a finished cut: war straight to that grave.
Nothing to write, nothing to build.

**NPC actors:** ten appearance sets (`crowd`, `flock`, `clergy`, `soldierRed`,
`soldierBlue`, `chill`, `highRoller`, `spacer`, `trader`, `mourner`). They walk
and run along routes, hold poses, carry props and speak in comic bubbles.
Crowd mode is **F7** (§8.1).

**Boss lair** — `InfluencePoint` ("The Sundered Ward"): a city of radius 250, a
44×84 cathedral, a boss arena, an influence crystal glowing in its owning
faction's colour. The siege is triggered from the admin panel with `force_siege`,
the rifts with `spawn_breach`.

**Cinema camera** — **F8**: free / orbit / rail, up to 64 keyframes, FOV 10–120,
four smoothing presets, hide-UI (**H**) and hide-self (**J**).

---

## 3. Story

There is no plot in the usual sense — there is **a day in the life of a species**:
morning migration → the ones who already made it → territorial conflict →
pack hunt → evening rite → losses → night and stars.

Three turns hold the piece together:

1. **0:00–0:35.** The viewer thinks they are watching a funny sketch about a crowd.
2. **0:35–1:20.** The crowd turns out to be organised: armies, banners, a common
   enemy, spoils. The funny thing becomes a big thing.
3. **1:20–1:55.** It becomes clear what all of it rests on: every world is held up
   by a living token. The funny thing becomes the offer.

---

## 4. Shot list (1:55)

Format: timecode · shot · camera · sound · **VO**.

### Prologue. Migration (0:00–0:16) — bazaar

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 0:00–0:06 | black → **camera lying on the bazaar floor**, only legs in frame: dozens of pairs, mismatched boots, coat hems, dust | **free**, height 0.25 m, FOV 28, smoothing `heavy`, static | footfalls, rising market noise |
| 0:06–0:11 | same low angle, camera slowly pans with the flow | **orbit** around a point on the floor | footfalls louder |
| 0:11–0:16 | rise off the floor: above the legs the bazaar opens up — stalls, bunting, braziers | **rail**, 0.25 m → 6 m, FOV 28 → 55 | market noise at full |

> **VO (0:02):** *At the same hour every day, the floor starts to shake.*
> **VO (0:09):** *They are moving again. No one has told them where.*

### The pitch (0:16–0:30) — bazaar

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 0:16–0:21 | the barker at his stall, four lines back to back | static mid shot, 4 cuts of 1.2 s | shouting |
| 0:21–0:25 | close-ups of the signs: `1 $BONK = 1 $BONK`, then `TOP IS IN. PROBABLY.` | static close-ups, FOV 35 | market noise underneath |
| 0:25–0:30 | the rug stall: the trader talks up his wares → the stall is empty | static shot, hard whip onto the empty spot | **half a second of complete silence** |

> **VO (0:18):** *The market runs on one promise, repeated.*
> **VO (0:26):** *Some of it is even honest.* — landing as `SEE YOU NEVER` appears

### The ones who made it (0:30–0:44) — garden

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 0:30–0:37 | hard cut to silence: pond, bridge, the candlestick hedge | **rail** over the water toward the lounger, FOV 45, `film` | water, birds; market noise cuts dead |
| 0:37–0:44 | lounger, cocktail, `DIAMOND HANDS`, the waiter brings a second glass | static mid shot | ice in the glass |

> **VO (0:32):** *A few have already arrived.*
> **VO (0:39):** *This one held. Through everything. He would like you to know that.*

### Territory (0:44–1:02) — war

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 0:44–0:50 | night, searchlights, burning vehicles, `$DOGE` and `$PEPE` banners framing the shot | **rail** low across the field, FOV 50, `soft` | distant blasts, crackling fire |
| 0:50–0:55 | soldiers in cover facing each other, `NOT MY BAGS!`, explosion | mid shot, 4° roll | blast on the line |
| 0:55–1:02 | two men against a wall: `STAY WITH ME, JOHNNY` → `HE BOUGHT THE TOP` | static shot, slow push in | music drops into the pause |

> **VO (0:46):** *Two tickers. One front line.*
> **VO (0:52):** *They are not fighting over land — land is free here. They are fighting over who was early.*

### Pack hunt (1:02–1:22) — Sundered Ward

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 1:02–1:08 | **camera on the ground again**, now on broken pavement: legs run past, but all one way and in step | **free**, height 0.3 m, FOV 32 | rhythmic footfalls, a tolling bell |
| 1:08–1:15 | lift above the streets: the stream pours toward the cathedral, the crystal glowing in siege phase ahead | **rail**, rise and fly along the street, FOV 40 → 60 | bell, crowd roar |
| 1:15–1:22 | cathedral gates, the crowd floods in; the boss on the arena, silhouetted against the crystal | **orbit** around the boss from below, FOV 55 | the roar takes the whole mix |

> **VO (1:04):** *But when the cathedral lights up, the war stops.*
> **VO (1:11):** *Something down there is holding a crystal.*
> **VO (1:17):** *And it belongs to whoever is still standing at dawn.*

### The rite (1:22–1:33) — church

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 1:22–1:28 | nave, light through the stained glass, candles, a pilgrim kneels | **rail** up the aisle to the pulpit, FOV 28, `heavy` | organ, echo |
| 1:28–1:33 | the preacher raises his hand, `JUST HOLD` big in frame; then the plaque `IN MEMORIAM — RUGGED, NOT FORGOTTEN` | mid shot from below, then close-up | organ hits exactly on the bubble |

> **VO (1:24):** *When nothing else works, they pray.*
> **VO (1:29):** *The sermon is two words long.* — `JUST HOLD` then appears on its own

### The bill (1:33–1:46) — casino and graveyard

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 1:33–1:36 | casino: chart spiking, `IT PUMPED 40x`, the board `LIQUIDATED TODAY — $4 208 991` beside it | fast push in, FOV 60 | music cuts out |
| 1:36–1:40 | graveyard in fog: rows of headstones, close on `$WOJAK — HE KNEW, HE BOUGHT ANYWAY` | **rail** very slowly along the row, FOV 38, `heavy` | wind |
| 1:40–1:43 | **the rhyme cut**: the grave `$JOHNNY · 2021–2026` | static close-up | silence |
| 1:43–1:46 | the board `OBITUARIES — TODAY: 14 · ALL TIME: 1.2M`, then the fresh grave `$NEXT — SOON` | two static shots | a single note |

> **VO (1:34):** *Not all of them make it.*
> **VO (1:41):** *You knew this one.*
> **VO (1:44):** *The next grave is already dug. It just needs a name.*

### Night (1:46–1:55) — galaxy

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 1:46–1:51 | the galaxy: faction spheres carrying real token logos on their orbits | **rail** through the orbits, FOV 50 | one long note |
| 1:51–1:55 | black, TANJO WORLD logo, domain | — | final hit |

> **VO (1:47):** *Every world you just saw is held up by a token.*
> **VO (1:50):** *While it lives, the gate stays open.*
> **VO (1:53):** *Bring your ticker.*

Only two on-screen titles: `WHILE THE TOKEN LIVES, THE GATE STAYS OPEN.` (1:50)
and `BRING YOUR TICKER.` with the domain (1:53). Everything else is spoken by the
narrator or already written inside the sets.

---

## 5. Full voice-over

| # | Time | Line |
|---|---|---|
| 1 | 0:02 | At the same hour every day, the floor starts to shake. |
| 2 | 0:09 | They are moving again. No one has told them where. |
| 3 | 0:18 | The market runs on one promise, repeated. |
| 4 | 0:26 | Some of it is even honest. |
| 5 | 0:32 | A few have already arrived. |
| 6 | 0:39 | This one held. Through everything. He would like you to know that. |
| 7 | 0:46 | Two tickers. One front line. |
| 8 | 0:52 | They are not fighting over land — land is free here. They are fighting over who was early. |
| 9 | 1:04 | But when the cathedral lights up, the war stops. |
| 10 | 1:11 | Something down there is holding a crystal. |
| 11 | 1:17 | And it belongs to whoever is still standing at dawn. |
| 12 | 1:24 | When nothing else works, they pray. |
| 13 | 1:29 | The sermon is two words long. |
| 14 | 1:34 | Not all of them make it. |
| 15 | 1:41 | You knew this one. |
| 16 | 1:44 | The next grave is already dug. It just needs a name. |
| 17 | 1:47 | Every world you just saw is held up by a token. |
| 18 | 1:50 | While it lives, the gate stays open. |
| 19 | 1:53 | Bring your ticker. |

**Delivery.** Level, quiet, no smile in the voice — the narrator is not joking, he
is describing. Leave 2–4 seconds between lines: the voice fills less than half the
runtime, the rest is carried by picture and sound. No line sits on top of an
on-screen bubble; the bubble has to land in silence.

**Casting:** male, low register, documentary-channel British delivery, 40+, no
theatrics.

**Three lines that must not be touched in revisions:**
- №13 only works if `JUST HOLD` appears **after** the words, not with them;
- №15 is the one moment the narrator switches from "they" to "you", and it plays
  over the `$JOHNNY` grave whose death the viewer heard a minute earlier in the
  trench;
- №16 is the closing joke of the whole piece, spoken over `$NEXT — SOON`.

A Russian voice track is a separate decision (§8.3); the script above is the
English master.

---

## 6. Teaser

Ships 3–5 days before the trailer. Its job is not to explain but to make people ask.

**Option A (recommended), 15 seconds, no voice:**

| Time | Shot | Sound |
|---|---|---|
| 0:00–0:05 | camera on the floor, only running legs | footfalls, market noise |
| 0:05–0:08 | hard cut: the empty rug stall, `SEE YOU NEVER` | total silence |
| 0:08–0:12 | graveyard, camera tracking the headstones, close on `$NEXT — SOON` | wind |
| 0:12–0:15 | black, title `EVERY TICKER GETS A WORLD.`, logo, domain | one hit |

The silence at the five-second mark is the whole trick. On X the video autoplays
muted, so the bubble shot has to read silent.

**Option B, 20 seconds:** the same cut, with line №16 spoken over the graveyard.

**Vertical (9:16):** legs (0–4 s), the empty stall in close-up (4–8 s), title
(8–10 s). FOV 60–70 and a closer camera — wide shots and small bubbles are
unreadable in vertical.

---

## 7. Sound

One track in four states: curiosity (0:00–0:30) → tension (0:44–1:22, peaking on
the boss arena) → collapse (1:33–1:46) → a starlit exhale (1:46–1:55).

Three mandatory silences: half a second after `SEE YOU NEVER`, three seconds of
near-silence after `HE BOUGHT THE TOP`, and a beat before `JUST HOLD` so the organ
lands in empty air.

Diegetic layers are recorded in a separate pass with game audio: bazaar crowd,
garden water, war blasts, city bell, boss roar, organ, graveyard wind.

---

## 8. What is missing

### 8.1. Already in place (verified in code)

- **Crowd mode** — **F7**, admin only. `G` drops a path point at the camera,
  `T` releases a stream (repeatable), `Y` clears, `N`/`M` count, `;`/`'` spread,
  `V` cycles appearance sets, `B` toggles walk/run. Put the first path point
  **off camera**: on reaching the end an actor teleports back to it.
  For the leg shot: 20–24 actors, spread 4–6 m, running, set `crowd`.
- **Cinema camera** — **F8**, `H` hides the UI, `J` hides your own avatar.
- **Sundered Ward siege** — admin commands `force_siege` and `spawn_breach`.
  The raid shot needs no new code.
- **All signage and scripted beats** — already built, nothing to author.

### 8.2. To build before the shoot (by priority)

| # | What | Why | Size |
|---|---|---|---|
| 1 | **Pause and restart a scripted beat** (`Story.reset()` plus a stop-on-step admin command) | loops run 15–49 s and are not in sync; right now the operator waits blind for the right bubble and cannot reshoot the same beat | S |
| 2 | **Hide nicknames** above players and NPCs in cinema mode | no nameplates in frame | S |
| 3 | **Save and load camera rails** | 64 keyframes by hand per take is a lost day; good moves must be reusable | M |
| 4 | **Private instance of a location** during the shoot | a stray player ruins the take | M |
| 5 | Check **bubble legibility** at camera distance (512×192 texture) | text smears on wide shots — either move closer or scale the bubble | S |

### 8.3. To decide and arrange outside the code

| # | What | Why it blocks |
|---|---|---|
| 1 | **Narrator** | the whole piece rests on delivery; synthesis kills the irony first |
| 2 | **Music** | a track that will not trip Content ID on X or YouTube |
| 3 | **Domain for the closing title** | the code currently says `theadvenjo.online`; we need the permanent one |
| 4 | **Factions for the closing shot** | the galaxy renders real gated factions; with only two or three the last shot looks empty. Either seed a dozen demo factions with logos or clear partner ones |
| 5 | **Russian voice track** | second recording, or English titles only |
| 6 | **Who edits** | 25 shots, three mandatory silences, voice synced to bubbles |

### 8.4. What is missing from the content itself

Honestly, almost nothing. The one hole: **there is no shot showing that TANJO is
played.** The trailer shows seven sets and one raid, but never PvP, the canyon or
building. Two options:

- **leave it** — the piece is about the world, not the loop, which is more honest
  for satire;
- **insert 3 seconds** after the boss arena: four shots of 0.75 s — dust2 5v5, the
  cave, building on a plot, the canyon. A rhythmic cutaway that tells the viewer
  this is a game and not a set of dioramas.

Recommended: the second. It is the one place where the trailer risks being taken
for an animated short.

---

## 9. Shooting order

Eight sessions, one per location: bazaar, garden, war, Sundered Ward, church,
casino, graveyard, galaxy. Within a session: max graphics, cinema mode, UI hidden;
run the scripted beat end to end from three positions (wide, mid, close), then 2–3
rail moves across the set, then the crowd.

Record at 60 fps, max window resolution, no overlays. Edit at 30 fps, 1920×1080
plus a separate 1080×1920 assembly. Cut a rough edit **before** the final shoot,
and record the voice **after** the rough edit, to a finished rhythm.

---

## 10. What the trailer will not do

- Promise returns or show profit figures.
- Show mechanics that do not exist in the code.
- Use composited effects that the client cannot render.
- Feature other people's real tickers in close-up without consent — the closing
  galaxy uses our own demo factions or cleared partner ones.
