# C# .NET エコシステム実践パターン

## モダン C# 言語機能 (.NET 8, C# 12)

### Records と Pattern Matching

```csharp
// Record types with validation
public record User(
    string Name,
    string Email,
    DateTime CreatedAt
) {
    // Init-only properties with validation
    public string Name { get; init; } = !string.IsNullOrWhiteSpace(Name) 
        ? Name 
        : throw new ArgumentException("Name cannot be empty");
    
    public string Email { get; init; } = IsValidEmail(Email) 
        ? Email 
        : throw new ArgumentException("Invalid email format");

    private static bool IsValidEmail(string email) =>
        email.Contains('@') && email.Contains('.');
}

// Advanced pattern matching with switch expressions
public static decimal CalculateDiscount(Customer customer, Order order) =>
    (customer.Type, order.Amount, customer.YearsActive) switch
    {
        (CustomerType.Premium, >= 1000, _) => 0.15m,
        (CustomerType.Premium, >= 500, _) => 0.10m,
        (CustomerType.Regular, >= 1000, >= 5) => 0.12m,
        (CustomerType.Regular, >= 500, >= 3) => 0.08m,
        (_, >= 100, _) => 0.05m,
        _ => 0.00m
    };

// Pattern matching with guards and complex conditions
public string ProcessPayment(Payment payment) =>
    payment switch
    {
        CreditCardPayment { IsExpired: false, Amount: > 0 } cc when cc.HasSufficientCredit()
            => ProcessCreditCard(cc),
        BankTransferPayment bt when bt.Account.IsActive && bt.Amount <= bt.Account.Balance
            => ProcessBankTransfer(bt),
        CashPayment { Amount: > 0 } cash
            => ProcessCash(cash),
        _ => throw new InvalidOperationException("Payment cannot be processed")
    };
```

### Primary Constructors と Collection Expressions

```csharp
// Primary constructors (C# 12)
public class OrderService(IRepository<Order> repository, ILogger<OrderService> logger)
{
    public async Task<Order> CreateOrderAsync(CreateOrderRequest request)
    {
        logger.LogInformation("Creating order for customer {CustomerId}", request.CustomerId);
        
        var order = new Order
        {
            CustomerId = request.CustomerId,
            Items = [..request.Items.Select(MapToOrderItem)],
            CreatedAt = DateTime.UtcNow
        };

        return await repository.AddAsync(order);
    }

    private OrderItem MapToOrderItem(CreateOrderItemRequest item) => new()
    {
        ProductId = item.ProductId,
        Quantity = item.Quantity,
        Price = item.Price
    };
}

// Collection expressions with spread operator
public class InventoryManager
{
    private readonly List<Product> _products = [];

    public void AddProducts(IEnumerable<Product> newProducts, Product specialProduct)
    {
        // Collection expressions with spread
        _products.AddRange([specialProduct, ..newProducts.Where(p => p.IsActive)]);
    }

    public Product[] GetTopProducts(int count) =>
        [.._products.OrderByDescending(p => p.Sales).Take(count)];
}
```

## ASP.NET Core 高度パターン

### Minimal APIs と Endpoint Filters

```csharp
// Program.cs - Modern startup pattern
var builder = WebApplication.CreateBuilder(args);

// Service registration with extension methods
builder.Services
    .AddApplicationServices()
    .AddInfrastructureServices(builder.Configuration)
    .AddApiVersioning()
    .AddSwaggerDocumentation();

var app = builder.Build();

// Middleware pipeline
app.UseSecurityHeaders()
   .UseApiVersioning()
   .UseSwaggerDocumentation()
   .UseGlobalExceptionHandling();

// Minimal API with filters and validation
var ordersApi = app.MapGroup("/api/v{version:apiVersion}/orders")
    .WithTags("Orders")
    .AddEndpointFilter<ValidationFilter<CreateOrderRequest>>()
    .AddEndpointFilter<AuthorizationFilter>()
    .RequireRateLimiting("orders");

ordersApi.MapPost("/", CreateOrderAsync)
    .WithName("CreateOrder")
    .WithSummary("Create a new order")
    .Produces<OrderResponse>(201)
    .ProducesValidationProblem()
    .RequireAuthorization();

ordersApi.MapGet("/{id:guid}", GetOrderAsync)
    .WithName("GetOrder")
    .CacheOutput(x => x.Expire(TimeSpan.FromMinutes(5)).Tag("orders"));

app.Run();

// Endpoint implementation
static async Task<Results<CreatedAtRoute<OrderResponse>, ValidationProblem>> CreateOrderAsync(
    CreateOrderRequest request,
    IOrderService orderService,
    IValidator<CreateOrderRequest> validator)
{
    var validationResult = await validator.ValidateAsync(request);
    if (!validationResult.IsValid)
    {
        return TypedResults.ValidationProblem(validationResult.ToDictionary());
    }

    var order = await orderService.CreateAsync(request);
    var response = OrderResponse.FromOrder(order);
    
    return TypedResults.CreatedAtRoute(response, "GetOrder", new { id = order.Id });
}
```

### Advanced Dependency Injection Patterns

```csharp
// Service registration extensions
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        // Scrutor for assembly scanning
        services.Scan(scan => scan
            .FromAssemblyOf<IOrderService>()
            .AddClasses(classes => classes.AssignableTo<IService>())
            .AsImplementedInterfaces()
            .WithScopedLifetime());

        // Decorator pattern with Scrutor
        services.Decorate<IOrderService, CachedOrderService>();
        services.Decorate<IOrderService, LoggedOrderService>();

        // Factory pattern
        services.AddTransient<Func<PaymentType, IPaymentProcessor>>(provider => paymentType =>
            paymentType switch
            {
                PaymentType.CreditCard => provider.GetRequiredService<CreditCardProcessor>(),
                PaymentType.BankTransfer => provider.GetRequiredService<BankTransferProcessor>(),
                PaymentType.PayPal => provider.GetRequiredService<PayPalProcessor>(),
                _ => throw new ArgumentException($"Unknown payment type: {paymentType}")
            });

        return services;
    }

    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Options pattern with validation
        services.AddOptions<DatabaseOptions>()
            .BindConfiguration("Database")
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddOptions<ApiOptions>()
            .BindConfiguration("Api")
            .Validate(options => !string.IsNullOrEmpty(options.BaseUrl), "BaseUrl is required")
            .ValidateOnStart();

        // Conditional service registration
        if (configuration.GetValue<bool>("UseRedisCache"))
        {
            services.AddStackExchangeRedisCache(options =>
            {
                options.Configuration = configuration.GetConnectionString("Redis");
                options.InstanceName = "MyApp";
            });
        }
        else
        {
            services.AddMemoryCache();
        }

        return services;
    }
}

// Decorator pattern implementation
public class CachedOrderService(IOrderService inner, IMemoryCache cache) : IOrderService
{
    public async Task<Order?> GetByIdAsync(Guid id)
    {
        var cacheKey = $"order:{id}";
        
        if (cache.TryGetValue<Order>(cacheKey, out var cachedOrder))
        {
            return cachedOrder;
        }

        var order = await inner.GetByIdAsync(id);
        if (order is not null)
        {
            cache.Set(cacheKey, order, TimeSpan.FromMinutes(10));
        }

        return order;
    }

    public async Task<Order> CreateAsync(CreateOrderRequest request)
    {
        var order = await inner.CreateAsync(request);
        var cacheKey = $"order:{order.Id}";
        cache.Set(cacheKey, order, TimeSpan.FromMinutes(10));
        return order;
    }
}
```

### Entity Framework Core 高度パターン

```csharp
// DbContext with advanced configuration
public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Product> Products => Set<Product>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Apply all configurations from assembly
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        // Global query filters
        modelBuilder.Entity<Order>()
            .HasQueryFilter(o => !o.IsDeleted);

        // Value conversions
        modelBuilder.Entity<Order>()
            .Property(o => o.Status)
            .HasConversion<string>();

        // Temporal tables (SQL Server)
        modelBuilder.Entity<Order>()
            .ToTable("Orders", tb => tb.IsTemporal());

        base.OnModelCreating(modelBuilder);
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder
            .EnableSensitiveDataLogging(false)
            .EnableServiceProviderCaching()
            .EnableDetailedErrors()
            .LogTo(Console.WriteLine, LogLevel.Information);
    }

    // Bulk operations with EF Core Extensions
    public async Task<int> BulkUpdateOrderStatusAsync(List<Guid> orderIds, OrderStatus status)
    {
        return await Orders
            .Where(o => orderIds.Contains(o.Id))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(o => o.Status, status)
                .SetProperty(o => o.UpdatedAt, DateTime.UtcNow));
    }

    // Raw SQL with interpolated parameters
    public async Task<List<OrderSummary>> GetOrderSummariesAsync(DateTime from, DateTime to)
    {
        return await Database
            .SqlQuery<OrderSummary>($"""
                SELECT 
                    o.Id,
                    o.CustomerId,
                    o.TotalAmount,
                    c.Name as CustomerName
                FROM Orders o
                INNER JOIN Customers c ON o.CustomerId = c.Id
                WHERE o.CreatedAt BETWEEN {from} AND {to}
                ORDER BY o.CreatedAt DESC
            """)
            .ToListAsync();
    }
}

// Entity configuration with Fluent API
public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Orders");
        
        builder.HasKey(o => o.Id);
        
        builder.Property(o => o.OrderNumber)
            .HasMaxLength(50)
            .IsRequired();
            
        builder.HasIndex(o => o.OrderNumber)
            .IsUnique();

        // Owned types
        builder.OwnsOne(o => o.ShippingAddress, address =>
        {
            address.Property(a => a.Street).HasMaxLength(200);
            address.Property(a => a.City).HasMaxLength(100);
            address.Property(a => a.ZipCode).HasMaxLength(10);
        });

        // One-to-many with cascade delete
        builder.HasMany(o => o.Items)
            .WithOne(i => i.Order)
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        // Value object conversion
        builder.Property(o => o.Money)
            .HasConversion(
                m => m.Amount,
                amount => new Money(amount))
            .HasPrecision(18, 2);

        // Concurrency token
        builder.Property(o => o.Version)
            .IsRowVersion();
    }
}
```

## 非同期プログラミングパターン

### Advanced Async/Await Patterns

```csharp
// Async enumerable with cancellation
public class DataProcessor
{
    public async IAsyncEnumerable<ProcessedData> ProcessLargeDatasetAsync(
        IAsyncEnumerable<RawData> source,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        await foreach (var batch in source.Batch(100).WithCancellation(cancellationToken))
        {
            var tasks = batch.Select(async data =>
            {
                try
                {
                    return await ProcessSingleItemAsync(data, cancellationToken);
                }
                catch (Exception ex)
                {
                    // Log error but continue processing
                    _logger.LogError(ex, "Error processing item {Id}", data.Id);
                    return null;
                }
            });

            var results = await Task.WhenAll(tasks);
            
            foreach (var result in results.Where(r => r is not null))
            {
                yield return result!;
            }
        }
    }

    // Parallel processing with SemaphoreSlim for throttling
    public async Task<List<T>> ProcessConcurrentlyAsync<T>(
        IEnumerable<Func<Task<T>>> tasks,
        int maxConcurrency = Environment.ProcessorCount)
    {
        using var semaphore = new SemaphoreSlim(maxConcurrency);
        var results = new ConcurrentBag<T>();

        var wrappedTasks = tasks.Select(async task =>
        {
            await semaphore.WaitAsync();
            try
            {
                var result = await task();
                results.Add(result);
            }
            finally
            {
                semaphore.Release();
            }
        });

        await Task.WhenAll(wrappedTasks);
        return [..results];
    }

    // Resilient HTTP client with Polly
    public async Task<ApiResponse<T>> CallExternalApiAsync<T>(
        string endpoint,
        CancellationToken cancellationToken = default)
    {
        var retryPolicy = Policy
            .Handle<HttpRequestException>()
            .Or<TaskCanceledException>()
            .WaitAndRetryAsync(
                retryCount: 3,
                sleepDurationProvider: retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
                onRetry: (outcome, timespan, retryCount, context) =>
                {
                    _logger.LogWarning("Retry {RetryCount} for {Endpoint} after {Delay}ms", 
                        retryCount, endpoint, timespan.TotalMilliseconds);
                });

        return await retryPolicy.ExecuteAsync(async () =>
        {
            using var response = await _httpClient.GetAsync(endpoint, cancellationToken);
            response.EnsureSuccessStatusCode();
            
            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            var data = JsonSerializer.Deserialize<T>(json, _jsonOptions);
            
            return new ApiResponse<T>(data, response.StatusCode);
        });
    }
}
```

### Background Services と Hosted Services

```csharp
// Background service with timer and graceful shutdown
public class OrderProcessingService(
    IServiceProvider serviceProvider,
    ILogger<OrderProcessingService> logger,
    IOptionsMonitor<ProcessingOptions> options) : BackgroundService
{
    private readonly PeriodicTimer _timer = new(TimeSpan.FromSeconds(30));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Order processing service started");

        try
        {
            while (await _timer.WaitForNextTickAsync(stoppingToken))
            {
                await ProcessPendingOrdersAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            logger.LogInformation("Order processing service is stopping");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error in order processing service");
            throw;
        }
    }

    private async Task ProcessPendingOrdersAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceProvider.CreateScope();
        var orderService = scope.ServiceProvider.GetRequiredService<IOrderService>();
        
        var batchSize = options.CurrentValue.BatchSize;
        var pendingOrders = await orderService.GetPendingOrdersAsync(batchSize, cancellationToken);

        if (!pendingOrders.Any()) return;

        logger.LogInformation("Processing {Count} pending orders", pendingOrders.Count);

        var tasks = pendingOrders.Select(async order =>
        {
            try
            {
                await orderService.ProcessOrderAsync(order.Id, cancellationToken);
                logger.LogDebug("Processed order {OrderId}", order.Id);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to process order {OrderId}", order.Id);
            }
        });

        await Task.WhenAll(tasks);
    }

    public override void Dispose()
    {
        _timer.Dispose();
        base.Dispose();
    }
}

// Channel-based producer-consumer pattern
public class MessageProcessor
{
    private readonly Channel<ProcessingMessage> _channel;
    private readonly ChannelWriter<ProcessingMessage> _writer;
    private readonly ChannelReader<ProcessingMessage> _reader;

    public MessageProcessor(int capacity = 1000)
    {
        var options = new BoundedChannelOptions(capacity)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true,
            SingleWriter = false
        };

        _channel = Channel.CreateBounded<ProcessingMessage>(options);
        _writer = _channel.Writer;
        _reader = _channel.Reader;
    }

    public async ValueTask<bool> EnqueueAsync(ProcessingMessage message, CancellationToken cancellationToken = default)
    {
        try
        {
            await _writer.WriteAsync(message, cancellationToken);
            return true;
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }

    public async IAsyncEnumerable<ProcessingMessage> ReadAllAsync(
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        await foreach (var message in _reader.ReadAllAsync(cancellationToken))
        {
            yield return message;
        }
    }

    public void Complete() => _writer.Complete();
}
```

## パフォーマンス最適化パターン

### Memory Optimization と Object Pooling

```csharp
// Object pooling for high-frequency objects
public class PooledStringBuilder
{
    private static readonly ObjectPool<StringBuilder> Pool = 
        new DefaultObjectPool<StringBuilder>(new StringBuilderPooledObjectPolicy());

    public static PooledStringBuilder Get() => new();
    
    private readonly StringBuilder _sb;
    
    private PooledStringBuilder()
    {
        _sb = Pool.Get();
    }

    public PooledStringBuilder Append(string value)
    {
        _sb.Append(value);
        return this;
    }

    public PooledStringBuilder AppendLine(string value)
    {
        _sb.AppendLine(value);
        return this;
    }

    public override string ToString() => _sb.ToString();

    public void Dispose()
    {
        Pool.Return(_sb);
    }
}

public class StringBuilderPooledObjectPolicy : IPooledObjectPolicy<StringBuilder>
{
    public StringBuilder Create() => new();

    public bool Return(StringBuilder obj)
    {
        if (obj.Capacity > 1024)
        {
            return false; // Don't return large builders to pool
        }

        obj.Clear();
        return true;
    }
}

// ArrayPool usage for temporary arrays
public class DataProcessor
{
    public async Task<byte[]> ProcessLargeDataAsync(Stream input)
    {
        var buffer = ArrayPool<byte>.Shared.Rent(4096);
        try
        {
            using var output = new MemoryStream();
            int bytesRead;
            
            while ((bytesRead = await input.ReadAsync(buffer.AsMemory(0, buffer.Length))) > 0)
            {
                // Process data in buffer
                ProcessBuffer(buffer.AsSpan(0, bytesRead));
                await output.WriteAsync(buffer.AsMemory(0, bytesRead));
            }

            return output.ToArray();
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }

    private static void ProcessBuffer(Span<byte> buffer)
    {
        // Process data using Span<T> for zero-allocation operations
        for (int i = 0; i < buffer.Length; i++)
        {
            buffer[i] = (byte)(buffer[i] ^ 0xFF); // Simple XOR operation
        }
    }
}
```

### LINQ Performance Optimization

```csharp
public class OptimizedQueryService
{
    // Use spans and memory for high-performance scenarios
    public ReadOnlySpan<T> FilterAndSlice<T>(ReadOnlySpan<T> source, Predicate<T> predicate, int count)
        where T : struct
    {
        var result = new T[count];
        var resultIndex = 0;

        for (int i = 0; i < source.Length && resultIndex < count; i++)
        {
            if (predicate(source[i]))
            {
                result[resultIndex++] = source[i];
            }
        }

        return result.AsSpan(0, resultIndex);
    }

    // Compiled expressions for repeated operations
    private static readonly Func<Customer, bool> IsActiveCustomer = 
        customer => customer.IsActive && customer.LastLoginDate > DateTime.Now.AddMonths(-6);

    public IEnumerable<Customer> GetActiveCustomers(IEnumerable<Customer> customers)
    {
        return customers.Where(IsActiveCustomer);
    }

    // Avoid multiple enumeration with caching
    public async Task<CustomerSummary> CalculateCustomerSummaryAsync(IEnumerable<Customer> customers)
    {
        // Materialize once to avoid multiple enumeration
        var customerList = customers as IList<Customer> ?? customers.ToList();
        
        var activeCustomers = customerList.Where(IsActiveCustomer).ToList();
        
        return new CustomerSummary
        {
            TotalCustomers = customerList.Count,
            ActiveCustomers = activeCustomers.Count,
            AverageOrderValue = await CalculateAverageOrderValueAsync(activeCustomers),
            TopCustomers = activeCustomers
                .OrderByDescending(c => c.TotalSpent)
                .Take(10)
                .ToList()
        };
    }
}
```

## テストパターン

### Unit Testing with Advanced Patterns

```csharp
// Test fixtures with dependency injection
public class OrderServiceTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly ITestOutputHelper _output;

    public OrderServiceTests(WebApplicationFactory<Program> factory, ITestOutputHelper output)
    {
        _factory = factory;
        _output = output;
    }

    [Theory]
    [InlineData(100, CustomerType.Regular, 0.05)]
    [InlineData(500, CustomerType.Premium, 0.10)]
    [InlineData(1000, CustomerType.Premium, 0.15)]
    public async Task CalculateDiscount_ShouldReturnCorrectDiscount(
        decimal orderAmount, CustomerType customerType, decimal expectedDiscount)
    {
        // Arrange
        using var scope = _factory.Services.CreateScope();
        var orderService = scope.ServiceProvider.GetRequiredService<IOrderService>();
        
        var customer = new Customer { Type = customerType, YearsActive = 1 };
        var order = new Order { Amount = orderAmount };

        // Act
        var discount = await orderService.CalculateDiscountAsync(customer, order);

        // Assert
        discount.Should().Be(expectedDiscount);
    }

    [Fact]
    public async Task CreateOrder_WhenInventoryInsufficient_ShouldThrowException()
    {
        // Arrange
        using var scope = _factory.Services.CreateScope();
        var mockInventory = scope.ServiceProvider.GetRequiredService<Mock<IInventoryService>>();
        
        mockInventory.Setup(x => x.CheckAvailabilityAsync(It.IsAny<Guid>(), It.IsAny<int>()))
            .ReturnsAsync(false);

        var orderService = scope.ServiceProvider.GetRequiredService<IOrderService>();
        var request = new CreateOrderRequest
        {
            Items = [new() { ProductId = Guid.NewGuid(), Quantity = 5 }]
        };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InsufficientInventoryException>(
            () => orderService.CreateAsync(request));
        
        exception.ProductId.Should().NotBeEmpty();
        _output.WriteLine($"Exception thrown for product: {exception.ProductId}");
    }
}

// Integration tests with TestContainers
public class DatabaseIntegrationTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithDatabase("testdb")
        .WithUsername("testuser")
        .WithPassword("testpass")
        .Build();

    private ApplicationDbContext _dbContext = null!;

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;

        _dbContext = new ApplicationDbContext(options);
        await _dbContext.Database.EnsureCreatedAsync();
    }

    [Fact]
    public async Task Repository_ShouldPersistAndRetrieveOrder()
    {
        // Arrange
        var repository = new Repository<Order>(_dbContext);
        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderNumber = "ORD-001",
            CustomerId = Guid.NewGuid(),
            TotalAmount = 100.50m,
            CreatedAt = DateTime.UtcNow
        };

        // Act
        var savedOrder = await repository.AddAsync(order);
        var retrievedOrder = await repository.GetByIdAsync(savedOrder.Id);

        // Assert
        retrievedOrder.Should().NotBeNull();
        retrievedOrder!.OrderNumber.Should().Be(order.OrderNumber);
        retrievedOrder.TotalAmount.Should().Be(order.TotalAmount);
    }

    public async Task DisposeAsync()
    {
        await _dbContext.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}
```

## ベストプラクティス

1. **Nullable Reference Types**: 常に有効化し、null安全性を確保
2. **Records**: 不変データ構造にはrecordを活用
3. **Pattern Matching**: 複雑な条件分岐はswitch expressionsで簡潔に
4. **Async/Await**: ConfigureAwait(false)は不要（.NET 6+）
5. **Memory Optimization**: Span<T>、Memory<T>、ArrayPoolを活用
6. **DI Container**: Scrutorでアセンブリスキャンを活用
7. **EF Core**: クエリフィルタ、バルク操作、コンパイルクエリを活用
8. **Testing**: TestContainers、xUnit、FluentAssertionsの組み合わせ
9. **Performance**: BenchmarkDotNet でパフォーマンス測定を習慣化
10. **Logging**: Serilog + Application Insights でクラウドネイティブなログ収集