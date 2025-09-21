# Kepka API - Advanced Cardano Token Platform

A comprehensive Node.js API for creating, minting, and managing Cardano native tokens with gasless transactions and enhanced security features.

## 🚀 Features

- **Gasless Transactions**: Execute token operations without paying ADA fees
- **Real-time Exchange Rates**: Live price feeds and market data
- **Enhanced Security**: Multi-signature wallets and security policies
- **Stripe Integration**: Payment processing and subscription management
- **Real-time Updates**: WebSocket support for live notifications
- **Comprehensive API**: RESTful endpoints with OpenAPI documentation

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- PostgreSQL database (via Supabase)
- Stripe account for payments
- Cardano node access (for blockchain operations)

## 🛠️ Installation

1. **Clone the repository**
   \`\`\`bash
   git clone https://github.com/kepka/kepka-api.git
   cd kepka-api
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Environment Configuration**
   \`\`\`bash
   cp .env.example .env
   \`\`\`
   
   Update the `.env` file with your configuration:
   \`\`\`env
   # Database Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # Stripe Configuration
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

   # Server Configuration
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   JWT_SECRET=your_jwt_secret_key
   \`\`\`

4. **Database Setup**
   
   Run the SQL scripts in order:
   \`\`\`bash
   # Execute these scripts in your Supabase SQL editor or via psql
   scripts/001_create_database_schema.sql
   scripts/002_gasless_transaction_system.sql
   scripts/003_admin_panel_tables.sql
   scripts/005_stripe_payment_tables.sql
   \`\`\`

5. **Start the server**
   \`\`\`bash
   # Development
   npm run dev

   # Production
   npm start
   \`\`\`

## 📚 API Documentation

Once the server is running, visit:
- **API Documentation**: http://localhost:5000/api-docs
- **Health Check**: http://localhost:5000/health
- **Landing Page**: http://localhost:5000

## 🔐 Authentication

The API uses Supabase Auth with JWT tokens. Include the token in the Authorization header:

\`\`\`bash
Authorization: Bearer your_access_token
\`\`\`

### Authentication Endpoints

- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

## 🪙 Token Management

### Token Endpoints

- `GET /api/tokens` - Get user's tokens
- `GET /api/tokens/:id` - Get specific token
- `POST /api/tokens` - Create new token
- `PUT /api/tokens/:id` - Update token

### Example: Create Token

\`\`\`bash
curl -X POST http://localhost:5000/api/tokens \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "token_name": "MyToken",
    "symbol": "MTK",
    "policy_id": "your_policy_id",
    "asset_name": "MyToken",
    "decimals": 6,
    "total_supply": 1000000,
    "description": "My awesome token"
  }'
\`\`\`

## 💸 Transactions

### Transaction Endpoints

- `GET /api/transactions` - Get user's transactions
- `GET /api/transactions/:id` - Get specific transaction
- `POST /api/transactions` - Create new transaction
- `PATCH /api/transactions/:id/status` - Update transaction status

### Example: Create Transaction

\`\`\`bash
curl -X POST http://localhost:5000/api/transactions \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "token_id": "token_uuid",
    "transaction_type": "mint",
    "amount": 1000,
    "tx_hash": "transaction_hash_from_cardano"
  }'
\`\`\`

## ⚡ Gasless Transactions

### Gasless Endpoints

- `POST /api/gasless/sponsor` - Sponsor a gasless transaction
- `GET /api/gasless/transactions` - Get gasless transactions
- `GET /api/gasless/policies` - Get security policies
- `POST /api/gasless/policies` - Create security policy

### Example: Sponsor Transaction

\`\`\`bash
curl -X POST http://localhost:5000/api/gasless/sponsor \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "transaction_uuid",
    "estimated_fee": 200000
  }'
\`\`\`

## 📈 Exchange Rates

### Exchange Rate Endpoints

- `GET /api/exchange-rates` - Get all exchange rates
- `GET /api/exchange-rates/:symbol` - Get rate for specific token
- `POST /api/exchange-rates` - Update exchange rates (Admin only)

## 💳 Payments

### Payment Endpoints

- `POST /api/payments/create-intent` - Create payment intent
- `GET /api/payments/plans` - Get subscription plans
- `GET /api/payments/subscriptions` - Get user subscription
- `POST /api/payments/subscriptions` - Create subscription
- `POST /api/payments/webhooks` - Stripe webhook handler

## 👤 User Management

### User Endpoints

- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/wallet-connections` - Get wallet connections
- `POST /api/users/wallet-connections` - Add wallet connection

## 🔧 Admin Panel

### Admin Endpoints

- `GET /api/admin/stats` - Get platform statistics
- `GET /api/admin/users` - Get all users (Admin only)
- `GET /api/admin/tokens` - Get all tokens (Admin only)
- `GET /api/admin/reports` - Get token reports (Admin only)

## 🌐 Real-time Updates

The API supports real-time updates via Socket.IO:

\`\`\`javascript
const io = require('socket.io-client');
const socket = io('http://localhost:5000');

// Join user room for personalized updates
socket.emit('join-user-room', userId);

// Listen for events
socket.on('token-created', (token) => {
  console.log('New token created:', token);
});

socket.on('transaction-updated', (transaction) => {
  console.log('Transaction updated:', transaction);
});
\`\`\`

## 🧪 Testing

\`\`\`bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
\`\`\`

## 📊 Monitoring

### Health Check

\`\`\`bash
curl http://localhost:5000/health
\`\`\`

Response:
\`\`\`json
{
  "status": "OK",
  "timestamp": "2025-01-21T10:30:00.000Z",
  "uptime": 3600,
  "environment": "development"
}
\`\`\`

### Logging

Logs are written to:
- `logs/error.log` - Error logs only
- `logs/combined.log` - All logs
- Console output in development

## 🚀 Deployment

### Docker Deployment

\`\`\`dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
\`\`\`

### Environment Variables for Production

\`\`\`env
NODE_ENV=production
PORT=5000
LOG_LEVEL=info
FRONTEND_URL=https://your-frontend-domain.com
API_BASE_URL=https://api.your-domain.com
\`\`\`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: http://localhost:5000/api-docs
- **Issues**: https://github.com/kepka/kepka-api/issues
- **Email**: support@kepka.io

## 🔗 Links

- **Website**: https://kepka.io
- **Documentation**: https://docs.kepka.io
- **Status Page**: https://status.kepka.io
