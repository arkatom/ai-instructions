# Pydantic v2 高度なバリデーションパターン

## 🔄 動的バリデーション

```python
# validators/custom_validators.py
from pydantic import field_validator, ValidationInfo
from typing import Any, Dict, List, Optional, Union
import re
import requests
from datetime import datetime, timezone
import hashlib


class DynamicValidator:
    """動的バリデーション"""
    
    @staticmethod
    def create_enum_validator(allowed_values: List[str], case_sensitive: bool = True):
        """動的Enumバリデーター作成"""
        def validator(v: str) -> str:
            if not case_sensitive:
                v = v.lower()
                allowed_values_lower = [val.lower() for val in allowed_values]
                if v not in allowed_values_lower:
                    raise ValueError(f"値は {allowed_values} のいずれかである必要があります")
                # 元の値を返す
                return next(val for val in allowed_values if val.lower() == v)
            else:
                if v not in allowed_values:
                    raise ValueError(f"値は {allowed_values} のいずれかである必要があります")
                return v
        return validator
    
    @staticmethod
    def create_regex_validator(pattern: str, message: str):
        """動的正規表現バリデーター作成"""
        compiled_pattern = re.compile(pattern)
        
        def validator(v: str) -> str:
            if not compiled_pattern.match(v):
                raise ValueError(message)
            return v
        return validator
    
    @staticmethod
    def create_length_validator(min_length: int, max_length: int):
        """動的長さバリデーター作成"""
        def validator(v: Union[str, List]) -> Union[str, List]:
            length = len(v)
            if length < min_length:
                raise ValueError(f"長さは{min_length}以上である必要があります")
            if length > max_length:
                raise ValueError(f"長さは{max_length}以下である必要があります")
            return v
        return validator
```

## 💼 ビジネスルールバリデーション

```python
class BusinessRuleValidator:
    """ビジネスルールバリデーション"""
    
    @staticmethod
    def validate_credit_card(card_number: str) -> str:
        """クレジットカード番号バリデーション（Luhnアルゴリズム）"""
        # 数字以外を除去
        card_number = re.sub(r"\D", "", card_number)
        
        if not card_number:
            raise ValueError("カード番号が必要です")
        
        # Luhnアルゴリズムチェック
        def luhn_check(card_num: str) -> bool:
            digits = [int(d) for d in card_num]
            checksum = 0
            
            # 右から2番目の桁から開始
            for i in range(len(digits) - 2, -1, -1):
                if (len(digits) - i) % 2 == 0:  # 偶数位置
                    digits[i] *= 2
                    if digits[i] > 9:
                        digits[i] -= 9
                checksum += digits[i]
            
            return (checksum + digits[-1]) % 10 == 0
        
        if not luhn_check(card_number):
            raise ValueError("無効なクレジットカード番号です")
        
        # カードタイプ判定
        if card_number.startswith("4"):
            card_type = "Visa"
        elif card_number.startswith(("51", "52", "53", "54", "55")):
            card_type = "MasterCard"
        elif card_number.startswith(("34", "37")):
            card_type = "American Express"
        else:
            card_type = "Unknown"
        
        return card_number
    
    @staticmethod
    def validate_japanese_postal_code(postal_code: str) -> str:
        """日本の郵便番号バリデーション"""
        # ハイフン除去
        postal_code = postal_code.replace("-", "")
        
        if not re.match(r"^\d{7}$", postal_code):
            raise ValueError("郵便番号は7桁の数字である必要があります")
        
        # フォーマット整形
        return f"{postal_code[:3]}-{postal_code[3:]}"
    
    @staticmethod
    def validate_japanese_residence_card(card_number: str) -> str:
        """在留カード番号バリデーション"""
        # 在留カード番号のパターン
        if not re.match(r"^[A-Z]{2}\d{8}$", card_number):
            raise ValueError("在留カード番号は2文字のアルファベット + 8桁の数字である必要があります")
        
        return card_number
    
    @staticmethod
    def validate_isbn(isbn: str) -> str:
        """ISBN-10/ISBN-13バリデーション"""
        # ハイフン除去
        isbn_clean = isbn.replace("-", "").replace(" ", "")
        
        if len(isbn_clean) == 10:
            # ISBN-10
            if not isbn_clean[:-1].isdigit() or (isbn_clean[-1] not in "0123456789X"):
                raise ValueError("無効なISBN-10形式です")
            
            # チェックディジット検証
            check_sum = sum((i + 1) * int(d) for i, d in enumerate(isbn_clean[:-1]))
            check_digit = check_sum % 11
            expected = "X" if check_digit == 10 else str(check_digit)
            
            if isbn_clean[-1] != expected:
                raise ValueError("ISBN-10のチェックディジットが無効です")
                
        elif len(isbn_clean) == 13:
            # ISBN-13
            if not isbn_clean.isdigit():
                raise ValueError("無効なISBN-13形式です")
            
            # チェックディジット検証
            check_sum = sum(
                int(d) * (3 if i % 2 else 1) 
                for i, d in enumerate(isbn_clean[:-1])
            )
            check_digit = (10 - (check_sum % 10)) % 10
            
            if int(isbn_clean[-1]) != check_digit:
                raise ValueError("ISBN-13のチェックディジットが無効です")
        else:
            raise ValueError("ISBNは10桁または13桁である必要があります")
        
        return isbn_clean
```

## 🌐 外部APIバリデーション

```python
class ExternalValidator:
    """外部APIを使用したバリデーション"""
    
    @staticmethod
    async def validate_email_deliverability(email: str) -> str:
        """メール到達可能性チェック（外部API使用）"""
        # 実際の実装では外部のメール検証APIを使用
        # ここではモック実装
        domain = email.split("@")[1]
        
        # 一般的な無効ドメインをチェック
        invalid_domains = ["test.com", "example.com", "invalid.com"]
        if domain in invalid_domains:
            raise ValueError("無効なメールドメインです")
        
        return email
    
    @staticmethod
    async def validate_address(address: str, country: str = "JP") -> Dict[str, Any]:
        """住所バリデーション（地理情報API使用）"""
        # 実際の実装では Google Geocoding API などを使用
        # ここではモック実装
        
        if len(address) < 5:
            raise ValueError("住所が短すぎます")
        
        # モック地理情報
        return {
            "formatted_address": address,
            "latitude": 35.6762,
            "longitude": 139.6503,
            "country": country,
            "validated": True
        }
    
    @staticmethod
    async def validate_bank_account(
        account_number: str,
        bank_code: str,
        branch_code: str
    ) -> Dict[str, Any]:
        """銀行口座バリデーション"""
        # 実際の実装では全銀協APIなどを使用
        
        # 銀行コード検証（4桁）
        if not re.match(r"^\d{4}$", bank_code):
            raise ValueError("銀行コードは4桁の数字である必要があります")
        
        # 支店コード検証（3桁）
        if not re.match(r"^\d{3}$", branch_code):
            raise ValueError("支店コードは3桁の数字である必要があります")
        
        # 口座番号検証（7桁）
        if not re.match(r"^\d{7}$", account_number):
            raise ValueError("口座番号は7桁の数字である必要があります")
        
        return {
            "bank_code": bank_code,
            "branch_code": branch_code,
            "account_number": account_number,
            "validated": True
        }
```

## 🔍 条件付きバリデーション

```python
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, Union

class ConditionalValidationModel(BaseModel):
    """条件付きバリデーションモデル"""
    
    validation_type: str = Field(description="バリデーションタイプ")
    value: Union[str, int, float] = Field(description="値")
    options: Optional[Dict[str, Any]] = None
    
    @model_validator(mode="after")
    def validate_based_on_type(self) -> "ConditionalValidationModel":
        """タイプに基づくバリデーション"""
        
        if self.validation_type == "email":
            # メールバリデーション
            if not isinstance(self.value, str):
                raise ValueError("メールは文字列である必要があります")
            if "@" not in self.value:
                raise ValueError("有効なメールアドレスではありません")
                
        elif self.validation_type == "number":
            # 数値バリデーション
            if not isinstance(self.value, (int, float)):
                raise ValueError("数値である必要があります")
            
            # オプションに基づく範囲チェック
            if self.options:
                min_val = self.options.get("min")
                max_val = self.options.get("max")
                
                if min_val is not None and self.value < min_val:
                    raise ValueError(f"値は{min_val}以上である必要があります")
                if max_val is not None and self.value > max_val:
                    raise ValueError(f"値は{max_val}以下である必要があります")
                    
        elif self.validation_type == "custom":
            # カスタムバリデーション
            if self.options and "pattern" in self.options:
                pattern = self.options["pattern"]
                if not re.match(pattern, str(self.value)):
                    raise ValueError(f"パターン {pattern} に一致しません")
        
        return self
```

## 💡 バリデーションのベストプラクティス

1. **段階的バリデーション**: 簡単なチェックから複雑なチェックへ
2. **エラーメッセージの明確化**: ユーザーが理解しやすいメッセージ
3. **パフォーマンス考慮**: 外部API呼び出しは必要最小限に
4. **再利用性**: 共通バリデーターは関数として分離
5. **テスタビリティ**: モック可能な設計

## 🚀 実装例

```python
# 動的バリデーターの使用
status_validator = DynamicValidator.create_enum_validator(
    ["pending", "active", "completed"],
    case_sensitive=False
)

# ビジネスルールの適用
card_number = BusinessRuleValidator.validate_credit_card("4111111111111111")
postal_code = BusinessRuleValidator.validate_japanese_postal_code("1500001")

# 条件付きバリデーション
model = ConditionalValidationModel(
    validation_type="number",
    value=50,
    options={"min": 0, "max": 100}
)
```