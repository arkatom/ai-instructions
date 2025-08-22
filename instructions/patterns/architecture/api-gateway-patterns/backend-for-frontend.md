# Backend for Frontend (BFF) Pattern

> 🎯 **目的**: クライアント固有のAPIゲートウェイによる最適化されたデータ配信
> 
> 📊 **対象**: Web、Mobile、Desktop向けBFF実装、GraphQL統合、データ集約
> 
> ⚡ **特徴**: クライアント最適化、オフライン同期、パフォーマンス最適化

## Core BFF Gateway Implementation

```typescript
// src/gateway/bff/BFFGateway.ts
import { Request, Response, Router } from 'express';
import { GraphQLSchema, buildSchema } from 'graphql';
import { graphqlHTTP } from 'express-graphql';
import DataLoader from 'dataloader';

export interface BFFConfig {
  client: 'web' | 'mobile' | 'desktop';
  services: Map<string, ServiceClient>;
  caching?: CacheConfig;
  batching?: boolean;
}

export class BFFGateway {
  private router: Router;
  private dataLoaders: Map<string, DataLoader<any, any>> = new Map();
  
  constructor(private config: BFFConfig) {
    this.router = Router();
    this.setupRoutes();
    this.setupDataLoaders();
  }

  private setupRoutes(): void {
    // Client-specific endpoints
    switch (this.config.client) {
      case 'web':
        this.setupWebRoutes();
        break;
      case 'mobile':
        this.setupMobileRoutes();
        break;
      case 'desktop':
        this.setupDesktopRoutes();
        break;
    }
  }

  private setupWebRoutes(): void {
    // Aggregate data for web dashboard
    this.router.get('/dashboard', async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        
        // Parallel calls to multiple services
        const [profile, stats, notifications, activities] = await Promise.all([
          this.config.services.get('user')!.getProfile(userId),
          this.config.services.get('analytics')!.getUserStats(userId),
          this.config.services.get('notification')!.getUnread(userId),
          this.config.services.get('activity')!.getRecent(userId, 10)
        ]);

        // Transform and combine data for web client
        const dashboard = {
          user: {
            ...profile,
            stats: this.transformStatsForWeb(stats)
          },
          notifications: {
            unread: notifications.count,
            items: notifications.items.slice(0, 5)
          },
          recentActivity: activities.map(this.transformActivityForWeb)
        };

        res.json(dashboard);
      } catch (error) {
        console.error('Dashboard aggregation error:', error);
        res.status(500).json({ error: 'Failed to load dashboard' });
      }
    });

    // GraphQL endpoint for flexible queries
    this.router.use('/graphql', graphqlHTTP((req) => ({
      schema: this.buildWebSchema(),
      context: {
        user: req.user,
        loaders: this.dataLoaders
      },
      graphiql: process.env.NODE_ENV === 'development'
    })));
  }

  private setupMobileRoutes(): void {
    // Optimized endpoints for mobile
    this.router.get('/feed', async (req: Request, res: Response) => {
      const page = parseInt(req.query.page as string) || 1;
      const size = 20; // Smaller page size for mobile
      
      try {
        const feed = await this.config.services.get('content')!.getFeed(
          req.user!.id,
          page,
          size
        );

        // Optimize for mobile bandwidth
        const optimized = feed.items.map(item => ({
          id: item.id,
          type: item.type,
          title: item.title,
          summary: item.summary.substring(0, 100),
          thumbnail: this.getOptimizedImageUrl(item.image, 'mobile'),
          timestamp: item.timestamp
        }));

        res.json({
          items: optimized,
          hasMore: feed.hasMore,
          nextPage: feed.hasMore ? page + 1 : null
        });
      } catch (error) {
        console.error('Mobile feed error:', error);
        res.status(500).json({ error: 'Failed to load feed' });
      }
    });

    // Offline sync endpoint
    this.router.post('/sync', async (req: Request, res: Response) => {
      const { lastSync, changes } = req.body;
      
      try {
        // Process offline changes
        const results = await this.processOfflineChanges(changes);
        
        // Get updates since last sync
        const updates = await this.getUpdatesSince(lastSync, req.user!.id);
        
        res.json({
          processed: results,
          updates,
          serverTime: new Date().toISOString()
        });
      } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: 'Sync failed' });
      }
    });
  }

  private setupDesktopRoutes(): void {
    // Rich data endpoints for desktop
    this.router.get('/workspace', async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        
        // Load comprehensive data for desktop app
        const [
          profile,
          projects,
          teams,
          documents,
          calendar,
          tasks
        ] = await Promise.all([
          this.config.services.get('user')!.getFullProfile(userId),
          this.config.services.get('project')!.getUserProjects(userId),
          this.config.services.get('team')!.getUserTeams(userId),
          this.config.services.get('document')!.getRecent(userId, 50),
          this.config.services.get('calendar')!.getEvents(userId),
          this.config.services.get('task')!.getAssigned(userId)
        ]);

        res.json({
          profile,
          workspace: {
            projects: projects.map(this.enrichProject),
            teams: teams.map(this.enrichTeam),
            documents,
            calendar,
            tasks: this.organizeTasks(tasks)
          }
        });
      } catch (error) {
        console.error('Workspace load error:', error);
        res.status(500).json({ error: 'Failed to load workspace' });
      }
    });
  }

  private setupDataLoaders(): void {
    // User loader with batching
    this.dataLoaders.set('user', new DataLoader(async (userIds: string[]) => {
      const users = await this.config.services.get('user')!.getUsers(userIds);
      return userIds.map(id => users.find(u => u.id === id));
    }));

    // Project loader with caching
    this.dataLoaders.set('project', new DataLoader(
      async (projectIds: string[]) => {
        const projects = await this.config.services.get('project')!
          .getProjects(projectIds);
        return projectIds.map(id => projects.find(p => p.id === id));
      },
      {
        cache: true,
        cacheKeyFn: (key) => `project:${key}`
      }
    ));
  }

  private buildWebSchema(): GraphQLSchema {
    return buildSchema(`
      type User {
        id: ID!
        name: String!
        email: String!
        avatar: String
        role: String!
        teams: [Team!]!
        projects: [Project!]!
      }

      type Team {
        id: ID!
        name: String!
        description: String
        members: [User!]!
        projects: [Project!]!
      }

      type Project {
        id: ID!
        name: String!
        description: String
        status: ProjectStatus!
        team: Team!
        tasks: [Task!]!
        documents: [Document!]!
      }

      type Task {
        id: ID!
        title: String!
        description: String
        status: TaskStatus!
        assignee: User
        project: Project!
        dueDate: String
        priority: Priority!
      }

      type Document {
        id: ID!
        title: String!
        content: String!
        author: User!
        project: Project
        createdAt: String!
        updatedAt: String!
      }

      enum ProjectStatus {
        PLANNING
        IN_PROGRESS
        REVIEW
        COMPLETED
        ARCHIVED
      }

      enum TaskStatus {
        TODO
        IN_PROGRESS
        BLOCKED
        REVIEW
        DONE
      }

      enum Priority {
        LOW
        MEDIUM
        HIGH
        CRITICAL
      }

      type Query {
        me: User!
        user(id: ID!): User
        team(id: ID!): Team
        project(id: ID!): Project
        task(id: ID!): Task
        document(id: ID!): Document
        
        myTeams: [Team!]!
        myProjects: [Project!]!
        myTasks(status: TaskStatus): [Task!]!
        
        searchDocuments(query: String!): [Document!]!
        searchUsers(query: String!): [User!]!
      }

      type Mutation {
        updateProfile(input: UpdateProfileInput!): User!
        createProject(input: CreateProjectInput!): Project!
        updateTask(id: ID!, input: UpdateTaskInput!): Task!
        createDocument(input: CreateDocumentInput!): Document!
      }

      input UpdateProfileInput {
        name: String
        avatar: String
      }

      input CreateProjectInput {
        name: String!
        description: String
        teamId: ID!
      }

      input UpdateTaskInput {
        title: String
        description: String
        status: TaskStatus
        assigneeId: ID
        dueDate: String
        priority: Priority
      }

      input CreateDocumentInput {
        title: String!
        content: String!
        projectId: ID
      }
    `);
  }

  private transformStatsForWeb(stats: any): any {
    // Transform service data for web presentation
    return {
      totalProjects: stats.projects.total,
      activeProjects: stats.projects.active,
      completedTasks: stats.tasks.completed,
      pendingTasks: stats.tasks.pending,
      teamSize: stats.team.size,
      lastActivity: stats.activity.last
    };
  }

  private transformActivityForWeb(activity: any): any {
    // Format activity for web display
    return {
      id: activity.id,
      type: activity.type,
      description: activity.description,
      timestamp: new Date(activity.timestamp).toLocaleString(),
      user: {
        id: activity.userId,
        name: activity.userName,
        avatar: activity.userAvatar
      }
    };
  }

  private getOptimizedImageUrl(url: string, client: string): string {
    // Return CDN URL with client-specific optimization
    const params = {
      web: 'w=800&q=85',
      mobile: 'w=400&q=70',
      desktop: 'w=1200&q=90'
    };
    
    return `${process.env.CDN_URL}/${url}?${params[client]}`;
  }

  private async processOfflineChanges(changes: any[]): Promise<any[]> {
    const results = [];
    
    for (const change of changes) {
      try {
        const result = await this.applyChange(change);
        results.push({ id: change.id, success: true, result });
      } catch (error: any) {
        results.push({ 
          id: change.id, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return results;
  }

  private async applyChange(change: any): Promise<any> {
    const service = this.config.services.get(change.service);
    if (!service) {
      throw new Error(`Unknown service: ${change.service}`);
    }
    
    return await service[change.method](...change.args);
  }

  private async getUpdatesSince(
    timestamp: string,
    userId: string
  ): Promise<any> {
    // Get all updates since the given timestamp
    const updates = await Promise.all([
      this.config.services.get('notification')!
        .getNotificationsSince(userId, timestamp),
      this.config.services.get('activity')!
        .getActivitiesSince(userId, timestamp),
      this.config.services.get('message')!
        .getMessagesSince(userId, timestamp)
    ]);
    
    return {
      notifications: updates[0],
      activities: updates[1],
      messages: updates[2]
    };
  }

  private enrichProject(project: any): any {
    return {
      ...project,
      progress: this.calculateProjectProgress(project),
      health: this.assessProjectHealth(project),
      nextMilestone: this.getNextMilestone(project)
    };
  }

  private enrichTeam(team: any): any {
    return {
      ...team,
      availability: this.calculateTeamAvailability(team),
      workload: this.calculateTeamWorkload(team),
      performance: this.calculateTeamPerformance(team)
    };
  }

  private organizeTasks(tasks: any[]): any {
    return {
      today: tasks.filter(t => this.isDueToday(t)),
      thisWeek: tasks.filter(t => this.isDueThisWeek(t)),
      overdue: tasks.filter(t => this.isOverdue(t)),
      upcoming: tasks.filter(t => this.isUpcoming(t)),
      byPriority: this.groupByPriority(tasks),
      byProject: this.groupByProject(tasks)
    };
  }

  private calculateProjectProgress(project: any): number {
    const total = project.tasks.length;
    const completed = project.tasks.filter(
      (t: any) => t.status === 'DONE'
    ).length;
    return total > 0 ? (completed / total) * 100 : 0;
  }

  private assessProjectHealth(project: any): string {
    // Assess project health based on various metrics
    const overdueTasksRatio = project.tasks.filter(
      (t: any) => this.isOverdue(t)
    ).length / project.tasks.length;
    
    if (overdueTasksRatio > 0.3) return 'critical';
    if (overdueTasksRatio > 0.1) return 'warning';
    return 'healthy';
  }

  private getNextMilestone(project: any): any {
    return project.milestones
      .filter((m: any) => !m.completed)
      .sort((a: any, b: any) => 
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      )[0];
  }

  private calculateTeamAvailability(team: any): number {
    // Calculate team availability percentage
    const totalCapacity = team.members.length * 40; // 40 hours per week
    const allocatedHours = team.members.reduce(
      (sum: number, member: any) => sum + member.allocatedHours,
      0
    );
    return ((totalCapacity - allocatedHours) / totalCapacity) * 100;
  }

  private calculateTeamWorkload(team: any): any {
    return team.members.map((member: any) => ({
      userId: member.id,
      name: member.name,
      tasks: member.assignedTasks,
      hours: member.allocatedHours,
      capacity: member.capacity
    }));
  }

  private calculateTeamPerformance(team: any): any {
    return {
      velocity: team.metrics.velocity,
      efficiency: team.metrics.efficiency,
      quality: team.metrics.quality
    };
  }

  private isDueToday(task: any): boolean {
    const today = new Date();
    const dueDate = new Date(task.dueDate);
    return dueDate.toDateString() === today.toDateString();
  }

  private isDueThisWeek(task: any): boolean {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const dueDate = new Date(task.dueDate);
    return dueDate >= now && dueDate <= weekEnd;
  }

  private isOverdue(task: any): boolean {
    return new Date(task.dueDate) < new Date() && 
           task.status !== 'DONE';
  }

  private isUpcoming(task: any): boolean {
    const dueDate = new Date(task.dueDate);
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return dueDate > weekFromNow;
  }

  private groupByPriority(tasks: any[]): any {
    return {
      critical: tasks.filter(t => t.priority === 'CRITICAL'),
      high: tasks.filter(t => t.priority === 'HIGH'),
      medium: tasks.filter(t => t.priority === 'MEDIUM'),
      low: tasks.filter(t => t.priority === 'LOW')
    };
  }

  private groupByProject(tasks: any[]): any {
    return tasks.reduce((groups, task) => {
      const projectId = task.projectId;
      if (!groups[projectId]) {
        groups[projectId] = [];
      }
      groups[projectId].push(task);
      return groups;
    }, {});
  }

  public getRouter(): Router {
    return this.router;
  }
}
```

## Mobile-Optimized BFF

```typescript
// src/gateway/bff/MobileBFF.ts
export class MobileBFF extends BFFGateway {
  private offlineQueue: OfflineOperationQueue;
  private pushNotificationService: PushNotificationService;

  constructor(config: BFFConfig) {
    super({ ...config, client: 'mobile' });
    this.offlineQueue = new OfflineOperationQueue();
    this.pushNotificationService = new PushNotificationService();
    this.setupMobileSpecificRoutes();
  }

  private setupMobileSpecificRoutes(): void {
    // Lightweight profile endpoint
    this.router.get('/profile/light', async (req: Request, res: Response) => {
      try {
        const profile = await this.config.services.get('user')!
          .getLightProfile(req.user!.id);
        
        // Minimize payload for mobile
        const lightProfile = {
          id: profile.id,
          name: profile.name,
          avatar: this.getOptimizedImageUrl(profile.avatar, 'mobile'),
          status: profile.status,
          badges: profile.badges.slice(0, 3) // Only top 3 badges
        };
        
        res.json(lightProfile);
      } catch (error) {
        console.error('Light profile error:', error);
        res.status(500).json({ error: 'Failed to load profile' });
      }
    });

    // Incremental sync for large datasets
    this.router.get('/contacts/sync', async (req: Request, res: Response) => {
      const { lastSync, limit = 50 } = req.query;
      
      try {
        const contacts = await this.config.services.get('contact')!
          .getContactsSince(
            req.user!.id,
            lastSync as string,
            parseInt(limit as string)
          );
        
        res.json({
          contacts: contacts.map(this.optimizeContactForMobile),
          hasMore: contacts.length === parseInt(limit as string),
          syncTimestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Contact sync error:', error);
        res.status(500).json({ error: 'Sync failed' });
      }
    });

    // Offline queue endpoint
    this.router.post('/offline/queue', async (req: Request, res: Response) => {
      try {
        const operations = req.body.operations;
        await this.offlineQueue.addOperations(req.user!.id, operations);
        res.json({ queued: operations.length });
      } catch (error) {
        console.error('Offline queue error:', error);
        res.status(500).json({ error: 'Queue operation failed' });
      }
    });

    // Push notification registration
    this.router.post('/notifications/register', async (req: Request, res: Response) => {
      try {
        const { deviceToken, platform } = req.body;
        await this.pushNotificationService.registerDevice(
          req.user!.id,
          deviceToken,
          platform
        );
        res.json({ success: true });
      } catch (error) {
        console.error('Push registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
      }
    });

    // Bandwidth-aware image endpoint
    this.router.get('/images/:id', async (req: Request, res: Response) => {
      const { quality = 'medium', format = 'webp' } = req.query;
      const networkType = req.headers['network-type'] || 'unknown';
      
      try {
        const imageUrl = this.getAdaptiveImageUrl(
          req.params.id,
          quality as string,
          format as string,
          networkType as string
        );
        
        res.redirect(imageUrl);
      } catch (error) {
        console.error('Image optimization error:', error);
        res.status(500).json({ error: 'Image optimization failed' });
      }
    });
  }

  private optimizeContactForMobile(contact: any): any {
    return {
      id: contact.id,
      name: contact.name,
      avatar: this.getOptimizedImageUrl(contact.avatar, 'mobile'),
      lastSeen: contact.lastSeen,
      status: contact.status
      // Omit heavy fields like full address, detailed info
    };
  }

  private getAdaptiveImageUrl(
    imageId: string,
    quality: string,
    format: string,
    networkType: string
  ): string {
    // Adjust quality based on network conditions
    let adjustedQuality = quality;
    if (networkType === '2g' || networkType === '3g') {
      adjustedQuality = 'low';
    } else if (networkType === '4g') {
      adjustedQuality = 'medium';
    }

    const params = new URLSearchParams({
      q: this.getQualityValue(adjustedQuality),
      f: format,
      w: '400' // Mobile width
    });

    return `${process.env.CDN_URL}/images/${imageId}?${params.toString()}`;
  }

  private getQualityValue(quality: string): string {
    const qualityMap = {
      low: '40',
      medium: '70',
      high: '85'
    };
    return qualityMap[quality as keyof typeof qualityMap] || '70';
  }
}
```

## Desktop-Optimized BFF

```typescript
// src/gateway/bff/DesktopBFF.ts
export class DesktopBFF extends BFFGateway {
  private realTimeConnections: Map<string, WebSocket> = new Map();
  private dataSubscriptions: Map<string, string[]> = new Map();

  constructor(config: BFFConfig) {
    super({ ...config, client: 'desktop' });
    this.setupDesktopSpecificRoutes();
    this.setupWebSocketHandlers();
  }

  private setupDesktopSpecificRoutes(): void {
    // Rich analytics dashboard
    this.router.get('/analytics/dashboard', async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const timeRange = req.query.range || '7d';
        
        const [
          userMetrics,
          teamMetrics,
          projectMetrics,
          performanceData,
          trendsData
        ] = await Promise.all([
          this.config.services.get('analytics')!.getUserMetrics(userId, timeRange),
          this.config.services.get('analytics')!.getTeamMetrics(userId, timeRange),
          this.config.services.get('analytics')!.getProjectMetrics(userId, timeRange),
          this.config.services.get('analytics')!.getPerformanceData(userId, timeRange),
          this.config.services.get('analytics')!.getTrends(userId, timeRange)
        ]);

        res.json({
          user: userMetrics,
          team: teamMetrics,
          projects: projectMetrics,
          performance: performanceData,
          trends: trendsData,
          charts: this.generateChartConfigs(userMetrics, teamMetrics, projectMetrics)
        });
      } catch (error) {
        console.error('Analytics dashboard error:', error);
        res.status(500).json({ error: 'Failed to load analytics' });
      }
    });

    // Bulk operations endpoint
    this.router.post('/bulk/operations', async (req: Request, res: Response) => {
      try {
        const operations = req.body.operations;
        const results = await this.processBulkOperations(operations);
        res.json({ results });
      } catch (error) {
        console.error('Bulk operations error:', error);
        res.status(500).json({ error: 'Bulk operations failed' });
      }
    });

    // Advanced search endpoint
    this.router.post('/search/advanced', async (req: Request, res: Response) => {
      try {
        const query = req.body;
        const results = await this.performAdvancedSearch(query);
        res.json(results);
      } catch (error) {
        console.error('Advanced search error:', error);
        res.status(500).json({ error: 'Search failed' });
      }
    });

    // Export data endpoint
    this.router.post('/export/:type', async (req: Request, res: Response) => {
      try {
        const exportType = req.params.type;
        const options = req.body;
        const exportJob = await this.startExportJob(exportType, options, req.user!.id);
        res.json({ jobId: exportJob.id, status: 'started' });
      } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Export failed' });
      }
    });

    // File management endpoints
    this.router.get('/files/recent', async (req: Request, res: Response) => {
      try {
        const files = await this.config.services.get('file')!
          .getRecentFiles(req.user!.id, 100);
        
        res.json({
          files: files.map(this.enrichFileMetadata),
          totalSize: files.reduce((sum, f) => sum + f.size, 0)
        });
      } catch (error) {
        console.error('Recent files error:', error);
        res.status(500).json({ error: 'Failed to load files' });
      }
    });
  }

  private setupWebSocketHandlers(): void {
    // Real-time updates for desktop app
    this.router.ws('/realtime', (ws: WebSocket, req: Request) => {
      const userId = req.user!.id;
      this.realTimeConnections.set(userId, ws);

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(userId, data);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        this.realTimeConnections.delete(userId);
        this.dataSubscriptions.delete(userId);
      });

      // Send initial data
      this.sendInitialRealtimeData(userId, ws);
    });
  }

  private async handleWebSocketMessage(userId: string, data: any): Promise<void> {
    switch (data.type) {
      case 'subscribe':
        this.handleSubscription(userId, data.channels);
        break;
      case 'unsubscribe':
        this.handleUnsubscription(userId, data.channels);
        break;
      case 'heartbeat':
        this.sendToUser(userId, { type: 'heartbeat', timestamp: Date.now() });
        break;
    }
  }

  private handleSubscription(userId: string, channels: string[]): void {
    const existing = this.dataSubscriptions.get(userId) || [];
    const updated = [...new Set([...existing, ...channels])];
    this.dataSubscriptions.set(userId, updated);
  }

  private handleUnsubscription(userId: string, channels: string[]): void {
    const existing = this.dataSubscriptions.get(userId) || [];
    const updated = existing.filter(ch => !channels.includes(ch));
    this.dataSubscriptions.set(userId, updated);
  }

  private sendToUser(userId: string, data: any): void {
    const ws = this.realTimeConnections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  private async sendInitialRealtimeData(userId: string, ws: WebSocket): Promise<void> {
    try {
      const [notifications, activities, updates] = await Promise.all([
        this.config.services.get('notification')!.getUnread(userId),
        this.config.services.get('activity')!.getRecent(userId, 5),
        this.config.services.get('update')!.getRecentUpdates(userId)
      ]);

      ws.send(JSON.stringify({
        type: 'initial',
        data: {
          notifications: notifications.items,
          activities,
          updates
        }
      }));
    } catch (error) {
      console.error('Initial realtime data error:', error);
    }
  }

  private async processBulkOperations(operations: any[]): Promise<any[]> {
    const results = [];
    
    // Process operations in batches for better performance
    const batchSize = 10;
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(op => this.executeBulkOperation(op))
      );
      
      results.push(...batchResults.map((result, index) => ({
        operationId: batch[index].id,
        success: result.status === 'fulfilled',
        result: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason.message : null
      })));
    }
    
    return results;
  }

  private async executeBulkOperation(operation: any): Promise<any> {
    const service = this.config.services.get(operation.service);
    if (!service) {
      throw new Error(`Unknown service: ${operation.service}`);
    }
    
    return await service[operation.method](...operation.args);
  }

  private async performAdvancedSearch(query: any): Promise<any> {
    // Federated search across multiple services
    const searchPromises = [];
    
    if (query.includeProjects) {
      searchPromises.push(
        this.config.services.get('project')!.search(query.text, query.filters)
      );
    }
    
    if (query.includeDocuments) {
      searchPromises.push(
        this.config.services.get('document')!.search(query.text, query.filters)
      );
    }
    
    if (query.includeUsers) {
      searchPromises.push(
        this.config.services.get('user')!.search(query.text, query.filters)
      );
    }
    
    const results = await Promise.all(searchPromises);
    
    return {
      projects: results[0] || [],
      documents: results[1] || [],
      users: results[2] || [],
      totalCount: results.reduce((sum, r) => sum + (r?.length || 0), 0)
    };
  }

  private async startExportJob(
    exportType: string,
    options: any,
    userId: string
  ): Promise<any> {
    // Start background export job
    const jobId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Queue the export job
    await this.config.services.get('export')!.startExport({
      id: jobId,
      type: exportType,
      userId,
      options,
      status: 'queued'
    });
    
    return { id: jobId };
  }

  private enrichFileMetadata(file: any): any {
    return {
      ...file,
      preview: this.generateFilePreview(file),
      permissions: this.getFilePermissions(file),
      versions: file.versions?.length || 0,
      lastModifiedBy: file.lastModifiedBy,
      tags: file.tags || []
    };
  }

  private generateFilePreview(file: any): any {
    const isImage = /\.(jpg|jpeg|png|gif|bmp|svg)$/i.test(file.name);
    const isDocument = /\.(pdf|doc|docx|txt|md)$/i.test(file.name);
    
    return {
      available: isImage || isDocument,
      thumbnail: isImage ? `${process.env.CDN_URL}/thumbnails/${file.id}` : null,
      type: isImage ? 'image' : isDocument ? 'document' : 'other'
    };
  }

  private getFilePermissions(file: any): any {
    return {
      canRead: true,
      canWrite: file.permissions?.write || false,
      canDelete: file.permissions?.delete || false,
      canShare: file.permissions?.share || false
    };
  }

  private generateChartConfigs(
    userMetrics: any,
    teamMetrics: any,
    projectMetrics: any
  ): any {
    return {
      productivity: {
        type: 'line',
        data: userMetrics.productivity.timeline,
        options: { responsive: true, animation: false }
      },
      teamPerformance: {
        type: 'bar',
        data: teamMetrics.performance,
        options: { responsive: true }
      },
      projectProgress: {
        type: 'doughnut',
        data: projectMetrics.progress,
        options: { responsive: true }
      }
    };
  }
}
```

## Configuration Examples

```yaml
# BFF configuration
bff_configs:
  web:
    client: web
    features:
      - dashboard_aggregation
      - graphql_endpoint
      - real_time_updates
      - advanced_search
    
    caching:
      dashboard: 300  # 5 minutes
      user_profile: 600  # 10 minutes
      notifications: 60  # 1 minute
    
    batch_loading: true
    max_concurrent_requests: 10

  mobile:
    client: mobile
    features:
      - lightweight_endpoints
      - offline_sync
      - push_notifications
      - image_optimization
    
    payload_optimization:
      max_items_per_page: 20
      image_quality: medium
      compress_responses: true
    
    offline:
      queue_size: 1000
      sync_interval: 300  # 5 minutes
      conflict_resolution: client_wins

  desktop:
    client: desktop
    features:
      - rich_analytics
      - bulk_operations
      - file_management
      - real_time_collaboration
    
    websocket:
      heartbeat_interval: 30000
      max_subscriptions: 50
      buffer_size: 1000
    
    export:
      formats: [json, csv, xlsx, pdf]
      max_file_size: 100MB
      queue_timeout: 3600  # 1 hour
```

## Usage Examples

```typescript
// Multi-client BFF setup
const webBFF = new BFFGateway({
  client: 'web',
  services: serviceMap,
  caching: { enabled: true, ttl: 300 },
  batching: true
});

const mobileBFF = new MobileBFF({
  client: 'mobile',
  services: serviceMap,
  caching: { enabled: true, ttl: 600 }
});

const desktopBFF = new DesktopBFF({
  client: 'desktop',
  services: serviceMap,
  caching: { enabled: true, ttl: 180 }
});

// Route setup
app.use('/api/web', webBFF.getRouter());
app.use('/api/mobile', mobileBFF.getRouter());
app.use('/api/desktop', desktopBFF.getRouter());

// Client detection middleware
app.use('/api', (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const clientType = req.headers['x-client-type'];
  
  if (clientType) {
    req.clientType = clientType;
  } else if (userAgent.includes('Mobile')) {
    req.clientType = 'mobile';
  } else if (userAgent.includes('Desktop')) {
    req.clientType = 'desktop';
  } else {
    req.clientType = 'web';
  }
  
  next();
});

// Dynamic routing based on client
app.use('/api/data', (req, res, next) => {
  const clientType = req.clientType;
  const router = {
    web: webBFF.getRouter(),
    mobile: mobileBFF.getRouter(),
    desktop: desktopBFF.getRouter()
  }[clientType] || webBFF.getRouter();
  
  router(req, res, next);
});
```