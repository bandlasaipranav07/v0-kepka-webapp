const swaggerJsdoc = require("swagger-jsdoc")

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Kepka API",
      version: "1.0.0",
      description:
        "Advanced Cardano Token Platform API - Create, mint, and manage Cardano native tokens with gasless transactions and enhanced security",
      contact: {
        name: "Kepka Team",
        email: "support@kepka.io",
        url: "https://kepka.io",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || "http://localhost:5000",
        description: "Development server",
      },
      {
        url: "https://api.kepka.io",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your Supabase access token",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error type",
            },
            message: {
              type: "string",
              description: "Error message",
            },
            details: {
              type: "array",
              items: {
                type: "object",
              },
              description: "Validation error details",
            },
          },
        },
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            email: {
              type: "string",
              format: "email",
            },
            full_name: {
              type: "string",
            },
          },
        },
        Profile: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            email: {
              type: "string",
              format: "email",
            },
            full_name: {
              type: "string",
            },
            wallet_address: {
              type: "string",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
            updated_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Token: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            token_name: {
              type: "string",
            },
            policy_id: {
              type: "string",
            },
            asset_name: {
              type: "string",
            },
            symbol: {
              type: "string",
            },
            decimals: {
              type: "integer",
            },
            total_supply: {
              type: "integer",
            },
            description: {
              type: "string",
            },
            image_url: {
              type: "string",
            },
            creator_id: {
              type: "string",
              format: "uuid",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
            updated_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Transaction: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            tx_hash: {
              type: "string",
            },
            token_id: {
              type: "string",
              format: "uuid",
            },
            user_id: {
              type: "string",
              format: "uuid",
            },
            transaction_type: {
              type: "string",
              enum: ["mint", "burn", "transfer"],
            },
            amount: {
              type: "integer",
            },
            fee_ada: {
              type: "integer",
            },
            status: {
              type: "string",
              enum: ["pending", "confirmed", "failed"],
            },
            metadata: {
              type: "object",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
            updated_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
        ExchangeRate: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            token_symbol: {
              type: "string",
            },
            price_usd: {
              type: "number",
            },
            price_ada: {
              type: "number",
            },
            volume_24h: {
              type: "number",
            },
            change_24h: {
              type: "number",
            },
            market_cap: {
              type: "number",
            },
            updated_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
        GaslessTransaction: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            user_id: {
              type: "string",
              format: "uuid",
            },
            transaction_id: {
              type: "string",
              format: "uuid",
            },
            sponsor_address: {
              type: "string",
            },
            gas_fee_ada: {
              type: "integer",
            },
            status: {
              type: "string",
              enum: ["pending", "sponsored", "executed", "failed"],
            },
            nonce: {
              type: "integer",
            },
            expires_at: {
              type: "string",
              format: "date-time",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User authentication and authorization",
      },
      {
        name: "Users",
        description: "User profile and wallet management",
      },
      {
        name: "Tokens",
        description: "Cardano native token creation and management",
      },
      {
        name: "Transactions",
        description: "Token minting, burning, and transfer operations",
      },
      {
        name: "Exchange Rates",
        description: "Real-time token price and market data",
      },
      {
        name: "Gasless Transactions",
        description: "Sponsored transactions and security policies",
      },
      {
        name: "Payments",
        description: "Stripe payment processing and subscriptions",
      },
      {
        name: "Admin",
        description: "Administrative functions and monitoring",
      },
    ],
  },
  apis: ["./routes/*.js", "./server.js"], // paths to files containing OpenAPI definitions
}

const specs = swaggerJsdoc(options)

module.exports = specs
