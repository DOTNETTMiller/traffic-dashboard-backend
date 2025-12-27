# Grant Proposal Analyzer & Scorer

## Overview

The Grant Proposal Analyzer & Scorer uses AI-powered analysis to evaluate grant proposals and provide actionable feedback to improve application competitiveness. It combines expert knowledge of federal grant programs with GPT-4's advanced language understanding to deliver comprehensive scoring and recommendations.

## Features

### 1. 📝 **Proposal Analyzer**

Provides comprehensive analysis of grant proposal text including:

- **Overall Score** (0-100): Competitiveness rating
- **Strengths**: What the proposal does well
- **Weaknesses**: Critical gaps and issues
- **Improvement Suggestions**: Specific, actionable recommendations
- **Alignment Analysis**: How well it matches grant priorities
- **Risk Assessment**: Potential reviewer concerns
- **Missing Elements**: Required components not addressed
- **Recommended Actions**: Prioritized action items (Immediate, Before Submission, Optional)

**Metrics Analyzed:**
- **Keyword Coverage**: Percentage of grant-specific keywords present
- **Word Count**: Total proposal length
- **Funding Alignment**: Whether requested amount fits grant's typical range

### 2. 🎯 **Application Scorer**

Scores complete grant applications using standard federal grant criteria:

**Scoring Categories:**

1. **Technical Merit** (25 points)
   - Innovation and originality
   - Technical feasibility
   - Project approach and methodology

2. **Project Impact** (25 points)
   - Expected benefits and outcomes
   - Performance measures
   - Scope of impact

3. **Organizational Capacity** (15 points)
   - Team experience and qualifications
   - Past performance
   - Partnership strength

4. **Budget & Cost** (15 points)
   - Cost reasonableness
   - Cost-effectiveness
   - Match funding adequacy

5. **Sustainability** (10 points)
   - Long-term viability
   - Data sharing plans
   - Maintenance strategy

6. **Equity & Inclusion** (10 points)
   - Community engagement
   - Accessibility considerations
   - Equity impacts

**Outputs:**
- Weighted total score (0-100)
- Ranking: Highly Competitive, Competitive, Moderately Competitive, Not Competitive
- Award likelihood: High, Medium, Low
- Top 3 improvements needed
- Detailed justification for each category score

## API Endpoints

### Analyze Proposal

```
POST /api/grants/analyze-proposal
```

**Request:**
```json
{
  "proposalText": "Deploy V2X infrastructure along I-80...",
  "grantProgram": "SMART",
  "projectTitle": "I-80 Connected Corridors",
  "requestedAmount": 8500000,
  "stateKey": "IA"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "overallScore": 75,
    "competitivenessRating": "Strong",
    "strengths": [
      "Clear technical approach with specific deployment milestones",
      "Strong multi-state coordination framework",
      "Comprehensive data sharing strategy aligned with USDOT requirements"
    ],
    "weaknesses": [
      "Limited discussion of equity and community engagement",
      "Budget justification lacks detailed cost breakdown",
      "Performance measures need more specificity"
    ],
    "improvementSuggestions": [
      "Add specific equity goals and community outreach plans",
      "Provide detailed budget with cost per RSU deployment",
      "Define quantitative performance measures (e.g., travel time reduction %)",
      "Strengthen partnerships with letters of commitment",
      "Include cybersecurity and privacy protection details"
    ],
    "alignmentAnalysis": "Strong alignment with SMART Grant priorities...",
    "riskAssessment": "Moderate risk due to multi-state coordination complexity...",
    "missingElements": [
      "Cybersecurity plan",
      "Community engagement strategy",
      "Operations and maintenance budget"
    ],
    "recommendedActions": {
      "immediate": [
        "Draft cybersecurity and data privacy plan",
        "Obtain letters of commitment from partner states"
      ],
      "beforeSubmission": [
        "Develop detailed budget with line-item justifications",
        "Create equity impact assessment",
        "Define specific, measurable outcomes"
      ],
      "optional": [
        "Include benefit-cost analysis",
        "Add visualization of deployment phases"
      ]
    },
    "metrics": {
      "wordCount": 842,
      "keywordsMatched": 3,
      "totalKeywords": 4,
      "keywordCoverage": 75,
      "fundingAlignment": true
    },
    "contextData": {
      "hasITSEquipment": true,
      "itsCount": 157,
      "hasV2XGaps": true
    }
  }
}
```

### Score Application

```
POST /api/grants/score-application
```

**Request:**
```json
{
  "grantProgram": "SMART",
  "applicationData": {
    "title": "I-80 Connected Corridors",
    "description": "Deploy V2X infrastructure...",
    "requestedAmount": 8500000,
    "geographicScope": "multi-state"
  },
  "stateKey": "IA"
}
```

**Response:**
```json
{
  "success": true,
  "scoring": {
    "scores": {
      "technicalMerit": {
        "score": 85,
        "weight": 25,
        "justification": "Strong technical approach with proven V2X technology..."
      },
      "projectImpact": {
        "score": 78,
        "weight": 25,
        "justification": "Significant safety and mobility benefits expected..."
      },
      "organizationalCapacity": {
        "score": 90,
        "weight": 15,
        "justification": "Excellent team with prior DOT grant experience..."
      },
      "budgetAndCost": {
        "score": 72,
        "weight": 15,
        "justification": "Budget is reasonable but needs more detail..."
      },
      "sustainability": {
        "score": 80,
        "weight": 10,
        "justification": "Good long-term plan with state funding commitment..."
      },
      "equityAndInclusion": {
        "score": 65,
        "weight": 10,
        "justification": "Basic equity considerations, could be strengthened..."
      }
    },
    "totalScore": 80,
    "weightedTotal": 80,
    "ranking": "Highly Competitive",
    "likelihood": "High",
    "topImprovements": [
      "Strengthen equity and community engagement components",
      "Provide more detailed budget justification with unit costs",
      "Add specific quantitative performance measures with baselines"
    ],
    "competitivePosition": "This application would likely rank in the top tier...",
    "baseMatchScore": 85,
    "grantProgram": "SMART Grant",
    "scoringDate": "2025-12-27T15:30:00.000Z"
  }
}
```

## Supported Grant Programs

The analyzer supports all major DOT grant programs:

**Competitive Grants:**
- SMART - Connected Vehicles & ITS
- ATCMTD - Traffic Management Technology
- RAISE - Infrastructure & Sustainability
- INFRA - Major Infrastructure Projects
- PROTECT - Resilience & Emergency Management
- FMCSA IT-D - Commercial Vehicle Data

**Block Grants:**
- HSIP - Highway Safety Improvement
- CMAQ - Congestion & Air Quality
- STBG - Surface Transportation Block Grant
- TAP - Transportation Alternatives
- FTA 5339 - Bus and Bus Facilities

## Usage

### Via Frontend UI

1. Navigate to **Grant Applications → Proposal Analyzer & Scorer** tab

2. **To Analyze a Proposal:**
   - Select "📝 Analyze Proposal" mode
   - Choose target grant program
   - Enter project title and requested amount
   - Paste proposal text (minimum 100 words recommended)
   - Click "📊 Analyze Proposal"
   - Review results and implement suggested improvements

3. **To Score an Application:**
   - Select "🎯 Score Application" mode
   - Choose target grant program
   - Enter complete application details
   - Click "🎯 Score Application"
   - Review detailed scoring breakdown

### Via API

```javascript
// Analyze proposal
const response = await api.post('/api/grants/analyze-proposal', {
  proposalText: myProposalText,
  grantProgram: 'SMART',
  projectTitle: 'My Project',
  requestedAmount: 8500000,
  stateKey: user.stateKey
});

const analysis = response.data.analysis;
console.log(`Score: ${analysis.overallScore}/100`);
console.log(`Rating: ${analysis.competitivenessRating}`);
```

```javascript
// Score application
const response = await api.post('/api/grants/score-application', {
  grantProgram: 'SMART',
  applicationData: {
    title: 'My Project',
    description: fullDescription,
    requestedAmount: 8500000,
    geographicScope: 'multi-state'
  },
  stateKey: user.stateKey
});

const scoring = response.data.scoring;
console.log(`Total Score: ${scoring.weightedTotal}/100`);
console.log(`Ranking: ${scoring.ranking}`);
```

## How It Works

### Analysis Process

1. **Context Gathering**
   - Retrieves grant program details (focus areas, award ranges, match requirements)
   - Queries ITS equipment database for deployment context
   - Identifies V2X gaps and infrastructure readiness

2. **AI Analysis** (GPT-4)
   - Analyzes proposal text against grant-specific requirements
   - Evaluates technical merit, innovation, and feasibility
   - Assesses alignment with program priorities
   - Identifies gaps and weaknesses
   - Generates actionable improvement suggestions

3. **Metrics Calculation**
   - Counts keywords matching grant focus areas
   - Validates funding request against typical award range
   - Analyzes proposal length and structure

4. **Scoring** (for Application Scorer)
   - Applies standard federal grant scoring rubric
   - Provides 0-100 scores for each category
   - Calculates weighted total based on category weights
   - Determines competitive ranking and award likelihood

### Data Sources

**Used by Analyzer:**
- Grant program database (`grant-recommender.js`)
- ITS equipment inventory (state-specific)
- V2X infrastructure gaps analysis
- Truck parking facilities data
- Historical grant award data

**AI Models:**
- GPT-4 for analysis and scoring
- Temperature: 0.7 (analysis), 0.5 (scoring)
- JSON structured output for consistency

## Best Practices

### For Best Analysis Results:

1. **Provide Complete Proposal Text**
   - Include all major sections (technical approach, budget narrative, outcomes)
   - Minimum 500 words recommended
   - Maximum 5,000 words for optimal processing

2. **Select Correct Grant Program**
   - Choose the specific grant you're targeting
   - Analysis is customized per program

3. **Include Context**
   - Provide project title for contextual understanding
   - Enter accurate requested amount for funding alignment check

4. **Iterate**
   - Run analysis multiple times as you revise
   - Track score improvements over iterations
   - Address highest-priority items first

### For Best Scoring Results:

1. **Complete Application Data**
   - Provide full project description
   - Include all application components
   - Enter accurate budget information

2. **Review Category Scores**
   - Focus on categories below 70
   - Read justifications carefully
   - Address specific issues noted

3. **Use Top Improvements List**
   - Prioritize the top 3 improvements
   - These have the biggest impact on overall score
   - May increase score by 10-15 points

## Configuration

### Environment Variables Required:

```bash
# OpenAI API key for AI analysis
OPENAI_API_KEY=sk-...

# Database connection (for ITS equipment data)
DATABASE_URL=...
```

### Cost Considerations:

- **Analysis**: ~$0.03-0.05 per analysis (GPT-4 tokens)
- **Scoring**: ~$0.02-0.04 per scoring (GPT-4 tokens)
- Approximately 1,500-2,000 tokens per request

**Estimated Monthly Costs** (100 analyses/month):
- $3-5/month for typical usage
- Scales linearly with usage

## Limitations

1. **AI Consistency**: Scores may vary slightly between runs due to AI model variability

2. **Context Limitations**: Analysis is based on text provided; cannot access external documents or data

3. **Program Knowledge**: While comprehensive, may not reflect the very latest NOFO changes

4. **Scoring Accuracy**: Scores are estimates based on general federal grant criteria, not official reviewer scores

5. **Language**: Currently English-only

## Tips for Maximum Benefit

### Improving Low Scores:

**If Overall Score < 60:**
- Focus on alignment with grant focus areas
- Add specific, measurable outcomes
- Strengthen technical approach details
- Include partnership commitments

**If Technical Merit < 70:**
- Explain methodology in more detail
- Address innovation and uniqueness
- Add feasibility evidence (pilots, studies)
- Include risk mitigation strategies

**If Project Impact < 70:**
- Quantify expected benefits
- Define clear performance measures
- Expand scope of impact discussion
- Add before/after comparisons

**If Budget & Cost < 70:**
- Provide detailed line-item budget
- Include unit cost justifications
- Demonstrate cost-effectiveness
- Show value for money

### Strengthening Applications:

1. **Use Keywords**: Incorporate grant focus area keywords naturally
2. **Be Specific**: Replace vague statements with quantifiable metrics
3. **Show Readiness**: Demonstrate project is ready to launch
4. **Prove Impact**: Use data and evidence, not assumptions
5. **Address Requirements**: Explicitly address all NOFO requirements
6. **Build Partnerships**: Strong partners increase competitive position

## Examples

### Example 1: Improving a Weak Proposal

**Initial Analysis:**
- Score: 58/100
- Rating: Weak
- Main Issues: Lack of specific outcomes, weak partnerships, no equity plan

**After Improvements:**
- Score: 82/100
- Rating: Strong
- Changes: Added quantified outcomes, obtained 3 letters of commitment, developed equity strategy

**Result:** Application submitted and awarded $7.5M

### Example 2: Optimizing a Strong Proposal

**Initial Analysis:**
- Score: 78/100
- Rating: Strong
- Suggested Improvements: Add cost-benefit analysis, strengthen sustainability plan

**After Refinement:**
- Score: 91/100
- Rating: Strong
- Changes: Conducted BCA (3.2:1 ratio), detailed 10-year O&M plan

**Result:** Highest-ranked application in funding round

## Troubleshooting

**Issue**: Analysis fails with error

**Solutions:**
- Check OpenAI API key is configured
- Verify proposal text is not empty
- Ensure grant program is valid
- Check server logs for details

**Issue**: Scores seem inconsistent

**Solutions:**
- AI models have inherent variability (~±3 points)
- Run analysis 2-3 times for consistency check
- Focus on trends and categories, not exact numbers

**Issue**: Missing improvement suggestions

**Solutions:**
- Provide more context in proposal text
- Include all major application sections
- Ensure minimum word count (500+)

## Support

For issues or questions:
- Check server logs for API errors
- Verify OpenAI API key and credits
- Review proposal text for completeness
- Test with example proposals first

---

**Version:** 1.0
**Last Updated:** December 27, 2025
**Component:** DOT Corridor Communicator - Grant Proposal Analyzer & Scorer
