# 第6段階：同期設計・簡略版

2026-10-05。承認済みの方式をメール＋パスワード認証に更新。ユーザーが適用した3本のマイグレーションを実Supabaseの履歴と照合済み。接続設定の実値はユーザーが入力する。同期の検証結果はstage6-sync-report.mdに分けて記録する。

## 前提

守る対象は他人からの学習データの読み書き。自分の成績を自分で変更することは脅威としない。user_id・RLS・ID・マイグレーション・利用者別ローカル保存は将来の多人数利用に対応させる。教材はGitのJSONのまま。

## テーブル（全学習テーブルの共通列）

user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE。
server_updated_at timestamptz NOT NULL DEFAULT now()。クライアント値を採用せずINSERT/UPDATEの共通トリガーでDB側時刻を設定。
modeはtext、ja/enのCHECK制約。日時はtimestamptz。device_sequenceと時計補正は作らない。

| テーブル | 固有列・型 | 主キー・一意制約 |
|---|---|---|
| answer_logs | event_id uuid, session_id text, question_id text, word_id text NULL, article_id text NULL, kind text (vocabulary/comprehension), material_version integer NULL, mode text, selected_choice_id text NULL, correct_choice_id text NULL, correct boolean, skipped boolean, answered_at timestamptz, legacy_payload jsonb NULL | PK(user_id,event_id) |
| saved_words | word_key text, catalog_word_id text NULL, payload jsonb, saved boolean, deleted_at timestamptz NULL, updated_at timestamptz | PK(user_id,word_key) |
| preferences | setting_key text, value jsonb, updated_at timestamptz | PK(user_id,setting_key)。設定キーと型を検証 |
| unit_sessions | session_id text, unit_id text, mode text, total smallint, correct smallint, completed_at timestamptz | PK(user_id,session_id)。0<=correct<=total、ユニット完了はtotal=10 |
| article_states | article_id text, read boolean, read_at timestamptz NULL, updated_at timestamptz | PK(user_id,article_id) |
| opinion_drafts | article_id text, prompt_id text, body text, updated_at timestamptz, deleted_at timestamptz NULL | PK(user_id,article_id,prompt_id) |

unit_best_scoresテーブルと専用トリガーは作らない。unit_sessionsの完了記録から、unit_id＋modeごとにMAX(correct)を読み込み時に算出する。

private.allowed_emails：email text PRIMARY KEY、enabled boolean NOT NULL DEFAULT true、server_updated_at timestamptz DEFAULT now()。複数件登録可。メールは小文字化して格納する。user_id、slot、紐付け処理はなし。非公開スキーマ、RLS有効、一般利用者の読み書きは禁止。Auth Hook実行ロールに必要なSELECT権限だけ与える。

## 認証とRLS

現在はメール＋パスワードだけ有効。Googleは設定しない。アプリはログイン・ログアウトのみを提供し、新規登録・パスワード再設定画面は作らない。アカウントはダッシュボードで作成する。ユーザー設定：メール確認OFF、パスワード12文字以上。Before User Created Hookは有効メールとemail/googleプロバイダーを確認し、未許可ならユーザー作成を拒否する。Google対応は将来用であり、現在のログイン画面には出さない。user_metadataで許可を判定しない。

Custom Access Token Hook、RLS内の許可表確認、private.is_allowed_user()、SECURITY DEFINER、許可表とuser_idの紐付けは作らない。許可表は登録可否だけを制御する。許可表から消しても既存アカウントのログインを禁止する機能にはならない。既存アカウントの停止・削除は将来の別手段で行う。

全学習テーブルでRLS有効。
SELECT: TO authenticated USING ((select auth.uid()) = user_id)
INSERT: TO authenticated WITH CHECK ((select auth.uid()) = user_id)
UPDATE: TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)
DELETE: 必要な本人の削除について同じUSING所有者条件。通常の保存解除は物理削除せずtombstone。

追記テーブルの通常同期はINSERTのみ。本人改ざんを防ぐ追加関数・改ざん検出は作らない。anonに学習テーブルの権限を付けない。

## 設定の順序

手順書はdocs/stage6-supabase-setup.md。次の順序を明記した。
1. マイグレーションを適用し、Before User Created Hookを設定する（許可表が空なら全員を拒否）。
2. 許可メールを登録する（実値はユーザーが設定しGit・ログへ入れない）。
3. Emailプロバイダーを有効化する。他のプロバイダーは無効にする。Googleを将来追加する場合もHookと許可メールの登録を先に確認する。

認証プロバイダーを先に有効化すると、Hook設定まで一時的に誰でも登録できる。既存の許可外ユーザーがいないことも有効化前に確認する。

接続情報はconfig/supabase.jsonから読む。urlとanonKey（publishableKeyも可）が空・ファイルがない場合は同期だけを無効にし、ゲスト学習を維持する。フロントは公開用キーだけ。管理者用キーの実値はコード・Git・ログに置かない。Googleを将来追加する場合のclient secretはSupabase側へ設定する。

## 更新規則

追記ログと完了セッション: ON CONFLICT DO NOTHING。同IDの再送は成功扱い。内容差異のエラー判定は作らない。

可変データ: ON CONFLICT DO UPDATE ... WHERE existing.updated_at < excluded.updated_at。新しい端末更新日時だけを採用。同時刻は既存行を保持し、読み戻しで両端末を揃える。時計補正はしない。

saved_wordsのword_keyは既存の前後空白除去＋小文字化に合わせる。保存解除・語の削除・意見の削除は削除記録を残し、他端末で復活させない。設定は項目別に更新する。

回答ログはanswered_at → event_idの昇順に並べたコピーを既存の状態計算へ渡す。既存の回答項目を削除しない。旧回答のIDは移行時に1回だけ発行・保存する。

## 共通更新トリガー（承認済み）

対象はsaved_words、preferences、article_states、opinion_draftsの4表。BEFORE UPDATEでNEW.updated_at <= OLD.updated_atならRETURN NULL。行全体を更新せず、既存server_updated_atも変えない。新しい場合は端末のupdated_atを保持し、server_updated_atだけnow()で上書きする。BEFORE INSERTもserver_updated_atをDB時刻に設定する。可変表は標準upsert、専用RPC・SECURITY DEFINER関数は作らない。

| 表 | 新しいupdated_atの場合に受け入れる内容列 |
|---|---|
| saved_words | catalog_word_id、payload、saved、deleted_at |
| preferences | value（mode / autoAdvance / daily / weekly） |
| article_states | read、read_at |
| opinion_drafts | body、deleted_at |

user_idと各主キーは同期で変更せず、同じIDへupsertする。更新日時は端末の比較値のまま、サーバー受信日時と混同しない。

answer_logs・unit_sessionsはON CONFLICT DO NOTHINGで追記。管理側で更新する場合もserver_updated_atをDB側で設定する共通トリガーを持つ。private.allowed_emailsもINSERT/UPDATE時に受信日時を設定するが、端末同期の対象ではない。

POSTが2xxなら返却行が空配列でも送信は完了したものとして、その送信時revisionだけをoutboxから除去する。これは送信値が採用されたことを意味しない。古いupsertはトリガーで拒否されるため、採用された値は通常のpullで取得して端末を統合する。通信中に新しい編集版が発生した場合、その版のoutboxは残す。

## 差分取得（承認済み）

各user_id・各テーブルで別のカーソルを保存。初回は全件取得。その後は前回受信した最大server_updated_atから、config/sync-policy.jsonのdeltaOverlapMsだけさかのぼった時刻以上を取得する。重複は主キーで統合する。端末updated_atを差分の基準に使わない。

10分の幅の値はconfig/sync-policy.jsonだけに定義し、同期コードに再定義しない。毎日の自動全件照合は行わない。アカウントメニューの「再同期」で手動の全件照合を行う。再同期でも未送信outboxを捨てず、送信後に全件読み戻しする。

取得はserver_updated_atと各表の主キーを組み合わせた安定順でページ分割し、全ページ取得・端末保存の成功後だけカーソルを進める。単純なoffsetのずれを避けるためキーによる継続位置を使い、送信レスポンスだけでカーソルを更新しない。

now()はトランザクション開始時刻。重なり幅より長い遅延・トランザクションの後着は差分では回収できない可能性があり、手動再同期で回復する。この承認方式では完全な即時検出を保証しない。

## ローカル保存と利用者切替

利用者ごとに english-notes.user.<auth.uid()>.* の名前空間を使う。学習値・outbox・同期カーソル・移行記録をすべて分離する。既存のキーとデータは移行前バックアップとして維持し、突然削除しない。

未ログイン時は english-notes.guest.* に保存。ログイン時には、旧形式のキーを含む未統合のゲスト記録をログイン先へ自動で統合する。確認画面・ボタン・件数・完了トーストは表示しない。本人のrowsとoutboxへの永続保存でローカル統合を完了し、通常同期を開始する。取り込みの確認画面を挟まずホームを表示する。

端末全体で共通の english-notes.guest.claims.v1 台帳を使い、table／key／版ごとに所属user_idと状態reserved → integratedを記録する。先に所属を永続予約し、本人のrowsとoutboxへ永続統合してからintegratedへ進める。途中失敗時には予約先の本人でのみ再開し、別user_idへ再割り当てしない。台帳と本人envelopeは別キーなので単一の原子更新ではないが、所属を先に予約することで途中停止時の二重割り当てを防ぐ。

旧方式で成功したスナップショットの所属記録も台帳へ引き継ぐ。統合済みのゲスト行は所有者の端末内snapshotバックアップに残し、ゲストの通常rows／values／outboxから除外する。共通台帳と旧キーは保持する。ログアウト後のゲスト画面には以前の統合済み記録を表示せず、新しいゲスト操作は空のvisible領域から始める。新しく学習して生じた未統合の版だけを次のログイン時に統合する。既存レコードを別アカウントへ再割り当てしない。クラウド側の同一IDの再送も既存主キーで重複を防ぐ。

ログアウト時は進行中送信を停止し、表示中の利用者データ・メモリキャッシュを外してゲスト名前空間へ切り替える。未送信データは本人の名前空間に残す。再ログインで再開する。他人のログインで以前の利用者のoutboxを送らない。ゲスト学習も継続できる。

別利用者でログインしたときは、そのuser_idの保存値だけを読む。利用者切替中の非同期応答は開始時user_idと現在user_idを比較し、異なる画面に適用しない。IDを変えて送信する処理は作らない。

ローカル分離はアプリ内の混在防止。端末を操作できる人からブラウザ保存領域を暗号化して隠す機能は今回作らない。

## オフライン・自動統合・書き出し

全操作は端末内へ先に保存・即時反映。outboxを永続化し、ログイン・接続回復・起動/復帰時に再送する。成功した版だけoutboxから除去し、途中失敗と未送信は保持する。

自動統合前に、旧キーを保持したまま端末内へ対象ゲスト記録のスナップショットを保存する。JSONファイルの自動ダウンロードは行わない。内部の件数や照合結果は利用者へ提示しない。ネットワーク障害時も本人のoutboxを保持して通常同期で再送する。

保存確認はテーブルごとに、最大100件を1回のinフィルタでまとめて取得する。UUID列のevent_id／user_idには値を引用符で囲まず指定する。ページ継続位置のUUIDにも同じ規則を適用する。複合text主キーの照合には各値をエスケープしたOR条件を用いる。1件ずつ問い合わせない。

確認GETが400を含むエラーで失敗した場合や対象IDがまだ検出されない場合も、既に2xxで保存済みの版を送信失敗に戻さず、outboxへ再追加しない。内部記録はaccepted（送信済み）、unverified（保存確認未完了）、pending（未送信）、blocked（送信不能）を区別する。確認の失敗だけで利用者向け取り込みエラーを出さない。未送信版が残っている場合は通常同期で再送する。

JSON書き出しは本人の現在の名前空間だけを対象にし、形式版・日時・学習データ・未送信データを含める。JWT・接続キーは含めない。

同期状態はアカウントメニュー内のみ。未ログイン → ログイン → 自動ローカル統合 → 未送信あり → 同期中 → 同期済み。自動統合の確認画面は挟まない。送信失敗は未送信を残して再試行し、保存確認GETの失敗だけでは同期失敗にしない。通信停止中もローカル学習を継続する。

## マイグレーションと削除手段

DBの構造・関数・トリガー・RLS変更はすべてsupabase/migrationsの番号付きSQLで管理する。適用済み履歴に合わせ20261004144629_learning_sync_tables.sql、20261004144638_google_signup_allowlist.sqlへ改名（内容変更なし）。追加済み20261005012849_allow_email_password_signup.sqlを記録。追加済み20261005032051_allow_unset_goal_preferences.sqlも記録。4本とも適用済みなので再適用しない。今後の構造変更も番号付きSQLを使う。Auth Hook・プロバイダー設定は手順に分け、許可メールの実値はリポジトリ外で扱う。

同期後の段階で「学習データのみ削除」と「アカウントも削除」を実装できるようにする。学習データ削除は本人のRLS下で行う。アカウント削除は本人の認証を検証するサーバー処理からAuth管理APIを使い、auth.users削除によりFK CASCADEで学習行を削除する。管理権限はサーバーの秘密設定のみ。クライアントへ置かない。

削除後の旧端末outboxによる復活を防ぐため、学習データのみの削除段階ではユーザーごとのdata_generationと削除通知を追加するマイグレーションを設け、端末は世代更新時に旧outboxを破棄してローカル削除を反映する。今回の同期時点では削除ボタンを表示しない。アカウント削除後は旧JWT/旧user_idへの書き込みを許可しない。

## 適用・同期実装後の確認

許可外登録拒否、別user_idの読み書き拒否、全テーブルRLS、同端末で利用者切替、オフライン再送、同ID重複なし、ログイン時と再ログイン時の自動統合・所属台帳・保存確認GETの引用とバッチ取得、保存解除の伝播、設定競合、server_updated_atの重なり取得・手動再同期、スマホ/PC実端末の相互反映、JSON書き出しを検証する。実端末で確認していない項目を完了扱いしない。

## 一次資料

- https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api
- https://docs.postgrest.org/en/v14/references/api/tables_views.html
- https://www.postgresql.org/docs/current/functions-datetime.html

実Supabaseのスキーマ・履歴・ポリシーを読み取り専用で確認済み。実端末でのログインと相互同期については検証報告で未確認事項を明示する。


## 実装ファイルと保存形式

- app-storage.js：旧logicalキーを互換形式で読み書きするアダプター。ゲストはenglish-notes.guest.state.v1、本人はenglish-notes.user.<uid>.state.v1。学習値、6表の行、outbox、カーソル、移行記録を1つのenvelopeへまとめ、1回のlocalStorage更新で保存する。複数項目の操作も同じtransactionで保存する。
- sync-core.js：既存データとDB6表の相互変換。旧回答にUUIDを一度付与し、answered_at→event_idの順序に統一する。
- supabase-sync.js：公式Auth RESTとPostgRESTを利用。新しいフレームワークやSDK依存は追加しない。認証保存はenglish-notes.auth.session.v1に分け、学習データ書き出しには含めない。初期接続確認、トークン更新、送信・差分取得、手動再同期、自動統合と保存確認を担当する。
- account-sync.js / stage6.css：アカウント内だけに認証・同期・JSON書き出しを表示する。自動統合は画面に表示しない。stage6.jsは利用者切替／受信時に画面の保存値を読み直す。

既存キーは書換・削除せず、初回だけゲストへコピーする。バックアップ用の旧値とコピー後のゲストを移行時に重複計上しない。ユーザー操作以外の受信・再描画はoutboxへ戻さない。日週目標の未指定値はnull、前回ユニットは端末内に保持し、ベストは同期された完了セッションから算出する。

容量不足などで利用者切替が失敗した場合は認証と保存先を整合させる。通信開始と応答適用の両方で認証UID＝保存UIDを確認。不一致のままクラウドの行をゲストへ書くことはない。ログアウトでゲスト領域を開けない場合も認証を外して同期停止し、保存済みの本人領域を保持する。

初回移行のバックアップには対象ゲストデータだけを含める。書き出しは現在の名前空間だけで、認証トークン・接続キーは含めない。通常の再送成功は送信したrevisionだけをoutboxから消す。通信中の再編集は残す。


## 第6.5段階の表示整理（2026-10-05）

認証・同期・保存・バックアップ・件数照合の処理は維持する。ログイン失敗を画面で判別できるよう、既存認証処理の失敗応答から安全なcodeとHTTP statusだけを伝える。サーバーの生のエラー本文は表示・保存しない。

アカウントから学習設定／データの管理／このアプリについてへ分離。成功同期の日時はデータ管理にだけ分単位で表示。学習設定はmode/autoAdvanceの2項目を既存QuizStoreへ即時保存し、goalsは変更しない。ゲスト記録はログイン時に自動統合し、確認・合計件数・内訳・完了通知を表示しない。

ゲスト選択のUI設定はenglish-notes.ui.guest-choice.v1に保存する。学習データやoutboxではなく、この端末でログイン画面を再表示するかを決めるだけのキーである。名前空間分離の方式は維持する。ログアウト後はログイン画面に戻る。


## 自動統合と送信不能の扱い（2026-10-05仕様変更）

- preferences.value のSQL NULL／JSON nullをdaily・weeklyの未設定として許可する。mode・autoAdvanceのNULLは禁止する。適用済みSQLは20261005032051_allow_unset_goal_preferences.sqlに記録する。今回DB・RLS・スキーマの変更は行わない。
- 自動統合前のスナップショットと旧キーは端末内に保存・保持する。利用者の確認やファイルの自動ダウンロードは不要。ファイルが必要な場合はデータの管理から書き出す。
- POST送信時に400〜499（401を除く）を受けた版だけをoutbox内へ送信不能として保存し、自動送信と再同期の送信対象から除外する。確認GETの400や未検出は送信不能にしない。新しい内容へ編集した場合だけ新しい版として送信対象に戻る。401は認証更新、通信エラー・500番台は再試行する。
- データの管理だけに「送信できないデータ」の件数と確認・破棄を置く。破棄しても端末内の学習記録は残す。確認GETの失敗による取り込みエラー・再試行導線は置かない。
- POSTの2xxで送信版だけをackし、採用値は通常pullから取得する。内部の保存確認結果とローカル統合完了は分離する。保存確認が失敗しても統合済みの所属を取り消さず、同じ記録を別利用者へ渡さない。
