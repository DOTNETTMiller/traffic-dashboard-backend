# ChatGPT Database Access Setup Guide

This guide explains how to give your ChatGPT assistant access to the DOT Corridor Communicator database using secure API endpoints.

## Overview

The system provides read-only API endpoints that ChatGPT can use to:
- Query traffic events across all states
- Check truck parking availability
- View interstate interchanges and detour alerts
- Read event comments and communications
- Access state and user information

## Step 1: Generate an API Key

Run the following command to generate a secure API key:

```bash
node scripts/generate_chatgpt_api_key.js
```

This will output an API key like:
```
API Key: 5523f4afb9cf5ce52cf6232c966b56810873305b770dbe8e55b6dcd6946fa639
```

**Important:** Store this key securely. It cannot be retrieved again.

## Step 2: Get Your Production URL

Find your production URL where the API is hosted:
- **Railway**: `https://your-app.railway.app`
- **Other hosting**: Your custom domain

You can also test locally at `http://localhost:3001`

## Step 3: Configure ChatGPT Custom GPT

### Option A: Using ChatGPT Custom GPT Builder (Recommended)

1. Go to [ChatGPT](https://chat.openai.com)
2. Click on your name → "My GPTs" → "Create a GPT"
3. In the "Configure" tab:
   - **Name**: DOT Corridor Assistant (or your preferred name)
   - **Description**: Access to DOT Corridor Communicator traffic data and parking information
   - **Instructions**: Add instructions for how the GPT should use the data

4. In the "Actions" section:
   - Click "Create new action"
   - Click "Import from URL" (if available) or manually configure:

### Manual Schema Configuration:

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "DOT Corridor Communicator API",
    "version": "1.0.0",
    "description": "Read-only access to traffic events, parking data, and interstate communications"
  },
  "servers": [
    {
      "url": "https://your-production-url.com"
    }
  ],
  "paths": {
    "/api/chatgpt/events": {
      "get": {
        "summary": "Get all traffic events",
        "operationId": "getAllEvents",
        "parameters": [
          {
            "name": "state",
            "in": "query",
            "description": "Filter by state code (e.g., 'ohio', 'georgia')",
            "schema": { "type": "string" }
          },
          {
            "name": "severity",
            "in": "query",
            "description": "Filter by severity (e.g., 'major', 'moderate', 'minor')",
            "schema": { "type": "string" }
          },
          {
            "name": "limit",
            "in": "query",
            "description": "Limit number of results",
            "schema": { "type": "integer" }
          }
        ],
        "responses": {
          "200": {
            "description": "List of traffic events"
          }
        }
      }
    },
    "/api/chatgpt/events/{state}": {
      "get": {
        "summary": "Get events for a specific state",
        "operationId": "getEventsByState",
        "parameters": [
          {
            "name": "state",
            "in": "path",
            "required": true,
            "description": "State code",
            "schema": { "type": "string" }
          }
        ],
        "responses": {
          "200": {
            "description": "List of events for the state"
          }
        }
      }
    },
    "/api/chatgpt/events/id/{eventId}": {
      "get": {
        "summary": "Get specific event with comments",
        "operationId": "getEventById",
        "parameters": [
          {
            "name": "eventId",
            "in": "path",
            "required": true,
            "description": "Event ID",
            "schema": { "type": "string" }
          }
        ],
        "responses": {
          "200": {
            "description": "Event details with comments"
          }
        }
      }
    },
    "/api/chatgpt/parking/facilities": {
      "get": {
        "summary": "Get truck parking facilities",
        "operationId": "getParkingFacilities",
        "parameters": [
          {
            "name": "state",
            "in": "query",
            "description": "Filter by state",
            "schema": { "type": "string" }
          }
        ],
        "responses": {
          "200": {
            "description": "List of parking facilities"
          }
        }
      }
    },
    "/api/chatgpt/parking/availability": {
      "get": {
        "summary": "Get current parking availability",
        "operationId": "getParkingAvailability",
        "parameters": [
          {
            "name": "facilityId",
            "in": "query",
            "description": "Specific facility ID",
            "schema": { "type": "string" }
          }
        ],
        "responses": {
          "200": {
            "description": "Current parking availability"
          }
        }
      }
    },
    "/api/chatgpt/states": {
      "get": {
        "summary": "Get list of all states",
        "operationId": "getStates",
        "responses": {
          "200": {
            "description": "List of states in the system"
          }
        }
      }
    },
    "/api/chatgpt/interchanges": {
      "get": {
        "summary": "Get interstate interchanges",
        "operationId": "getInterchanges",
        "responses": {
          "200": {
            "description": "List of active interchanges"
          }
        }
      }
    },
    "/api/chatgpt/detour-alerts": {
      "get": {
        "summary": "Get active detour alerts",
        "operationId": "getDetourAlerts",
        "responses": {
          "200": {
            "description": "List of active detour alerts"
          }
        }
      }
    },
    "/api/chatgpt/messages": {
      "get": {
        "summary": "Get event comments",
        "operationId": "getMessages",
        "parameters": [
          {
            "name": "state",
            "in": "query",
            "description": "Filter by state",
            "schema": { "type": "string" }
          },
          {
            "name": "limit",
            "in": "query",
            "description": "Limit results",
            "schema": { "type": "integer" }
          }
        ],
        "responses": {
          "200": {
            "description": "List of messages"
          }
        }
      }
    },
    "/api/chatgpt/docs": {
      "get": {
        "summary": "Get API documentation",
        "operationId": "getDocs",
        "responses": {
          "200": {
            "description": "API documentation"
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "ApiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key"
      }
    }
  },
  "security": [
    {
      "ApiKeyAuth": []
    }
  ]
}
```

5. **Authentication Setup**:
   - Authentication Type: **API Key**
   - Auth Type: **Custom**
   - Custom Header Name: `X-API-Key`
   - API Key: Paste your generated API key

6. Click **Save**

## Step 4: Test the Integration

Try these sample queries in your ChatGPT:

- "What traffic events are currently active in Ohio?"
- "Show me truck parking availability in Georgia"
- "Are there any detour alerts active right now?"
- "What's the current status of parking at facility XYZ?"

## Available Endpoints

### Events
- `GET /api/chatgpt/events` - Get all traffic events
  - Query params: `state`, `severity`, `limit`
- `GET /api/chatgpt/events/:state` - Get events for a state
- `GET /api/chatgpt/events/id/:eventId` - Get specific event with comments

### Parking
- `GET /api/chatgpt/parking/facilities` - Get parking facilities
  - Query params: `state`
- `GET /api/chatgpt/parking/availability` - Get current availability
  - Query params: `facilityId`
- `GET /api/chatgpt/parking/history/:facilityId` - Get availability history
  - Query params: `hours` (default: 24)

### States & Communications
- `GET /api/chatgpt/states` - Get list of states
- `GET /api/chatgpt/messages` - Get event comments
  - Query params: `state`, `limit`
- `GET /api/chatgpt/messages/event/:eventId` - Get comments for event

### Interchanges & Alerts
- `GET /api/chatgpt/interchanges` - Get interstate interchanges
- `GET /api/chatgpt/detour-alerts` - Get active detour alerts

### System
- `GET /api/chatgpt/users` - Get users (limited info)
- `GET /api/chatgpt/docs` - Get API documentation

## Security Features

- **Read-only access**: ChatGPT can only read data, not modify it
- **API key authentication**: All requests require a valid API key
- **No sensitive data**: Passwords and credentials are never exposed
- **Rate limiting**: (Consider implementing if needed)

## Troubleshooting

### "Invalid API key" error
- Verify the API key is correct
- Ensure the `X-API-Key` header is being sent
- Regenerate the key if needed: `node scripts/generate_chatgpt_api_key.js`

### "Connection refused" error
- Verify the production URL is correct
- Ensure the server is running
- Check that HTTPS is enabled in production

### ChatGPT can't access the endpoint
- Verify CORS is enabled (it is by default)
- Check that the endpoint URL is correct
- Test the endpoint with curl first:

```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  https://your-domain.com/api/chatgpt/events
```

## Example curl Commands

Test your endpoints locally or in production:

```bash
# Get all events
curl -H "X-API-Key: YOUR_KEY" \
  http://localhost:3001/api/chatgpt/events

# Get events for Ohio
curl -H "X-API-Key: YOUR_KEY" \
  http://localhost:3001/api/chatgpt/events/ohio

# Get parking facilities
curl -H "X-API-Key: YOUR_KEY" \
  http://localhost:3001/api/chatgpt/parking/facilities

# Get API documentation
curl -H "X-API-Key: YOUR_KEY" \
  http://localhost:3001/api/chatgpt/docs
```

## Production Deployment

When deploying to production (Railway, etc.):

1. The API key will work automatically in production
2. Update the ChatGPT GPT configuration with your production URL
3. Test the endpoints using the production URL
4. The API uses the same database as your main application

## Regenerating API Keys

If you need to regenerate the API key:

```bash
node scripts/generate_chatgpt_api_key.js
```

Note: The old key will still work. To revoke old keys, you'll need to manually delete them from the `admin_tokens` table in the database.

## Support

For issues or questions, check:
- Server logs for error messages
- Network tab in browser dev tools
- Test endpoints with curl before configuring ChatGPT
