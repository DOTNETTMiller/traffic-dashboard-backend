# User Login System Documentation

## Overview

The DOT Corridor Communicator now includes a full-featured user authentication system with registration, login, and JWT-based session management.

## Features

✅ **User Registration** - New users can create accounts with username, email, and password
✅ **User Login** - Existing users can log in with username and password
✅ **JWT Authentication** - Secure token-based authentication (7-day expiration)
✅ **Persistent Sessions** - Users stay logged in across browser sessions
✅ **User Profiles** - Support for full name and organization
✅ **Logout** - Secure logout functionality

## Backend API Endpoints

### 1. Register New User
```http
POST /api/users/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword",
  "fullName": "John Doe",           // optional
  "organization": "State DOT"        // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "fullName": "John Doe",
    "organization": "State DOT"
  }
}
```

### 2. User Login
```http
POST /api/users/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "fullName": "John Doe",
    "organization": "State DOT",
    "role": "user"
  }
}
```

### 3. Get Current User (requires authentication)
```http
GET /api/users/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "fullName": "John Doe",
    "organization": "State DOT",
    "role": "user"
  }
}
```

## Frontend Components

### UserLogin Component (`frontend/src/components/UserLogin.jsx`)

A beautiful, modern login/registration form with:
- Tab interface to switch between Login and Register
- Form validation
- Error handling
- Automatic token storage
- Gradient design with responsive layout

### Updated App.jsx

The main App component now:
- Checks for existing authentication on load
- Shows login screen if not authenticated
- Displays user info in header when logged in
- Provides logout functionality
- Persists authentication across browser sessions

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  organization TEXT,
  role TEXT DEFAULT 'user',
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);
```

## Security Features

1. **Password Hashing** - Passwords are hashed using SHA-256 before storage
2. **JWT Tokens** - Secure, stateless authentication with 7-day expiration
3. **Token Verification** - All protected routes verify JWT tokens
4. **Email Validation** - Email format validation on registration
5. **Password Requirements** - Minimum 6 characters

## User Access Levels

Once logged in, users can:
- ✅ View traffic events on map and table views
- ✅ Filter and search events
- ✅ View compliance reports and data quality metrics
- ✅ Send messages to state DOT agencies (state login feature)
- ✅ View all messaging features
- ✅ Access admin panel (currently open, can be restricted by role)

## Testing the System

### Create a Test Account

You can create a test account directly via the frontend, or using curl:

```bash
curl -X POST http://localhost:3001/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "test123",
    "fullName": "Test User",
    "organization": "Test DOT"
  }'
```

### Login with Test Account

```bash
curl -X POST http://localhost:3001/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "test123"
  }'
```

## Configuration

### JWT Secret
The JWT secret is configured in `backend_proxy_server.js`:
```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'ccai2026-traffic-dashboard-secret-key';
```

**For production:** Set the `JWT_SECRET` environment variable to a secure random string.

### Token Expiration
Tokens expire after 7 days. To change this, modify the `expiresIn` parameter in the registration and login endpoints:
```javascript
jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }); // Change '7d' to desired duration
```

## Future Enhancements

Potential additions to the user system:
- [ ] Password reset via email
- [ ] Email verification on registration
- [ ] Role-based access control (admin vs regular users)
- [ ] User profile editing
- [ ] Password change functionality
- [ ] Account deactivation
- [ ] User management admin panel
- [ ] Activity logging

## Files Modified/Created

### Backend
- ✅ `database.js` - Added users table and user management methods
- ✅ `backend_proxy_server.js` - Added user authentication endpoints and middleware
- ✅ `package.json` - Added jsonwebtoken dependency

### Frontend
- ✅ `frontend/src/components/UserLogin.jsx` - New login/registration component
- ✅ `frontend/src/styles/UserLogin.css` - Styling for login component
- ✅ `frontend/src/App.jsx` - Added authentication flow

### Documentation
- ✅ `USER_LOGIN_SYSTEM.md` - This file
- ✅ `LOGIN_CREDENTIALS.md` - State login credentials (separate system)

## Troubleshooting

### "Invalid or expired token" error
- Token may have expired (7-day limit)
- Token may be malformed
- JWT_SECRET may have changed
- **Solution:** Log out and log back in

### Can't register - "Username already exists"
- Username must be unique
- **Solution:** Try a different username

### Can't register - "Invalid email format"
- Email must be valid format (user@domain.com)
- **Solution:** Check email format

## Support

For questions or issues with the user login system, please check:
1. Backend server is running on port 3001
2. Database (states.db) exists and is writable
3. Browser console for error messages
4. Network tab for API response details
