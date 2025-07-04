# TAIC - Transformative AI Commerce Platform

This project is an advanced e-commerce platform featuring AI-powered shopping assistance, merchant tools, and virtual try-on capabilities. It's built with a modern microservices architecture using Next.js, FastAPI, and MCP (Model-Controller-Presenter) pattern.

## Architecture Overview

The system is built with a modular architecture that combines a Next.js frontend with a FastAPI backend. The backend follows an MCP (Model-Controller-Presenter) pattern for organizing agent-based functionality.

### Core Components

1. **Frontend (Next.js)**: The main user interface and client-side logic
2. **Backend (FastAPI)**: Core API endpoints, business logic, and MCP services
3. **Database (PostgreSQL)**: Data persistence layer
4. **AI Services**: Integrated AI capabilities (OpenAI, LiveKit, etc.)

## Service Configuration

### Core Services

| Service | Port | Description |
|---------|------|-------------|
| Next.js Frontend | 9002 | Main web interface and client-side logic |
| FastAPI Backend | 8000 | Core API endpoints, business logic, and MCP services |
| PostgreSQL | 5432 | Primary database |
| AI Development Server | N/A | AI flows and tools development server (runs with `npm run dev:ai`) |

### Environment Files

The project uses environment files for configuration:

1. **`.env.local`** (Project Root)
   - Next.js frontend configuration
   - Firebase, Stripe, and client-side API keys
   - Frontend-specific environment variables

2. **`fastapi_ai_backend/.env`**
   - Backend server configuration
   - Database connection strings
   - API keys for backend services
   - LiveKit, HeyGen, and OpenRouter configurations
   - MCP (Model-Controller-Presenter) service settings

## Prerequisites

- Python 3.8+
- Node.js 16+
- npm or yarn
- PostgreSQL 13+
- Virtual environment (recommended)
- Docker (optional, for containerized deployment)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd TAIC-Master
```

### 2. Backend Setup

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate

# Install Python dependencies
cd fastapi_ai_backend
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration (see Environment Files section)

# Run database migrations
alembic upgrade head
```

### 3. Agent MCP Service Setup

```bash
# Navigate to agent service directory
cd agent_service

# Install agent service dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Configure with your OpenRouter API key and other settings

# Return to project root
cd ../..
```

### 4. Frontend Setup

```bash
# Install Node.js dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Configure frontend settings (API endpoints, Firebase, etc.)
```

## Running the Application

For development, you'll need to start multiple services. It's recommended to use separate terminal windows.

### Start the Backend API

```bash
# In terminal 1
cd fastapi_ai_backend
uvicorn app.main:app --reload --port 8000
```

### Start the MCP Services

The MCP services are automatically started with the main FastAPI backend. No separate service is needed.

### Start the Frontend

```bash
# In terminal 3 (from project root)
npm run dev
```

## Accessing the Application

- **Frontend**: http://localhost:9002
- **Backend API Docs**: http://localhost:8000/docs
- **Agent MCP Service**: http://localhost:8001 (primarily for internal API use)

## Development Workflow

1. **Database Migrations**:
   ```bash
   cd fastapi_ai_backend
   alembic revision --autogenerate -m "Your migration message"
   alembic upgrade head
   ```

2. **Environment Variables**:
   - Keep sensitive keys out of version control
   - Use `.env` files (in .gitignore by default)
   - Follow the examples in the `.example` files

## Key API Endpoints

### Frontend API (Next.js)
- `/api/ai/chat`: Main endpoint for AI chat interactions
- `/api/products/*`: Product catalog endpoints
- `/api/auth/*`: Authentication endpoints

### Backend API (FastAPI)
- `/api/v1/*`: Versioned API endpoints
- `/api/mcp/*`: MCP service endpoints
- `/docs`: Interactive API documentation (Swagger UI)
- `/redoc`: Alternative API documentation

### MCP Services (Mounted at /api/mcp/)
- `/api/mcp/cj-dropshipping`: CJ Dropshipping integration
- `/api/mcp/gift-recommendation`: Gift recommendation service
- `/api/mcp/product-service`: Product catalog service
- `/api/mcp/shopping-assistant`: AI Shopping Assistant service

## Development Notes

- **Service Dependencies**:
  - Frontend requires both backend and agent services to be running
  - Agent service requires OpenRouter API key for AI capabilities
  - Backend requires PostgreSQL connection

- **Environment Variables**:
  - Each service has its own `.env` file
  - Never commit sensitive data to version control
  - Use `.env.example` files as templates

## Troubleshooting

### Common Issues

1. **Port Conflicts**:
   - Frontend: 9002
   - Backend: 8000
   - Agent: 8001
   - PostgreSQL: 5432

2. **Database Connection**:
   - Verify PostgreSQL is running
   - Check connection string in `fastapi_ai_backend/.env`
   - Run migrations if needed

3. **MCP Services**:
   - Verify OpenRouter API key is set in `fastapi_ai_backend/.env`
   - Check backend logs for any MCP service initialization errors

4. **Dependencies**:
   - Python packages: `pip install -r requirements.txt`
   - Node modules: `npm install`
   - Virtual environment activated?

## Production Considerations

- Use environment-specific configuration files
- Set up proper CORS policies
- Implement rate limiting
- Use HTTPS in production
- Monitor service health and logs

## License

[Your License Here]
