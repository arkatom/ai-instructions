# Microservices - Service Discovery サーバーサイド実装

> API Gateway統合、Kubernetes統合、DNS-based Discoveryの完全ガイド

## 概要

サーバーサイドService Discoveryは、API GatewayやKubernetesなどのインフラストラクチャレベルでサービス発見を管理する方式です。クライアントはサービス発見の詳細を知る必要がなく、より透明性の高いアーキテクチャを実現できます。

## 実装パターン

### 🌐 API Gateway統合
クライアントからの全リクエストをAPI Gatewayが受け付け、内部でサービス発見とロードバランシングを行う

1. **[Service Discovery API Gateway統合](./04b1-service-discovery-gateway.md)** - API Gateway統合パターン
   - Gateway Service Registry実装
   - Request Routing Middleware
   - 認証・認可・レート制限統合
   - メトリクス収集とログ記録

### ☸️ Kubernetes統合
Kubernetesのネイティブ機能（Service、Endpoints）とIstio Service Meshを活用

2. **[Service Discovery Kubernetes統合](./04b2-service-discovery-k8s.md)** - Kubernetes統合パターン
   - Kubernetes Native Service Discovery実装
   - Istio Service Mesh統合（DestinationRule、VirtualService）
   - HeadlessServiceとStatefulSet連携
   - Pod変更の動的監視機能

### 🌍 DNS-based Discovery
標準DNSプロトコル（SRVレコード）を活用した軽量なサービス発見

3. **[Service Discovery DNS-based](./04b3-service-discovery-dns.md)** - DNS-based Discovery
   - DNS SRVレコードベース実装
   - 動的DNS更新機能（nsupdate）
   - TXTレコードでのメタデータ管理
   - キャッシュ機能と重み付き選択

## アーキテクチャ比較

| 方式 | 複雑度 | パフォーマンス | 可用性 | 運用コスト |
|------|--------|----------------|--------|------------|
| **API Gateway** | 中 | 高 | 高 | 中 |
| **Kubernetes** | 低 | 高 | 高 | 低 |
| **DNS-based** | 低 | 中 | 中 | 低 |

## 推奨使用シナリオ

### API Gateway統合
- マルチクラウド/ハイブリッド環境
- 認証・認可の統一管理が必要
- リクエスト変換・レート制限が必要
- 詳細なメトリクス・ログが必要

### Kubernetes統合
- Kubernetes環境での運用
- Service Meshの高度な機能が必要
- プラットフォーム統合を優先
- 運用コストを最小化したい

### DNS-based Discovery
- レガシーシステムとの統合
- 軽量でシンプルな実装が必要
- 既存DNSインフラの活用
- ベンダーロックインの回避

## 関連ファイル

- **[Service Discovery基礎](./04-service-discovery-basics.md)** - 基本概念とクライアントサイド実装
- **[Service Discoveryパターン](./04a-service-discovery-patterns.md)** - 高度なロードバランシングとヘルスチェック
- **[Service Discoveryモニタリング](./04c-service-discovery-monitoring.md)** - 運用とベストプラクティス

## 実装チェックリスト

### API Gateway統合
- [ ] Gateway Service Registry実装
- [ ] Request Routing Middleware設定
- [ ] ヘルスチェック統合
- [ ] 認証・認可機能
- [ ] レート制限機能
- [ ] メトリクス・ログ収集

### Kubernetes統合
- [ ] Service/Endpoints設定
- [ ] Kubernetes API統合
- [ ] Istio DestinationRule設定
- [ ] VirtualService設定
- [ ] 動的監視機能
- [ ] Pod変更イベント処理

### DNS-based Discovery
- [ ] SRVレコード解決
- [ ] 動的DNS更新機能
- [ ] TXTレコードメタデータ
- [ ] キャッシュ機能
- [ ] 重み付き選択ロジック
- [ ] TSIG認証設定

サーバーサイドService Discoveryの適切な実装により、インフラストラクチャレベルでの透明性の高いサービス管理とクライアントの複雑性軽減を実現できます。