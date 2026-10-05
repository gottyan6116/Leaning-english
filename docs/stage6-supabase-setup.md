# Supabase接続手順

2026-10-05。認証はメール＋パスワード。Googleは現在設定しない。アプリはログイン・ログアウトのみで、新規登録・パスワード再設定画面はない。

## 適用済みの記録

ユーザーが適用した以下4本を、読み取り専用の実Supabase問い合わせで履歴・RLS・所有者条件・Hook定義と照合した。再適用しない。

1. `supabase/migrations/20261004144629_learning_sync_tables.sql`
2. `supabase/migrations/20261004144638_google_signup_allowlist.sql`
3. `supabase/migrations/20261005012849_allow_email_password_signup.sql`
4. `supabase/migrations/20261005032051_allow_unset_goal_preferences.sql`

最初の2本はファイル名だけ変更し、元の内容を保持。3・4本目はユーザー指定SQL。今後の構造変更も番号付きマイグレーションとして管理する。

## 新しい環境を用意する場合の順序

1. 番号順にSQLを適用し、Authentication → HooksでBefore User Createdに `public.before_user_created_allowlist` を設定。
2. 許可メールを `private.allowed_emails` に小文字・前後空白除去して登録、enabled=true。実メールはGit・会話ログに保存しない。
3. Emailプロバイダーを有効化。メール確認OFF、パスワード12文字以上。アカウントはダッシュボードで作成。他のプロバイダーは無効。

**必ず①Hook → ②許可メール → ③認証の順に設定する。** 認証を先に有効化すると、Hook設定まで誰でも登録できる期間が生じる。許可表から削除するだけでは既存アカウントの停止にならない。

```sql
insert into private.allowed_emails(email,enabled)
values(lower(btrim('<許可するメールアドレス>')),true)
on conflict(email) do update set enabled=excluded.enabled;
```

実値入りSQLはリポジトリ外で扱う。privateスキーマをData APIに公開しない。Custom Access Token Hookは不要。

## アプリの接続設定

`config/supabase.json` の空欄をユーザーが設定する。

```json
{
  "url": "<Supabase Project URL>",
  "anonKey": "<公開用anonまたはpublishable key>"
}
```

Project Settings → API Keysから公開用キーを取得する。publishableKeyという項目名も受け付ける。公開用キーはブラウザへ配信される前提で、学習データはRLSで守る。管理者用キーやパスワードは入れない。値が空・ファイルがない場合、同期だけ無効になりゲスト学習は動作する。

公開先にも同じパスで配置する。GitHub Pagesはリポジトリのconfigフォルダを配信する。設定後に再読み込みすると独立したログイン画面が開く。ゲスト利用中はアカウントの「ログイン」から開く。

差分の重なり幅は `config/sync-policy.json` のdeltaOverlapMsだけで定義。日次の全件照合はせず、アカウント → データの管理の「再同期」で未送信を送って全件を取得する。

## ログイン時の端末データの自動統合

ログイン時に、その端末でまだアカウントに属していないゲスト記録（旧キーを含む）を自動でアカウントへ統合する。確認画面・操作ボタン・件数・完了トーストは表示せず、ホームを表示する。旧キーと統合前スナップショットは端末バックアップとして維持し、ファイルは自動ダウンロードしない。

端末全体共通の english-notes.guest.claims.v1 台帳でtable／key／版の所属をreserved → integratedとして記録する。先に所属予約を保存してから本人のrows／outboxへ永続統合する。既に所属が決まった記録は別アカウントへ再割り当てしない。旧成功スナップショットの所属も引き継ぐ。統合済みのゲスト行は所有者のローカルsnapshotバックアップへ保持し、ゲストの通常rows／values／outboxから除外する。共通台帳と旧キーは削除しない。ログアウト後のゲスト画面には以前の統合済み記録を表示せず、新しい学習を空のvisible領域から始める。そこで生じた未統合の版だけを次回ログイン時に自動統合する。

ネットワーク確認を待たずローカル統合を完了し、通信障害では本人outboxを保持して再接続後に送信する。POSTが2xxなら空配列の返却でも送信時の版だけを送信済みにし、採用値は通常の読み戻しで統合する。保存確認GETはテーブルごと最大100件のinフィルタでまとめ、event_id／user_idのUUIDは引用符で囲まない。確認GET失敗や未検出だけで送信済みデータを失敗扱いせず、利用者向けエラーも出さない。

ログアウトでログイン画面に戻り、「ログインせずに使う」でゲストへ進める。本人の未送信データは本人の名前空間に残る。他アカウントへコピーしない。端末内データはブラウザ・公開URLごとに保存される。今回追加でSupabaseのSQLを実行する必要はなく、DB・RLS・スキーマは変更しない。

## 読み取り専用の確認

`supabase/checks/verify-schema.sql` で7表のRLS、所有者条件、許可表・Hookの権限、4可変表の古い更新拒否と受信時刻トリガーを確認する。実メールは返さない。

CLIを使う場合、事前に--helpで引数を確認し、パスワードをコマンドやGitへ入れない。

```powershell
npx --yes supabase@2.119.0 db query --help
npx --yes supabase@2.119.0 db query --linked --file supabase/checks/verify-schema.sql
```

## 実端末で確認する5項目

1. スマホでゲストとして語の保存と回答を行い、ログインする。確認画面・件数・トースト・ファイルダウンロードを挟まずホームへ戻り、語と回答がアカウントに反映されること。ブラウザのコンソールに保存確認GETの400が出ないこと。
2. PCで同じアカウントに入り再同期し、スマホの語・回答が表示されること。PCから保存解除するとスマホでも解除されること。再同期を繰り返して同じ回答IDの件数が増えないこと。
3. 同じ端末でログアウト → ゲストで新しく学習 → 再ログインを行う。新しい記録も画面を挟まず自動統合され、前回の回答が重複しないこと。別の許可済みアカウントがある場合は、統合済みゲスト記録がそちらへ再割り当てされないこと。
4. PCのアカウント → 学習設定でモード・自動送りを変更しスマホに反映すること。日・週目標の未設定値でも同期でき、既存目標値は保持すること。スマホをオフラインにして回答・保存し、再接続で本人の未送信が送られること。
5. データの管理からJSONを書き出し、本人の記録だけで他利用者・認証情報がないこと。実際にPOSTが拒否された版だけが「送信できないデータ」にあり、確認GETの失敗を送信不能として表示しないこと。

## 将来Googleを追加する場合

Hookと許可メールを確認してからGoogleを有効化。Google CloudのWeb OAuthクライアントへSupabaseのコールバックURLを登録し、Client ID／SecretはSupabase側だけへ設定。Site URL／Redirect URLも公開先に合わせる。現在Google起動UIはないため、別段階の実装が必要。

## 一次資料

- [メール＋パスワード認証](https://supabase.com/docs/guides/auth/passwords)
- [Auth REST API](https://github.com/supabase/auth/blob/master/openapi.yaml)
- [Before User Created Hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Google認証（将来用）](https://supabase.com/docs/guides/auth/social-login/auth-google)


## 送信が完了しない場合

通信エラー・サーバー障害は本人の未送信を保持し、再接続後に通常同期で再送する。自動統合のための確認・再試行画面は表示しない。日・週目標が未設定でも設定の同期は可能。

POSTの400番台（401以外）の送信失敗は自動再送を停止する。データの管理の「送信できないデータが n 件あります」を開いて内容を確認し、不要な送信だけを破棄できる。端末内の学習記録は残る。保存確認GETが失敗しただけではこの区分に入れず、既に2xxで送信済みの版を再送しない。未送信版が残っていれば通常同期で再送する。

控えのファイルが必要な場合は「学習データを書き出す（JSON）」を選ぶ。
