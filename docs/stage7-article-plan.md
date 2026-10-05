# 第7段階：記事拡充・一覧刷新の承認用案

確認日：2026-10-05。実装・教材作成前の提案。承認後にA2とC1各1本を全文提示し、内容承認まで残り8本と画面実装には進まない。

## 目的・範囲

本人（B2〜C1）中心の教材を、将来の一般公開を視野にA2〜C1へ広げる。新規10本と既存3本の全段落に訳を持たせる。最近の一次資料に基づく教材品質と、目次だけを取得する一覧の軽さを両立する。
対象は教材、教材取得窓口、記事一覧、記事本文の訳表示。同期、保存・採点の規則、他ページのレイアウト、学習時間計測は対象外。IDと既存項目を保持し、追加項目と読み込み経路で対応する。

## 文書更新

- 正の文書 `../requirements-draft.md` とリポジトリ内の写し `docs/requirements.md`：対象を「本人（B2〜C1）中心、将来は一般公開を視野にA2〜C1」に更新。
- `docs/design-rules.md`：写真下部の暗い半透明幕だけを記事画面の例外として追加。幕・白い重ね文字を専用トークンで管理。レベルは小さな枠付き属性ラベルとし、レベル別の配色・状態ピルは使用しない。ログイン画面の既存例外は保持。

## 教材取得窓口とファイル

画面は `material-catalog.js` の公開APIだけから教材を取得する。内部のGit JSONアダプターを将来の取得元へ交換できるよう、取得・検証と表示を分離する。

| ファイル | 内容・取得時点 |
| --- | --- |
| materials/articles/index.json | ID、タイトル、単一レベル、分野、写真、要約、教材公開日、元記事公開日、読む時間、本文参照先。記事一覧はこれだけを取得 |
| materials/articles/<id>.json | 本文・段落訳・設問・根拠・意見の問い・出典詳細。記事を開くと取得 |
| materials/article-vocabulary/<id>.json | 記事語彙5語、該当英文、両モード4択、使い方。記事を開くとき／保存語や復習で必要なときに取得 |
| materials/vocabulary/*.json | 既存の単語ユニット。語ID・ユニットIDを維持 |
| materials/manifest.json | 参照・版・ハッシュ・語IDから語彙ファイルへの索引。本文や設問を含めない |
| config/material-validation-policy.json（新設予定） | レベル別の語数・語彙警告閾値・14日条件を一元管理 |

公開API案：`listArticles(filters)`、`getArticle(id)`、`getArticleVocabulary(id)`、`getWords(ids)`、既存ユニット・出典取得API。取得を非同期化し、同一ファイルへの同時要求はまとめ、検証済み内容をキャッシュする。本文ファイルの失敗は他の記事一覧まで停止させない。

保存語・誤答語の復元時は、端末内の語IDから必要な語彙ファイルだけを取得する。記事一覧を表示するために全記事本文を先読みしない。利用者の切替や記事の切替後に古い取得結果を表示しない。
語彙取得に失敗しても保存語や復習対象を黙って除外せず、端末内の語payload・IDを保持する。出題前に必要語彙を解決し、未取得の場合は待機・再試行へ進める。取得失敗を「復習0件」や未保存として扱わない。

段落は既存のID・英文項目を保持し、`translationJa` を追加する。設問の根拠は既存の段落ID・抜粋・強調語句を保持。語彙の選択肢IDと正解ID、使い方の未確認状態も継続する。本文選択による語の保存には、日本語訳や操作ボタンの文字を混ぜない。

取り込み前に目次・本文・語彙・参照整合性を検証する。公開日はISO日時とし、未来公開の教材は取得窓口で表示対象から除外する。

## 新規10本の候補

以下のレベルは編集目標。出典の認定レベルではない。公開日は更新日ではなく元資料の公開日を確認したもの。2026-10-05時点で全候補が14日以内だが、実際の教材作成日に再確認し、期限を超えた候補は差し替える。

| レベル | 分野 | 出典・元記事公開日 | 選んだ理由・保持する区別 |
| --- | --- | --- | --- |
| A2 | 仕事 | [ILO：エチオピアの事業計画コンテスト](https://www.ilo.org/resource/article/ilo-launches-new-phase-business-plan-competition-refugees-and-host)／2026-10-02 | 仕事を始めるための学習と支援を具体的に説明できる。3,000→1,500→450は計画上の人数で、達成済みと書かない |
| A2 | 教養 | [UNESCO：サモアの17地域の津波への備え](https://www.unesco.org/en/articles/samoa-marks-major-tsunami-preparedness-milestone-17-communities-recognized-under-unesco-ioc-tsunami)／2026-10-05 | 避難経路・訓練・警報の行動を易しい英語で扱える。認定は被害が起きない保証ではない |
| B1 | 仕事 | [ILO：ヨルダンの職場で得た技能の認定](https://www.ilo.org/resource/news/ilo-and-partners-establish-official-recognition-prior-learning-system)／2026-10-02 | 学校外で得た技能と就職を説明できる。1,000人は事業の対象であり、全員の合格数ではない |
| B1 | 教養 | [NASA：科学観測気球の5回目の打ち上げ](https://www.nasa.gov/blogs/wallops/2026/09/29/fifth-balloon-of-nasa-scientific-balloon-campaign-launches/)／2026-09-29 | 学生の実験と飛行の順序を読み取る教材に向く。9月28日の飛行、105,900フィート、10時間14分を保持。背景を補う場合もNASA一次資料を追加確認し、短い原資料を水増ししない |
| B1 | 日常・文化 | [Forward Arts Foundation：1,000校で作った詩](https://forwardartsfoundation.org/the-biggest-smile-in-the-school/)／2026-10-01 | 最近の学校イベントを題材に、参加・制作・発表を説明できる。主催者の報告として扱い、詩そのものは転載しない |
| B2 | 仕事 | [ESA：宇宙技術と港湾の新しい協力組織](https://business.esa.int/news/space-to-ports-new-working-group-turns-cooperation-action)／2026-10-01 | 異なる産業の協力、技術の活用を学べる。9月29日のナポリでの会合と、今後の活用計画・実績を区別する |
| B2 | 教養 | [NASA：小型粒子望遠鏡と将来の小惑星探査](https://hesto.smce.nasa.gov/2026/10/01/miniaturized-particle-telescope-infused-into-deep-space-asteroid-mission/)／2026-10-01 | 装置の小型化と観測を学ぶ。2028年3月の打ち上げ予定と、2023〜2024年の背景を混同しない |
| B2 | 日常・文化 | [UNESCO：メキシコの地域主体の観光](https://www.unesco.org/en/articles/mexico-promotes-community-tourism-model-strengthened-knowledge-and-science)／2026-09-25 | 文化・地域・観光を複数の観点で読む。53件の研究、30機関、会合に参加した33件の区別を保持する |
| C1 | 仕事 | [ILO：アフリカの通商政策と非公式部門の労働者](https://www.ilo.org/resource/news/informal-workers-need-stronger-voice-africa%E2%80%99s-trade-policies-ilo-research)／2026-10-02 | 代表性・調査範囲・制度を論理的に読む。11か国の結果をアフリカ全体へ一般化しない |
| C1 | 日常・文化 | [UNESCO UIS：文化・創造活動の統計への意見募集](https://www.uis.unesco.org/en/news/shape-future-cultural-and-creative-statistics-global-consultation-now-open)／2026-09-23 | 文化をどう測るか、経済以外の価値と統計の限界を扱える。枠組みは草案、2027年の手引きは予定と明記する |

計：仕事4／教養3／日常・文化3。A2 2／B1 3／B2 3／C1 2。
全文レビュー用の2本は、A2「サモアの17地域」とC1「非公式部門の労働者」を提案する。

## 写真の取得・利用条件

Unsplashの無料写真を候補にし、Unsplash+や外部の有料素材を除外する。写真は題材を補うものとし、出典中の実際の会合・参加者・機器であると誤認させない。最終的な各記事の写真は教材作成時に選び、写真URL、撮影者、サービス、ライセンスURL、確認日を保存する。

- 仕事・協力：[Annie Sprattの会議写真](https://unsplash.com/photos/sittin-people-beside-table-inside-room-hCb3lIB8L8E)
- 科学：[Le Muckyの夜空と望遠鏡](https://unsplash.com/photos/the-night-sky-with-stars-and-a-telescope-9YBDgOJGnY8)
- 港湾：[Daniel Mikshaの港のコンテナ写真](https://unsplash.com/photos/aerial-view-of-stacked-shipping-containers-at-a-port-37mW7MvAOvU)（撮影地はバンクーバー。ナポリの会合写真として使わない）
- 文化：[Adrien Olichonの博物館写真](https://unsplash.com/photos/modern-museum-interior-with-multiple-levels-and-exhibits-j14kMc3_dzE)

[Unsplash License](https://unsplash.com/license)は無料の商用・非商用利用と加工を許可し、帰属表示は必須ではない。無加工に近い写真の販売、競合画像サービスを作るための収集は禁止。APIは使用しない。アプリでは要件どおり撮影者とUnsplashを記事写真下だけに表示する。今回の段階では写真をダウンロード・組み込みしない。

## 自動検証と編集確認

### 語数・語彙の提案値

| レベル | 本文語数（範囲外はエラー） | 既知の上位レベル語の割合（超過は警告） |
| --- | --- | --- |
| A2 | 150〜200 | 5% |
| B1 | 250〜300 | 7% |
| B2 | 300〜400 | 10% |
| C1 | 400〜500 | 10% |

閾値は今回の編集用の初期案で、CEFR公式の認定基準ではない。

CEFR-J v1.5（A1〜B2）とOctanove Vocabulary Profile v1.0（C1/C2）を固定版で利用する。[公開リポジトリの条件](https://github.com/openlanguageprofiles/olp-en-cefrj)に従い、CEFR-JはTono Lab／東京外国語大学のクレジット、OctanoveはCC BY-SA 4.0のクレジットと必要な条件を保持する。語彙レベル表をアプリ本体のライセンスと混同しない。

- 本文のみの延べ語数で集計し、見出し・訳・設問は含めない。
- 活用形・不規則形と英米綴りを正規化。数字・記号と明示的に確認した固有名詞を除外する。文頭の大文字をすべて固有名詞として除外しない。
- 分母は除外後の本文語数。辞書で既知の上位レベル語の出現数を分子とする。未収録語は別集計し、割合3%超を全レベルで警告。未収録語を「易しい語」や「C2」と自動判定しない。
- 割合に加え、該当する語と回数を出力。多義語・句・文構造の難しさは内容レビューで確認する。
- 警告は担当が確認し、判断理由を教材のレビュー記録に残す。未確認の警告を公開扱いにしない。

新規10本は `createdAt` と元記事公開日との差が0〜14日であることをエラー検証する。既存3本は保持する固定IDで歴史教材として区別し、元記事の日付を書き換えない。公開後に毎日「14日超」エラーで既存教材を消す運用にはしない。

全段落の訳・参照ID、選択肢4つ／重複なし／正解ID、語彙の使い方、設問3問うち推論1問、写真と出典情報を検証する。訳の数字・固有名詞は表記正規化と対応語表で不一致を検出する。否定・推定・因果・計画と実績の一致は人が確認し、機械検証だけで意味の正確さを確定したとは扱わない。

## 表示・確認方針

絞り込みは分野とレベルのAND。表示可能な教材を元記事公開日降順（同日は教材公開日、IDで安定化）で並べる。注目は先頭最大5本、件数が少ない場合は存在する分だけ表示。分野の棚は同じ取得結果から分野ごとに作り、過去の記事は注目5本より古い記事を示す。教材公開日は利用者へ表示しない。

既存3本の混合レベル表示は、本文語数と語彙レビュー後に単一のB2またはC1属性へ整理し、ID・保存語・読了を維持する。13本全体と新規10本のレベル配分は別に検証する。

PC1080pxで注目・棚・過去の記事、スマホで注目・縦リスト・横スクロール棚・末尾の過去の記事。構成は[DMM Daily News](https://eikaiwa.dmm.com/app/daily-news/)を参考にし、配色・字体・ロゴ・文章・画像は流用しない。

記事本文は680pxを保持。訳は段落ごとの開閉と全表示を用意し、記事を開くたびに閉じた状態に戻す。受入スクリーンショットとチェックリストは実装後に提出する。
