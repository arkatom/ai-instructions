# NestJS コントローラー - API設計

RESTful APIとGraphQL統合、バリデーション戦略。

## 🌐 RESTful API設計

### 基本的なCRUDコントローラー

```typescript
// user/user.controller.ts
@Controller('users')
@ApiTags('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly logger: Logger
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseInterceptors(CacheInterceptor)
  async findAll(
    @Query() query: PaginationDto,
    @CurrentUser() user: User
  ): Promise<PaginatedResult<UserDto>> {
    this.logger.log(`User ${user.id} fetching users list`);
    return this.userService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<UserDto> {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Post()
  @ApiOperation({ summary: 'Create new user' })
  @ApiBody({ type: CreateUserDto })
  @RequireRoles('admin')
  @UseGuards(RolesGuard)
  async create(
    @Body() createUserDto: CreateUserDto
  ): Promise<UserDto> {
    return this.userService.create(createUserDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: User
  ): Promise<UserDto> {
    // 自分自身または管理者のみ更新可能
    if (currentUser.id !== id && !currentUser.isAdmin()) {
      throw new ForbiddenException();
    }
    return this.userService.update(id, updateUserDto);
  }
}
```

### バリデーションとDTO

```typescript
// dto/create-user.dto.ts
export class CreateUserDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase and number'
  })
  password: string;

  @ApiPropertyOptional({ example: ['user'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roles?: string[];
}

// カスタムバリデーター
@ValidatorConstraint({ name: 'isUniqueEmail', async: true })
@Injectable()
export class IsUniqueEmailConstraint implements ValidatorConstraintInterface {
  constructor(private userService: UserService) {}

  async validate(email: string): Promise<boolean> {
    const user = await this.userService.findByEmail(email);
    return !user;
  }

  defaultMessage(): string {
    return 'Email $value already exists';
  }
}
```

## 📡 GraphQL統合

```typescript
// user/user.resolver.ts
@Resolver(() => UserType)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly dataLoader: DataLoader
  ) {}

  @Query(() => [UserType])
  @UseGuards(GqlAuthGuard)
  async users(
    @Args('filter', { nullable: true }) filter?: UserFilterInput,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput
  ): Promise<UserType[]> {
    return this.userService.findAll({ filter, pagination });
  }

  @Query(() => UserType)
  async user(@Args('id', { type: () => ID }) id: string): Promise<UserType> {
    return this.userService.findById(id);
  }

  @Mutation(() => UserType)
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @RequireRoles('admin')
  async createUser(
    @Args('input') input: CreateUserInput
  ): Promise<UserType> {
    return this.userService.create(input);
  }

  // DataLoader使用のフィールドリゾルバー
  @ResolveField(() => [PostType])
  async posts(@Parent() user: UserType): Promise<PostType[]> {
    return this.dataLoader.load(user.id);
  }
}
```

## 🎯 エラーハンドリング

```typescript
// filters/http-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    }

    this.logger.error(
      `${request.method} ${request.url} ${status} - ${message}`,
      exception instanceof Error ? exception.stack : ''
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message
    });
  }
}
```

## 🎯 ベストプラクティス

- **DTOによる型安全性**: 入出力の明確な定義
- **デコレーターベースのメタデータ**: OpenAPI自動生成
- **ガード・インターセプター活用**: 横断的関心事の分離
- **エラーハンドリング統一**: 一貫性のあるレスポンス