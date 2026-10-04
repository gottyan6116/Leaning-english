# 第5段階：記事候補と写真の方針

確認日：2026-10-04。候補承認前。本文・設問・UIは未作成。

## 論点と範囲

- 目的：仕事・教養・日常文化で、出典の事実と不確実性を保ったB2〜C1の読解教材を3本用意する。
- 主要論点：どの一次資料を使えば、短い読解・語彙・内容理解・意見記述を一貫した教材にできるか？
- 初期仮説：実証研究、科学観測、文化継承という異なる題材を選ぶと、分野と論理の読み方をバランスよく学べる。
- 今回は共通ルールの固定、出典の確認、写真候補と利用条件の提示まで。承認後に1本目の全文を提示し、再承認後に残りとUIを作成する。
- 機能要件の正は親フォルダーのrequirements-draft.md（4章・6章）と、最新のユーザー指示。

## 1. 仕事：週4日勤務の英国試行

- 教材タイトル案：What a Four-Day Working Week Changed
- 主出典：https://www.cam.ac.uk/stories/fourdayweek
- 原題：Would you prefer a four-day working week?
- 媒体：University of Cambridge。著者：Fred Lewsey。公開日：2023-02-21。
- 確認：公式ページの本文抽出を確認。直接アクセスでは403となることがある。
- 内容：英国61組織・約2,900人、2022年6〜12月の試行。賃金を維持して労働時間を20%削減する方針で試行。71%が燃え尽きの減少を自己申告。売上の数値はデータ提供23組織の平均であり、全61組織の結果ではない。
- 理由：働き方、業務改善、実証データの範囲を読み解ける。参加組織の結果を全職場に一般化しない教材にする。
- 難度案：B2〜C1、読む目安4分。1本目の内容レビュー対象。

## 2. 教養：エウロパの炭素と海の関係

- 教材タイトル案：What Carbon on Europa Can Tell Us
- 主出典：https://science.nasa.gov/missions/webb/nasas-webb-finds-carbon-source-on-surface-of-jupiters-moon-europa/
- 原題：NASA’s Webb Finds Carbon Source on Surface of Jupiter’s Moon Europa
- 媒体：NASA Science。署名：NASA Webb Mission Team / Goddard Space Flight Center。公開日：2023-09-21。
- 内容：Webbの観測による二酸化炭素分布と地下海との関連。生命の発見とは扱わず、「海由来である可能性」と観測の限界を保つ。
- 理由：evidence、推定、不検出と不存在の違いを学べる。2023年の発表として扱い、当時の将来計画を現在の未実施計画に書き換えない。
- 難度案：C1寄り、読む目安4分。ページ更新日と元記事の公開日を分ける。

## 3. 日常・文化：麹を使う酒造りの技能継承

- 教材タイトル案：How Sake-Making Skills Are Passed On
- 主出典：https://www.gov-online.go.jp/hlj/en/march_2025/march_2025-00.html
- 原題：The Techniques and Appeal of ‘Traditional knowledge and skills of sake-making with koji mold in Japan’ Registered as an Intangible Cultural Heritage
- 媒体：政府広報オンライン / HIGHLIGHTING Japan。公開：2025年3月号（日付の日は未確認）。署名著者は未確認。取材対象は文化庁長官TOKURA Shunichiであり、著者として扱わない。
- 補助出典：https://ich.unesco.org/en/RL/traditional-knowledge-and-skills-of-sake-making-with-koji-mold-in-japan-01977
- 登録日確認：https://www.unesco.emb-japan.go.jp/itpr_ja/11_000001_00200.html （2024-12-04）
- 確認：政府広報・UNESCOの本文抽出と、日本政府代表部の登録記事。直接アクセスが制限される場合は公開抽出と公式PDFを照合する。
- 内容：麹、地域の環境、杜氏・蔵人、技能の継承と2024年の無形文化遺産登録。酒の製品ではなく知識・技能が登録対象である点を保つ。
- 理由：身近な文化を英語で説明し、職人技・地域・世代間継承の語彙を学べる。
- 難度案：B2〜C1、読む目安4分。複数出典の事実は段落ごとに対応を保持。

## 写真候補

|分野|候補URL|撮影者|被写体|
|---|---|---|---|
|仕事|https://unsplash.com/photos/sittin-people-beside-table-inside-room-hCb3lIB8L8E|Annie Spratt|テーブルを囲んで働く人々|
|教養|https://unsplash.com/photos/the-night-sky-with-stars-and-a-telescope-9YBDgOJGnY8|Le Mucky|夜空と望遠鏡|
|日常・文化|https://unsplash.com/photos/kanji-labeled-product-lot-e1AtwT_cGPU|Leio McLaren|明治神宮の酒樽|

各写真ページの「Free to use under the Unsplash License」を確認。Unsplash+素材ではない。最終採用前に実画像・トリミング・人物や商標の扱いを確認する。仕事写真を研究参加企業、天体写真をEuropaやWebb、酒樽を登録式の現場として表示しない。

利用条件：https://unsplash.com/license

- 無料の商用・非商用利用、複製・加工・配布が可能。写真そのものの無加工販売、競合写真サービスを作るための収集は不可。
- ライセンス上クレジットは必須ではないが、本アプリでは必ず撮影者名とUnsplashをリンク付きで保持する。
- 写真ID、写真ページ、撮影者、ライセンスURL、確認日、クレジットを教材メタデータに持つ。ニュースサイトの写真は使わない。
- API連携は追加しない。実装段階で個別画像の正規取得と16:9の表示を行う。

## 共通表示と次の段階

- docs/design-rules.mdは既存の状態表示ルールを含めて維持し、今回の指定も反映。全作業開始時の必読指定はAGENTS.mdにある。
- 学習用編集版・出典・写真クレジットは必要な教材情報であり、禁止されるデモ注釈とは区別する。
- 原文公開日と教材公開日は別に保存。「何日前」は教材公開日を使い、本文出典に元の日付を明示する。
- 先行作業として記事一覧の禁止3文言を削除し、ページ見出しを「記事」に変更済み。旧3本の表現解説の置き換えは、候補・全文承認後の画面実装時に行う。
- 記事ページの主要ボタンは読了のみ。語彙クイズ起動は副ボタン。
- 次は候補承認後、仕事の記事1本だけについて全文・5語の両モード4択・理解度3問と根拠・意見問いを提示して止まる。
