# 第6段階：学習データ同期の設計案

2026-10-04。承認待ち。SQL・接続・同期処理はまだ実装しない。

## 目的と境界

スマホとPCで同じ学習データを使う。端末内保存と既存キー・既存項目を維持し、同期用ID・更新日時・送信待ち記録を追加する。教材はGitのmaterials内JSONのままでSupabaseへ送らない。学習時間の計測・記録ページ・管理画面は作らない。

## テーブル定義

公開スキーマの全テーブルでRLSを有効化。以下のuser_idはuuid NOT NULL、auth.users(id)を参照する。追加情報のpayloadは既存項目を失わないためのjsonb。日時はtimestamptz、モードはtextでja/enにCHECK制約。

| テーブル | 列・型 | 一意制約／制約 | 同期ルール |
|---|---|---|---|
| answer_logs | user_id uuid, event_id uuid, session_id text, question_id text, word_id text nullable, mode text, selected_choice_id text nullable, correct boolean, skipped boolean, answered_at timestamptz, device_id uuid, device_sequence bigint, legacy_payload jsonb nullable, received_at timestamptz | PK(user_id,event_id)。skippedならselected_choice_idはNULL、correct=false。旧ログだけlegacy_payloadを許容 | 追記のみ。同じID・同じ内容の再送は既存行を返す。IDが同じで内容が違う場合はエラー。UPDATE/DELETE権限なし |
| saved_words | user_id uuid, word_key text, catalog_word_id text nullable, payload jsonb, saved boolean, deleted_at timestamptz nullable, updated_at timestamptz, device_id uuid | PK(user_id,word_key) | 更新日時が新しい方。記事保存・手入力・語彙集保存を含む。保存解除はsaved=false、手入力語の削除はdeleted_at。削除記録を残して復活を防ぐ |
| preferences | user_id uuid, setting_key text, value jsonb, updated_at timestamptz, device_id uuid | PK(user_id,setting_key)。mode/autoAdvance/dailyGoal/weeklyGoal/lastUnitにキーを限定。各valueを検証 | 設定項目ごとに新しい日時を採用。片方の端末の目標変更で、他方のモード変更を上書きしない |
| unit_sessions | user_id uuid, session_id text, unit_id text, mode text, total smallint, correct smallint, completed_at timestamptz, device_id uuid | PK(user_id,session_id)。0<=correct<=total、完了したユニットのtotal=10 | 完了セッションの追記のみ。同ID・同内容の再送は成功、異内容は拒否。未完了・誤答だけ再試行したセットはベストに含めない |
| unit_best_scores | user_id uuid, unit_id text, mode text, best_score smallint, best_session_id text, updated_at timestamptz | PK(user_id,unit_id,mode)。0<=best_score<=10。best_session_idは同一ユーザーのunit_sessionsを参照 | セッション追加のDBトリガーで最大値を反映。直接のクライアント更新は禁止。値は下がらない |
| article_states | user_id uuid, article_id text, read boolean, read_at timestamptz nullable, updated_at timestamptz, device_id uuid | PK(user_id,article_id) | 更新日時が新しい方。既存の読了記録は維持 |
| opinion_drafts | user_id uuid, article_id text, prompt_id text, body text, updated_at timestamptz, device_id uuid, deleted_at timestamptz nullable | PK(user_id,article_id,prompt_id) | 更新日時が新しい方。削除も記録を同期 |

word_keyは現行アプリの見出し語の前後空白除去＋小文字化に合わせる。記事の出典・文脈・既存IDはpayloadに保持する。既存集計の重複排除定義を変更しない。

学習時間は今回はテーブルを作らない。将来、user_id＋端末発行のevent_idを持つlearning_time_eventsを追加できる。現在のテーブルを変更する前提にしない。

## RLSと書き込み権限

全学習テーブルのSELECTはTO authenticated、USING ((select auth.uid()) = user_id AND private.is_allowed_user())。

追記テーブルのINSERTはWITH CHECKで同じ所有者条件。UPDATE/DELETEは許可しない。可変テーブルのUPDATEはUSINGとWITH CHECKの両方に同じ条件を置く。anonにはテーブル権限を付けない。

可変データの更新は、所有者を検査し、更新日時を比較するSECURITY INVOKERの同期関数を通す。PostgRESTで古い行を無条件upsertして新しい行を消す方式は使わない。比較と更新をDB内の1トランザクションで行う。直接UPDATEも新旧日時を検査するトリガーで保護する。

best_scoresはSELECTのみ許可。所有者RLSの下で動くSECURITY INVOKERトリガーに必要な列だけINSERT/UPDATE権限を与え、直接変更はトリガーの内部更新以外拒否する。公開RPCに管理者権限を持たせない。実装時に、直接API呼び出しによるベストの改ざんを検証する。

## 許可リスト：認証とデータアクセスの二重制限

private.allowed_accounts：slot smallint PRIMARY KEY CHECK(slot=1), email text NOT NULL UNIQUE, user_id uuid UNIQUE NULLABLE, enabled boolean NOT NULL。最大1行。RLS有効。privateスキーマはData APIへ公開しない。実際のメールはユーザーがSQL Editorで設定し、Git・ログ・フロントには保存しない。

1. Googleのみ有効化。メール/パスワード、匿名、その他プロバイダーは無効化。
2. Before User Created Hookで、許可メールとの一致とGoogleプロバイダーを検査。不一致ならユーザー作成を拒否。
3. Custom Access Token Hookで、既存ユーザーのログイン・トークン更新時も許可を検査。不一致ならトークン発行を拒否。既存の許可外ユーザーがいても新規登録制限だけをすり抜けない。
4. Custom Access Token Hook内で、Google・許可メールを確認後、許可表のuser_idがNULLの場合だけ当該user_idへ原子的に紐付け、成功してからトークンを発行。既に紐付いたIDと違う場合は拒否。同じメールでも別user_idを自動で置換しない。初回RLSアクセスの時点で紐付けが完了している。
5. RLSはauth.uid()の所有者条件に加え、許可user_idが現在も有効かをDBで確認。許可取消後に古いJWTを持っていても学習データを読めない。

プロバイダー・メールの検査はSupabaseが管理するAuth情報を使い、ユーザーが書き換えられるuser_metadataを許可判定に使わない。トークン発行時はauth.usersとauth.identitiesのGoogle連携・確認済みメールを照合する。

Auth HookはSECURITY INVOKER。supabase_auth_adminにフック実行と許可表の必要な読み書きだけを付与し、他ロールのフック実行をREVOKEする。RLSから許可リストを読むprivate.is_allowed_user()だけ、最小権限の専用所有者を使うSECURITY DEFINERとし、search_path固定・引数なし・auth.uid()検査・真偽値のみ返却。PUBLIC/anonの実行権限は削除する。アプリロールに許可表を直接公開しない。

公開用接続ファイルにsupabaseUrlとsupabaseAnonKeyの空欄だけを用意する。ユーザーが設定する。service_role keyは使用しない。静的フロントでは設定値は公開されるため、秘密値をここへ入れない。Googleのclient secretはSupabase側に設定する。

## 端末内の追加保存

- 既存localStorageを正として残す。新しい同期メタデータキーにdevice_id、event_idの対応表、レコードごとの更新日時、outbox、移行結果を追加する。
- 新しい回答は操作時にUUIDを1回発行して永続化。同じ回答の再送では発行し直さない。
- 旧回答は移行時にUUIDを1回だけ付与し、対応表を保存。旧selectedIndexを削除せずlegacy_payloadとして保持。過去の選択肢を復元できない場合はselected_choice_id=NULL、旧ログであることを記録。架空のIDを付けない。
- 既存データを上書きしてID形式を変更しない。旧session_idはtextで保持する。
- 端末更新をローカルに確定後、即時に画面反映。outboxには対象レコードのIDと版を保存。書き込み途中の終了はローカルの変更検出で起動時にoutboxを復元する。
- ネット接続を伴わないJSON書き出しに、既存値・同期メタデータ・形式バージョン・出力日時を含める。認証トークンや接続キーは含めない。

## 同期と競合

ログイン・起動・フォアグラウンド復帰・通信復帰・学習操作後に同期。onlineフラグだけで成功扱いしない。実際の応答を確認する。バックグラウンド中の常時同期は保証しない。端末内に保存し、次回起動・復帰で再送する。

1. 未送信のIDと版をスナップショット。
2. 追記・日時比較の同期関数へ送信。成功したID/版だけoutboxから除去。送信中に編集された次の版は残す。
3. クラウドの全行をページ分割で取得（PoC）。削除記録も取得。新しいレコードをローカルへ統合。
4. 途中失敗なら未送信を保持し、失敗状態を表示。指数バックオフで再送。ユーザーの「再同期」も用意。

回答ログは受信順ではなく、answered_at → device_id → device_sequence → event_idの昇順に統合したコピーを既存の状態算出へ渡す。同一端末・同一日時は端末内の操作順、別端末・同一日時はdevice_idで固定。device_sequenceは端末ごとに永続化する単調増加番号。旧ログには元の配列順で番号を一度だけ付与する。既存項目を削除せず、再取得した旧回答が末尾に追加されて最新扱いになることを防ぐ。wordStatus/reviewCandidatesの定義自体は変更しない。

日時はUTC。更新日時が等しい場合はdevice_idの固定順で決着し、両端末で同じ結果にする。クライアント時計のずれはオンライン時にサーバー時刻との差を取って補正する。オフライン時の時計の完全一致は保証できないので、値を黙って消さず移行前バックアップとJSON書き出しを保持する。ベストスコアだけは更新日時によらず最大値を優先。

## 初回移行

アカウントメニューで「回答○件／保存語○件／手入力語○件／設定○件／完了セッション○件／読了○件／意見○件」を先に表示。設定の件数は設定キー単位、保存語と手入力語は重なる可能性があるため内訳として表示し、二重に合計しない。

ローカルのJSONバックアップと移行対象ID一覧を先に保存する。移行中も学習を止めず、以後の更新は別のoutboxとして保持。クラウドに既存データがある場合は、全体件数が同じになるとは限らない。移行スナップショットの各IDがクラウドに存在する件数が送信前の件数と一致することを照合する。追記ログは内容一致も照合。可変データは、競合でより新しい版が採用された件数を別に示す。件数不一致・未応答・途中失敗を移行完了にしない。

## 状態遷移

| 内部状態 | アカウントメニュー表示 | 次の遷移 |
|---|---|---|
| 未ログイン | ログインの導線 | ログイン→移行件数確認。学習は継続 |
| 移行確認待ち | 移行する件数 | 実行→移行中。未実行ならローカルのまま |
| 未送信・オフライン | 未送信あり | ログイン済みで接続回復→同期中 |
| 同期中 | 同期中 | 送信・取得・照合成功→同期済み／新しい未送信があれば次の同期 |
| 同期済み | 同期済み・最終同期日時 | 編集→未送信あり。起動・復帰→取得 |
| 同期失敗 | 同期失敗・再同期 | 再試行→同期中。outboxとローカルを保持 |
| 認証期限切れ／許可取消 | 再ログインの導線／アクセス不可 | 同期停止。ローカル学習・書き出しは継続 |

同期状態はアカウントメニューだけに表示。通常の学習画面には出さない。

## 承認後の提出と検証

SQLファイル、空の接続設定、Google・Auth Hookの設定手順を作成。SupabaseへのSQL実行と値の設定はユーザーが行う。

検証：許可外の新規・既存アカウント拒否、別user_idアクセス拒否、全表RLS、キー漏洩なし、切断中の操作と再送、同IDの重複なし、旧ログの移行件数一致、端末間の保存・解除・回答・設定・ベスト・読了・下書き、JSON書き出し、競合日時同値・途中終了・再試行。2つの実端末で確認できないものは未確認と報告し、ブラウザ2画面を実端末検証とは呼ばない。

## 公式資料（2026-10-04確認）

- [Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)：Before User CreatedとCustom Access TokenはFree/Proで利用可能。
- [Before User Created](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)：登録時の拒否。
- [Custom Access Token](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)：トークン発行前の検査。
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)：所有者条件、SELECT/INSERT/UPDATEのポリシー。
- [Google](https://supabase.com/docs/guides/auth/social-login/auth-google)：Google OAuth設定。

Supabaseの変更履歴を確認。直近のPostgresマイナー更新の破壊的変更は既存の特殊インデックス・暗号化方式に関するもの。本設計はそれらを利用しない。
