INSERT INTO "game_descriptions" ("game_id", "language", "short_description", "full_description")
SELECT g."id", d."language", d."short_description", d."full_description"
FROM "games" g
JOIN (
  VALUES
    ('tanjo-shooter', 'ru', $d$Создай свою фракцию. Развивай сообщество. Правь метавселенной.$d$, $d$Социальная метавселенная, где создатели мемкоинов могут запускать собственные фракции, объединять свои сообщества и проводить события, испытания и интерактивные активности.
Поддерживай любимую фракцию, приглашай друзей, участвуй в активностях и помогай своему сообществу стать одной из самых влиятельных сил метавселенной.$d$),
    ('tanjo-shooter', 'be', $d$Стварай сваю фракцыю. Развівай супольнасць. Кіруй метасусветам.$d$, $d$Сацыяльны метасусвет, дзе стваральнікі мемкоінаў могуць запускаць уласныя фракцыі, аб'ядноўваць свае супольнасці і праводзіць падзеі, выпрабаванні і інтэрактыўныя актыўнасці.
Падтрымлівай любімую фракцыю, запрашай сяброў, удзельнічай у актыўнасцях і дапамагай сваёй супольнасці стаць адной з самых уплывовых сіл метасусвету.$d$),
    ('tanjo-shooter', 'es', $d$Construye tu facción. Haz crecer tu comunidad. Domina el metaverso.$d$, $d$Un metaverso social donde los creadores de memecoins pueden lanzar sus propias facciones, unir a sus comunidades y organizar eventos, desafíos y experiencias interactivas.
Apoya a tu facción favorita, invita a tus amigos, participa en las actividades y ayuda a tu comunidad a convertirse en una de las fuerzas más influyentes del metaverso.$d$),
    ('tanjo-shooter', 'it', $d$Costruisci la tua fazione. Fai crescere la tua community. Domina il metaverso.$d$, $d$Un metaverso sociale in cui i creatori di memecoin possono lanciare le proprie fazioni, riunire le loro community e organizzare eventi, sfide ed esperienze interattive.
Sostieni la tua fazione preferita, invita i tuoi amici, partecipa alle attività e aiuta la tua community a diventare una delle forze più influenti del metaverso.$d$),
    ('tanjo-shooter', 'zh', $d$打造你的派系，壮大你的社区，统治元宇宙。$d$, $d$一个社交元宇宙：memecoin 创作者可以创建自己的派系，凝聚自己的社区，并举办活动、挑战和互动体验。
支持你喜爱的派系，邀请好友，参与各种活动，帮助你的社区成长为元宇宙中最具影响力的力量之一。$d$),
    ('tanjo-shooter', 'ja', $d$ファクションをつくり、コミュニティを育て、メタバースを支配しよう。$d$, $d$ミームコインのクリエイターが独自のファクションを立ち上げ、コミュニティをまとめ、イベントやチャレンジ、インタラクティブな体験を開催できるソーシャルメタバース。
お気に入りのファクションを応援し、友達を招待し、アクティビティに参加して、あなたのコミュニティをメタバースで最も影響力のある存在のひとつに育てましょう。$d$),
    ('tanjo-shooter', 'ko', $d$나만의 팩션을 만들고, 커뮤니티를 키우고, 메타버스를 지배하세요.$d$, $d$밈코인 크리에이터가 자신만의 팩션을 만들고, 커뮤니티를 한데 모으며, 이벤트와 챌린지, 인터랙티브한 경험을 열 수 있는 소셜 메타버스입니다.
좋아하는 팩션을 응원하고, 친구를 초대하고, 다양한 활동에 참여하며, 내 커뮤니티가 메타버스에서 가장 영향력 있는 세력 중 하나가 되도록 도와주세요.$d$),
    ('tanjo-shooter', 'vi', $d$Xây dựng phe phái của bạn. Phát triển cộng đồng. Thống trị metaverse.$d$, $d$Một metaverse xã hội nơi những người tạo memecoin có thể lập phe phái riêng, gắn kết cộng đồng của mình và tổ chức sự kiện, thử thách cùng các trải nghiệm tương tác.
Hãy ủng hộ phe phái yêu thích, mời bạn bè, tham gia các hoạt động và giúp cộng đồng của bạn trở thành một trong những thế lực có sức ảnh hưởng nhất trong metaverse.$d$),
    ('tanjo-shooter', 'id', $d$Bangun fraksimu. Kembangkan komunitasmu. Kuasai metaverse.$d$, $d$Metaverse sosial tempat para kreator memecoin dapat meluncurkan fraksi mereka sendiri, menyatukan komunitas, serta menggelar acara, tantangan, dan pengalaman interaktif.
Dukung fraksi favoritmu, undang teman-temanmu, ikuti berbagai aktivitas, dan bantu komunitasmu menjadi salah satu kekuatan paling berpengaruh di metaverse.$d$),
    ('tanjo-shooter', 'fil', $d$Buuin ang iyong paksyon. Palaguin ang iyong komunidad. Mamuno sa metaverse.$d$, $d$Isang social metaverse kung saan puwedeng maglunsad ang mga memecoin creator ng sarili nilang paksyon, pagsama-samahin ang kanilang komunidad, at mag-host ng mga event, hamon, at interactive na karanasan.
Suportahan ang paborito mong paksyon, imbitahan ang mga kaibigan mo, sumali sa mga aktibidad, at tulungan ang komunidad mo na maging isa sa pinakamaimpluwensiyang puwersa sa metaverse.$d$),
    ('tanjo-shooter', 'zh-tw', $d$打造你的派系，壯大你的社群，統治元宇宙。$d$, $d$一個社交元宇宙：memecoin 創作者可以建立自己的派系，凝聚自己的社群，並舉辦活動、挑戰和互動體驗。
支援你喜愛的派系，邀請好友，參與各種活動，幫助你的社群成長為元宇宙中最具影響力的力量之一。$d$),
    ('into-the-void', 'be', $d$Гульня ў распрацоўцы. Падрабязней чытайце ў артыкуле ў X.$d$, $d$Гульня знаходзіцца ў распрацоўцы. Падрабязней можна прачытаць у нашым афіцыйным артыкуле ў X: https://x.com/TheAdvenJo/status/2066522608858775819$d$),
    ('into-the-void', 'es', $d$El juego está en desarrollo. Lee más en nuestro artículo en X.$d$, $d$El juego está en desarrollo. Puedes leer más detalles en nuestro artículo oficial en X: https://x.com/TheAdvenJo/status/2066522608858775819$d$),
    ('into-the-void', 'it', $d$Il gioco è in sviluppo. Scopri di più nel nostro articolo su X.$d$, $d$Il gioco è in sviluppo. Puoi leggere tutti i dettagli nel nostro articolo ufficiale su X: https://x.com/TheAdvenJo/status/2066522608858775819$d$),
    ('into-the-void', 'vi', $d$Game đang được phát triển. Đọc thêm trong bài viết của chúng tôi trên X.$d$, $d$Game đang trong quá trình phát triển. Bạn có thể đọc thêm chi tiết trong bài viết chính thức của chúng tôi trên X: https://x.com/TheAdvenJo/status/2066522608858775819$d$),
    ('into-the-void', 'id', $d$Game ini sedang dalam pengembangan. Baca selengkapnya di artikel kami di X.$d$, $d$Game ini sedang dalam pengembangan. Kamu bisa membaca detail selengkapnya di artikel resmi kami di X: https://x.com/TheAdvenJo/status/2066522608858775819$d$),
    ('into-the-void', 'fil', $d$Ginagawa pa ang laro. Basahin ang higit pa sa aming artikulo sa X.$d$, $d$Ginagawa pa ang laro. Mababasa mo ang karagdagang detalye sa aming opisyal na artikulo sa X: https://x.com/TheAdvenJo/status/2066522608858775819$d$),
    ('into-the-void', 'zh-tw', $d$遊戲正在開發中。詳情請閱讀我們的X文章。$d$, $d$遊戲正在開發中。您可以在我們的官方X文章中瞭解更多詳情：https://x.com/TheAdvenJo/status/2066522608858775819$d$),
    ('memetic', 'be', $d$Запусці мемкоін і распаўсюдзь яго сярод натоўпу — сімулятар наратыву ў Telegram.$d$, $d$MEMETIC — сімулятар распаўсюджвання, пабудаваны вакол запуску мемкоіна. Ты выпускаеш манету і вядзеш яе па графе сегментаў аўдыторыі, размяркоўваючы Увагу паміж трыма галінамі росту, пакуль Падазрэнне паўзе да 100%.

Гэта гульня для аднаго гульца з цалкам унутрыгульнёвай эканомікай: нічога не выводзіцца, рэальныя грошы не ўдзельнічаюць. Забегі праходзяць у міні-праграме Telegram, з табліцай лідараў і крамай, звязанымі з тваім акаўнтам.$d$),
    ('memetic', 'es', $d$Lanza una memecoin y propágala entre la multitud: un simulador de narrativas en Telegram.$d$, $d$MEMETIC es un simulador de propagación basado en el lanzamiento de una memecoin. Lanzas una moneda y la guías por un grafo de segmentos de audiencia, gastando Atención en tres ramas de crecimiento mientras la Sospecha avanza hacia el 100 %.

Es un juego para un solo jugador con una economía totalmente interna: no hay nada que retirar ni dinero real de por medio. Las partidas se juegan en la mini app de Telegram, con una tabla de clasificación y una tienda vinculadas a tu cuenta.$d$),
    ('memetic', 'it', $d$Lancia una memecoin e diffondila tra la folla: un simulatore di narrazioni su Telegram.$d$, $d$MEMETIC è un simulatore di diffusione costruito attorno al lancio di una memecoin. Lanci una moneta e la guidi attraverso un grafo di segmenti di pubblico, spendendo Attenzione su tre rami di crescita mentre il Sospetto sale verso il 100%.

È un gioco single player con un'economia interamente interna al gioco: nulla da prelevare e nessun denaro reale coinvolto. Le partite si giocano nella mini app di Telegram, con una classifica e un negozio collegati al tuo account.$d$),
    ('memetic', 'zh', $d$发行一枚 memecoin，让它在人群中扩散——Telegram 上的叙事模拟游戏。$d$, $d$MEMETIC 是一款围绕 memecoin 发行展开的传播模拟游戏。你发行一枚代币，在受众群体图谱中引导它扩散，把注意力分配到三条成长分支上，同时怀疑度正向 100% 逼近。

这是一款单人游戏，经济系统完全在游戏内：无法提现，也不涉及真实货币。对局在 Telegram 小程序中进行，排行榜和商店与你的账号绑定。$d$),
    ('memetic', 'ja', $d$ミームコインを発行して群衆に広めよう。Telegramで遊ぶナラティブ・シミュレーター。$d$, $d$MEMETICは、ミームコインのローンチを軸にした拡散シミュレーターです。コインを発行してオーディエンスのセグメントのグラフ上で導き、3つの成長ルートに「注目」を配分し、「疑惑」が100%に達するまでコインを広めていきます。

ゲーム内経済のみで完結する1人用ゲームで、出金はできず、実際のお金は関わりません。プレイはTelegramのミニアプリで行い、リーダーボードとショップはアカウントに紐づきます。$d$),
    ('memetic', 'ko', $d$밈코인을 출시해 대중 속으로 퍼뜨리세요. Telegram에서 즐기는 내러티브 시뮬레이터입니다.$d$, $d$MEMETIC은 밈코인 출시를 소재로 한 확산 시뮬레이터입니다. 코인을 발행해 청중 세그먼트 그래프를 따라 이끌며, 세 갈래 성장 경로에 '주목도'를 분배하세요. 그 사이 '의심도'는 100%를 향해 올라갑니다.

게임 내 경제만으로 돌아가는 싱글 플레이 게임으로, 출금은 불가능하며 실제 돈은 오가지 않습니다. 플레이는 Telegram 미니앱에서 진행되고, 리더보드와 상점은 내 계정에 연동됩니다.$d$),
    ('memetic', 'vi', $d$Tung ra một memecoin và lan truyền nó giữa đám đông — game mô phỏng lan truyền ngay trong Telegram.$d$, $d$MEMETIC là game mô phỏng sự lan truyền xoay quanh việc tung ra một memecoin. Bạn phát hành đồng coin và dẫn dắt nó qua mạng lưới các nhóm khán giả, phân bổ Sự chú ý vào ba nhánh tăng trưởng trong khi Mức nghi ngờ tiến dần tới 100%.

Đây là game chơi đơn với nền kinh tế hoàn toàn nằm trong game: không có gì để rút và không liên quan đến tiền thật. Các ván chơi diễn ra trong mini app Telegram, với bảng xếp hạng và cửa hàng gắn với tài khoản của bạn.$d$),
    ('memetic', 'id', $d$Luncurkan memecoin dan sebarkan ke tengah keramaian — simulator narasi di Telegram.$d$, $d$MEMETIC adalah simulator penyebaran yang berpusat pada peluncuran memecoin. Kamu merilis koin dan mengarahkannya melintasi graf segmen audiens, membagi Perhatian ke tiga cabang pertumbuhan sementara Kecurigaan merayap menuju 100%.

Ini adalah game single-player dengan ekonomi yang sepenuhnya ada di dalam game: tidak ada yang bisa ditarik dan tidak ada uang sungguhan yang terlibat. Permainan dimainkan di mini app Telegram, dengan papan peringkat dan toko yang terhubung ke akunmu.$d$),
    ('memetic', 'fil', $d$Maglunsad ng memecoin at ipalaganap ito sa maraming tao — isang narrative simulator sa Telegram.$d$, $d$Ang MEMETIC ay isang spread simulator na nakasentro sa paglulunsad ng memecoin. Maglalabas ka ng coin at gagabayan ito sa graph ng mga audience segment, habang inilalaan mo ang Atensyon sa tatlong sangay ng paglago at unti-unting umaakyat ang Hinala papuntang 100%.

Isa itong single-player na laro na ang ekonomiya ay buong nasa loob ng laro: walang puwedeng i-withdraw at walang totoong pera na kasangkot. Nilalaro ang mga run sa Telegram mini app, may leaderboard at shop na naka-link sa iyong account.$d$),
    ('memetic', 'zh-tw', $d$發行一枚 memecoin，讓它在人群中擴散——Telegram 上的敘事模擬遊戲。$d$, $d$MEMETIC 是一款圍繞 memecoin 發行展開的傳播模擬遊戲。你發行一枚代幣，在受眾群體圖譜中引導它擴散，把注意力分配到三條成長分支上，同時懷疑度正向 100% 逼近。

這是一款單人遊戲，經濟系統完全在遊戲內：無法提現，也不涉及真實貨幣。對局在 Telegram 小程式中進行，排行榜和商店與你的賬號繫結。$d$),
    ('bloxaro', 'be', $d$Вокселевы шутэр у Telegram: збяры атрад, зайдзі ў рэйд на станцыю і выйдзі са здабычай.$d$, $d$BLOXARO — вокселевы шутэр, які працуе як міні-праграма Telegram. Збяры атрад у лобі і адпраўляйся ў рэйд на станцыю: да дзесяці гульцоў на шардзе, гадзіна на забег, здабыча ў скрынях, PvP паміж рэйдарамі і эвакуацыя на ліфце. Загінеш або не паспееш — усё з заплечніка прападзе.

Аддаеш перавагу бою з ордай? У рэжыме выжывання цябе чакае ўсё большы рой мобаў у тых самых катакомбах.

Заходзь за штодзённай узнагародай, мяняй аблічча байца колерамі і скінамі і гуляй з сябрамі па спасылках на групу.$d$),
    ('bloxaro', 'es', $d$Un shooter voxel en Telegram: forma un escuadrón, asalta la estación y extrae con el botín.$d$, $d$BLOXARO es un shooter de vóxeles que funciona como mini app de Telegram. Reúne a un escuadrón en el lobby y lánzate a una incursión en la estación: hasta diez jugadores por shard, una hora por partida, botín en cajas, PvP entre incursores y extracción en ascensor. Si mueres o se acaba el tiempo, pierdes todo lo que llevas en la mochila.

¿Prefieres enfrentarte a la horda? El modo Supervivencia te planta cara con un enjambre de mobs cada vez mayor en las mismas catacumbas.

Consigue una recompensa diaria por conectarte, personaliza a tu luchador con colores y skins, y juega con amigos mediante enlaces de grupo.$d$),
    ('bloxaro', 'it', $d$Uno sparatutto voxel su Telegram: forma una squadra, assalta la stazione ed estrai il bottino.$d$, $d$BLOXARO è uno sparatutto voxel che gira come mini app di Telegram. Riunisci una squadra nella lobby e lanciati in un raid sulla stazione: fino a dieci giocatori per shard, un'ora a partita, bottino nelle casse, PvP tra i raider ed estrazione in ascensore. Se muori o scade il tempo, perdi tutto quello che hai nello zaino.

Preferisci affrontare l'orda? La modalità Sopravvivenza ti oppone a uno sciame di mob sempre più numeroso nelle stesse catacombe.

Riscuoti la ricompensa giornaliera per l'accesso, personalizza il tuo combattente con colori e skin e gioca con gli amici tramite i link del party.$d$),
    ('bloxaro', 'zh', $d$Telegram 里的体素射击游戏：组队突袭空间站，带着战利品撤离。$d$, $d$BLOXARO 是一款以 Telegram 小程序形式运行的体素射击游戏。在大厅组好小队，然后突袭空间站：每个分片最多十名玩家，每局一小时，战利品藏在箱子里，突袭者之间可以 PvP，并通过电梯撤离。阵亡或超时，背包里的一切都会丢失。

想对抗怪物潮？生存模式会让你在同一片地下墓穴里面对不断壮大的怪物群。

每日登录可领取奖励，用颜色和皮肤自定义你的战士，还能通过组队链接与好友一起游玩。$d$),
    ('bloxaro', 'ja', $d$Telegramで遊べるボクセルシューター。分隊を組んでステーションを襲撃し、戦利品を持って脱出しよう。$d$, $d$BLOXAROは、Telegramのミニアプリとして動作するボクセルシューターです。ロビーで分隊を組み、ステーションへのレイドに出撃しましょう。1つのシャードに最大10人、1回のプレイは1時間、戦利品はクレートの中、レイダー同士のPvPがあり、脱出はリフトで行います。倒されるか時間切れになると、バッグの中身はすべて失われます。

大群と戦いたいなら、サバイバルモードへ。同じカタコンベで、増え続けるモブの群れに立ち向かいます。

デイリーログイン報酬を受け取り、カラーやスキンでキャラクターをカスタマイズし、パーティーリンクで友達と一緒に遊べます。$d$),
    ('bloxaro', 'ko', $d$Telegram에서 즐기는 복셀 슈터. 분대를 꾸려 스테이션을 습격하고 전리품을 챙겨 탈출하세요.$d$, $d$BLOXARO는 Telegram 미니앱으로 실행되는 복셀 슈터입니다. 로비에서 분대를 모은 뒤 스테이션 레이드에 뛰어드세요. 샤드당 최대 10명, 한 판은 1시간, 전리품은 상자 속에 있고, 레이더끼리 PvP가 벌어지며, 탈출은 리프트로 합니다. 사망하거나 시간이 다 되면 가방 속 물건을 모두 잃습니다.

대군과 맞서 싸우고 싶다면? 서바이벌 모드에서는 같은 카타콤에서 점점 불어나는 몹 무리와 맞서게 됩니다.

매일 로그인 보상을 받고, 색상과 스킨으로 전사를 꾸미고, 파티 링크로 친구와 함께 플레이하세요.$d$),
    ('bloxaro', 'vi', $d$Game bắn súng voxel trên Telegram: lập đội, đột kích trạm và mang chiến lợi phẩm thoát ra.$d$, $d$BLOXARO là game bắn súng voxel chạy dưới dạng mini app Telegram. Tập hợp một đội ở sảnh chờ rồi lao vào cuộc đột kích trạm: tối đa mười người chơi mỗi shard, một giờ cho mỗi lượt, chiến lợi phẩm nằm trong các thùng, có PvP giữa những người đột kích và thoát ra bằng thang máy. Chết hoặc hết giờ là mất sạch đồ trong balo.

Muốn chiến đấu với bầy quái hơn? Chế độ Sinh tồn sẽ đưa bạn vào đối đầu với đàn quái ngày càng đông trong chính những hầm mộ đó.

Nhận thưởng đăng nhập hằng ngày, tùy chỉnh chiến binh bằng màu sắc và skin, rồi chơi cùng bạn bè qua liên kết nhóm.$d$),
    ('bloxaro', 'id', $d$Game tembak voxel di Telegram: bentuk regu, serbu stasiun, lalu kabur membawa jarahan.$d$, $d$BLOXARO adalah game tembak voxel yang berjalan sebagai mini app Telegram. Kumpulkan regu di lobi, lalu terjun ke raid di stasiun: hingga sepuluh pemain per shard, satu jam per sesi, jarahan tersimpan di peti, PvP antar-raider, dan ekstraksi lewat lift. Kalau mati atau waktu habis, semua isi tasmu hilang.

Lebih suka melawan gerombolan? Mode Survival menghadapkanmu pada kawanan mob yang terus bertambah di katakombe yang sama.

Dapatkan hadiah login harian, kustomisasi petarungmu dengan warna dan skin, dan bermain bersama teman lewat tautan party.$d$),
    ('bloxaro', 'fil', $d$Isang voxel shooter sa Telegram: bumuo ng squad, salakayin ang istasyon, at umalis dala ang loot.$d$, $d$Ang BLOXARO ay isang voxel shooter na tumatakbo bilang Telegram mini app. Magtipon ng squad sa lobby, saka sumabak sa raid sa istasyon: hanggang sampung manlalaro bawat shard, isang oras bawat run, loot sa mga crate, PvP sa pagitan ng mga raider, at pag-extract gamit ang lift. Kapag namatay ka o naubusan ng oras, mawawala ang lahat ng laman ng bag mo.

Mas gusto bang labanan ang horde? Sa Survival mode, haharapin mo ang dumaraming mob sa parehong catacomb.

Kunin ang daily login reward, i-customize ang iyong fighter gamit ang mga kulay at skin, at makipaglaro sa mga kaibigan sa pamamagitan ng party link.$d$),
    ('bloxaro', 'zh-tw', $d$Telegram 裡的體素射擊遊戲：組隊突襲空間站，帶著戰利品撤離。$d$, $d$BLOXARO 是一款以 Telegram 小程式形式執行的體素射擊遊戲。在大廳組好小隊，然後突襲空間站：每個分片最多十名玩家，每局一小時，戰利品藏在箱子裡，突襲者之間可以 PvP，並通過電梯撤離。陣亡或超時，背包裡的一切都會丟失。

想對抗怪物潮？生存模式會讓你在同一片地下墓穴裡面對不斷壯大的怪物群。

每日登入可領取獎勵，用顏色和皮膚自定義你的戰士，還能通過組隊連結與好友一起遊玩。$d$),
    ('skerra', 'be', $d$Пабудуй базу на аскепку, што дрэйфуе ў пустэчы, — стратэгія з будаўніцтвам для Telegram.$d$, $d$Skerra — стратэгія з будаўніцтвам базы для Telegram. Ты валодаеш шасцікутным аскепкам у пустэчы, крок за крокам расчышчаеш туман, будуеш і паляпшаеш базу, здабываеш жылы, якія вычэрпваюцца, і адпраўляеш атрад у рэйды на лагеры і руіны.

Зараз Skerra зачынена на абнаўленне і перапрацоўку. Востраў, атрад і прагрэс захаваны і дачакаюцца вяртання гульні.$d$),
    ('skerra', 'es', $d$Construye una base en un fragmento a la deriva en el vacío: un constructor de bases para Telegram.$d$, $d$Skerra es un juego de estrategia de construcción de bases para Telegram. Controlas un fragmento hexagonal en el vacío, despejas la niebla anillo a anillo, construyes y mejoras tu base, explotas yacimientos que se agotan y envías a tu escuadra a asaltar campamentos y ruinas.

Skerra está ahora mismo fuera de servicio por una actualización y un rediseño. Tu isla, tu escuadra y tu progreso están a salvo y te esperarán cuando el juego vuelva.$d$),
    ('skerra', 'it', $d$Costruisci una base su un frammento alla deriva nel vuoto: un base-builder per Telegram.$d$, $d$Skerra è un gioco di strategia con costruzione della base per Telegram. Possiedi un frammento esagonale nel vuoto, diradi la nebbia anello dopo anello, costruisci e potenzi la tua base, sfrutti giacimenti che si esauriscono e invii la tua squadra ad attaccare accampamenti e rovine.

Al momento Skerra è offline per un aggiornamento e una riprogettazione. La tua isola, la tua squadra e i tuoi progressi sono al sicuro e ti aspetteranno quando il gioco tornerà.$d$),
    ('skerra', 'zh', $d$在虚空中漂浮的碎片上建造基地——Telegram 上的基地建造游戏。$d$, $d$Skerra 是一款适用于 Telegram 的基地建造策略游戏。你掌控着虚空中的一块六边形碎片，一圈一圈地驱散迷雾，建造并升级基地，开采会枯竭的矿脉，并派出小队突袭营地和遗迹。

Skerra 目前正在停服进行更新和重制。你的岛屿、小队和进度都已妥善保存，等游戏回归时依然在这里等你。$d$),
    ('skerra', 'ja', $d$虚空に漂う欠片の上に拠点を築こう。Telegram向けの基地建設ゲーム。$d$, $d$SkerraはTelegramで遊べる拠点建設ストラテジーです。虚空に浮かぶ六角形の欠片を手に入れ、霧を一周ずつ晴らし、拠点を建てて強化し、枯渇していく鉱脈を掘り、分隊を送り出してキャンプや遺跡を襲撃します。

現在Skerraはアップデートとリワークのため停止中です。島も分隊も進行状況も安全に保管されており、ゲームの再開をお待ちしています。$d$),
    ('skerra', 'ko', $d$허공을 떠도는 조각 위에 기지를 세우세요. Telegram용 기지 건설 게임입니다.$d$, $d$Skerra는 Telegram용 기지 건설 전략 게임입니다. 허공에 떠 있는 육각형 조각을 차지하고, 안개를 한 겹씩 걷어내고, 기지를 짓고 강화하고, 고갈되는 광맥을 캐내고, 분대를 보내 야영지와 폐허를 습격하세요.

현재 Skerra는 업데이트와 개편을 위해 서비스를 중단한 상태입니다. 섬과 분대, 진행 상황은 안전하게 보관되어 있으며 게임이 돌아오면 그대로 기다리고 있을 것입니다.$d$),
    ('skerra', 'vi', $d$Xây căn cứ trên mảnh vỡ trôi giữa hư không — game xây dựng căn cứ cho Telegram.$d$, $d$Skerra là game chiến thuật xây dựng căn cứ dành cho Telegram. Bạn nắm giữ một mảnh vỡ lục giác trong hư không, xua tan sương mù từng vòng một, xây dựng và nâng cấp căn cứ, khai thác các mỏ cạn dần và cử đội đi đột kích các trại và tàn tích.

Hiện Skerra đang tạm ngừng để cập nhật và làm lại. Hòn đảo, đội quân và tiến trình của bạn được lưu giữ an toàn và sẽ chờ bạn khi game trở lại.$d$),
    ('skerra', 'id', $d$Bangun markas di serpihan yang melayang di kehampaan — game pembangun markas untuk Telegram.$d$, $d$Skerra adalah game strategi pembangunan markas untuk Telegram. Kamu menguasai serpihan heksagonal di kehampaan, menyingkap kabut lingkar demi lingkar, membangun dan meningkatkan markas, menambang deposit yang bisa habis, dan mengirim regu untuk menyerbu perkemahan dan reruntuhan.

Saat ini Skerra sedang offline untuk pembaruan dan perombakan. Pulau, regu, dan progresmu tersimpan aman dan akan menunggu saat game kembali.$d$),
    ('skerra', 'fil', $d$Magtayo ng base sa shard na lumulutang sa void — isang base-builder para sa Telegram.$d$, $d$Ang Skerra ay isang base-building strategy game para sa Telegram. Hawak mo ang isang hexagonal na shard sa void, unti-unti mong inaalis ang hamog nang paikot-ikot, nagtatayo at nag-a-upgrade ka ng base, nagmimina ng mga deposito na nauubos, at nagpapadala ng iyong squad para salakayin ang mga kampo at guho.

Nasa maintenance ang Skerra para sa update at rework. Ligtas ang iyong isla, squad, at progress at hihintayin ka nila sa pagbabalik ng laro.$d$),
    ('skerra', 'zh-tw', $d$在虛空中漂浮的碎片上建造基地——Telegram 上的基地建造遊戲。$d$, $d$Skerra 是一款適用於 Telegram 的基地建造策略遊戲。你掌控著虛空中的一塊六邊形碎片，一圈一圈地驅散迷霧，建造並升級基地，開採會枯竭的礦脈，並派出小隊突襲營地和遺蹟。

Skerra 目前正在停服進行更新和重製。你的島嶼、小隊和進度都已妥善儲存，等遊戲迴歸時依然在這裡等你。$d$)
) AS d("slug", "language", "short_description", "full_description")
  ON d."slug" = g."slug"
ON CONFLICT ("game_id", "language") DO UPDATE
SET
  "short_description" = EXCLUDED."short_description",
  "full_description" = EXCLUDED."full_description",
  "updated_at" = now()
WHERE "game_descriptions"."full_description" IS NOT DISTINCT FROM (
  SELECT e."full_description"
  FROM "game_descriptions" e
  WHERE e."game_id" = "game_descriptions"."game_id" AND e."language" = 'en'
);
