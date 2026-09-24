# 仕入れリサーチツール

中古PCをメルカリ・ラクマ・ヤフオクで仕入れ、メルカリで再販するためのリサーチ・通知ツール。

## 全体の仕組み

- **GitHub Actions**が毎日5:00〜22:00の1時間おきに、メルカリ・ラクマ・ヤフオクを自動でチェックする
- 見つけた出品について、メルカリの売り切れ相場から想定売値を推定し、期待利益・利益率を計算する
- 登録した条件(価格帯・目標利益率)を満たす出品があれば、Gmail・LINEで通知する
- 一度通知した商品は、値段が変わらない限り再通知しない
- 条件(キーワード・価格帯・利益率)や通知先の登録・修正は、GitHub Pagesの管理画面(一覧→詳細)から行う。スプレッドシートを直接編集する必要はない

## セットアップ手順

以下の手順は、こばさんご自身の操作が必要な部分です。1つずつ進めてください。

### 1. Googleスプレッドシートを作る

新しいGoogleスプレッドシートを1つ作り、以下3つのシート(タブ)を用意してください。1行目は見出し行、2行目からデータが入ります。

**シート名「条件」**(A1〜H1に見出しを入れる)
| A:id | B:genre | C:keywords | D:price_min | E:price_max | F:target_profit_rate | G:shipping_cost | H:active |

**シート名「通知先」**
| A:id | B:label | C:email | D:gmail_enabled | E:line_user_id | F:line_enabled |

**シート名「通知履歴」**(見出しだけ入れておけばOK。中身はツールが自動で書き込みます)
| A:item_id | B:site | C:price | D:notified_at | E:url | F:title |

スプレッドシートのURLの `.../d/【この部分】/edit` が「シートID」です。あとで使うのでメモしておいてください。

### 2. Google Cloudでの設定(裏側のプログラム用)

1. https://console.cloud.google.com/ で新しいプロジェクトを作成
2. 「APIとサービス」→「ライブラリ」から **Google Sheets API** を有効化
3. 「APIとサービス」→「認証情報」→「認証情報を作成」→「サービスアカウント」を作成
4. 作成したサービスアカウントの「キー」タブから、JSON形式の鍵を作成・ダウンロード(このファイルの中身をあとで使います)
5. JSONファイルの中の `client_email` の値(◯◯◯@◯◯◯.iam.gserviceaccount.com のようなメールアドレス)を、手順1で作ったスプレッドシートの「共有」から**編集者として追加**してください

### 3. Google Cloudでの設定(管理画面のログイン用)

1. 同じGoogle Cloudプロジェクトで、「APIとサービス」→「OAuth同意画面」を設定
   - ユーザータイプ: 外部
   - 公開ステータスは「テスト」のままでOK(むしろこの方が安全です)
   - 「テストユーザー」に、奥様・こばさんのGoogleアカウントを追加してください。**ここに登録した2人しか、この管理画面にログインできなくなります**
2. 「認証情報を作成」→「OAuthクライアントID」→種類は「ウェブアプリケーション」
   - 承認済みのJavaScript生成元に、GitHub PagesのURL(例: `https://こばさんのGitHubユーザー名.github.io`)を追加
   - 作成後に表示される「クライアントID」をメモしておいてください

### 4. Gmail送信用のアプリパスワードを作る

1. 通知の送信元にするGoogleアカウントで、2段階認証を有効にする
2. https://myaccount.google.com/apppasswords でアプリパスワードを発行(16桁の文字列)

### 5. LINE公式アカウントを作る

1. https://www.linebiz.com/jp/entry/ からLINE公式アカウントを開設(無料)
2. LINE Developersコンソール(https://developers.line.biz/)で、作成したアカウントを「Messaging API」で利用できるようにする
3. 「チャネルアクセストークン」を発行してメモしておく
4. 奥様・こばさんのLINEで、QRコードからこの公式アカウントを友だち追加する
5. 友だち追加が終わったら、`LINE_CHANNEL_ACCESS_TOKEN=発行したトークン node scripts/list-line-friends.js` を実行すると、友だち追加した人の名前とLINEユーザーIDが表示されます。このIDを、あとで管理画面の「通知先」に登録します

### 6. GitHubリポジトリを作る

1. GitHubで新しいリポジトリを作成(プライベート推奨)
2. このフォルダの中身をそのリポジトリにpush
3. リポジトリの「Settings」→「Secrets and variables」→「Actions」で、以下のSecretsを登録
   - `GOOGLE_SERVICE_ACCOUNT_JSON` : 手順2でダウンロードしたJSONファイルの中身をそのまま貼り付け
   - `GOOGLE_SHEET_ID` : 手順1でメモしたシートID
   - `GMAIL_SENDER_ADDRESS` : 通知の送信元Gmailアドレス
   - `GMAIL_APP_PASSWORD` : 手順4で発行したアプリパスワード
   - `LINE_CHANNEL_ACCESS_TOKEN` : 手順5で発行したトークン
4. リポジトリの「Settings」→「Pages」で、公開ブランチを選び、公開フォルダを `/docs` に設定してGitHub Pagesを有効化
5. `docs/config.js` を開き、`CLIENT_ID`(手順3)と`SPREADSHEET_ID`(手順1)を実際の値に書き換えて、再度push

### 7. 動作確認

- GitHub Pagesの管理画面URL(例: `https://こばさんのGitHubユーザー名.github.io/リポジトリ名/`)を開き、Googleでログインできることを確認
- 「条件」タブから、試しに1件監視条件を登録する(例: ジャンル名「ThinkPad」、キーワード「ThinkPad」、価格帯 10000〜60000、目標利益率 20、想定送料 800)
- 「通知先」タブから、通知を受け取るメールアドレス・LINEユーザーIDを登録する
- GitHubリポジトリの「Actions」タブから、ワークフローを手動実行(workflow_dispatch)して、正しく動くか確認する

## ローカルでの動作確認

```bash
npm install
npx playwright install chromium
cp .env.example .env   # 値を埋める
node src/run.js
```

個別のスクレイパーだけ試したい場合:

```bash
npm run test:rakuma
npm run test:yahoo
npm run test:mercari
```

## 注意点

- **メルカリ・ラクマの検索結果ページの構造は、サイト側の仕様変更でいつでも壊れる可能性があります。** 通知が来なくなった場合、`src/scrapers/` の該当ファイルの見直しが必要になることがあります
- **ヤフオクの価格は「現在の入札額」であり、即決価格ではありません。** オークション形式のため、実際に仕入れられる金額はこの価格より上がる可能性があります
- 想定売値は、メルカリの売り切れ実績(直近の中央値)から自動推定しています。実績が少ないキーワードでは精度が下がります
