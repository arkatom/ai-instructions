# Request & Response Transformation

> 🎯 **目的**: API Gatewayでのリクエスト・レスポンス変換パターンの実装
> 
> 📊 **対象**: データ変換、プロトコル変換、フォーマット変換、データ集約
> 
> ⚡ **特徴**: JSON/XML/Form変換、ヘッダー操作、パイプライン処理

## Core Transformation Middleware

```typescript
// src/gateway/middleware/RequestTransformer.ts
import { Request, Response, NextFunction } from 'express';
import { JSONPath } from 'jsonpath-plus';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';

export interface TransformConfig {
  request?: TransformRules;
  response?: TransformRules;
}

export interface TransformRules {
  headers?: Record<string, string | ((req: Request) => string)>;
  body?: {
    add?: Record<string, any>;
    remove?: string[];
    rename?: Record<string, string>;
    transform?: Array<{
      path: string;
      transformer: (value: any) => any;
    }>;
  };
  format?: {
    from?: 'json' | 'xml' | 'form';
    to?: 'json' | 'xml' | 'form';
  };
}

export class RequestTransformer {
  private xmlParser: XMLParser;
  private xmlBuilder: XMLBuilder;

  constructor(private config: TransformConfig) {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    
    this.xmlBuilder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
  }

  transform() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Transform request
        if (this.config.request) {
          await this.transformRequest(req);
        }

        // Transform response
        if (this.config.response) {
          this.interceptResponse(res);
        }

        next();
      } catch (error) {
        console.error('Transformation error:', error);
        res.status(400).json({
          error: 'Bad Request',
          message: 'Request transformation failed'
        });
      }
    };
  }

  private async transformRequest(req: Request): Promise<void> {
    const rules = this.config.request!;

    // Transform headers
    if (rules.headers) {
      for (const [key, value] of Object.entries(rules.headers)) {
        if (typeof value === 'function') {
          req.headers[key.toLowerCase()] = value(req);
        } else {
          req.headers[key.toLowerCase()] = value;
        }
      }
    }

    // Transform body format
    if (rules.format && req.body) {
      req.body = await this.convertFormat(
        req.body,
        rules.format.from!,
        rules.format.to!
      );
    }

    // Transform body content
    if (rules.body && req.body) {
      req.body = this.transformBody(req.body, rules.body);
    }
  }

  private transformBody(body: any, rules: any): any {
    let transformed = { ...body };

    // Add fields
    if (rules.add) {
      transformed = { ...transformed, ...rules.add };
    }

    // Remove fields
    if (rules.remove) {
      for (const path of rules.remove) {
        JSONPath({ path, json: transformed, callback: (value, type, payload) => {
          delete payload.parent[payload.parentProperty];
        }});
      }
    }

    // Rename fields
    if (rules.rename) {
      for (const [oldName, newName] of Object.entries(rules.rename)) {
        if (oldName in transformed) {
          transformed[newName as string] = transformed[oldName];
          delete transformed[oldName];
        }
      }
    }

    // Apply custom transformers
    if (rules.transform) {
      for (const { path, transformer } of rules.transform) {
        JSONPath({
          path,
          json: transformed,
          callback: (value, type, payload) => {
            payload.parent[payload.parentProperty] = transformer(value);
          }
        });
      }
    }

    return transformed;
  }

  private async convertFormat(
    data: any,
    from: string,
    to: string
  ): Promise<any> {
    if (from === to) return data;

    // Convert to intermediate JSON format
    let jsonData = data;
    
    if (from === 'xml') {
      jsonData = this.xmlParser.parse(data);
    } else if (from === 'form') {
      jsonData = this.parseFormData(data);
    }

    // Convert from JSON to target format
    if (to === 'xml') {
      return this.xmlBuilder.build(jsonData);
    } else if (to === 'form') {
      return this.buildFormData(jsonData);
    }

    return jsonData;
  }

  private parseFormData(data: string): any {
    const params = new URLSearchParams(data);
    const result: any = {};
    
    for (const [key, value] of params) {
      result[key] = value;
    }
    
    return result;
  }

  private buildFormData(data: any): string {
    const params = new URLSearchParams();
    
    for (const [key, value] of Object.entries(data)) {
      params.append(key, String(value));
    }
    
    return params.toString();
  }

  private interceptResponse(res: Response): void {
    const originalSend = res.send;
    const originalJson = res.json;
    const transformer = this;

    res.send = function(body: any) {
      if (transformer.config.response) {
        body = transformer.transformResponseBody(body);
      }
      return originalSend.call(this, body);
    };

    res.json = function(body: any) {
      if (transformer.config.response?.body) {
        body = transformer.transformBody(body, transformer.config.response.body);
      }
      return originalJson.call(this, body);
    };
  }

  private transformResponseBody(body: any): any {
    if (!this.config.response?.body) return body;

    try {
      const parsed = JSON.parse(body);
      const transformed = this.transformBody(parsed, this.config.response.body);
      return JSON.stringify(transformed);
    } catch {
      // If not JSON, return as-is
      return body;
    }
  }
}
```

## Advanced Data Transformation Patterns

### Schema-Based Transformation

```typescript
// src/gateway/transformation/SchemaTransformer.ts
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export interface SchemaTransformConfig {
  inputSchema?: any;
  outputSchema?: any;
  transformations: TransformRule[];
}

export interface TransformRule {
  source: string;
  target: string;
  type: 'copy' | 'transform' | 'aggregate' | 'compute';
  transformer?: (value: any, context: any) => any;
  defaultValue?: any;
  required?: boolean;
}

export class SchemaTransformer {
  private ajv: Ajv;

  constructor(private config: SchemaTransformConfig) {
    this.ajv = new Ajv();
    addFormats(this.ajv);
  }

  async transform(input: any, context?: any): Promise<any> {
    // Validate input if schema provided
    if (this.config.inputSchema) {
      const valid = this.ajv.validate(this.config.inputSchema, input);
      if (!valid) {
        throw new Error(`Input validation failed: ${this.ajv.errorsText()}`);
      }
    }

    // Apply transformations
    const output: any = {};
    
    for (const rule of this.config.transformations) {
      const value = this.extractValue(input, rule.source);
      
      if (value === undefined && rule.required) {
        throw new Error(`Required field missing: ${rule.source}`);
      }
      
      if (value === undefined && rule.defaultValue !== undefined) {
        this.setValue(output, rule.target, rule.defaultValue);
        continue;
      }
      
      if (value === undefined) {
        continue;
      }

      let transformedValue = value;
      
      switch (rule.type) {
        case 'copy':
          transformedValue = value;
          break;
          
        case 'transform':
          if (rule.transformer) {
            transformedValue = rule.transformer(value, context);
          }
          break;
          
        case 'aggregate':
          transformedValue = this.aggregateValues(input, rule.source);
          break;
          
        case 'compute':
          if (rule.transformer) {
            transformedValue = rule.transformer(input, context);
          }
          break;
      }
      
      this.setValue(output, rule.target, transformedValue);
    }

    // Validate output if schema provided
    if (this.config.outputSchema) {
      const valid = this.ajv.validate(this.config.outputSchema, output);
      if (!valid) {
        throw new Error(`Output validation failed: ${this.ajv.errorsText()}`);
      }
    }

    return output;
  }

  private extractValue(obj: any, path: string): any {
    const results = JSONPath({ path, json: obj });
    return results.length > 0 ? results[0] : undefined;
  }

  private setValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
  }

  private aggregateValues(obj: any, path: string): any {
    const results = JSONPath({ path, json: obj });
    return results;
  }
}
```

### Protocol Translation

```typescript
// src/gateway/transformation/ProtocolTranslator.ts
export interface ProtocolConfig {
  from: 'rest' | 'graphql' | 'grpc' | 'soap';
  to: 'rest' | 'graphql' | 'grpc' | 'soap';
  mappings: ProtocolMapping[];
}

export interface ProtocolMapping {
  sourceOperation: string;
  targetOperation: string;
  parameterMapping?: Record<string, string>;
  responseMapping?: Record<string, string>;
}

export class ProtocolTranslator {
  constructor(private config: ProtocolConfig) {}

  async translate(
    operation: string,
    parameters: any,
    context?: any
  ): Promise<{ operation: string; parameters: any }> {
    const mapping = this.config.mappings.find(
      m => m.sourceOperation === operation
    );
    
    if (!mapping) {
      throw new Error(`No mapping found for operation: ${operation}`);
    }

    let translatedParams = parameters;
    
    // Apply parameter mappings
    if (mapping.parameterMapping) {
      translatedParams = this.mapParameters(
        parameters,
        mapping.parameterMapping
      );
    }

    // Protocol-specific transformations
    switch (`${this.config.from}->${this.config.to}`) {
      case 'rest->graphql':
        return this.restToGraphQL(mapping, translatedParams);
        
      case 'graphql->rest':
        return this.graphQLToRest(mapping, translatedParams);
        
      case 'rest->grpc':
        return this.restToGRPC(mapping, translatedParams);
        
      case 'grpc->rest':
        return this.grpcToRest(mapping, translatedParams);
        
      default:
        return {
          operation: mapping.targetOperation,
          parameters: translatedParams
        };
    }
  }

  private mapParameters(
    params: any,
    mapping: Record<string, string>
  ): any {
    const mapped: any = {};
    
    for (const [sourceKey, targetKey] of Object.entries(mapping)) {
      const value = this.extractValue(params, sourceKey);
      if (value !== undefined) {
        this.setValue(mapped, targetKey, value);
      }
    }
    
    return mapped;
  }

  private restToGraphQL(
    mapping: ProtocolMapping,
    params: any
  ): { operation: string; parameters: any } {
    // Convert REST parameters to GraphQL variables
    return {
      operation: `query ${mapping.targetOperation}($input: ${mapping.targetOperation}Input!) {
        ${mapping.targetOperation}(input: $input) {
          id
          ...DefaultFields
        }
      }`,
      parameters: { input: params }
    };
  }

  private graphQLToRest(
    mapping: ProtocolMapping,
    params: any
  ): { operation: string; parameters: any } {
    // Extract variables from GraphQL query
    const variables = params.variables || {};
    return {
      operation: mapping.targetOperation,
      parameters: variables.input || variables
    };
  }

  private restToGRPC(
    mapping: ProtocolMapping,
    params: any
  ): { operation: string; parameters: any } {
    // Convert REST JSON to Protocol Buffer format
    return {
      operation: mapping.targetOperation,
      parameters: this.convertToProtobuf(params)
    };
  }

  private grpcToRest(
    mapping: ProtocolMapping,
    params: any
  ): { operation: string; parameters: any } {
    // Convert Protocol Buffer to REST JSON
    return {
      operation: mapping.targetOperation,
      parameters: this.convertFromProtobuf(params)
    };
  }

  private convertToProtobuf(data: any): any {
    // Convert JSON to Protocol Buffer compatible format
    return data; // Simplified for example
  }

  private convertFromProtobuf(data: any): any {
    // Convert Protocol Buffer to JSON
    return data; // Simplified for example
  }

  private extractValue(obj: any, path: string): any {
    return JSONPath({ path, json: obj })[0];
  }

  private setValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
  }
}
```

### Data Aggregation Engine

```typescript
// src/gateway/transformation/DataAggregator.ts
export interface AggregationConfig {
  sources: DataSource[];
  rules: AggregationRule[];
  timeout?: number;
  errorHandling?: 'fail-fast' | 'best-effort' | 'ignore';
}

export interface DataSource {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  transformation?: TransformRule[];
}

export interface AggregationRule {
  target: string;
  sources: string[];
  operation: 'merge' | 'join' | 'concatenate' | 'custom';
  joinKey?: string;
  customAggregator?: (sources: any[]) => any;
}

export class DataAggregator {
  constructor(private config: AggregationConfig) {}

  async aggregate(context: any): Promise<any> {
    const timeout = this.config.timeout || 10000;
    
    try {
      // Fetch data from all sources
      const sourceData = await Promise.all(
        this.config.sources.map(source => 
          this.fetchFromSource(source, context, timeout)
        )
      );

      // Apply aggregation rules
      let result: any = {};
      
      for (const rule of this.config.rules) {
        const sourceValues = rule.sources.map(sourceName => {
          const sourceIndex = this.config.sources.findIndex(
            s => s.name === sourceName
          );
          return sourceData[sourceIndex];
        });

        const aggregated = this.applyAggregation(rule, sourceValues);
        this.setValue(result, rule.target, aggregated);
      }

      return result;
    } catch (error) {
      if (this.config.errorHandling === 'fail-fast') {
        throw error;
      }
      
      console.error('Aggregation error:', error);
      return this.createErrorResponse(error);
    }
  }

  private async fetchFromSource(
    source: DataSource,
    context: any,
    timeout: number
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const url = this.interpolateUrl(source.url, context);
      const response = await fetch(url, {
        method: source.method,
        headers: {
          'Content-Type': 'application/json',
          ...source.headers
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let data = await response.json();

      // Apply source-specific transformations
      if (source.transformation) {
        const transformer = new SchemaTransformer({
          transformations: source.transformation
        });
        data = await transformer.transform(data, context);
      }

      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private applyAggregation(rule: AggregationRule, sources: any[]): any {
    switch (rule.operation) {
      case 'merge':
        return this.mergeObjects(sources);
        
      case 'join':
        if (!rule.joinKey) {
          throw new Error('Join operation requires joinKey');
        }
        return this.joinArrays(sources, rule.joinKey);
        
      case 'concatenate':
        return this.concatenateArrays(sources);
        
      case 'custom':
        if (!rule.customAggregator) {
          throw new Error('Custom operation requires customAggregator');
        }
        return rule.customAggregator(sources);
        
      default:
        throw new Error(`Unknown aggregation operation: ${rule.operation}`);
    }
  }

  private mergeObjects(sources: any[]): any {
    return sources.reduce((merged, source) => {
      if (typeof source === 'object' && source !== null) {
        return { ...merged, ...source };
      }
      return merged;
    }, {});
  }

  private joinArrays(sources: any[][], joinKey: string): any[] {
    if (sources.length < 2) {
      return sources[0] || [];
    }

    const [first, ...rest] = sources;
    let result = first;

    for (const array of rest) {
      result = result.map((item: any) => {
        const match = array.find((other: any) => 
          item[joinKey] === other[joinKey]
        );
        return match ? { ...item, ...match } : item;
      });
    }

    return result;
  }

  private concatenateArrays(sources: any[][]): any[] {
    return sources.flat();
  }

  private interpolateUrl(url: string, context: any): string {
    return url.replace(/\{(\w+)\}/g, (match, key) => {
      return context[key] || match;
    });
  }

  private setValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
  }

  private createErrorResponse(error: any): any {
    return {
      error: true,
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
}
```

## Configuration Examples

```yaml
# Transformation configuration
transformations:
  user_service:
    request:
      headers:
        X-Request-ID: "{{requestId}}"
        X-Client-Version: "1.0.0"
      body:
        rename:
          user_id: userId
          user_name: username
        add:
          timestamp: "{{now}}"
        remove:
          - "$.internal.*"
        transform:
          - path: "$.created_at"
            transformer: "date_to_iso"
    
    response:
      body:
        rename:
          id: userId
          name: displayName
        transform:
          - path: "$.profile.avatar"
            transformer: "add_cdn_prefix"

  payment_service:
    request:
      format:
        from: json
        to: xml
      body:
        add:
          merchant_id: "{{config.merchant_id}}"
          
    response:
      format:
        from: xml
        to: json
      body:
        remove:
          - "$.internal_codes"

# Protocol translation
protocol_mappings:
  rest_to_graphql:
    - source_operation: "GET /users/:id"
      target_operation: "getUser"
      parameter_mapping:
        ":id": "input.id"
        
    - source_operation: "POST /users"
      target_operation: "createUser"
      parameter_mapping:
        "body": "input"

# Data aggregation
aggregation_rules:
  user_dashboard:
    sources:
      - name: user_profile
        url: "http://user-service/users/{userId}"
        method: GET
        
      - name: user_stats
        url: "http://analytics-service/stats/{userId}"
        method: GET
        
      - name: notifications
        url: "http://notification-service/users/{userId}/unread"
        method: GET
        
    rules:
      - target: "profile"
        sources: ["user_profile"]
        operation: "merge"
        
      - target: "statistics"
        sources: ["user_stats"]
        operation: "merge"
        
      - target: "alerts"
        sources: ["notifications"]
        operation: "merge"
        
      - target: "summary"
        sources: ["user_profile", "user_stats"]
        operation: "custom"
        custom_aggregator: "create_user_summary"
```

## Usage Examples

```typescript
// Basic transformation usage
const transformer = new RequestTransformer({
  request: {
    headers: {
      'X-Request-ID': (req) => req.requestId,
      'X-Source': 'api-gateway'
    },
    body: {
      add: {
        timestamp: new Date().toISOString()
      },
      rename: {
        user_id: 'userId'
      },
      remove: ['$.internal']
    }
  },
  response: {
    body: {
      transform: [{
        path: '$.data[*].avatar',
        transformer: (value) => `https://cdn.example.com${value}`
      }]
    }
  }
});

// Schema-based transformation
const schemaTransformer = new SchemaTransformer({
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' }
    },
    required: ['name']
  },
  outputSchema: {
    type: 'object',
    properties: {
      fullName: { type: 'string' },
      category: { type: 'string' }
    }
  },
  transformations: [
    {
      source: '$.name',
      target: 'fullName',
      type: 'copy'
    },
    {
      source: '$.age',
      target: 'category',
      type: 'transform',
      transformer: (age) => age >= 18 ? 'adult' : 'minor'
    }
  ]
});

// Data aggregation usage
const aggregator = new DataAggregator({
  sources: [
    {
      name: 'user',
      url: 'http://user-service/users/{id}',
      method: 'GET'
    },
    {
      name: 'orders',
      url: 'http://order-service/users/{id}/orders',
      method: 'GET'
    }
  ],
  rules: [
    {
      target: 'profile',
      sources: ['user'],
      operation: 'merge'
    },
    {
      target: 'orderHistory',
      sources: ['orders'],
      operation: 'merge'
    }
  ],
  timeout: 5000,
  errorHandling: 'best-effort'
});

// Usage in Express middleware
app.use('/api/users', transformer.transform());

app.get('/api/dashboard/:id', async (req, res) => {
  try {
    const data = await aggregator.aggregate({
      id: req.params.id
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Aggregation failed' });
  }
});
```