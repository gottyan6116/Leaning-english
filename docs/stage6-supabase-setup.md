# Supabase設定手順（ユーザー実行用）

2026-10-04。SQL2本の準備まで完了。Supabaseへの適用・認証設定・接続設定は行っていない。アプリのログイン・outbox・同期・再同期ボタンは次の実装で追加するため、SQL適用だけでスマホとPCの同期が始まるわけではない。

## 1. マイグレーションを適用する

リポジトリのフォルダで実行。既存プロジェクトを使う。実メール・接続情報・DBパスワードをGitや会話ログに記録しない。

```powershell
npx --yes supabase@2.119.0 login
# supabase/config.tomlが存在しない場合のみ。CLIのローカル構成を生成する。
npx --yes supabase@2.119.0 init
npx --yes supabase@2.119.0 link --project-ref <あなたのプロジェクト参照ID>
npx --yes supabase@2.119.0 db push --dry-run
npx --yes supabase@2.119.0 db push
```

dry-runで適用予定が以下の2本だけであることを確認する。既存の別マイグレーション履歴と不一致がある場合は、その履歴を確認してから進める。パスワードは求められた入力欄へ入力し、コマンド引数に埋め込まない。

1. `supabase/migrations/20261004132757_learning_sync_tables.sql`
2. `supabase/migrations/20261004132801_google_signup_allowlist.sql`

構造をダッシュボードで手作業作成しない。構造変更は今後も新しい番号付きSQLで管理する。今回のSQLは6学習表・許可表・RLS・共通トリガー・登録Hookを追加し、既存教材や端末データを変更しない。

## 2. Before User Created Hookを設定する（先に行う）

SupabaseのAuthentication → HooksでBefore User Createdを開き、Postgres関数 `public.before_user_created_allowlist` を選択して有効化する。Custom Access Token Hookは設定しない。

許可表はこの時点では空なので、新規登録は全員拒否になる。SQL内のHook関数はSECURITY INVOKER。必要な私有許可表へのSELECTはsupabase_auth_adminロールだけに付与してある。

Googleを先に有効化するとHook設定まで誰でも登録できる期間が生じる。既にGoogleが有効なら、設定作業前に一時無効化し、既存の許可外ユーザーがいないか確認する。Before User Createdは既存ユーザーのログイン時には呼ばれないため、許可表から削除するだけで既存アカウントの利用停止にはならない。

## 3. 許可メールを登録する

Hookを有効にしてから、本人の実メールに置き換えて実行する。この実値入りSQLはリポジトリ外に保存する。複数人を許可する場合は行を追加する。小文字・前後空白除去で登録する。

```sql
insert into private.allowed_emails(email,enabled)
values(lower(btrim('<許可するメールアドレス>')),true)
on conflict(email) do update set enabled=excluded.enabled;
```

実値をGitに含めず実行する方法：Supabase SQL Editorに上記だけを入力して実行するか、リポジトリ外のローカルSQLファイルをCLIに渡す。

```powershell
npx --yes supabase@2.119.0 db query --linked --file <リポジトリ外の許可メールSQLファイル>
```

privateスキーマをData APIの公開スキーマに追加しない。許可表の内容を一般ユーザーに公開しない。

## 4. Googleログインを有効化する（最後に行う）

Google CloudでWeb用OAuthクライアントを作成し、SupabaseのGoogleプロバイダー画面に示されるコールバックURLをGoogle側の承認済みリダイレクトURIに登録する。Client IDとClient SecretはSupabase側のプロバイダー設定に入力する。Google以外のメール・電話・匿名・他OAuthログインは無効にする。

SupabaseのURL Configurationにアプリ公開URLを登録する。GitHub Pagesの場合はリポジトリパスまで含む `https://gottyan6116.github.io/Leaning-english/`。別の公開先も使う場合はそのURLを追加する。通常利用する公開先をSite URLに設定する。

必ず順序を守る：**①Hook設定 → ②許可メール登録 → ③Google有効化**。

## 5. 接続情報を用意する

`config/supabase.example.json` は空のひな型。URLと公開用anon keyをユーザーが設定する。管理者用キーやGoogleのClient Secretをブラウザ用設定に入れない。今回、このファイルはアプリから読み込まない。接続設定の取り込みとログイン動作は次の同期実装時に行う。

差分の重なり幅は `config/sync-policy.json` の `deltaOverlapMs` だけに定義。10分の重なりでID統合し、自動の日次全件取得はしない。アカウントメニューの手動「再同期」は次の同期実装で用意する。

## 6. 適用結果の確認

リポジトリの `supabase/checks/verify-schema.sql` をファイルから実行する。読み取り専用。実メールを返す問い合わせは含めていない。

```powershell
npx --yes supabase@2.119.0 db query --linked --file supabase/checks/verify-schema.sql
```

確認点：7表すべてRLS有効、6学習表の所有者条件、一般ユーザーが許可表・Hookを実行できない、4可変表にaccept_newer_update、全表に受信時刻トリガー、SECURITY DEFINERなし。

今回の隔離PostgreSQLテストでは43項目通過：別user_idの読み書き拒否、anon拒否、古い・同時刻upsert無視、新しい更新の採用、再送の重複防止、複数許可メールと非Google拒否、アカウント削除時のFK連鎖を確認。Supabase Authの実際のHook起動・Google OAuth・PostgREST経由の挙動・実端末2台の同期は、適用と同期実装後に確認する。

## 一次資料

- [Before User Created Hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [Hookの権限](https://supabase.com/docs/guides/auth/auth-hooks)
- [Google認証](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Data APIの権限変更](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
