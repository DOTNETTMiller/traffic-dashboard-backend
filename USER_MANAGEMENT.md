# User Management Guide

## Your Login Credentials

**Email/Username:** `matthew.miller@iowadot.us`
**Password:** [Contact system administrator for credentials]

## System Changes

### Email-Based Usernames
All users now log in using their email address as the username. The migration has updated all existing accounts:
- `MM` → `matthew.miller@iowadot.us`
- `testuser` → `test@example.com`
- `admin` → `admin@example.com`

## User Management Options

### Option 1: Web Interface (Recommended for Admins)

As an admin, you can manage all users through the web interface:

1. Log in to your dashboard at the frontend URL
2. Navigate to the **Admin** or **Users** section
3. You'll see all users with options to:
   - **Create new users** - Add users with email (used as username), password, role, etc.
   - **Edit users** - Update user details, role, state affiliation
   - **Reset passwords** - Generate new passwords for users
   - **Activate/Deactivate** - Enable or disable user accounts
   - **Delete users** - Remove users from the system

The interface is intuitive and shows all user information including:
- Email/Username
- Full Name
- Organization
- State Affiliation
- Role (admin/user)
- Active Status
- Last Login

### Option 2: CLI Tool

Run the interactive user management tool from the command line:
```bash
node scripts/manage_users.js
```

#### Features:
1. **List all users** - View all user accounts with details
2. **Create new user** - Add new users (email is used as username)
3. **Reset password** - Change any user's password
4. **Update user details** - Modify email, role, state affiliation, etc.
5. **Delete user** - Remove users from the system
6. **Test login** - Verify credentials work correctly
7. **Quick password reset** - Fast reset for existing accounts

## Admin User Management API

As an admin, you have full access to manage all users via these endpoints:

### List All Users
**GET** `/api/admin/users`

Headers:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

Response:
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "username": "user@example.com",
      "email": "user@example.com",
      "fullName": "John Doe",
      "organization": "DOT",
      "role": "admin",
      "active": true,
      "stateKey": "IA",
      "createdAt": "2025-10-20 12:00:00",
      "lastLogin": "2025-10-22 15:30:00",
      "notifyOnMessages": true,
      "notifyOnHighSeverity": true
    }
  ]
}
```

### Create New User
**POST** `/api/admin/users`

Headers:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

Request body:
```json
{
  "email": "newuser@example.com",
  "password": "optional-password",
  "fullName": "Jane Smith",
  "organization": "Iowa DOT",
  "stateKey": "IA",
  "role": "user"
}
```

If `password` is not provided, a temporary password will be generated and returned.

### Update User
**PUT** `/api/admin/users/:userId`

Headers:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

Request body (all fields optional):
```json
{
  "email": "updated@example.com",
  "fullName": "Updated Name",
  "organization": "New Org",
  "role": "admin",
  "stateKey": "UT",
  "active": true,
  "notifyOnMessages": true,
  "notifyOnHighSeverity": false
}
```

Note: If you update the email, the username will automatically be updated to match.

### Reset User Password (Admin)
**POST** `/api/admin/users/:userId/reset-password`

Headers:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

Request body (optional):
```json
{
  "password": "new-password"
}
```

If no password is provided, a temporary password will be generated and returned.

### Delete User
**DELETE** `/api/admin/users/:userId`

Headers:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## Password Reset Endpoints

### For Logged-In Users
**POST** `/api/users/change-password`

Request body:
```json
{
  "currentPassword": "your-current-password",
  "newPassword": "your-new-password"
}
```

Headers:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

### For Users Who Forgot Password
**POST** `/api/users/request-password-reset`

Request body:
```json
{
  "email": "your-email@example.com"
}
```

This will send an email with a temporary password.

### For Admins
**POST** `/api/admin/users/:userId/reset-password`

Request body (optional):
```json
{
  "password": "new-password"
}
```

If no password is provided, a temporary password will be generated.

## Migration Script

**Note:** Migration now runs automatically on backend startup! No manual migration needed.

If you need to manually re-run the email username migration:
```bash
node scripts/migrate_to_email_usernames.js
```

This script:
- Updates all usernames to match their email addresses
- Sets password for matthew.miller@iowadot.us to `Bim4infra`
- Shows before/after state

## Fallback Login

The backend still supports fallback logins for:
- `MM` or `matthew.miller@iowadot.us` with password `admin2026`
- `admin` or `admin@example.com` with password `admin2026`

These will auto-provision accounts if they don't exist.

## Quick Commands

**List users:**
```bash
sqlite3 states.db "SELECT username, email, role, active FROM users"
```

**Reset your password via CLI:**
```bash
node scripts/manage_users.js
# Select option 7 (Quick password reset)
# Select your user
# Enter new password
```

**Test login:**
```bash
node scripts/manage_users.js
# Select option 6 (Test login)
# Enter: matthew.miller@iowadot.us
# Enter: Bim4infra
```
