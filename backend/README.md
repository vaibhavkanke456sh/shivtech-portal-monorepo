# DSAM Portal Backend

A comprehensive authentication and user management backend for the DSAM Portal, supporting multiple user roles (User, Admin, Web Developer) with role-based access control.

## Features

- 🔐 **Multi-role Authentication**: Support for users, admins, and web developers
- 🛡️ **Security**: JWT tokens, password hashing, rate limiting, and CORS protection
- 📧 **Email Verification**: Email verification and password reset functionality
- 👥 **User Management**: Complete CRUD operations for user management
- 🔒 **Role-based Access Control**: Granular permissions system
- 📊 **Admin Dashboard**: User statistics and analytics
- 🚀 **RESTful API**: Clean and well-documented API endpoints

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **Nodemailer** - Email functionality
- **Express Validator** - Input validation
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy the example environment file
   cp env.example .env
   
   # Edit .env with your configuration
   nano .env
   ```

4. **Database Setup**
   ```bash
   # Start MongoDB (if using local)
   mongod
   
   # Or use MongoDB Atlas (cloud)
   # Update MONGODB_URI in .env
   ```

5. **Seed Database (Optional)**
   ```bash
   npm run seed
   ```

6. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/dsam_portal

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_REFRESH_EXPIRES_IN=7d

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_SECURE=false
EMAIL_FROM="DSAM Portal <your-email@gmail.com>"

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

## API Endpoints

### Authentication Routes

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/api/auth/register` | Register new user | Public |
| POST | `/api/auth/login` | User login | Public |
| POST | `/api/auth/refresh` | Refresh access token | Public |
| POST | `/api/auth/logout` | User logout | Private |
| GET | `/api/auth/me` | Get user profile | Private |
| PUT | `/api/auth/profile` | Update user profile | Private |
| PUT | `/api/auth/change-password` | Change password (requires OTP) | Private |
| PATCH | `/api/auth/change-password` | Change password (requires OTP) | Private |
| POST | `/api/auth/forgot-password` | Forgot password | Public |
| POST | `/api/auth/reset-password` | Reset password | Public |
| POST | `/api/auth/verify-email` | Verify email | Public |
| POST | `/api/auth/resend-verification` | Resend verification email | Private |
| POST | `/api/auth/request-otp` | Request OTP for change password/username | Private |
| POST | `/api/auth/verify-otp` | Verify OTP | Private |

### Admin Routes

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/api/admin/users` | Get all users | Admin/Developer |
| GET | `/api/admin/users/:id` | Get user by ID | Admin/Developer |
| POST | `/api/admin/users` | Create new user | Admin/Developer |
| PUT | `/api/admin/users/:id` | Update user | Admin/Developer |
| DELETE | `/api/admin/users/:id` | Delete user | Web Developer |
| GET | `/api/admin/stats` | Get user statistics | Admin/Developer |
| PUT | `/api/admin/users/bulk-update` | Bulk update users | Admin/Developer |
| GET | `/api/admin/users/:id/activity` | Get user activity | Admin/Developer |
| POST | `/api/admin/create-admin` | Create Admin | Web Developer |
| POST | `/api/admin/create-user` | Create User | Web Developer/Admin |
| PATCH | `/api/admin/change-username` | Change username (via OTP) | Web Developer |
| DELETE | `/api/admin/delete-account/:id` | Delete account | Web Developer |

## User Roles & Permissions

### User Roles
1. **User** - Basic access to dashboard
2. **Admin** - User management and analytics
3. **Web Developer** - Full system access

### Permissions
- `read_dashboard` - View dashboard
- `write_dashboard` - Modify dashboard
- `manage_users` - Manage regular users
- `manage_admins` - Manage admin users
- `manage_developers` - Manage developer users
- `view_analytics` - View analytics
- `manage_content` - Manage content
- `system_settings` - System configuration

## Usage Examples

### Register a New User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "user@example.com",
    "password": "Password123!",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!"
  }'
```

### Get User Profile (with token)
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get All Users (Admin only)
```bash
curl -X GET http://localhost:5000/api/admin/users \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

## Testing

### Seed Data
The application comes with pre-configured test users:

- **Admin**: `admin@dsamportal.com` / `Admin123!`
- **Developer**: `developer@dsamportal.com` / `Developer123!`
- **User**: `user1@dsamportal.com` / `User123!`
- **Unverified User**: `user2@dsamportal.com` / `User123!`

### Run Seed Script
```bash
npm run seed
```

## Security Features

- **Password Hashing**: All passwords are hashed using bcrypt
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevents brute force attacks
- **Input Validation**: All inputs are validated and sanitized
- **CORS Protection**: Configurable cross-origin resource sharing
- **Helmet**: Security headers middleware
- **Account Locking**: Automatic account lockout after failed attempts

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [] // Validation errors (if any)
}
```

## Development

### Scripts
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm run seed` - Seed database with test data

### File Structure
```
backend/
├── config/
│   └── database.js
├── controllers/
│   ├── authController.js
│   └── adminController.js
├── middleware/
│   ├── auth.js
│   └── errorHandler.js
├── models/
│   └── User.js
├── routes/
│   ├── auth.js
│   └── admin.js
├── scripts/
│   └── seedData.js
├── server.js
├── package.json
└── README.md
```

## Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT secrets
- [ ] Configure MongoDB Atlas or production database
- [ ] Set up email service (Gmail, SendGrid, etc.)
- [ ] Configure CORS for production domain
- [ ] Set up SSL/TLS certificates
- [ ] Configure environment variables
- [ ] Set up monitoring and logging

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.
#   B a c k e n d   u p d a t e d   w i t h   r e s t o r e   e n d p o i n t  
 