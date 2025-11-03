# ChatGPT Quick Setup Guide

Follow these steps to give your ChatGPT assistant access to the database.

## Step 1: Get Your API Key

Your API Key is:
```
5523f4afb9cf5ce52cf6232c966b56810873305b770dbe8e55b6dcd6946fa639
```

**Save this somewhere safe!**

## Step 2: Create a Custom GPT

1. Go to https://chat.openai.com
2. Click on your name (bottom left)
3. Select "My GPTs"
4. Click "Create a GPT"
5. Click "Configure" tab

## Step 3: Configure the GPT

### Name and Description
- **Name**: DOT Corridor Assistant
- **Description**: Access to real-time traffic data, parking info, and DOT communications across 44 states

### Instructions
Paste this into the instructions box:

```
You are an assistant for the DOT Corridor Communicator system. You have access to real-time traffic events, truck parking availability, and interstate communications from 44 state DOT systems.

When users ask about traffic, road conditions, or parking:
- Query the appropriate endpoints to get current data
- Provide clear, actionable information
- Include relevant details like location, severity, and timing
- Mention which state DOT provided the information

Available data:
- Traffic events (construction, incidents, closures) from all 44 states
- Real-time truck parking availability
- Interstate interchange monitoring and detour alerts
- Comments and communications from DOT officials

Be helpful and provide context. If data is not available for a specific state or facility, let the user know.
```

## Step 4: Add Actions (API Integration)

1. Scroll down to **Actions** section
2. Click **"Create new action"**
3. Click **"Import from URL"** (if available) OR **"Edit in JSON"**

### Option A: Import from URL (Easiest)
If your server is running:
- Paste: `http://localhost:3001/api/chatgpt/docs`
- OR for production: `https://corridor-communication-dashboard-production.up.railway.app/api/chatgpt/docs`

### Option B: Paste JSON Schema
Copy the entire contents of `chatgpt_config.json` and paste it into the schema editor.

## Step 5: Configure Authentication

1. In the Actions section, find **Authentication**
2. Select **"API Key"**
3. Configure:
   - **Auth Type**: Custom
   - **Custom Header Name**: `X-API-Key`
   - **API Key**: `5523f4afb9cf5ce52cf6232c966b56810873305b770dbe8e55b6dcd6946fa639`

## Step 6: Update Server URL

1. In the schema, find the `servers` section
2. Change the URL to your production URL:
   ```json
   "servers": [
     {
       "url": "https://your-railway-app.railway.app",
       "description": "Production Server"
     }
   ]
   ```

   Or use localhost for testing:
   ```json
   "servers": [
     {
       "url": "http://localhost:3001",
       "description": "Local Server"
     }
   ]
   ```

## Step 7: Save and Test

1. Click **"Save"** in the top right
2. Test with these queries:
   - "What traffic events are currently active in Ohio?"
   - "Show me all major incidents right now"
   - "What's the truck parking availability in Kentucky?"
   - "Are there any detour alerts active?"
   - "List all the states in the system"

## Quick Test Commands

Once configured, try these:

- **Get all events**: "Show me current traffic events"
- **Filter by state**: "What's happening in Georgia?"
- **Check parking**: "Is there truck parking available?"
- **View states**: "What states are in the system?"

## Troubleshooting

### "API returned error"
- Make sure your server is running (locally or in production)
- Verify the URL in the schema matches your server URL
- Check that the API key is correct

### "Authentication failed"
- Verify the header name is exactly `X-API-Key` (case-sensitive)
- Check that you copied the full API key

### "No data returned"
- The events endpoint can take 30-60 seconds on first load (fetches from 44 states)
- Try simpler endpoints first like `/api/chatgpt/states`

## Production URL

If you're deploying to Railway, your production URL is likely:
```
https://corridor-communication-dashboard-production.up.railway.app
```

Make sure to update the `servers` section in the schema to use this URL instead of localhost.

## Need Help?

- Check `docs/CHATGPT_API_SETUP.md` for full documentation
- View `chatgpt_config.json` for the complete schema
- Test endpoints manually with curl:
  ```bash
  curl -H "X-API-Key: YOUR_KEY" \
    http://localhost:3001/api/chatgpt/states
  ```

## Security Note

The API key provides **read-only** access to the database. ChatGPT can view data but cannot modify, delete, or create anything. All endpoints are designed for safe, read-only queries.
