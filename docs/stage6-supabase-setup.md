# Supabase接続手順

2026-10-05。認証はメール＋パスワード。Googleは現在設定しない。アプリはログイン・ログアウトのみで、新規登録・パスワード再設定画面はない。

## 適用済みの記録

ユーザーが適用した以下3本を、読み取り専用の実Supabase問い合わせで履歴・RLS・所有者条件・Hook定義と照合した。再適用しない。

1. `supabase/migrations/20261004144629_learning_sync_tables.sql`
2. `supabase/migrations/20261004144638_google_signup_allowlist.sql`
3. `supabase/migrations/20261005012849_allow_email_password_signup.sql`

最初の2本はファイル名だけ変更し、元の内容を保持。3本目はユーザー指定SQL。今後の構造変更も番号付きマイグレーションとして管理する。

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

## 既存データの取り込み

ログイン直後、取り込み対象が1件以上の場合だけ合計件数の確認を表示する。内訳は「詳細」にまとめ、旧保存形式という分類は表示しない。ログインだけでは取り込まない。明示的に取り込み操作を選ぶと、JSONバックアップを保存してから取り込む。移行対象IDがサーバーにある件数を照合し、成功時だけ完了し、「取り込みました」と一度だけ伝える。照合結果の件数は画面に出さない。「今はしない」を選んだ場合はデータの管理から取り込める。ゲストと旧キーの重複はIDで統合する。

旧キーはバックアップとして維持。ログアウトでログイン画面に戻り、「ログインせずに使う」でゲストへ進める。本人の未送信データは本人の名前空間に残る。他アカウントへ自動コピーしない。端末内データはブラウザ・公開URLごとに保存される。

## 読み取り専用の確認

`supabase/checks/verify-schema.sql` で7表のRLS、所有者条件、許可表・Hookの権限、4可変表の古い更新拒否と受信時刻トリガーを確認する。実メールは返さない。

CLIを使う場合、事前に--helpで引数を確認し、パスワードをコマンドやGitへ入れない。

```powershell
npx --yes supabase@2.119.0 db query --help
npx --yes supabase@2.119.0 db query --linked --file supabase/checks/verify-schema.sql
```

## 実端末で確認する5項目

1. スマホでログイン。件数を確認して取り込み、JSONバックアップと「取り込みました」の表示を確認。
2. スマホで記事の語を保存、PCで同じアカウントに入り再同期。PCに語が表示され、PCから保存解除するとスマホでも解除されること。
3. スマホで回答して、PCの成績・復習対象へ反映。再同期を繰り返して回答が増えないこと。
4. PCのアカウント → 学習設定でモード・自動送りを変更しスマホに反映。日・週目標の既存値は保持し、設定欄は計測実装まで非表示。スマホをオフラインにして回答・保存、再接続で未送信が送られること。
5. ログアウト後にゲストを選択して学習し、再ログインで本人へ戻ること。JSON書き出しに他利用者・認証情報がないこと。

## 将来Googleを追加する場合

Hookと許可メールを確認してからGoogleを有効化。Google CloudのWeb OAuthクライアントへSupabaseのコールバックURLを登録し、Client ID／SecretはSupabase側だけへ設定。Site URL／Redirect URLも公開先に合わせる。現在Google起動UIはないため、別段階の実装が必要。

## 一次資料

- [メール＋パスワード認証](https://supabase.com/docs/guides/auth/passwords)
- [Auth REST API](https://github.com/supabase/auth/blob/master/openapi.yaml)
- [Before User Created Hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Google認証（将来用）](https://supabase.com/docs/guides/auth/social-login/auth-google)
