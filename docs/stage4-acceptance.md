# 第4段階：デザイントークン・質感

確認日：2026-10-04。ユーザーが一覧を承認後、実装。シャットダウン指示は撤回されており、電源操作は行わない。

参照スキル：avoid-ai-design、test-driven-development、verification-before-completion、browser:control-in-app-browser、QA output-review。

## 適用

- design-tokens.cssに色・文字・角丸・影・動きを集約。旧色変数は意味トークンへの参照へ変更。
- stage4.cssで表示を統一。主要ボタン18px/700、下側4px、選択肢・副ボタン2px。選択肢の回答後の厚みは意味色。
- 面の影は指定の1種類、押せない面・バッジに厚みなし。ナビ・リンク・グループ行は平面。
- 正解/誤答の文字は濃い意味色、面は淡い意味色。主役色の淡い面はクイズの選択状態に使用しない。
- 誤答の描画に一度だけqs-wrong-enterを付け、4px/200ms/ease-outの揺れを実行。保存等の再描画ではクラスを付けない。
- prefers-reduced-motion時はアニメーション・transitionを無効化、押下のtransformもnone。
- 既存のレイアウト指定（幅、高さ、余白、並び順）、文言、教材、ログ、同期、時間計測は維持。指定された文字サイズに伴う折り返しは変化する。record専用画面の構造・集計・操作は変更せず、共通トークンの色・文字だけ適用。

## 受入チェックリスト

|項目|評価|根拠|
|---|---|---|
|#FF3366は主要ボタン・進捗バー・選択中ナビ以外に使わない|○ ※|実画面の使用箇所監査。保存アイコン・リンク・選択タブには#C81E4C。誤答下側の厚みのみ承認された--color-wrong同値指定|
|誤答の×・揺れ・正解同時表示|○|誤答の×1・正解のチェック1、animation 0.2s ease-out、振幅4px。再描画で再揺れしない回帰テスト|
|主要ボタン18px以上・太字|○|ホームの計算済みスタイル18px/700。クイズ・結果・設定にも同一トークン適用|
|小さいピンク文字は#C81E4C|○|リンク・保存表示・タブ・状態・選択ナビのラベル。ナビのアイコンのみ#FF3366|
|厚みは押せる要素のみ、押下で沈む|○|4px主ボタン・2px選択肢/副ボタン。activeのtranslateYとshadow:noneをCSS監査。面/リスト行/バッジに厚みなし|
|グラデーション・ぼかし・指定外の影なし|○|検証スクリプト成功。ホームの計算済み影は指定の面影と主ボタンのみ、backgroundImage/backdropFilterなし|
|色の直書きなし|○|色の値はdesign-tokens.cssだけ。コンポーネントCSSの色値検証成功|
|第3段階のレイアウト・文言維持|○|CSS配置寸法は維持。HTMLはスタイル参照追加だけ。JSは誤答クラスの描画制御とtheme-colorのみ。教材・データ層・既存ページ本文に差分なし|

※ 前段の一覧で説明し承認された、誤答の厚みに使う意味色--color-wrong (#FF3366) は同値の例外。その他の主役色の流用はない。

## 検証

- `node --test tests/quiz-feedback.test.cjs tests/quiz-core.test.cjs tests/app-state.test.cjs`：22/22成功。
- `node scripts/validate-design-tokens.cjs`：色トークン・指定影・400/700・グラデーション/blurなし、すべてPASS。
- JS構文とgit diff --check成功。
- 実ブラウザ：390×844の出題/正解/誤答/8÷10結果/ホーム/保存語、1280×900のホーム/保存語を撮影。画像の実寸も確認。
- 誤答状態：対象語44px、クイズ幅390px、横はみ出しなし。回答ログ・結果・ホーム・状態の更新も操作で確認。
- PC：本文720px。見える要素のフォントウェイトは400/700だけ。
- 独立ソースQA：文字サイズの適用漏れを修正後、未解決P1/P2なし。
- reduced-motionの分岐はCSSとソースQAで確認。OS設定切替による実機検証は行っていない。

## スクリーンショット

|画面|390px|1280px|
|---|---|---|
|クイズ・出題中|[画像](screenshots/stage4/quiz-question-390.jpg)|—|
|クイズ・正解後|[画像](screenshots/stage4/quiz-correct-390.jpg)|—|
|クイズ・誤答後|[画像](screenshots/stage4/quiz-wrong-390.jpg)|—|
|結果|[画像](screenshots/stage4/result-390.jpg)|—|
|ホーム|[画像](screenshots/stage4/home-390.jpg)|[画像](screenshots/stage4/home-1280.jpg)|
|単語ページ|[画像](screenshots/stage4/vocabulary-390.jpg)|[画像](screenshots/stage4/vocabulary-1280.jpg)|

正解後の画像は自動送りOFFで状態を保持して撮影。ホームと保存語は実操作による8/10完了後の同じ学習データを表示する。
