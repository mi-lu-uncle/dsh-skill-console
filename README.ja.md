# @mi-lu-uncle/dsh-skill-console

[English](README.md) | [简体中文](README.zh-CN.md) | 日本語

DeepSeek Harness（DSH）向けの**コミュニティプラグイン**。**ビジュアルな Skills パネル**と**コマンドラインのスキル管理**を両方提供します：

- **Settings → Skills パネル** — DSH の全量検出と統合されたスキル一覧：管理下の `~/.dsh/skills`（リポジトリミラー + ローカルスキル；名前 · 呼び出し方法 · ソース · パス）に、同梱スキルやプロジェクトスコープのスキル（読み取り専用表示）を併記、検索対応
- **`/skills`** — スキルの一覧表示（名前 · 呼び出し方法 · ソースリポジトリ）、キーワードフィルタ対応
- **`/skills-uninstall <名前>`** — インストール済みスキルの削除
- **`/skills-update [リポジトリ名]`** — ミラーを pull してリンクを再同期（デフォルト `mattpocock-skills`）
- **`/skills-doctor`** — 構造チェック：死んだリンク、不正な frontmatter、孤立ミラー

CC Switch でスキルを一元管理する場合は `managementMode: cc-switch` を設定します。このモードは一覧・検索・`/skills` のみを残し、インストール、更新、削除、診断の操作を非表示にして旧管理 API も拒否します。デフォルトの `standalone` モードでは従来の管理機能を利用できます。

## なぜ作ったか

DSH のスキル（`@deepseek-ai/dsh-skill-filesystem` が検出する `SKILL.md` バンドル）には UI がありません。このプラグインはその穴を両面から埋めます：閲覧用の Settings パネル（client 側）と、読み書き用の `/` コマンド（host 側）です。書き込みコマンドは `~/.dsh/skills` のシンボリックリンク構成を対象に動作し（`git pull` + 突き合わせ同期）、その後 DSH の watcher が結果をホットリロードします。

## インストール

GitHub リポジトリからのインストールを推奨します：

```sh
dsh plugin --profile desktop add https://github.com/mi-lu-uncle/dsh-skill-console.git
```

ローカルパスや tarball でも可能です：

```sh
dsh plugin --profile desktop add /absolute/path/to/dsh-skill-console
dsh plugin --profile desktop add ./dsh-skill-console-1.0.0.tgz
```

注意：`link:` 方式でインストールしたプラグインは HMR 監視の対象外のため、`lib/index.js` や `lib/client.js` を編集した後はアプリの再起動が必要です。

## 使い方

```
/skills                    # このセッションの全スキルを一覧
/skills docx               # キーワードでフィルタ（名前・説明・whenToUse）
/skills-uninstall pr       # `pr` スキルを削除
/skills-update             # mattpocock-skills ミラーを更新（デフォルト）
/skills-update my-repo     # 別のリポジトリミラーを更新
/skills-doctor             # 構造チェック
```

パネルは**メインサイドバー**（Plugins の隣の Skills アイコン）と **Settings → Skills** の両方にあります。検索中心の管理コンソールで、中央に大きな検索バー、その下に全幅のカードギャラリーを配置し、フィルタ（ソース / 呼び出し方法 / 並び順）は **Filter** ボタンの後ろのスライドアウトパネルにあります。カードをクリックするとスライドオーバーの詳細ドロワーが開き、説明・呼び出し方法・ソース・パス、`/名前` コマンドのコピーボタン、**削除（uninstall）**ボタンが表示されます（管理下のスキルのみ——同梱・プロジェクトのスキルは読み取り専用）。ヘッダーからはスキルの**インストール**（git URL またはローカルパス：プレビュー → 選択 → リンク）、`~/.dsh/repos` 配下の全ミラーを一括**更新**（プレビュー・インストール・更新の三所でミラー内の除外ディレクトリの基準を統一）、**ヘルスチェック**が実行できます。同じ操作は `/skills-uninstall`、`/skills-update`、`/skills-doctor` としても存在します。

`/skills` の各行は `- /名前 [呼び出し · ソース:リポジトリ] — 説明` の形式です：

- **呼び出し** — `モデル+ユーザー` / `モデルのみ` / `ユーザーのみ` / `無効`
- **ソース** — シンボリックリンクが解決されるリポジトリミラー（例：`mattpocock-skills`）、またはリポジトリ外スキルの検出元ラベル（`内蔵`、`DSHユーザー`、`プロジェクト` など）

## 設定

管理対象ディレクトリを上書きしたい場合は、プロファイルパッチ（`cordis.patch.yml`）の `skill-console` 行で指定します：

```yaml
- id: skill-console
  config:
    skillsDir: /Users/you/.dsh/skills            # デフォルト
    reposDir: /Users/you/.dsh/repos              # デフォルト
    managementMode: cc-switch                    # 任意；デフォルト standalone
```

## 配布

主なチャネルはこの GitHub リポジトリ（上記の git URL でインストール）。npm への公開は任意です。公開する場合、スコープ付き名前には `--access public` が必要です：

```sh
npm login
npm publish --access public
```

実際の判定に使われるのは、プラグインが宣言した **`@deepseek-ai/dsh-*` の peer 範囲**です（実行中の DSH バージョンと semver で比較、プレリリースも含む）。peer を特定バージョン（`0.2.0-rc.2`）に固定すると、アプリが `0.2.1-rc.2` に上がった瞬間に「非互換」と判定されます。peer は `^0.2.0-rc.2` に保ち、`dsh.compatibility.dshReleases`（マーケット用の互換表）は新しいリリースを検証したときに追記してください。

## 構成

| ファイル | 役割 |
|---|---|
| `lib/index.js` | Host 側：4 つのコマンド + パネル用の `/api/skill-console/list` ルート |
| `lib/client.js` | Client 側：Settings の「Skills」パネル（React） |
| `cordis.patch.yml` | このパッケージを 1 つの host 行としてマウントするバンドルパッチ |
| `package.json` | npm メタデータ + `dsh.bundle`/`dsh.client`/`dsh.compatibility` |
| `test/smoke.mjs` | `/skills` のオフラインテスト（フェイクサービス使用） |
| `test/manager.test.mjs` | 使い捨て git リモートに対するファイルシステムコマンドのテスト |

## テスト

```sh
node test/smoke.mjs
node test/manager.test.mjs
node test/security-regression.test.mjs
node test/client-update.test.mjs
node test/unified-management.test.mjs
```
