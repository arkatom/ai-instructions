# Temporal API

日付・時刻を扱う新しい標準API（Stage 3提案）。

## 基本的な使い方

```javascript
// 現在の日時
const now = Temporal.Now.plainDateTimeISO();
const zonedNow = Temporal.Now.zonedDateTimeISO();

// 特定の日時を作成
const date = Temporal.PlainDate.from('2024-03-15');
const time = Temporal.PlainTime.from('14:30:00');
const dateTime = Temporal.PlainDateTime.from('2024-03-15T14:30:00');

// タイムゾーン付き
const zonedDateTime = Temporal.ZonedDateTime.from({
  timeZone: 'Asia/Tokyo',
  year: 2024,
  month: 3,
  day: 15,
  hour: 14,
  minute: 30
});
```

## 日付計算

```javascript
const today = Temporal.Now.plainDateISO();

// 日付の加算・減算
const tomorrow = today.add({ days: 1 });
const lastWeek = today.subtract({ weeks: 1 });
const nextMonth = today.add({ months: 1 });

// 期間の計算
const start = Temporal.PlainDate.from('2024-01-01');
const end = Temporal.PlainDate.from('2024-12-31');
const duration = start.until(end);
console.log(duration.days); // 365

// 営業日計算
function addBusinessDays(date, days) {
  let current = date;
  let remaining = days;
  
  while (remaining > 0) {
    current = current.add({ days: 1 });
    const dayOfWeek = current.dayOfWeek;
    if (dayOfWeek !== 6 && dayOfWeek !== 7) {
      remaining--;
    }
  }
  return current;
}
```

## タイムゾーン処理

```javascript
// タイムゾーン変換
const tokyo = Temporal.ZonedDateTime.from({
  timeZone: 'Asia/Tokyo',
  year: 2024,
  month: 3,
  day: 15,
  hour: 14
});

const newYork = tokyo.withTimeZone('America/New_York');
console.log(newYork.toString());

// DST（夏時間）対応
const beforeDST = Temporal.ZonedDateTime.from({
  timeZone: 'America/New_York',
  year: 2024,
  month: 3,
  day: 10,
  hour: 1
});

const afterDST = beforeDST.add({ hours: 2 });
console.log(afterDST.hour); // 4（DSTで1時間進む）
```

## フォーマット

```javascript
const dateTime = Temporal.PlainDateTime.from('2024-03-15T14:30:00');

// ISO形式
console.log(dateTime.toString()); // 2024-03-15T14:30:00

// カスタムフォーマット（Intl.DateTimeFormatと組み合わせ）
const formatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});
```