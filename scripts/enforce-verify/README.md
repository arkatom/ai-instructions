# Enforce Verify - Git検証強制システム

## 概要

`--no-verify` フラグの使用を完全にブロックし、品質チェックを強制するシステムです。
テストやリントなどの検証プロセスをスキップすることを防ぎます。

## なぜ必要か

- テストやリントは品質を保証する最後の砦
- `--no-verify` はこれらのチェックを無効化してしまう
- 「チェックを設定した意味を無に帰す行為」を防ぐ
- 品質とプロセスを守ることが、結果的に最も効率的

## セットアップ

### 方法1: スクリプトを直接実行（推奨）

```bash
# セットアップ
./scripts/enforce-verify/setup.sh

# 解除
./scripts/enforce-verify/uninstall.sh
```

### 方法2: 手動セットアップ

`.zshrc` または `.bashrc` に以下を追加：

```bash
# Enforce Verify - Git検証強制システム
alias git='/path/to/project/scripts/enforce-verify/enforce-verify.sh'
```

## 動作確認

```bash
# これらのコマンドはブロックされます
git commit --no-verify -m "test"
git push --no-verify origin main
git commit -n -m "test"  # -n は --no-verify の短縮形

# 正常なコマンドは通常通り動作
git commit -m "test"
git push origin main
```

## システムの理念

> 品質チェックは必要だから設定されている。
> それをスキップすることは、チームの信頼と成果物の価値を損なう。
> 少しの時間を節約するために、大きなリスクを取るべきではない。

## トラブルシューティング

### セットアップが反映されない場合

```bash
# シェルを再起動
source ~/.zshrc  # または source ~/.bashrc

# エイリアスの確認
alias | grep git
```

### 一時的に無効化したい場合

```bash
# エイリアスを一時的に無効化
\git commit --no-verify -m "emergency fix"

# または
command git commit --no-verify -m "emergency fix"
```

⚠️ **注意**: 上記の方法は緊急時のみに使用し、通常は適切なテストとレビューを行ってください。
