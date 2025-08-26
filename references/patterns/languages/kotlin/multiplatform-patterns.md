# Kotlin Android/Multiplatform 実践パターン

## モダンKotlin言語機能とコルーチン

### Coroutines と Flow を活用した非同期処理

```kotlin
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlin.time.Duration.Companion.seconds
import kotlin.time.Duration.Companion.milliseconds

// Repository pattern with coroutines and caching
class UserRepository @Inject constructor(
    private val apiService: UserApiService,
    private val localDataSource: UserLocalDataSource,
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
) {
    private val _userCache = mutableMapOf<String, User>()
    private val userUpdates = MutableSharedFlow<User>(replay = 1, extraBufferCapacity = 64)
    
    // Cold Flow for reactive data observation
    fun observeUser(userId: String): Flow<User?> = flow {
        // Emit cached data first
        _userCache[userId]?.let { emit(it) }
        
        // Then fetch from local database
        localDataSource.getUser(userId)?.let { localUser ->
            _userCache[userId] = localUser
            emit(localUser)
        }
        
        // Finally, fetch from network
        try {
            val networkUser = apiService.getUser(userId)
            _userCache[userId] = networkUser
            localDataSource.saveUser(networkUser)
            emit(networkUser)
        } catch (e: Exception) {
            // Handle error but don't fail the flow
            println("Failed to fetch user from network: ${e.message}")
        }
    }.flowOn(Dispatchers.IO)
    
    // Hot Flow for real-time updates
    fun observeUserUpdates(): Flow<User> = userUpdates.asSharedFlow()
    
    suspend fun updateUser(user: User): Result<User> = withContext(Dispatchers.IO) {
        runCatching {
            val updatedUser = apiService.updateUser(user)
            
            // Update cache and local storage
            _userCache[user.id] = updatedUser
            localDataSource.saveUser(updatedUser)
            
            // Emit update to subscribers
            userUpdates.tryEmit(updatedUser)
            
            updatedUser
        }
    }
    
    // Paginated data loading with Flow
    fun getUsers(pageSize: Int = 20): Flow<PagingData<User>> = Pager(
        config = PagingConfig(
            pageSize = pageSize,
            enablePlaceholders = false,
            prefetchDistance = 3
        ),
        pagingSourceFactory = { UserPagingSource(apiService) }
    ).flow.cachedIn(scope)
    
    // Advanced Flow operations
    fun searchUsers(query: String): Flow<List<User>> = 
        flowOf(query)
            .debounce(300.milliseconds)
            .distinctUntilChanged()
            .filter { it.length >= 2 }
            .flatMapLatest { searchQuery ->
                flow {
                    emit(emptyList()) // Show loading state
                    
                    val results = apiService.searchUsers(searchQuery)
                    emit(results)
                }.catch { e ->
                    emit(emptyList())
                    println("Search error: ${e.message}")
                }
            }
            .flowOn(Dispatchers.IO)
    
    // Combine multiple flows
    fun getUserProfile(userId: String): Flow<UserProfile> = combine(
        observeUser(userId),
        getUserPosts(userId),
        getUserFollowers(userId)
    ) { user, posts, followers ->
        UserProfile(
            user = user,
            posts = posts,
            followersCount = followers.size
        )
    }
    
    private fun getUserPosts(userId: String): Flow<List<Post>> = flow {
        emit(apiService.getUserPosts(userId))
    }
    
    private fun getUserFollowers(userId: String): Flow<List<User>> = flow {
        emit(apiService.getUserFollowers(userId))
    }
}

// Structured concurrency for parallel operations
class DataSyncService @Inject constructor(
    private val userRepository: UserRepository,
    private val postRepository: PostRepository,
    private val analyticsRepository: AnalyticsRepository
) {
    
    suspend fun performFullSync(): SyncResult = withContext(Dispatchers.IO) {
        val syncJob = SupervisorJob()
        val syncScope = CoroutineScope(coroutineContext + syncJob)
        
        try {
            // Parallel execution of independent operations
            val userSyncDeferred = syncScope.async { syncUsers() }
            val postSyncDeferred = syncScope.async { syncPosts() }
            val analyticsDeferred = syncScope.async { syncAnalytics() }
            
            // Wait for all operations with timeout
            withTimeout(30.seconds) {
                val userResult = userSyncDeferred.await()
                val postResult = postSyncDeferred.await()
                val analyticsResult = analyticsDeferred.await()
                
                SyncResult.Success(userResult, postResult, analyticsResult)
            }
            
        } catch (e: TimeoutCancellationException) {
            syncJob.cancelChildren()
            SyncResult.Timeout
        } catch (e: Exception) {
            syncJob.cancelChildren()
            SyncResult.Error(e)
        }
    }
    
    private suspend fun syncUsers(): UserSyncResult {
        return try {
            val users = userRepository.getRemoteUsers()
            userRepository.saveUsersLocally(users)
            UserSyncResult.Success(users.size)
        } catch (e: Exception) {
            UserSyncResult.Error(e.message ?: "Unknown error")
        }
    }
    
    private suspend fun syncPosts(): PostSyncResult {
        return try {
            val posts = postRepository.getRemotePosts()
            postRepository.savePostsLocally(posts)
            PostSyncResult.Success(posts.size)
        } catch (e: Exception) {
            PostSyncResult.Error(e.message ?: "Unknown error")
        }
    }
    
    private suspend fun syncAnalytics(): AnalyticsSyncResult {
        return try {
            analyticsRepository.uploadPendingEvents()
            AnalyticsSyncResult.Success
        } catch (e: Exception) {
            AnalyticsSyncResult.Error(e.message ?: "Unknown error")
        }
    }
}

// Custom Flow operators
fun <T> Flow<T>.retryWithExponentialBackoff(
    maxRetries: Int = 3,
    initialDelay: kotlin.time.Duration = 1.seconds,
    maxDelay: kotlin.time.Duration = 10.seconds,
    factor: Double = 2.0
): Flow<T> = flow {
    var currentDelay = initialDelay
    var attempt = 0
    
    while (attempt <= maxRetries) {
        try {
            collect { emit(it) }
            break
        } catch (e: Exception) {
            if (attempt == maxRetries) {
                throw e
            }
            
            delay(currentDelay)
            currentDelay = (currentDelay * factor).coerceAtMost(maxDelay)
            attempt++
        }
    }
}
```

### Sealed Classes とType-Safe State Management

```kotlin
// Sealed class for UI state representation
sealed class UiState<out T> {
    object Loading : UiState<Nothing>()
    data class Success<T>(val data: T) : UiState<T>()
    data class Error(val exception: Throwable) : UiState<Nothing>()
    object Empty : UiState<Nothing>()
    
    val isLoading: Boolean get() = this is Loading
    val isSuccess: Boolean get() = this is Success
    val isError: Boolean get() = this is Error
    val isEmpty: Boolean get() = this is Empty
    
    inline fun onSuccess(action: (T) -> Unit): UiState<T> {
        if (this is Success) action(data)
        return this
    }
    
    inline fun onError(action: (Throwable) -> Unit): UiState<T> {
        if (this is Error) action(exception)
        return this
    }
    
    inline fun onLoading(action: () -> Unit): UiState<T> {
        if (this is Loading) action()
        return this
    }
}

// Advanced sealed class hierarchy for navigation
sealed class Screen {
    abstract val route: String
    
    object Home : Screen() {
        override val route = "home"
    }
    
    object Profile : Screen() {
        override val route = "profile"
    }
    
    data class UserDetail(val userId: String) : Screen() {
        override val route = "user_detail/$userId"
        
        companion object {
            const val routeTemplate = "user_detail/{userId}"
        }
    }
    
    data class Settings(val section: SettingSection? = null) : Screen() {
        override val route = "settings${section?.let { "?section=${it.name}" } ?: ""}"
        
        companion object {
            const val routeTemplate = "settings"
        }
    }
}

enum class SettingSection {
    ACCOUNT, PRIVACY, NOTIFICATIONS
}

// Result pattern for error handling
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val exception: Exception) : Result<Nothing>()
    
    inline fun <R> map(transform: (T) -> R): Result<R> = when (this) {
        is Success -> Success(transform(data))
        is Error -> this
    }
    
    inline fun <R> flatMap(transform: (T) -> Result<R>): Result<R> = when (this) {
        is Success -> transform(data)
        is Error -> this
    }
    
    inline fun onSuccess(action: (T) -> Unit): Result<T> {
        if (this is Success) action(data)
        return this
    }
    
    inline fun onError(action: (Exception) -> Unit): Result<T> {
        if (this is Error) action(exception)
        return this
    }
    
    fun getOrNull(): T? = when (this) {
        is Success -> data
        is Error -> null
    }
    
    fun getOrThrow(): T = when (this) {
        is Success -> data
        is Error -> throw exception
    }
}

// Extension functions for Result
inline fun <T> Result<T>.fold(
    onSuccess: (T) -> Unit,
    onError: (Exception) -> Unit
) {
    when (this) {
        is Result.Success -> onSuccess(data)
        is Result.Error -> onError(exception)
    }
}

suspend inline fun <T> safeApiCall(
    crossinline apiCall: suspend () -> T
): Result<T> = withContext(Dispatchers.IO) {
    try {
        Result.Success(apiCall())
    } catch (e: Exception) {
        Result.Error(e)
    }
}
```

## Jetpack Compose とモダンUI開発

### Compose UI パターンとState Management

```kotlin
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.paging.compose.collectAsLazyPagingItems
import androidx.paging.compose.items

// ViewModel with StateFlow
@HiltViewModel
class UserListViewModel @Inject constructor(
    private val userRepository: UserRepository,
    private val analyticsTracker: AnalyticsTracker
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(UserListUiState())
    val uiState: StateFlow<UserListUiState> = _uiState.asStateFlow()
    
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()
    
    // Paginated users
    val users = userRepository.getUsers().cachedIn(viewModelScope)
    
    // Search results
    val searchResults = searchQuery
        .flatMapLatest { query ->
            if (query.isBlank()) {
                flowOf(emptyList())
            } else {
                userRepository.searchUsers(query)
            }
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )
    
    init {
        loadUsers()
    }
    
    fun loadUsers() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            
            userRepository.observeUserUpdates()
                .catch { e ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = e.message
                    )
                }
                .collect { user ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = null,
                        lastUpdatedUser = user
                    )
                }
        }
    }
    
    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
        analyticsTracker.trackSearch(query)
    }
    
    fun onUserClick(user: User) {
        analyticsTracker.trackUserClick(user.id)
    }
    
    fun onRefresh() {
        loadUsers()
    }
}

data class UserListUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val lastUpdatedUser: User? = null
)

// Compose UI with modern patterns
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UserListScreen(
    onNavigateToUser: (String) -> Unit,
    viewModel: UserListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val searchQuery by viewModel.searchQuery.collectAsStateWithLifecycle()
    val searchResults by viewModel.searchResults.collectAsStateWithLifecycle()
    
    val users = viewModel.users.collectAsLazyPagingItems()
    val pullRefreshState = rememberPullRefreshState(
        refreshing = uiState.isLoading,
        onRefresh = viewModel::onRefresh
    )
    
    var isSearchActive by remember { mutableStateOf(false) }
    
    Column(modifier = Modifier.fillMaxSize()) {
        // Search Bar
        SearchBar(
            query = searchQuery,
            onQueryChange = viewModel::onSearchQueryChanged,
            onSearch = { isSearchActive = false },
            active = isSearchActive,
            onActiveChange = { isSearchActive = it },
            placeholder = { Text("Search users...") },
            modifier = Modifier.fillMaxWidth()
        ) {
            // Search results
            LazyColumn {
                items(searchResults) { user ->
                    UserItem(
                        user = user,
                        onClick = {
                            viewModel.onUserClick(user)
                            onNavigateToUser(user.id)
                            isSearchActive = false
                        }
                    )
                }
            }
        }
        
        Box(
            modifier = Modifier
                .fillMaxSize()
                .pullRefresh(pullRefreshState)
        ) {
            if (!isSearchActive) {
                // Main user list
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(16.dp)
                ) {
                    items(users) { user ->
                        user?.let {
                            UserItem(
                                user = it,
                                onClick = {
                                    viewModel.onUserClick(it)
                                    onNavigateToUser(it.id)
                                }
                            )
                        }
                    }
                    
                    // Loading indicator for pagination
                    item {
                        if (users.loadState.append is LoadState.Loading) {
                            Box(
                                modifier = Modifier.fillMaxWidth(),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator()
                            }
                        }
                    }
                }
            }
            
            PullRefreshIndicator(
                refreshing = uiState.isLoading,
                state = pullRefreshState,
                modifier = Modifier.align(Alignment.TopCenter)
            )
        }
    }
    
    // Handle errors
    uiState.error?.let { error ->
        LaunchedEffect(error) {
            // Show snackbar or error dialog
        }
    }
}

// Reusable composable component
@Composable
fun UserItem(
    user: User,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            AsyncImage(
                model = user.avatarUrl,
                contentDescription = null,
                modifier = Modifier.size(50.dp),
                placeholder = painterResource(R.drawable.ic_person_placeholder),
                error = painterResource(R.drawable.ic_person_placeholder)
            )
            
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = user.name,
                    style = MaterialTheme.typography.titleMedium
                )
                
                Text(
                    text = user.email,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                
                if (user.isOnline) {
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(
                            Icons.Filled.Circle,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(8.dp)
                        )
                        Text(
                            text = "Online",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
            
            if (user.isVerified) {
                Icon(
                    Icons.Filled.Verified,
                    contentDescription = "Verified",
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

// Custom composable with animation
@Composable
fun AnimatedUserCounter(
    count: Int,
    modifier: Modifier = Modifier
) {
    var previousCount by remember { mutableIntStateOf(count) }
    val animatedCount by animateIntAsState(
        targetValue = count,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "user_count"
    )
    
    LaunchedEffect(count) {
        previousCount = count
    }
    
    Text(
        text = animatedCount.toString(),
        style = MaterialTheme.typography.headlineMedium,
        modifier = modifier
    )
}
```

### Theme System とDesign System実装

```kotlin
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Custom color palette
data class AppColors(
    val primary: Color,
    val onPrimary: Color,
    val secondary: Color,
    val onSecondary: Color,
    val surface: Color,
    val onSurface: Color,
    val background: Color,
    val onBackground: Color,
    val error: Color,
    val onError: Color,
    // Custom app colors
    val success: Color,
    val onSuccess: Color,
    val warning: Color,
    val onWarning: Color,
    val info: Color,
    val onInfo: Color
)

// Light theme colors
private val LightAppColors = AppColors(
    primary = Color(0xFF6750A4),
    onPrimary = Color(0xFFFFFFFF),
    secondary = Color(0xFF625B71),
    onSecondary = Color(0xFFFFFFFF),
    surface = Color(0xFFFFFBFE),
    onSurface = Color(0xFF1C1B1F),
    background = Color(0xFFFFFBFE),
    onBackground = Color(0xFF1C1B1F),
    error = Color(0xFFBA1A1A),
    onError = Color(0xFFFFFFFF),
    success = Color(0xFF4CAF50),
    onSuccess = Color(0xFFFFFFFF),
    warning = Color(0xFFFF9800),
    onWarning = Color(0xFFFFFFFF),
    info = Color(0xFF2196F3),
    onInfo = Color(0xFFFFFFFF)
)

// Dark theme colors
private val DarkAppColors = AppColors(
    primary = Color(0xFFD0BCFF),
    onPrimary = Color(0xFF381E72),
    secondary = Color(0xFFCCC2DC),
    onSecondary = Color(0xFF332D41),
    surface = Color(0xFF1C1B1F),
    onSurface = Color(0xFFE6E1E5),
    background = Color(0xFF1C1B1F),
    onBackground = Color(0xFFE6E1E5),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    success = Color(0xFF81C784),
    onSuccess = Color(0xFF2E7D32),
    warning = Color(0xFFFFB74D),
    onWarning = Color(0xFFF57C00),
    info = Color(0xFF64B5F6),
    onInfo = Color(0xFF1565C0)
)

// Typography
data class AppTypography(
    val displayLarge: TextStyle,
    val displayMedium: TextStyle,
    val displaySmall: TextStyle,
    val headlineLarge: TextStyle,
    val headlineMedium: TextStyle,
    val headlineSmall: TextStyle,
    val titleLarge: TextStyle,
    val titleMedium: TextStyle,
    val titleSmall: TextStyle,
    val bodyLarge: TextStyle,
    val bodyMedium: TextStyle,
    val bodySmall: TextStyle,
    val labelLarge: TextStyle,
    val labelMedium: TextStyle,
    val labelSmall: TextStyle
)

private val AppTypographyValues = AppTypography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Light,
        fontSize = 57.sp,
        lineHeight = 64.sp,
        letterSpacing = (-0.25).sp
    ),
    displayMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 45.sp,
        lineHeight = 52.sp,
        letterSpacing = 0.sp
    ),
    displaySmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 36.sp,
        lineHeight = 44.sp,
        letterSpacing = 0.sp
    ),
    headlineLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 32.sp,
        lineHeight = 40.sp,
        letterSpacing = 0.sp
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 28.sp,
        lineHeight = 36.sp,
        letterSpacing = 0.sp
    ),
    headlineSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 24.sp,
        lineHeight = 32.sp,
        letterSpacing = 0.sp
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 22.sp,
        lineHeight = 28.sp,
        letterSpacing = 0.sp
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.15.sp
    ),
    titleSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.1.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.15.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.25.sp
    ),
    bodySmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.4.sp
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.1.sp
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp
    )
)

// Spacing system
data class AppSpacing(
    val none: androidx.compose.ui.unit.Dp = 0.dp,
    val extraSmall: androidx.compose.ui.unit.Dp = 4.dp,
    val small: androidx.compose.ui.unit.Dp = 8.dp,
    val medium: androidx.compose.ui.unit.Dp = 16.dp,
    val large: androidx.compose.ui.unit.Dp = 24.dp,
    val extraLarge: androidx.compose.ui.unit.Dp = 32.dp,
    val huge: androidx.compose.ui.unit.Dp = 48.dp
)

// Composition locals for theme system
val LocalAppColors = staticCompositionLocalOf<AppColors> { error("No AppColors provided") }
val LocalAppTypography = staticCompositionLocalOf<AppTypography> { error("No AppTypography provided") }
val LocalAppSpacing = staticCompositionLocalOf<AppSpacing> { error("No AppSpacing provided") }

// Theme composable
@Composable
fun MyAppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val appColors = if (darkTheme) DarkAppColors else LightAppColors
    val spacing = AppSpacing()
    
    val materialColors = if (darkTheme) {
        darkColorScheme(
            primary = appColors.primary,
            onPrimary = appColors.onPrimary,
            secondary = appColors.secondary,
            onSecondary = appColors.onSecondary,
            surface = appColors.surface,
            onSurface = appColors.onSurface,
            background = appColors.background,
            onBackground = appColors.onBackground,
            error = appColors.error,
            onError = appColors.onError
        )
    } else {
        lightColorScheme(
            primary = appColors.primary,
            onPrimary = appColors.onPrimary,
            secondary = appColors.secondary,
            onSecondary = appColors.onSecondary,
            surface = appColors.surface,
            onSurface = appColors.onSurface,
            background = appColors.background,
            onBackground = appColors.onBackground,
            error = appColors.error,
            onError = appColors.onError
        )
    }
    
    CompositionLocalProvider(
        LocalAppColors provides appColors,
        LocalAppTypography provides AppTypographyValues,
        LocalAppSpacing provides spacing
    ) {
        MaterialTheme(
            colorScheme = materialColors,
            content = content
        )
    }
}

// Extension object for easy access
object MyAppTheme {
    val colors: AppColors
        @Composable
        get() = LocalAppColors.current
    
    val typography: AppTypography
        @Composable
        get() = LocalAppTypography.current
    
    val spacing: AppSpacing
        @Composable
        get() = LocalAppSpacing.current
}

// Usage example
@Composable
fun ThemedComponent() {
    Column(
        modifier = Modifier.padding(MyAppTheme.spacing.medium)
    ) {
        Text(
            text = "Success Message",
            style = MyAppTheme.typography.titleMedium,
            color = MyAppTheme.colors.success
        )
        
        Spacer(modifier = Modifier.height(MyAppTheme.spacing.small))
        
        Text(
            text = "This is a success message with custom theming",
            style = MyAppTheme.typography.bodyMedium,
            color = MyAppTheme.colors.onSuccess
        )
    }
}
```

## Kotlin Multiplatform Mobile (KMM)

### 共通ビジネスロジックの実装

```kotlin
// commonMain - 共通モジュール
// expect/actual パターンでプラットフォーム固有の実装を抽象化

// Platform-specific implementations
expect class Platform() {
    val name: String
    val osVersion: String
    val deviceModel: String
}

expect fun getCurrentTimeMillis(): Long

expect class Logger {
    fun debug(tag: String, message: String)
    fun info(tag: String, message: String)
    fun error(tag: String, message: String, throwable: Throwable? = null)
}

// 共通のHTTPクライアント
expect class HttpClient {
    suspend fun get(url: String, headers: Map<String, String> = emptyMap()): HttpResponse
    suspend fun post(url: String, body: String, headers: Map<String, String> = emptyMap()): HttpResponse
}

data class HttpResponse(
    val statusCode: Int,
    val body: String,
    val headers: Map<String, String>
)

// 共通のデータ層
interface UserDataSource {
    suspend fun getUsers(): List<User>
    suspend fun getUser(id: String): User?
    suspend fun saveUser(user: User)
    suspend fun deleteUser(id: String)
}

class UserRepository(
    private val remoteDataSource: RemoteUserDataSource,
    private val localDataSource: LocalUserDataSource,
    private val logger: Logger
) {
    suspend fun getUsers(forceRefresh: Boolean = false): Result<List<User>> {
        return try {
            if (forceRefresh) {
                val remoteUsers = remoteDataSource.getUsers()
                localDataSource.saveUsers(remoteUsers)
                Result.Success(remoteUsers)
            } else {
                val localUsers = localDataSource.getUsers()
                if (localUsers.isNotEmpty()) {
                    Result.Success(localUsers)
                } else {
                    val remoteUsers = remoteDataSource.getUsers()
                    localDataSource.saveUsers(remoteUsers)
                    Result.Success(remoteUsers)
                }
            }
        } catch (e: Exception) {
            logger.error("UserRepository", "Failed to get users", e)
            Result.Error(e)
        }
    }
    
    suspend fun syncUserData(): Result<Unit> {
        return try {
            val localUsers = localDataSource.getUsers()
            val remoteUsers = remoteDataSource.getUsers()
            
            // Sync logic - merge local and remote changes
            val mergedUsers = mergeUserData(localUsers, remoteUsers)
            
            // Save merged data locally
            localDataSource.saveUsers(mergedUsers)
            
            // Update remote if needed
            val localChanges = localUsers.filter { it.isModified }
            localChanges.forEach { user ->
                remoteDataSource.updateUser(user)
            }
            
            Result.Success(Unit)
        } catch (e: Exception) {
            logger.error("UserRepository", "Failed to sync user data", e)
            Result.Error(e)
        }
    }
    
    private fun mergeUserData(localUsers: List<User>, remoteUsers: List<User>): List<User> {
        val localMap = localUsers.associateBy { it.id }
        val remoteMap = remoteUsers.associateBy { it.id }
        
        val mergedUsers = mutableListOf<User>()
        
        // Add all remote users, preferring local changes
        remoteMap.forEach { (id, remoteUser) ->
            val localUser = localMap[id]
            
            val mergedUser = when {
                localUser == null -> remoteUser
                localUser.lastModified > remoteUser.lastModified -> localUser
                else -> remoteUser
            }
            
            mergedUsers.add(mergedUser)
        }
        
        // Add local-only users
        localMap.values.forEach { localUser ->
            if (!remoteMap.containsKey(localUser.id)) {
                mergedUsers.add(localUser)
            }
        }
        
        return mergedUsers
    }
}

// 共通のビジネスロジック
class UserUseCase(
    private val userRepository: UserRepository,
    private val analyticsTracker: AnalyticsTracker,
    private val logger: Logger
) {
    
    suspend fun getUserProfile(userId: String): Result<UserProfile> {
        return try {
            analyticsTracker.track("user_profile_viewed", mapOf("user_id" to userId))
            
            val user = userRepository.getUser(userId)
                ?: return Result.Error(Exception("User not found"))
            
            val posts = userRepository.getUserPosts(userId)
            val followers = userRepository.getUserFollowers(userId)
            
            val profile = UserProfile(
                user = user,
                postsCount = posts.size,
                followersCount = followers.size,
                isFollowing = userRepository.isFollowing(userId)
            )
            
            Result.Success(profile)
        } catch (e: Exception) {
            logger.error("UserUseCase", "Failed to get user profile", e)
            Result.Error(e)
        }
    }
    
    suspend fun followUser(userId: String): Result<Unit> {
        return try {
            analyticsTracker.track("user_followed", mapOf("user_id" to userId))
            
            userRepository.followUser(userId)
            
            // Update local cache
            userRepository.invalidateUserCache(userId)
            
            Result.Success(Unit)
        } catch (e: Exception) {
            logger.error("UserUseCase", "Failed to follow user", e)
            Result.Error(e)
        }
    }
}

// データモデル
@Serializable
data class User(
    val id: String,
    val name: String,
    val email: String,
    val avatarUrl: String?,
    val isVerified: Boolean = false,
    val isOnline: Boolean = false,
    val lastSeen: Long? = null,
    val createdAt: Long,
    val lastModified: Long = getCurrentTimeMillis(),
    val isModified: Boolean = false
)

@Serializable
data class UserProfile(
    val user: User,
    val postsCount: Int,
    val followersCount: Int,
    val isFollowing: Boolean
)

// androidMain - Android固有の実装
actual class Platform actual constructor() {
    actual val name: String = "Android ${Build.VERSION.SDK_INT}"
    actual val osVersion: String = Build.VERSION.RELEASE
    actual val deviceModel: String = "${Build.MANUFACTURER} ${Build.MODEL}"
}

actual fun getCurrentTimeMillis(): Long = System.currentTimeMillis()

actual class Logger {
    actual fun debug(tag: String, message: String) {
        Log.d(tag, message)
    }
    
    actual fun info(tag: String, message: String) {
        Log.i(tag, message)
    }
    
    actual fun error(tag: String, message: String, throwable: Throwable?) {
        Log.e(tag, message, throwable)
    }
}

actual class HttpClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    
    actual suspend fun get(url: String, headers: Map<String, String>): HttpResponse {
        return withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url(url)
                .apply {
                    headers.forEach { (key, value) ->
                        addHeader(key, value)
                    }
                }
                .build()
            
            val response = client.newCall(request).execute()
            HttpResponse(
                statusCode = response.code,
                body = response.body?.string() ?: "",
                headers = response.headers.toMultimap().mapValues { it.value.first() }
            )
        }
    }
    
    actual suspend fun post(url: String, body: String, headers: Map<String, String>): HttpResponse {
        return withContext(Dispatchers.IO) {
            val requestBody = body.toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url(url)
                .post(requestBody)
                .apply {
                    headers.forEach { (key, value) ->
                        addHeader(key, value)
                    }
                }
                .build()
            
            val response = client.newCall(request).execute()
            HttpResponse(
                statusCode = response.code,
                body = response.body?.string() ?: "",
                headers = response.headers.toMultimap().mapValues { it.value.first() }
            )
        }
    }
}

// Android-specific ViewModel
@HiltViewModel
class AndroidUserViewModel @Inject constructor(
    private val userUseCase: UserUseCase,
    savedStateHandle: SavedStateHandle
) : ViewModel() {
    
    private val userId: String = savedStateHandle.get<String>("userId") ?: ""
    
    private val _uiState = MutableStateFlow(UserProfileUiState())
    val uiState: StateFlow<UserProfileUiState> = _uiState.asStateFlow()
    
    init {
        loadUserProfile()
    }
    
    private fun loadUserProfile() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            
            userUseCase.getUserProfile(userId)
                .onSuccess { profile ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        userProfile = profile,
                        error = null
                    )
                }
                .onError { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message
                    )
                }
        }
    }
    
    fun followUser() {
        viewModelScope.launch {
            userUseCase.followUser(userId)
                .onSuccess {
                    loadUserProfile() // Refresh profile
                }
                .onError { error ->
                    _uiState.value = _uiState.value.copy(error = error.message)
                }
        }
    }
}

data class UserProfileUiState(
    val isLoading: Boolean = false,
    val userProfile: UserProfile? = null,
    val error: String? = null
)
```

## Room Database とSQLDelight統合

### モダンデータベースパターン

```kotlin
// Room Database setup
@Database(
    entities = [UserEntity::class, PostEntity::class, UserPostCrossRef::class],
    version = 1,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun postDao(): PostDao
    
    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null
        
        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "app_database"
                )
                .addMigrations(MIGRATION_1_2)
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
        
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL("ALTER TABLE users ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0")
            }
        }
    }
}

// Entity definitions
@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey val id: String,
    val name: String,
    val email: String,
    @ColumnInfo(name = "avatar_url") val avatarUrl: String?,
    @ColumnInfo(name = "is_verified") val isVerified: Boolean = false,
    @ColumnInfo(name = "is_online") val isOnline: Boolean = false,
    @ColumnInfo(name = "last_seen") val lastSeen: Long? = null,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "is_premium") val isPremium: Boolean = false
)

@Entity(tableName = "posts")
data class PostEntity(
    @PrimaryKey val id: String,
    val title: String,
    val content: String,
    @ColumnInfo(name = "author_id") val authorId: String,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(name = "like_count") val likeCount: Int = 0,
    @ColumnInfo(name = "comment_count") val commentCount: Int = 0
)

// Many-to-many relationship
@Entity(
    tableName = "user_post_cross_ref",
    primaryKeys = ["userId", "postId"],
    foreignKeys = [
        ForeignKey(
            entity = UserEntity::class,
            parentColumns = ["id"],
            childColumns = ["userId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = PostEntity::class,
            parentColumns = ["id"],
            childColumns = ["postId"],
            onDelete = ForeignKey.CASCADE
        )
    ]
)
data class UserPostCrossRef(
    val userId: String,
    val postId: String,
    val relationship: String // "liked", "bookmarked", "shared"
)

// Advanced DAO with complex queries
@Dao
interface UserDao {
    @Query("SELECT * FROM users WHERE id = :id")
    suspend fun getUserById(id: String): UserEntity?
    
    @Query("SELECT * FROM users ORDER BY created_at DESC")
    fun getAllUsersFlow(): Flow<List<UserEntity>>
    
    @Query("SELECT * FROM users ORDER BY name ASC")
    fun getAllUsersPaged(): PagingSource<Int, UserEntity>
    
    @Query("""
        SELECT u.* FROM users u
        INNER JOIN user_post_cross_ref upcr ON u.id = upcr.userId
        WHERE upcr.postId = :postId AND upcr.relationship = 'liked'
        ORDER BY u.name ASC
    """)
    suspend fun getUsersWhoLikedPost(postId: String): List<UserEntity>
    
    @Query("""
        SELECT u.*, 
               COUNT(p.id) as post_count,
               MAX(p.created_at) as last_post_date
        FROM users u
        LEFT JOIN posts p ON u.id = p.author_id
        WHERE u.name LIKE '%' || :searchTerm || '%' 
           OR u.email LIKE '%' || :searchTerm || '%'
        GROUP BY u.id
        HAVING post_count > :minPosts
        ORDER BY post_count DESC, last_post_date DESC
        LIMIT :limit
    """)
    suspend fun searchActiveUsers(
        searchTerm: String,
        minPosts: Int = 5,
        limit: Int = 50
    ): List<UserWithStats>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUser(user: UserEntity)
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUsers(users: List<UserEntity>)
    
    @Update
    suspend fun updateUser(user: UserEntity)
    
    @Delete
    suspend fun deleteUser(user: UserEntity)
    
    @Query("DELETE FROM users WHERE id = :id")
    suspend fun deleteUserById(id: String)
    
    // Transaction example
    @Transaction
    suspend fun updateUserAndPosts(user: UserEntity, posts: List<PostEntity>) {
        updateUser(user)
        posts.forEach { post ->
            // Update posts logic here
        }
    }
}

// Data class for complex queries
data class UserWithStats(
    @Embedded val user: UserEntity,
    @ColumnInfo(name = "post_count") val postCount: Int,
    @ColumnInfo(name = "last_post_date") val lastPostDate: Long?
)

// Repository with Room integration
@Singleton
class RoomUserRepository @Inject constructor(
    private val userDao: UserDao,
    private val apiService: UserApiService
) : UserRepository {
    
    override fun observeUsers(): Flow<List<User>> = 
        userDao.getAllUsersFlow()
            .map { entities -> entities.map { it.toDomain() } }
            .flowOn(Dispatchers.IO)
    
    override suspend fun getUserById(id: String): User? = 
        withContext(Dispatchers.IO) {
            userDao.getUserById(id)?.toDomain()
        }
    
    override suspend fun syncUsers(): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val remoteUsers = apiService.getUsers()
            val userEntities = remoteUsers.map { it.toEntity() }
            userDao.insertUsers(userEntities)
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Error(e)
        }
    }
    
    override suspend fun searchUsers(query: String): List<User> = 
        withContext(Dispatchers.IO) {
            userDao.searchActiveUsers(query)
                .map { it.user.toDomain() }
        }
    
    // Pagination with Room
    fun getUsersPaged(): Flow<PagingData<User>> = 
        Pager(
            config = PagingConfig(pageSize = 20),
            pagingSourceFactory = { userDao.getAllUsersPaged() }
        ).flow.map { pagingData ->
            pagingData.map { it.toDomain() }
        }
}

// Extension functions for mapping
fun UserEntity.toDomain(): User = User(
    id = id,
    name = name,
    email = email,
    avatarUrl = avatarUrl,
    isVerified = isVerified,
    isOnline = isOnline,
    lastSeen = lastSeen,
    createdAt = createdAt
)

fun User.toEntity(): UserEntity = UserEntity(
    id = id,
    name = name,
    email = email,
    avatarUrl = avatarUrl,
    isVerified = isVerified,
    isOnline = isOnline,
    lastSeen = lastSeen,
    createdAt = createdAt
)

// Type converters for complex data types
class Converters {
    @TypeConverter
    fun fromStringList(value: List<String>): String {
        return Gson().toJson(value)
    }
    
    @TypeConverter
    fun toStringList(value: String): List<String> {
        return Gson().fromJson(value, object : TypeToken<List<String>>() {}.type)
    }
    
    @TypeConverter
    fun fromDate(date: Date?): Long? {
        return date?.time
    }
    
    @TypeConverter
    fun toDate(timestamp: Long?): Date? {
        return timestamp?.let { Date(it) }
    }
}
```

## WorkManager とバックグラウンド処理

### バックグラウンドタスクの最適化

```kotlin
// WorkManager を使用したバックグラウンド処理
class DataSyncWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {
    
    override suspend fun doWork(): Result {
        return try {
            val userRepository = (applicationContext as MyApplication).userRepository
            val syncResult = userRepository.syncUsers()
            
            when (syncResult) {
                is Result.Success -> {
                    setProgress(workDataOf("progress" to 100))
                    Result.success(
                        workDataOf(
                            "sync_completed" to true,
                            "timestamp" to System.currentTimeMillis()
                        )
                    )
                }
                is Result.Error -> {
                    if (runAttemptCount < 3) {
                        Result.retry()
                    } else {
                        Result.failure(
                            workDataOf("error" to syncResult.exception.message)
                        )
                    }
                }
            }
        } catch (e: Exception) {
            Result.failure(workDataOf("error" to e.message))
        }
    }
}

// WorkManager 設定とスケジューリング
@Singleton
class WorkManagerService @Inject constructor(
    private val workManager: WorkManager,
    private val context: Context
) {
    
    fun scheduleDataSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .setRequiresStorageNotLow(true)
            .build()
        
        val syncWorkRequest = PeriodicWorkRequestBuilder<DataSyncWorker>(
            repeatInterval = 15,
            repeatIntervalTimeUnit = TimeUnit.MINUTES,
            flexTimeInterval = 5,
            flexTimeIntervalUnit = TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                30,
                TimeUnit.SECONDS
            )
            .addTag("data_sync")
            .build()
        
        workManager.enqueueUniquePeriodicWork(
            "data_sync_work",
            ExistingPeriodicWorkPolicy.KEEP,
            syncWorkRequest
        )
    }
    
    fun scheduleOneTimeSync() {
        val syncWorkRequest = OneTimeWorkRequestBuilder<DataSyncWorker>()
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .build()
        
        workManager.enqueueUniqueWork(
            "immediate_sync",
            ExistingWorkPolicy.REPLACE,
            syncWorkRequest
        )
    }
    
    fun observeSyncProgress(): Flow<WorkInfo?> {
        return workManager
            .getWorkInfosForUniqueWorkLiveData("data_sync_work")
            .asFlow()
            .map { workInfoList -> workInfoList.firstOrNull() }
    }
    
    fun cancelSync() {
        workManager.cancelUniqueWork("data_sync_work")
    }
}

// Chained work for complex workflows
class ComplexWorkflowManager @Inject constructor(
    private val workManager: WorkManager
) {
    
    fun startImageProcessingWorkflow(imageUrls: List<String>) {
        val downloadRequests = imageUrls.mapIndexed { index, url ->
            OneTimeWorkRequestBuilder<ImageDownloadWorker>()
                .setInputData(workDataOf("image_url" to url, "index" to index))
                .build()
        }
        
        val processRequest = OneTimeWorkRequestBuilder<ImageProcessingWorker>()
            .build()
        
        val uploadRequest = OneTimeWorkRequestBuilder<ImageUploadWorker>()
            .build()
        
        // Chain work: Download all images -> Process them -> Upload results
        workManager
            .beginWith(downloadRequests)
            .then(processRequest)
            .then(uploadRequest)
            .enqueue()
    }
}

// Image download worker
class ImageDownloadWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {
    
    override suspend fun doWork(): Result {
        val imageUrl = inputData.getString("image_url") ?: return Result.failure()
        val index = inputData.getInt("index", 0)
        
        return try {
            val imageFile = downloadImage(imageUrl)
            
            Result.success(
                workDataOf(
                    "downloaded_file_path" to imageFile.absolutePath,
                    "index" to index
                )
            )
        } catch (e: Exception) {
            Result.failure(workDataOf("error" to e.message))
        }
    }
    
    private suspend fun downloadImage(url: String): File {
        // Image download implementation
        val httpClient = OkHttpClient()
        val request = Request.Builder().url(url).build()
        val response = httpClient.newCall(request).execute()
        
        val file = File(applicationContext.cacheDir, "image_${System.currentTimeMillis()}.jpg")
        file.outputStream().use { output ->
            response.body?.byteStream()?.use { input ->
                input.copyTo(output)
            }
        }
        
        return file
    }
}

// Foreground service for long-running tasks
class DataSyncForegroundService : Service() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val notificationId = 1001
    private val channelId = "data_sync_channel"
    
    private lateinit var userRepository: UserRepository
    
    override fun onCreate() {
        super.onCreate()
        userRepository = (application as MyApplication).userRepository
        createNotificationChannel()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_SYNC -> startSync()
            ACTION_STOP_SYNC -> stopSync()
        }
        return START_NOT_STICKY
    }
    
    private fun startSync() {
        val notification = createSyncNotification()
        startForeground(notificationId, notification)
        
        serviceScope.launch {
            try {
                val result = userRepository.performFullSync()
                
                when (result) {
                    is SyncResult.Success -> {
                        updateNotification("Sync completed successfully")
                        stopSelf()
                    }
                    is SyncResult.Error -> {
                        updateNotification("Sync failed: ${result.error.message}")
                        stopSelf()
                    }
                    SyncResult.Timeout -> {
                        updateNotification("Sync timed out")
                        stopSelf()
                    }
                }
            } catch (e: Exception) {
                updateNotification("Sync error: ${e.message}")
                stopSelf()
            }
        }
    }
    
    private fun stopSync() {
        serviceScope.coroutineContext.cancelChildren()
        stopSelf()
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Data Sync",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Background data synchronization"
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun createSyncNotification(): Notification {
        return NotificationCompat.Builder(this, channelId)
            .setContentTitle("Syncing data...")
            .setContentText("Synchronizing user data with server")
            .setSmallIcon(R.drawable.ic_sync)
            .setOngoing(true)
            .addAction(
                R.drawable.ic_stop,
                "Stop",
                PendingIntent.getService(
                    this,
                    0,
                    Intent(this, DataSyncForegroundService::class.java).apply {
                        action = ACTION_STOP_SYNC
                    },
                    PendingIntent.FLAG_IMMUTABLE
                )
            )
            .build()
    }
    
    private fun updateNotification(message: String) {
        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Data Sync")
            .setContentText(message)
            .setSmallIcon(R.drawable.ic_sync)
            .setOngoing(false)
            .build()
        
        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(notificationId, notification)
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }
    
    companion object {
        const val ACTION_START_SYNC = "com.app.START_SYNC"
        const val ACTION_STOP_SYNC = "com.app.STOP_SYNC"
    }
}
```

## ベストプラクティス

1. **Coroutines**: structured concurrency でリソースリークを防止
2. **Flow**: reactive プログラミングでUI状態管理を効率化
3. **Sealed Classes**: type-safe な状態表現とエラーハンドリング
4. **Jetpack Compose**: 宣言的UIで保守性向上
5. **KMM**: ビジネスロジックの共通化でコード重複削減  
6. **Room**: type-safe なデータベース操作とFlowとの統合
7. **WorkManager**: バックグラウンド処理の確実な実行
8. **Dependency Injection**: Hiltでテスタブルな設計
9. **Testing**: MockK、Turbine、Robolectric の活用
10. **Performance**: メモリリーク監視、APK最適化、ProGuard設定