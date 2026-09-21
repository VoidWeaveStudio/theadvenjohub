# Сторонние 3D-модели

Все файлы в этой папке переупакованы из оригиналов: геометрия упрощена, текстуры пережаты в webp.
Исходники и отчёты проверки — вне репозитория.

## CC BY 4.0 — атрибуция обязательна

Эти две модели требуют указания автора в игре или на сайте. Убрать упоминание нельзя.

| файл | модель | автор | источник |
|---|---|---|---|
| tree_pack_01.glb | Low Poly Trees Free | Nicholas-3D | https://sketchfab.com/models/6a2952e0ebdd41fa93cefda6ae0a4102 |
| tree_02.glb | Tree | DJMaesen | https://sketchfab.com/models/a2a6237a270840e198cc7db1c47f1ef7 |

Текст для экрана credits:

> "Low Poly Trees Free" by Nicholas-3D and "Tree" by DJMaesen, licensed under CC BY 4.0.

## CC0 — атрибуция не требуется

Poly Haven (https://polyhaven.com), общественное достояние.

fir_sapling, rock_07, rock_09, stone_01, rock_moss_set_01, tree_stump_01,
grass_bermuda_01, grass_medium_01, grass_medium_02,
shrub_02, shrub_03, shrub_04, fern_02, celandine_01, dandelion_01

## Текстуры башни — CC0

Poly Haven (https://polyhaven.com), общественное достояние. Лежат в `public/models/textures/tower`.

| текстура | где используется |
|---|---|
| castle_wall_slates | стены и ярусы башни |
| castle_brick_02_white | карнизы, арка ворот, отделка |
| cobblestone_02 | мощение площади |

Каждая идёт тремя картами: Diffuse, nor_gl (нормали) и arm (AO + шероховатость + металличность).

## Текстуры сада — CC0

Poly Haven (https://polyhaven.com), общественное достояние. Лежат в `public/models/textures/garden`,
пережаты в 1k webp. Каждая идёт двумя картами: diff (цвет) и nor (нормали).

| текстура | где используется |
|---|---|
| leafy_grass | газон сада, дальние холмы |
| grass_path_3 | вытоптанные дорожки |
| flower_scattered_dirt | клумбы, дно пруда |
| mossy_cobblestone | центральная площадь и главная аллея |

## Текстуры церкви — CC0

Poly Haven (https://polyhaven.com), общественное достояние. Лежат в `public/models/textures/church`,
пережаты в 1k webp, по две карты: diff (цвет) и nor (нормали).

| текстура | где используется |
|---|---|
| church_bricks_03 | стены, торцы, контрфорсы, обрамление окон |
| marble_tiles | пол нефа |
| marble_01 | колонны, ступени апсиды, алтарь, нервюры |
| dark_wooden_planks | скамьи, кафедра, хоры, исповедальня |
| grey_plaster | свод |

## Текстуры Луны — CC0

Poly Haven (https://polyhaven.com), общественное достояние. Лежат в `public/models/textures/moon`,
пережаты в 1k webp и обесцвечены (saturation 0.18) под реголит. По две карты: diff и nor.

| текстура | где используется |
|---|---|
| dense_sand | реголит, ровные участки |
| dry_ground_rocks | склоны кратеров и гребни |
| dark_rock | дно кратеров, валуны |

## Карта нормалей воды — MIT

`water_nor.webp` — это `examples/textures/waternormals.jpg` из three.js
(https://github.com/mrdoob/three.js), лицензия MIT. Используется прудом в саду.
