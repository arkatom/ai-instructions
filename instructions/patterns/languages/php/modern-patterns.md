# モダン PHP 8.x 実践パターン

## PHP 8+ 言語機能とタイプシステム

### Union Types と Attributes

```php
<?php

declare(strict_types=1);

namespace App\Domain;

use DateTime;
use DateTimeInterface;
use App\Infrastructure\Validation\NotEmpty;
use App\Infrastructure\Validation\Email;
use App\Infrastructure\Cache\Cacheable;
use App\Infrastructure\Security\Sanitize;

// Union Types を使用したより柔軟な型定義
#[Cacheable(ttl: 3600)]
class User
{
    public function __construct(
        #[NotEmpty]
        public readonly string $name,
        
        #[Email]
        #[Sanitize]
        public readonly string $email,
        
        public readonly int|string $id,  // Union type
        
        public readonly DateTimeInterface $createdAt,
        
        // Nullable types
        public readonly ?string $profileImage = null,
        
        // Mixed type with default
        public readonly mixed $metadata = [],
        
        // Intersection types (PHP 8.1+)
        public readonly Countable&Iterator $permissions = new ArrayIterator([])
    ) {}

    // Return type declarations with union types
    public function getIdentifier(): int|string
    {
        return $this->id;
    }

    // Match expressions (PHP 8.0+)
    public function getDisplayStatus(): string
    {
        return match($this->getAccountStatus()) {
            'active' => '✅ Active User',
            'inactive' => '⏸️ Inactive',
            'suspended' => '🚫 Suspended',
            'pending' => '⏳ Pending Approval',
            default => '❓ Unknown Status'
        };
    }

    // Named arguments support
    public static function createFromArray(array $data): self
    {
        return new self(
            name: $data['name'],
            email: $data['email'],
            id: $data['id'],
            createdAt: new DateTime($data['created_at'] ?? 'now'),
            profileImage: $data['profile_image'] ?? null,
            metadata: $data['metadata'] ?? []
        );
    }

    // Promoted constructor properties with validation
    public function updateProfile(
        #[NotEmpty]
        string $newName,
        
        #[Email]
        string $newEmail,
        
        ?string $newProfileImage = null
    ): self {
        // PHP 8.1 readonly properties can only be initialized once
        // So we create a new instance for immutability
        return new self(
            name: $newName,
            email: $newEmail,
            id: $this->id,
            createdAt: $this->createdAt,
            profileImage: $newProfileImage ?? $this->profileImage,
            metadata: $this->metadata
        );
    }
}

// Enum classes (PHP 8.1+)
enum UserStatus: string
{
    case ACTIVE = 'active';
    case INACTIVE = 'inactive';
    case SUSPENDED = 'suspended';
    case PENDING = 'pending';

    // Enum methods
    public function getLabel(): string
    {
        return match($this) {
            self::ACTIVE => 'Active User',
            self::INACTIVE => 'Inactive User',
            self::SUSPENDED => 'Suspended Account',
            self::PENDING => 'Pending Approval',
        };
    }

    public function isActive(): bool
    {
        return $this === self::ACTIVE;
    }

    // Static methods for enums
    public static function fromLabel(string $label): ?self
    {
        return match(strtolower($label)) {
            'active', 'active user' => self::ACTIVE,
            'inactive', 'inactive user' => self::INACTIVE,
            'suspended', 'suspended account' => self::SUSPENDED,
            'pending', 'pending approval' => self::PENDING,
            default => null
        };
    }
}

// First-class callable syntax (PHP 8.1+)
class UserService
{
    public function __construct(
        private UserRepository $repository,
        private EventDispatcher $eventDispatcher
    ) {}

    public function processUsers(array $users): array
    {
        // First-class callable syntax
        $activeUsers = array_filter($users, $this->isActiveUser(...));
        $userNames = array_map($this->getUserName(...), $activeUsers);
        
        return $userNames;
    }

    private function isActiveUser(User $user): bool
    {
        return $user->getAccountStatus() === 'active';
    }

    private function getUserName(User $user): string
    {
        return $user->name;
    }
}
```

### Attributes システムとメタプログラミング

```php
<?php

namespace App\Infrastructure;

use Attribute;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;

// カスタム Attribute の定義
#[Attribute(Attribute::TARGET_CLASS | Attribute::TARGET_METHOD)]
class Route
{
    public function __construct(
        public readonly string $path,
        public readonly string $method = 'GET',
        public readonly array $middleware = [],
        public readonly ?string $name = null
    ) {}
}

#[Attribute(Attribute::TARGET_PROPERTY)]
class Validate
{
    public function __construct(
        public readonly array $rules,
        public readonly ?string $message = null
    ) {}
}

#[Attribute(Attribute::TARGET_METHOD)]
class Cache
{
    public function __construct(
        public readonly int $ttl = 3600,
        public readonly ?string $key = null,
        public readonly array $tags = []
    ) {}
}

// Attribute を使用したコントローラー
#[Route('/api/users', middleware: ['auth', 'throttle:60,1'])]
class UserController
{
    public function __construct(
        private UserService $userService,
        private CacheManager $cache
    ) {}

    #[Route('/', method: 'GET', name: 'users.index')]
    #[Cache(ttl: 1800, tags: ['users', 'api'])]
    public function index(): JsonResponse
    {
        $users = $this->userService->getAllUsers();
        return new JsonResponse($users);
    }

    #[Route('/{id}', method: 'GET', name: 'users.show')]
    #[Cache(ttl: 3600)]
    public function show(int $id): JsonResponse
    {
        $user = $this->userService->getUserById($id);
        return new JsonResponse($user);
    }

    #[Route('/', method: 'POST', name: 'users.store')]
    public function store(CreateUserRequest $request): JsonResponse
    {
        $user = $this->userService->createUser($request->validated());
        return new JsonResponse($user, 201);
    }
}

// DTO with validation attributes
class CreateUserRequest
{
    public function __construct(
        #[Validate(['required', 'string', 'max:255'])]
        public readonly string $name,

        #[Validate(['required', 'email', 'unique:users,email'])]
        public readonly string $email,

        #[Validate(['required', 'string', 'min:8'])]
        public readonly string $password,

        #[Validate(['sometimes', 'image', 'max:2048'])]
        public readonly ?string $profileImage = null
    ) {}
}

// Attribute processor for automatic validation
class AttributeProcessor
{
    public static function processValidation(object $object): array
    {
        $reflection = new ReflectionClass($object);
        $errors = [];

        foreach ($reflection->getProperties() as $property) {
            $attributes = $property->getAttributes(Validate::class);
            
            if (empty($attributes)) {
                continue;
            }

            $validate = $attributes[0]->newInstance();
            $value = $property->getValue($object);
            
            foreach ($validate->rules as $rule) {
                if (!self::validateRule($value, $rule)) {
                    $errors[$property->getName()][] = 
                        $validate->message ?? "Validation failed for rule: {$rule}";
                }
            }
        }

        return $errors;
    }

    public static function processRoutes(string $controllerClass): array
    {
        $reflection = new ReflectionClass($controllerClass);
        $routes = [];

        // クラスレベルのルート情報
        $classRoute = null;
        $classAttributes = $reflection->getAttributes(Route::class);
        if (!empty($classAttributes)) {
            $classRoute = $classAttributes[0]->newInstance();
        }

        // メソッドレベルのルート情報
        foreach ($reflection->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
            $methodAttributes = $method->getAttributes(Route::class);
            
            if (empty($methodAttributes)) {
                continue;
            }

            $methodRoute = $methodAttributes[0]->newInstance();
            
            $routes[] = [
                'path' => ($classRoute?->path ?? '') . $methodRoute->path,
                'method' => $methodRoute->method,
                'action' => $controllerClass . '@' . $method->getName(),
                'middleware' => array_merge(
                    $classRoute?->middleware ?? [],
                    $methodRoute->middleware
                ),
                'name' => $methodRoute->name
            ];
        }

        return $routes;
    }

    private static function validateRule(mixed $value, string $rule): bool
    {
        return match($rule) {
            'required' => !empty($value),
            'string' => is_string($value),
            'email' => filter_var($value, FILTER_VALIDATE_EMAIL) !== false,
            default => str_starts_with($rule, 'max:') ? 
                strlen($value) <= (int)substr($rule, 4) : true
        };
    }
}
```

## 現代的なアーキテクチャパターン

### Hexagonal Architecture と DDD

```php
<?php

namespace App\Domain\User;

use App\Domain\Shared\AggregateRoot;
use App\Domain\Shared\DomainEvent;
use App\Domain\User\Events\UserCreated;
use App\Domain\User\Events\UserEmailChanged;
use App\Domain\User\ValueObjects\UserId;
use App\Domain\User\ValueObjects\Email;

// Domain Entity (Aggregate Root)
final class User extends AggregateRoot
{
    private array $domainEvents = [];

    private function __construct(
        private UserId $id,
        private string $name,
        private Email $email,
        private UserStatus $status,
        private DateTime $createdAt
    ) {}

    public static function create(
        UserId $id,
        string $name,
        Email $email
    ): self {
        $user = new self(
            id: $id,
            name: $name,
            email: $email,
            status: UserStatus::ACTIVE,
            createdAt: new DateTime()
        );

        $user->recordEvent(new UserCreated($user->id, $user->name, $user->email));
        
        return $user;
    }

    public function changeEmail(Email $newEmail): void
    {
        if ($this->email->equals($newEmail)) {
            return; // No change needed
        }

        $oldEmail = $this->email;
        $this->email = $newEmail;
        
        $this->recordEvent(new UserEmailChanged($this->id, $oldEmail, $newEmail));
    }

    public function suspend(): void
    {
        if ($this->status === UserStatus::SUSPENDED) {
            throw new UserAlreadySuspendedException($this->id);
        }

        $this->status = UserStatus::SUSPENDED;
    }

    // Getters
    public function getId(): UserId { return $this->id; }
    public function getName(): string { return $this->name; }
    public function getEmail(): Email { return $this->email; }
    public function getStatus(): UserStatus { return $this->status; }
    public function getCreatedAt(): DateTime { return $this->createdAt; }
}

// Value Objects
final readonly class UserId
{
    public function __construct(private string $value)
    {
        if (empty($value)) {
            throw new InvalidArgumentException('User ID cannot be empty');
        }
    }

    public function getValue(): string
    {
        return $this->value;
    }

    public function equals(UserId $other): bool
    {
        return $this->value === $other->value;
    }
}

final readonly class Email
{
    public function __construct(private string $value)
    {
        if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidEmailException($value);
        }
    }

    public function getValue(): string
    {
        return $this->value;
    }

    public function equals(Email $other): bool
    {
        return $this->value === $other->value;
    }
}

// Domain Repository Interface
interface UserRepositoryInterface
{
    public function save(User $user): void;
    public function findById(UserId $id): ?User;
    public function findByEmail(Email $email): ?User;
    public function delete(UserId $id): void;
}

// Application Service
final class UserApplicationService
{
    public function __construct(
        private UserRepositoryInterface $userRepository,
        private EventDispatcherInterface $eventDispatcher
    ) {}

    public function createUser(CreateUserCommand $command): void
    {
        // Business rule: Check if email is already taken
        $existingUser = $this->userRepository->findByEmail($command->email);
        if ($existingUser !== null) {
            throw new EmailAlreadyTakenException($command->email);
        }

        $user = User::create(
            new UserId($command->id),
            $command->name,
            $command->email
        );

        $this->userRepository->save($user);
        
        // Dispatch domain events
        foreach ($user->getRecordedEvents() as $event) {
            $this->eventDispatcher->dispatch($event);
        }
    }

    public function changeUserEmail(ChangeUserEmailCommand $command): void
    {
        $user = $this->userRepository->findById($command->userId);
        if ($user === null) {
            throw new UserNotFoundException($command->userId);
        }

        $user->changeEmail($command->newEmail);
        $this->userRepository->save($user);
        
        foreach ($user->getRecordedEvents() as $event) {
            $this->eventDispatcher->dispatch($event);
        }
    }
}

// Infrastructure Layer - Database Implementation
final class DoctrineUserRepository implements UserRepositoryInterface
{
    public function __construct(
        private EntityManagerInterface $entityManager
    ) {}

    public function save(User $user): void
    {
        $this->entityManager->persist($user);
        $this->entityManager->flush();
    }

    public function findById(UserId $id): ?User
    {
        return $this->entityManager->getRepository(User::class)
            ->findOneBy(['id.value' => $id->getValue()]);
    }

    public function findByEmail(Email $email): ?User
    {
        return $this->entityManager->getRepository(User::class)
            ->findOneBy(['email.value' => $email->getValue()]);
    }

    public function delete(UserId $id): void
    {
        $user = $this->findById($id);
        if ($user) {
            $this->entityManager->remove($user);
            $this->entityManager->flush();
        }
    }
}
```

### CQRS パターンとイベントソーシング

```php
<?php

namespace App\Application\CQRS;

// Command側 - 書き込み操作
interface CommandHandlerInterface
{
    public function handle(mixed $command): void;
}

interface QueryHandlerInterface
{
    public function handle(mixed $query): mixed;
}

// Command Bus
final class CommandBus
{
    private array $handlers = [];

    public function register(string $commandClass, CommandHandlerInterface $handler): void
    {
        $this->handlers[$commandClass] = $handler;
    }

    public function dispatch(object $command): void
    {
        $commandClass = get_class($command);
        
        if (!isset($this->handlers[$commandClass])) {
            throw new CommandHandlerNotFoundException($commandClass);
        }

        $this->handlers[$commandClass]->handle($command);
    }
}

// Query Bus
final class QueryBus
{
    private array $handlers = [];

    public function register(string $queryClass, QueryHandlerInterface $handler): void
    {
        $this->handlers[$queryClass] = $handler;
    }

    public function ask(object $query): mixed
    {
        $queryClass = get_class($query);
        
        if (!isset($this->handlers[$queryClass])) {
            throw new QueryHandlerNotFoundException($queryClass);
        }

        return $this->handlers[$queryClass]->handle($query);
    }
}

// Event Store for Event Sourcing
interface EventStoreInterface
{
    public function append(string $streamId, array $events, int $expectedVersion): void;
    public function getEventsForStream(string $streamId, int $fromVersion = 0): array;
}

final class MySQLEventStore implements EventStoreInterface
{
    public function __construct(
        private PDO $connection,
        private EventSerializerInterface $serializer
    ) {}

    public function append(string $streamId, array $events, int $expectedVersion): void
    {
        $this->connection->beginTransaction();
        
        try {
            // Check current version
            $stmt = $this->connection->prepare(
                'SELECT MAX(version) as current_version FROM events WHERE stream_id = ?'
            );
            $stmt->execute([$streamId]);
            $currentVersion = (int)$stmt->fetchColumn() ?: 0;

            if ($currentVersion !== $expectedVersion) {
                throw new ConcurrencyException(
                    "Expected version {$expectedVersion}, but current version is {$currentVersion}"
                );
            }

            // Insert new events
            $stmt = $this->connection->prepare(
                'INSERT INTO events (stream_id, version, event_type, event_data, occurred_at) 
                 VALUES (?, ?, ?, ?, ?)'
            );

            foreach ($events as $index => $event) {
                $version = $expectedVersion + $index + 1;
                $stmt->execute([
                    $streamId,
                    $version,
                    get_class($event),
                    $this->serializer->serialize($event),
                    $event->getOccurredAt()->format('Y-m-d H:i:s')
                ]);
            }

            $this->connection->commit();
        } catch (Exception $e) {
            $this->connection->rollBack();
            throw $e;
        }
    }

    public function getEventsForStream(string $streamId, int $fromVersion = 0): array
    {
        $stmt = $this->connection->prepare(
            'SELECT event_type, event_data, occurred_at 
             FROM events 
             WHERE stream_id = ? AND version > ? 
             ORDER BY version ASC'
        );
        $stmt->execute([$streamId, $fromVersion]);

        $events = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $events[] = $this->serializer->deserialize(
                $row['event_type'],
                $row['event_data'],
                new DateTime($row['occurred_at'])
            );
        }

        return $events;
    }
}

// Read Model for CQRS Query Side
final class UserReadModel
{
    public function __construct(
        public readonly string $id,
        public readonly string $name,
        public readonly string $email,
        public readonly string $status,
        public readonly DateTime $createdAt,
        public readonly DateTime $updatedAt
    ) {}
}

final class UserReadModelRepository
{
    public function __construct(private PDO $connection) {}

    public function save(UserReadModel $readModel): void
    {
        $stmt = $this->connection->prepare(
            'INSERT INTO user_read_models (id, name, email, status, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             name = VALUES(name), 
             email = VALUES(email), 
             status = VALUES(status), 
             updated_at = VALUES(updated_at)'
        );

        $stmt->execute([
            $readModel->id,
            $readModel->name,
            $readModel->email,
            $readModel->status,
            $readModel->createdAt->format('Y-m-d H:i:s'),
            $readModel->updatedAt->format('Y-m-d H:i:s')
        ]);
    }

    public function findById(string $id): ?UserReadModel
    {
        $stmt = $this->connection->prepare(
            'SELECT * FROM user_read_models WHERE id = ?'
        );
        $stmt->execute([$id]);
        
        $data = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$data) {
            return null;
        }

        return new UserReadModel(
            id: $data['id'],
            name: $data['name'],
            email: $data['email'],
            status: $data['status'],
            createdAt: new DateTime($data['created_at']),
            updatedAt: new DateTime($data['updated_at'])
        );
    }

    public function findAll(int $limit = 100, int $offset = 0): array
    {
        $stmt = $this->connection->prepare(
            'SELECT * FROM user_read_models 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?'
        );
        $stmt->execute([$limit, $offset]);

        $readModels = [];
        while ($data = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $readModels[] = new UserReadModel(
                id: $data['id'],
                name: $data['name'],
                email: $data['email'],
                status: $data['status'],
                createdAt: new DateTime($data['created_at']),
                updatedAt: new DateTime($data['updated_at'])
            );
        }

        return $readModels;
    }
}
```

## 高性能 Web API 開発

### Laravel/Symfony での REST API パターン

```php
<?php

namespace App\Http\Controllers\API\V1;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Http\Resources\Json\ResourceCollection;
use App\Http\Requests\CreateUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Http\Resources\UserCollection;
use App\Services\UserService;

// API Resource による統一的なレスポンス形式
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'status' => $this->status->value,
            'profile' => [
                'avatar' => $this->profile_image ? asset("storage/{$this->profile_image}") : null,
                'bio' => $this->bio,
            ],
            'created_at' => $this->created_at->toISOString(),
            'updated_at' => $this->updated_at->toISOString(),
            
            // Conditional attributes
            $this->mergeWhen($request->user()?->isAdmin(), [
                'internal_notes' => $this->internal_notes,
                'last_login_at' => $this->last_login_at?->toISOString(),
            ]),
            
            // Relationships
            'permissions' => PermissionResource::collection($this->whenLoaded('permissions')),
            'roles' => RoleResource::collection($this->whenLoaded('roles')),
        ];
    }
}

// API Controller with comprehensive error handling
#[Route('/api/v1/users')]
class UserController extends Controller
{
    public function __construct(
        private UserService $userService,
        private RateLimiter $rateLimiter
    ) {
        $this->middleware(['auth:api', 'throttle:api']);
    }

    #[Route('/', methods: ['GET'])]
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'page' => 'sometimes|integer|min:1',
            'per_page' => 'sometimes|integer|min:1|max:100',
            'sort' => 'sometimes|string|in:name,email,created_at',
            'direction' => 'sometimes|string|in:asc,desc',
            'filter' => 'sometimes|array',
            'include' => 'sometimes|string'
        ]);

        $users = $this->userService->paginate(
            page: $request->integer('page', 1),
            perPage: $request->integer('per_page', 20),
            sort: $request->string('sort', 'created_at'),
            direction: $request->string('direction', 'desc'),
            filters: $request->array('filter', []),
            includes: explode(',', $request->string('include', ''))
        );

        return UserCollection::make($users)->response();
    }

    #[Route('/{user}', methods: ['GET'])]
    public function show(User $user, Request $request): JsonResponse
    {
        $includes = explode(',', $request->string('include', ''));
        $user->load(array_intersect($includes, ['permissions', 'roles', 'profile']));

        return UserResource::make($user)->response();
    }

    #[Route('/', methods: ['POST'])]
    public function store(CreateUserRequest $request): JsonResponse
    {
        $user = $this->userService->create($request->validated());

        return UserResource::make($user)
            ->response()
            ->setStatusCode(201);
    }

    #[Route('/{user}', methods: ['PUT', 'PATCH'])]
    public function update(User $user, UpdateUserRequest $request): JsonResponse
    {
        $this->authorize('update', $user);

        $user = $this->userService->update($user, $request->validated());

        return UserResource::make($user)->response();
    }

    #[Route('/{user}', methods: ['DELETE'])]
    public function destroy(User $user): JsonResponse
    {
        $this->authorize('delete', $user);

        $this->userService->delete($user);

        return response()->json(null, 204);
    }

    // Batch operations
    #[Route('/batch', methods: ['POST'])]
    public function batch(Request $request): JsonResponse
    {
        $request->validate([
            'operations' => 'required|array|max:100',
            'operations.*.method' => 'required|string|in:POST,PUT,DELETE',
            'operations.*.resource' => 'required|string',
            'operations.*.data' => 'sometimes|array'
        ]);

        $results = $this->userService->batchProcess($request->input('operations'));

        return response()->json([
            'results' => $results,
            'summary' => [
                'total' => count($results),
                'successful' => collect($results)->where('status', 'success')->count(),
                'failed' => collect($results)->where('status', 'error')->count()
            ]
        ]);
    }
}

// Optimized service layer with caching
class UserService
{
    public function __construct(
        private UserRepository $repository,
        private CacheManager $cache,
        private EventDispatcher $eventDispatcher
    ) {}

    public function paginate(
        int $page = 1,
        int $perPage = 20,
        string $sort = 'created_at',
        string $direction = 'desc',
        array $filters = [],
        array $includes = []
    ): LengthAwarePaginator {
        $cacheKey = "users:paginated:" . md5(serialize([
            $page, $perPage, $sort, $direction, $filters, $includes
        ]));

        return $this->cache->remember($cacheKey, 300, function () use (
            $page, $perPage, $sort, $direction, $filters, $includes
        ) {
            return $this->repository->paginate([
                'page' => $page,
                'per_page' => $perPage,
                'sort' => $sort,
                'direction' => $direction,
                'filters' => $filters,
                'includes' => $includes
            ]);
        });
    }

    public function create(array $data): User
    {
        DB::beginTransaction();
        
        try {
            $user = $this->repository->create($data);
            
            $this->eventDispatcher->dispatch(new UserCreated($user));
            
            // Cache invalidation
            $this->cache->tags(['users'])->flush();
            
            DB::commit();
            return $user;
        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    public function batchProcess(array $operations): array
    {
        $results = [];
        
        DB::beginTransaction();
        
        try {
            foreach ($operations as $index => $operation) {
                try {
                    $result = $this->processSingleOperation($operation);
                    $results[$index] = ['status' => 'success', 'data' => $result];
                } catch (Exception $e) {
                    $results[$index] = [
                        'status' => 'error', 
                        'error' => $e->getMessage()
                    ];
                }
            }
            
            DB::commit();
        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return $results;
    }
}
```

### GraphQL API とスキーマ設計

```php
<?php

namespace App\GraphQL;

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;
use GraphQL\Type\Definition\ResolveInfo;
use Nuwave\Lighthouse\Schema\TypeRegistry;
use Nuwave\Lighthouse\Execution\ResolveInfo as LighthouseResolveInfo;

// GraphQL スキーマ定義（Lighthouse PHP使用）
/**
 * schema.graphql
 * 
 * type User {
 *   id: ID!
 *   name: String!
 *   email: String!
 *   status: UserStatus!
 *   profile: UserProfile
 *   posts(first: Int, page: Int): PostPaginator
 *   createdAt: DateTime!
 *   updatedAt: DateTime!
 * }
 * 
 * enum UserStatus {
 *   ACTIVE
 *   INACTIVE
 *   SUSPENDED
 * }
 * 
 * type UserProfile {
 *   bio: String
 *   avatar: String
 *   socialLinks: [SocialLink!]!
 * }
 * 
 * type Query {
 *   user(id: ID!): User @find
 *   users(
 *     first: Int = 10
 *     page: Int = 1
 *     orderBy: [OrderByClause!]
 *     filter: UserFilterInput
 *   ): UserPaginator @paginate
 * }
 * 
 * type Mutation {
 *   createUser(input: CreateUserInput!): User @create
 *   updateUser(id: ID!, input: UpdateUserInput!): User @update
 *   deleteUser(id: ID!): User @delete
 * }
 */

// カスタムリゾルバー
class UserResolver
{
    public function posts(User $user, array $args, GraphQLContext $context, ResolveInfo $info)
    {
        // N+1問題を避けるためのDataLoader使用
        return $context->dataLoader('posts_by_user_id')->load($user->id);
    }

    public function profile(User $user, array $args, GraphQLContext $context, ResolveInfo $info)
    {
        // 条件付きローディング
        if ($context->user()?->can('view-profile', $user)) {
            return $user->profile;
        }
        return null;
    }
}

// DataLoader for N+1 problem prevention
class PostByUserIdLoader extends \Nuwave\Lighthouse\Execution\DataLoader\Loader
{
    protected function loadKeys(array $keys): array
    {
        $posts = Post::whereIn('user_id', $keys)
            ->with(['tags', 'comments.author'])
            ->get()
            ->groupBy('user_id');

        return array_map(function ($userId) use ($posts) {
            return $posts->get($userId, collect());
        }, $keys);
    }
}

// GraphQL Middleware for authentication and rate limiting
class GraphQLAuthMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $query = $request->input('query', '');
        
        // Introspection query check
        if (str_contains($query, '__schema') || str_contains($query, '__type')) {
            if (!$request->user()?->isAdmin()) {
                throw new AuthenticationException('Introspection disabled for non-admin users');
            }
        }

        // Rate limiting based on query complexity
        $complexity = $this->calculateQueryComplexity($query);
        if ($complexity > 100) {
            throw new QueryComplexityException('Query too complex');
        }

        return $next($request);
    }

    private function calculateQueryComplexity(string $query): int
    {
        // Simple complexity calculation
        return substr_count($query, '{') + substr_count($query, '(');
    }
}

// Subscription support with Pusher
class UserSubscription
{
    public function userUpdated(Request $request): Channel
    {
        return new PrivateChannel('user.' . $request->user()->id);
    }

    public function userCreated(Request $request): Channel
    {
        if (!$request->user()?->isAdmin()) {
            throw new AuthorizationException();
        }
        
        return new Channel('users.created');
    }
}
```

## パフォーマンス最適化パターン

### キャッシング戦略とデータベース最適化

```php
<?php

namespace App\Services\Cache;

use Illuminate\Cache\CacheManager;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Redis;
use Predis\Client as RedisClient;

// マルチレイヤーキャッシュシステム
class MultiLayerCacheService
{
    public function __construct(
        private CacheManager $cache,
        private RedisClient $redis,
        private array $config = []
    ) {}

    // L1: Memory cache, L2: Redis, L3: Database
    public function remember(string $key, int $ttl, callable $callback): mixed
    {
        // L1 キャッシュ（APCu）をチェック
        static $memoryCache = [];
        if (isset($memoryCache[$key])) {
            return $memoryCache[$key];
        }

        // L2 キャッシュ（Redis）をチェック
        $redisValue = $this->redis->get($key);
        if ($redisValue !== null) {
            $memoryCache[$key] = unserialize($redisValue);
            return $memoryCache[$key];
        }

        // L3: データベースクエリ実行
        $value = $callback();

        // 全レイヤーにキャッシュを保存
        $memoryCache[$key] = $value;
        $this->redis->setex($key, $ttl, serialize($value));

        return $value;
    }

    // キャッシュタグを使用した一括無効化
    public function invalidateByTags(array $tags): void
    {
        foreach ($tags as $tag) {
            $keys = $this->redis->smembers("cache_tag:{$tag}");
            if (!empty($keys)) {
                $this->redis->del($keys);
                $this->redis->del("cache_tag:{$tag}");
            }
        }
    }

    // 確率的期限切れでキャッシュスタンピード防止
    public function rememberWithProbabilisticExpiry(
        string $key, 
        int $ttl, 
        callable $callback,
        float $beta = 1.0
    ): mixed {
        $item = $this->redis->hmget($key, ['value', 'created', 'ttl']);
        
        if ($item['value'] !== null) {
            $age = time() - (int)$item['created'];
            $randomFactor = -log(random_int(1, PHP_INT_MAX) / PHP_INT_MAX);
            
            // 確率的期限切れ判定
            if ($age < ($item['ttl'] - $beta * log($randomFactor))) {
                return unserialize($item['value']);
            }
        }

        // キャッシュミス時の処理
        $value = $callback();
        $this->redis->hmset($key, [
            'value' => serialize($value),
            'created' => time(),
            'ttl' => $ttl
        ]);
        $this->redis->expire($key, $ttl);

        return $value;
    }
}

// データベース最適化パターン
class OptimizedUserRepository
{
    public function __construct(
        private ConnectionInterface $connection,
        private MultiLayerCacheService $cache
    ) {}

    // バルクインサート最適化
    public function bulkInsert(array $users): void
    {
        $chunks = array_chunk($users, 1000); // バッチサイズを制限
        
        foreach ($chunks as $chunk) {
            $values = [];
            $bindings = [];
            
            foreach ($chunk as $user) {
                $values[] = '(?, ?, ?, ?)';
                $bindings = array_merge($bindings, [
                    $user['name'],
                    $user['email'],
                    $user['password'],
                    now()->toDateTimeString()
                ]);
            }

            $sql = 'INSERT INTO users (name, email, password, created_at) VALUES ' 
                 . implode(', ', $values);
                 
            $this->connection->insert($sql, $bindings);
        }
    }

    // クエリビルダーでの最適化クエリ
    public function findActiveUsersWithPosts(): Collection
    {
        return $this->cache->remember(
            'active_users_with_posts',
            3600,
            function () {
                return DB::table('users as u')
                    ->select([
                        'u.id',
                        'u.name',
                        'u.email',
                        'p.post_count',
                        'u.last_login_at'
                    ])
                    ->join(
                        DB::raw('(SELECT user_id, COUNT(*) as post_count FROM posts GROUP BY user_id) as p'),
                        'u.id', '=', 'p.user_id'
                    )
                    ->where('u.status', 'active')
                    ->where('u.last_login_at', '>=', now()->subMonths(6))
                    ->orderByDesc('p.post_count')
                    ->limit(100)
                    ->get();
            }
        );
    }

    // インデックスヒント付きクエリ
    public function searchUsersOptimized(string $term): Collection
    {
        $sql = "
            SELECT u.*, 
                   MATCH(u.name, u.bio) AGAINST (? IN BOOLEAN MODE) as relevance_score
            FROM users u USE INDEX (idx_fulltext_search)
            WHERE MATCH(u.name, u.bio) AGAINST (? IN BOOLEAN MODE)
               OR u.email LIKE ?
            ORDER BY relevance_score DESC, u.created_at DESC
            LIMIT 50
        ";

        $searchTerm = "+{$term}*";
        $emailTerm = "%{$term}%";

        return collect(
            $this->connection->select($sql, [$searchTerm, $searchTerm, $emailTerm])
        );
    }

    // Connection pooling と read/write splitting
    public function getReadConnection(): ConnectionInterface
    {
        return DB::connection('mysql_read');
    }

    public function getWriteConnection(): ConnectionInterface
    {
        return DB::connection('mysql_write');
    }
}

// Background job処理の最適化
class OptimizedUserProcessingJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 300;
    public int $maxExceptions = 3;
    public int $backoff = 30;

    public function __construct(
        private array $userIds,
        private string $operation
    ) {}

    public function handle(UserService $userService): void
    {
        // メモリ制限監視
        $memoryLimit = ini_get('memory_limit');
        $memoryLimitBytes = $this->parseMemoryLimit($memoryLimit);
        
        foreach ($this->userIds as $userId) {
            // メモリ使用量チェック
            if (memory_get_usage() > $memoryLimitBytes * 0.8) {
                // 残りの処理を新しいジョブに分割
                $remaining = array_slice($this->userIds, array_search($userId, $this->userIds));
                dispatch(new self($remaining, $this->operation));
                break;
            }

            try {
                match($this->operation) {
                    'export' => $userService->exportUser($userId),
                    'anonymize' => $userService->anonymizeUser($userId),
                    'notify' => $userService->sendNotification($userId),
                    default => throw new InvalidArgumentException("Unknown operation: {$this->operation}")
                };
                
                // 進捗更新
                Cache::increment("job_progress:{$this->job->getJobId()}");
                
            } catch (Exception $e) {
                Log::error("Failed to process user {$userId}: " . $e->getMessage());
                // 個別エラーでジョブ全体を失敗させない
            }
        }
    }

    public function uniqueId(): string
    {
        return 'user_processing_' . md5(serialize($this->userIds) . $this->operation);
    }

    private function parseMemoryLimit(string $memoryLimit): int
    {
        $unit = strtoupper(substr($memoryLimit, -1));
        $number = (int)substr($memoryLimit, 0, -1);
        
        return match($unit) {
            'G' => $number * 1024 * 1024 * 1024,
            'M' => $number * 1024 * 1024,
            'K' => $number * 1024,
            default => $number
        };
    }
}
```

## ベストプラクティス

1. **厳密型宣言**: すべてのファイルで `declare(strict_types=1)` を使用
2. **Union Types**: PHP 8.0+ の型システムを最大限活用
3. **Attributes**: メタデータ定義にアノテーションではなくAttributes使用
4. **Readonly Properties**: 不変データ構造でreadonly活用
5. **Match Expressions**: switch文の代わりにmatch式を使用
6. **Named Arguments**: 関数呼び出しでの可読性向上
7. **CQRS**: 読み書き分離でスケーラビリティ向上
8. **Event Sourcing**: 監査ログと状態復元の両立
9. **マルチレイヤーキャッシング**: L1/L2/L3キャッシュ戦略
10. **非同期処理**: Queue、WebSocket、Server-Sent Eventsの適切な使い分け