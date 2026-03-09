# RFC-001: Federation Protocol for Decentralized Interoperability

**Status:** Draft
**Author(s):** Platform Architecture Team
**Created:** March 7, 2026
**Last Updated:** March 7, 2026
**Reviewers:** Platform Lead, State Consortium Board, USDOT Program Office
**Target Version:** v3.0 (Phase 2 - 2027)

---

## Summary

This RFC proposes adding a **federation protocol** to enable direct state-to-state communication alongside the existing hub-and-spoke architecture. This provides long-term resilience, data sovereignty, and exit strategies while maintaining the benefits of central coordination.

**Problem:** The current hub-and-spoke architecture creates a single point of failure and requires $10M+/year perpetual central funding. States lack data sovereignty and exit options if they leave the consortium.

**Solution:** Implement NODE Federation Protocol (NFP) v1.0, enabling peer-to-peer state communication with optional central hub coordination. States can self-host, establish bilateral connections, and maintain interoperability independent of central platform.

**Impact:**
- **Resilience:** System survives central hub failure
- **Sovereignty:** States control their data and infrastructure
- **Cost:** Distributed operational model reduces central dependency
- **Exit strategy:** States can leave consortium but maintain interoperability
- **Vendor access:** Commercial vendors connect directly to states

---

## Motivation

### Why Are We Doing This?

The current specification (v2.1) describes a **hub-and-spoke** architecture where all 50 states connect to a central platform operated by the State Consortium. While this enables rapid deployment and simple integration, it creates long-term risks:

**1. Single Point of Failure**
- Despite multi-region AWS deployment, the central platform remains a bottleneck
- Consortium dissolution would break all interoperability
- Cyberattack on central hub could disable nationwide coordination

**2. Perpetual Operational Cost**
- $10M+/year central operations require stable consortium funding
- Federal grants often expire after 3-5 years
- State membership dues may become politically difficult to sustain

**3. Data Sovereignty Concerns**
- States lose control over their incident data
- Central platform decides what vendors can access
- Sensitive events (security, law enforcement) must be shared centrally

**4. No Exit Strategy**
- States leaving consortium lose all interoperability
- Cannot maintain bilateral agreements with neighbors
- Vendor lock-in to consortium platform

### Who Benefits?

**State DOTs:**
- Maintain operations if consortium funding lapses
- Direct control over data sharing policies
- Bilateral agreements with high-priority neighbors (e.g., I-80 corridor states)

**State Consortium:**
- Resilience against political/funding changes
- Reduced operational burden as states self-host
- Competitive advantage vs proprietary platforms

**Commercial Vendors:**
- Direct state integration without consortium gatekeeping
- State-level pricing instead of consortium markup
- Multiple integration points (not single point of failure)

**Federal Government:**
- Platform survives beyond initial grant funding
- States maintain interoperability independently
- Open standards enable competition

### What Happens If We Don't Do This?

**Short-term (1-3 years):**
- Hub-and-spoke works well, no immediate issues
- Platform proves value, states adopt rapidly

**Medium-term (3-7 years):**
- Central operational costs become burden
- States request data sovereignty options
- Some states hesitate to join due to vendor lock-in concerns

**Long-term (7+ years):**
- Federal grant funding expires
- Consortium struggles with $10M/year operations
- Political changes threaten membership dues
- **Risk:** Platform failure breaks nationwide interoperability

**With Federation:**
- Platform transitions from hub-and-spoke to federated model
- Central costs reduce from $10M/year to $4M/year (coordination only)
- States self-host and maintain bilateral connections
- System survives consortium dissolution or funding loss

### Timeline Pressure

**No immediate pressure** - Hub-and-spoke deployment is appropriate for Phase 1 (2025-2027). However:

- Federation protocol design should begin **now** (2026)
- Implementation in Phase 2 (2027-2028) before cost pressures emerge
- By 2030, federation becomes primary model with hub as optional coordination layer

Waiting until hub-and-spoke shows stress would require expensive retrofitting. Designing federation capabilities from the start ensures smooth transition.

---

## Proposed Solution

### Overview

Add **NODE Federation Protocol (NFP) v1.0** to enable three deployment modes:

1. **Hub-and-Spoke** (default, Phase 1): All states → Central platform
2. **Hybrid** (Phase 2): States → Central hub + Direct peer connections
3. **Federated** (Phase 3+): State-to-state mesh network, optional central coordination

States choose their deployment mode based on needs, technical capacity, and sovereignty requirements.

### Architecture Changes

#### Current Architecture (v2.1)

```
                         ┌──────────┐
                         │ Central  │
                         │   Hub    │
                         └────┬─────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
    │  Iowa   │          │Nebraska │          │Colorado │
    │   DOT   │          │   DOT   │          │   DOT   │
    └─────────┘          └─────────┘          └─────────┘
```

#### Proposed Architecture (v3.0)

```
                         ┌──────────┐
                         │ Central  │  ← Optional coordination
                         │   Hub    │
                         └────┬─────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
    │  Iowa   │◄────────►│Nebraska │◄────────►│Colorado │
    │   DOT   │ Bilateral│   DOT   │ Bilateral│   DOT   │
    └─────────┘   NFP    └─────────┘   NFP    └─────────┘
```

**Key Changes:**
- Add `.well-known/node-federation` discovery endpoint to every state instance
- Add `/federation/subscribe` and `/federation/inbox` endpoints for P2P communication
- Add signing middleware for authenticated state-to-state requests
- Add federation publisher to send events to multiple destinations
- Make central hub **optional** instead of required

### API Changes

#### New Endpoints

**Federation Discovery:**
```
GET /.well-known/node-federation

Response:
{
  "version": "1.0",
  "stateCode": "IA",
  "name": "Iowa Department of Transportation",
  "endpoints": {
    "events": "https://iowa.node-platform.gov/federation/events",
    "subscribe": "https://iowa.node-platform.gov/federation/subscribe",
    "inbox": "https://iowa.node-platform.gov/federation/inbox"
  },
  "publicKey": {
    "id": "https://iowa.node-platform.gov/keys/main-key",
    "owner": "https://iowa.node-platform.gov",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n..."
  },
  "capabilities": [
    "events.push",
    "events.query",
    "realtime.websocket",
    "wzdx.v4.2",
    "cv-tim.v1.0"
  ]
}
```

**Subscription Management:**
```
POST /federation/subscribe
Authorization: Bearer <state-jwt>
X-Federation-Signature: <signed-hash>

Request:
{
  "subscriber": "https://nebraska.node-platform.gov",
  "publicKey": "https://nebraska.node-platform.gov/keys/main-key",
  "filters": {
    "eventTypes": ["accident", "road_closure"],
    "bbox": [-96.6, 40.3, -95.3, 41.0], // Border region
    "corridors": ["I-80", "US-30"],
    "maxDistance": 50 // km
  },
  "deliveryMethod": "webhook",
  "webhookUrl": "https://nebraska.node-platform.gov/federation/inbox"
}

Response:
{
  "subscriptionId": "ia-to-ne-subscription-001",
  "status": "active",
  "expiresAt": "2027-03-07T00:00:00Z",
  "renewalUrl": "/federation/subscriptions/ia-to-ne-subscription-001/renew"
}
```

**Event Inbox:**
```
POST /federation/inbox
X-Federation-Source: iowa.node-platform.gov
X-Federation-Signature: <signed-hash>
Content-Type: application/activity+json

Request:
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Create",
  "actor": "https://iowa.node-platform.gov",
  "object": {
    "type": "Event",
    "id": "https://iowa.node-platform.gov/events/evt-12345",
    "eventType": "accident",
    "severity": "major",
    "location": {
      "type": "Point",
      "coordinates": [-95.5, 40.8] // Near Nebraska border
    },
    "wzdx": { /* Full WZDx 4.2 payload */ },
    "published": "2026-03-07T14:32:00Z"
  }
}

Response:
{
  "received": true,
  "eventId": "ne-received-evt-67890",
  "processingStatus": "accepted"
}
```

**Modified Endpoints:**

```
GET /api/events?mode=federation
```
- Add `mode` parameter: `hub`, `federation`, `all`
- `hub`: Only events from central hub (existing behavior)
- `federation`: Only events from bilateral peers
- `all`: Combined view (deduplicated)

### Database Schema Changes

```sql
-- Federation subscriptions table
CREATE TABLE federation_subscriptions (
  id UUID PRIMARY KEY,
  subscriber_state VARCHAR(2) NOT NULL,
  subscriber_endpoint TEXT NOT NULL,
  subscriber_public_key TEXT NOT NULL,

  filters JSONB, -- Event filters (bbox, eventTypes, corridors)

  status VARCHAR(20) NOT NULL, -- 'active', 'paused', 'expired'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_push_at TIMESTAMP WITH TIME ZONE,

  -- Metrics
  events_pushed INTEGER DEFAULT 0,
  failed_pushes INTEGER DEFAULT 0,

  UNIQUE(subscriber_state, subscriber_endpoint)
);

CREATE INDEX idx_fed_subs_status ON federation_subscriptions(status);
CREATE INDEX idx_fed_subs_expires ON federation_subscriptions(expires_at);

-- Federation keys (public keys of peer states)
CREATE TABLE federation_keys (
  id UUID PRIMARY KEY,
  state_code VARCHAR(2) NOT NULL,
  key_id TEXT NOT NULL,
  public_key_pem TEXT NOT NULL,

  verified BOOLEAN DEFAULT false,
  verified_by VARCHAR(100), -- Who verified this key
  verified_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(state_code, key_id)
);

-- Federation event log (track bilateral pushes)
CREATE TABLE federation_events_log (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES events(id),

  destination_state VARCHAR(2) NOT NULL,
  destination_endpoint TEXT NOT NULL,

  push_method VARCHAR(20), -- 'bilateral', 'regional_hub', 'central_hub'
  push_status VARCHAR(20), -- 'success', 'failed', 'pending'

  latency_ms INTEGER,
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fed_log_event ON federation_events_log(event_id);
CREATE INDEX idx_fed_log_status ON federation_events_log(push_status);
```

### Configuration Changes

```env
# Federation mode
FEDERATION_ENABLED=true
FEDERATION_MODE=hybrid  # 'disabled', 'bilateral', 'hybrid', 'full'

# State identity
STATE_CODE=IA
STATE_NAME=Iowa Department of Transportation
FEDERATION_DOMAIN=iowa.node-platform.gov

# Cryptographic keys
FEDERATION_PRIVATE_KEY_PATH=/etc/node/keys/federation-private.pem
FEDERATION_PUBLIC_KEY_PATH=/etc/node/keys/federation-public.pem

# Central hub (optional in federation mode)
CENTRAL_HUB_ENABLED=true
CENTRAL_HUB_URL=https://national.node-platform.gov
CENTRAL_HUB_MODE=mirror  # 'primary', 'mirror', 'disabled'

# Federation registry
FEDERATION_REGISTRY_URL=https://registry.node-platform.gov
FEDERATION_REGISTRY_FALLBACK=https://registry-backup.node-platform.gov

# Security
FEDERATION_SIGNATURE_ALGORITHM=rsa-sha256
FEDERATION_MAX_CLOCK_SKEW=300  # 5 minutes
FEDERATION_REQUIRE_MTLS=false  # Set true for high-security deployments
```

### Dependencies

**New Libraries:**
```json
{
  "dependencies": {
    "http-signature": "^1.4.0",
    "@opentelemetry/api": "^1.8.0",
    "activitypub-core-types": "^1.0.0",
    "geohash": "^2.0.0",
    "node-cache": "^5.1.2"
  }
}
```

**Infrastructure:**
- DNS: Add SRV records for `_node-federation._tcp.iowa.node-platform.gov`
- PKI: Generate RSA 4096-bit keypairs for each state
- Registry: Deploy lightweight registry service (< $50K/year)

---

## Implementation Complexity

**Estimated Effort:** Large (3-4 months)

**Breakdown:**
- **Backend changes:** 30 days
  - Federation endpoints: 8 days
  - Event publisher refactor: 7 days
  - Signature middleware: 5 days
  - Database migrations: 3 days
  - Configuration: 2 days
  - Documentation: 5 days

- **Infrastructure:** 10 days
  - PKI setup (certificate generation): 3 days
  - Registry service deployment: 5 days
  - DNS configuration: 2 days

- **Testing:** 15 days
  - Unit tests (federation logic): 5 days
  - Integration tests (state-to-state): 7 days
  - Security testing (signature verification): 3 days

- **Documentation:** 10 days
  - API documentation: 3 days
  - Self-hosting guide: 4 days
  - Migration runbook: 3 days

- **Pilot deployment:** 20 days
  - Deploy to 3 pilot states: 10 days
  - Monitor and iterate: 10 days

**Team Requirements:**
- **Backend engineer** (primary) - 60 days
- **DevOps engineer** - 20 days (infrastructure, PKI)
- **Security engineer** - 10 days (security review, signature implementation)
- **Technical writer** - 10 days (documentation)

**Dependencies/Blockers:**
- Need consortium approval for PKI strategy (self-signed vs commercial CA)
- Pilot states must agree to test bilateral connections (suggest IA, NE, MO)
- DNS changes require coordination with state IT departments

---

## Breaking Changes

- [x] **No breaking changes** - Fully backward compatible

**Rationale:**
- Federation is **opt-in** - states can continue using hub-and-spoke
- Existing REST and WebSocket APIs unchanged
- New federation endpoints are additive (`/federation/*`)
- Database migrations are additive (new tables, no schema changes to `events`)
- Configuration defaults to existing behavior (`FEDERATION_ENABLED=false`)

**Migration Path:**
1. Deploy v3.0 with federation disabled (default)
2. Pilot states enable federation and test bilateral connections
3. Once stable, offer federation to all states (opt-in)
4. By v4.0 (2028), make federation the default (hub becomes optional)

**No Deprecation Timeline:**
- Hub-and-spoke mode remains fully supported indefinitely
- States can choose deployment mode based on needs
- Some states may never self-host (e.g., small states without IT capacity)

---

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/federation/publisher.test.ts
describe('FederationPublisher', () => {
  it('should publish event to bilateral peers', async () => {
    const event = fixtures.event({ latitude: 40.8, longitude: -95.5 });

    // Mock Nebraska peer
    nock('https://nebraska.node-platform.gov')
      .post('/federation/inbox')
      .reply(200, { received: true });

    await publisher.publishEvent(event);

    expect(mockHttpClient).toHaveBeenCalledWith(
      'https://nebraska.node-platform.gov/federation/inbox',
      expect.objectContaining({ event })
    );
  });

  it('should fallback to hub on peer failure', async () => {
    const event = fixtures.event({ latitude: 40.8, longitude: -95.5 });

    // Mock Nebraska peer failure
    nock('https://nebraska.node-platform.gov')
      .post('/federation/inbox')
      .reply(500);

    // Mock central hub success
    nock('https://national.node-platform.gov')
      .post('/api/events')
      .reply(201);

    await publisher.publishEvent(event);

    expect(logger.warn).toHaveBeenCalledWith(
      'Peer connection failed, using hub fallback'
    );
  });
});

// tests/unit/federation/signatures.test.ts
describe('HTTP Signature Verification', () => {
  it('should verify valid signature from peer state', async () => {
    const req = createMockRequest({
      headers: {
        'Signature': 'keyId="iowa",algorithm="rsa-sha256",signature="..."',
        'Date': new Date().toUTCString()
      },
      body: JSON.stringify({ event: 'test' })
    });

    const isValid = await verifyFederationRequest(req);

    expect(isValid).toBe(true);
  });

  it('should reject signature with expired timestamp', async () => {
    const oldDate = new Date(Date.now() - 600000); // 10 minutes ago

    const req = createMockRequest({
      headers: {
        'Signature': 'keyId="iowa",algorithm="rsa-sha256",signature="..."',
        'Date': oldDate.toUTCString()
      }
    });

    await expect(verifyFederationRequest(req)).rejects.toThrow(
      'Request timestamp too old'
    );
  });
});
```

**Unit Test Coverage Target:** 85% for all federation code

### Integration Tests

```typescript
// tests/integration/federation/state-to-state.test.ts
describe('State-to-State Federation', () => {
  let iowaHub: TestServer;
  let nebraskaHub: TestServer;

  beforeAll(async () => {
    iowaHub = await createTestServer({ stateCode: 'IA' });
    nebraskaHub = await createTestServer({ stateCode: 'NE' });
  });

  it('should establish bilateral subscription', async () => {
    // Iowa subscribes to Nebraska
    const response = await request(nebraskaHub.app)
      .post('/federation/subscribe')
      .set('Authorization', `Bearer ${iowaHub.token}`)
      .send({
        subscriber: iowaHub.endpoint,
        filters: { eventTypes: ['accident'], maxDistance: 50 }
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('active');
  });

  it('should push events to subscribed peers', async () => {
    // Nebraska creates event near Iowa border
    const event = await nebraskaHub.createEvent({
      eventType: 'accident',
      latitude: 40.8,
      longitude: -95.5 // Near Iowa border
    });

    // Wait for federation push
    await sleep(100);

    // Check Iowa received event
    const iowaEvents = await iowaHub.getEvents({ mode: 'federation' });
    expect(iowaEvents).toContainEqual(
      expect.objectContaining({ id: event.id })
    );
  });
});
```

### Load Tests

```javascript
// tests/load/federation-throughput.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 }, // 50 concurrent states
    { duration: '5m', target: 50 },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // 95% < 1s
    'federation_push_success': ['rate>0.99'], // 99% success
  },
};

export default function() {
  // Each state publishes event
  const event = {
    eventType: 'accident',
    latitude: 40.5 + Math.random(),
    longitude: -95.0 + Math.random(),
  };

  // Publish to peer
  const response = http.post(
    'https://nebraska.node-platform.gov/federation/inbox',
    JSON.stringify(event),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Federation-Source': `state-${__VU}.node-platform.gov`,
        'X-Federation-Signature': generateSignature(event),
      }
    }
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
    'received confirmed': (r) => r.json('received') === true,
  });
}

// Target: 50 states × 100 events/min = 5,000 federation pushes/min (83/sec)
// With 50 concurrent senders: ~100ms P95 latency
```

### Security Tests

**Penetration Testing:**
- Attempt signature forgery
- Test replay attacks (old timestamp)
- Test man-in-the-middle (signature verification)
- Verify mTLS enforcement (if enabled)

**OWASP ZAP Scan:**
```bash
zap-baseline.py -t https://iowa.node-platform.gov/federation \
  -c .zap/federation-rules.conf
```

---

## Security & Privacy Considerations

### Security Implications

**1. Trust Between States**
- **Risk:** Malicious state could send fake events
- **Mitigation:**
  - All requests signed with state's private key
  - Public keys published in consortium registry
  - Trust levels assigned (verified state vs unknown peer)
  - Events include provenance (origin, signature status, hops)

**2. Man-in-the-Middle Attacks**
- **Risk:** Attacker intercepts state-to-state communication
- **Mitigation:**
  - All federation endpoints require HTTPS/TLS 1.3
  - Optional mTLS for high-security deployments
  - HTTP signatures prevent tampering
  - Timestamp verification prevents replay attacks

**3. Denial of Service**
- **Risk:** Malicious peer floods state with events
- **Mitigation:**
  - Rate limiting: 1,000 events/min per peer
  - Circuit breaker: Auto-block peer after 10 consecutive failures
  - Subscription management: States control who can push to them

### Privacy Considerations

**Data Sharing Controls:**

```typescript
// States control what data is federated
export interface EventSharingPolicy {
  visibility: 'public' | 'consortium' | 'bilateral' | 'private';
  allowedStates?: string[]; // If bilateral
  allowCentralHub: boolean;
  allowCommercial: boolean; // Vendor access
  sanitizeFor?: 'commercial' | 'public'; // Privacy filters
}

// Example: Law enforcement event (private)
const event = {
  eventType: 'law_enforcement',
  description: 'Security incident on I-80',
  sharingPolicy: {
    visibility: 'bilateral',
    allowedStates: ['NE'], // Only share with Nebraska
    allowCentralHub: false, // Don't mirror to central
    allowCommercial: false
  }
};

// Example: Public road closure
const event2 = {
  eventType: 'road_closure',
  description: 'I-80 MM 295 closed due to weather',
  sharingPolicy: {
    visibility: 'public',
    allowCentralHub: true,
    allowCommercial: true,
    sanitizeFor: 'public' // Remove internal notes
  }
};
```

**PII Protection:**
- Automatic redaction of license plates, names
- Coordinate precision reduction for commercial recipients (3 decimals = ~111m)
- Internal operator notes never federated

**Compliance:**
- FedRAMP Moderate: Federation endpoints meet same standards as hub
- SOC 2 Type II: Audit trails for all bilateral data sharing
- State privacy laws: Each state controls their data sharing policies

**Does This Meet Requirements?**
- ✅ All data encrypted in transit (TLS 1.3)
- ✅ Authentication via signed requests
- ✅ Authorization via subscription management
- ✅ Audit trails in `federation_events_log` table
- ✅ PII protection via privacy filters

---

## Alternatives Considered

### Alternative 1: Keep Hub-and-Spoke Only

**Approach:** Don't implement federation, rely solely on central hub indefinitely

**Pros:**
- Simpler architecture
- Lower initial development cost
- Faster time to market

**Cons:**
- Single point of failure risk
- $10M/year perpetual cost
- No exit strategy for states
- Vendor lock-in concerns

**Decision:** **Rejected**. Long-term sustainability requires federation option.

### Alternative 2: Full Decentralization from Day 1

**Approach:** Deploy DHT-based P2P federation immediately, no central hub

**Pros:**
- Maximum resilience from start
- No central operational costs
- Complete state sovereignty

**Cons:**
- Complex for states to deploy (requires DHT expertise)
- Slower adoption (states must self-host from day 1)
- No central data quality enforcement
- IPAWS integration harder (which state generates alert?)
- Takes 3-4 years to deploy (vs 2 years hub-and-spoke)

**Decision:** **Rejected**. Too complex for initial deployment. Use phased approach:
- Phase 1: Hub-and-spoke (2025-2027) - Prove value
- Phase 2: Add bilateral (2027-2028) - This RFC
- Phase 3: Regional hubs (2028-2030) - Distribute operations
- Phase 4: Full federation (2030+) - DHT-based

### Alternative 3: ActivityPub Standard

**Approach:** Use existing ActivityPub (Mastodon protocol) without modifications

**Pros:**
- Proven federation model (millions of users)
- Existing libraries and tooling
- Well-documented

**Cons:**
- Designed for social media, not transportation data
- Lacks real-time push (relies on polling)
- No built-in geo-spatial filtering
- Additional complexity (followers, likes, boosts not needed)

**Decision:** **Partial adoption**. Use ActivityPub JSON format and signing concepts, but simplify for transportation use case. Don't implement social features.

### Alternative 4: GraphQL Federation

**Approach:** Use Apollo GraphQL Federation for state-to-state queries

**Pros:**
- Flexible query language
- Automatic schema stitching
- Strong typing

**Cons:**
- Query-based (pull), not event-based (push)
- Higher latency for real-time events
- More complex client implementation
- Requires GraphQL expertise at every state

**Decision:** **Rejected**. Transportation coordination needs push-based events (not pull-based queries) for real-time alerting. REST + WebSocket is simpler for state DOT operators.

---

## Rollout Plan

### Phase 1: Alpha (Internal Testing - Weeks 1-4)

**Goal:** Prove federation works technically

**Activities:**
- Deploy federation code to staging environment
- Set up 3 test instances (simulating IA, NE, MO)
- Test bilateral subscriptions
- Test event publishing
- Load testing (1,000 events/min)
- Security audit (signature verification, TLS)

**Exit Criteria:**
- All integration tests passing
- < 100ms P95 latency for bilateral pushes
- 99.9% delivery success rate
- No security vulnerabilities (OWASP Top 10)

**Team:** Platform Engineering (internal)

### Phase 2: Beta (Pilot States - Months 2-4)

**Goal:** Validate with real state DOTs

**Pilot States:**
1. **Iowa** - Hosts Midwest regional hub candidate
2. **Nebraska** - Iowa's primary bilateral partner (I-80 corridor)
3. **Missouri** - I-35 corridor, tests multi-state federation

**Activities:**
- Deploy federation to production (disabled by default)
- Enable federation for 3 pilot states
- Iowa ←→ Nebraska bilateral connection
- Iowa ←→ Missouri bilateral connection
- Monitor for 8 weeks:
  - Latency metrics
  - Delivery success rate
  - Operator feedback
- Train state operators on federation features

**Success Metrics:**
- Bilateral latency < 50ms (vs 200ms via hub)
- 99.5% delivery success
- 0 critical bugs
- Positive operator feedback (>4.0/5.0)

**Rollback Plan:**
- If federation fails, disable feature flag
- States continue using hub-and-spoke
- No data loss (events still in central hub)

### Phase 3: General Availability (All States - Months 5-12)

**Goal:** Offer federation to all 50 states

**Rollout Strategy:**
- Announce federation in Q2 2027 consortium meeting
- Provide self-hosting documentation
- Offer technical assistance for states wanting to self-host
- Optional training webinars (monthly)

**Adoption Targets:**
- **Q3 2027:** 10 states using bilateral connections (20%)
- **Q4 2027:** 20 states (40%)
- **2028:** 35 states (70%)
- **2029:** All 50 states have option, ~40 states actively using

**Marketing:**
- Case study: "How Iowa and Nebraska reduced coordination latency by 75%"
- Cost analysis: "Self-hosting saves $50K/year in membership fees"
- Sovereignty whitepaper: "Maintaining control over your transportation data"

### Phase 4: Regional Hubs (2028-2030)

**Goal:** Transition to regional hub model

**Milestones:**
- Deploy 5 regional hubs (Midwest, Mountain West, South, Northeast, West Coast)
- Migrate states from central to regional hubs
- Central hub becomes coordination layer only
- Reduce central cost from $10M/year to $4M/year

---

## Success Metrics

### Primary Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Bilateral Latency** | < 50ms P95 | Prometheus `federation_push_duration` |
| **Delivery Success Rate** | > 99.5% | `federation_push_success / federation_push_total` |
| **State Adoption** | 20 states by end of 2027 | Count of states with `FEDERATION_ENABLED=true` |
| **Central Cost Reduction** | 40% by 2030 ($10M → $6M) | Annual operating budget |

### Secondary Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Self-Hosted States** | 10 states by 2029 | States running own infrastructure |
| **Federation Uptime** | > 99.9% | `up{job="federation"}` |
| **Bilateral Connections** | Average 5 peers per state | `federation_subscriptions` table |
| **Operator Satisfaction** | > 4.0/5.0 | Quarterly survey |

### Monitoring

**Grafana Dashboard: Federation Health**

```
┌─────────────────────────────────────────────────────────────┐
│                 Federation Dashboard                        │
├─────────────────────────────────────────────────────────────┤
│ Active Subscriptions: 127                                   │
│ Bilateral Connections: 15 states                            │
│ Events Federated (24h): 45,231                              │
├─────────────────────────────────────────────────────────────┤
│  Bilateral Push Latency (P95)                               │
│  [Graph: 15-50ms over past 7 days]                          │
│                                                             │
│  Delivery Success Rate                                      │
│  [Graph: 99.7-99.9% over past 7 days]                       │
│                                                             │
│  Federation Events by Destination                           │
│  [Bar chart: NE: 12K, MO: 10K, WY: 8K, ...]                │
└─────────────────────────────────────────────────────────────┘
```

**Alerts:**
- Delivery success rate < 99% for 10 minutes
- Bilateral latency P95 > 200ms for 5 minutes
- Federation endpoint returning 5xx errors

---

## Documentation Updates

### Required Updates

- [x] **API Specification** (specs/architecture/api-specifications.md)
  - Add federation endpoints
  - Add request signing examples
  - Add ActivityPub JSON format

- [x] **Database Schema** (specs/architecture/database-schema.md)
  - Add `federation_subscriptions` table
  - Add `federation_keys` table
  - Add `federation_events_log` table

- [x] **Architecture Diagrams** (specs/architecture/federation-architecture.md)
  - NEW: Complete visual guide (see companion document)

- [x] **Self-Hosting Guide** (NEW: specs/operations/self-hosting.md)
  - Docker Compose deployment
  - Kubernetes deployment
  - Key generation (PKI)
  - DNS configuration

- [ ] **Migration Runbook** (NEW: specs/operations/federation-migration.md)
  - Hub-and-spoke → Bilateral migration
  - Data export/import procedures
  - Rollback procedures

- [ ] **Security Audit Report** (NEW: specs/compliance/federation-security-audit.md)
  - Signature verification audit
  - TLS configuration review
  - Rate limiting analysis

- [ ] **Release Notes** (CHANGELOG.md)
  - v3.0 Federation Protocol release
  - Breaking changes (none)
  - Migration guide link

---

## Open Questions

### 1. PKI Strategy

**Question:** Should states use self-signed certificates or consortium-operated CA?

**Options:**
- **A:** Self-signed (each state generates own keypair, publishes public key to registry)
- **B:** Consortium CA (consortium operates certificate authority, issues certificates to states)
- **C:** Commercial CA (use Let's Encrypt or commercial CA)

**Implications:**
- **A:** Most flexible, no external dependencies, but states must manage key rotation
- **B:** Centralized trust, easier revocation, but consortium becomes dependency
- **C:** Industry standard, but external dependency and annual costs

**Decision Needed By:** Platform Lead + Security Engineer (by end of Month 1)

**Recommendation:** Start with **A (self-signed)** for Phase 1, transition to **B (consortium CA)** in Phase 3 for easier key management at scale.

---

### 2. DHT Implementation Timeline

**Question:** When should we implement DHT-based peer discovery?

**Options:**
- **A:** Phase 2 (2027-2028) - Implement DHT alongside bilateral
- **B:** Phase 3 (2028-2030) - Implement DHT for regional hubs
- **C:** Phase 4 (2030+) - Implement DHT only if decentralization needed

**Implications:**
- **A:** More complex implementation, but enables full decentralization sooner
- **B:** DHT for hub-to-hub federation, states still use registry
- **C:** Simplest near-term, but delays full decentralization

**Decision Needed By:** Technical Steering Committee (by end of Month 2)

**Recommendation:** **C (Phase 4)**. Central registry sufficient for 50 states. Only implement DHT if states demand full decentralization or consortium dissolution risk emerges.

---

### 3. Regional Hub Operators

**Question:** Who operates regional hubs? Consortium staff or volunteer states?

**Options:**
- **A:** Consortium hires regional operators (5 teams × 3 people = 15 staff)
- **B:** Volunteer states host regional hubs (Iowa hosts Midwest, etc.)
- **C:** Hybrid (consortium coordinates, states provide infrastructure)

**Implications:**
- **A:** Professional operations, but higher cost ($6M/year for 15 staff)
- **B:** Lower cost ($1.5M/year stipends), but depends on volunteer availability
- **C:** Distributed expertise, but coordination overhead

**Decision Needed By:** Consortium Board (by Q4 2027, before Phase 3)

**Recommendation:** **C (Hybrid)**. States volunteer infrastructure (Iowa data center), consortium provides operational support. 5 states × $300K stipend = $1.5M/year.

---

### 4. Vendor Pricing Model

**Question:** How do vendors pay for direct state federation access?

**Options:**
- **A:** Free (states absorb bandwidth costs, vendors pay nothing)
- **B:** Per-event pricing (states charge $0.001/event, like current consortium)
- **C:** Subscription pricing (vendors pay $10K/year per state)

**Implications:**
- **A:** Simplest, but states bear costs (could be $50K/year for large states)
- **B:** Revenue-neutral for states, but micropayment complexity
- **C:** Predictable revenue, but may discourage vendor participation

**Decision Needed By:** Consortium Board + State DOT stakeholders (by end of Beta phase)

**Recommendation:** **B (Per-event)** initially, states have option to switch to **C (Subscription)** if micropayments prove burdensome. Each state sets own pricing.

---

## References

- [NATIONAL_BUILD_SPECIFICATION.md Section 30](../NATIONAL_BUILD_SPECIFICATION.md#30-federation-protocol--decentralized-architecture) - Full technical specification
- [Federation Architecture Visual Guide](../specs/architecture/federation-architecture.md) - Diagrams and network topology
- [ActivityPub Protocol](https://www.w3.org/TR/activitypub/) - Federation inspiration
- [HTTP Signatures (RFC 9421)](https://datatracker.ietf.org/doc/html/rfc9421) - Request signing standard
- [Mastodon Federation](https://docs.joinmastodon.org/spec/activitypub/) - Real-world federation example
- [Kademlia DHT](https://pdos.csail.mit.edu/~petar/papers/maymounkov-kademlia-lncs.pdf) - Peer discovery algorithm
- [Internet2](https://internet2.edu/) - Academic consortium model (precedent)
- [I-95 Corridor Coalition](https://i95coalition.org/) - Multi-state transportation coordination (precedent)

---

## Approvals

### Technical Review

- [ ] **Platform Lead:** _____________________ Date: _______
  - Sign-off on architecture approach
  - Resource allocation approval

- [ ] **Backend Lead:** _____________________ Date: _______
  - Implementation feasibility
  - Timeline review

- [ ] **Security Engineer:** _____________________ Date: _______
  - PKI strategy approval
  - Signature verification review

- [ ] **DevOps Lead:** _____________________ Date: _______
  - Infrastructure requirements
  - Deployment strategy

### Stakeholder Approval

- [ ] **State Consortium Board:** _____________________ Date: _______
  - 3 pilot states identified (IA, NE, MO)
  - Budget approval for registry service
  - Regional hub operator model decision

- [ ] **USDOT Program Office:** _____________________ Date: _______
  - Alignment with federal interoperability goals
  - Confirmation: Federation does not violate grant terms

### Implementation Approval

- [ ] **CTO:** _____________________ Date: _______
  - Final approval to proceed with Phase 1 (Alpha)
  - Resource commitment for 3-4 months

---

## Implementation Tracking

**GitHub Issue:** [#RFC-001](https://github.com/node-platform/node-federation/issues/1)
**Discussion:** [GitHub Discussions](https://github.com/node-platform/node-federation/discussions/1)
**Pull Request:** TBD (after approval)
**Target Release:** v3.0 (Q3 2027)
**Documentation:** [Federation Architecture Guide](../specs/architecture/federation-architecture.md)

---

## Notes

### Review Comments

*(Space for reviewers to add comments during review process)*

**Platform Lead:**

**Backend Lead:**

**Security Engineer:**

**State DOT Representatives:**

---

### Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-07 | Platform Architecture Team | Initial draft |

---

**Next Steps:**

1. ✅ Submit this RFC as a GitHub Discussion
2. ⏳ Platform Lead assigns reviewers (Technical Steering Committee)
3. ⏳ Reviewers provide feedback within 2 weeks
4. ⏳ Author addresses feedback and updates RFC
5. ⏳ Technical review meeting scheduled (Week 3)
6. ⏳ Stakeholder approval vote (Consortium Board, Week 4)
7. ⏳ Final CTO approval
8. ⏳ Implementation begins (Month 2)

---

*This RFC proposes a path from centralized hub-and-spoke to decentralized federation over 5 years, ensuring the platform survives beyond initial deployment and provides states with sovereignty and resilience.*
