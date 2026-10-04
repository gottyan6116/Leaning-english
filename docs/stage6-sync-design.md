# 第6段階：同期設計・簡略版

2026-10-04。ユーザー修正を反映して承認済み。記事の仕上げ完了後、番号付きSQL2本と手順書を作成。実Supabase適用・接続設定はユーザーが行う。フロント同期の実装はまだ行わない。

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

Googleだけ有効にする。Before User Created Hookで、許可表の有効メールとGoogleプロバイダーを確認し、未許可ならユーザー作成を拒否する。user_metadataで許可を判定しない。

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
3. Googleログインを有効化する。他のプロバイダーを無効化する。

Googleログインを先に有効化すると、Hook設定まで一時的に誰でも登録できる。既存の許可外ユーザーがいないことも有効化前に確認する。

接続情報は空の設定ファイルから読む。フロントは公開用anon keyのみ。service_roleの実値はコード・Git・ログに置かない。Google client secretはSupabase側へ設定する。

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

古いupsertで返却行が0件でも送信内容の採用とは扱わない。同じIDを読み戻して既存値で端末を統合する。新しい送信が途中で発生した場合、その版のoutboxは残す。

## 差分取得（承認済み）

各user_id・各テーブルで別のカーソルを保存。初回は全件取得。その後は前回受信した最大server_updated_atから、config/sync-policy.jsonのdeltaOverlapMsだけさかのぼった時刻以上を取得する。重複は主キーで統合する。端末updated_atを差分の基準に使わない。

10分の幅の値はconfig/sync-policy.jsonだけに定義し、同期コードに再定義しない。毎日の自動全件照合は行わない。アカウントメニューの「再同期」で手動の全件照合を行う（同期実装時に追加）。再同期でも未送信outboxを捨てず、送信後に全件読み戻しする。

取得はserver_updated_atと各表の主キーを組み合わせた安定順でページ分割し、全ページ取得・端末保存の成功後だけカーソルを進める。単純なoffsetのずれを避けるためキーによる継続位置を使い、送信レスポンスだけでカーソルを更新しない。

now()はトランザクション開始時刻。重なり幅より長い遅延・トランザクションの後着は差分では回収できない可能性があり、手動再同期で回復する。この承認方式では完全な即時検出を保証しない。

## ローカル保存と利用者切替

利用者ごとに english-notes.user.<auth.uid()>.* の名前空間を使う。学習値・outbox・同期カーソル・移行記録をすべて分離する。既存のキーとデータは移行前バックアップとして維持し、突然削除しない。

未ログイン時は english-notes.guest.* に保存。初回ログインではゲストデータの件数を表示し、明示的な取り込み操作でログイン先へ移す。別アカウントへの自動取り込みは禁止。成功したゲストスナップショットには取り込み済みを記録し、同じスナップショットを次の利用者へ自動で再移行しない。

ログアウト時は進行中送信を停止し、表示中の利用者データ・メモリキャッシュを外してゲスト名前空間へ切り替える。未送信データは本人の名前空間に残す。再ログインで再開する。他人のログインで以前の利用者のoutboxを送らない。ゲスト学習も継続できる。

別利用者でログインしたときは、そのuser_idの保存値だけを読む。利用者切替中の非同期応答は開始時user_idと現在user_idを比較し、異なる画面に適用しない。IDを変えて送信する処理は作らない。

ローカル分離はアプリ内の混在防止。端末を操作できる人からブラウザ保存領域を暗号化して隠す機能は今回作らない。

## オフライン・移行・書き出し

全操作は端末内へ先に保存・即時反映。outboxを永続化し、ログイン・接続回復・起動/復帰時に再送する。成功した版だけoutboxから除去し、途中失敗と未送信は保持する。

初回移行前にJSONバックアップと内訳件数を提示する。移行対象IDがクラウドに存在する件数と照合し、不一致は移行完了にしない。クラウド全体には既存データがあり得るので、全体件数の単純一致では判定しない。

JSON書き出しは本人の現在の名前空間だけを対象にし、形式版・日時・学習データ・未送信データを含める。JWT・接続キーは含めない。

同期状態はアカウントメニュー内のみ。未ログイン → 移行件数確認 → 未送信あり → 同期中 → 同期済み。失敗は同期失敗として表示し、未送信を残して再試行する。通信停止中もローカル学習を継続する。

## マイグレーションと削除手段

DBの構造・関数・トリガー・RLS変更はすべてsupabase/migrationsの番号付きSQLで管理する。Supabase CLI 2.119.0のmigration newでSQL2本を生成済み。手順書に従いユーザーがファイルから適用する。ダッシュボードでテーブルを手作業変更することを前提にしない。Auth Hook・プロバイダー設定は設定手順に分ける。許可メールの実値はリポジトリ外の入力として扱う。

同期後の段階で「学習データのみ削除」と「アカウントも削除」を実装できるようにする。学習データ削除は本人のRLS下で行う。アカウント削除は本人の認証を検証するサーバー処理からAuth管理APIを使い、auth.users削除によりFK CASCADEで学習行を削除する。管理権限はサーバーの秘密設定のみ。クライアントへ置かない。

削除後の旧端末outboxによる復活を防ぐため、学習データのみの削除段階ではユーザーごとのdata_generationと削除通知を追加するマイグレーションを設け、端末は世代更新時に旧outboxを破棄してローカル削除を反映する。今回の同期時点では削除ボタンを表示しない。アカウント削除後は旧JWT/旧user_idへの書き込みを許可しない。

## 適用・同期実装後の確認

許可外登録拒否、別user_idの読み書き拒否、全テーブルRLS、同端末で利用者切替、オフライン再送、同ID重複なし、初回移行件数、保存解除の伝播、設定競合、server_updated_atの重なり取得・手動再同期、スマホ/PC実端末の相互反映、JSON書き出しを検証する。実端末で確認していない項目を完了扱いしない。

## 一次資料

- https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api
- https://docs.postgrest.org/en/v14/references/api/tables_views.html
- https://www.postgresql.org/docs/current/functions-datetime.html

今回の到達点：SQL・手順書の準備まで。隔離PostgreSQLで43項目を検証し、実Supabaseと2端末同期の確認は未実施。
