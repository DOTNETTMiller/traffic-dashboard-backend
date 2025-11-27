# Federal Grant Features - Integration Guide

## Overview

This document describes the new federal grant assistance features added to the DOT Corridor Communicator application.

## New Features

### 1. Federal Grant Resources (`FederalGrantResources.jsx`)
**Location:** `frontend/src/components/FederalGrantResources.jsx`

Comprehensive guide to federal transportation grant programs with:
- **Grant Programs Covered:**
  - SMART (Strengthening Mobility and Revolutionizing Transportation)
  - RAISE (Rebuilding American Infrastructure)
  - FMCSA IT-D (Commercial Motor Vehicle IT & Data)
  - PROTECT (Resilient Operations)
  - ATCMTD (Advanced Transportation Technologies)
  - INFRA (Infrastructure for Rebuilding America)

- **Information Provided:**
  - Annual funding amounts
  - Typical award sizes
  - Match requirements
  - Application periods
  - Direct links to NOFO/program pages
  - Links to Grants.gov applications
  - ARC-ITS relevance ratings
  - Key requirements and eligibility

### 2. AI Grant Writing Assistant (`GrantDraftingAssistant.jsx`)
**Location:** `frontend/src/components/GrantDraftingAssistant.jsx`

AI-powered grant content generator that uses ARC-ITS equipment inventory data:

- **Content Types:**
  - Project Ideas (5-7 fundable concepts)
  - Executive Summary
  - Technical Approach
  - Custom grant writing assistance

- **Features:**
  - Automatically includes ITS equipment inventory context
  - Works with or without OpenAI API key (provides structured templates as fallback)
  - Grant program-specific guidance
  - Copy-to-clipboard functionality
  - Equipment breakdown display

### 3. Backend API Endpoint
**Location:** `backend_proxy_server.js` lines 10782-11067

**Endpoint:** `POST /api/grants/generate-content`

**Request Body:**
```json
{
  "stateKey": "iowa",
  "grantProgram": "SMART",
  "projectDescription": "Deploy connected vehicle infrastructure...",
  "contentType": "ideas"
}
```

**Response:**
```json
{
  "success": true,
  "content": "Generated grant content...",
  "itsInventory": {
    "total": 22011,
    "arc_its_compliant": 18450,
    "compliance_rate": "83.8"
  },
  "note": "Optional note about API key configuration"
}
```

## Integration into App.jsx

### Option 1: Add to Grants/Applications Section

```jsx
import FederalGrantResources from './components/FederalGrantResources';
import GrantDraftingAssistant from './components/GrantDraftingAssistant';

// In your App.jsx navigation/routing:
<Route path="/grant-resources" element={<FederalGrantResources darkMode={darkMode} />} />
<Route path="/grant-assistant" element={<GrantDraftingAssistant user={user} darkMode={darkMode} />} />
```

### Option 2: Add as Tabs in GrantApplications Component

```jsx
// In GrantApplications.jsx
import FederalGrantResources from './FederalGrantResources';
import GrantDraftingAssistant from './GrantDraftingAssistant';

const [activeTab, setActiveTab] = useState('applications'); // 'applications', 'resources', 'assistant'

// Add tab buttons:
{activeTab === 'applications' && <YourExistingContent />}
{activeTab === 'resources' && <FederalGrantResources darkMode={darkMode} />}
{activeTab === 'assistant' && <GrantDraftingAssistant user={user} darkMode={darkMode} />}
```

### Option 3: Add Menu Items

```jsx
// In your sidebar/menu:
<MenuItem icon="💰" label="Grant Resources" onClick={() => navigate('/grant-resources')} />
<MenuItem icon="🤖" label="AI Grant Assistant" onClick={() => navigate('/grant-assistant')} />
```

## OpenAI API Key Configuration (Optional)

To enable AI-powered content generation:

1. **Get an OpenAI API Key:**
   - Sign up at https://platform.openai.com/
   - Create an API key

2. **Set Environment Variable:**
   ```bash
   export OPENAI_API_KEY="sk-your-api-key-here"
   ```

   Or add to a `.env` file:
   ```
   OPENAI_API_KEY=sk-your-api-key-here
   ```

3. **Restart Backend Server:**
   ```bash
   node backend_proxy_server.js
   ```

**Note:** The system works WITHOUT an API key - it provides structured grant writing templates as a fallback. The OpenAI integration enhances responses with AI-generated, customized content.

## How It Works

1. **User selects grant program and content type**
2. **System retrieves ARC-ITS equipment inventory:**
   - Total equipment count
   - ARC-IT compliance rate
   - Equipment breakdown by type
   - Corridor assignments

3. **Backend generates content:**
   - If OpenAI API key configured: Uses GPT-4 with custom prompts
   - If no API key: Uses structured templates with inventory data

4. **User receives:**
   - Grant-specific content
   - ITS inventory context used
   - Copy-to-clipboard functionality
   - Equipment statistics

## Files Created

```
frontend/src/components/
├── FederalGrantResources.jsx       # Grant program directory with links
└── GrantDraftingAssistant.jsx      # AI grant writing tool

backend_proxy_server.js             # Added /api/grants/generate-content endpoint
GRANT_FEATURES_README.md            # This file
```

## Usage Examples

### Example 1: Get Project Ideas for SMART Grant
```javascript
POST /api/grants/generate-content
{
  "stateKey": "iowa",
  "grantProgram": "SMART",
  "contentType": "ideas",
  "projectDescription": "Connected vehicle deployment on I-35"
}
```

### Example 2: Generate Executive Summary
```javascript
POST /api/grants/generate-content
{
  "stateKey": "iowa",
  "grantProgram": "RAISE",
  "contentType": "executive_summary",
  "projectDescription": "Multi-modal corridor improvement with ITS integration"
}
```

### Example 3: Technical Approach Section
```javascript
POST /api/grants/generate-content
{
  "stateKey": "iowa",
  "grantProgram": "ATCMTD",
  "contentType": "technical_approach"
}
```

## Key Benefits

1. **Centralized Grant Information:**
   - All major USDOT grant programs in one place
   - Direct links to applications and NOFOs
   - ARC-ITS relevance ratings

2. **Data-Driven Content Generation:**
   - Uses actual equipment inventory
   - Demonstrates ARC-IT compliance
   - Incorporates state-specific data

3. **Time Savings:**
   - Quick access to grant requirements
   - Automated content drafts
   - Structured templates available immediately

4. **Compliance Support:**
   - References ARC-IT 10.0 standards
   - NTCIP, SAE J2735, IEEE 1609 citations
   - Standards-compliant technical approaches

## Next Steps

1. Choose integration approach (tabs, routes, or menu items)
2. Add components to your application
3. (Optional) Configure OpenAI API key for AI-powered generation
4. Test with sample grant programs
5. Customize styling to match your application theme

## Support

For questions or issues:
- Review component code for styling/props options
- Check backend endpoint logs for debugging
- Verify ITS equipment inventory data exists in database

