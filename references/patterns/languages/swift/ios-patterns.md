# Swift iOS 開発実践パターン

## モダンSwift言語機能とSwiftUI

### Async/Await と Actor による並行プログラミング

```swift
import Foundation
import SwiftUI
import Combine

// Actor を使用したスレッドセーフなデータ管理
@globalActor
actor DatabaseActor {
    static let shared = DatabaseActor()
    
    private var cache: [String: Any] = [:]
    private let queue = DispatchQueue(label: "database.queue", qos: .utility)
    
    func save<T: Codable>(_ object: T, key: String) async throws {
        let data = try JSONEncoder().encode(object)
        cache[key] = data
        
        // ファイルシステムへの非同期保存
        try await withCheckedThrowingContinuation { continuation in
            queue.async {
                do {
                    let url = self.getDocumentsDirectory().appendingPathComponent("\(key).json")
                    try data.write(to: url)
                    continuation.resume()
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }
    
    func load<T: Codable>(_ type: T.Type, key: String) async throws -> T? {
        // キャッシュから確認
        if let cachedData = cache[key] as? Data {
            return try JSONDecoder().decode(type, from: cachedData)
        }
        
        // ファイルシステムから読み込み
        return try await withCheckedThrowingContinuation { continuation in
            queue.async {
                do {
                    let url = self.getDocumentsDirectory().appendingPathComponent("\(key).json")
                    let data = try Data(contentsOf: url)
                    self.cache[key] = data
                    let object = try JSONDecoder().decode(type, from: data)
                    continuation.resume(returning: object)
                } catch {
                    continuation.resume(returning: nil)
                }
            }
        }
    }
    
    private func getDocumentsDirectory() -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
}

// Async/Await を活用したネットワーキング
class NetworkService {
    private let session: URLSession
    private let decoder = JSONDecoder()
    
    init() {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: configuration)
    }
    
    // Generic async networking method
    func request<T: Codable>(
        _ type: T.Type,
        endpoint: String,
        method: HTTPMethod = .GET,
        body: Data? = nil,
        headers: [String: String] = [:]
    ) async throws -> T {
        guard let url = URL(string: endpoint) else {
            throw NetworkError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.httpBody = body
        
        // デフォルトヘッダーを追加
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        
        // カスタムヘッダーを追加
        headers.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }
        
        // Retry機能付きリクエスト実行
        return try await performRequestWithRetry(request: request, type: type, maxRetries: 3)
    }
    
    private func performRequestWithRetry<T: Codable>(
        request: URLRequest,
        type: T.Type,
        maxRetries: Int,
        currentAttempt: Int = 1
    ) async throws -> T {
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw NetworkError.invalidResponse
            }
            
            // ステータスコード確認
            switch httpResponse.statusCode {
            case 200...299:
                return try decoder.decode(type, from: data)
            case 429, 500...599:
                // リトライ可能なエラー
                if currentAttempt < maxRetries {
                    let delay = Double(currentAttempt) * 0.5
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                    return try await performRequestWithRetry(
                        request: request,
                        type: type,
                        maxRetries: maxRetries,
                        currentAttempt: currentAttempt + 1
                    )
                } else {
                    throw NetworkError.serverError(httpResponse.statusCode)
                }
            default:
                throw NetworkError.httpError(httpResponse.statusCode)
            }
        } catch {
            if currentAttempt < maxRetries && error is URLError {
                let delay = Double(currentAttempt) * 0.5
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                return try await performRequestWithRetry(
                    request: request,
                    type: type,
                    maxRetries: maxRetries,
                    currentAttempt: currentAttempt + 1
                )
            } else {
                throw error
            }
        }
    }
}

enum HTTPMethod: String {
    case GET = "GET"
    case POST = "POST"
    case PUT = "PUT"
    case DELETE = "DELETE"
    case PATCH = "PATCH"
}

enum NetworkError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case serverError(Int)
    case httpError(Int)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response"
        case .serverError(let code):
            return "Server error: \(code)"
        case .httpError(let code):
            return "HTTP error: \(code)"
        }
    }
}
```

### SwiftUI の高度なパターンとアーキテクチャ

```swift
import SwiftUI
import Combine

// MVVM + Repository パターンの実装
protocol UserRepository {
    func fetchUsers() async throws -> [User]
    func fetchUser(id: String) async throws -> User?
    func saveUser(_ user: User) async throws
    func deleteUser(id: String) async throws
}

class DefaultUserRepository: UserRepository {
    private let networkService: NetworkService
    
    init(networkService: NetworkService = NetworkService()) {
        self.networkService = networkService
    }
    
    func fetchUsers() async throws -> [User] {
        try await networkService.request([User].self, endpoint: "/api/users")
    }
    
    func fetchUser(id: String) async throws -> User? {
        try await networkService.request(User.self, endpoint: "/api/users/\(id)")
    }
    
    @DatabaseActor
    func saveUser(_ user: User) async throws {
        try await networkService.request(
            User.self,
            endpoint: "/api/users",
            method: .POST,
            body: try JSONEncoder().encode(user)
        )
        // ローカルキャッシュにも保存
        try await DatabaseActor.shared.save(user, key: "user_\(user.id)")
    }
    
    func deleteUser(id: String) async throws {
        try await networkService.request(
            EmptyResponse.self,
            endpoint: "/api/users/\(id)",
            method: .DELETE
        )
    }
}

// Observable ViewModel
@MainActor
class UserListViewModel: ObservableObject {
    @Published var users: [User] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var searchText = ""
    
    private let repository: UserRepository
    private var cancellables = Set<AnyCancellable>()
    private let refreshSubject = PassthroughSubject<Void, Never>()
    
    var filteredUsers: [User] {
        if searchText.isEmpty {
            return users
        }
        return users.filter { user in
            user.name.localizedCaseInsensitiveContains(searchText) ||
            user.email.localizedCaseInsensitiveContains(searchText)
        }
    }
    
    init(repository: UserRepository = DefaultUserRepository()) {
        self.repository = repository
        setupBindings()
    }
    
    private func setupBindings() {
        // 自動リフレッシュの設定
        refreshSubject
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .sink { [weak self] in
                Task {
                    await self?.loadUsers()
                }
            }
            .store(in: &cancellables)
        
        // 検索テキストの変更を監視
        $searchText
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)
    }
    
    func loadUsers() async {
        isLoading = true
        errorMessage = nil
        
        do {
            let fetchedUsers = try await repository.fetchUsers()
            users = fetchedUsers
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func refresh() {
        refreshSubject.send()
    }
    
    func deleteUser(_ user: User) async {
        do {
            try await repository.deleteUser(id: user.id)
            users.removeAll { $0.id == user.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// SwiftUI View with modern patterns
struct UserListView: View {
    @StateObject private var viewModel = UserListViewModel()
    @State private var selectedUser: User?
    @State private var showingAddUser = false
    
    var body: some View {
        NavigationView {
            ZStack {
                if viewModel.isLoading && viewModel.users.isEmpty {
                    ProgressView("Loading users...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    userList
                }
            }
            .navigationTitle("Users")
            .navigationBarTitleDisplayMode(.large)
            .searchable(text: $viewModel.searchText, prompt: "Search users")
            .refreshable {
                await viewModel.loadUsers()
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Add") {
                        showingAddUser = true
                    }
                }
            }
            .sheet(isPresented: $showingAddUser) {
                AddUserView()
            }
            .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") {
                    viewModel.errorMessage = nil
                }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
            .task {
                await viewModel.loadUsers()
            }
        }
    }
    
    private var userList: some View {
        List {
            ForEach(viewModel.filteredUsers) { user in
                UserRowView(user: user)
                    .swipeActions(edge: .trailing) {
                        Button("Delete", role: .destructive) {
                            Task {
                                await viewModel.deleteUser(user)
                            }
                        }
                    }
                    .contextMenu {
                        Button("View Details") {
                            selectedUser = user
                        }
                        Button("Edit") {
                            // Edit action
                        }
                        Button("Delete", role: .destructive) {
                            Task {
                                await viewModel.deleteUser(user)
                            }
                        }
                    }
            }
        }
        .listStyle(.insetGrouped)
        .sheet(item: $selectedUser) { user in
            UserDetailView(user: user)
        }
    }
}

// Reusable component with custom styling
struct UserRowView: View {
    let user: User
    
    var body: some View {
        HStack {
            AsyncImage(url: URL(string: user.avatarURL ?? "")) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                Circle()
                    .fill(Color.gray.opacity(0.3))
                    .overlay {
                        Image(systemName: "person.fill")
                            .foregroundColor(.gray)
                    }
            }
            .frame(width: 50, height: 50)
            .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 4) {
                Text(user.name)
                    .font(.headline)
                    .lineLimit(1)
                
                Text(user.email)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                
                if let lastSeen = user.lastSeen {
                    Text("Last seen \(lastSeen.formatted(.relative(presentation: .named)))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            VStack(alignment: .trailing) {
                StatusBadge(status: user.status)
                
                if user.isVIP {
                    Image(systemName: "star.fill")
                        .foregroundColor(.yellow)
                        .font(.caption)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

// Custom ViewModifier for consistent styling
struct CardStyle: ViewModifier {
    let backgroundColor: Color
    let cornerRadius: CGFloat
    
    func body(content: Content) -> some View {
        content
            .padding()
            .background(backgroundColor)
            .cornerRadius(cornerRadius)
            .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
    }
}

extension View {
    func cardStyle(
        backgroundColor: Color = .white,
        cornerRadius: CGFloat = 12
    ) -> some View {
        modifier(CardStyle(backgroundColor: backgroundColor, cornerRadius: cornerRadius))
    }
}
```

### Property Wrappers と Custom Publishers

```swift
import SwiftUI
import Combine
import Foundation

// カスタム Property Wrapper for UserDefaults
@propertyWrapper
struct UserDefault<T> {
    let key: String
    let defaultValue: T
    
    var wrappedValue: T {
        get {
            UserDefaults.standard.object(forKey: key) as? T ?? defaultValue
        }
        set {
            UserDefaults.standard.set(newValue, forKey: key)
        }
    }
    
    var projectedValue: UserDefault<T> {
        return self
    }
}

// Settings management with Property Wrappers
class SettingsManager: ObservableObject {
    @UserDefault(key: "username", defaultValue: "")
    var username: String {
        didSet { objectWillChange.send() }
    }
    
    @UserDefault(key: "isDarkMode", defaultValue: false)
    var isDarkMode: Bool {
        didSet { objectWillChange.send() }
    }
    
    @UserDefault(key: "notificationsEnabled", defaultValue: true)
    var notificationsEnabled: Bool {
        didSet { objectWillChange.send() }
    }
    
    @UserDefault(key: "fontSize", defaultValue: 16.0)
    var fontSize: Double {
        didSet { objectWillChange.send() }
    }
}

// Keychain Property Wrapper for sensitive data
@propertyWrapper
struct Keychain {
    let key: String
    
    var wrappedValue: String? {
        get {
            KeychainHelper.shared.get(key)
        }
        set {
            if let value = newValue {
                KeychainHelper.shared.set(value, for: key)
            } else {
                KeychainHelper.shared.delete(key)
            }
        }
    }
}

class KeychainHelper {
    static let shared = KeychainHelper()
    private init() {}
    
    func set(_ value: String, for key: String) {
        let data = Data(value.utf8)
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }
    
    func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        SecItemCopyMatching(query as CFDictionary, &result)
        
        if let data = result as? Data {
            return String(data: data, encoding: .utf8)
        }
        
        return nil
    }
    
    func delete(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]
        
        SecItemDelete(query as CFDictionary)
    }
}

// Authentication Manager with Keychain storage
class AuthenticationManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    
    @Keychain(key: "auth_token")
    private var authToken: String?
    
    @Keychain(key: "refresh_token")
    private var refreshToken: String?
    
    private let networkService = NetworkService()
    
    func signIn(email: String, password: String) async throws {
        let credentials = LoginCredentials(email: email, password: password)
        let body = try JSONEncoder().encode(credentials)
        
        let response: AuthResponse = try await networkService.request(
            AuthResponse.self,
            endpoint: "/auth/login",
            method: .POST,
            body: body
        )
        
        await MainActor.run {
            self.authToken = response.accessToken
            self.refreshToken = response.refreshToken
            self.currentUser = response.user
            self.isAuthenticated = true
        }
    }
    
    func signOut() {
        authToken = nil
        refreshToken = nil
        currentUser = nil
        isAuthenticated = false
    }
    
    func refreshAccessToken() async throws {
        guard let refreshToken = refreshToken else {
            throw AuthError.noRefreshToken
        }
        
        let request = RefreshTokenRequest(refreshToken: refreshToken)
        let body = try JSONEncoder().encode(request)
        
        let response: AuthResponse = try await networkService.request(
            AuthResponse.self,
            endpoint: "/auth/refresh",
            method: .POST,
            body: body
        )
        
        await MainActor.run {
            self.authToken = response.accessToken
            self.refreshToken = response.refreshToken
        }
    }
    
    var hasValidToken: Bool {
        authToken != nil
    }
}

// Custom Combine Publisher for location updates
class LocationPublisher: NSObject, ObservableObject {
    @Published var location: CLLocation?
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined
    
    private let locationManager = CLLocationManager()
    
    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
    }
    
    func requestPermission() {
        locationManager.requestWhenInUseAuthorization()
    }
    
    func startUpdatingLocation() {
        guard authorizationStatus == .authorizedWhenInUse || authorizationStatus == .authorizedAlways else {
            requestPermission()
            return
        }
        locationManager.startUpdatingLocation()
    }
    
    func stopUpdatingLocation() {
        locationManager.stopUpdatingLocation()
    }
}

extension LocationPublisher: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        location = locations.last
    }
    
    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        authorizationStatus = status
        
        if status == .authorizedWhenInUse || status == .authorizedAlways {
            startUpdatingLocation()
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location error: \(error.localizedDescription)")
    }
}
```

## Core Data とCloudKit統合

### モダンCore Dataパターン

```swift
import CoreData
import CloudKit
import SwiftUI

// Core Data Stack with CloudKit
class CoreDataStack: ObservableObject {
    static let shared = CoreDataStack()
    
    lazy var persistentContainer: NSPersistentCloudKitContainer = {
        let container = NSPersistentCloudKitContainer(name: "DataModel")
        
        // CloudKit configuration
        let storeDescription = container.persistentStoreDescriptions.first
        storeDescription?.setOption(true as NSNumber, forKey: NSPersistentHistoryTrackingKey)
        storeDescription?.setOption(true as NSNumber, forKey: NSPersistentStoreRemoteChangeNotificationPostOptionKey)
        
        container.loadPersistentStores { _, error in
            if let error = error {
                fatalError("Core Data error: \(error.localizedDescription)")
            }
        }
        
        container.viewContext.automaticallyMergesChangesFromParent = true
        return container
    }()
    
    var context: NSManagedObjectContext {
        persistentContainer.viewContext
    }
    
    func save() {
        guard context.hasChanges else { return }
        
        do {
            try context.save()
        } catch {
            print("Save error: \(error.localizedDescription)")
        }
    }
    
    // Background context for heavy operations
    func performBackgroundTask<T>(_ block: @escaping (NSManagedObjectContext) -> T) async -> T {
        return await withCheckedContinuation { continuation in
            persistentContainer.performBackgroundTask { context in
                let result = block(context)
                continuation.resume(returning: result)
            }
        }
    }
}

// Generic Repository pattern for Core Data
protocol CoreDataRepository {
    associatedtype Entity: NSManagedObject
    
    func fetch(predicate: NSPredicate?, sortDescriptors: [NSSortDescriptor]?) async -> [Entity]
    func create() -> Entity
    func save() throws
    func delete(_ entity: Entity)
}

class GenericCoreDataRepository<T: NSManagedObject>: CoreDataRepository {
    typealias Entity = T
    
    private let context: NSManagedObjectContext
    
    init(context: NSManagedObjectContext = CoreDataStack.shared.context) {
        self.context = context
    }
    
    func fetch(predicate: NSPredicate? = nil, sortDescriptors: [NSSortDescriptor]? = nil) async -> [T] {
        return await CoreDataStack.shared.performBackgroundTask { context in
            let request = NSFetchRequest<T>(entityName: String(describing: T.self))
            request.predicate = predicate
            request.sortDescriptors = sortDescriptors
            
            do {
                return try context.fetch(request)
            } catch {
                print("Fetch error: \(error.localizedDescription)")
                return []
            }
        }
    }
    
    func create() -> T {
        return T(context: context)
    }
    
    func save() throws {
        guard context.hasChanges else { return }
        try context.save()
    }
    
    func delete(_ entity: T) {
        context.delete(entity)
    }
}

// SwiftUI integration with @FetchRequest
struct UserListCoreDataView: View {
    @FetchRequest(
        entity: CDUser.entity(),
        sortDescriptors: [NSSortDescriptor(keyPath: \CDUser.name, ascending: true)],
        predicate: NSPredicate(format: "isActive == %@", NSNumber(value: true))
    ) var users: FetchedResults<CDUser>
    
    @Environment(\.managedObjectContext) private var context
    
    var body: some View {
        List {
            ForEach(users, id: \.objectID) { user in
                VStack(alignment: .leading) {
                    Text(user.name ?? "Unknown")
                        .font(.headline)
                    Text(user.email ?? "")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
            .onDelete(perform: deleteUsers)
        }
        .navigationTitle("Users")
        .toolbar {
            Button("Add") {
                addUser()
            }
        }
    }
    
    private func addUser() {
        let user = CDUser(context: context)
        user.id = UUID()
        user.name = "New User"
        user.email = "user@example.com"
        user.createdAt = Date()
        user.isActive = true
        
        do {
            try context.save()
        } catch {
            print("Save error: \(error.localizedDescription)")
        }
    }
    
    private func deleteUsers(offsets: IndexSet) {
        withAnimation {
            offsets.map { users[$0] }.forEach(context.delete)
            
            do {
                try context.save()
            } catch {
                print("Delete error: \(error.localizedDescription)")
            }
        }
    }
}

// CloudKit synchronization manager
class CloudKitSyncManager: ObservableObject {
    @Published var syncStatus: SyncStatus = .idle
    @Published var lastSyncDate: Date?
    
    private let container: CKContainer
    private let database: CKDatabase
    
    enum SyncStatus {
        case idle
        case syncing
        case success
        case error(String)
    }
    
    init() {
        container = CKContainer.default()
        database = container.publicCloudDatabase
    }
    
    func checkAccountStatus() async -> CKAccountStatus {
        return await withCheckedContinuation { continuation in
            container.accountStatus { status, error in
                continuation.resume(returning: status)
            }
        }
    }
    
    func syncData() async {
        await MainActor.run {
            syncStatus = .syncing
        }
        
        do {
            let accountStatus = await checkAccountStatus()
            
            guard accountStatus == .available else {
                await MainActor.run {
                    syncStatus = .error("iCloud account not available")
                }
                return
            }
            
            // Perform sync operations
            await performCloudKitSync()
            
            await MainActor.run {
                syncStatus = .success
                lastSyncDate = Date()
            }
            
        } catch {
            await MainActor.run {
                syncStatus = .error(error.localizedDescription)
            }
        }
    }
    
    private func performCloudKitSync() async throws {
        // CloudKit sync implementation
        let query = CKQuery(recordType: "User", predicate: NSPredicate(value: true))
        
        let results = try await database.records(matching: query)
        
        // Process results and update Core Data
        for (recordID, result) in results.matchResults {
            switch result {
            case .success(let record):
                // Update Core Data with CloudKit data
                await updateCoreDataFromCloudKit(record: record)
            case .failure(let error):
                print("CloudKit record error: \(error.localizedDescription)")
            }
        }
    }
    
    private func updateCoreDataFromCloudKit(record: CKRecord) async {
        await CoreDataStack.shared.performBackgroundTask { context in
            // Find or create Core Data object
            let request = NSFetchRequest<CDUser>(entityName: "CDUser")
            request.predicate = NSPredicate(format: "cloudKitRecordID == %@", record.recordID.recordName)
            
            do {
                let users = try context.fetch(request)
                let user = users.first ?? CDUser(context: context)
                
                // Update with CloudKit data
                user.cloudKitRecordID = record.recordID.recordName
                user.name = record["name"] as? String
                user.email = record["email"] as? String
                
                try context.save()
            } catch {
                print("Core Data update error: \(error.localizedDescription)")
            }
        }
    }
}
```

## パフォーマンス最適化とメモリ管理

### メモリ効率化とバックグラウンド処理

```swift
import UIKit
import SwiftUI
import BackgroundTasks

// Memory-efficient image loading
class ImageCache {
    static let shared = ImageCache()
    
    private let cache = NSCache<NSString, UIImage>()
    private let queue = DispatchQueue(label: "image.cache", qos: .utility, attributes: .concurrent)
    
    private init() {
        cache.countLimit = 100
        cache.totalCostLimit = 50 * 1024 * 1024 // 50MB
        
        // Memory pressure handling
        NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: nil
        ) { _ in
            self.cache.removeAllObjects()
        }
    }
    
    func image(for key: String) -> UIImage? {
        return queue.sync {
            cache.object(forKey: NSString(string: key))
        }
    }
    
    func setImage(_ image: UIImage, for key: String) {
        let cost = image.cgImage?.bytesPerRow ?? 0 * image.cgImage?.height ?? 0
        queue.async(flags: .barrier) {
            self.cache.setObject(image, forKey: NSString(string: key), cost: cost)
        }
    }
    
    func removeImage(for key: String) {
        queue.async(flags: .barrier) {
            self.cache.removeObject(forKey: NSString(string: key))
        }
    }
}

// Optimized AsyncImage replacement
struct CachedAsyncImage<Content: View, Placeholder: View>: View {
    let url: URL?
    let content: (UIImage) -> Content
    let placeholder: () -> Placeholder
    
    @State private var image: UIImage?
    @State private var isLoading = false
    
    var body: some View {
        Group {
            if let image = image {
                content(image)
            } else {
                placeholder()
                    .onAppear {
                        loadImage()
                    }
            }
        }
    }
    
    private func loadImage() {
        guard let url = url, !isLoading else { return }
        
        let cacheKey = url.absoluteString
        
        // Check cache first
        if let cachedImage = ImageCache.shared.image(for: cacheKey) {
            self.image = cachedImage
            return
        }
        
        isLoading = true
        
        Task {
            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                
                guard let downloadedImage = UIImage(data: data) else {
                    isLoading = false
                    return
                }
                
                // Resize image if too large
                let resizedImage = await resizeImage(downloadedImage, maxSize: CGSize(width: 300, height: 300))
                
                // Cache the image
                ImageCache.shared.setImage(resizedImage, for: cacheKey)
                
                await MainActor.run {
                    self.image = resizedImage
                    self.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.isLoading = false
                }
            }
        }
    }
    
    private func resizeImage(_ image: UIImage, maxSize: CGSize) async -> UIImage {
        return await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .utility).async {
                let renderer = UIGraphicsImageRenderer(size: maxSize)
                let resizedImage = renderer.image { _ in
                    image.draw(in: CGRect(origin: .zero, size: maxSize))
                }
                continuation.resume(returning: resizedImage)
            }
        }
    }
}

// Background task management
class BackgroundTaskManager: NSObject, ObservableObject {
    static let shared = BackgroundTaskManager()
    
    private override init() {
        super.init()
        registerBackgroundTasks()
    }
    
    private func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "com.app.data-sync",
            using: nil
        ) { task in
            self.handleDataSync(task: task as! BGAppRefreshTask)
        }
        
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "com.app.database-cleanup",
            using: nil
        ) { task in
            self.handleDatabaseCleanup(task: task as! BGProcessingTask)
        }
    }
    
    func scheduleAppRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: "com.app.data-sync")
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes
        
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("Could not schedule app refresh: \(error.localizedDescription)")
        }
    }
    
    func scheduleBackgroundProcessing() {
        let request = BGProcessingTaskRequest(identifier: "com.app.database-cleanup")
        request.requiresNetworkConnectivity = false
        request.requiresExternalPower = false
        request.earliestBeginDate = Date(timeIntervalSinceNow: 60 * 60) // 1 hour
        
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("Could not schedule background processing: \(error.localizedDescription)")
        }
    }
    
    private func handleDataSync(task: BGAppRefreshTask) {
        scheduleAppRefresh() // Schedule next refresh
        
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }
        
        Task {
            do {
                // Perform data synchronization
                await syncDataInBackground()
                task.setTaskCompleted(success: true)
            } catch {
                task.setTaskCompleted(success: false)
            }
        }
    }
    
    private func handleDatabaseCleanup(task: BGProcessingTask) {
        scheduleBackgroundProcessing() // Schedule next cleanup
        
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }
        
        Task {
            do {
                await performDatabaseCleanup()
                task.setTaskCompleted(success: true)
            } catch {
                task.setTaskCompleted(success: false)
            }
        }
    }
    
    private func syncDataInBackground() async {
        // Background sync implementation
        print("Performing background sync...")
    }
    
    private func performDatabaseCleanup() async {
        // Database cleanup implementation
        await CoreDataStack.shared.performBackgroundTask { context in
            // Clean up old data
            let calendar = Calendar.current
            let cutoffDate = calendar.date(byAdding: .day, value: -30, to: Date())!
            
            let request = NSFetchRequest<CDUser>(entityName: "CDUser")
            request.predicate = NSPredicate(format: "lastActive < %@", cutoffDate as NSDate)
            
            do {
                let oldUsers = try context.fetch(request)
                oldUsers.forEach { context.delete($0) }
                try context.save()
            } catch {
                print("Database cleanup error: \(error.localizedDescription)")
            }
        }
    }
}

// Performance monitoring
class PerformanceMonitor {
    static let shared = PerformanceMonitor()
    
    private init() {}
    
    func trackViewLoad(viewName: String, loadTime: TimeInterval) {
        // Analytics tracking
        print("View \(viewName) loaded in \(String(format: "%.2f", loadTime))s")
        
        if loadTime > 2.0 {
            print("⚠️ Slow view load detected: \(viewName)")
        }
    }
    
    func trackMemoryUsage() {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
        
        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        
        if kerr == KERN_SUCCESS {
            let memoryUsage = Double(info.resident_size) / (1024 * 1024) // MB
            print("Memory usage: \(String(format: "%.1f", memoryUsage)) MB")
            
            if memoryUsage > 100 {
                print("⚠️ High memory usage detected")
            }
        }
    }
}

// View performance wrapper
struct PerformanceTrackingView<Content: View>: View {
    let viewName: String
    let content: Content
    
    @State private var loadStartTime = Date()
    
    init(viewName: String, @ViewBuilder content: () -> Content) {
        self.viewName = viewName
        self.content = content()
    }
    
    var body: some View {
        content
            .onAppear {
                let loadTime = Date().timeIntervalSince(loadStartTime)
                PerformanceMonitor.shared.trackViewLoad(viewName: viewName, loadTime: loadTime)
            }
    }
}
```

## テストパターンとCI/CD

### Unit Testing と UI Testing

```swift
import XCTest
import SwiftUI
@testable import MyApp

// MVVM Testing
class UserListViewModelTests: XCTestCase {
    var viewModel: UserListViewModel!
    var mockRepository: MockUserRepository!
    
    override func setUpWithError() throws {
        mockRepository = MockUserRepository()
        viewModel = UserListViewModel(repository: mockRepository)
    }
    
    override func tearDownWithError() throws {
        viewModel = nil
        mockRepository = nil
    }
    
    func testLoadUsersSuccess() async {
        // Given
        let expectedUsers = [
            User(id: "1", name: "John", email: "john@example.com"),
            User(id: "2", name: "Jane", email: "jane@example.com")
        ]
        mockRepository.usersToReturn = expectedUsers
        
        // When
        await viewModel.loadUsers()
        
        // Then
        XCTAssertEqual(viewModel.users.count, 2)
        XCTAssertEqual(viewModel.users[0].name, "John")
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertFalse(viewModel.isLoading)
    }
    
    func testLoadUsersFailure() async {
        // Given
        mockRepository.shouldReturnError = true
        mockRepository.errorToReturn = NetworkError.serverError(500)
        
        // When
        await viewModel.loadUsers()
        
        // Then
        XCTAssertTrue(viewModel.users.isEmpty)
        XCTAssertNotNil(viewModel.errorMessage)
        XCTAssertFalse(viewModel.isLoading)
    }
    
    func testSearchFiltering() {
        // Given
        viewModel.users = [
            User(id: "1", name: "John Doe", email: "john@example.com"),
            User(id: "2", name: "Jane Smith", email: "jane@example.com"),
            User(id: "3", name: "Bob Johnson", email: "bob@test.com")
        ]
        
        // When
        viewModel.searchText = "john"
        
        // Then
        XCTAssertEqual(viewModel.filteredUsers.count, 2)
        XCTAssertTrue(viewModel.filteredUsers.contains { $0.name.contains("John") })
        XCTAssertTrue(viewModel.filteredUsers.contains { $0.email.contains("john") })
    }
}

class MockUserRepository: UserRepository {
    var usersToReturn: [User] = []
    var userToReturn: User?
    var shouldReturnError = false
    var errorToReturn: Error = NetworkError.serverError(500)
    
    func fetchUsers() async throws -> [User] {
        if shouldReturnError {
            throw errorToReturn
        }
        return usersToReturn
    }
    
    func fetchUser(id: String) async throws -> User? {
        if shouldReturnError {
            throw errorToReturn
        }
        return userToReturn
    }
    
    func saveUser(_ user: User) async throws {
        if shouldReturnError {
            throw errorToReturn
        }
    }
    
    func deleteUser(id: String) async throws {
        if shouldReturnError {
            throw errorToReturn
        }
    }
}

// SwiftUI Testing
class UserListViewUITests: XCTestCase {
    var app: XCUIApplication!
    
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["UI-Testing"]
        app.launch()
    }
    
    func testUserListDisplay() {
        // Wait for the list to appear
        let userList = app.tables["UserList"]
        XCTAssertTrue(userList.waitForExistence(timeout: 5))
        
        // Check if users are displayed
        let firstUserCell = userList.cells.element(boundBy: 0)
        XCTAssertTrue(firstUserCell.exists)
        
        // Test search functionality
        let searchField = app.searchFields["Search users"]
        XCTAssertTrue(searchField.exists)
        
        searchField.tap()
        searchField.typeText("john")
        
        // Verify filtered results
        let filteredCells = userList.cells
        XCTAssertTrue(filteredCells.count > 0)
    }
    
    func testAddUserFlow() {
        let addButton = app.navigationBars.buttons["Add"]
        XCTAssertTrue(addButton.exists)
        
        addButton.tap()
        
        // Wait for the add user sheet to appear
        let addUserSheet = app.sheets["AddUserSheet"]
        XCTAssertTrue(addUserSheet.waitForExistence(timeout: 3))
        
        // Fill in user details
        let nameField = addUserSheet.textFields["Name"]
        let emailField = addUserSheet.textFields["Email"]
        
        nameField.tap()
        nameField.typeText("Test User")
        
        emailField.tap()
        emailField.typeText("test@example.com")
        
        // Save user
        let saveButton = addUserSheet.buttons["Save"]
        saveButton.tap()
        
        // Verify user was added to list
        let userList = app.tables["UserList"]
        let newUserCell = userList.cells.containing(.staticText, identifier: "Test User")
        XCTAssertTrue(newUserCell.element.waitForExistence(timeout: 3))
    }
}

// Performance Testing
class PerformanceTests: XCTestCase {
    func testUserListLoadingPerformance() {
        let viewModel = UserListViewModel(repository: MockUserRepository())
        
        // Setup large dataset
        let mockRepo = viewModel.repository as! MockUserRepository
        mockRepo.usersToReturn = (1...1000).map { index in
            User(id: "\(index)", name: "User \(index)", email: "user\(index)@example.com")
        }
        
        measure {
            let expectation = XCTestExpectation(description: "Load users")
            
            Task {
                await viewModel.loadUsers()
                expectation.fulfill()
            }
            
            wait(for: [expectation], timeout: 5.0)
        }
    }
    
    func testImageCachePerformance() {
        let cache = ImageCache.shared
        let testImage = UIImage(systemName: "person.fill")!
        
        measure {
            for i in 0..<1000 {
                cache.setImage(testImage, for: "test_key_\(i)")
                _ = cache.image(for: "test_key_\(i)")
            }
        }
    }
}
```

## ベストプラクティス

1. **Async/Await**: 非同期処理にはasync/awaitを使用し、Actorでスレッドセーフ性を確保
2. **SwiftUI Architecture**: MVVM + Repository パターンでテスタブルな設計
3. **Property Wrappers**: UserDefaults、Keychain等の抽象化に活用
4. **Core Data + CloudKit**: データ同期とオフライン対応の統合
5. **Memory Management**: NSCache、lazy loading、weak参照の適切な使用
6. **Background Tasks**: BGTaskSchedulerでバックグラウンド処理を適切に管理
7. **Performance Monitoring**: 実行時間、メモリ使用量の定期的な監視
8. **Unit Testing**: Mock、Dependency Injection を活用したテスト設計
9. **UI Testing**: XCUITestでクリティカルなユーザーフローをテスト
10. **CI/CD**: Xcode Cloud、GitHub Actions での自動テスト・デプロイ