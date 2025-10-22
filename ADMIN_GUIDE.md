# Admin User Management Guide

## Your Admin Access

You are logged in as an **admin** user with full access to manage all users in the system.

**Your Login:**
- Email/Username: `matthew.miller@iowadot.us`
- Password: `Bim4infra`
- Role: `admin`

## How to Manage Users

### Web Interface (Easiest Method)

1. **Log in** to the dashboard with your credentials above
2. **Navigate to Admin → Users** section
3. You'll see a complete list of all users with their details

**What You Can Do:**
- ✅ View all users with their roles, status, and last login
- ✅ Create new users (email = username)
- ✅ Edit user details (name, organization, state, role)
- ✅ Reset user passwords
- ✅ Activate/deactivate user accounts
- ✅ Delete users
- ✅ Change user roles (admin/user)
- ✅ Set state affiliations

### Command Line Interface

For quick tasks or bulk operations:

```bash
node scripts/manage_users.js
```

This opens an interactive menu with the same capabilities as the web interface.

### API Access

For programmatic access, you can use these admin endpoints:

**Get your JWT token first** by logging in:
```bash
curl -X POST http://localhost:3001/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"matthew.miller@iowadot.us","password":"Bim4infra"}'
```

Then use the returned token in subsequent requests:

**List all users:**
```bash
curl -X GET http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Create a user:**
```bash
curl -X POST http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123",
    "fullName": "John Doe",
    "organization": "Iowa DOT",
    "stateKey": "IA",
    "role": "user"
  }'
```

**Reset a user's password:**
```bash
curl -X POST http://localhost:3001/api/admin/users/3/reset-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password": "NewPassword123"}'
```

## Common Admin Tasks

### Adding a New State Administrator

1. Go to **Admin → Users** in web interface
2. Click **Create New User**
3. Fill in:
   - Email: `admin@statedot.gov` (this becomes their username)
   - Password: Choose a secure password or leave blank for auto-generated
   - Full Name: Their full name
   - Organization: `State DOT`
   - State Key: `XX` (their state abbreviation)
   - Role: `admin`
4. Click **Create**
5. Share the credentials securely with the new admin

### Resetting a Forgotten Password

**Web Interface:**
1. Go to **Admin → Users**
2. Find the user in the list
3. Click **Reset Password**
4. A temporary password will be generated
5. Share it securely with the user

**CLI:**
```bash
node scripts/manage_users.js
# Select option 7 (Quick password reset)
# Choose the user
# Enter new password
```

### Deactivating a User (Without Deleting)

1. Go to **Admin → Users**
2. Find the user
3. Click **Edit**
4. Uncheck **Active**
5. Click **Update**

The user's account is preserved but they can't log in.

### Viewing User Activity

In the users list, you can see:
- **Last Login** - When the user last accessed the system
- **Created At** - When the account was created
- **Active Status** - Whether they can log in

## Current System Status

You currently have **3 admin users**:
- `test@example.com`
- `matthew.miller@iowadot.us` (you)
- `admin@example.com`

All are using email-based usernames as designed.

## Testing & Verification

To verify your system is working:

```bash
node scripts/test_user_system.js
```

This runs automated tests to ensure:
- All users are properly configured
- Email-based usernames are working
- Your login credentials work
- Database schema is correct

## Security Best Practices

1. **Strong Passwords** - Require minimum 8 characters with mix of letters, numbers, symbols
2. **Regular Audits** - Review active users monthly
3. **Role-Based Access** - Only assign admin role when necessary
4. **Deactivate, Don't Delete** - Keep user history by deactivating instead of deleting
5. **Password Resets** - Generate temporary passwords and require users to change them

## Getting Help

- **User Management Reference:** See `USER_MANAGEMENT.md`
- **CLI Tool:** Run `node scripts/manage_users.js`
- **API Documentation:** See admin endpoints in `USER_MANAGEMENT.md`
- **Test System:** Run `node scripts/test_user_system.js`
