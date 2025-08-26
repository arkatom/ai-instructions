# C++ システムプログラミングパターン

## 現代的なC++開発パターン (C++20/23対応)

### 1. RAII (Resource Acquisition Is Initialization)

```cpp
// 自動リソース管理パターン
class FileManager {
private:
    std::FILE* file_;
    
public:
    explicit FileManager(const std::string& filename) 
        : file_(std::fopen(filename.c_str(), "r")) {
        if (!file_) {
            throw std::runtime_error("ファイルオープン失敗: " + filename);
        }
    }
    
    ~FileManager() noexcept {
        if (file_) {
            std::fclose(file_);
        }
    }
    
    // コピー禁止、ムーブ対応
    FileManager(const FileManager&) = delete;
    FileManager& operator=(const FileManager&) = delete;
    
    FileManager(FileManager&& other) noexcept : file_(other.file_) {
        other.file_ = nullptr;
    }
    
    FileManager& operator=(FileManager&& other) noexcept {
        if (this != &other) {
            if (file_) std::fclose(file_);
            file_ = other.file_;
            other.file_ = nullptr;
        }
        return *this;
    }
    
    std::FILE* get() const noexcept { return file_; }
};
```

### 2. スマートポインタパターン

```cpp
// メモリ安全な所有権管理
class TaskManager {
public:
    // 一意所有権
    std::unique_ptr<Task> createTask(TaskType type) {
        return std::make_unique<Task>(type);
    }
    
    // 共有所有権
    std::shared_ptr<ThreadPool> getThreadPool() {
        if (!thread_pool_) {
            thread_pool_ = std::make_shared<ThreadPool>(
                std::thread::hardware_concurrency()
            );
        }
        return thread_pool_;
    }
    
    // 循環参照回避
    void registerObserver(std::shared_ptr<Observer> observer) {
        observers_.emplace_back(observer);
        observer->setSubject(shared_from_this());
    }
    
private:
    std::shared_ptr<ThreadPool> thread_pool_;
    std::vector<std::weak_ptr<Observer>> observers_;
};
```

### 3. 型安全・コンパイル時チェック

```cpp
// 強い型付けパターン
template<typename T, typename Tag>
class StrongType {
private:
    T value_;
    
public:
    explicit StrongType(T value) : value_(std::move(value)) {}
    
    const T& get() const noexcept { return value_; }
    T& get() noexcept { return value_; }
    
    // 比較演算子
    auto operator<=>(const StrongType&) const = default;
};

using UserId = StrongType<std::uint64_t, struct UserIdTag>;
using ProductId = StrongType<std::uint64_t, struct ProductIdTag>;

class OrderService {
public:
    // コンパイル時型安全性
    Order createOrder(UserId user_id, ProductId product_id) {
        return Order{user_id, product_id};
    }
    
    // 間違った型の渡し方はコンパイルエラー
    // createOrder(ProductId{123}, UserId{456}); // エラー！
};
```

### 4. 非同期プログラミングパターン

```cpp
// C++20 コルーチン活用
#include <coroutine>
#include <future>

template<typename T>
class Task {
public:
    struct promise_type {
        T value_;
        std::exception_ptr exception_;
        
        Task<T> get_return_object() {
            return Task<T>(std::coroutine_handle<promise_type>::from_promise(*this));
        }
        
        std::suspend_never initial_suspend() { return {}; }
        std::suspend_never final_suspend() noexcept { return {}; }
        
        void return_value(T value) {
            value_ = std::move(value);
        }
        
        void unhandled_exception() {
            exception_ = std::current_exception();
        }
    };
    
private:
    std::coroutine_handle<promise_type> coro_;
    
public:
    explicit Task(std::coroutine_handle<promise_type> coro) : coro_(coro) {}
    
    ~Task() {
        if (coro_) coro_.destroy();
    }
    
    T get() {
        if (coro_.promise().exception_) {
            std::rethrow_exception(coro_.promise().exception_);
        }
        return coro_.promise().value_;
    }
};

// 使用例
Task<std::string> fetchDataAsync(const std::string& url) {
    // 非同期処理をシミュレート
    co_return "データ: " + url;
}
```

### 5. エラーハンドリングパターン

```cpp
// Result型パターン (Rust風)
template<typename T, typename E>
class Result {
private:
    std::variant<T, E> value_;
    
public:
    // 成功値の構築
    static Result<T, E> success(T value) {
        return Result<T, E>(std::move(value));
    }
    
    // エラー値の構築
    static Result<T, E> error(E error) {
        return Result<T, E>(std::move(error));
    }
    
    bool is_success() const noexcept {
        return std::holds_alternative<T>(value_);
    }
    
    bool is_error() const noexcept {
        return std::holds_alternative<E>(value_);
    }
    
    const T& unwrap() const {
        if (is_error()) {
            throw std::runtime_error("Result is error");
        }
        return std::get<T>(value_);
    }
    
    const E& error() const {
        if (is_success()) {
            throw std::runtime_error("Result is success");
        }
        return std::get<E>(value_);
    }
    
private:
    explicit Result(std::variant<T, E> value) : value_(std::move(value)) {}
};

// 使用例
Result<int, std::string> divide(int a, int b) {
    if (b == 0) {
        return Result<int, std::string>::error("ゼロ除算エラー");
    }
    return Result<int, std::string>::success(a / b);
}
```

### 6. 並行性・並列性パターン

```cpp
// スレッドセーフなデータ構造
template<typename T>
class ThreadSafeQueue {
private:
    mutable std::mutex mutex_;
    std::queue<T> queue_;
    std::condition_variable condition_;
    
public:
    void push(T item) {
        std::lock_guard<std::mutex> lock(mutex_);
        queue_.push(std::move(item));
        condition_.notify_one();
    }
    
    bool try_pop(T& item) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (queue_.empty()) {
            return false;
        }
        item = std::move(queue_.front());
        queue_.pop();
        return true;
    }
    
    void wait_and_pop(T& item) {
        std::unique_lock<std::mutex> lock(mutex_);
        condition_.wait(lock, [this] { return !queue_.empty(); });
        item = std::move(queue_.front());
        queue_.pop();
    }
    
    bool empty() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return queue_.empty();
    }
    
    size_t size() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return queue_.size();
    }
};

// アクター風並行パターン
class WorkerActor {
private:
    ThreadSafeQueue<std::function<void()>> tasks_;
    std::thread worker_thread_;
    std::atomic<bool> running_{true};
    
public:
    WorkerActor() : worker_thread_(&WorkerActor::run, this) {}
    
    ~WorkerActor() {
        running_ = false;
        tasks_.push([]{}); // ダミータスクで起こす
        if (worker_thread_.joinable()) {
            worker_thread_.join();
        }
    }
    
    template<typename Func>
    void submit(Func&& func) {
        tasks_.push(std::forward<Func>(func));
    }
    
private:
    void run() {
        while (running_) {
            std::function<void()> task;
            tasks_.wait_and_pop(task);
            if (running_) {
                task();
            }
        }
    }
};
```

### 7. テンプレートメタプログラミング

```cpp
// SFINAE とコンセプト
template<typename T>
concept Numeric = std::integral<T> || std::floating_point<T>;

template<typename T>
concept Container = requires(T& t) {
    t.begin();
    t.end();
    t.size();
};

// 型特性を活用したジェネリック関数
template<Numeric T>
constexpr T safe_add(T a, T b) {
    if constexpr (std::is_signed_v<T>) {
        if ((b > 0 && a > std::numeric_limits<T>::max() - b) ||
            (b < 0 && a < std::numeric_limits<T>::min() - b)) {
            throw std::overflow_error("算術オーバーフロー");
        }
    } else {
        if (a > std::numeric_limits<T>::max() - b) {
            throw std::overflow_error("算術オーバーフロー");
        }
    }
    return a + b;
}

// Containerコンセプト活用
template<Container C>
auto sum_elements(const C& container) {
    using ValueType = std::decay_t<decltype(*container.begin())>;
    ValueType sum{};
    
    for (const auto& element : container) {
        sum = safe_add(sum, element);
    }
    return sum;
}
```

### 8. パフォーマンス最適化パターン

```cpp
// メモリプール パターン
template<typename T, std::size_t ChunkSize = 1024>
class MemoryPool {
private:
    struct Chunk {
        alignas(T) char data[sizeof(T) * ChunkSize];
        std::bitset<ChunkSize> used;
        Chunk* next = nullptr;
    };
    
    std::unique_ptr<Chunk> head_;
    
public:
    template<typename... Args>
    T* allocate(Args&&... args) {
        auto* chunk = find_available_chunk();
        if (!chunk) {
            chunk = add_new_chunk();
        }
        
        for (std::size_t i = 0; i < ChunkSize; ++i) {
            if (!chunk->used[i]) {
                chunk->used[i] = true;
                T* ptr = reinterpret_cast<T*>(chunk->data + i * sizeof(T));
                new(ptr) T(std::forward<Args>(args)...);
                return ptr;
            }
        }
        
        throw std::bad_alloc();
    }
    
    void deallocate(T* ptr) {
        auto* chunk = find_chunk_for_ptr(ptr);
        if (!chunk) return;
        
        ptr->~T();
        std::size_t index = (reinterpret_cast<char*>(ptr) - chunk->data) / sizeof(T);
        chunk->used[index] = false;
    }
    
private:
    Chunk* find_available_chunk() {
        for (auto* chunk = head_.get(); chunk; chunk = chunk->next) {
            if (!chunk->used.all()) return chunk;
        }
        return nullptr;
    }
    
    Chunk* add_new_chunk() {
        auto new_chunk = std::make_unique<Chunk>();
        new_chunk->next = head_.release();
        head_ = std::move(new_chunk);
        return head_.get();
    }
    
    Chunk* find_chunk_for_ptr(T* ptr) {
        for (auto* chunk = head_.get(); chunk; chunk = chunk->next) {
            char* chunk_start = chunk->data;
            char* chunk_end = chunk_start + sizeof(T) * ChunkSize;
            char* target = reinterpret_cast<char*>(ptr);
            
            if (target >= chunk_start && target < chunk_end) {
                return chunk;
            }
        }
        return nullptr;
    }
};
```

## システムプログラミングベストプラクティス

### 1. **メモリ安全性の確保**
- スマートポインタの積極的活用
- RAII パターンの徹底
- バウンダリチェックの実装

### 2. **並行性の管理**
- データ競合の回避
- デッドロック防止策
- アトミック操作の活用

### 3. **エラー処理の統一**
- 例外とResult型の使い分け
- エラー情報の詳細化
- リソースリーク防止

### 4. **パフォーマンス最適化**
- 不要なコピーの削減
- ムーブセマンティクスの活用
- メモリアクセス最適化

これらのパターンにより、安全で効率的なシステムプログラミングが実現できます。