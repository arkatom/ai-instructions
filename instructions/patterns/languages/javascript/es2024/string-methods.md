# 文字列メソッド

ES2024で追加された文字列処理の新メソッド。

## isWellFormed() - 整形式判定

```javascript
// 不正なサロゲートペアを検出
const valid = "Hello 😊";
const invalid = "\uD800"; // 単独のサロゲート

console.log(valid.isWellFormed());   // true
console.log(invalid.isWellFormed()); // false

// URLエンコーディング前のチェック
function safeEncodeURI(str) {
  if (!str.isWellFormed()) {
    console.warn('Invalid Unicode detected');
    str = str.toWellFormed();
  }
  return encodeURIComponent(str);
}
```

## toWellFormed() - 整形式変換

```javascript
// 不正なUnicodeを置換文字(U+FFFD)に変換
const malformed = "Hello\uD800World";
const wellFormed = malformed.toWellFormed();
console.log(wellFormed); // "Hello�World"

// データサニタイゼーション
function sanitizeUserInput(input) {
  return input
    .toWellFormed()
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, ''); // 制御文字削除
}
```

## 実用パターン

```javascript
// JSONデータの安全な処理
class SafeJSONHandler {
  static stringify(obj) {
    const replacer = (key, value) => {
      if (typeof value === 'string') {
        return value.toWellFormed();
      }
      return value;
    };
    return JSON.stringify(obj, replacer);
  }

  static parse(json) {
    const parsed = JSON.parse(json);
    return this.sanitizeStrings(parsed);
  }

  static sanitizeStrings(obj) {
    if (typeof obj === 'string') {
      return obj.toWellFormed();
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeStrings(item));
    }
    if (obj && typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [
          key,
          this.sanitizeStrings(value)
        ])
      );
    }
    return obj;
  }
}
```

## データベース保存前の検証

```javascript
async function saveToDatabase(text) {
  // Unicode正規化と検証
  if (!text.isWellFormed()) {
    throw new Error('Invalid Unicode in input');
  }
  
  const normalized = text.normalize('NFC');
  const sanitized = normalized.toWellFormed();
  
  await db.save({
    content: sanitized,
    isValid: sanitized.isWellFormed()
  });
}
```