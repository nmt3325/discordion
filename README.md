# Discordion

Discord と Notion を連携するインテグレーション bot。Notion の変更を Discord に通知したり、Discord から Notion ページを作成・検索・閲覧できます。

---

## 機能一覧

| 機能 | コマンド | 説明 |
|------|---------|------|
| 通知 | `/notification` | Notion の変更をリアルタイム / ダイジェストで Discord に配信 |
| ページ作成 | `/create-page` | Discord のモーダルフォームから Notion ページを作成 |
| ページリスト | `/pages` | Notion データベースの一覧を Discord で閲覧・共有 |
| パネル | `/panel` | チャンネルに常設ボタンメニューを設置 |
| スケジュールサマリー | `/summary` | 日次 / 週次 / 毎時の Notion スナップショットを Discord に配信 |
| クイックアクション | (通知カードのボタン) | Discord から直接コメント追加・ステータス変更 |
| 検索 | `/find` | Notion ページをタイトルで検索 |
| Discord Viewer | `/embed-discord` | Discord チャンネルを Notion に埋め込むリンクを生成 |
| ヘルプ | `/help` | 接続状態とコマンド一覧を表示 |

---

## 事前準備

### 必要なもの

- Node.js 18 以上
- Discord アカウント（Bot を作成できる権限）
- Notion アカウント（インテグレーションを作成できる権限）

---

## Step 1 — Discord Bot の作成

### 1-1. アプリケーションを作成する

1. [Discord Developer Portal](https://discord.com/developers/applications) を開く
2. 右上の **New Application** をクリック
3. アプリ名（例: `Discordion`）を入力して **Create**

### 1-2. Bot を追加する

1. 左メニューの **Bot** をクリック
2. **Add Bot** → **Yes, do it!**
3. **Token** セクションの **Reset Token** をクリックしてトークンをコピー  
   → これが `DISCORD_TOKEN` になります（後で `.env` に貼ります）
4. **Privileged Gateway Intents** セクションで以下を **ON** にする
   - Message Content Intent

### 1-3. OAuth2 URL を生成してサーバーに招待する

1. 左メニューの **OAuth2** → **URL Generator**
2. **Scopes** で以下にチェック
   - `bot`
   - `applications.commands`
3. **Bot Permissions** で以下にチェック
   - Send Messages
   - Send Messages in Threads
   - Embed Links
   - Attach Files
   - Read Message History
   - Use Slash Commands
   - Manage Messages（パネル更新時に必要）
4. 画面下部に生成された URL をコピーしてブラウザで開く
5. 招待先のサーバーを選択して **認証**

### 1-4. Client ID を確認する

1. 左メニューの **General Information**
2. **Application ID** をコピー  
   → これが `DISCORD_CLIENT_ID` になります

---

## Step 2 — Notion インテグレーションの作成

### 2-1. インテグレーションを作成する

1. [Notion Integrations](https://www.notion.so/my-integrations) を開く
2. **+ New integration** をクリック
3. 設定を入力
   - Name: `Discordion`（任意）
   - Associated workspace: 連携したいワークスペースを選択
   - Type: **Internal**
4. **Submit**
5. 表示された **Internal Integration Secret** をコピー  
   → これが `NOTION_TOKEN` になります（`secret_` で始まる文字列）

### 2-2. Notion ページをインテグレーションと共有する

通知やコマンドで使いたい **データベースまたはページ** を Discordion に共有する必要があります。

1. Notion で対象のページ / データベースを開く
2. 右上の **…** → **Connections** → **Connect to**
3. 作成した `Discordion` インテグレーションを選択

> **注意:** インテグレーションが共有されていないページは取得できません。  
> データベースを共有すると、その配下のページも自動的にアクセス可能になります。

---

## Step 3 — リポジトリのセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/nmt3325/discordion.git
cd discordion

# 依存パッケージをインストール
npm install
```

### 環境変数を設定する

`.env.example` をコピーして `.env` を作成します。

```bash
cp .env.example .env
```

`.env` を編集して値を入力します。

```env
# Discord Bot Token（Step 1-2 で取得）
DISCORD_TOKEN=your_discord_bot_token_here

# Discord Application ID（Step 1-4 で取得）
DISCORD_CLIENT_ID=your_discord_client_id_here

# Notion Integration Token（Step 2-1 で取得、省略可）
# 省略した場合は /setup コマンドでサーバーごとに設定
NOTION_TOKEN=secret_your_notion_integration_token_here

# 設定ファイルの保存先（デフォルト: ./data）
DATA_DIR=./data

# 通知ポーリング間隔（秒、デフォルト: 60）
POLL_INTERVAL_SECONDS=60
```

---

## Step 4 — スラッシュコマンドの登録

Bot をサーバーに招待した後、Discord にスラッシュコマンドを登録します。

```bash
npm run deploy-commands
```

成功すると以下のように表示されます。

```
[Deploy] Registering 11 global slash commands...
[Deploy] ✅ Commands registered successfully!
Commands registered:
  /setup — Connect your Notion workspace to this Discord server
  /find — Search Notion pages by title
  /create-page — Create a new Notion page from Discord
  ...
```

> **注意:** グローバルコマンドの反映には最大 **1 時間** かかる場合があります。  
> 特定サーバーだけに即時反映したい場合は `deploy-commands.ts` の `Routes.applicationCommands(clientId)` を  
> `Routes.applicationGuildCommands(clientId, 'YOUR_GUILD_ID')` に変更してください。

---

## Step 5 — Bot を起動する

### 開発環境（ts-node で直接実行）

```bash
npm run dev
```

### 本番環境（ビルド後に実行）

```bash
npm run build
npm start
```

起動すると以下のようなログが表示されます。

```
[Bot] Logged in as Discordion#1234
[Bot] Serving 1 guild(s)
[Notifications] Starting poller (interval: 60s)
[Scheduler] Starting scheduled summary service
```

---

## Step 6 — Notion を接続する

Bot が起動したら、Discord サーバーで以下のコマンドを実行して Notion ワークスペースを接続します。

```
/setup token:secret_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

成功すると「✅ Notion Connected」と表示され、各種コマンドが使えるようになります。

> `NOTION_TOKEN` を `.env` に設定済みの場合もこのコマンドを実行することでサーバーごとに別のトークンを設定できます。

---

## 使い方

### Notion の変更を Discord に通知する

```
/notification add name:タスク更新 source:database source_id:<データベースID> channel:#通知チャンネル
```

- `source`: `all_pages`（全ページ）/ `database`（データベース）/ `selected_pages`（特定ページ）
- `delivery`: `realtime`（即時）/ `digest_daily`（日次）/ `digest_weekly`（週次）/ `digest_hourly`（毎時）
- Notion の変更は最大 **1〜5 分** 以内に検知されます

ルールの一覧・削除・有効/無効切り替え：

```
/notification list
/notification remove id:<ルールID>
/notification toggle id:<ルールID>
```

### Discord から Notion ページを作成する

まず作成コマンドを設定します（データベース ID が必要）。

```
/create-command add name:バグ報告 destination:database destination_id:<データベースID>
```

設定後、以下で使用できます。

```
/create-page
```

フォームが表示され、入力内容が Notion ページとして保存されます。

### Notion データベースを Discord で閲覧する

```
/page-list add name:タスク一覧 source:database source_id:<データベースID>
```

設定後：

```
/pages
```

### チャンネルにボタンメニューを設置する（パネル）

```
/panel create name:チームハブ title:チームハブ description:下のボタンから操作してください
/panel list
/panel publish id:<パネルID> channel:#general
```

パネルのボタン設定は `data/guilds/<サーバーID>.json` の `buttons` 配列を直接編集して `/panel publish` で再公開します。

```json
"buttons": [
  {
    "id": "btn1",
    "label": "バグ報告",
    "style": "danger",
    "actionType": "create",
    "targetId": "<create-command の id>"
  },
  {
    "id": "btn2",
    "label": "タスク一覧",
    "style": "primary",
    "actionType": "list",
    "targetId": "<page-list の id>"
  }
]
```

### スケジュールサマリーを設定する

```
/summary add name:毎朝タスク確認 database_id:<データベースID> channel:#daily frequency:daily time:09:00
```

- `time` は `HH:MM`（UTC 24時間表記）
- 手動実行: `/summary run id:<サマリーID>`

### Notion ページを検索する

```
/find query:プロジェクトコードまたはキーワード
```

ページタイトルのみ検索対象です（本文・プロパティ値は対象外）。

### データベース ID の確認方法

Notion でデータベースを開き、URL を確認します。

```
https://www.notion.so/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...
                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                      これが データベース ID（32文字）
```

ハイフン区切りの形式（`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）でも使用できます。

---

## 本番環境へのデプロイ

### PM2 を使う場合

```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name discordion
pm2 save
pm2 startup
```

### systemd を使う場合

`/etc/systemd/system/discordion.service` を作成します。

```ini
[Unit]
Description=Discordion Discord Bot
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/discordion
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
EnvironmentFile=/path/to/discordion/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable discordion
sudo systemctl start discordion
sudo systemctl status discordion
```

### Docker を使う場合

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
VOLUME /app/data
CMD ["node", "dist/index.js"]
```

```bash
npm run build
docker build -t discordion .
docker run -d \
  --name discordion \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  discordion
```

---

## 設定ファイルの構造

各サーバーの設定は `data/guilds/<サーバーID>.json` に保存されます。

```json
{
  "guildId": "123456789",
  "notionToken": "secret_...",
  "notionWorkspaceName": "My Workspace",
  "notificationRules": [...],
  "createCommands": [...],
  "pageLists": [...],
  "panels": [...],
  "scheduledSummaries": [...]
}
```

---

## トラブルシューティング

**コマンドが表示されない**  
→ `npm run deploy-commands` を実行済みか確認。グローバルコマンドは反映まで最大 1 時間かかります。

**`/setup` でエラーになる**  
→ Notion インテグレーションのシークレットが `secret_` で始まるか確認。対象ページにインテグレーションが共有されているか確認。

**通知が届かない**  
→ `/notification list` でルールが enabled になっているか確認。Bot がチャンネルへの送信権限を持っているか確認。Notion のページがインテグレーションと共有されているか確認。

**ページが見つからない**  
→ Notion の **Connections** からインテグレーションを追加してください。インテグレーションが共有されていないページは取得できません。
