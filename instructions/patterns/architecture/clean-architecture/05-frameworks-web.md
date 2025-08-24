# Clean Architecture - Webフレームワーク実装

> Express.jsとFastAPIによるWeb層の実装例

## 概要

Frameworks & Drivers層は、Clean Architectureの最外層に位置し、データベース、Webサーバー、UI、外部APIなどの技術的詳細を実装します。この層の変更は内側の層に影響を与えないように設計する必要があります。

## Express.js アプリケーション

```typescript
// infrastructure/web/express-app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';

export class ExpressApp {
  private app: express.Application;

  constructor(
    private userController: UserController,
    private productController: ProductController,
    private orderController: OrderController,
    private authMiddleware: AuthMiddleware,
    private errorHandler: ErrorHandler,
    private logger: Logger
  ) {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // セキュリティ
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true
    }));

    // パフォーマンス
    this.app.use(compression());

    // ボディパーサー
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // レート制限
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15分
      max: 100, // リクエスト数制限
      message: 'Too many requests from this IP'
    });
    this.app.use('/api', limiter);

    // リクエストログ
    this.app.use((req, res, next) => {
      this.logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      next();
    });
  }

  private setupRoutes(): void {
    const router = express.Router();

    // ユーザー関連
    router.post('/users/register', 
      this.adaptController(this.userController.register.bind(this.userController))
    );
    
    router.post('/users/login',
      this.adaptController(this.userController.login.bind(this.userController))
    );
    
    router.get('/users/:userId',
      this.authMiddleware.authenticate,
      this.adaptController(this.userController.getProfile.bind(this.userController))
    );
    
    router.put('/users/:userId',
      this.authMiddleware.authenticate,
      this.authMiddleware.authorizeOwner,
      this.adaptController(this.userController.updateProfile.bind(this.userController))
    );

    // 商品関連
    router.get('/products',
      this.adaptController(this.productController.list.bind(this.productController))
    );
    
    router.get('/products/:productId',
      this.adaptController(this.productController.getById.bind(this.productController))
    );
    
    router.post('/products',
      this.authMiddleware.authenticate,
      this.authMiddleware.authorizeAdmin,
      this.adaptController(this.productController.create.bind(this.productController))
    );
    
    router.put('/products/:productId',
      this.authMiddleware.authenticate,
      this.authMiddleware.authorizeAdmin,
      this.adaptController(this.productController.update.bind(this.productController))
    );

    // 注文関連
    router.post('/orders',
      this.authMiddleware.authenticate,
      this.adaptController(this.orderController.place.bind(this.orderController))
    );
    
    router.get('/orders/:orderId',
      this.authMiddleware.authenticate,
      this.adaptController(this.orderController.getById.bind(this.orderController))
    );
    
    router.get('/users/:userId/orders',
      this.authMiddleware.authenticate,
      this.authMiddleware.authorizeOwner,
      this.adaptController(this.orderController.getUserOrders.bind(this.orderController))
    );

    this.app.use('/api/v1', router);

    // ヘルスチェック
    this.app.get('/health', (req, res) => {
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });
  }

  private setupErrorHandling(): void {
    // 404ハンドラー
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path
      });
    });

    // エラーハンドラー
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.errorHandler.handle(err, req, res);
    });
  }

  private adaptController(controller: Function) {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const httpRequest: HttpRequest = {
          body: req.body,
          query: req.query,
          params: req.params,
          headers: req.headers,
          user: (req as any).user
        };

        const httpResponse = await controller(httpRequest);

        res.status(httpResponse.statusCode).json(httpResponse.body);
      } catch (error) {
        next(error);
      }
    };
  }

  start(port: number): void {
    this.app.listen(port, () => {
      this.logger.info(`Server started on port ${port}`);
    });
  }
}
```

## FastAPIアプリケーション（Python例）

```python
# infrastructure/web/fastapi_app.py
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import HTTPBearer
import uvicorn

class FastAPIApp:
    def __init__(
        self,
        user_controller: UserController,
        product_controller: ProductController,
        auth_service: AuthService,
        logger: Logger
    ):
        self.app = FastAPI(title="Clean Architecture API", version="1.0.0")
        self.user_controller = user_controller
        self.product_controller = product_controller
        self.auth_service = auth_service
        self.logger = logger
        
        self.setup_middleware()
        self.setup_routes()
        self.setup_exception_handlers()

    def setup_middleware(self):
        # CORS設定
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        # Gzip圧縮
        self.app.add_middleware(GZipMiddleware, minimum_size=1000)

    def setup_routes(self):
        # ユーザー関連
        @self.app.post("/api/v1/users/register", status_code=201)
        async def register_user(request: RegisterUserRequest):
            return await self.user_controller.register(request)

        @self.app.post("/api/v1/users/login")
        async def login_user(request: LoginRequest):
            return await self.user_controller.login(request)

        @self.app.get("/api/v1/users/{user_id}")
        async def get_user_profile(
            user_id: str,
            current_user: dict = Depends(self.get_current_user)
        ):
            return await self.user_controller.get_profile(user_id, current_user)

        # 商品関連
        @self.app.get("/api/v1/products")
        async def list_products(page: int = 1, limit: int = 20):
            return await self.product_controller.list(page, limit)

        @self.app.post("/api/v1/products", status_code=201)
        async def create_product(
            request: CreateProductRequest,
            current_user: dict = Depends(self.require_admin)
        ):
            return await self.product_controller.create(request)

    def setup_exception_handlers(self):
        @self.app.exception_handler(HTTPException)
        async def http_exception_handler(request, exc):
            self.logger.error(f"HTTP exception: {exc.detail}", extra={
                "path": str(request.url),
                "method": request.method,
                "status_code": exc.status_code
            })
            return JSONResponse(
                status_code=exc.status_code,
                content={"error": exc.detail}
            )

    async def get_current_user(self, token: str = Depends(HTTPBearer())):
        user = await self.auth_service.verify_token(token.credentials)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        return user

    def start(self, port: int = 8000):
        uvicorn.run(self.app, host="0.0.0.0", port=port)
```