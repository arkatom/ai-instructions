# Security

## Secrets Management

```yaml
# .github/workflows/secure-deployment.yml
name: Secure Deployment Pipeline

on: [push, pull_request]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Scan for secrets
        uses: trufflesecurity/trufflehog@v3.54.0
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --debug --only-verified
      
      - name: Setup external secrets
        uses: external-secrets/external-secrets-action@v1
        with:
          secretstore-name: aws-secretsmanager
          secretstore-kind: SecretStore
          target-secret: app-secrets
          
      - name: Vault integration
        run: |
          export VAULT_ADDR="https://vault.company.com"
          vault auth -method=github token="${{ secrets.VAULT_TOKEN }}"
          
          # Retrieve secrets dynamically
          DB_PASSWORD=$(vault kv get -field=password secret/prod/database)
          API_KEY=$(vault kv get -field=key secret/prod/api)
          
          # Use secrets in deployment
          echo "::add-mask::$DB_PASSWORD"
          echo "::add-mask::$API_KEY"
```

## Supply Chain Security

```dockerfile
# Multi-stage secure Dockerfile
FROM node:20-alpine@sha256:c0669ef34cdc14332c0f1ab0c2c01acb91d96014b172f1a76c46b5e0e1b3f4d1 AS base

# Security hardening
RUN apk add --no-cache dumb-init && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Dependency verification
FROM base AS deps
WORKDIR /app
COPY package*.json ./

# Verify package integrity
RUN npm ci --only=production --audit --audit-level moderate && \
    npm audit fix && \
    npm cache clean --force

FROM base AS builder
WORKDIR /app
COPY . .
RUN npm run build

# Minimal runtime image
FROM gcr.io/distroless/nodejs20-debian11:nonroot AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

USER 65534
EXPOSE 3000
CMD ["server.js"]
```

## Vulnerability Scanning Integration

```typescript
class SecurityScanner {
  async runSecuritySuite(): Promise<SecurityReport> {
    const results = await Promise.all([
      this.runSAST(),          // Static Application Security Testing
      this.runDAST(),          // Dynamic Application Security Testing
      this.scanDependencies(), // Dependency vulnerability scan
      this.scanContainers(),   // Container image scan
      this.checkCompliance()   // Compliance checks
    ]);

    return this.aggregateResults(results);
  }

  private async runSAST(): Promise<ScanResult> {
    // CodeQL, SonarQube, or Semgrep integration
    const command = `codeql database analyze ./codeql-db --format=json --output=sast-results.json`;
    const result = await exec(command);
    
    return {
      type: 'SAST',
      vulnerabilities: this.parseSASTResults(result.stdout),
      severity: this.calculateSeverity(result.stdout)
    };
  }

  private async scanContainers(): Promise<ScanResult> {
    // Trivy, Snyk, or Anchore integration
    const images = await this.getBuiltImages();
    const results = [];
    
    for (const image of images) {
      const command = `trivy image --format json ${image}`;
      const result = await exec(command);
      results.push(this.parseTrivyResults(result.stdout));
    }
    
    return {
      type: 'Container',
      vulnerabilities: results.flat(),
      severity: this.calculateOverallSeverity(results)
    };
  }

  private async checkCompliance(): Promise<ComplianceResult> {
    return {
      soc2: await this.checkSOC2Compliance(),
      pci: await this.checkPCICompliance(),
      gdpr: await this.checkGDPRCompliance(),
      iso27001: await this.checkISO27001Compliance()
    };
  }
}
```

## Access Control and RBAC

```yaml
# Kubernetes RBAC for CI/CD
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: cicd-deployer
rules:
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
- apiGroups: [""]
  resources: ["services", "configmaps"]
  verbs: ["get", "list", "create", "update"]
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list"]  # Read-only access to secrets

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: cicd-deployer-binding
  namespace: production
subjects:
- kind: ServiceAccount
  name: cicd-sa
  namespace: production
roleRef:
  kind: Role
  name: cicd-deployer
  apiGroup: rbac.authorization.k8s.io

---
# Service Account with limited permissions
apiVersion: v1
kind: ServiceAccount
metadata:
  name: cicd-sa
  namespace: production
automountServiceAccountToken: false  # Explicit token mounting
```

## Network Security

```bash
#!/bin/bash
# network-security-setup.sh

setup_network_isolation() {
    # Create dedicated VPC for CI/CD
    aws ec2 create-vpc --cidr-block 10.1.0.0/16 --tag-specifications \
        'ResourceType=vpc,Tags=[{Key=Name,Value=cicd-vpc},{Key=Environment,Value=production}]'
    
    # Private subnets for CI/CD resources
    aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.1.1.0/24 \
        --availability-zone us-west-2a --tag-specifications \
        'ResourceType=subnet,Tags=[{Key=Name,Value=cicd-private-2a}]'
    
    # Security groups with minimal access
    aws ec2 create-security-group --group-name cicd-runners \
        --description "Security group for CI/CD runners" --vpc-id $VPC_ID
    
    # Allow only necessary outbound traffic
    aws ec2 authorize-security-group-egress --group-id $SG_ID \
        --protocol tcp --port 443 --cidr 0.0.0.0/0  # HTTPS only
    
    # Block all inbound traffic
    aws ec2 revoke-security-group-ingress --group-id $SG_ID \
        --protocol -1 --cidr 0.0.0.0/0
}

configure_network_policies() {
    # Kubernetes Network Policies
    kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: cicd-isolation
  namespace: cicd
spec:
  podSelector:
    matchLabels:
      app: cicd-runner
  policyTypes:
  - Ingress
  - Egress
  ingress: []  # No inbound traffic allowed
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: production
    ports:
    - protocol: TCP
      port: 443
  - to: []  # Allow DNS
    ports:
    - protocol: UDP
      port: 53
EOF
}
```

## Compliance and Audit Logging

```typescript
interface AuditEvent {
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  result: 'success' | 'failure';
  metadata: Record<string, any>;
}

class ComplianceLogger {
  constructor(private logShipper: LogShipper) {}

  async logDeployment(deployment: DeploymentEvent): Promise<void> {
    const auditEvent: AuditEvent = {
      timestamp: new Date().toISOString(),
      user: deployment.triggeredBy,
      action: 'deploy',
      resource: `${deployment.application}:${deployment.version}`,
      result: deployment.status,
      metadata: {
        environment: deployment.environment,
        approvers: deployment.approvers,
        changeTicket: deployment.changeTicket,
        deploymentDuration: deployment.duration,
        affectedServices: deployment.affectedServices
      }
    };

    // Ship to multiple compliance systems
    await Promise.all([
      this.logShipper.sendToSplunk(auditEvent),
      this.logShipper.sendToCloudTrail(auditEvent),
      this.logShipper.sendToSIEM(auditEvent)
    ]);
  }

  async generateComplianceReport(period: string): Promise<ComplianceReport> {
    const events = await this.getAuditEvents(period);
    
    return {
      period,
      totalDeployments: events.length,
      failedDeployments: events.filter(e => e.result === 'failure').length,
      unauthorizedAccess: await this.detectUnauthorizedAccess(events),
      complianceScore: await this.calculateComplianceScore(events),
      recommendations: await this.generateRecommendations(events)
    };
  }
}
```

## Security Testing Integration

```yaml
# Security testing in CI pipeline
security_tests:
  dependency_check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run dependency check
        run: |
          npm install -g @cyclonedx/cyclonedx-npm
          cyclonedx-npm --output-file bom.json
          
          # Submit to dependency track
          curl -X POST "https://dtrack.company.com/api/v1/bom" \
            -H "X-API-Key: ${{ secrets.DEPENDENCY_TRACK_KEY }}" \
            -H "Content-Type: application/json" \
            -d @bom.json

  penetration_testing:
    runs-on: ubuntu-latest
    steps:
      - name: OWASP ZAP scan
        run: |
          docker run -v $(pwd):/zap/wrk/:rw \
            -t owasp/zap2docker-stable zap-full-scan.py \
            -t https://staging.myapp.com \
            -J zap-report.json \
            -z "-addonupdate; -addoninstall ascanrulesAlpha,ascanrulesBeta"
      
      - name: Upload security report
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: zap-report.json

  compliance_check:
    runs-on: ubuntu-latest
    steps:
      - name: CIS benchmark check
        run: |
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
            aquasec/docker-bench-security
      
      - name: Cloud security posture
        run: |
          # AWS Config rules
          aws configservice put-evaluations \
            --evaluations file://compliance-results.json \
            --result-token ${{ secrets.CONFIG_RESULT_TOKEN }}
```

## Best Practices

1. **Zero Trust**: Never trust, always verify - authenticate and authorize every request
2. **Principle of Least Privilege**: Grant minimal required permissions
3. **Secrets Rotation**: Regularly rotate secrets and API keys
4. **Multi-layered Security**: Implement defense in depth with multiple security controls
5. **Compliance as Code**: Automate compliance checks and reporting
6. **Continuous Monitoring**: Monitor for security threats and vulnerabilities continuously
7. **Incident Response**: Have clear security incident response procedures