# Java Patterns

Modern patterns for enterprise Java applications.

## Basic Structure

### Project Layout (Spring Boot)
```
src/
├── main/
│   ├── java/
│   │   └── com/example/app/
│   │       ├── controller/
│   │       ├── service/
│   │       ├── repository/
│   │       ├── entity/
│   │       ├── dto/
│   │       └── config/
│   └── resources/
│       └── application.yml
└── test/
```

## Spring Boot Patterns

### REST Controller
```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    
    @GetMapping("/{id}")
    public ResponseEntity<UserDto> getUser(@PathVariable Long id) {
        return userService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
    
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserDto createUser(@Valid @RequestBody CreateUserDto dto) {
        return userService.create(dto);
    }
    
    @ExceptionHandler(ValidationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleValidation(ValidationException e) {
        return new ErrorResponse(e.getMessage());
    }
}
```

### Service Layer
```java
@Service
@Transactional
@RequiredArgsConstructor
public class UserService {
    private final UserRepository repository;
    private final UserMapper mapper;
    
    public Optional<UserDto> findById(Long id) {
        return repository.findById(id)
            .map(mapper::toDto);
    }
    
    public UserDto create(CreateUserDto dto) {
        User user = mapper.toEntity(dto);
        user = repository.save(user);
        return mapper.toDto(user);
    }
}
```

## Data Access

### JPA Repository
```java
@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private String email;
    
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    private List<Order> orders = new ArrayList<>();
    
    @CreatedDate
    private LocalDateTime createdAt;
}

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    
    @Query("SELECT u FROM User u JOIN FETCH u.orders WHERE u.id = :id")
    Optional<User> findByIdWithOrders(@Param("id") Long id);
    
    @Modifying
    @Query("UPDATE User u SET u.lastLogin = :time WHERE u.id = :id")
    void updateLastLogin(@Param("id") Long id, @Param("time") LocalDateTime time);
}
```

## Functional Programming

### Stream API
```java
// Filter and map
List<String> activeUserEmails = users.stream()
    .filter(User::isActive)
    .map(User::getEmail)
    .collect(Collectors.toList());

// Grouping
Map<Department, List<User>> byDepartment = users.stream()
    .collect(Collectors.groupingBy(User::getDepartment));

// Reduce
BigDecimal total = orders.stream()
    .map(Order::getAmount)
    .reduce(BigDecimal.ZERO, BigDecimal::add);
```

### Optional Usage
```java
public String getUserEmail(Long id) {
    return userRepository.findById(id)
        .map(User::getEmail)
        .filter(email -> email.contains("@"))
        .orElseThrow(() -> new UserNotFoundException(id));
}
```

## Exception Handling

### Global Exception Handler
```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(EntityNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(EntityNotFoundException e) {
        return ErrorResponse.of(e.getMessage());
    }
    
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ValidationErrorResponse handleValidation(
            MethodArgumentNotValidException e) {
        Map<String, String> errors = e.getBindingResult()
            .getFieldErrors().stream()
            .collect(Collectors.toMap(
                FieldError::getField,
                FieldError::getDefaultMessage
            ));
        return new ValidationErrorResponse(errors);
    }
}
```

## Async Processing

### CompletableFuture
```java
@Service
public class AsyncService {
    
    @Async
    public CompletableFuture<User> findUserAsync(Long id) {
        User user = userRepository.findById(id).orElse(null);
        return CompletableFuture.completedFuture(user);
    }
    
    public CompletableFuture<CombinedData> fetchDataConcurrently() {
        CompletableFuture<User> userFuture = findUserAsync(1L);
        CompletableFuture<List<Order>> ordersFuture = findOrdersAsync();
        
        return userFuture.thenCombine(ordersFuture,
            (user, orders) -> new CombinedData(user, orders));
    }
}
```

## Validation

### Bean Validation
```java
@Data
public class CreateUserDto {
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;
    
    @NotNull
    @Size(min = 8, max = 100)
    @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).*$",
             message = "Password must contain uppercase, lowercase and number")
    private String password;
    
    @Min(18)
    @Max(120)
    private Integer age;
}

// Custom validator
@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = UniqueEmailValidator.class)
public @interface UniqueEmail {
    String message() default "Email already exists";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

## Testing

### JUnit 5 and Mockito
```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock
    private UserRepository repository;
    
    @InjectMocks
    private UserService service;
    
    @Test
    void findById_WhenExists_ReturnsUser() {
        // Given
        User user = new User(1L, "test@example.com");
        when(repository.findById(1L)).thenReturn(Optional.of(user));
        
        // When
        Optional<UserDto> result = service.findById(1L);
        
        // Then
        assertThat(result).isPresent();
        assertThat(result.get().getEmail()).isEqualTo("test@example.com");
        verify(repository).findById(1L);
    }
}
```

### Integration Test
```java
@SpringBootTest
@AutoConfigureMockMvc
class UserControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;
    
    @Test
    void createUser_WithValidData_Returns201() throws Exception {
        String json = """
            {
                "email": "test@example.com",
                "password": "SecurePass123"
            }
            """;
        
        mockMvc.perform(post("/api/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.email").value("test@example.com"));
    }
}
```

## Checklist
- [ ] Spring Boot utilized
- [ ] Layer architecture clear
- [ ] JPA properly used
- [ ] Stream API utilized
- [ ] Optional used
- [ ] Exception handling unified
- [ ] Bean Validation
- [ ] Comprehensive tests