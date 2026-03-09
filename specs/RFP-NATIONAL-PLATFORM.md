# REQUEST FOR PROPOSAL (RFP)

# National Transportation Platform
## NODE Corridor Communicator - Federal-State Consortium

**RFP Number:** NODE-2026-001
**Issued By:** NODE Platform Consortium (Federal-State Partnership)
**Issue Date:** March 7, 2026
**Pre-Proposal Conference:** March 21, 2026 at 2:00 PM ET (Virtual)
**Questions Due:** April 4, 2026 at 5:00 PM ET
**Proposal Due Date:** May 2, 2026 at 5:00 PM ET
**Anticipated Award Date:** June 15, 2026
**Contract Start Date:** July 1, 2026
**Project Duration:** 24 months (development) + 36 months (operations)

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Procurement Overview](#2-procurement-overview)
3. [Scope of Work](#3-scope-of-work)
4. [Technical Requirements](#4-technical-requirements)
5. [Proposal Submission Requirements](#5-proposal-submission-requirements)
6. [Evaluation Criteria](#6-evaluation-criteria)
7. [Contract Terms](#7-contract-terms)
8. [Vendor Qualifications](#8-vendor-qualifications)
9. [Budget and Funding](#9-budget-and-funding)
10. [Timeline and Milestones](#10-timeline-and-milestones)
11. [Questions and Answers Process](#11-questions-and-answers-process)
12. [Appendices](#12-appendices)

---

## 1. EXECUTIVE SUMMARY

### 1.1 Project Overview

The NODE Platform Consortium, a federal-state partnership led by the U.S. Department of Transportation (USDOT) and 10 founding state Departments of Transportation, seeks qualified vendors to design, develop, deploy, and operate a **National Transportation Coordination Platform** (NODE Corridor Communicator).

**Mission:** Enable real-time, cross-jurisdictional coordination of transportation events (incidents, road work, closures) across all 50 states, improving public safety, reducing congestion, and accelerating emergency response.

**Key Innovation:** Webhook-first architecture with federated interoperability protocol, allowing states to maintain data sovereignty while enabling seamless national coordination.

### 1.2 Project Value

**Total Contract Value:** $9-12 million (development) + $10-12 million/year (operations)
**Funding Sources:**
- USDOT Federal Highway Administration (FHWA) grants: 40%
- State membership dues (40 states committed): 30%
- Commercial API revenue: 20%
- Corporate sponsorships: 10%

**Anticipated Impact:**
- **Lives saved:** 20-30 annually through 18-second IPAWS alert generation (vs. 30 minutes manual)
- **Time savings:** 85% reduction in manual coordination = $500K-2M/year per state
- **Incident reduction:** 25% fewer secondary incidents via predictive AI

### 1.3 What Makes This Unique

1. **Webhook-First Architecture:** Avoids firewall whitelisting issues that plague traditional APIs
2. **Federation Protocol:** States can self-host or use regional hubs (no vendor lock-in)
3. **Human-in-the-Loop AI:** 85% automation with 4-tier confidence model (95%, 80%, 60%, <60%)
4. **FedRAMP Moderate + SOC 2 Type II:** Security compliance baked in from day one
5. **Open Source Core:** Apache 2.0 license ensures transparency and portability

---

## 2. PROCUREMENT OVERVIEW

### 2.1 Contracting Entity

**Primary Contracting Authority:**
NODE Platform Consortium
c/o Iowa Department of Transportation
800 Lincoln Way
Ames, IA 50010

**Contracting Officer:**
[Name], Director of Procurement
Email: procurement@node-platform.gov
Phone: (515) 555-1234

**Technical Point of Contact:**
[Name], Platform Lead
Email: technical@node-platform.gov
Phone: (515) 555-5678

### 2.2 Contract Type

**Primary Contract:** Fixed-Price with Performance Incentives
- Phase 1 (Development): Fixed price with milestone-based payments
- Phase 2 (Operations): Cost-reimbursement with performance incentives tied to SLA achievement

**Contract Ceiling:** $12 million (development) + up to $15 million/year (operations for 3 years)

**Optional Contract Extensions:**
- Two (2) additional 12-month operation periods (Year 4-5) at consortium's discretion
- Pricing for optional years fixed at award with CPI adjustment (max 5% annually)

### 2.3 Procurement Method

**Competitive Best Value Procurement:**
- Technical merit: 60% weight
- Cost/price: 30% weight
- Past performance: 10% weight

**Minimum Score to be Considered for Award:** 75/100 points

### 2.4 Small Business Participation

**Small Business Set-Aside:** None (open competition)

**Small Business Subcontracting Goals:**
- Small business: 30% of contract value
- Small disadvantaged business: 10%
- Women-owned small business: 5%
- Veteran-owned small business: 3%

**Evaluation:** Proposals will receive up to 5 bonus points for exceeding subcontracting goals.

### 2.5 Teaming and Subcontracting

**Teaming Encouraged:** Vendors may submit proposals as joint ventures or prime-subcontractor teams.

**Required Disclosures:**
- Identify prime contractor and all major subcontractors (>10% of contract value)
- Provide teaming agreement or letter of intent
- Specify work breakdown (% of effort, key personnel, deliverables)

**Key Subcontracting Areas:**
- AWS/Cloud infrastructure management
- AI/ML model development
- FedRAMP compliance consulting
- Security operations center (SOC)
- Training materials development

---

## 3. SCOPE OF WORK

### 3.1 Project Phases

#### Phase 1: Development (18 months) - Fixed Price

**Month 1-3: Design & Planning**
- Architecture finalization and security design
- Infrastructure setup (AWS, Kubernetes, CI/CD)
- Database schema implementation
- API design and webhook architecture
- Development environment provisioning

**Deliverables:**
- [ ] System architecture document (updated from specs)
- [ ] Security architecture document (FedRAMP SSP draft)
- [ ] Infrastructure-as-code (Terraform)
- [ ] CI/CD pipeline operational
- [ ] Development environment accessible to 10 pilot state users

**Month 4-12: Core Development**
- RESTful API implementation (all endpoints)
- WebSocket real-time server
- Webhook subscription and delivery service
- Event management (create, update, delete, search)
- Cross-state messaging system
- Geospatial queries (PostGIS)
- Map visualization (Mapbox GL JS)
- User authentication (SSO, RBAC)

**Deliverables:**
- [ ] API fully functional (100% of endpoints in spec)
- [ ] WebSocket server handling 10K concurrent connections
- [ ] Unit test coverage >80%
- [ ] Integration tests for all major workflows
- [ ] API documentation (OpenAPI/Swagger)

**Month 13-18: Advanced Features & Testing**
- Human-in-the-Loop (HITL) automation engine
- Data quality scoring and normalization
- IPAWS alert generation (CAP-IPAWS compliance)
- CV-TIM integration (SAE J2540)
- Truck parking AI/ML model
- Federation protocol implementation
- Load testing (K6 scripts, 50K concurrent users)
- Security testing (penetration test, vulnerability scanning)
- User acceptance testing (UAT) with 5 pilot states

**Deliverables:**
- [ ] HITL automation functional (4-tier confidence)
- [ ] IPAWS alerts generating in <18 seconds
- [ ] Truck parking predictions (>85% accuracy on test set)
- [ ] Load test results (meets SLA: 99.9% uptime, <500ms P95)
- [ ] Penetration test report (all critical/high findings remediated)
- [ ] UAT sign-off from 5 pilot states

**Month 19-24: Pilot Deployment & Go-Live**
- Production infrastructure deployment
- FedRAMP assessment and authorization
- SOC 2 Type II audit
- Pilot state onboarding (10 states)
- Training delivery (administrator + operator certification)
- Hypercare support (24/7 for first 30 days)
- Production launch

**Deliverables:**
- [ ] FedRAMP Authority to Operate (ATO) achieved
- [ ] SOC 2 Type II report issued
- [ ] 10 pilot states live in production
- [ ] 200+ users trained and certified
- [ ] 99.9% uptime achieved in first 30 days

**Phase 1 Acceptance Criteria:**
- All deliverables completed and accepted
- 10 pilot states operational with >80% daily active users
- SLA targets met: 99.9% uptime, <500ms P95 latency, <0.1% error rate
- Security compliance: FedRAMP ATO, SOC 2 Type II
- Customer satisfaction: >4.0/5.0 rating from pilot states

---

#### Phase 2: Operations & Expansion (36 months) - Cost Reimbursement

**Year 1 (Months 25-36):**
- Onboard remaining 40 states (total 50 states)
- 24/7 operations and support
- Monthly feature releases
- Quarterly security assessments
- Annual DR testing
- Performance monitoring and optimization

**Deliverables (Monthly):**
- [ ] Uptime report (target: 99.9%)
- [ ] Performance report (latency, error rates)
- [ ] Support metrics (ticket volume, resolution time)
- [ ] Data quality report (per-state scores)
- [ ] Incident summary (P1/P2 incidents, root cause analysis)

**Deliverables (Quarterly):**
- [ ] New feature releases (2-3 features per quarter)
- [ ] Security assessment report
- [ ] Capacity planning report
- [ ] User satisfaction survey results

**Deliverables (Annually):**
- [ ] SOC 2 Type II audit (renewal)
- [ ] FedRAMP continuous monitoring (ConMon) package
- [ ] Disaster recovery exercise report
- [ ] Platform usage analytics (events created, messages sent, API calls)

**Year 2-3 (Months 37-60):**
- Same as Year 1 with continuous improvement
- Federation protocol rollout (enable P2P state connections)
- Commercial API launch (revenue generation)
- Advanced AI features (predictive incidents, federated learning)

**Phase 2 Acceptance Criteria (Annual Review):**
- 99.9% uptime achieved (no more than 43 minutes downtime/month)
- <500ms P95 latency maintained
- Support SLA met (P1: <15 min, P2: <1 hr)
- All 50 states operational
- Customer satisfaction: >4.2/5.0 rating
- Security compliance maintained (no critical findings)

---

### 3.2 Out of Scope

The following are **NOT** included in this procurement:

1. **State-side infrastructure:** States are responsible for their own webhook endpoints, VPN tunnels, and internal systems integration.

2. **Data procurement from commercial vendors:** Platform will integrate data feeds, but states are responsible for procuring data (e.g., truck parking, CV probes) unless consortium negotiates bulk pricing.

3. **Legal/policy development:** Consortium handles interstate data sharing agreements and governance policies.

4. **Hardware procurement for states:** States provide their own workstations, displays, mobile devices.

5. **Ongoing training after initial certification:** Vendor delivers initial training; consortium handles ongoing training webinars.

6. **Third-party software licenses:** Except for development tools (IDEs, CI/CD), consortium will procure licenses for production software (Mapbox, monitoring tools, etc.).

---

## 4. TECHNICAL REQUIREMENTS

### 4.1 Detailed Technical Specifications

**Complete technical specifications are provided in:**
- **NATIONAL_BUILD_SPECIFICATION.md** (27,815 lines, 36 sections)
- Available at: [Appendix A - Full Technical Specification](#appendix-a)

**Key technical requirements summary:**

#### 4.1.1 Architecture

- **Cloud Platform:** AWS (primary), multi-region deployment
- **Orchestration:** Kubernetes (EKS)
- **Database:** PostgreSQL 15 + PostGIS 3.3, synchronous replication
- **Cache:** Redis 7 for session management and rate limiting
- **Search:** Elasticsearch 8 for full-text search
- **Message Queue:** RabbitMQ or Kafka for webhook delivery
- **CDN:** CloudFront for static asset delivery

#### 4.1.2 API Requirements

- **REST API:** Express.js (Node.js), 100% OpenAPI 3.0 documented
- **WebSocket:** Socket.io for real-time push
- **Webhook Architecture:** HMAC/OAuth2/mTLS authentication, retry logic (exponential backoff)
- **Rate Limiting:** Tiered (60 req/min standard, 300 req/min premium, 1000 req/min enterprise)

**API SLA:**
- P95 latency: <500ms (GET), <800ms (POST)
- P99 latency: <1000ms (GET), <1500ms (POST)
- Throughput: 1000 RPS (reads), 500 RPS (writes)
- Error rate: <0.1%

#### 4.1.3 Frontend Requirements

- **Framework:** React 18 + TypeScript 5.0+
- **State Management:** Zustand (lightweight, no Redux)
- **Server State:** TanStack Query (React Query)
- **Mapping:** Mapbox GL JS
- **UI Components:** Tailwind CSS + shadcn/ui
- **Build Tool:** Vite or Next.js

**Performance:**
- First Contentful Paint (FCP): <1.5 seconds
- Time to Interactive (TTI): <3.5 seconds
- Lighthouse score: >90

#### 4.1.4 Mobile App Requirements

- **Strategy:** PWA-first (not native iOS/Android)
- **Offline Support:** Service Workers, IndexedDB caching
- **Push Notifications:** Web Push API (iOS 16.4+, Android)
- **Installability:** Meets PWA criteria (manifest, service worker, HTTPS)

#### 4.1.5 Security Requirements

**Compliance (MANDATORY):**
- **FedRAMP Moderate** - Authority to Operate (ATO) required before production launch
- **SOC 2 Type II** - Audit required annually
- **NIST 800-53** - All controls implemented and documented

**Encryption:**
- TLS 1.3 (minimum TLS 1.2) for data in transit
- AES-256 for data at rest
- Key management via AWS KMS (FIPS 140-2 Level 2)

**Authentication:**
- SAML 2.0 SSO integration (Okta, Azure AD, Auth0)
- OAuth 2.0 for API access
- Multi-factor authentication (MFA) required for admins

**Audit Logging:**
- All API calls logged (user, timestamp, action, result)
- Logs retained 7 years (FHWA compliance)
- SIEM integration (Splunk or similar)

#### 4.1.6 Performance Requirements

**Load Testing (Vendor Responsibility):**
- 50,000 concurrent WebSocket connections
- 5,000 events/second processing
- 1,000 RPS sustained API load
- Database queries: <50ms P95

**Chaos Engineering:**
- Automated failure injection testing (Chaos Mesh)
- Quarterly DR drills (full region failover)
- Results documented and shared with consortium

#### 4.1.7 Data Requirements

**Standards Compliance:**
- **WZDX 4.2** (Work Zone Data Exchange) - 100% compliant
- **TMDD 3.0** (Traffic Management Data Dictionary) - 100% compliant
- **CAP-IPAWS** (Common Alerting Protocol) - 100% compliant
- **SAE J2540** (CV-TIM) - 85% field coverage (up from 40%)

**Data Quality:**
- Automated quality scoring (0-100 scale, 5 dimensions)
- Target: >80 average score across all states
- Automated gap detection and alerting
- Data normalization pipeline (vendor develops)

---

### 4.2 Hosting and Infrastructure

#### 4.2.1 Cloud Provider

**Primary:** Amazon Web Services (AWS)
**Regions:** Multi-region deployment required
- **Primary:** us-east-1 (Virginia)
- **Secondary (DR):** us-west-2 (Oregon)
- **Edge Caching:** CloudFront (global)

**Rationale:** AWS FedRAMP High authorization, USDOT existing relationship, cost-effectiveness.

**Alternative Cloud Providers:**
- Vendor may propose Azure or Google Cloud if they can demonstrate:
  - FedRAMP High authorization
  - Equivalent cost (±10% of AWS)
  - Superior performance or features
  - Smooth migration path if consortium chooses to switch

#### 4.2.2 Infrastructure-as-Code

**Required:** All infrastructure must be defined as code (IaC)
- **Tool:** Terraform (preferred) or AWS CloudFormation
- **Version Control:** Git (GitHub or GitLab)
- **Deployment:** GitOps workflow (ArgoCD or Flux)

**Deliverable:** Complete IaC repository that consortium can use to redeploy platform independently.

#### 4.2.3 Cost Management

**Monthly Infrastructure Budget Target:** $15,000-25,000/month (50 states operational)

**Vendor Responsibility:**
- Optimize costs (rightsizing, reserved instances, spot instances)
- Monthly cost reports with optimization recommendations
- Forecast future costs based on growth projections

**Consortium Responsibility:**
- Pays actual AWS bills directly (or vendor passes through at cost)
- Reviews and approves cost optimization recommendations

---

### 4.3 Disaster Recovery

**RTO (Recovery Time Objective):** <1 hour
**RPO (Recovery Point Objective):** <5 minutes

**Requirements:**
- Automated failover to secondary region
- Continuous database replication (streaming replication)
- Cross-region S3 replication for file storage
- Quarterly DR drills (full failover test)
- Annual comprehensive DR exercise (simulated data center loss)

**Deliverables:**
- Disaster Recovery Plan document
- Runbooks for failover procedures
- DR test reports (quarterly)

---

## 5. PROPOSAL SUBMISSION REQUIREMENTS

### 5.1 Proposal Format

**Page Limits:**
- Executive Summary: 2 pages
- Technical Approach: 30 pages
- Management Plan: 15 pages
- Past Performance: 10 pages
- Cost Proposal: 10 pages
- Appendices: No limit

**Formatting:**
- 11-point font minimum (Times New Roman, Arial, or Calibri)
- 1-inch margins
- Single-spaced
- Pages numbered
- PDF format only

### 5.2 Required Proposal Sections

#### Volume I: Technical Proposal

**Section 1: Executive Summary (2 pages)**
- Company overview
- Understanding of project objectives
- Key differentiators
- Summary of qualifications

**Section 2: Technical Approach (30 pages)**

**2.1 Architecture & Design (10 pages)**
- Proposed system architecture (diagram required)
- Technology stack and rationale
- Webhook-first implementation approach
- Federation protocol design
- Deviations from specification (if any, with justification)

**2.2 Development Methodology (5 pages)**
- Agile/Scrum process
- Sprint cadence and duration
- Version control and branching strategy
- Code review process
- QA and testing approach

**2.3 Security & Compliance (5 pages)**
- FedRAMP compliance approach and timeline
- SOC 2 Type II audit plan
- NIST 800-53 control implementation
- Penetration testing strategy
- Security operations center (SOC) design

**2.4 AI/ML Implementation (5 pages)**
- Human-in-the-Loop (HITL) automation architecture
- Truck parking prediction model approach
- Data quality ML model design
- Predictive incident detection approach
- Federated learning strategy (optional)

**2.5 Performance & Scalability (5 pages)**
- Load testing approach (50K users, 5K events/sec)
- Database query optimization strategy
- Caching strategy
- WebSocket scalability design
- Chaos engineering plan

**Section 3: Management Plan (15 pages)**

**3.1 Project Organization (5 pages)**
- Organizational chart
- Key personnel (resumes in appendix)
- Roles and responsibilities (RACI matrix)
- Communication plan
- Escalation procedures

**3.2 Work Breakdown Structure (5 pages)**
- WBS to Level 3 (Gantt chart required)
- Critical path analysis
- Milestones and deliverables
- Dependencies and risks

**3.3 Quality Assurance (5 pages)**
- QA plan and procedures
- Acceptance testing approach
- Defect tracking and resolution
- Continuous improvement process

**Section 4: Past Performance (10 pages)**

**4.1 Relevant Experience (8 pages)**

Provide 3-5 past performance references for similar projects:
- **Project Name:** [Name]
- **Client:** [Organization and POC with phone/email]
- **Contract Value:** $[Amount]
- **Period of Performance:** [Start] - [End]
- **Project Description:** [2-3 paragraphs describing project]
- **Relevance:** [How this project demonstrates capability for NODE platform]
- **Outcomes:** [Quantitative results: uptime %, performance metrics, customer satisfaction]
- **Challenges:** [Key challenges faced and how resolved]

**Required Relevance Areas (at least 3 of 5 projects must demonstrate):**
- Real-time geospatial systems (mapping, event management)
- FedRAMP Moderate or High systems
- Multi-tenant SaaS platforms
- AI/ML implementation in production
- WebSocket/real-time push architecture

**4.2 Key Personnel Experience (2 pages)**
- Past performance of proposed key personnel
- Certifications (AWS, Kubernetes, Security+, CISSP, etc.)
- Publications or speaking engagements

**Section 5: Subcontracting Plan (if applicable)**
- List of all subcontractors (>10% of contract value)
- Teaming agreement or letter of intent
- Work breakdown by subcontractor
- Small business subcontracting plan

---

#### Volume II: Cost Proposal

**Section 1: Price Summary (1 page)**

| Phase | Duration | Fixed Price | Cost Reimbursement | Total |
|-------|----------|-------------|-------------------|-------|
| **Development** | 24 months | $[Amount] | N/A | $[Amount] |
| **Operations (Year 1)** | 12 months | N/A | $[Amount] | $[Amount] |
| **Operations (Year 2)** | 12 months | N/A | $[Amount] | $[Amount] |
| **Operations (Year 3)** | 12 months | N/A | $[Amount] | $[Amount] |
| **Optional Year 4** | 12 months | N/A | $[Amount] | $[Amount] |
| **Optional Year 5** | 12 months | N/A | $[Amount] | $[Amount] |
| **TOTAL (Base + 3 years operations)** | | | | **$[Amount]** |

**Section 2: Detailed Cost Breakdown (5 pages)**

**2.1 Labor Costs**

| Role | Hourly Rate | Hours (Phase 1) | Phase 1 Cost | Hours/Month (Phase 2) | Monthly Cost (Phase 2) |
|------|-------------|-----------------|--------------|----------------------|----------------------|
| Platform Lead | $[Rate] | [Hrs] | $[Amount] | [Hrs] | $[Amount] |
| Senior Engineer | $[Rate] | [Hrs] | $[Amount] | [Hrs] | $[Amount] |
| DevOps Engineer | $[Rate] | [Hrs] | $[Amount] | [Hrs] | $[Amount] |
| Data Engineer | $[Rate] | [Hrs] | $[Amount] | [Hrs] | $[Amount] |
| QA Engineer | $[Rate] | [Hrs] | $[Amount] | [Hrs] | $[Amount] |
| Security Engineer | $[Rate] | [Hrs] | $[Amount] | [Hrs] | $[Amount] |
| UI/UX Designer | $[Rate] | [Hrs] | $[Amount] | [Hrs] | $[Amount] |
| Technical Writer | $[Rate] | [Hrs] | $[Amount] | [Hrs] | $[Amount] |
| Project Manager | $[Rate] | [Hrs] | $[Amount] | [Hrs] | $[Amount] |
| **Subtotal Labor** | | | **$[Amount]** | | **$[Amount]/month** |

**2.2 Infrastructure Costs**

| Item | Monthly Cost | Phase 1 (24 mo) | Phase 2 (12 mo/yr) |
|------|--------------|-----------------|-------------------|
| AWS Compute (EKS) | $[Amount] | $[Amount] | $[Amount] |
| AWS Database (RDS) | $[Amount] | $[Amount] | $[Amount] |
| AWS Storage (S3) | $[Amount] | $[Amount] | $[Amount] |
| AWS Networking | $[Amount] | $[Amount] | $[Amount] |
| CloudFront (CDN) | $[Amount] | $[Amount] | $[Amount] |
| Monitoring Tools | $[Amount] | $[Amount] | $[Amount] |
| **Subtotal Infrastructure** | **$[Amount]/mo** | **$[Amount]** | **$[Amount]/year** |

**2.3 Third-Party Software Licenses**

| Software | Purpose | Annual Cost |
|----------|---------|-------------|
| Mapbox | Mapping | $[Amount] |
| Datadog/New Relic | Monitoring | $[Amount] |
| PagerDuty | On-call alerting | $[Amount] |
| GitHub Enterprise | Version control | $[Amount] |
| **Subtotal Licenses** | | **$[Amount]/year** |

**2.4 Other Direct Costs (ODCs)**

| Item | Cost |
|------|------|
| FedRAMP 3PAO Assessment | $[Amount] (one-time) |
| SOC 2 Type II Audit | $[Amount]/year |
| Penetration Testing | $[Amount]/year |
| Training Materials Development | $[Amount] (one-time) |
| Travel (onsite visits to states) | $[Amount]/year |
| **Subtotal ODCs** | **$[Amount]** |

**2.5 Indirect Costs**

| Item | Rate | Calculation | Amount |
|------|------|-------------|--------|
| Overhead | [X]% | Labor × [Rate] | $[Amount] |
| G&A | [X]% | (Labor + Overhead) × [Rate] | $[Amount] |
| Fee/Profit | [X]% | (Labor + Overhead + G&A) × [Rate] | $[Amount] |
| **Subtotal Indirect** | | | **$[Amount]** |

**Section 3: Cost Narrative (3 pages)**
- Explanation of labor rates and basis of estimate
- Infrastructure cost assumptions (e.g., 50 states, 50K users)
- Cost optimization strategies
- Assumptions and exclusions
- Risk mitigation for cost overruns

**Section 4: Payment Schedule (1 page)**

**Phase 1 (Development) - Milestone-Based Payments:**

| Milestone | Deliverable | % of Phase 1 | Payment |
|-----------|-------------|--------------|---------|
| Kickoff | Contract signed, infrastructure setup | 10% | $[Amount] |
| Design Complete | Architecture docs, security design | 15% | $[Amount] |
| Core API Complete | All REST/WebSocket endpoints functional | 25% | $[Amount] |
| Advanced Features Complete | HITL, ML models, IPAWS | 20% | $[Amount] |
| Pilot Launch | 5 states live, UAT passed | 15% | $[Amount] |
| Production Launch | 10 states live, FedRAMP ATO, final acceptance | 15% | $[Amount] |

**Phase 2 (Operations) - Monthly Invoicing:**
- Invoice submitted by 5th of each month for previous month's work
- Payment within 30 days of invoice approval
- Performance incentives applied (see Section 7.3)

---

### 5.3 Submission Instructions

**Electronic Submission Required:**

**Email Submission:**
- To: proposals@node-platform.gov
- CC: technical@node-platform.gov
- Subject: "RFP NODE-2026-001 Proposal - [Company Name]"
- Attachments:
  - Volume I (Technical) - single PDF
  - Volume II (Cost) - single PDF
  - Resumes, certifications, letters of intent - single ZIP file

**Deadline:** May 2, 2026 at 5:00 PM Eastern Time

**Late Proposals:** Will NOT be accepted. Vendor is responsible for ensuring timely delivery. Submit early to account for technical issues.

**File Size Limit:** 50 MB per attachment. If larger, use file sharing service (Google Drive, Dropbox) with link in email.

**Confirmation:** Vendors will receive email confirmation of receipt within 1 business day. If no confirmation received, contact procurement@node-platform.gov.

---

## 6. EVALUATION CRITERIA

### 6.1 Evaluation Process

**Phase 1: Compliance Check**
- Proposal reviewed for completeness and adherence to RFP requirements
- Non-compliant proposals may be rejected without scoring

**Phase 2: Technical Evaluation**
- Technical evaluation team scores proposals (60 points max)
- Cost evaluation team scores cost proposals (30 points max)
- Past performance team scores references (10 points max)

**Phase 3: Oral Presentations (if needed)**
- Top 3-5 vendors invited for 2-hour technical presentations and demos
- Q&A with evaluation team
- May adjust scores based on presentation

**Phase 4: Best and Final Offer (BAFO)**
- Top 2-3 vendors may be invited to submit revised cost proposals
- One round only, no negotiations after BAFO

**Phase 5: Award Decision**
- Consortium board reviews evaluation team recommendation
- Award decision communicated to all vendors
- 30-day debriefing period for unsuccessful vendors

---

### 6.2 Scoring Criteria

**Total Points: 100**

#### Technical Approach (60 points)

**Factor 1: Architecture & Design (15 points)**
- Adherence to specification (webhook-first, federation protocol)
- Technical soundness and feasibility
- Scalability to 50 states, 50K users
- Innovation and best practices

**Scoring:**
- **Outstanding (13-15 pts):** Fully compliant with spec, innovative enhancements, proven architecture patterns
- **Good (10-12 pts):** Compliant with spec, sound approach, some innovations
- **Acceptable (7-9 pts):** Mostly compliant, few concerns, standard approach
- **Marginal (4-6 pts):** Some compliance issues, technical concerns, unclear approach
- **Unacceptable (0-3 pts):** Non-compliant, major technical flaws

**Factor 2: Security & Compliance (15 points)**
- FedRAMP compliance approach and timeline
- SOC 2 Type II audit plan
- Security architecture (encryption, RBAC, audit logging)
- Vendor's existing FedRAMP/SOC 2 experience

**Scoring:**
- **Outstanding (13-15 pts):** FedRAMP ATO <12 months, strong security architecture, team has achieved ATO 3+ times
- **Good (10-12 pts):** FedRAMP ATO <18 months, solid security architecture, team has achieved ATO 1-2 times
- **Acceptable (7-9 pts):** FedRAMP ATO <24 months (acceptable), adequate security, team new to FedRAMP but partnered with 3PAO
- **Marginal (4-6 pts):** Unrealistic FedRAMP timeline, weak security architecture
- **Unacceptable (0-3 pts):** No FedRAMP plan, major security gaps

**Factor 3: AI/ML Implementation (10 points)**
- HITL automation approach (4-tier confidence model)
- Truck parking prediction model (>85% accuracy)
- Data quality ML model
- Team's AI/ML expertise

**Scoring:**
- **Outstanding (9-10 pts):** Sophisticated ML approach, clear path to >85% accuracy, team has deployed production ML systems
- **Good (7-8 pts):** Solid ML approach, reasonable accuracy expectations, team has ML experience
- **Acceptable (5-6 pts):** Basic ML approach, may meet accuracy goals, team learning ML
- **Marginal (3-4 pts):** Unclear ML approach, low confidence in accuracy
- **Unacceptable (0-2 pts):** No ML experience, unrealistic approach

**Factor 4: Performance & Scalability (10 points)**
- Load testing plan (50K users, 5K events/sec)
- Database optimization strategy
- WebSocket scalability
- Chaos engineering plan

**Scoring:**
- **Outstanding (9-10 pts):** Comprehensive load testing plan, proven scalability patterns, automated chaos engineering
- **Good (7-8 pts):** Solid load testing plan, reasonable scalability approach, manual chaos testing
- **Acceptable (5-6 pts):** Basic load testing, standard scalability, limited chaos testing
- **Marginal (3-4 pts):** Weak load testing plan, scalability concerns
- **Unacceptable (0-2 pts):** No load testing plan, will not scale

**Factor 5: Management & Execution (10 points)**
- Project organization and team qualifications
- Work breakdown structure and schedule
- Risk management
- QA plan

**Scoring:**
- **Outstanding (9-10 pts):** Strong PM, realistic schedule, comprehensive risk management, mature QA process
- **Good (7-8 pts):** Experienced PM, reasonable schedule, good risk management, solid QA
- **Acceptable (5-6 pts):** Adequate PM, tight schedule, basic risk management, standard QA
- **Marginal (3-4 pts):** Weak PM, unrealistic schedule, poor risk management
- **Unacceptable (0-2 pts):** Unqualified PM, impossible schedule, no risk plan

---

#### Cost/Price (30 points)

**Formula:**
```
Cost Score = (Lowest Evaluated Price / Vendor's Price) × 30 points
```

**Example:**
- Vendor A: $10M → Lowest price → 30 points
- Vendor B: $12M → ($10M / $12M) × 30 = 25 points
- Vendor C: $15M → ($10M / $15M) × 30 = 20 points

**Cost Realism Analysis:**
- Consortium will review cost proposals for realism
- Unrealistically low prices may be rejected
- Vendor may be asked to justify costs

---

#### Past Performance (10 points)

**Factor: Relevant Experience**

**Scoring (per reference, averaged):**
- **Outstanding (9-10 pts):** Highly relevant project, exemplary performance, strong client reference
- **Good (7-8 pts):** Relevant project, good performance, positive client reference
- **Acceptable (5-6 pts):** Somewhat relevant, satisfactory performance, neutral client reference
- **Marginal (3-4 pts):** Limited relevance, performance issues noted, lukewarm reference
- **Unacceptable (0-2 pts):** Not relevant, poor performance, negative reference

**Consortium will contact references directly to verify:**
- Contract value and scope
- Schedule performance (on time?)
- Cost performance (within budget?)
- Quality of deliverables
- Responsiveness and communication
- Would you hire this vendor again?

---

### 6.3 Bonus Points (up to 10 additional points)

**Small Business Subcontracting (up to 5 points):**
- Exceeds 30% small business goal: +2 points
- Exceeds 10% small disadvantaged business goal: +1 point
- Exceeds 5% women-owned small business goal: +1 point
- Exceeds 3% veteran-owned small business goal: +1 point

**Open Source Contribution (up to 3 points):**
- Vendor commits to releasing 100% of code as Apache 2.0 open source: +3 points
- Vendor commits to releasing 50%+ as open source: +1 point

**Carbon Neutrality (up to 2 points):**
- Vendor's operations are carbon neutral (certified): +2 points
- Vendor commits to using 100% renewable energy for platform hosting: +1 point

**Maximum Total Score: 110 points (100 base + 10 bonus)**

---

## 7. CONTRACT TERMS

### 7.1 Contract Type and Structure

**Phase 1 (Development): Firm-Fixed-Price (FFP)**
- Total price fixed at award
- Payments tied to milestones (see Section 5.2.4)
- No cost overruns passed to consortium
- Change orders require consortium approval

**Phase 2 (Operations): Cost-Plus-Fixed-Fee (CPFF) with Performance Incentives**
- Vendor bills actual costs (labor, infrastructure, ODCs) + fixed fee
- Costs reviewed monthly for reasonableness
- Performance incentives based on SLA achievement (see 7.3)
- Fee adjusted based on performance (+/-20% of base fee)

### 7.2 Payment Terms

**Phase 1 Milestone Payments:**
- Invoice submitted within 5 days of milestone completion
- Consortium reviews deliverables (15-day review period)
- Payment within 30 days of acceptance
- Consortium may withhold payment for incomplete/non-conforming deliverables

**Phase 2 Monthly Invoicing:**
- Invoice submitted by 5th of each month for previous month
- Must include: labor hours by role, infrastructure costs, ODCs, receipts
- Consortium reviews for reasonableness (10-day review)
- Payment within 30 days of approval

**Retainage:**
- 10% of Phase 1 payments withheld until final acceptance
- Retainage released 30 days after final acceptance (assuming no defects)

### 7.3 Performance Incentives (Phase 2)

**Base Monthly Fee:** $[Amount] (vendor proposes)

**Performance Incentive Structure:**

| SLA Metric | Target | Award Fee |
|------------|--------|-----------|
| **Uptime** | 99.9% | +5% of monthly fee |
| **API Latency (P95)** | <500ms | +3% of monthly fee |
| **Support SLA (P1)** | <15 min response | +3% of monthly fee |
| **Customer Satisfaction** | >4.2/5.0 (quarterly survey) | +5% of monthly fee |
| **Security Compliance** | Zero critical/high findings in quarterly scan | +4% of monthly fee |

**Maximum Award Fee:** +20% of monthly fee (if all SLAs exceeded)

**Penalties for Non-Performance:**

| SLA Violation | Penalty |
|--------------|---------|
| Uptime <99.0% | -10% of monthly fee |
| API Latency P95 >1000ms | -5% of monthly fee |
| Support SLA P1 >30 min | -5% of monthly fee |
| Customer Satisfaction <3.5/5.0 | -5% of monthly fee |
| Critical security finding not remediated in 7 days | -10% of monthly fee |

**Maximum Penalty:** -20% of monthly fee

**Net Effect:** Monthly fee can range from 80% to 120% of base fee.

### 7.4 Service Level Agreements (SLAs)

**Uptime: 99.9%** (43.2 minutes allowed downtime per month)
- Measured by Pingdom (third-party) + internal monitoring
- Excludes scheduled maintenance (max 4 hours/month, off-peak)
- SLA credit: 10% of monthly fee if 99.0-99.9%, 25% if <99.0%

**API Performance:**
- P95 latency <500ms (GET), <800ms (POST)
- P99 latency <1000ms (GET), <1500ms (POST)
- Error rate <0.1%
- SLA credit: 5% of monthly fee if violated 2+ times per month

**Support Response Times:**
- P1 (Critical): <15 minutes, 24/7
- P2 (High): <1 hour, 24/7
- P3 (Medium): <4 hours, business hours
- P4 (Low): <24 hours, business hours
- SLA credit: 5% of monthly fee if P1/P2 SLA missed 3+ times per quarter

**Disaster Recovery:**
- RTO: <1 hour
- RPO: <5 minutes
- SLA credit: 25% of monthly fee if DR test fails

### 7.5 Intellectual Property

**Work Product Ownership:**
- All work product (code, documentation, designs) belongs to consortium
- Vendor retains no rights to deliverables
- Consortium may use, modify, distribute work product without restriction

**Open Source License:**
- Consortium will release core platform code as Apache 2.0 open source
- States may self-host and modify without license fees
- Vendor agrees to open source release (no objection)

**Pre-Existing IP:**
- Vendor may use pre-existing libraries/frameworks (with consortium approval)
- Pre-existing IP remains vendor's property
- Vendor grants consortium perpetual, irrevocable license to use pre-existing IP

**Third-Party Software:**
- Vendor must disclose all third-party software and licenses
- No GPL or other copyleft licenses (Apache 2.0, MIT, BSD acceptable)
- Consortium approves all third-party dependencies

### 7.6 Warranties

**Performance Warranty:**
- Vendor warrants platform will meet all requirements in specification
- Warranty period: 90 days after final acceptance (Phase 1)
- Vendor will fix defects at no cost during warranty period

**Code Quality Warranty:**
- Code will be free of critical security vulnerabilities (OWASP Top 10)
- Code will meet industry best practices (OWASP ASVS Level 2)
- Unit test coverage >80%, integration test coverage >60%

**Uptime Warranty:**
- 99.9% uptime during Phase 2 (operations)
- SLA credits apply for violations

**No Other Warranties:**
- No implied warranties of merchantability or fitness
- Consortium accepts platform "as-is" after warranty period

### 7.7 Liability and Indemnification

**Liability Cap:**
- Vendor's total liability limited to contract value
- Exception: No cap for gross negligence, willful misconduct, or IP infringement

**Indemnification:**
- Vendor indemnifies consortium against third-party IP claims
- Vendor indemnifies consortium against data breaches caused by vendor negligence
- Consortium indemnifies vendor against claims arising from consortium's actions

**Insurance Requirements:**
- Commercial General Liability: $2 million per occurrence
- Professional Liability (E&O): $5 million per claim
- Cyber Liability: $10 million per claim
- Workers' Compensation: Statutory limits
- Certificates of insurance provided before contract start

### 7.8 Termination

**Termination for Convenience (Consortium):**
- Consortium may terminate anytime with 60 days written notice
- Vendor paid for work completed through termination date
- Vendor delivers all work product (including partial/incomplete)

**Termination for Cause:**
- Either party may terminate for material breach
- 30-day cure period after written notice
- If not cured, immediate termination
- Consortium entitled to damages

**Termination for Non-Appropriation (Government Contracting):**
- If federal/state funding not appropriated, consortium may terminate
- No penalty to consortium
- Vendor paid for work completed

**Transition Assistance:**
- Vendor provides 90-day transition assistance to new vendor or consortium
- Knowledge transfer, documentation, access to systems
- Transition assistance at 50% of normal hourly rates

---

## 8. VENDOR QUALIFICATIONS

### 8.1 Minimum Qualifications (Go/No-Go)

Vendors must meet ALL of the following to be considered:

**1. Financial Stability**
- In business for at least 3 years
- Annual revenue of at least $5 million
- Dun & Bradstreet credit score of at least 70 (low risk)
- Provide audited financial statements for last 2 years

**2. Technical Capability**
- Team includes at least 2 engineers with AWS certifications (Solutions Architect or DevOps Engineer)
- Team includes at least 1 engineer with Kubernetes certification (CKA or CKAD)
- Team includes at least 1 security professional with CISSP or equivalent
- Team has successfully deployed at least 1 FedRAMP Moderate or High system (reference required)

**3. Past Performance**
- Completed at least 2 projects >$2 million in last 5 years
- No contract terminations for cause in last 5 years
- Average customer satisfaction rating >3.5/5.0 (based on references)

**4. Bonding Capability (if required)**
- Ability to obtain performance bond (100% of Phase 1 contract value)
- Ability to obtain payment bond (100% of Phase 1 contract value)

**Failure to meet any minimum qualification = automatic rejection**

### 8.2 Key Personnel Requirements

**Vendor must propose the following key personnel:**

**1. Platform Lead / Technical Lead**
- 10+ years software engineering experience
- 5+ years leading teams of 10+ engineers
- Experience with real-time geospatial systems
- AWS Solutions Architect Professional certification (or equivalent)

**2. Project Manager**
- 7+ years project management experience
- PMP or Agile/Scrum Master certification
- Experience managing $5M+ projects
- Experience with federal/state government contracts

**3. Security Lead**
- 5+ years security engineering experience
- CISSP, CISM, or CEH certification
- Experience achieving FedRAMP ATO (at least 1 system)
- NIST 800-53 expertise

**4. DevOps Lead**
- 5+ years DevOps experience
- Kubernetes certification (CKA or CKAD)
- Terraform or CloudFormation expertise
- Experience with CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins)

**5. Data Engineer / ML Lead (for AI features)**
- 5+ years data engineering or ML engineering experience
- Experience with production ML systems
- Python, TensorFlow/PyTorch, or scikit-learn expertise
- Experience with geospatial data (PostGIS, GIS tools)

**Key Personnel Substitution:**
- Key personnel may not be removed/replaced without consortium approval
- Proposed substitute must have equal or greater qualifications
- Consortium has 10 days to approve or reject substitute

**Resume Requirements:**
- Include in proposal appendix
- Max 2 pages per person
- Must include: Education, certifications, relevant project experience (with client references)

---

## 9. BUDGET AND FUNDING

### 9.1 Available Funding

**Total Funding Available:** $12 million (Phase 1 development) + $36 million (Phase 2 operations, 3 years)

**Funding Sources:**

**Phase 1 (Development):**
- FHWA ATCMTD Grant: $5 million (awarded)
- FHWA Advanced Transportation Technology & Innovation (ATTI): $3 million (applied, 90% confidence)
- State consortium contributions: $4 million (committed by 10 founding states)

**Phase 2 (Operations):**
- State membership dues: $5 million/year (40 states at $100-150K/year)
- Commercial API revenue: $3 million/year (projected, ramps up over 3 years)
- Federal grants: $2 million/year (FHWA ongoing funding)
- Sponsorships: $1 million/year (industry partners)

**Budget Ceiling:** $15 million (Phase 1) + $15 million/year (Phase 2)
- Proposals exceeding budget ceiling will be deemed non-responsive

### 9.2 Cost Constraints

**Phase 1 Development:**
- Target: $9-12 million
- Maximum: $15 million (hard ceiling)

**Phase 2 Operations:**
- Target: $10-12 million/year
- Maximum: $15 million/year (hard ceiling)

**Infrastructure Costs (Phase 2):**
- Target: $15,000-25,000/month ($180K-300K/year)
- Vendor responsible for optimizing costs
- Consortium pays AWS bills directly or vendor passes through at cost (no markup)

### 9.3 Payment Schedule and Funding Availability

**Phase 1:**
- Funded via federal grant + state contributions
- Funding available on contract start date (July 1, 2026)
- Milestone payments as work is completed (see Section 5.2.4)

**Phase 2:**
- Funded annually via state dues + commercial revenue
- Funding subject to annual appropriation
- 90-day termination clause if funding not available (no penalty to consortium)

### 9.4 Cost Sharing (if applicable)

**Not Required:** Consortium is not requiring cost sharing from vendor.

**Optional:** Vendor may propose cost sharing (e.g., waiving fee for Phase 1) to improve competitiveness.
- Cost sharing will be considered in evaluation (positive factor)
- Must be clearly identified in cost proposal

---

## 10. TIMELINE AND MILESTONES

### 10.1 Procurement Schedule

| Activity | Date |
|----------|------|
| **RFP Issued** | March 7, 2026 |
| **Pre-Proposal Conference** (Zoom) | March 21, 2026 at 2:00 PM ET |
| **Questions Due** | April 4, 2026 at 5:00 PM ET |
| **Answers Posted** | April 11, 2026 |
| **Proposals Due** | May 2, 2026 at 5:00 PM ET |
| **Technical Evaluation** | May 3-20, 2026 |
| **Oral Presentations** (if needed) | May 23-27, 2026 |
| **Best and Final Offers** (if needed) | June 5, 2026 at 5:00 PM ET |
| **Award Decision** | June 15, 2026 |
| **Debriefings** | June 16-30, 2026 (upon request) |
| **Contract Execution** | July 1, 2026 |
| **Project Kickoff** | July 8, 2026 |

### 10.2 Project Milestones (Phase 1)

| Milestone | Target Date | Deliverables |
|-----------|-------------|--------------|
| **M1: Project Kickoff** | July 8, 2026 | Kickoff meeting, project plan |
| **M2: Design Complete** | September 30, 2026 | Architecture docs, security design, IaC setup |
| **M3: Core API Complete** | March 31, 2027 | REST API, WebSocket, database, auth |
| **M4: Advanced Features Complete** | September 30, 2027 | HITL, ML models, IPAWS, CV-TIM |
| **M5: Pilot Launch** | January 31, 2028 | 5 states live, UAT passed |
| **M6: Production Launch** | June 30, 2028 | 10 states live, FedRAMP ATO, final acceptance |

**Total Phase 1 Duration:** 24 months (July 1, 2026 - June 30, 2028)

### 10.3 State Onboarding Schedule (Phase 1 & 2)

| Period | States Onboarded | Cumulative Total |
|--------|------------------|------------------|
| **Pilot (Phase 1)** | Iowa, Nebraska, Missouri, Illinois, Minnesota | 5 states |
| **Wave 1 (Phase 1)** | Wisconsin, Indiana, Kansas, South Dakota, Ohio | 10 states |
| **Wave 2 (Year 1)** | 10 states (Great Lakes, Mid-Atlantic) | 20 states |
| **Wave 3 (Year 1)** | 10 states (Southeast, Southwest) | 30 states |
| **Wave 4 (Year 2)** | 10 states (West Coast, Mountain) | 40 states |
| **Wave 5 (Year 2)** | 10 states (Northeast, remaining) | **50 states** |

**Onboarding Cycle:** 8 weeks per state (see Section 35 of technical spec)

---

## 11. QUESTIONS AND ANSWERS PROCESS

### 11.1 Pre-Proposal Conference

**Date:** March 21, 2026 at 2:00 PM Eastern Time
**Format:** Virtual (Zoom)
**Duration:** 2 hours

**Registration Required:**
- Email rsvp@node-platform.gov by March 18, 2026
- Zoom link will be sent to registered attendees

**Agenda:**
1. Consortium overview and project background (15 min)
2. RFP walkthrough and clarifications (30 min)
3. Technical specification overview (30 min)
4. Q&A session (45 min)

**Recording:** Conference will be recorded and posted to procurement website for vendors unable to attend.

**Attendance:** Not mandatory but highly encouraged.

### 11.2 Written Questions

**Deadline:** April 4, 2026 at 5:00 PM Eastern Time

**Submission:**
- Email questions to questions@node-platform.gov
- Subject: "RFP NODE-2026-001 Question - [Company Name]"
- Format: Numbered list, one question per line

**Question Format:**
```
1. [RFP Section Reference] Question text here?
2. [RFP Section Reference] Question text here?
```

**Example:**
```
1. [Section 4.1.2 API Requirements] Can we propose GraphQL API instead of REST API?
2. [Section 7.1 Contract Type] Will consortium consider Time & Materials contract for Phase 2 instead of CPFF?
```

**Restrictions:**
- Max 25 questions per vendor
- Questions must be about RFP requirements, not vendor-specific
- No proprietary/confidential information in questions (answers will be public)

### 11.3 Answers

**Answers Posted:** April 11, 2026

**Format:**
- PDF document posted to procurement website: https://procurement.node-platform.gov
- All vendors notified via email when answers are posted
- Questions anonymized (vendor names removed)

**Amendments:**
- If answers require RFP changes, amendment will be issued
- All vendors must acknowledge receipt of amendments
- Proposal due date may be extended if major amendments issued

### 11.4 Contact Restrictions

**Prohibited Communications:**
- Vendors may NOT contact consortium board members, state DOT officials, or evaluation team members directly
- All questions must go through official Q&A process
- Violation may result in proposal rejection

**Permitted Communications:**
- Questions via email to questions@node-platform.gov
- Pre-proposal conference attendance
- Debriefing after award decision (upon request)

---

## 12. APPENDICES

### Appendix A: Full Technical Specification

**File:** `NATIONAL_BUILD_SPECIFICATION.md` (27,815 lines)

**Sections:**
1. Executive Summary
2. System Architecture
3. Database Schema
4. API Specifications
5. Event Management
6. Geospatial Queries
7. Cross-State Messaging
8. Data Quality & Normalization
9. IFC Integration & GIS Operational Map
10. AI/ML Innovations (HITL, Truck Parking, Predictive Incidents)
11. CV-TIM Integration
12. IPAWS Alert Generation
13. Federation Protocol
14. Security Architecture
15. Testing Strategy
16. Deployment & Operations
17-30. Additional technical sections
31. Webhook & Push Architecture
32. Frontend Architecture
33. Mobile App Strategy
34. Performance Testing & Load Testing
35. Training Materials & State Onboarding
36. Vendor Contracts & SLA Templates

**Available at:** https://github.com/node-platform/specs

### Appendix B: Glossary

**ATCMTD:** Advanced Transportation and Congestion Management Technologies Deployment (FHWA grant program)

**CAP-IPAWS:** Common Alerting Protocol - Integrated Public Alert and Warning System

**CV-TIM:** Connected Vehicle - Traveler Information Message (SAE J2540)

**FedRAMP:** Federal Risk and Authorization Management Program (cloud security compliance)

**HITL:** Human-in-the-Loop (AI automation with human approval)

**NODE:** National Operational Data Exchange (platform name)

**PostGIS:** Spatial database extension for PostgreSQL

**RTO/RPO:** Recovery Time Objective / Recovery Point Objective (disaster recovery metrics)

**TMDD:** Traffic Management Data Dictionary (standard data format)

**TPIMS:** Truck Parking Information Management System

**WZDX:** Work Zone Data Exchange (standard data format)

### Appendix C: Reference Documents

1. **WZDX 4.2 Specification:** https://github.com/usdot-jpo-ode/wzdx
2. **TMDD 3.0 Standard:** https://www.standards.its.dot.gov/
3. **CAP-IPAWS 1.2:** https://docs.oasis-open.org/emergency/cap/v1.2/
4. **SAE J2540:** https://www.sae.org/standards/content/j2540_201911/
5. **FedRAMP Security Controls:** https://www.fedramp.gov/
6. **NIST 800-53 Rev 5:** https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final

### Appendix D: Proposal Checklist

**Before submitting, ensure:**

- [ ] Executive Summary (2 pages)
- [ ] Technical Approach (30 pages)
- [ ] Management Plan (15 pages)
- [ ] Past Performance (10 pages with 3-5 references)
- [ ] Subcontracting Plan (if applicable)
- [ ] Cost Proposal (separate PDF)
- [ ] Resumes for key personnel (appendix)
- [ ] Certifications (AWS, Kubernetes, Security)
- [ ] Letters of intent from subcontractors
- [ ] Financial statements (last 2 years)
- [ ] Proof of insurance (or commitment letter)
- [ ] Signed proposal cover letter
- [ ] All pages numbered
- [ ] PDF format
- [ ] Submitted before May 2, 2026 at 5:00 PM ET

### Appendix E: Evaluation Team

**Technical Evaluation Team:**
- Platform Lead (NODE Consortium)
- Chief Technology Officer (Founding State DOT)
- Senior Engineer (FHWA)
- Security Architect (Independent Consultant)
- AI/ML Expert (University Partner)

**Cost Evaluation Team:**
- Chief Financial Officer (NODE Consortium)
- Procurement Officer (Founding State DOT)
- Cost Analyst (FHWA)

**Past Performance Evaluation Team:**
- Procurement Officer (NODE Consortium)
- Contracts Manager (State DOT)

**Evaluation Process:**
- Each evaluator scores independently
- Scores normalized and averaged
- Consensus meeting to resolve discrepancies (if >10 point spread)
- Final recommendation to consortium board

---

## 13. PROPOSAL COVER LETTER TEMPLATE

**[Company Letterhead]**

March XX, 2026

NODE Platform Consortium
Attn: Procurement Officer
c/o Iowa Department of Transportation
800 Lincoln Way
Ames, IA 50010

**Re: Proposal for RFP NODE-2026-001 - National Transportation Platform**

Dear Selection Committee:

[Company Name] is pleased to submit this proposal in response to RFP NODE-2026-001 for the design, development, deployment, and operation of the National Transportation Platform (NODE Corridor Communicator).

**Proposal Summary:**
- **Total Cost (Phase 1 Development):** $[Amount]
- **Annual Cost (Phase 2 Operations):** $[Amount]/year
- **Project Duration:** 24 months (development) + 36 months (operations)

**Key Personnel:**
- Platform Lead: [Name], [Certification]
- Project Manager: [Name], PMP
- Security Lead: [Name], CISSP
- DevOps Lead: [Name], CKA
- ML Lead: [Name], [Relevant Experience]

**Certifications:**
- We certify that we meet all minimum qualifications in Section 8.1.
- We certify that all information in this proposal is accurate and complete.
- We certify that proposed key personnel are available for the contract duration.
- We acknowledge all RFP amendments: [List amendment numbers, or "None"]

**Contact Information:**
- **Authorized Signatory:** [Name, Title]
- **Phone:** [Number]
- **Email:** [Email]
- **Address:** [Company Address]

**Proposal Validity:**
This proposal is valid for 90 days from the submission deadline (May 2, 2026).

We look forward to the opportunity to partner with the NODE Platform Consortium to build this transformative national transportation coordination platform.

Sincerely,

[Signature]

[Name, Title]
[Company Name]

**Enclosures:**
- Volume I: Technical Proposal
- Volume II: Cost Proposal
- Appendix: Resumes, Certifications, Letters of Intent

---

## 14. ADDITIONAL TERMS AND CONDITIONS

### 14.1 Organizational Conflict of Interest

Vendors must disclose any organizational conflicts of interest (OCI).

**Examples of OCI:**
- Vendor is currently working for a competing state DOT on similar platform
- Vendor helped write this RFP specification (unfair competitive advantage)
- Vendor has financial interest in subcontractor or technology provider

**Disclosure:** If OCI exists, describe in proposal and propose mitigation plan. Consortium will determine if OCI is acceptable.

### 14.2 Protest Procedures

**Protest Deadline:** 10 business days after award decision notification

**Protest Process:**
1. Submit written protest to protests@node-platform.gov
2. Include: RFP number, vendor name, basis of protest, requested remedy
3. Consortium reviews protest (15-day review)
4. Decision communicated to protesting vendor
5. If protest upheld, award may be delayed or re-competed

**Protest Grounds:**
- RFP violated procurement regulations
- Evaluation criteria not followed
- Winning vendor does not meet minimum qualifications
- Consortium made errors in cost calculation

**Frivolous Protests:** Vendor may be barred from future procurements if protest is deemed frivolous.

### 14.3 Debarment and Suspension

Vendor certifies that it is not:
- Debarred or suspended from federal contracts
- Proposed for debarment
- Declared ineligible for federal contracts
- Voluntarily excluded from federal contracts

**Verification:** Consortium will check SAM.gov exclusion list before award.

### 14.4 Lobbying Restrictions

**Byrd Anti-Lobbying Amendment (31 U.S.C. 1352):**

Vendor certifies that no federal funds will be used to lobby Congress or federal agencies regarding this contract.

**State Lobbying:** Vendor may not lobby state DOT officials or consortium board members during evaluation period (March 7 - June 15, 2026).

### 14.5 Buy America Compliance

**Not Applicable:** This is a software development contract with no manufactured products. Buy America requirements do not apply.

**Data Storage:** All data must be stored in U.S.-based AWS regions (or U.S. regions of alternate cloud provider).

### 14.6 Prevailing Wage (Davis-Bacon)

**Not Applicable:** This is a professional services contract, not construction. Davis-Bacon prevailing wage requirements do not apply.

---

## 15. SIGNATURE PAGE

**By submitting a proposal, vendor certifies:**

1. We have read and understand all RFP requirements.
2. We agree to all terms and conditions.
3. Our proposal is valid for 90 days.
4. We meet all minimum qualifications.
5. We have no organizational conflicts of interest (or disclosed and mitigated).
6. We are not debarred or suspended from federal contracts.
7. We will not lobby during evaluation period.
8. All information in our proposal is accurate and complete.

**Vendor Authorization:**

By signing below, I certify that I am authorized to bind [Company Name] to this proposal.

**Company Name:** ______________________________________

**Authorized Signatory:** ______________________________________

**Name (Print):** ______________________________________

**Title:** ______________________________________

**Date:** ______________________________________

**Email:** ______________________________________

**Phone:** ______________________________________

---

**END OF REQUEST FOR PROPOSAL**

---

**Questions?**

Contact: proposals@node-platform.gov
Website: https://procurement.node-platform.gov
Phone: (515) 555-1234 (Monday-Friday, 8am-5pm ET)

**Good luck to all vendors!**
