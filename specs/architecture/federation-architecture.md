# Federation Architecture - Visual Guide

**Version:** 1.0
**Last Updated:** March 7, 2026
**Status:** Design Specification

---

## Table of Contents

1. [Architecture Evolution Timeline](#architecture-evolution-timeline)
2. [Hub-and-Spoke Architecture (Phase 1)](#hub-and-spoke-architecture-phase-1)
3. [Bilateral Federation (Phase 2)](#bilateral-federation-phase-2)
4. [Regional Hubs (Phase 3)](#regional-hubs-phase-3)
5. [Full Decentralization (Phase 4)](#full-decentralization-phase-4)
6. [Federation Protocol Flow](#federation-protocol-flow)
7. [Data Flow Diagrams](#data-flow-diagrams)
8. [Network Topology](#network-topology)
9. [Security Architecture](#security-architecture)
10. [Failure Scenarios & Resilience](#failure-scenarios--resilience)

---

## Architecture Evolution Timeline

```
2025 ──────────────────> 2027 ──────────────────> 2029 ──────────────────> 2035+
     Phase 1                    Phase 2                    Phase 3                Phase 4
  Hub-and-Spoke           Hub + Bilateral            Regional Hubs          Full Federation

  ┌──────────┐            ┌──────────┐              ┌──────────┐                DHT-Based
  │ Central  │            │ Central  │              │ National │             Peer Discovery
  │   Hub    │            │   Hub    │              │   Hub    │
  └────┬─────┘            └────┬─────┘              └────┬─────┘           ┌────────────┐
       │                       │                         │                  │  No Central │
   All 50 States         Iowa ←→ Nebraska        Regional Hubs             │ Dependency  │
   Connect Here          (Direct P2P)            ←→ ←→ ←→                  └────────────┘
                                                      │                            │
  Proven Model          Bilateral Opt-In         Distributed Ops           Fully Resilient
  Fast Deployment       Data Sovereignty         Cost Reduction           Survives Anything
  $10M/yr Central       Exit Strategy            $4M/yr Central           $0 Central Cost
```

---

## Hub-and-Spoke Architecture (Phase 1)

**Timeline:** 2025-2027
**Goal:** Connect all 50 states rapidly, prove value

### Network Diagram

```
                              ┌─────────────────────────────┐
                              │   AWS Multi-Region Hub      │
                              │                             │
                              │  ┌────────┐   ┌────────┐   │
                              │  │ us-east│   │ us-west│   │
                              │  │   -1   │←→ │   -2   │   │
                              │  └────┬───┘   └───┬────┘   │
                              │       │           │        │
                              │   ┌───▼───────────▼───┐    │
                              │   │  Load Balancer    │    │
                              │   └───────┬───────────┘    │
                              │           │                │
                              │   ┌───────▼───────────┐    │
                              │   │ API Gateway       │    │
                              │   │ (REST+WebSocket)  │    │
                              │   └───────┬───────────┘    │
                              │           │                │
                              │   ┌───────▼───────────┐    │
                              │   │ Event Processor   │    │
                              │   └───────┬───────────┘    │
                              │           │                │
                              │   ┌───────▼───────────┐    │
                              │   │ PostgreSQL+PostGIS│    │
                              │   └───────────────────┘    │
                              └──────────┬──────────────────┘
                                         │
         ┌───────────────────────────────┼───────────────────────────────┐
         │                               │                               │
    ┌────▼────┐                     ┌────▼────┐                    ┌────▼────┐
    │  Iowa   │                     │Nebraska │                    │Colorado │
    │   DOT   │                     │   DOT   │                    │   DOT   │
    └─────────┘                     └─────────┘                    └─────────┘

    ... (47 more states) ...


Ingestion:
  State → Central Hub (HTTP POST)
  - WZDx feed URLs polled every 30 seconds
  - Real-time webhook push
  - TMDD XML conversion

Broadcasting:
  Central Hub → All States (WebSocket)
  - Sub-second latency
  - 50K concurrent connections
  - Filtered by subscription preferences

Data Storage:
  - Single source of truth (PostgreSQL)
  - 5M+ events/day
  - 7-day retention (configurable)
```

### Characteristics

**Pros:**
- ✅ Simple for states (one connection)
- ✅ Fast deployment (2 years to full rollout)
- ✅ Centralized data quality enforcement
- ✅ Easy IPAWS integration (18-second alerts)
- ✅ Single API for vendors

**Cons:**
- ❌ Single point of failure (mitigated by multi-region)
- ❌ High central operational cost ($10M/year)
- ❌ States dependent on consortium
- ❌ Vendor gatekeeping

**Capacity:**
- 50 state feeds ingested
- 5,000 events/second processing
- 50,000 concurrent WebSocket users
- 99.9% uptime SLA

---

## Bilateral Federation (Phase 2)

**Timeline:** 2027-2029
**Goal:** Enable direct state-to-state communication for regional coordination

### Network Diagram

```
                         ┌──────────────────┐
                         │   Central Hub    │
                         │   (Still active) │
                         └────────┬─────────┘
                                  │
                                  │ (All traffic still goes through hub)
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
    ┌────▼────┐              ┌────▼────┐              ┌────▼────┐
    │  Iowa   │◄────────────►│Nebraska │              │Colorado │
    │   DOT   │  Bilateral   │   DOT   │              │   DOT   │
    └─────────┘  Connection  └─────────┘              └─────────┘
         │                                                   │
         │                                                   │
         └───────────────────────────────────────────────────┘
              Optional bilateral connection (I-80 states)


Flow Priority:
  1. Try bilateral peer connection (< 50ms latency)
  2. Fallback to central hub (< 200ms latency)
  3. Central hub still gets copy for national view

Example: Iowa-Nebraska Border Incident
  1. Nebraska detects accident at I-80 MM 5 (near Iowa border)
  2. Nebraska → Iowa direct (bilateral): 15ms
  3. Nebraska → Central Hub (mirror): 150ms
  4. Central Hub → Other 48 states: 200ms total

  Result: Iowa gets instant notification, national coordination still works
```

### Federation Handshake

```
┌─────────┐                                               ┌─────────┐
│  Iowa   │                                               │Nebraska │
│   DOT   │                                               │   DOT   │
└────┬────┘                                               └────┬────┘
     │                                                          │
     │ 1. Discovery                                             │
     │    GET /.well-known/node-federation                      │
     ├─────────────────────────────────────────────────────────►│
     │                                                          │
     │ 2. Federation Info + Public Key                          │
     │◄─────────────────────────────────────────────────────────┤
     │    {endpoint, capabilities, publicKey}                   │
     │                                                          │
     │ 3. Subscribe to Border Events                            │
     │    POST /federation/subscribe                            │
     │    {filters: {bbox: [-96.6, 40.3, -95.3, 41.0]}}         │
     ├─────────────────────────────────────────────────────────►│
     │                                                          │
     │ 4. Subscription Confirmed                                │
     │◄─────────────────────────────────────────────────────────┤
     │    {subscriptionId, status: "active"}                    │
     │                                                          │
     │                                                          │
     │ 5. Event Push (when incident occurs)                     │
     │◄═════════════════════════════════════════════════════════│
     │    POST /federation/inbox                                │
     │    Signed with Nebraska's private key                    │
     │                                                          │
     │ 6. Acknowledgment                                        │
     ├─────────────────────────────────────────────────────────►│
     │    200 OK {received: true}                               │
     │                                                          │
```

### Characteristics

**New Capabilities:**
- ✅ Direct state-to-state communication (opt-in)
- ✅ Reduced latency for regional events (15ms vs 200ms)
- ✅ Data sovereignty (states control bilateral sharing)
- ✅ Exit strategy testing (proves federation works)

**Still Maintained:**
- ✅ Central hub coordination for national view
- ✅ IPAWS integration
- ✅ Single API for most vendors

**Adoption:**
- Initial: 10 states test bilateral (I-80, I-95 corridors)
- By 2029: 30 states using bilateral for neighbor coordination

---

## Regional Hubs (Phase 3)

**Timeline:** 2028-2030
**Goal:** Distribute operational costs and improve locality

### Network Diagram

```
                                  ┌──────────────────┐
                                  │   National Hub   │
                                  │  (Coordination)  │
                                  │   $4M/yr cost    │
                                  └────────┬─────────┘
                                           │
                           ┌───────────────┼───────────────┐
                           │               │               │
                   ┌───────▼──────┐ ┌──────▼─────┐ ┌──────▼──────┐
                   │   Midwest    │ │  Mountain  │ │  Northeast  │
                   │     Hub      │◄┤  West Hub  ├►│     Hub     │
                   │ Iowa-hosted  │ │ CO-hosted  │ │  NY-hosted  │
                   └───────┬──────┘ └──────┬─────┘ └──────┬──────┘
                           │               │               │
         ┌─────────────────┼───────┐       │       ┌───────┼──────────────┐
         │                 │       │       │       │       │              │
    ┌────▼────┐       ┌────▼────┐ │  ┌────▼────┐  │  ┌────▼────┐    ┌────▼────┐
    │  Iowa   │       │Nebraska │ │  │Colorado │  │  │New York │    │  Penn.  │
    └─────────┘       └─────────┘ │  └─────────┘  │  └─────────┘    └─────────┘
    ┌─────────┐       ┌─────────┐ │  ┌─────────┐  │  ┌─────────┐    ┌─────────┐
    │Missouri │       │ Kansas  │ │  │ Wyoming │  │  │  Conn.  │    │   Mass. │
    └─────────┘       └─────────┘ │  └─────────┘  │  └─────────┘    └─────────┘
    ┌─────────┐       ┌─────────┐ │  ┌─────────┐  │  ┌─────────┐    ┌─────────┐
    │Wisconsin│       │Minnesota│ │  │   Utah  │  │  │  Vermont│    │   N.H.  │
    └─────────┘       └─────────┘ │  └─────────┘  │  └─────────┘    └─────────┘
                                   │               │
                              (+ more states)  (+ more states)


Regional Hub Responsibilities:
  - Event ingestion from states in region
  - Data quality ML processing
  - Real-time WebSocket broadcasting (regional)
  - Federation with other regional hubs
  - Mirror to national hub for nationwide coordination

Cost Breakdown:
  - Each regional hub: $1.2M/year operating cost
  - 5 regional hubs: $6M/year total (vs $10M central)
  - National coordination hub: $4M/year
  - Total: $10M/year (same cost, distributed operations)

Benefits:
  - Lower latency (events stay in-region)
  - Regional autonomy (hubs can customize)
  - Disaster resilience (region survives national failure)
  - Distributed expertise (regional operators)
```

### Regional Hub Locations

```
┌────────────────────────────────────────────────────────────┐
│                     United States                          │
│                                                            │
│  ┌─────────────┐                          ┌─────────────┐ │
│  │  Northwest  │                          │ Northeast   │ │
│  │  WA OR ID   │                          │ NY PA NJ    │ │
│  │  MT         │                          │ CT MA VT    │ │
│  │             │      ┌─────────────┐     │ NH RI ME    │ │
│  │  Portland   │      │  Midwest    │     │             │ │
│  │   (future)  │      │  IA NE MO   │     │ New York    │ │
│  └─────────────┘      │  KS MN WI   │     │   City      │ │
│                       │  IL IN OH   │     └─────────────┘ │
│                       │  MI         │                      │
│  ┌─────────────┐      │             │                      │
│  │  Mountain   │      │ Des Moines  │     ┌─────────────┐ │
│  │  West       │      │  or Kansas  │     │  Southeast  │ │
│  │  CO WY UT   │      │    City     │     │  NC SC GA   │ │
│  │  NM AZ NV   │      └─────────────┘     │  FL VA      │ │
│  │             │                           │  TN KY      │ │
│  │  Denver     │      ┌─────────────┐     │  AL MS LA   │ │
│  └─────────────┘      │  South      │     │             │ │
│                       │  Central    │     │  Atlanta    │ │
│                       │  TX OK AR   │     └─────────────┘ │
│                       │             │                      │
│                       │  Dallas     │                      │
│                       └─────────────┘                      │
└────────────────────────────────────────────────────────────┘

Note: West Coast (CA) could join Northwest or have dedicated hub
```

### Inter-Hub Federation

```
┌────────────┐                                    ┌────────────┐
│  Midwest   │                                    │  Mountain  │
│    Hub     │                                    │  West Hub  │
└──────┬─────┘                                    └─────┬──────┘
       │                                                │
       │  1. Event Created in Iowa                      │
       │     (I-80 MM 295, Omaha area)                  │
       │                                                │
       │  2. Midwest Hub processes event                │
       │     - ML data quality check                    │
       │     - Determine affected regions               │
       │                                                │
       │  3. Check proximity to Mountain West           │
       │     - Event is on I-80 (transcontinental)      │
       │     - Within 200km of Wyoming border           │
       │                                                │
       │  4. Federate to Mountain West Hub              │
       │     POST /federation/hub-to-hub                │
       ├───────────────────────────────────────────────►│
       │     Signed with Midwest Hub key                │
       │                                                │
       │  5. Mountain West broadcasts to CO, WY         │
       │                                                │
       │  6. Both hubs mirror to National Hub           │
       │                                                │
       └───────────────┬────────────────────────────────┘
                       │
                       ▼
               ┌───────────────┐
               │ National Hub  │
               │  (Analytics)  │
               └───────────────┘
```

---

## Full Decentralization (Phase 4)

**Timeline:** 2030+
**Goal:** Eliminate single point of failure, enable true sovereignty

### Network Diagram (DHT-Based Peer Discovery)

```
      ┌─────────┐
      │  Iowa   │
      │   DOT   │
      └────┬────┘
           │
    ┌──────┼──────┐
    │      │      │
┌───▼───┐  │  ┌───▼───┐          No Central Hub
│Nebraska│  │  │Illinois│         DHT Peer Discovery
└───┬───┘  │  └───┬───┘          (Kademlia Protocol)
    │      │      │
    │   ┌──▼──┐   │
    │   │Kansas   │
    │   └──┬──┘   │
    │      │      │
┌───▼──┐   │   ┌──▼───┐
│Missouri│  │  │Wisconsin
└───┬──┘   │   └──┬───┘
    │      │      │
    └──────┼──────┘
           │
       ┌───▼───┐
       │Minnesota
       └───────┘


DHT Node Discovery:
  - Each state runs a DHT node
  - Nodes join DHT by connecting to bootstrap peers
  - States publish their endpoint to DHT: key = "state:IA", value = {endpoint, publicKey}
  - Any state can query DHT to find any other state
  - No central registry required (though optional registry can exist for convenience)

Geo-based Discovery:
  - States publish geo-hashes of their jurisdiction
  - Query DHT for geo:u0j84 (geohash covering Iowa)
  - Returns all states with presence in that area
  - Enables automatic discovery of border neighbors
```

### DHT Discovery Flow

```
┌─────────┐                     DHT Network                    ┌─────────┐
│  Iowa   │                    (All 50 States)                 │Nebraska │
│   DOT   │                                                    │   DOT   │
└────┬────┘                                                    └────┬────┘
     │                                                              │
     │ 1. Bootstrap: Connect to DHT                                │
     │    - Connect to 3-5 known bootstrap nodes                   │
     │    - Discover neighbor nodes in DHT space                   │
     ├────────────────────────────►                                │
     │                             │                               │
     │                         ┌───▼────┐                          │
     │                         │  DHT   │                          │
     │                         │Network │                          │
     │                         └───┬────┘                          │
     │                             │                               │
     │ 2. Publish Self                                             │
     │    PUT state:IA = {endpoint, publicKey, capabilities}       │
     ├────────────────────────────►│                               │
     │                             │                               │
     │                             │◄──────────────────────────────┤
     │                             │  PUT state:NE = {...}         │
     │                             │                               │
     │ 3. Discover Nebraska                                        │
     │    GET state:NE                                             │
     ├────────────────────────────►│                               │
     │                             │                               │
     │ 4. Return Nebraska Endpoint                                 │
     │◄────────────────────────────┤                               │
     │    {endpoint: "https://nebraska.node-platform.gov", ...}    │
     │                             │                               │
     │ 5. Direct Connection                                        │
     │    POST /federation/subscribe                               │
     ├─────────────────────────────────────────────────────────────►│
     │                             │                               │
     │ 6. Federation Active                                        │
     │◄═════════════════════════════════════════════════════════════│
     │    Events flow directly, no hub                             │
     │                             │                               │
```

### Characteristics

**Fully Decentralized:**
- ✅ No single point of failure
- ✅ Survives any node failure (including consortium hub)
- ✅ States have complete sovereignty
- ✅ Zero central operational cost (consortium becomes standards body only)
- ✅ Vendor access at state discretion

**Trade-offs:**
- ⚠️  Eventual consistency (not strong consistency)
- ⚠️  More complex for states to operate
- ⚠️  Requires DHT infrastructure
- ⚠️  National analytics harder (optional aggregation nodes)

---

## Federation Protocol Flow

### Event Lifecycle Across Federation

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Event Lifecycle                                 │
└──────────────────────────────────────────────────────────────────────┘

Step 1: Event Created
┌─────────────┐
│ Iowa Trooper│  Manual entry or sensor detection
│  Creates    │  "Accident on I-80 MM 295"
│   Event     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Iowa Hub    │  Local processing
│ Processes   │  - Data quality check (ML)
│   Event     │  - Geocoding
└──────┬──────┘  - Determine affected areas
       │
       ├─────────────────────────────────────────┐
       │                                         │
       ▼                                         ▼
Step 2: Determine Destinations          Step 3: Apply Privacy Filters
┌─────────────┐                         ┌─────────────┐
│ Check Event │                         │  Sanitize   │
│  Location   │                         │   for       │
│             │                         │ Recipients  │
└──────┬──────┘                         └──────┬──────┘
       │                                       │
       │ Within 100km of NE border             │ Remove PII, reduce precision
       │ On I-80 (CO, WY, UT affected)         │ for commercial recipients
       │                                       │
       ▼                                       ▼
┌─────────────────────────────────────────────────────┐
│           Destinations Determined                   │
│  1. Nebraska (bilateral, high priority)             │
│  2. Wyoming (I-80 corridor)                         │
│  3. Regional Hub (Midwest)                          │
│  4. National Hub (mirror)                           │
│  5. Waze (commercial vendor, sanitized)             │
└─────────────────────────────────────────────────────┘
       │
       │
Step 4: Publish to All Destinations (Parallel)
       │
       ├──────────────┬──────────────┬──────────────┬──────────────┐
       │              │              │              │              │
       ▼              ▼              ▼              ▼              ▼
┌──────────┐   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Nebraska │   │ Wyoming  │  │ Regional │  │ National │  │  Waze    │
│   Hub    │   │   Hub    │  │   Hub    │  │   Hub    │  │  (API)   │
└────┬─────┘   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │              │              │              │              │
     │ 15ms         │ 180ms        │ 50ms         │ 200ms        │ 120ms
     │              │              │              │              │
     │              │              │              │              │
Step 5: Recipients Process
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼
┌──────────┐   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│NE Traffic│   │WY Traffic│  │ Regional │  │Analytics │  │  Waze    │
│  Center  │   │  Center  │  │ States   │  │Dashboard │  │  Users   │
│  Alerts  │   │  Alerts  │  │ Notified │  │ Updated  │  │ Notified │
└──────────┘   └──────────┘  └──────────┘  └──────────┘  └──────────┘


Total Time:
  Nebraska operators: 15ms (bilateral)
  Wyoming operators: 180ms (via I-80 corridor subscription)
  Regional states: 50ms (via regional hub)
  National visibility: 200ms (via national hub)
  Waze app users: 120ms (direct API)
```

---

## Data Flow Diagrams

### Ingestion Data Flow

```
External Sources                Platform Ingestion               Processing

┌──────────────┐               ┌──────────────┐                ┌──────────────┐
│ Iowa WZDx    │───HTTP──────► │   Polling    │───Parse───────►│  Normalize   │
│   Feed       │   GET         │   Service    │   JSON         │   to TIM     │
└──────────────┘               └──────────────┘                └──────┬───────┘
                                                                      │
┌──────────────┐               ┌──────────────┐                      │
│ Nebraska     │───Webhook────►│   Webhook    │───Parse───────►      │
│  Push API    │   POST        │   Receiver   │   JSON              │
└──────────────┘               └──────────────┘                      │
                                                                      │
┌──────────────┐               ┌──────────────┐                      │
│ Colorado     │───TMDD────────►│   TMDD       │───Convert─────►      │
│   TMDD       │   XML         │   Parser     │   to TIM            │
└──────────────┘               └──────────────┘                      │
                                                                      │
                                                                      ▼
                                                            ┌──────────────────┐
                                                            │ Event Validation │
                                                            │  - Required fields
                                                            │  - Coord bounds  │
                                                            │  - Type validation
                                                            └────────┬─────────┘
                                                                     │
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │   ML Quality     │
                                                            │   Scoring        │
                                                            │   (GNN Model)    │
                                                            └────────┬─────────┘
                                                                     │
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │  Geo Enrichment  │
                                                            │  - City/County   │
                                                            │  - Corridor      │
                                                            │  - Milepost      │
                                                            └────────┬─────────┘
                                                                     │
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │  Deduplication   │
                                                            │  - Spatial match │
                                                            │  - Temporal match│
                                                            └────────┬─────────┘
                                                                     │
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │   PostgreSQL     │
                                                            │   Storage        │
                                                            └────────┬─────────┘
                                                                     │
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │ Federation       │
                                                            │ Publisher        │
                                                            └──────────────────┘
```

### Distribution Data Flow

```
Event in Database                Distribution Channels              Recipients

┌──────────────┐                ┌──────────────────┐              ┌──────────────┐
│              │                │  WebSocket       │──────────────►│ State DOT    │
│              │                │  Broadcast       │   Real-time  │ Operators    │
│  PostgreSQL  │───Query───────►│  (Socket.io)     │   < 100ms    │ (50K users)  │
│              │   New Events  └──────────────────┘              └──────────────┘
│   Events     │
│   Table      │                ┌──────────────────┐              ┌──────────────┐
│              │                │  REST API        │──────────────►│ Commercial   │
│              │───Query───────►│  (Express)       │   On-demand  │ Vendors      │
│              │   Filtered    └──────────────────┘   < 500ms    │ (Waze, etc)  │
└──────┬───────┘                                                  └──────────────┘
       │
       │                        ┌──────────────────┐              ┌──────────────┐
       │                        │  Federation      │──────────────►│ Other States │
       └────────────────────────►  Publisher       │   Bilateral  │ (Direct P2P) │
                               │  (HTTP POST)     │   < 50ms     └──────────────┘
                               └─────────┬────────┘
                                         │
                                         ▼
                               ┌──────────────────┐              ┌──────────────┐
                               │  CIFS/TIM        │──────────────►│ Navigation   │
                               │  Converters      │   Batch      │ Apps         │
                               └──────────────────┘   15min      └──────────────┘
                                         │
                                         ▼
                               ┌──────────────────┐              ┌──────────────┐
                               │  IPAWS           │──────────────►│ Emergency    │
                               │  Generator       │   < 18 sec   │ Broadcast    │
                               └──────────────────┘              └──────────────┘
```

---

## Network Topology

### Latency Map (Phase 3 - Regional Hubs)

```
               ┌────────────────────────────────────────────────────┐
               │         United States Network Topology             │
               └────────────────────────────────────────────────────┘

                    Portland             New York
                       ▲                    ▲
                       │                    │
                    ~80ms               ~40ms
                       │                    │
Denver  ◄────────────► Des Moines ◄────────┤
          ~50ms            ▲                │
                          │                 │
                       ~30ms             ~35ms
                          │                 │
                       Dallas          Atlanta


Latency Characteristics:
  - Intra-regional: < 50ms (e.g., IA → NE)
  - Inter-regional: 50-100ms (e.g., Midwest → Mountain West)
  - Coast-to-coast: 80-120ms (e.g., NY → CA)
  - To national hub: varies by state (40-200ms)

Compare to Hub-and-Spoke (All → Central):
  - East coast states: ~40ms to AWS us-east-1
  - Midwest states: ~60ms to AWS us-east-1
  - West coast states: ~80ms to AWS us-east-1 (or 40ms to us-west-2)
  - Then: Central → All states (another 40-80ms)
  - Total: 80-160ms for coast-to-coast event propagation

Regional Hubs Improvement:
  - Events stay local when possible
  - 15-30ms for neighbor notifications (vs 80-160ms)
  - 67% latency reduction for regional coordination
```

### Bandwidth Requirements

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Bandwidth by Component                           │
└─────────────────────────────────────────────────────────────────────┘

Ingestion (State → Hub):
  ┌──────────────┬────────────┬──────────────┐
  │ Source       │ Events/min │ Bandwidth    │
  ├──────────────┼────────────┼──────────────┤
  │ Large state  │ 100        │ 500 KB/s     │
  │ Medium state │ 30         │ 150 KB/s     │
  │ Small state  │ 10         │ 50 KB/s      │
  ├──────────────┼────────────┼──────────────┤
  │ Total (50)   │ ~2,000     │ ~10 MB/s     │
  └──────────────┴────────────┴──────────────┘

Broadcasting (Hub → States):
  ┌──────────────┬────────────┬──────────────┐
  │ Channel      │ Users      │ Bandwidth    │
  ├──────────────┼────────────┼──────────────┤
  │ WebSocket    │ 50,000     │ 250 MB/s     │
  │ REST API     │ Varies     │ 50 MB/s      │
  │ Federation   │ 50 states  │ 5 MB/s       │
  ├──────────────┼────────────┼──────────────┤
  │ Total        │            │ ~300 MB/s    │
  └──────────────┴────────────┴──────────────┘

Peak Traffic:
  - Normal: 300 MB/s (~2.4 Gbps)
  - Disaster: 10x spike → 3 GB/s (~24 Gbps)
  - Provision: 10 Gbps links with 50 Gbps burst capacity

Regional Hub Distribution:
  - Each hub: 60 MB/s (~480 Mbps)
  - 5 hubs: Same total (300 MB/s) but distributed
  - Benefit: Lower latency, better disaster recovery
```

---

## Security Architecture

### Trust Boundaries

```
┌────────────────────────────────────────────────────────────────────┐
│                        Trust Zones                                 │
└────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                  Zone 1: State DOT Internal                      │
│  Trust Level: VERIFIED_STATE (Level 5)                           │
│  - Authenticated state operators                                 │
│  - Signed requests (mTLS + HTTP signatures)                      │
│  - Full data access (including sensitive events)                 │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     │ mTLS + OAuth 2.0 + HTTP Signatures
                     │
┌────────────────────▼─────────────────────────────────────────────┐
│              Zone 2: Federation Network                          │
│  Trust Level: REGIONAL_HUB / FEDERATED_PEER (Level 3-4)        │
│  - Regional hubs (consortium operated)                           │
│  - Peer state hubs (bilateral agreements)                        │
│  - Signed requests, public key verification                      │
│  - Privacy-filtered data (no PII)                                │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     │ API Keys + Rate Limiting
                     │
┌────────────────────▼─────────────────────────────────────────────┐
│            Zone 3: Commercial Vendors                            │
│  Trust Level: VENDOR (Level 2)                                   │
│  - Verified commercial vendors (Waze, Here, TomTom)              │
│  - API key authentication                                        │
│  - Rate limited (100 req/min)                                    │
│  - Sanitized data (reduced precision, no PII)                    │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     │ Public API (read-only)
                     │
┌────────────────────▼─────────────────────────────────────────────┐
│               Zone 4: Public Access                              │
│  Trust Level: PUBLIC_API (Level 1)                              │
│  - Anonymous users                                               │
│  - Heavily rate limited (10 req/min)                             │
│  - Public events only (no sensitive data)                        │
│  - Cached responses (CDN)                                        │
└──────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
State Operator Login:
┌────────────┐                                           ┌────────────┐
│  Operator  │                                           │    Hub     │
└──────┬─────┘                                           └──────┬─────┘
       │                                                        │
       │ 1. Login Request                                       │
       │    POST /api/auth/login                                │
       │    {email, password}                                   │
       ├───────────────────────────────────────────────────────►│
       │                                                        │
       │ 2. Verify Credentials                                  │
       │    - Check password hash                               │
       │    - Verify MFA code (if enabled)                      │
       │    - Check role permissions                            │
       │                                                        │
       │ 3. Issue JWT                                           │
       │◄───────────────────────────────────────────────────────┤
       │    {token: "eyJhbG...", expiresIn: 3600}               │
       │                                                        │
       │ 4. API Request with Token                              │
       │    GET /api/events?state=IA                            │
       │    Authorization: Bearer eyJhbG...                     │
       ├───────────────────────────────────────────────────────►│
       │                                                        │
       │ 5. Verify JWT                                          │
       │    - Signature valid?                                  │
       │    - Not expired?                                      │
       │    - Has permission for resource?                      │
       │                                                        │
       │ 6. Return Data                                         │
       │◄───────────────────────────────────────────────────────┤
       │    {events: [...]}                                     │
       │                                                        │


Federation Authentication (State-to-State):
┌────────────┐                                           ┌────────────┐
│Iowa Hub    │                                           │Nebraska Hub│
└──────┬─────┘                                                   └──────┬─────┘
       │                                                        │
       │ 1. Sign Request with Private Key                       │
       │    POST /federation/inbox                              │
       │    Signature: keyId="iowa",algorithm="rsa-sha256"      │
       │    Date: Thu, 07 Mar 2026 14:30:00 GMT                 │
       │    Digest: SHA-256=X48E9qOokq...                       │
       ├───────────────────────────────────────────────────────►│
       │                                                        │
       │ 2. Fetch Iowa's Public Key                             │
       │    GET https://iowa.node-platform.gov/keys/main-key    │
       │                                                        │
       │ 3. Verify Signature                                    │
       │    - Reconstruct signature base                        │
       │    - Verify with Iowa's public key                     │
       │    - Check timestamp (< 5 min old)                     │
       │    - Verify digest matches body                        │
       │                                                        │
       │ 4. Accept or Reject                                    │
       │◄───────────────────────────────────────────────────────┤
       │    200 OK {received: true}                             │
       │    or 401 Unauthorized {error: "Invalid signature"}    │
       │                                                        │
```

---

## Failure Scenarios & Resilience

### Scenario 1: Central Hub Failure (Phase 1)

```
Before Failure:
                         ┌──────────┐
                         │ Central  │  ← Single point of failure
                         │   Hub    │
                         └────┬─────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
    │  Iowa   │          │Nebraska │          │Colorado │
    └─────────┘          └─────────┘          └─────────┘

    Result: ALL coordination lost


After Failure (with Multi-Region):
                    ┌──────────┐     ┌──────────┐
                    │ us-east-1│  X  │ us-west-2│  ← Failover
                    └──────────┘     └────┬─────┘
                                          │
         ┌────────────────────────────────┼────────────────────┐
         │                                │                    │
    ┌────▼────┐                      ┌────▼────┐          ┌────▼────┐
    │  Iowa   │                      │Nebraska │          │Colorado │
    └─────────┘                      └─────────┘          └─────────┘

    Result: Service continues (< 2 min downtime)
    RTO: 2 minutes, RPO: 5 minutes
```

### Scenario 2: Regional Hub Failure (Phase 3)

```
Before Failure:
                         ┌──────────┐
                         │ National │
                         │   Hub    │
                         └────┬─────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼────┐          ┌────▼────┐  X       ┌────▼────┐
    │ Midwest │          │ Mountain│ Failure  │Northeast│
    │   Hub   │          │West Hub │          │   Hub   │
    └────┬────┘          └──────────          └────┬────┘
         │                                          │
    Iowa, NE                                   NY, PA


After Failure (Regional Autonomy):
                         ┌──────────┐
                         │ National │  ← Still accessible
                         │   Hub    │
                         └────┬─────┘
                              │
         ┌────────────────────┴────────────────────┐
         │                                         │
    ┌────▼────┐                              ┌────▼────┐
    │ Midwest │  ────────────────────────►   │Northeast│
    │   Hub   │  Bilateral Federation        │   Hub   │
    └────┬────┘                              └────┬────┘
         │                                        │
    Iowa, NE                                  NY, PA

    Result:
      - Mountain West states lose regional hub
      - Can fail over to national hub
      - Or establish bilateral with Midwest hub
      - Midwest and Northeast continue operating
      - Limited impact (only 10 states affected)
```

### Scenario 3: Complete Federation (Phase 4)

```
Normal Operation:
    Iowa ←→ Nebraska ←→ Colorado
      ↕        ↕          ↕
    Kansas ←→ Missouri ←→ Wyoming


After Iowa Failure:
    [IOWA]    Nebraska ←→ Colorado
      X          ↕          ↕
    Kansas ←→ Missouri ←→ Wyoming

    Result:
      - Nebraska, Kansas, Missouri continue operating
      - Iowa's neighbors route around failure
      - National coordination via DHT continues
      - Iowa operators lose access until restore
      - Zero impact to other 49 states


After Multiple Failures:
    [IOWA]    Nebraska ←→ [COLORADO]
      X          ↕          X
    Kansas ←→ Missouri ←→ Wyoming

    Result:
      - Network partitioned but functional
      - Each partition continues operating
      - Events sync when nodes recover
      - Eventual consistency model prevents data loss
      - DHT re-routes around failures automatically
```

### Disaster Recovery Comparison

```
┌────────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│ Scenario       │ Phase 1     │ Phase 2     │ Phase 3     │ Phase 4     │
│                │ Hub-Spoke   │ +Bilateral  │ Regional    │ Full Fed    │
├────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ Central Hub    │ Service     │ Partial     │ Minimal     │ No          │
│ Failure        │ Outage      │ Degradation │ Impact      │ Impact      │
│                │ 2-10 min    │ < 1 min     │ 0 min       │ N/A         │
├────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ Single State   │ State loses │ State loses │ State loses │ State loses │
│ Failure        │ access      │ access, but │ access, but │ access, but │
│                │ 100% loss   │ neighbors   │ region ok   │ peers ok    │
│                │             │ use P2P     │ 0% loss     │ 0% loss     │
├────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ Regional       │ N/A         │ N/A         │ 20% service │ No impact   │
│ Hub Failure    │             │             │ degradation │ route around│
├────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ National       │ Total loss  │ P2P         │ Regional    │ Fully       │
│ Disaster       │ until       │ continues   │ hubs        │ operational │
│ (Cyberattack)  │ restore     │ limited     │ independent │ distributed │
│                │ 24-48 hrs   │ 80% service │ 95% service │ 100% service│
├────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ Data Loss      │ < 5 min     │ < 5 min     │ < 1 min     │ 0 (eventual │
│ (RPO)          │ (multi-AZ)  │ (replicated)│ (regional)  │ consistency)│
└────────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

---

## Summary: Choosing the Right Phase

```
┌────────────────────────────────────────────────────────────────────┐
│           When to Deploy Each Phase                                │
└────────────────────────────────────────────────────────────────────┘

Phase 1: Hub-and-Spoke (NOW → 2027)
  Deploy if:
    ✓ Need rapid rollout (< 2 years)
    ✓ States want simple integration
    ✓ Central funding secured ($10M/year)
    ✓ Priority is emergency response speed

  Don't deploy if:
    ✗ States demand data sovereignty
    ✗ Concerns about vendor lock-in
    ✗ Long-term funding uncertain


Phase 2: Add Bilateral (2027 → 2029)
  Deploy if:
    ✓ Regional coordination is critical
    ✓ States want data sovereignty options
    ✓ Need to reduce central dependencies
    ✓ Preparing for exit strategies

  Don't deploy if:
    ✗ Hub-and-spoke working perfectly
    ✗ No state demand for direct connections
    ✗ Additional complexity not justified


Phase 3: Regional Hubs (2028 → 2030)
  Deploy if:
    ✓ Scale requires distributed operations
    ✓ Want to reduce central costs
    ✓ Regional autonomy is desired
    ✓ Disaster resilience is priority

  Don't deploy if:
    ✗ Less than 30 states participating
    ✗ Regions lack operational capacity
    ✗ Central model working well


Phase 4: Full Federation (2030+)
  Deploy if:
    ✓ Maximum resilience required
    ✓ States want complete sovereignty
    ✓ Central funding uncertain long-term
    ✓ Vendor neutrality is critical

  Don't deploy if:
    ✗ Strong consistency required
    ✗ Central coordination still valuable
    ✗ States lack technical capacity
```

---

**Document End**

This visual guide complements Section 30 of the National Build Specification. For implementation details, see:
- **NATIONAL_BUILD_SPECIFICATION.md** - Section 30
- **RFC-001-federation-protocol.md** - Change proposal
- **README.md** - Quick start guide

**Questions?** Contact the Platform Engineering team or open a GitHub Discussion.
