# Grant NOFO & Recommendation System Integration

## Overview

This system provides intelligent grant recommendations and direct links to NOFOs (Notice of Funding Opportunities) and Grants.gov applications.

## Features Added

### 1. **Grant Recommendation Engine** (`utils/grant-recommender.js`)
Analyzes project characteristics and recommends:
- **Competitive Grants**: SMART, RAISE, INFRA, PROTECT, ATCMTD, FMCSA IT-D
- **Block Grants**: HSIP, CMAQ, STBG, TAP, FTA 5339

Scoring based on:
- Project description keywords
- Funding amount
- ITS equipment inventory
- Geographic scope
- Safety/incident data
- Freight corridor classification

### 2. **Backend API** (`/api/grants/recommend`)

**Request:**
```javascript
POST /api/grants/recommend
{
  "description": "Deploy connected vehicle infrastructure along I-80",
  "primaryCorridor": "I-80",
  "requestedAmount": 5000000,
  "geographicScope": "multi-state",
  "stateKey": "IA"
}
```

**Response:**
```javascript
{
  "success": true,
  "recommendations": {
    "topMatches": [
      {
        "name": "SMART Grant",
        "score": 95,
        "minAward": 2000000,
        "maxAward": 15000000,
        "matchRequired": 0.5,
        "explanation": [
          "Strong alignment with program objectives",
          "Matches 'Connected vehicles' focus area",
          "Request amount within typical award range"
        ]
      }
    ],
    "blockGrants": [
      {
        "name": "CMAQ",
        "type": "Formula/Block Grant",
        "score": 75,
        "explanation": [...]
      }
    ]
  },
  "context": {
    "hasITSEquipment": true,
    "hasV2XGaps": true,
    "isFreightCorridor": true
  }
}
```

### 3. **Federal Grant Resources Component** (Already exists!)

`frontend/src/components/FederalGrantResources.jsx` provides:
- Complete grant program information
- Direct NOFO links
- Grants.gov application links
- ARC-ITS relevance ratings
- Match requirements
- Application periods

## Quick Integration Into Grant Applications Page

### Step 1: Add Tab Navigation

Add this to your GrantApplications header section (around line 407):

```jsx
{/* Tab Navigation */}
<div style={{
  display: 'flex',
  gap: '8px',
  borderBottom: `2px solid ${theme.border}`,
  marginBottom: '24px'
}}>
  <button
    onClick={() => setActiveTab('applications')}
    style={{
      padding: '12px 24px',
      border: 'none',
      background: activeTab === 'applications' ? theme.primary : 'transparent',
      color: activeTab === 'applications' ? '#ffffff' : theme.text,
      borderBottom: activeTab === 'applications' ? `3px solid ${theme.primary}` : 'none',
      fontWeight: activeTab === 'applications' ? '600' : '400',
      cursor: 'pointer',
      fontSize: '15px'
    }}
  >
    📋 My Applications
  </button>

  <button
    onClick={() => setActiveTab('resources')}
    style={{
      padding: '12px 24px',
      border: 'none',
      background: activeTab === 'resources' ? theme.primary : 'transparent',
      color: activeTab === 'resources' ? '#ffffff' : theme.text,
      borderBottom: activeTab === 'resources' ? `3px solid ${theme.primary}` : 'none',
      fontWeight: activeTab === 'resources' ? '600' : '400',
      cursor: 'pointer',
      fontSize: '15px'
    }}
  >
    💰 Browse Programs & NOFOs
  </button>
</div>
```

### Step 2: Add Tab Content Rendering

Replace the main content area with tab-based rendering:

```jsx
{/* Tab Content */}
{activeTab === 'applications' && (
  <>
    {/* Existing applications list/details code stays here */}
    {viewMode === 'list' && (
      // Your existing list view
    )}
    {viewMode === 'details' && (
      // Your existing details view
    )}
  </>
)}

{activeTab === 'resources' && (
  <FederalGrantResources darkMode={darkMode} />
)}
```

### Step 3: Add Recommendations to Create Form

When creating a new application, show recommendations. Add this after the form description field (around line 480):

```jsx
{/* Grant Recommendations */}
{formData.description && formData.primaryCorridor && formData.requestedAmount && (
  <div style={{
    background: theme.primaryLight,
    padding: '16px',
    borderRadius: '8px',
    marginTop: '16px'
  }}>
    <div style={{
      fontSize: '14px',
      fontWeight: '600',
      color: theme.text,
      marginBottom: '12px'
    }}>
      💡 Recommended Grant Programs
    </div>
    <button
      type="button"
      onClick={async () => {
        try {
          const response = await api.post('/api/grants/recommend', {
            description: formData.description,
            primaryCorridor: formData.primaryCorridor,
            requestedAmount: formData.requestedAmount,
            geographicScope: formData.geographicScope,
            stateKey: user.stateKey
          });

          if (response.data.success) {
            setRecommendations(response.data.recommendations);
          }
        } catch (error) {
          console.error('Error getting recommendations:', error);
        }
      }}
      style={{
        padding: '8px 16px',
        background: theme.primary,
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '600'
      }}
    >
      Get Recommendations
    </button>

    {recommendations && (
      <div style={{ marginTop: '16px' }}>
        {recommendations.topMatches.length > 0 && (
          <>
            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: theme.textSecondary,
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Top Matches (Competitive):
            </div>
            {recommendations.topMatches.map((grant, idx) => (
              <div key={idx} style={{
                background: theme.bgSecondary,
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '8px',
                border: `1px solid ${theme.border}`
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px'
                }}>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>
                    {grant.name}
                  </span>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '12px',
                    background: grant.score >= 80 ? '#dcfce7' : '#fef3c7',
                    color: grant.score >= 80 ? '#166534' : '#92400e',
                    fontSize: '11px',
                    fontWeight: '700'
                  }}>
                    {grant.score}% Match
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                  {grant.fullName}
                </div>
                <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: '6px' }}>
                  {grant.explanation?.slice(0, 2).join(' • ')}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('resources');
                    setFormData(prev => ({ ...prev, grantProgram: grant.programKey }));
                  }}
                  style={{
                    marginTop: '8px',
                    padding: '6px 12px',
                    background: theme.primary,
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  View NOFO & Details →
                </button>
              </div>
            ))}
          </>
        )}

        {recommendations.blockGrants.length > 0 && (
          <>
            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: theme.textSecondary,
              marginTop: '16px',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Block Grant Options:
            </div>
            {recommendations.blockGrants.map((grant, idx) => (
              <div key={idx} style={{
                background: theme.bgSecondary,
                padding: '10px',
                borderRadius: '6px',
                marginBottom: '6px',
                border: `1px solid ${theme.border}`
              }}>
                <div style={{ fontWeight: '600', fontSize: '13px' }}>
                  {grant.name}
                </div>
                <div style={{ fontSize: '11px', color: theme.textSecondary }}>
                  {grant.type} • Administered by {grant.administered}
                </div>
                <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: '4px' }}>
                  {grant.focus}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    )}
  </div>
)}
```

## Usage Example

### User Flow:

1. **Browse Programs Tab**
   - User clicks "Browse Programs & NOFOs"
   - Sees all federal grant programs with direct NOFO links
   - Clicks on a program card to expand details
   - Clicks "NOFO / Program Page" to open official page
   - Clicks "Grants.gov Application" to start application

2. **Creating Application with Recommendations**
   - User starts creating new application
   - Fills in description: "Deploy V2X infrastructure along I-80"
   - Fills in corridor: "I-80"
   - Fills in amount: "$8,000,000"
   - Clicks "Get Recommendations"
   - System shows:
     - ✅ **SMART Grant (95% match)** - "Strong alignment, matches Connected Vehicles focus"
     - ✅ **ATCMTD (88% match)** - "Good alignment, V2I technology deployment"
     - Block options: CMAQ, STBG
   - User clicks "View NOFO & Details" → switches to Browse Programs tab
   - User reviews requirements and clicks official NOFO link

## Current NOFO Links (From FederalGrantResources.jsx)

✅ **SMART**: https://www.transportation.gov/grants/SMART
✅ **RAISE**: https://www.transportation.gov/RAISEgrants
✅ **INFRA**: https://www.transportation.gov/grants/infra-grants-program
✅ **PROTECT**: https://www.fhwa.dot.gov/environment/protect/
✅ **ATCMTD**: https://www.its.dot.gov/grants/atcmtd.htm
✅ **FMCSA IT-D**: https://www.fmcsa.dot.gov/grants/cmv-information-technology-data-grant-program

All include direct Grants.gov application links!

## Benefits

1. **Saves Time**: Direct links to NOFOs and applications
2. **Increases Success**: Matches projects to best-fit programs
3. **Identifies Block Grants**: Often overlooked funding sources
4. **Data-Driven**: Uses actual ITS inventory and project data
5. **Educational**: Shows why programs match and what's needed
6. **Always Current**: Links point to official USDOT pages

## Testing

Test the recommendation endpoint:

```bash
curl -X POST http://localhost:3001/api/grants/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Deploy connected vehicle RSUs and traffic signal integration",
    "primaryCorridor": "I-35",
    "requestedAmount": 8000000,
    "geographicScope": "state",
    "stateKey": "IA"
  }'
```

Expected response includes top-matching competitive grants and block grant options with explanations.
