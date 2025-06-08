# TAIC AI Services

This directory contains the FastAPI backend services for AI-powered features of the TAIC platform.

## Communication Strategy with Next.js Application

The primary method for interaction between the main Next.js application (frontend or its API routes) and these FastAPI AI services will be through **Next.js API routes acting as proxies**.

**Flow:**

1.  **Frontend Request:** The Next.js client-side application (user's browser) makes a request to a specific Next.js API route (e.g., `/api/ai/shopping-assistant/query`).
2.  **Next.js API Route (Proxy):**
    *   This Next.js API route receives the request.
    *   It performs **user authentication and authorization** using the existing JWT-based authentication system managed by the Next.js backend (`AuthContext`, `/api/auth/me`, etc.).
    *   If the user is authenticated and authorized, the Next.js API route then constructs a new request to the relevant FastAPI AI service endpoint (e.g., `http://localhost:8001/api/v1/shopping_assistant/query`, where `localhost:8001` is the address of the running FastAPI service). This URL should be configurable via environment variables in the Next.js application.
    *   This request from Next.js to FastAPI is a **server-to-server request**. It can securely include data like the authenticated `userId` or other context if the AI service requires it.
3.  **FastAPI AI Service:**
    *   The FastAPI service receives the request from the Next.js backend.
    *   It processes the request (e.g., queries its database via `product_service`, interacts with an LLM via Genkit – future steps).
    *   It returns a response to the Next.js API route.
4.  **Next.js API Route Response:**
    *   The Next.js API route receives the response from the FastAPI service.
    *   It may perform any necessary data transformation or logging.
    *   It then sends the final response back to the Next.js client-side application.

**Benefits of this Approach:**

*   **Security:** The FastAPI AI services are not directly exposed to the public internet. They only need to accept requests from the trusted Next.js backend environment.
*   **Leverages Existing Auth:** User authentication is handled by the established Next.js authentication system. This avoids the need to reimplement complex authentication/authorization logic directly within each FastAPI service for client-facing interactions.
*   **Centralized API Gateway:** Next.js API routes act as a unified gateway for the frontend, simplifying client-side logic.
*   **Decoupling & Scalability:** Allows AI services to be developed, managed, scaled, and potentially deployed independently of the main Next.js application. Different services could even be written in different languages if needed in the extreme future, though Python/FastAPI is the current choice.
*   **Configuration Management:** The Next.js proxy route can securely manage any specific URLs or keys needed to communicate with the FastAPI service(s) using its own environment variables.

**FastAPI Service Configuration:**

*   FastAPI services should be configured to listen on a specific port (e.g., 8001, 8002, etc., distinct from Next.js's default 3000). This port should be configurable via environment variables for the FastAPI service itself.
*   The base URL for the AI services cluster (e.g., `http://localhost:8001` in development, or an internal service discovery URL in production) should be configured as an environment variable in the Next.js application.

## Local Development Setup

To develop and test features involving both the Next.js application and these FastAPI AI services, you'll need to run both projects concurrently.

**1. Run the Next.js Application:**
*   Navigate to the root directory of the Next.js project (the main project root).
*   Ensure your `.env.local` file has the `AI_SERVICE_BASE_URL` correctly set (e.g., `AI_SERVICE_BASE_URL=http://localhost:8001`).
*   Start the Next.js development server (usually on port 3000):
    ```bash
    npm run dev
    ```

**2. Run the FastAPI AI Services:**
*   Navigate to the `ai_services` directory from the project root:
    ```bash
    cd ai_services
    ```
*   **Python Virtual Environment (Recommended):**
    *   If you haven't set one up inside `ai_services`:
        ```bash
        python3 -m venv venv  # Or python -m venv venv
        ```
    *   Activate the virtual environment:
        *   On macOS/Linux:
            ```bash
            source venv/bin/activate
            ```
        *   On Windows:
            ```bash
            .\venv\Scripts\activate
            ```
*   **Install Dependencies:**
    *   Once the virtual environment is active, install the required Python packages:
        ```bash
        pip install -r requirements.txt
        ```
*   **Configure Environment Variables for FastAPI:**
    *   Create a `.env` file within the `ai_services` directory (you can copy from `.env.example`):
        ```bash
        cp .env.example .env
        ```
    *   Edit the `ai_services/.env` file to set your actual `DATABASE_URL` for the PostgreSQL database that the AI service will connect to.
*   **Start the FastAPI Service:**
    *   With the virtual environment active and from within the `ai_services` directory, run Uvicorn:
        ```bash
        uvicorn main:app --reload --port 8001
        ```
    *   `main:app` refers to the `app` instance in `main.py`.
    *   `--reload` enables auto-reloading on code changes.
    *   `--port 8001` specifies the port for the FastAPI service (matching `AI_SERVICE_BASE_URL` in Next.js).

**Default Ports:**
*   Next.js application: `http://localhost:3000`
*   FastAPI AI Services: `http://localhost:8001`

With both services running, the Next.js application (via its proxy API routes like `/api/ai/shopping-assistant/query`) will be able to communicate with the FastAPI AI services.
