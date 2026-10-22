# Harnis Agent Harness - Phase 0

## Overview
The Harnis agent harness provides agent lifecycle management with:
- Postgres Row Level Security (RLS) for tenant isolation
- Human-in-the-loop approval console for high-risk side effects
- Sandboxed code execution environment
- Append-only audit trail with OpenTelemetry exporter

## Directory Structure
```
packages/agents/harness/
├── README.md
├── approval-console.ts      # Human approval UI console
├── sandbox.ts               # Sandboxed code execution
├── rls-policy.ts           # Postgres RLS policies
├── audit-pipeline.ts        # Append-only audit trail
└── index.ts                 # Harness entry point
```

## Key Components

### 1. Tenant Isolation (Postgres RLS)
- Policies enforce data isolation per tenant/org
- Automatic policy application on entity operations
- Violation detection and logging

### 2. Approval Console
- High-risk side effect gates
- Human approval workflow
- Escalation matrix
- Approval history tracking

### 3. Sandboxed Execution
- Node.js script sandbox
- Resource limits (memory, CPU time)
- Safe API boundaries
- Automatic timeout and cleanup

### 4. Audit Trail
- Append-only database table
- OpenTelemetry integration
- Immutable event sourcing
- Queryable audit history
