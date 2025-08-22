# Rust メモリ安全性と並行性パターン

## 所有権システムとライフタイム管理

### 基本的な所有権パターン

```rust
use std::collections::HashMap;
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::Duration;

// 所有権の移動と借用を組み合わせた設計
#[derive(Debug, Clone)]
pub struct User {
    pub id: u64,
    pub name: String,
    pub email: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl User {
    pub fn new(id: u64, name: String, email: String) -> Self {
        Self {
            id,
            name,
            email,
            created_at: chrono::Utc::now(),
        }
    }
    
    // 借用を使用してデータを読み取り専用で使用
    pub fn display_info(&self) -> String {
        format!("User: {} ({})", self.name, self.email)
    }
    
    // 可変借用を使用してデータを変更
    pub fn update_email(&mut self, new_email: String) -> Result<(), &'static str> {
        if new_email.contains('@') {
            self.email = new_email;
            Ok(())
        } else {
            Err("Invalid email format")
        }
    }
    
    // 所有権を移動して変換
    pub fn into_summary(self) -> UserSummary {
        UserSummary {
            id: self.id,
            display_name: format!("{} <{}>", self.name, self.email),
            account_age: chrono::Utc::now()
                .signed_duration_since(self.created_at)
                .num_days(),
        }
    }
}

#[derive(Debug)]
pub struct UserSummary {
    pub id: u64,
    pub display_name: String,
    pub account_age: i64,
}

// ライフタイムパラメータを使用した構造体
pub struct UserRepository<'a> {
    connection: &'a DatabaseConnection,
    cache: HashMap<u64, User>,
}

impl<'a> UserRepository<'a> {
    pub fn new(connection: &'a DatabaseConnection) -> Self {
        Self {
            connection,
            cache: HashMap::new(),
        }
    }
    
    // 複数のライフタイムパラメータの使用
    pub fn find_by_email<'b>(&'b mut self, email: &str) -> Option<&'b User>
    where 'a: 'b  // 'a outlives 'b
    {
        // キャッシュから検索し、なければデータベースから取得
        for user in self.cache.values() {
            if user.email == email {
                return Some(user);
            }
        }
        
        // データベースから取得してキャッシュに保存
        if let Ok(user) = self.connection.fetch_user_by_email(email) {
            let id = user.id;
            self.cache.insert(id, user);
            return self.cache.get(&id);
        }
        
        None
    }
}

// 接続のモック実装
pub struct DatabaseConnection;

impl DatabaseConnection {
    pub fn fetch_user_by_email(&self, email: &str) -> Result<User, DatabaseError> {
        // 実際の実装では、データベースクエリを実行
        Ok(User::new(
            1,
            "Test User".to_string(),
            email.to_string(),
        ))
    }
}

#[derive(Debug)]
pub struct DatabaseError;
```

### スマートポインターとメモリ管理

```rust
use std::rc::{Rc, Weak};
use std::sync::{Arc, Mutex, RwLock};
use std::cell::{RefCell, Cell};
use std::collections::VecDeque;

// 参照カウンタベースの循環参照安全なツリー構造
#[derive(Debug)]
pub struct TreeNode {
    pub data: String,
    pub parent: Option<Weak<RefCell<TreeNode>>>,
    pub children: Vec<Rc<RefCell<TreeNode>>>,
}

impl TreeNode {
    pub fn new(data: String) -> Rc<RefCell<Self>> {
        Rc::new(RefCell::new(TreeNode {
            data,
            parent: None,
            children: Vec::new(),
        }))
    }
    
    pub fn add_child(parent: &Rc<RefCell<TreeNode>>, child_data: String) -> Rc<RefCell<TreeNode>> {
        let child = TreeNode::new(child_data);
        child.borrow_mut().parent = Some(Rc::downgrade(parent));
        parent.borrow_mut().children.push(child.clone());
        child
    }
    
    // 深さ優先探索の実装
    pub fn traverse_depth_first(node: &Rc<RefCell<TreeNode>>, mut visitor: impl FnMut(&str)) {
        visitor(&node.borrow().data);
        
        for child in &node.borrow().children {
            Self::traverse_depth_first(child, &mut visitor);
        }
    }
    
    // 幅優先探索の実装
    pub fn traverse_breadth_first(root: &Rc<RefCell<TreeNode>>, mut visitor: impl FnMut(&str)) {
        let mut queue = VecDeque::new();
        queue.push_back(root.clone());
        
        while let Some(node) = queue.pop_front() {
            visitor(&node.borrow().data);
            
            for child in &node.borrow().children {
                queue.push_back(child.clone());
            }
        }
    }
}

// スレッドセーフな共有状態管理
#[derive(Debug)]
pub struct ThreadSafeCounter {
    value: Arc<RwLock<i64>>,
    name: String,
}

impl ThreadSafeCounter {
    pub fn new(name: String) -> Self {
        Self {
            value: Arc::new(RwLock::new(0)),
            name,
        }
    }
    
    pub fn increment(&self) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
        let mut value = self.value.write()?;
        *value += 1;
        Ok(*value)
    }
    
    pub fn get(&self) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
        let value = self.value.read()?;
        Ok(*value)
    }
    
    // 複数のスレッドで並行実行
    pub fn stress_test(&self, num_threads: usize, increments_per_thread: usize) {
        let handles: Vec<_> = (0..num_threads)
            .map(|i| {
                let counter = Arc::clone(&self.value);
                let name = format!("{}-Thread-{}", self.name, i);
                
                thread::spawn(move || {
                    for _ in 0..increments_per_thread {
                        if let Ok(mut value) = counter.write() {
                            *value += 1;
                        }
                        // 少しの遅延を追加してロック競合をシミュレート
                        thread::sleep(Duration::from_nanos(1));
                    }
                    println!("{} completed", name);
                })
            })
            .collect();
        
        for handle in handles {
            handle.join().unwrap();
        }
    }
}
```

## 非同期プログラミングとFuturesパターン

### Tokio を使用した高性能非同期処理

```rust
use tokio::{
    sync::{mpsc, oneshot, Semaphore},
    time::{sleep, timeout, Duration, Instant},
    fs::File,
    io::{AsyncReadExt, AsyncWriteExt},
};
use futures::{
    future::{join_all, try_join_all},
    stream::{StreamExt, FuturesUnordered},
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse {
    pub data: serde_json::Value,
    pub status: String,
    pub timestamp: i64,
}

#[derive(Debug)]
pub struct AsyncHttpClient {
    client: Client,
    semaphore: Arc<Semaphore>,
    max_retries: usize,
}

impl AsyncHttpClient {
    pub fn new(max_concurrent_requests: usize) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap(),
            semaphore: Arc::new(Semaphore::new(max_concurrent_requests)),
            max_retries: 3,
        }
    }
    
    // 指数バックオフ付きリトライ機能
    pub async fn fetch_with_retry(&self, url: &str) -> Result<ApiResponse, Box<dyn std::error::Error + Send + Sync>> {
        let _permit = self.semaphore.acquire().await?;
        
        let mut attempts = 0;
        loop {
            match self.fetch_once(url).await {
                Ok(response) => return Ok(response),
                Err(e) if attempts < self.max_retries => {
                    attempts += 1;
                    let delay = Duration::from_millis(100 * 2_u64.pow(attempts as u32));
                    println!("Request failed, retrying in {:?}. Attempt {}/{}", delay, attempts, self.max_retries);
                    sleep(delay).await;
                }
                Err(e) => return Err(e),
            }
        }
    }
    
    async fn fetch_once(&self, url: &str) -> Result<ApiResponse, Box<dyn std::error::Error + Send + Sync>> {
        let response = timeout(Duration::from_secs(10), self.client.get(url).send()).await??;
        
        if response.status().is_success() {
            let body = response.json::<ApiResponse>().await?;
            Ok(body)
        } else {
            Err(format!("HTTP error: {}", response.status()).into())
        }
    }
    
    // バッチ処理：複数のURLを並行取得
    pub async fn fetch_batch(&self, urls: Vec<String>) -> Vec<Result<ApiResponse, Box<dyn std::error::Error + Send + Sync>>> {
        let futures: Vec<_> = urls
            .into_iter()
            .map(|url| self.fetch_with_retry(&url))
            .collect();
        
        join_all(futures).await
    }
    
    // ストリーミング処理：結果を順次処理
    pub async fn fetch_stream<F>(&self, urls: Vec<String>, mut handler: F) 
    where 
        F: FnMut(Result<ApiResponse, Box<dyn std::error::Error + Send + Sync>>) + Send + 'static
    {
        let mut futures = urls
            .into_iter()
            .map(|url| self.fetch_with_retry(&url))
            .collect::<FuturesUnordered<_>>();
        
        while let Some(result) = futures.next().await {
            handler(result);
        }
    }
}

// チャンネルを使用したプロデューサー・コンシューマーパターン
pub struct AsyncTaskQueue<T> {
    sender: mpsc::UnboundedSender<T>,
    receiver: Mutex<mpsc::UnboundedReceiver<T>>,
}

impl<T> AsyncTaskQueue<T> 
where 
    T: Send + 'static 
{
    pub fn new() -> Self {
        let (sender, receiver) = mpsc::unbounded_channel();
        Self {
            sender,
            receiver: Mutex::new(receiver),
        }
    }
    
    pub fn enqueue(&self, item: T) -> Result<(), mpsc::error::SendError<T>> {
        self.sender.send(item)
    }
    
    // ワーカープールパターンの実装
    pub async fn start_workers<F, Fut>(&self, num_workers: usize, processor: F)
    where
        F: Fn(T) -> Fut + Send + Sync + Clone + 'static,
        Fut: std::future::Future<Output = ()> + Send + 'static,
    {
        let receiver = Arc::new(Mutex::new(self.receiver.lock().unwrap()));
        let handles: Vec<_> = (0..num_workers)
            .map(|id| {
                let receiver = Arc::clone(&receiver);
                let processor = processor.clone();
                
                tokio::spawn(async move {
                    loop {
                        let item = {
                            let mut receiver = receiver.lock().unwrap();
                            receiver.recv().await
                        };
                        
                        match item {
                            Some(task) => {
                                println!("Worker {} processing task", id);
                                processor(task).await;
                            }
                            None => {
                                println!("Worker {} shutting down", id);
                                break;
                            }
                        }
                    }
                })
            })
            .collect();
        
        for handle in handles {
            handle.await.unwrap();
        }
    }
}

// 非同期ファイル処理パターン
pub struct AsyncFileProcessor;

impl AsyncFileProcessor {
    // 大きなファイルの非同期読み書き
    pub async fn process_large_file(
        input_path: &str,
        output_path: &str,
    ) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let mut input_file = File::open(input_path).await?;
        let mut output_file = tokio::fs::File::create(output_path).await?;
        
        let mut buffer = vec![0; 8192]; // 8KB buffer
        let mut total_bytes = 0;
        
        loop {
            let bytes_read = input_file.read(&mut buffer).await?;
            if bytes_read == 0 {
                break;
            }
            
            // データを処理（この例では単純に大文字に変換）
            let processed_data: Vec<u8> = buffer[..bytes_read]
                .iter()
                .map(|&b| if b.is_ascii_lowercase() { b.to_ascii_uppercase() } else { b })
                .collect();
            
            output_file.write_all(&processed_data).await?;
            total_bytes += bytes_read;
            
            // 進行状況を定期的に報告
            if total_bytes % 1_048_576 == 0 {
                println!("Processed {} MB", total_bytes / 1_048_576);
            }
        }
        
        output_file.flush().await?;
        Ok(total_bytes)
    }
    
    // 複数ファイルの並行処理
    pub async fn process_multiple_files(
        file_pairs: Vec<(String, String)>,
        max_concurrent: usize,
    ) -> Result<Vec<usize>, Box<dyn std::error::Error + Send + Sync>> {
        let semaphore = Arc::new(Semaphore::new(max_concurrent));
        
        let futures: Vec<_> = file_pairs
            .into_iter()
            .map(|(input, output)| {
                let semaphore = Arc::clone(&semaphore);
                async move {
                    let _permit = semaphore.acquire().await?;
                    Self::process_large_file(&input, &output).await
                }
            })
            .collect();
        
        try_join_all(futures).await
    }
}
```

## エラーハンドリングパターン

### カスタムエラー型と Result パターン

```rust
use std::fmt;
use std::error::Error as StdError;
use thiserror::Error;
use anyhow::{Context, Result as AnyhowResult};

// thiserror を使用したカスタムエラー型
#[derive(Error, Debug)]
pub enum UserServiceError {
    #[error("User not found: {id}")]
    UserNotFound { id: u64 },
    
    #[error("Invalid email format: {email}")]
    InvalidEmail { email: String },
    
    #[error("Database connection failed")]
    DatabaseError(#[from] DatabaseError),
    
    #[error("Network request failed")]
    NetworkError(#[from] reqwest::Error),
    
    #[error("Serialization error")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("Permission denied for user {user_id}")]
    PermissionDenied { user_id: u64 },
    
    #[error("Rate limit exceeded: {requests_per_minute} requests/min")]
    RateLimitExceeded { requests_per_minute: u32 },
}

// ビジネスロジックでのエラーハンドリング
pub struct UserService {
    db: DatabaseConnection,
    http_client: AsyncHttpClient,
    rate_limiter: RateLimiter,
}

impl UserService {
    // Result型を使用した関数
    pub async fn get_user(&self, id: u64) -> Result<User, UserServiceError> {
        // レート制限チェック
        self.rate_limiter.check_limit()?;
        
        // データベースから取得
        let user = self.db
            .find_user(id)
            .await
            .map_err(|e| UserServiceError::DatabaseError(e))?;
            
        match user {
            Some(user) => Ok(user),
            None => Err(UserServiceError::UserNotFound { id }),
        }
    }
    
    // 複数のエラーが発生する可能性がある操作
    pub async fn create_user_with_validation(
        &self,
        name: String,
        email: String,
    ) -> Result<User, UserServiceError> {
        // メール形式の検証
        if !email.contains('@') || !email.contains('.') {
            return Err(UserServiceError::InvalidEmail { email });
        }
        
        // 外部APIで重複チェック
        let duplicate_check = self
            .http_client
            .fetch_with_retry(&format!("https://api.example.com/check-email/{}", email))
            .await?;
            
        if duplicate_check.data["exists"].as_bool().unwrap_or(false) {
            return Err(UserServiceError::InvalidEmail { 
                email: format!("{} already exists", email) 
            });
        }
        
        // ユーザー作成
        let user = User::new(rand::random(), name, email);
        self.db.insert_user(&user).await?;
        
        Ok(user)
    }
    
    // anyhow を使用した簡潔なエラーハンドリング
    pub async fn complex_operation(&self, user_id: u64) -> AnyhowResult<String> {
        let user = self
            .get_user(user_id)
            .await
            .context("Failed to fetch user")?;
            
        let profile = self
            .http_client
            .fetch_with_retry(&format!("https://api.example.com/profile/{}", user.id))
            .await
            .context("Failed to fetch user profile")?;
            
        let processed_data = serde_json::to_string(&profile)
            .context("Failed to serialize profile data")?;
            
        Ok(processed_data)
    }
}

// Option型の活用パターン
pub struct ConfigManager {
    settings: HashMap<String, String>,
}

impl ConfigManager {
    // Option型を使用した安全な設定取得
    pub fn get_config<T>(&self, key: &str) -> Option<T>
    where
        T: std::str::FromStr,
        T::Err: std::fmt::Debug,
    {
        self.settings
            .get(key)
            .and_then(|value| value.parse().ok())
    }
    
    // デフォルト値との組み合わせ
    pub fn get_config_or_default<T>(&self, key: &str, default: T) -> T
    where
        T: std::str::FromStr + Clone,
        T::Err: std::fmt::Debug,
    {
        self.get_config(key).unwrap_or(default)
    }
    
    // 複数の設定を組み合わせる
    pub fn build_connection_string(&self) -> Option<String> {
        let host = self.settings.get("db_host")?;
        let port = self.settings.get("db_port")?;
        let database = self.settings.get("db_name")?;
        let username = self.settings.get("db_user")?;
        let password = self.settings.get("db_password")?;
        
        Some(format!(
            "postgresql://{}:{}@{}:{}/{}",
            username, password, host, port, database
        ))
    }
}

// カスタムResult型エイリアス
pub type ServiceResult<T> = Result<T, UserServiceError>;
```

## パフォーマンス最適化パターン

### Zero-Cost Abstractions と最適化

```rust
use std::hint::black_box;
use std::arch::x86_64::*;
use rayon::prelude::*;

// ジェネリクスを使用したゼロコスト抽象化
pub trait DataProcessor<T> {
    type Output;
    
    fn process(&self, data: T) -> Self::Output;
    fn process_batch(&self, data: Vec<T>) -> Vec<Self::Output> {
        data.into_iter().map(|item| self.process(item)).collect()
    }
}

// コンパイル時最適化が効くマクロ
macro_rules! optimized_loop {
    ($data:expr, $operation:expr) => {
        {
            let mut result = Vec::with_capacity($data.len());
            for item in $data.iter() {
                result.push($operation(item));
            }
            result
        }
    };
}

// SIMD命令を使用した高速計算
pub struct SimdProcessor;

impl SimdProcessor {
    // ベクトル化可能な操作
    pub fn add_arrays_simd(a: &[f32], b: &[f32]) -> Vec<f32> {
        assert_eq!(a.len(), b.len());
        
        let mut result = vec![0.0; a.len()];
        let chunks = a.len() / 8;
        
        unsafe {
            for i in 0..chunks {
                let idx = i * 8;
                
                // 8個のf32を同時にロード
                let va = _mm256_loadu_ps(a.as_ptr().add(idx));
                let vb = _mm256_loadu_ps(b.as_ptr().add(idx));
                
                // SIMD加算
                let vresult = _mm256_add_ps(va, vb);
                
                // 結果をメモリに格納
                _mm256_storeu_ps(result.as_mut_ptr().add(idx), vresult);
            }
        }
        
        // 余りの要素を処理
        for i in (chunks * 8)..a.len() {
            result[i] = a[i] + b[i];
        }
        
        result
    }
    
    // 並列処理との組み合わせ
    pub fn parallel_simd_operation(data: &[Vec<f32>]) -> Vec<Vec<f32>> {
        data.par_iter()
            .map(|chunk| {
                // チャンクごとにSIMD処理
                let doubled: Vec<f32> = chunk.iter().map(|&x| x * 2.0).collect();
                doubled
            })
            .collect()
    }
}

// メモリ効率的なデータ構造
#[repr(C, packed)]
pub struct PackedStruct {
    pub flag: bool,      // 1 byte
    pub id: u32,         // 4 bytes
    pub value: u16,      // 2 bytes
    // total: 7 bytes instead of 12 with padding
}

// アリーナアロケータのシンプルな実装
pub struct Arena {
    buffer: Vec<u8>,
    offset: usize,
}

impl Arena {
    pub fn new(capacity: usize) -> Self {
        Self {
            buffer: vec![0; capacity],
            offset: 0,
        }
    }
    
    pub fn alloc<T>(&mut self, value: T) -> &mut T {
        let size = std::mem::size_of::<T>();
        let align = std::mem::align_of::<T>();
        
        // アライメント調整
        let remainder = self.offset % align;
        if remainder != 0 {
            self.offset += align - remainder;
        }
        
        assert!(self.offset + size <= self.buffer.len(), "Arena out of memory");
        
        unsafe {
            let ptr = self.buffer.as_mut_ptr().add(self.offset) as *mut T;
            ptr.write(value);
            self.offset += size;
            &mut *ptr
        }
    }
    
    pub fn reset(&mut self) {
        self.offset = 0;
    }
}

// インライン展開とLTO最適化
#[inline(always)]
pub fn hot_path_function(x: i32, y: i32) -> i32 {
    black_box(x * y + x - y) // コンパイラ最適化を防ぐ
}

// 分岐予測最適化
pub fn optimized_conditional_logic(data: &[i32]) -> Vec<i32> {
    let mut positive = Vec::new();
    let mut negative = Vec::new();
    
    // 分岐予測に優しいパターン
    for &value in data {
        if likely(value >= 0) {
            positive.push(value);
        } else {
            negative.push(value);
        }
    }
    
    // 結果をマージ
    positive.extend(negative);
    positive
}

// likely/unlikely マクロ（分岐予測ヒント）
#[inline(always)]
pub fn likely(condition: bool) -> bool {
    std::intrinsics::likely(condition)
}

#[inline(always)]
pub fn unlikely(condition: bool) -> bool {
    std::intrinsics::unlikely(condition)
}
```

## Trait システムと高度な型パターン

### Associated Types と Higher-Kinded Types

```rust
use std::marker::PhantomData;
use std::ops::{Add, Mul};

// Associated Types を使用した柔軟な抽象化
pub trait Repository {
    type Entity;
    type Key;
    type Error;
    
    async fn find_by_id(&self, id: Self::Key) -> Result<Option<Self::Entity>, Self::Error>;
    async fn save(&mut self, entity: Self::Entity) -> Result<Self::Key, Self::Error>;
    async fn delete(&mut self, id: Self::Key) -> Result<(), Self::Error>;
}

// Generic Associated Types (GAT) を使用した高度な抽象化
pub trait AsyncIterator {
    type Item;
    type Future<'a>: std::future::Future<Output = Option<Self::Item>>
    where
        Self: 'a;
    
    fn next(&mut self) -> Self::Future<'_>;
}

// Phantom Types を使用した型安全性の確保
#[derive(Debug, Clone, Copy)]
pub struct TypedId<T> {
    id: u64,
    _phantom: PhantomData<T>,
}

impl<T> TypedId<T> {
    pub fn new(id: u64) -> Self {
        Self {
            id,
            _phantom: PhantomData,
        }
    }
    
    pub fn value(&self) -> u64 {
        self.id
    }
}

// 型システムを活用した状態管理
pub struct StateMachine<S> {
    state: S,
}

// 状態の型定義
pub struct Draft;
pub struct Published;
pub struct Archived;

impl StateMachine<Draft> {
    pub fn new(content: String) -> Self {
        Self {
            state: Draft { content },
        }
    }
    
    pub fn publish(self) -> StateMachine<Published> {
        StateMachine {
            state: Published {
                content: self.state.content,
                published_at: chrono::Utc::now(),
            },
        }
    }
}

impl StateMachine<Published> {
    pub fn archive(self) -> StateMachine<Archived> {
        StateMachine {
            state: Archived {
                content: self.state.content,
                published_at: self.state.published_at,
                archived_at: chrono::Utc::now(),
            },
        }
    }
}

// Builder パターンの型安全な実装
pub struct ConfigBuilder<HasHost, HasPort, HasDatabase> {
    host: Option<String>,
    port: Option<u16>,
    database: Option<String>,
    username: Option<String>,
    password: Option<String>,
    _phantom: PhantomData<(HasHost, HasPort, HasDatabase)>,
}

pub struct Yes;
pub struct No;

impl ConfigBuilder<No, No, No> {
    pub fn new() -> Self {
        Self {
            host: None,
            port: None,
            database: None,
            username: None,
            password: None,
            _phantom: PhantomData,
        }
    }
}

impl<HasPort, HasDatabase> ConfigBuilder<No, HasPort, HasDatabase> {
    pub fn host(self, host: impl Into<String>) -> ConfigBuilder<Yes, HasPort, HasDatabase> {
        ConfigBuilder {
            host: Some(host.into()),
            port: self.port,
            database: self.database,
            username: self.username,
            password: self.password,
            _phantom: PhantomData,
        }
    }
}

impl<HasHost, HasDatabase> ConfigBuilder<HasHost, No, HasDatabase> {
    pub fn port(self, port: u16) -> ConfigBuilder<HasHost, Yes, HasDatabase> {
        ConfigBuilder {
            host: self.host,
            port: Some(port),
            database: self.database,
            username: self.username,
            password: self.password,
            _phantom: PhantomData,
        }
    }
}

impl<HasHost, HasPort> ConfigBuilder<HasHost, HasPort, No> {
    pub fn database(self, database: impl Into<String>) -> ConfigBuilder<HasHost, HasPort, Yes> {
        ConfigBuilder {
            host: self.host,
            port: self.port,
            database: Some(database.into()),
            username: self.username,
            password: self.password,
            _phantom: PhantomData,
        }
    }
}

// 必要な要素がすべて設定された場合のみbuildが可能
impl ConfigBuilder<Yes, Yes, Yes> {
    pub fn build(self) -> DatabaseConfig {
        DatabaseConfig {
            host: self.host.unwrap(),
            port: self.port.unwrap(),
            database: self.database.unwrap(),
            username: self.username,
            password: self.password,
        }
    }
    
    pub fn username(mut self, username: impl Into<String>) -> Self {
        self.username = Some(username.into());
        self
    }
    
    pub fn password(mut self, password: impl Into<String>) -> Self {
        self.password = Some(password.into());
        self
    }
}

#[derive(Debug)]
pub struct DatabaseConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: Option<String>,
    pub password: Option<String>,
}
```

## ベストプラクティス

1. **所有権システム**: borrowing rules を理解し、適切なライフタイムを設計
2. **エラーハンドリング**: Result型とOption型を積極的に活用
3. **メモリ管理**: Rc/Arc、RefCell/Mutex の適切な使い分け
4. **並行プログラミング**: Tokio、channels、atomics の組み合わせ
5. **型安全性**: Phantom Types、GATs を活用したコンパイル時検証
6. **パフォーマンス**: SIMD、並列処理、ゼロコスト抽象化の活用
7. **テスト**: 単体テスト、統合テスト、プロパティベーステストの実装
8. **WebAssembly**: wasm-bindgen でのJavaScript連携最適化
9. **クロスコンパイル**: 異なるプラットフォーム向けのビルド最適化
10. **プロファイリング**: perf、valgrind、criterion でのパフォーマンス測定