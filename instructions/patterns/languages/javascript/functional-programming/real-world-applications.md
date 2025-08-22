# 実世界の応用

## React関数型パターン

```javascript
// 高階コンポーネント (HOC) の関数型実装
const withLoading = (WrappedComponent) => (props) => {
  const { isLoading, ...restProps } = props;
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  return <WrappedComponent {...restProps} />;
};

const withErrorBoundary = (WrappedComponent) => (props) => {
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    const errorHandler = (error) => {
      console.error('Error caught:', error);
      setHasError(true);
    };
    
    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);
  
  if (hasError) {
    return <div>Something went wrong.</div>;
  }
  
  return <WrappedComponent {...props} />;
};

// HOCの合成
const enhance = pipe(
  withErrorBoundary,
  withLoading
);

const EnhancedComponent = enhance(MyComponent);

// Render Props パターン
const DataFetcher = ({ render, url }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetch(url)
      .then(response => response.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(error => {
        setError(error);
        setLoading(false);
      });
  }, [url]);
  
  return render({ data, loading, error });
};

// 使用例
const UserProfile = ({ userId }) => (
  <DataFetcher 
    url={`/api/users/${userId}`}
    render={({ data, loading, error }) => {
      if (loading) return <div>Loading...</div>;
      if (error) return <div>Error: {error.message}</div>;
      return <div>User: {data.name}</div>;
    }}
  />
);
```

## 状態管理の関数型アプローチ

```javascript
// Redux風の関数型状態管理
const createStore = (reducer, initialState, middleware = []) => {
  let state = initialState;
  const listeners = [];
  
  const dispatch = middleware.reduceRight(
    (next, mw) => mw({ getState, dispatch: (action) => next(action) })(next),
    (action) => {
      const newState = reducer(state, action);
      if (newState !== state) {
        state = newState;
        listeners.forEach(listener => listener());
      }
      return action;
    }
  );
  
  const getState = () => state;
  
  const subscribe = (listener) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      listeners.splice(index, 1);
    };
  };
  
  return { dispatch, getState, subscribe };
};

// レンズベースの状態更新
const lens = (getter, setter) => ({ get: getter, set: setter });

const prop = (key) => lens(
  obj => obj[key],
  value => obj => ({ ...obj, [key]: value })
);

const path = (...keys) => keys.reduce(
  (acc, key) => lens(
    obj => acc.get(obj)[key],
    value => obj => acc.set({ ...acc.get(obj), [key]: value })(obj)
  ),
  lens(x => x, value => _ => value)
);

// 状態の関数型更新
const userLens = prop('user');
const profileLens = path('user', 'profile');
const nameLens = path('user', 'profile', 'name');

const updateUserName = (state, newName) =>
  nameLens.set(newName)(state);

const incrementUserAge = (state) =>
  path('user', 'profile', 'age').over(age => age + 1)(state);
```

## APIクライアントの関数型設計

```javascript
// Monadicなエラーハンドリング付きAPIクライアント
class ApiClient {
  constructor(baseUrl, defaultHeaders = {}) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = defaultHeaders;
  }
  
  request(endpoint, options = {}) {
    return Task.of({ endpoint, options })
      .map(this.buildRequest.bind(this))
      .flatMap(this.executeRequest.bind(this))
      .flatMap(this.parseResponse.bind(this));
  }
  
  buildRequest({ endpoint, options }) {
    return {
      url: `${this.baseUrl}${endpoint}`,
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers
      }
    };
  }
  
  executeRequest(requestConfig) {
    return new Task((resolve, reject) => {
      fetch(requestConfig.url, requestConfig)
        .then(response => {
          if (!response.ok) {
            reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
          } else {
            resolve(response);
          }
        })
        .catch(reject);
    });
  }
  
  parseResponse(response) {
    return new Task((resolve, reject) => {
      response.json()
        .then(resolve)
        .catch(reject);
    });
  }
  
  // 便利メソッド
  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }
  
  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

// 使用例
const api = new ApiClient('https://api.example.com');

const getUserPosts = (userId) =>
  Task.all([
    api.get(`/users/${userId}`),
    api.get(`/users/${userId}/posts`)
  ]).map(([user, posts]) => ({ ...user, posts }));

getUserPosts(123)
  .run()
  .then(userWithPosts => console.log(userWithPosts))
  .catch(error => console.error('API Error:', error));
```

## 関数型バリデーション

```javascript
// Validation Applicative Functor
class Validation {
  constructor(value, isSuccess) {
    this.value = value;
    this.isSuccess = isSuccess;
  }
  
  static success(value) {
    return new Validation(value, true);
  }
  
  static failure(errors) {
    return new Validation(Array.isArray(errors) ? errors : [errors], false);
  }
  
  map(fn) {
    return this.isSuccess 
      ? Validation.success(fn(this.value))
      : this;
  }
  
  flatMap(fn) {
    return this.isSuccess ? fn(this.value) : this;
  }
  
  ap(validationFn) {
    if (this.isSuccess && validationFn.isSuccess) {
      return Validation.success(validationFn.value(this.value));
    }
    
    const errors = [
      ...(this.isSuccess ? [] : this.value),
      ...(validationFn.isSuccess ? [] : validationFn.value)
    ];
    
    return Validation.failure(errors);
  }
  
  fold(onFailure, onSuccess) {
    return this.isSuccess ? onSuccess(this.value) : onFailure(this.value);
  }
}

// バリデーション関数群
const required = (fieldName) => (value) =>
  value == null || value === '' 
    ? Validation.failure(`${fieldName} is required`)
    : Validation.success(value);

const minLength = (min, fieldName) => (value) =>
  value && value.length < min
    ? Validation.failure(`${fieldName} must be at least ${min} characters`)
    : Validation.success(value);

const email = (value) =>
  value && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)
    ? Validation.failure('Invalid email format')
    : Validation.success(value);

const positiveNumber = (fieldName) => (value) =>
  isNaN(value) || value <= 0
    ? Validation.failure(`${fieldName} must be a positive number`)
    : Validation.success(value);

// フォームバリデーション
const validateUser = (userData) => {
  const { name, email: userEmail, age } = userData;
  
  // Applicative による並列バリデーション
  const validName = required('Name')(name)
    .flatMap(minLength(2, 'Name'));
    
  const validEmail = required('Email')(userEmail)
    .flatMap(email);
    
  const validAge = required('Age')(age)
    .flatMap(positiveNumber('Age'));
  
  // 全てのバリデーションを組み合わせ
  return validName
    .ap(validEmail.ap(validAge.map(age => email => name => ({ name, email, age }))));
};

// 使用例
const userData = { name: 'John', email: 'john@example.com', age: 30 };
const result = validateUser(userData);

result.fold(
  errors => console.error('Validation errors:', errors),
  user => console.log('Valid user:', user)
);
```

## 関数型パイプライン

```javascript
// データ変換パイプライン
const processUserData = pipe(
  // データの取得
  (userId) => api.get(`/users/${userId}`).run(),
  
  // データの変換
  (userData) => ({
    ...userData,
    displayName: `${userData.firstName} ${userData.lastName}`,
    isAdmin: userData.role === 'admin',
    formattedJoinDate: new Date(userData.joinDate).toLocaleDateString()
  }),
  
  // バリデーション
  (user) => validateUser(user).fold(
    errors => { throw new Error(`Invalid user data: ${errors.join(', ')}`); },
    validUser => validUser
  ),
  
  // 追加データの取得
  async (user) => {
    const posts = await api.get(`/users/${user.id}/posts`).run();
    return { ...user, posts };
  },
  
  // 最終的なデータ構造
  (userWithPosts) => ({
    user: userWithPosts,
    summary: {
      totalPosts: userWithPosts.posts.length,
      averagePostLength: userWithPosts.posts.reduce(
        (sum, post) => sum + post.content.length, 0
      ) / userWithPosts.posts.length
    }
  })
);

// エラーハンドリング付きの使用
const safeProcessUserData = (userId) =>
  processUserData(userId)
    .then(result => ({ success: true, data: result }))
    .catch(error => ({ success: false, error: error.message }));

// 使用例
safeProcessUserData(123)
  .then(result => {
    if (result.success) {
      console.log('User processed successfully:', result.data);
    } else {
      console.error('Processing failed:', result.error);
    }
  });
```