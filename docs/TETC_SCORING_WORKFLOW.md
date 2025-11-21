# TETC Data Quality Scoring Workflow

Automated workflow for getting MDODE scores from ChatGPT and inserting them into your PostgreSQL database.

## Quick Start

### 1. Generate ChatGPT Prompts
```bash
node scripts/generate_chatgpt_prompts.js
```

This creates:
- Individual prompt files in `data/chatgpt_prompts/`
- Console output with all prompts

### 2. Get Scores from ChatGPT

For each prompt:
1. Copy the generated prompt
2. Paste into ChatGPT (GPT-4 recommended)
3. ChatGPT returns a JSON object with MDODE scores
4. Save the JSON to `data/chatgpt_responses/[feed_name].json`

**Tip**: You can combine multiple responses into a single JSON array in `data/chatgpt_responses/all_scores.json`

### 3. Insert Scores into Database

```bash
# Single feed
railway run node scripts/insert_chatgpt_scores.js data/chatgpt_responses/carto_travel_time_speed.json

# All feeds at once
railway run node scripts/insert_chatgpt_scores.js data/chatgpt_responses/all_scores.json
```

## MDODE Framework

### Categories (each 0-100 points):

1. **Metadata (M)**
   - API documentation completeness (0-25)
   - Field descriptions and data dictionary (0-25)
   - Update frequency documentation (0-25)
   - Contact information and support (0-25)

2. **Data Quality (D)**
   - Accuracy: Data matches ground truth (0-25)
   - Completeness: All expected fields populated (0-25)
   - Consistency: Data format is uniform (0-25)
   - Timeliness: Updates meet stated frequency (0-25)

3. **Operational (O)**
   - Uptime/Reliability: Service availability (0-25)
   - Response time: API performance (0-25)
   - Error handling: Graceful degradation (0-25)
   - Monitoring: Health check endpoints (0-25)

4. **Documentation (D)**
   - User guide quality (0-25)
   - API examples and sample code (0-25)
   - Change log maintenance (0-25)
   - Troubleshooting guides (0-25)

5. **Extensibility (E)**
   - Standard data formats (GeoJSON, JSON, XML) (0-25)
   - Multiple output formats available (0-25)
   - Filtering and query capabilities (0-25)
   - Integration ease (webhooks, callbacks) (0-25)

### Grading Scale:
- **A**: 90-100 DQI
- **B**: 80-89 DQI
- **C**: 70-79 DQI
- **D**: 60-69 DQI
- **F**: 0-59 DQI

**DQI** (Data Quality Index) = Average of all 5 category scores

## Example ChatGPT Response

```json
{
  "feed_name": "INRIX Travel Time & Speed",
  "service_type": "travel_time_speed",
  "provider": "INRIX",
  "metadata_score": 85,
  "data_quality_score": 92,
  "operational_score": 88,
  "documentation_score": 82,
  "extensibility_score": 90,
  "dqi": 87.4,
  "letter_grade": "B",
  "evaluation_date": "2025-11-18",
  "validation_report_id": "TDM-VAL-02",
  "validation_report_title": "Initial TDM Validation Activity: Volume & Travel Time Study",
  "validation_report_url": "https://tetcoalition.org/wp-content/uploads/2015/02/TDM-Val-02-Report-FINAL-V2.4.pdf",
  "validation_geography": "North Carolina continuous count stations",
  "validation_study_period": "Aug–Sep 2022 (per report)",
  "evaluator_notes": "INRIX demonstrates strong data quality and operational excellence with mature API infrastructure. Documentation could be enhanced with more examples.",
  "metadata_notes": "Comprehensive API documentation and data dictionary. Well-documented update frequencies and support channels.",
  "data_quality_notes": "High accuracy compared to NCDOT reference data. Consistent formatting and timely updates. Complete field coverage.",
  "operational_notes": "Excellent uptime and reliability. Fast API response times. Good error handling and monitoring capabilities.",
  "documentation_notes": "Solid user guides and API documentation. Some gaps in troubleshooting guides and advanced examples.",
  "extensibility_notes": "Strong support for standard formats. Flexible filtering and query capabilities. Easy integration with webhooks."
}
```

## File Structure

```
data/
├── incomplete_tetc_scores.json          # Input: Feeds needing scores
├── chatgpt_prompts/                     # Generated prompts for ChatGPT
│   ├── carto_travel_time_speed_prompt.txt
│   ├── here_travel_time_speed_prompt.txt
│   └── ...
└── chatgpt_responses/                   # ChatGPT JSON responses
    ├── carto_travel_time_speed.json
    ├── here_travel_time_speed.json
    └── all_scores.json                  # Combined responses

scripts/
├── generate_chatgpt_prompts.js          # Step 1: Generate prompts
└── insert_chatgpt_scores.js             # Step 3: Insert into database
```

## Tips

1. **Batch Processing**: Copy all prompts at once and have ChatGPT score multiple feeds in sequence
2. **Validation Report**: Include the validation report URL in your ChatGPT conversation for better context
3. **Custom Scoring**: You can manually adjust ChatGPT's scores before inserting if needed
4. **Updates**: Re-run for the same feed to update existing scores in the database

## Troubleshooting

**Error: "Missing required fields"**
- Ensure ChatGPT returns valid JSON with feed_name, service_type, and provider

**Error: "Failed to parse JSON"**
- Remove markdown code blocks (```json) from ChatGPT's response
- Ensure valid JSON format with no trailing commas

**Error: "DATABASE_URL not set"**
- Run via Railway: `railway run node scripts/insert_chatgpt_scores.js ...`
- Or set DATABASE_URL locally for testing

## Current Feeds Needing Scores

- ✅ 14 feeds with incomplete MDODE scores
- Travel Time & Speed: Carto, HERE, INRIX, Iteris, Timmons (5 feeds)
- Volume: HERE, INRIX, Iteris, StreetLight, Replica (5 feeds)
- Origin-Destination: AirSage, Geotab, INRIX, StreetLight (4 feeds)
