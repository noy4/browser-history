# date-fns → dayjs 移行フロー図

## 📊 移行プロセス全体図

```mermaid
graph TD
    A[現状分析] --> B[依存関係確認]
    B --> C[移行戦略策定]
    C --> D[実装計画]
    D --> E[Phase 1: 準備]
    E --> F[Phase 2: 依存関係更新]
    F --> G[Phase 3: コード修正]
    G --> H[Phase 4: テスト・検証]
    H --> I[Phase 5: 最終化]
    
    E --> E1[テストケース実行]
    E --> E2[バックアップ作成]
    E --> E3[ブランチ作成]
    
    F --> F1[package.json修正]
    F --> F2[npm install]
    F --> F3[依存関係確認]
    
    G --> G1[setting.ts修正]
    G --> G2[browser-history.ts修正]
    G --> G3[SPEC.md更新]
    
    H --> H1[単体テスト]
    H --> H2[統合テスト]
    H --> H3[サイズ確認]
    
    I --> I1[コードレビュー]
    I --> I2[ドキュメント更新]
    I --> I3[マージ・デプロイ]
```

## 🔄 関数マッピング図

```mermaid
graph LR
    subgraph "date-fns (削除対象)"
        A1[format]
        A2[startOfToday]
        A3[startOfDay]
        A4[addDays]
        A5[subDays]
        A6[differenceInDays]
    end
    
    subgraph "dayjs (移行先)"
        B1[dayjs().format]
        B2[dayjs().startOf]
        B3[dayjs().startOf]
        B4[dayjs().add]
        B5[dayjs().subtract]
        B6[dayjs().diff]
    end
    
    A1 --> B1
    A2 --> B2
    A3 --> B3
    A4 --> B4
    A5 --> B5
    A6 --> B6
```

## 📁 ファイル修正フロー

```mermaid
sequenceDiagram
    participant P as package.json
    participant S as setting.ts
    participant B as browser-history.ts
    participant D as SPEC.md
    
    Note over P: 1. 依存関係更新
    P->>P: date-fns削除
    
    Note over S: 2. setting.ts修正
    S->>S: インポート変更
    S->>S: format関数置換(行98)
    S->>S: startOfToday置換(行163)
    
    Note over B: 3. browser-history.ts修正
    B->>B: インポート変更
    B->>B: 6つの関数置換
    B->>B: 型変換追加(.toDate())
    
    Note over D: 4. ドキュメント更新
    D->>D: 技術スタック更新
```

## ⚠️ リスク管理フロー

```mermaid
flowchart TD
    A[移行開始] --> B{型の互換性問題?}
    B -->|Yes| C[.toDate()追加]
    B -->|No| D{フォーマット文字列エラー?}
    
    C --> D
    D -->|Yes| E[yyyy→YYYY変更]
    D -->|No| F{タイムゾーン問題?}
    
    E --> F
    F -->|Yes| G[UTCプラグイン追加]
    F -->|No| H{パフォーマンス問題?}
    
    G --> H
    H -->|Yes| I[ベンチマーク実行]
    H -->|No| J[移行完了]
    
    I --> K{許容範囲内?}
    K -->|Yes| J
    K -->|No| L[最適化実装]
    L --> J
```

## 🧪 テスト戦略フロー

```mermaid
graph TD
    A[テスト開始] --> B[単体テスト]
    B --> B1[日付フォーマット]
    B --> B2[日付演算]
    B --> B3[開始時刻取得]
    
    B1 --> C[統合テスト]
    B2 --> C
    B3 --> C
    
    C --> C1[DB接続チェック]
    C --> C2[履歴同期]
    C --> C3[ファイル生成]
    
    C1 --> D[バンドルサイズ検証]
    C2 --> D
    C3 --> D
    
    D --> E{全テストPASS?}
    E -->|No| F[問題修正]
    F --> B
    E -->|Yes| G[移行完了]
```

## 📊 バンドルサイズ比較

```mermaid
xychart-v2
    title "バンドルサイズ比較 (KB)"
    x-axis [現在, 移行後]
    y-axis "サイズ (KB)" 0 --> 250
    bar [230, 60]
```

## 🎯 期待効果サマリー

```mermaid
pie title バンドルサイズ削減効果
    "削減分" : 170
    "残存分" : 60
```

---

この図を参考に移行を進めることで、視覚的に進捗を確認しながら安全に移行を完了できます。
