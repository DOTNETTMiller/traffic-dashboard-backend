# DOT Corridor Communicator

A real-time traffic event dashboard that aggregates data from multiple state Department of Transportation (DOT) APIs across the I-80 and I-35 corridors. The application provides interactive mapping, filtering, and collaborative messaging features for traffic management professionals.

## Features

- **Interactive Map View**: Visualize traffic events across multiple states with color-coded severity markers
- **Table View**: Sortable table display of all events with detailed information
- **Advanced Filtering**: Filter by state, corridor, event type, severity, and search text
- **Real-time Updates**: Auto-refresh capability to keep data current (60-second intervals)
- **Collaborative Messaging**: Comment and collaborate on specific traffic events with team members
- **Multi-State Coverage**: Nevada, Ohio, New Jersey, Iowa, Kansas, Nebraska, Indiana, Minnesota, and Utah

## Architecture

### Backend (`backend_proxy_server.js`)
- Node.js/Express server
- Aggregates data from 9 state DOT APIs
- Normalizes data formats (JSON/XML) into consistent structure
- CORS-enabled for frontend access
- Deployed on Railway

### Frontend (`frontend/`)
- React 18 with Vite
- Leaflet for interactive maps
- Real-time data fetching with auto-refresh
- Responsive design for desktop and mobile

## Getting Started

### Prerequisites
- Node.js >= 18.0.0
- npm or yarn

### Backend Setup

1. Install dependencies:
```bash
npm install
```

2. Set environment variables (for APIs requiring authentication):
```bash
export NEVADA_API_KEY=your_key
export OHIO_API_KEY=your_key
export TXDOT_API_KEY=your_key
export CARS_USERNAME=your_username
export CARS_PASSWORD=your_password
```

3. Start the backend server:
```bash
npm start
```

The backend will run on `http://localhost:3001`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from example:
```bash
cp .env.example .env
```

4. Update `.env` with your backend URL:
```
VITE_API_URL=http://localhost:3001
```

5. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## API Endpoints

### Backend API

- `GET /api/health` - Health check endpoint
- `GET /api/events` - Get all traffic events from all states
- `GET /api/events/:state` - Get events from a specific state

### Example Response

```json
{
  "success": true,
  "timestamp": "2025-10-17T12:00:00.000Z",
  "totalEvents": 150,
  "events": [
    {
      "id": "NV-12345",
      "state": "Nevada",
      "corridor": "I-80",
      "eventType": "Construction",
      "description": "Road work ahead",
      "location": "I-80 Eastbound MM 45",
      "county": "Washoe",
      "latitude": 39.5296,
      "longitude": -119.8138,
      "startTime": "2025-10-17T08:00:00.000Z",
      "endTime": "2025-10-17T18:00:00.000Z",
      "lanesAffected": "1 lane closed",
      "severity": "medium",
      "direction": "Eastbound"
    }
  ],
  "errors": []
}
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete step-by-step deployment instructions for both backend and frontend to Railway.

### Quick Summary

**Backend (Railway):**
- Already configured with `package.json`
- Deploy from GitHub, set environment variables
- Auto-deploys on push to main

**Frontend (Railway):**
- Configured with `frontend/railway.json`
- Deploy from same GitHub repo, separate service
- Set `VITE_API_URL` environment variable to backend URL
- Uses `serve` to host the built React app

**Alternative:** Frontend can also be deployed to Vercel or Netlify for free static hosting

## State DOT APIs

| State | API Type | Authentication | Corridor |
|-------|----------|----------------|----------|
| Nevada | JSON | API Key | I-80 |
| Ohio | JSON | API Key | I-80 |
| New Jersey | XML | None | I-80 |
| Iowa | XML | CARS Program | I-80 |
| Kansas | XML | CARS Program | I-35 |
| Nebraska | XML | CARS Program | I-80 |
| Indiana | XML | CARS Program | I-80 |
| Minnesota | XML | CARS Program | I-35 |
| Utah | JSON (WZDX) | None | I-80 |

## Future Enhancements

- [ ] WebSocket support for real-time messaging
- [ ] User authentication and authorization
- [ ] Message persistence (database integration)
- [ ] Email/SMS notifications for high-severity events
- [ ] Export data to CSV/PDF
- [ ] Historical event tracking
- [ ] Analytics dashboard
- [ ] Mobile app (React Native)

## License

MIT

## Contributing

Pull requests are welcome! Please open an issue first to discuss proposed changes.
# Trigger redeploy after fixing volume
