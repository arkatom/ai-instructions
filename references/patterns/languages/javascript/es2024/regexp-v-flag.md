# 正規表現 v flag

Unicode プロパティエスケープの拡張サポート。

## 基本的な使い方

```javascript
// v flag - Unicode Sets記法
const regex = /[\p{Script=Latin}&&\p{Letter}]/v;

// 文字クラスの集合演算
const emojiRegex = /[\p{Emoji}--\p{ASCII}]/v; // 絵文字からASCII除外
const letter = /[\p{Letter}&&\p{Lowercase}]/v; // 小文字のみ

// 文字列プロパティ
const flagEmoji = /\p{RGI_Emoji_Flag_Sequence}/v;
```

## 集合演算

```javascript
// 交差（&&）
const latinLowercase = /[\p{Script=Latin}&&\p{Lowercase}]/v;
console.log('a'.match(latinLowercase)); // マッチ
console.log('A'.match(latinLowercase)); // null

// 差集合（--）
const nonAsciiEmoji = /[\p{Emoji}--\p{ASCII}]/v;
console.log('😊'.match(nonAsciiEmoji)); // マッチ
console.log(':)'.match(nonAsciiEmoji)); // null

// 和集合（暗黙的）
const numberOrLetter = /[\p{Number}\p{Letter}]/v;
```

## 実用例

```javascript
// パスワード検証
function validatePassword(password) {
  const hasLowercase = /[\p{Lowercase}]/v.test(password);
  const hasUppercase = /[\p{Uppercase}]/v.test(password);
  const hasNumber = /[\p{Number}]/v.test(password);
  const hasSpecial = /[^\p{Letter}\p{Number}]/v.test(password);
  
  return hasLowercase && hasUppercase && hasNumber && hasSpecial;
}

// 国際化対応の名前検証
function validateName(name) {
  // 文字と一部の記号のみ許可
  const namePattern = /^[\p{Letter}\p{Mark}\s'-]+$/v;
  return namePattern.test(name);
}

// 絵文字フィルタリング
function removeEmojis(text) {
  return text.replace(/\p{Emoji}/gv, '');
}
```