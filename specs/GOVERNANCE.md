# Platform Governance Model

**Version:** 1.0
**Effective Date:** January 2026
**Review Cycle:** Annual

---

## Executive Summary

The National Transportation Platform operates under a **hybrid federal-state consortium model**, combining USDOT strategic oversight with state-led operational management through a 501(c)(3) non-profit organization.

**Key Principles:**
- **State Ownership:** States control platform roadmap and operations
- **Federal Partnership:** USDOT provides standards, funding, and policy guidance
- **Neutral Governance:** Non-profit structure ensures fairness and transparency
- **Sustainable Funding:** Mixed revenue model (grants, dues, commercial fees)

---

## Organizational Structure

```
┌─────────────────────────────────────────────────────────┐
│          USDOT FEDERAL PROGRAM OFFICE                   │
│          (Policy, Standards, Grants)                    │
│          Staff: 5-8 people                              │
└───────────────────┬─────────────────────────────────────┘
                    │ Partnership Agreement
                    │ - Grant funding (40%)
                    │ - Standards approval
                    │ - State onboarding support
                    ▼
┌─────────────────────────────────────────────────────────┐
│    STATE CONSORTIUM (501(c)(3) Non-Profit)              │
│    "National Transportation Data Cooperative"           │
│                                                          │
│    ┌──────────────────────────────────────────┐        │
│    │   BOARD OF DIRECTORS (15 members)        │        │
│    │   - 10 State DOT Directors (rotating)    │        │
│    │   - 3 USDOT Appointees                   │        │
│    │   - 2 Independent Technical Experts      │        │
│    └──────────────┬───────────────────────────┘        │
│                   │                                     │
│                   ▼                                     │
│    ┌──────────────────────────────────────────┐        │
│    │   EXECUTIVE DIRECTOR                     │        │
│    │   (Chief Operating Officer)              │        │
│    └──────────────┬───────────────────────────┘        │
│                   │                                     │
│         ┌─────────┴─────────┐                          │
│         ▼                   ▼                          │
│    ┌─────────┐       ┌──────────────┐                 │
│    │Platform │       │  Operations  │                 │
│    │ Eng Team│       │     Team     │                 │
│    │(15 ppl) │       │   (10 ppl)   │                 │
│    └─────────┘       └──────────────┘                 │
│                                                          │
│    Staff: 30-40 people                                  │
└─────────────────────────────────────────────────────────┘
                    ▲
                    │ Membership
                    │
        ┌───────────┴──────────────┬──────────────┐
        ▼                          ▼              ▼
    [Founding]               [Standard]      [Associate]
    10 States                30 States        10 States
    $150K/year               $100K/year       $50K/year
```

---

## Decision Authority (RACI Matrix)

| Decision Type | USDOT | Consortium Board | Executive Director | Platform Staff | State Members |
|---------------|-------|------------------|-------------------|---------------|---------------|
| **National Standards** | **A** | C | I | C | I |
| **Technical Roadmap** | C | **A** | R | C | C |
| **Budget Approval** | C (grants) | **A** | R | I | I |
| **Platform Operations** | I | C | **A** | R | I |
| **State Onboarding** | C | C | **A** | R | I |
| **Vendor Contracts** | I | **A** | R | C | I |
| **Feature Priorities** | I | **A** | C | R | C |
| **Security Incidents** | I | I | **A** | R | I |
| **Specification Changes** | C | C | C | **A** | C |
| **Emergency Hotfixes** | I | I | **A** | R | I |

**Legend:**
- **R** = Responsible (does the work)
- **A** = Accountable (final authority, signs off)
- **C** = Consulted (provides input before decision)
- **I** = Informed (told after decision)

---

## Federal Program Office (USDOT/FHWA)

### Mission
Provide strategic direction, standards oversight, and federal funding for the National Transportation Platform while respecting state operational autonomy.

### Structure
- **Location:** Washington, D.C.
- **Staff:** 5-8 federal employees
- **Budget:** $2-3M/year (staff + grant administration)

### Roles & Responsibilities

**Program Director (GS-15)**
- Strategic vision and federal policy alignment
- Congressional reporting and budget justification
- Partnership agreement with State Consortium
- Annual performance review of platform

**Policy Lead (GS-14)**
- National standards development and approval
- Coordination with AASHTO, ITE, FHWA offices
- Section 6.4 compliance oversight
- Federal mandate strategy (carrots, not sticks)

**Grant Managers (2-3 @ GS-13)**
- Administer federal grants to consortium
- Monitor grant performance and deliverables
- State onboarding incentive programs
- Budget compliance and reporting

### Decision Authority
- **Approve:** National data standards (WZDX, TMDD, CAP-IPAWS)
- **Approve:** Federal grant awards to consortium
- **Advise:** Technical roadmap and feature priorities
- **Mandate:** Minimum security/privacy requirements (FedRAMP)
- **Cannot:** Unilaterally change platform without board vote

### Accountability
- Reports to: FHWA Associate Administrator for Operations
- Oversight: Congressional transportation committees
- Annual report: Platform performance, state adoption, ROI

---

## State Consortium (Non-Profit Entity)

### Legal Structure
**Name:** National Transportation Data Cooperative (NTDC)
**Type:** 501(c)(3) non-profit corporation
**Incorporation:** Delaware (favorable non-profit laws)
**Tax Status:** Tax-exempt, donations deductible

### Mission
Operate and continuously improve the National Transportation Platform to enhance real-time coordination, improve safety, and reduce operational costs for state departments of transportation.

### Board of Directors (15 members)

**Composition:**
- **10 State DOT Directors** (rotating 2-year terms)
  - Must represent geographic diversity (West, Midwest, South, Northeast, etc.)
  - Elections held annually (5 seats per year)
  - Founding states get priority seats in Year 1
- **3 USDOT Appointees** (appointed by Secretary of Transportation)
  - FHWA Program Director (permanent seat)
  - 2 additional USDOT representatives (3-year terms)
- **2 Independent Technical Experts** (elected by board, 3-year terms)
  - 1 cybersecurity expert
  - 1 transportation data expert
  - Cannot be employed by states, federal government, or platform vendors

**Eligibility:**
- State DOT seats: Only DOT directors or deputy directors from member states
- USDOT seats: Appointed by Secretary or designee
- Independent seats: Must have 10+ years relevant experience, no conflicts of interest

**Term Limits:**
- State seats: Maximum 2 consecutive terms (4 years)
- Independent seats: Maximum 2 consecutive terms (6 years)
- No limit on non-consecutive terms

**Meeting Schedule:**
- **Quarterly Board Meetings:** Review performance, approve budget, set priorities
- **Annual Strategic Retreat:** Long-term planning (2-day in-person)
- **Emergency Meetings:** Can be called with 48-hour notice (video conference)

**Voting:**
- Each director has one vote (15 total votes)
- **Simple majority (8 votes):** Routine decisions (budgets, contracts, memberships)
- **Supermajority (10 votes):** Major changes (bylaws, mission, executive director hire/fire)
- **Unanimous (15 votes):** Dissolution of organization

### Board Committees

**Executive Committee (5 members)**
- Board Chair (elected annually)
- Vice Chair
- USDOT Program Director
- 2 at-large board members
- **Meets:** Monthly
- **Authority:** Emergency decisions between board meetings (ratified at next meeting)

**Technical Steering Committee (7 members)**
- 5 state representatives (technical staff, not directors)
- 2 independent technical experts from board
- **Meets:** Monthly
- **Authority:** Technical roadmap, RFC approvals, architecture decisions

**Finance & Audit Committee (5 members)**
- Board Treasurer (elected annually)
- 2 state board members
- 1 USDOT appointee
- 1 independent accounting expert (non-board advisor)
- **Meets:** Quarterly
- **Authority:** Budget approval, financial oversight, annual audit

**Membership Committee (5 members)**
- 3 state board members (geographic diversity)
- 1 USDOT appointee
- 1 independent expert
- **Meets:** Quarterly
- **Authority:** New member approval, dues structure, membership tiers

---

## Executive Leadership

### Executive Director (Chief Operating Officer)

**Qualifications:**
- 10+ years technology leadership experience
- Experience managing $10M+ budgets and 30+ person teams
- Understanding of transportation operations (preferred)
- Track record of public-private collaboration

**Responsibilities:**
- Day-to-day platform operations
- Staff hiring, management, and performance reviews
- Budget execution and financial management
- Vendor contract negotiations
- State onboarding and support
- Platform roadmap execution
- Emergency incident command

**Reports To:** Board of Directors (Board Chair)
**Term:** At-will employment, annual performance review
**Compensation:** $200-250K/year (competitive with public sector tech leadership)

### Staff Structure (30-40 people)

**Platform Engineering Team (15 people, $2.5M/year)**
- Platform Lead (1) - $180K
- Senior Engineers (5) - $150K each
- DevOps Engineers (3) - $140K each
- Data Engineers (2) - $130K each
- QA Engineers (2) - $110K each
- Technical Writer (1) - $90K
- Security Engineer (1) - $160K

**Operations Team (10 people, $1.2M/year)**
- Operations Manager (1) - $140K
- Site Reliability Engineers (4) - $140K each
- Support Engineers (3) - $90K each
- Training Specialists (2) - $80K each

**Administration (5 people, $500K/year)**
- Finance Manager (1) - $120K
- HR/Admin Manager (1) - $100K
- Grant Administrator (1) - $90K
- Marketing/Comms (1) - $90K
- Administrative Assistant (1) - $60K

**Consultants (part-time, $200K/year)**
- Domain experts as needed (IPAWS, standards, AI/ML, CV, GIS)

**Total Staff Cost:** ~$4.4M/year + benefits (30%) = **$5.7M/year**

---

## Membership Model

### Membership Tiers

**Founding Member ($150K/year)**
- **Eligibility:** First 10 states to join
- **Benefits:**
  - Full platform access (all features)
  - Priority board seat (Years 1-2)
  - Voting rights on all decisions
  - Technical steering committee seat
  - Free training for unlimited users
  - Dedicated account manager
  - Custom integrations (1 per year)
- **Commitment:** 3-year minimum membership

**Standard Member ($100K/year)**
- **Eligibility:** States 11-40
- **Benefits:**
  - Full platform access (all features)
  - Rotating board seats (elected)
  - Voting rights on all decisions
  - Technical steering committee seat (rotating)
  - Training for up to 50 users
  - Standard support (24/7 for critical issues)
- **Commitment:** Annual membership, renewable

**Associate Member ($50K/year)**
- **Eligibility:** States 41-50, US territories, tribal nations
- **Benefits:**
  - Read-only data access (view all states' incidents)
  - Cannot create/edit incidents on national platform
  - Voting rights on non-financial decisions
  - Training for up to 10 users
  - Business hours support
- **Commitment:** Annual membership, renewable
- **Upgrade:** Can upgrade to Standard at any time

### Fee Waivers & Adjustments

**Small State Waiver (Population < 3M):**
- 50% discount on membership dues
- Applies to: WY, VT, AK, ND, SD, DE, RI, MT, ME, NH, HI, ID, WV
- Requires approval by Membership Committee

**Pilot State Credit:**
- States that participated in original pilot (Iowa + 2) get 25% discount for first 2 years

**Multi-State Agency Agreements:**
- Regional agencies (e.g., I-95 Corridor Coalition) can join as one "state"
- Dues based on combined population of member states

**Federal Incentive Programs:**
- States joining in first 2 years get $50K federal subsidy from USDOT
- USDOT STIC Incentive program can cover 50% of first-year dues

### Membership Requirements

**To Join:**
1. Letter of commitment from State DOT director
2. Designated technical contact (24/7 availability)
3. Agree to data sharing policies (anonymized, aggregated data OK to share)
4. Commit to WZDX/TMDD standards compliance
5. Pass security review (basic: HTTPS, MFA for users)

**To Maintain:**
- Pay annual dues (due January 1)
- Participate in quarterly member calls
- Respond to support requests within 48 hours
- Attend annual conference
- Provide feedback on platform roadmap

**Termination:**
- 90-day written notice required
- No refunds for partial years
- Data export provided within 30 days
- Can rejoin with board approval

---

## Funding Model

### Revenue Breakdown (Year 3 Target: $11M/year)

**Federal Grants (40% = $4.4M/year)**
- USDOT base grant: $2M/year (operations support)
- FHWA innovation grants: $1.5M/year (new features)
- NHTSA safety grants: $500K/year (IPAWS integration)
- Other federal grants (DHS, DOE): $400K/year

**State Membership Dues (30% = $3.3M/year)**
- 10 Founding states × $150K = $1.5M
- 20 Standard states × $100K = $2.0M
- 8 Associate states × $50K × 50% (small state) = $200K
- Regional agencies: $600K

**Commercial API Fees (20% = $2.2M/year)**
- Data vendors (INRIX, HERE, Waze): $800K
- Navigation apps (Google, Apple, Waze): $600K
- Research institutions: $400K
- Private sector (insurance, logistics): $400K

**Sponsorships & Services (10% = $1.1M/year)**
- Technology sponsors (AWS, Microsoft): $500K (in-kind + cash)
- Industry associations (AASHTO, ITE): $200K
- Consulting services (custom integrations): $300K
- Training & certification programs: $100K

### Expense Breakdown (Year 3 Target: $10.5M/year)

**Personnel (55% = $5.8M/year)**
- Staff salaries & benefits: $5.7M (see above)
- Board travel & expenses: $100K

**Infrastructure (25% = $2.6M/year)**
- AWS hosting: $1.8M (EKS, RDS, CloudFront, etc.)
- Third-party services: $400K (Datadog, PagerDuty, GitHub, etc.)
- Software licenses: $300K (Terraform, security tools)
- Backup & disaster recovery: $100K

**Operations (10% = $1.1M/year)**
- Security audits (SOC 2, penetration tests): $300K
- Legal & compliance: $200K
- Insurance: $150K
- Accounting & audit: $150K
- Marketing & communications: $150K
- Travel (conferences, training): $150K

**Development (10% = $1.0M/year)**
- Contracted development: $500K
- Research & innovation: $300K
- Training content development: $200K

**Reserve Fund (Carry Forward):** $500K/year
- Target: 6 months operating expenses ($5M)
- For: Emergency situations, economic downturns, major upgrades

---

## Conflict of Interest Policy

### Prohibited Conflicts

**Board Members Cannot:**
- Have financial interest in platform vendors or contractors
- Accept gifts/payments from platform stakeholders
- Use platform data for personal/commercial gain
- Participate in decisions where they have personal interest

**Staff Cannot:**
- Award contracts to family members or associates
- Accept vendor gifts > $100 value
- Moonlight for platform competitors
- Disclose confidential platform data

### Disclosure Requirements

**Annual Disclosures (due January 31):**
- All board members must disclose:
  - Employment history (past 2 years)
  - Board memberships (other organizations)
  - Financial interests (>$10K in transportation tech)
  - Family relationships with platform stakeholders

**Recusal Procedures:**
- If conflict identified, member must:
  1. Disclose conflict before discussion
  2. Excuse themselves from vote
  3. Leave room during deliberation
  4. Document recusal in meeting minutes

---

## Intellectual Property

### Ownership

**Platform Code:** Open source (Apache 2.0 license)
- All platform source code is public
- States can fork and modify for local use
- Contributions back to platform encouraged but not required

**Platform Data:** Public domain
- Aggregated transportation data is public
- No proprietary claims on incident data
- States retain ownership of their contributed data

**Platform Brand:** Owned by consortium
- "National Transportation Platform" trademark
- Logo and visual identity owned by NTDC
- States can use branding in official materials

### Patents & Innovations

**Patent Rights:**
- Any patents developed by platform staff belong to NTDC
- Platform grants royalty-free license to all member states
- Cannot license patents exclusively to private companies

**AI Models:**
- ML models trained on platform data belong to NTDC
- Open-weight models (not proprietary)
- Research papers must acknowledge platform

---

## Change Management Process

### Specification Changes (Technical)

**Minor Changes (typos, clarifications):**
- Platform Lead approves
- No formal RFC required
- Document in pull request

**Moderate Changes (new subsections, API endpoints):**
- RFC required (see RFC_TEMPLATE.md)
- Technical Steering Committee reviews (1-2 weeks)
- Approved by Platform Lead
- Implemented with normal sprint cycle

**Major Changes (new features, architecture changes):**
- RFC required with detailed cost/benefit analysis
- Technical Steering Committee endorses
- Board approval required (vote at quarterly meeting)
- Implemented with appropriate resources allocated

### Governance Changes (Bylaws, Policies)

**Process:**
1. Proposal submitted to Board Chair
2. Executive Committee reviews (15 days)
3. Full board discussion at quarterly meeting
4. Vote: Supermajority required (10/15 votes)
5. If approved, effective after 30-day notice to members

---

## Dispute Resolution

### Internal Disputes (State vs. State)

**Process:**
1. States attempt direct resolution (informal)
2. If unsuccessful, escalate to Executive Director (mediates)
3. If still unresolved, Executive Committee hears case (binding decision)
4. Appeal to full Board (requires supermajority to overturn Executive Committee)

**Timeline:** 30 days from initial escalation to final decision

### Member vs. Consortium Disputes

**Examples:** Billing disputes, service level disagreements, data usage concerns

**Process:**
1. State submits formal grievance to Executive Director
2. Executive Director investigates (14 days)
3. Executive Director issues decision
4. State can appeal to Board (next quarterly meeting)
5. Board decision is final

### Vendor Disputes

**Examples:** Contract disputes, service level breaches, intellectual property

**Process:**
1. Executive Director attempts resolution
2. If unsuccessful, mediation (neutral third party)
3. If still unresolved, binding arbitration
4. No lawsuits (arbitration clause in all contracts)

---

## Dissolution (Highly Unlikely)

### Conditions for Dissolution

**Board can vote to dissolve if:**
- Membership drops below 15 states AND
- Cannot secure adequate funding for 12+ months AND
- Federal government withdraws support AND
- Supermajority vote (10/15 board members)

### Dissolution Process

1. **Assets:** All remaining funds distributed to member states (pro-rata by dues paid)
2. **Code:** Platform code remains open source (Apache 2.0)
3. **Data:** Complete data export provided to all member states
4. **Infrastructure:** 90-day transition period to allow states to self-host or migrate
5. **Staff:** Severance packages per employment agreements

---

## Amendments

**This governance document can be amended by:**
- Supermajority vote of Board (10/15)
- With 30-day advance notice to all members
- After opportunity for member comments

**Next Review:** January 2027

---

## Contacts

**Federal Program Office:**
- Program Director: [name]@dot.gov
- Policy Lead: [name]@dot.gov
- Grant Managers: grants-node@dot.gov

**State Consortium:**
- Executive Director: director@node-platform.gov
- Board Chair: board-chair@node-platform.gov
- Membership Questions: membership@node-platform.gov
- Technical Support: support@node-platform.gov

**General Information:**
- Website: https://node-platform.gov
- GitHub: https://github.com/node-platform
- Slack: node-platform.slack.com

---

**Approved By:**
- Board of Directors: [Date]
- USDOT Program Office: [Date]
- Effective Date: January 1, 2026
