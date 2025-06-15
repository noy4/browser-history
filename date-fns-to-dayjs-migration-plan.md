# date-fns → dayjs 移行プラン（統一エクスポート版）

## 🎯 移行目標
- **主要目標**: バンドルサイズ削減のためdate-fnsを完全除去
- **方針**: `src/dayjs.ts`から統一的にdayjsをエクスポートし、将来の拡張性を確保
- **プラグイン**: 現在は不要、必要に応じて後から追加可能

## 📊 現状分析

### 使用中のdate-fns関数
| ファイル | 使用関数 | 行番号 | 用途 |
|---------|----------|--------|------|
| [`src/setting.ts`](src/setting.ts:3) | `format`, `startOfToday` | 3, 98, 163 | 日付フォーマット、今日の開始時刻 |
| [`src/browser-history.ts`](src/browser-history.ts:3) | `addDays`, `differenceInDays`, `format`, `startOfDay`, `startOfToday`, `subDays` | 3, 44-58, 75, 89, 99 | 日付演算、フォーマット |

### バンドルサイズ比較
- **date-fns v4.1.0**: ~200KB
- **dayjs**: ~2.8KB（コアのみ）
- **推定削減**: ~197KB（98.6%削減）

## 🔄 新しいアーキテクチャ

### 統一エクスポート戦略
```
src/dayjs.ts (新規作成)
├── dayjs コアライブラリ
├── 将来的なプラグイン拡張ポイント
└── プロジェクト統一のエクスポート

↓ インポート

src/setting.ts, src/browser-history.ts
└── import { dayjs } from './dayjs'
```

## 🔨 実装プラン

### Step 1: src/dayjs.ts の作成

```typescript
/**
 * 日付操作ライブラリの統一エクスポート
 * プラグインの拡張や設定変更はここで行う
 */
import dayjs from 'dayjs'

// 将来的にプラグインが必要になった場合の追加ポイント
// import utc from 'dayjs/plugin/utc'
// import timezone from 'dayjs/plugin/timezone'
// import customParseFormat from 'dayjs/plugin/customParseFormat'

// プラグインの初期化（現在は不要）
// dayjs.extend(utc)
// dayjs.extend(timezone)
// dayjs.extend(customParseFormat)

// プロジェクト全体で使用する統一設定
// dayjs.locale('ja') // 必要に応じて日本語ロケール

export { dayjs }
```

### Step 2: package.json更新
```json
{
  "dependencies": {
    "dayjs": "^1.11.13",
    "sql.js": "^1.12.0"
  }
}
```
**削除**: `"date-fns": "^4.1.0"`

### Step 3: src/setting.ts 修正

#### インポート文の変更
```typescript
// 修正前
import { format, startOfToday } from 'date-fns'
import dayjs from 'dayjs'

// 修正後
import { dayjs } from './dayjs'
```

#### 具体的な変更箇所

**行98**: データベース接続チェック時の日付フォーマット
```typescript
// 修正前
const oldestDate = data
  ? format(new Date(data.visit_time as number), 'yyyy-MM-dd')
  : ''

// 修正後
const oldestDate = data
  ? dayjs(data.visit_time as number).format('YYYY-MM-DD')
  : ''
```

**行163**: 開始日設定のデフォルト値
```typescript
// 修正前
.setValue(this.plugin.settings.fromDate || format(startOfToday(), 'yyyy-MM-dd'))

// 修正後
.setValue(this.plugin.settings.fromDate || dayjs().startOf('day').format('YYYY-MM-DD'))
```

### Step 4: src/browser-history.ts 修正

#### インポート文の変更
```typescript
// 修正前
import { addDays, differenceInDays, format, startOfDay, startOfToday, subDays } from 'date-fns'
import dayjs from 'dayjs'

// 修正後
import { dayjs } from './dayjs'
```

#### 具体的な変更箇所

**行44**: 今日の日付取得
```typescript
// 修正前
const today = startOfToday()

// 修正後
const today = dayjs().startOf('day').toDate()
```

**行47**: 日付差分計算
```typescript
// 修正前
const dayCount = differenceInDays(today, fromDate) + 1

// 修正後
const dayCount = dayjs(today).diff(fromDate, 'day') + 1
```

**行49**: 日付配列の生成
```typescript
// 修正前
.map((_, i) => subDays(today, i))

// 修正後
.map((_, i) => dayjs(today).subtract(i, 'day').toDate())
```

**行58**: 設定保存時の日付フォーマット
```typescript
// 修正前
this.plugin.settings.fromDate = format(today, 'yyyy-MM-dd')

// 修正後
this.plugin.settings.fromDate = dayjs(today).format('YYYY-MM-DD')
```

**行75**: 日付の開始時刻設定
```typescript
// 修正前
date: startOfDay(new Date()),

// 修正後
date: dayjs().startOf('day').toDate(),
```

**行89**: 翌日の日付計算
```typescript
// 修正前
toDate: addDays(date, 1),

// 修正後
toDate: dayjs(date).add(1, 'day').toDate(),
```

**行99**: 時刻フォーマット
```typescript
// 修正前
const timestamp = format(new Date(v.visit_time as number), 'HH:mm')

// 修正後
const timestamp = dayjs(v.visit_time as number).format('HH:mm')
```

### Step 5: SPEC.local.md 更新
技術スタックの更新：
```markdown
## 技術スタック
- TypeScript
- Obsidian API
- sql.js (SQLite)
- dayjs
```

## 🔄 関数マッピング表

| date-fns関数 | dayjs代替 | 使用箇所 |
|-------------|-----------|---------|
| `format(date, 'yyyy-MM-dd')` | `dayjs(date).format('YYYY-MM-DD')` | setting.ts:98, 163, browser-history.ts:58 |
| `format(date, 'HH:mm')` | `dayjs(date).format('HH:mm')` | browser-history.ts:99 |
| `startOfToday()` | `dayjs().startOf('day').toDate()` | setting.ts:163, browser-history.ts:44 |
| `startOfDay(date)` | `dayjs(date).startOf('day').toDate()` | browser-history.ts:75 |
| `addDays(date, n)` | `dayjs(date).add(n, 'day').toDate()` | browser-history.ts:89 |
| `subDays(date, n)` | `dayjs(date).subtract(n, 'day').toDate()` | browser-history.ts:49 |
| `differenceInDays(date1, date2)` | `dayjs(date1).diff(date2, 'day')` | browser-history.ts:47 |

## 🧪 テスト戦略

### 1. 単体テスト項目
- [ ] 日付フォーマット変換（YYYY-MM-DD, HH:mm）
- [ ] 日付演算（加算、減算、差分計算）
- [ ] 日付の開始時刻取得
- [ ] src/dayjs.ts のエクスポート確認

### 2. 統合テスト項目
- [ ] データベース接続チェック機能
- [ ] ブラウザ履歴同期機能
- [ ] ファイル名生成機能
- [ ] 設定の保存・読み込み

### 3. バンドルサイズ検証
- [ ] ビルド前後のファイルサイズ比較
- [ ] 依存関係の確認（date-fns完全除去）

## ⚠️ 注意点・リスク

### 1. 型の互換性
- **問題**: dayjsはDate型とDayjs型が混在
- **対策**: `.toDate()`で明示的にDate型に変換

### 2. フォーマット文字列の違い
- **date-fns**: `yyyy-MM-dd`
- **dayjs**: `YYYY-MM-DD`
- **対策**: 大文字小文字の統一

### 3. 統一エクスポートのメリット
- **設定の一元化**: プラグインや設定は`src/dayjs.ts`で管理
- **将来の拡張**: 新しいプラグインが必要になっても1ファイルの変更で対応
- **インポートの統一**: プロジェクト全体で一貫したインポート

## 📈 期待効果

### バンドルサイズ削減
- **削減予想**: 約197KB
- **削減率**: 約98.6%

### 保守性向上
- **統一性**: 単一の日付ライブラリ + 統一エクスポート
- **拡張性**: プラグイン追加時の影響範囲を最小化
- **一貫性**: プロジェクト全体で統一されたAPIアクセス

## 🚀 実装手順

### Phase 1: 準備作業
1. [ ] 現在のテストケース実行（ベースライン確立）
2. [ ] バックアップ作成
3. [ ] ブランチ作成 (`feature/migrate-to-dayjs`)

### Phase 2: ファイル作成・更新
4. [ ] `src/dayjs.ts` 作成
5. [ ] `package.json`からdate-fns削除
6. [ ] `npm install`実行

### Phase 3: コード修正
7. [ ] `src/setting.ts`修正（インポート + 3箇所の関数置換）
8. [ ] `src/browser-history.ts`修正（インポート + 5箇所の関数置換）
9. [ ] `SPEC.local.md`更新

### Phase 4: テスト・検証
10. [ ] 単体テスト実行
11. [ ] 統合テスト実行
12. [ ] バンドルサイズ確認
13. [ ] パフォーマンステスト

### Phase 5: 最終化
14. [ ] コードレビュー
15. [ ] ドキュメント更新
16. [ ] マージ・デプロイ

## 📋 チェックリスト

### 移行完了の確認項目
- [ ] `src/dayjs.ts`が作成されている
- [ ] date-fnsのインポート文が全て削除されている
- [ ] 新しいインポート文`import { dayjs } from './dayjs'`に統一されている
- [ ] package.jsonからdate-fnsが削除されている
- [ ] 全ての日付操作がdayjsに置き換えられている（8箇所）
- [ ] ビルドエラーが発生していない
- [ ] 既存機能が正常に動作している
- [ ] バンドルサイズが削減されている

## 🔮 将来の拡張例

### プラグインが必要になった場合の例
```typescript
import timezone from 'dayjs/plugin/timezone'
// src/dayjs.ts に追加するだけ
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

// 他のファイルは変更不要
```

---

この統一エクスポート戦略により、現在はシンプルな移行を実現しながら、将来の拡張性も確保できます。
