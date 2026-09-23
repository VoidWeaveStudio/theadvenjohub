# TANJO World trailer: story, voice-over, teaser

Rewritten 2026-09-19 around a new frame the client asked for: the **Basement**
is the hub. Every faction world is a bubble the camera dives into and cuts out
of, and one throughline (Johnny) carries the middle of the piece instead of a
plain location-by-location tour. Everything is still shot inside the game with
the admin cinema camera; the cast is NPC actors; the only external elements are
titles, the logo and the voice.
 
The previous cut (pure documentary, location to location, ending on the
galaxy) is superseded by this one, but its research is not wasted — the
signage inventory and most of the per-set beats below are carried over
unchanged, just re-hung on the new frame.

---

## 1. Format

**Genre: field documentary with one embedded tragedy.** The narrator's voice
carries the "nature special" register throughout — calm, respectful,
straight-faced, describing memecoin people the way you'd describe a
migrating species — except during the war beat, where the same calm voice
keeps going even as the picture turns violent. That gap (flat delivery over a
death) is the joke and the gut-punch at once; do not let the narrator get
excited when Johnny falls. He gets *quieter*.

**Narrator age and delivery:** older voice, unhurried. It swells exactly
twice — going into the war beat, and going into the moon beat — and drops to
near-whisper exactly once, over Johnny's grave. Everywhere else it stays level.

**Runtime:** ~2:00. **Voice:** one narrator, ~170 words. **Channels:** X,
YouTube, the game page.

---

## 2. The hub: what the Basement actually gives us

Re-read the Basement code before writing a single hub shot, because it already
builds almost the entire device the client described, unprompted:

- **A hole and a sink.** Coins spawn at `HOLE_Y = 37` and fall to
  `SINK_Y = -5`, where they vanish into a glowing sink (`BasementEnvironmentSystem`,
  `CoinFeedSystem`). This *is* "coins fall from a portal" — it's already
  running, driven by real token data, with no trailer-specific work needed.
- **A galaxy underneath.** `Basement.galaxyRoot` sits at `GALAXY_PLANE_Y = -640`,
  a separate plane carrying `GalaxyBackdrop`, `PlayerBubbleField` and
  `FactionBubbleSystem` — orbiting spheres, one per faction, with real gated
  factions and their token logos. This is the "bubbles" the client means.
- **Ten token columns** ring the main floor (`TokenColumnSystem`,
  `COLUMN_RING_RADIUS = 70`, `COLUMN_COUNT = 10`), each a coin on a plinth with
  a live market-cap sprite. Good texture for the hub's wide shots; not the same
  thing as the war banners (below).

**The one thing the hub cannot do: physically contain the other six sets.**
The bubbles are a rendered *representation* of a faction floating in the
Basement's galaxy — they do not lead to a real, seamless hallway into the
Bazaar or the War set the way a doorway would. Diving into a bubble is a
**match cut**, not a camera move through one continuous space. Section 8
covers exactly how to shoot that so it still *reads* as one continuous dive.

---

## 3. What each set already contains (carried over, verified in code)

| Set | Scripted beat (loop length) | Signage in frame |
|---|---|---|
| Bazaar | `1000x GUARANTEED` → `PRESALE ENDS TONIGHT` → `TRUST ME BRO` → `AUDITED BY MY COUSIN` (14.8 s); `FLOOR IS RISING` → the trader vanishes → `SEE YOU NEVER` (27.5 s) | `RUGS — PULLED FRESH DAILY`, `EXCHANGE — 1 $BONK = 1 $BONK`, `LOT 404 — 1 000 000 $HOPIUM`, `PRICE ORACLE — TOP IS IN. PROBABLY.` |
| Church | `BLESS MY BAGS` → `JUST HOLD` → `AMEN` (22 s) | `TITHE — SEND IT`, `IN MEMORIAM — RUGGED, NOT FORGOTTEN` |
| Casino | `JUST A DIP...` → `SOLD!` → `IT PUMPED 40x` (17.5 s) | `1000x SLOTS — NO REFUNDS`, `CASHIER — CHIPS IN · HOPE OUT`, `LIQUIDATED TODAY — $4 208 991` |
| Moon | `SEND IT` → `3 / 2 / 1` → `LIFTOFF` (30.4 s) | `$MOON MINE — PROOF OF SHOVEL`, `WE ARE EARLY — CLAIMED IN THE NAME OF THE BAGS` |
| War | rambo (`soldierRed`, weapon `whale-cannon`, firing continuously) shouting `NOT MY BAGS!`; medic (`pose: cradle`) over Johnny (`pose: fallen`) saying `STAY WITH ME, JOHNNY` → `HE BOUGHT THE TOP` | ten banner poles (`WarProps.buildBanners`, 5 per side) cycling `$DOGE`, `$PEPE`, `$WIF`, `$BONK`, `$MOON`, `$PUMP`, `$BULL`; plaque `$JOHNNY · 2021–2026` |
| Graveyard | `IT WAS MY RENT` → `IT'S JUST A DIP` → `WE'RE ALL GONNA MAKE IT` (21 s) | headstones `$WOJAK — HE KNEW, HE BOUGHT ANYWAY`, `$HODLR — HELD ALL THE WAY DOWN`, `$MOONZ — DEV WENT DARK`, `$GEMZ — 100x GUARANTEED`; crypt `$LUNA — 40B GONE · 2022`; fresh grave `$NEXT — SOON`; monument `THE GREAT UNWIND — 1 204 881 TOKENS BURIED HERE`; cross headstone `$JOHNNY · 2021–2026` with a wreath and its own candle |
| Garden | `DIAMOND HANDS` → `ONE MORE, SIR?` (49 s); a hedge trimmed into a candlestick chart | no signs — the "rising chart" the client wants is this hedge |

**The rhyme, confirmed in code, not invented:** the war medic already says
`STAY WITH ME, JOHNNY`; the graveyard already has a standalone cross headstone
reading `$JOHNNY · 2021–2026` with its own wreath and candle. Two different
sessions of work on this project produced a payoff that lines up on its own —
use it exactly as built.

**NPC actors:** ten appearance sets (`crowd`, `flock`, `clergy`, `soldierRed`,
`soldierBlue`, `chill`, `highRoller`, `spacer`, `trader`, `mourner`). Crowd
mode is **F7** (§8.1); cinema camera is **F8** (§8.1).

---

## 4. Story

Not seven equal stops. One long emotional beat in the middle (war → grave),
bracketed by a hub device, bracketed by five short contrast beats that prove
the world is bigger than the one story you just felt something about.

1. **0:00–0:07 — the hub, cold.** No narration yet. Just the galaxy: bubbles
   turning, a coin falling through the sink. Establishes the device before the
   voice explains anything.
2. **0:07–0:50 — the one story.** Dive into one bubble. War. A man dies over a
   ticker. His friend holds him. The flags of a dozen coins keep flying over
   both of them like nothing happened. Cut to his grave. This is the emotional
   spine of the whole trailer.
3. **0:50–1:38 — the world keeps going.** Four short dives — Garden, Church,
   Casino, Bazaar, Moon — each one a single mood, no plot, proving the world
   didn't stop for Johnny. Deliberately breezy after something heavy.
4. **1:38–2:00 — the point.** Back to the hub. The coin that falls through the
   sink and the body that fell in the war are the same shape of thing. Cut the
   falling coin straight into the graveyard. Title.

---

## 5. Shot list (~2:00)

Format: timecode · shot · camera · sound · **VO**.

### 0. Cold open — the hub (0:00–0:07)

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 0:00–0:04 | black → the galaxy plane: faction bubbles turning slowly on their orbits, real logos on their surfaces | **orbit**, wide, FOV 45, slow | low drone, distant chatter bleeding up from the bubbles |
| 0:04–0:07 | a single coin drops past camera toward the sink and disappears into it | **free**, camera holds, coin falls through frame | a soft chime as it vanishes |

No VO yet. Let the device sit there unexplained for seven seconds.

### 1. Dive into War (0:07–0:12)

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 0:07–0:10 | push toward the war faction's bubble; its surface fills the frame | **rail**, fast push, FOV 40 → 20 | drone swells, a hint of gunfire underneath |
| 0:10–0:12 | **match cut** on the solid-colour frame straight to the war set's own establishing shot (already framed the same way — see §8.2) | cut | gunfire arrives at full volume |

> **VO (0:08):** *This one calls itself a war.*

### 2. Feet in the dirt (0:12–0:18) — war, slow motion

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 0:12–0:18 | camera on the ground, boots and legs running past in both directions, slow motion | **free**, height 0.3 m, FOV 30, static | footfalls stretched low, distant blasts |

> **VO (0:13):** *No one here is fighting for land. Land is free.*

### 3. Rambo (0:18–0:24) — war, slow motion

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 0:18–0:21 | rambo behind the sandbags, `NOT MY BAGS!` mid-scream, muzzle flash, tracers | mid shot, slight low angle, FOV 35 | the scream stretched by slow motion into a roar |
| 0:21–0:24 | tracers crossing the frame toward camera-left, in slow motion | **rail**, tracking the tracer line | gunfire, stretched |

> **VO (0:20):** *They are fighting over who was early.*

### 4. Johnny (0:24–0:34) — war, slow motion

This is the one beat the current code plays as a finished tableau (medic
already cradling a Johnny who is already down) rather than a live hit
reaction. §8.2 has the exact, no-new-code way to shoot it as a fall in
progress instead of a still frame.

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 0:24–0:28 | Johnny, upright, catches the incoming fire — staggers | mid shot, slow push in, FOV 38 | gunfire drops to a dull thud per hit |
| 0:28–0:31 | Johnny goes down, the fall stretched by slow motion | same shot continues | one low note as he lands |
| 0:31–0:34 | **camera flips** — was behind Johnny looking at rambo, now behind rambo looking at the medic already dropping into the cradle pose over him | **orbit**, 180° whip around, land on the medic | gunfire cuts to near-silence |

> **VO (0:26):** *This one wasn't.*
> **VO (0:32):** *Someone always holds the bag.* — landing as the medic says `STAY WITH ME, JOHNNY`

### 5. The flags, rising (0:34–0:40) — war

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 0:34–0:40 | rise straight up off the medic and Johnny; the ten banner poles pass through frame on the way up, flying over the two of them at ground level — at least one banner visibly snaps and swaps to a different ticker mid-shot (real, ongoing behaviour — see §8.5, not staged for the take) | **rail**, vertical rise, FOV 45 → 60 | wind picks up as the gunfire fades out entirely |

> **VO (0:36):** *A dozen flags flying over one man. None of them his. By tomorrow, they won't even be the same flags.*

### 6. The grave (0:40–0:50) — graveyard

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 0:40–0:44 | **match cut** from the rising banners straight to fog, rows of headstones | cut, land on a **rail** drifting slowly along the row | wind, distant crow |
| 0:44–0:50 | the cross headstone: `$JOHNNY · 2021–2026`, wreath, single candle lit | static push-in, very slow | the candle's small crackle; VO drops to near-whisper |

> **VO (0:42):** *You knew this one.* (this is the one line spoken at a whisper — see §5b)

### 7. Garden (0:50–1:00)

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 0:50–0:53 | back to the hub for one beat: dive into the garden faction's bubble, match cut | rail push → cut | tone lightens immediately |
| 0:53–1:00 | pond, the candlestick hedge rising green in the background, loungers with cocktails, `DIAMOND HANDS`, the waiter bringing a second glass | static mid shot | water, birds, ice in a glass |

> **VO (0:55):** *Not everyone here is grieving. Some of them already won.*

### 8. Church (1:00–1:08)

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 1:00–1:02 | hub → dive → match cut into the nave | rail push → cut | organ fades in |
| 1:02–1:08 | pilgrims kneeling, stained glass, the preacher's hand raised, `JUST HOLD` filling the frame | **rail** up the aisle, FOV 30 | organ, echo |

> **VO (1:04):** *Some of them just believe.*

### 9. Casino (1:08–1:16)

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 1:08–1:10 | hub → dive → match cut onto a chart mid-spike | rail push → cut | music slams in on the cut |
| 1:10–1:16 | the floor: `IT PUMPED 40x`, a table erupting, then the board `LIQUIDATED TODAY — $4 208 991` right beside it | fast push in, FOV 55 | cheering, then one dead beat of quiet on the liquidation board |

> **VO (1:12):** *Some of them just feel it.*

### 10. Bazaar (1:16–1:26)

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 1:16–1:18 | hub → dive → match cut into the market | rail push → cut | crowd noise floods in |
| 1:18–1:22 | the barker: `1000x GUARANTEED` → `TRUST ME BRO` → `AUDITED BY MY COUSIN` | static mid shot, quick cuts | shouting |
| 1:22–1:26 | the rug stall: the trader talks up his wares, then the stall is empty, `SEE YOU NEVER` | static, hard whip to the empty spot | half a second of total silence |

> **VO (1:19):** *Some of them are doing their own research.*
> **VO (1:24):** *Some of them are the reason you need to.*

### 11. Moon (1:26–1:38)

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 1:26–1:28 | hub → dive → match cut onto the launch pad | rail push → cut | a low countdown tone starts |
| 1:28–1:34 | `SEND IT`, the countdown `3 / 2 / 1`, spacers gathered around the gantry | **rail**, rising with the rocket, FOV 40 → 60 | countdown, then a building roar — this is the voice's second swell |
| 1:34–1:38 | `LIFTOFF`, the moon banners `$MOON MINE — PROOF OF SHOVEL` | wide static | roar peaks |

> **VO (1:30):** *And some of them never planned on staying.*

### 12. The hub, closing (1:38–1:52)

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 1:38–1:41 | **match cut** from the liftoff roar straight to silence: the hub again, the galaxy turning | cut | roar cuts to the low drone from the opening |
| 1:41–1:46 | a coin drops through the hole, falls, camera follows it down the whole way | **rail**, tracking the coin, FOV 35 | the fall, wind, no music |
| 1:46–1:50 | the coin reaches the sink and goes through it; frame goes white/dark with the portal's light | continues tracking, into the flash | the chime from the cold open, but longer, lower |
| 1:50–1:52 | **match cut** out of the flash into the graveyard's fog — same framing as §6, wider | cut | wind returns |

> **VO (1:43):** *Every one of these has to land somewhere.*
> **VO (1:48):** *This is where they land.*

### 13. Out (1:52–2:00)

| Time | Shot | Camera | Sound |
|---|---|---|---|
| 1:52–1:56 | the graveyard, wide, fog, the monument candle burning in the distance | static wide | wind |
| 1:56–2:00 | black, title, logo, domain | — | final low hit |

> **VO (1:54):** *Every world here is a different way of holding on.*
> **VO (1:58):** *Find yours.*

Two on-screen titles only: `EVERY WORLD HERE IS A DIFFERENT WAY OF HOLDING ON.`
(1:56) and `FIND YOURS.` with the domain (1:58).

---

## 5b. Full voice-over

| # | Time | Line | Delivery |
|---|---|---|---|
| 1 | 0:08 | This one calls itself a war. | level |
| 2 | 0:13 | No one here is fighting for land. Land is free. | level |
| 3 | 0:20 | They are fighting over who was early. | level, slight build |
| 4 | 0:26 | This one wasn't. | quieter — first drop |
| 5 | 0:32 | Someone always holds the bag. | quiet |
| 6 | 0:36 | A dozen flags flying over one man. None of them his. By tomorrow, they won't even be the same flags. | quiet, level |
| 7 | 0:42 | You knew this one. | **whisper** — the one line in the piece spoken this low |
| 8 | 0:55 | Not everyone here is grieving. Some of them already won. | tone lifts, back to level |
| 9 | 1:04 | Some of them just believe. | level |
| 10 | 1:12 | Some of them just feel it. | level |
| 11 | 1:19 | Some of them are doing their own research. | level, dry |
| 12 | 1:24 | Some of them are the reason you need to. | dry, small smile in the voice — the only place a smile is allowed |
| 13 | 1:30 | And some of them never planned on staying. | **build** — second and largest swell, rides the launch roar |
| 14 | 1:43 | Every one of these has to land somewhere. | level, cooling down from the launch |
| 15 | 1:48 | This is where they land. | level |
| 16 | 1:54 | Every world here is a different way of holding on. | level, warm |
| 17 | 1:58 | Find yours. | level, plain — no button-line theatrics |

**Casting:** male or female, older (60+ reads as "seen it all"), low-mid
register, documentary-channel delivery, no theatrics except the two marked
swells and the one marked whisper. Everywhere else the same measured pace as
if narrating tide pools.

**Two lines that must not be touched in revisions:**
- **№4** ("This one wasn't") is the entire joke and the entire gut-punch in
  four words — it only works spoken *quieter* than the line before it, not
  louder, and only if `NOT MY BAGS!` was still ringing a half-second earlier.
- **№7** ("You knew this one") is the whisper. It plays over the lit candle on
  Johnny's grave. If only one line in the whole trailer gets a real vocal take
  instead of a read, make it this one.

A Russian voice track is a separate decision (§8.4); the script above is the
English master.

---

## 6. Teaser

Ships 3–5 days before the trailer. Job: make people ask, not explain.

**Recommended, 15 seconds, no voice:**

| Time | Shot | Sound |
|---|---|---|
| 0:00–0:04 | the hub: a coin falling through the sink | low chime |
| 0:04–0:09 | hard cut: war, slow motion, Johnny going down, cut before he lands | gunfire, stretched, cuts to silence mid-fall |
| 0:09–0:13 | his grave, candle lit, `$JOHNNY · 2021–2026` | wind |
| 0:13–0:15 | black, title `EVERY WORLD NEEDS A GRAVEYARD.`, logo, domain | one hit |

Cutting away from Johnny *before* he lands is the hook — the teaser never
resolves the fall, the trailer does.

**Vertical (9:16):** same three shots, tighter crops, FOV 60–70 — wide
establishing shots and small bubbles are unreadable in vertical.

---

## 7. Sound

One track, five states: cold hub (0:00–0:07) → war, building to a peak on
Johnny's fall then collapsing to near-silence (0:07–0:34) → mourning
(0:34–0:50) → four light, upbeat stops that don't reference the war at all
(0:50–1:38) → the closing hub, quiet, then the same low chime as the opening,
slightly changed (1:38–2:00).

Mandatory silences: total silence for half a second after `SEE YOU NEVER`;
the gunfire has to be *gone*, not faded, by the moment the medic reaches
Johnny; a beat of nothing before `JUST HOLD` so the organ lands in empty air.

Diegetic layers recorded separately with game audio: war gunfire and blasts,
garden water and birds, church organ, casino floor noise, bazaar crowd, moon
countdown and roar, graveyard wind, the hub's low drone and portal chime.

---

## 8. How to actually shoot this

This section is the answer to "how do we make it" — the things that are
genuinely new asks in this version of the script, what they cost, and what to
do about each one without waiting for new code.

### 8.1. Already in place (verified in code, no work needed)

- **Cinema camera** — **F8**: free / orbit / rail, up to 64 keyframes, FOV
  10–120, four smoothing presets, hide-UI (**H**), hide-self (**J**), hide
  captions (**C**) — the last one matters here, since real dialogue will be
  dubbed in and the on-screen speech bubbles would otherwise fight it. Works
  in every location now, not just the showcase sets — admin-only is still the
  one gate.
- **Cinema survives a location change** — walking or teleporting into a new
  location used to force an exit back to normal player control; it no longer
  does. Cinema stays on, speed/FOV/smoothing settings carry over, and the
  camera is dropped at the new location's spawn point (its own rail keyframes
  reset, since a path recorded in one location's space means nothing in
  another's — see §8.3). This does not turn the six hub dives into single
  continuous takes; it just means the operator doesn't have to re-press F8 and
  re-set the camera after every location, which is the workflow this trailer
  actually needs across seven sets plus the hub.
- **Crowd mode** — **F7**, admin only, for the running-legs shot: 20–24
  actors, spread 4–6 m, running, `crowd` set.
- **Pose transitions** — `ShowcaseActor.setPose()` blends smoothly between
  poses over ~0.17 s (`POSE_BLEND_RATE`). This is the key tool for §8.2 below.
- **Story steps** (`addStory`) already time the medic's two lines and can time
  a pose swap the same way — no new system needed to make Johnny move on cue.
- **Rain toggle** — **V**, cinema mode, for any set that wants weather.
- **The coin portal and the galaxy bubbles** — both fully live, driven by
  real data, nothing to build.

### 8.2. The Johnny beat: how to get a fall out of a tableau

The war set currently spawns Johnny **already down** (`pose: "fallen"`) next
to a medic already in the `cradle` pose — a finished aftermath, not a death in
progress. Two ways to get the beat the script wants, cheapest first:

1. **Recommended — restage with `setPose`, shoot the blend, cut the rest.**
   Before recording, patch the take (not the shipped scene) so Johnny spawns
   in an upright pose (`shout` reads well — arms already reacting) and a
   `Story` step calls `setPose("fallen")` a couple of seconds in. Record at
   normal speed through that ~0.17 s blend at 60 fps, then slow the clip 6–8×
   in the edit. A fast blend stretched that far reads as a believable stagger
   and drop, because slerped rotation has no snap or foot-sliding to give it
   away at low speed. Zero new engine code — this is a recording-session
   change plus a post-production step.
2. **If that reads too smooth once slowed down — build a real hit-reaction.**
   A short new pose (`hit`: shoulders back, head snapped, arms out a few
   degrees — same "decided bone angle" discipline as every other pose) that
   `Story` plays for 2–3 short pulses before the `fallen` swap. More faithful
   to "sways from the bullets," but it is new authored content, not a system
   change, so it needs the same sign-off any other pose edit does.

Either way, **the camera flip in shot §4 is a hard cut, not a spin**: rambo
and Johnny/medic are built as separate set pieces in the same room, not
mid-shot on a turntable, so "the camera flips" should be shot as two separate
takes (one facing each way) and joined in the edit, timed to the beat of the
gunfire dropping out.

### 8.3. The Basement dive: shoot it as a match cut, not a flythrough

Six times in this script the camera "flies into a bubble." The engine cannot
carry a single continuous shot from the Basement into another location — each
set is its own loaded scene. Shoot each dive as two takes and join them on the
frame where the bubble's surface (or the destination's establishing colour)
fills the whole screen:

- **Take A**, in the Basement: rail push toward the target bubble until it
  fills the frame edge-to-edge.
- **Take B**, in the destination set: the location's own establishing shot,
  framed so its dominant colour and framing roughly match the last frame of
  Take A.
- Cut on the full-frame colour match. At 24–30 fps this reads as one move if
  the colours are close and the cut lands within a frame or two of the push
  finishing — the same technique the previous cut of this script already used
  for the war-to-grave "rhyme," just applied six more times.

This needs no new code, only that whoever shoots Take A and Take B plans the
colour/frame match before recording either one.

### 8.4. Slow motion: start with editing, only build a time-scale if it's not enough

Three beats (legs, rambo, Johnny) are scripted in slow motion. There is no
in-engine time-scale hook today. Two paths:

- **Start here:** record normally at 60 fps and slow the clips 4–8× in the
  edit. Zero engineering cost, works today, standard trailer practice. Test
  this first — muzzle flashes and tracers are short enough events that they
  may look fine even without extra source frames.
- **If gunfire/tracers look choppy slowed down:** add a small admin-only
  capture mode that multiplies `delta` by a fixed factor (e.g. 0.25) before
  it reaches `update()`, so four times as many real frames exist inside the
  same slice of action. Small, contained, and only touches the update loop
  while that mode is on — worth doing only if the first pass proves it's
  needed.

### 8.5. The flags: now genuinely eternal — built, not staged

Clarified brief: not "make the rising shot read as many tokens" but **the war
itself never resolves** — the two sides keep fighting no matter which tickers
are on their banners, so the banners themselves should never stop changing.
This is now a real, permanent feature of the War set, not a camera trick for
the shoot:

- Each of the ten banner poles (`WarProps`, `$DOGE`/`$PEPE`/`$WIF`/`$BONK`/
  `$MOON`/`$PUMP`/`$BULL`) carries its own independent random timer
  (4–9 s) and swaps to a different ticker from the same list on every tick,
  forever, for as long as the room is loaded — not only during the shoot.
- Each swap is masked by a quick "snap in the wind" — the cloth briefly
  folds to a sliver on its own timer and unfurls with the new ticker already
  on it, so the texture change never reads as a hard pop.
- Timers are staggered per-flag on purpose: at any moment roughly one or two
  of the ten are mid-change, never all of them at once, so it reads as
  continuous unrest rather than a synchronized slideshow.
- Ticker textures are cached per session (by ticker, inside `WarProps`), so
  cycling through the same seven designs over and over costs nothing extra
  after the first time each one is drawn.

For the shoot, this means shot §5 (the rising pass over the flags) will show
real changes happening live, not a fixed arrangement — no special timing
needed from the camera operator, just let the rise run a few seconds longer
than the minimum if the take needs a guaranteed swap in frame.

### 8.6. Remaining production tooling (carried over, still true)

| # | What | Why | Size |
|---|---|---|---|
| 1 | **Pause and restart a scripted beat** (`Story.reset()` + a stop-on-step admin command) | loops run 15–49 s out of sync with the operator's takes | S |
| 2 | **Hide nicknames** above players/NPCs in cinema mode | no nameplates in frame | S |
| 3 | **Save/load camera rails** | 64 keyframes by hand per take is a lost day | M |
| 4 | **Private instance of a location** during the shoot | a stray player ruins the take | M |
| 5 | Check **bubble legibility** at camera distance (512×192 texture) | text can smear on wide shots | S |

### 8.7. To decide outside the code

| # | What | Why it blocks |
|---|---|---|
| 1 | **Narrator casting** | the whole piece rides on the two swells and the one whisper landing correctly |
| 2 | **Music** | needs to survive Content ID on X and YouTube |
| 3 | **Domain for the closing title** | placeholder only so far |
| 4 | **How many real factions exist at shoot time** | the hub's bubbles are real data — a handful of demo factions may be needed for the wide hub shots to not look empty |
| 5 | **Russian voice track** | second recording, or English titles only |
| 6 | **Who edits** | six match cuts, three slow-motion passes, a whisper line that has to land exactly on the candle |

---

## 9. Shooting order

Nine sessions: hub (galaxy + coin portal), war, graveyard, garden, church,
casino, bazaar, moon, plus a pickup session once the edit reveals which match
cuts need a reshoot for a closer colour/frame match. Within each set session:
max graphics, cinema mode, UI hidden; record the scripted beat end to end from
three positions (wide, mid, close), then the specific shots this script calls
for, then 2–3 spare rail moves as safety coverage.

Record at 60 fps, max window resolution, no overlays. Edit at 30 fps,
1920×1080 plus a separate 1080×1920 vertical assembly. Cut a rough edit with
placeholder timing **before** the war/hub match-cut shoot, since those six
cuts are the ones most likely to need a reshoot once the colours are checked
side by side. Record the final voice **after** the rough edit, to a finished
rhythm — the whisper line especially needs the picture locked first.

---

## 10. What the trailer will not do

- Promise returns or show profit figures.
- Show mechanics that do not exist in the code.
- Use composited effects the client cannot render.
- Feature other people's real tickers in close-up without consent — the hub's
  bubbles use our own demo factions or cleared partner ones.
- Resolve Johnny's fall in the teaser — only the trailer gets the landing.
