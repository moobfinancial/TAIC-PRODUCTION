# Genkit AI Agent Setup

This directory contains the configuration and implementation for the Genkit AI agents used in this application.

## Configuration

### 1. API Keys

The AI agents, particularly those interacting with Google's Generative AI services (like Gemini), require an API key.

-   **Environment Variable**: The API key must be provided via an environment variable named `GEMINI_API_KEY`.

-   **Local Development**:
    For local development with Next.js, create a `.env.local` file in the root of the project and add your API key there:
    ```
    GEMINI_API_KEY=your_gemini_api_key_here
    ```
    Ensure that `.env.local` is listed in your project's `.gitignore` file to prevent committing your API key.

-   **Production/Deployment**:
    In a deployed environment, set the `GEMINI_API_KEY` environment variable directly on your hosting platform or server where the Next.js application (and thus the Genkit backend functions) will run.

### 2. Genkit Initialization

The core Genkit setup is in `src/ai/genkit.ts`. It initializes the Google AI plugin and sets a default model.

## Flows

The implemented AI flows are located in the `src/ai/flows/` directory:

-   **`product-idea-generator.ts`**:
    -   Generates product ideas (for new products) or gift suggestions based on user descriptions.
    -   **Input Schema**: Accepts `productDescription` (string), optional `imageUrl` (string URL), and `generatorMode` ('product' or 'gift').
    -   If `imageUrl` is provided, the flow uses the multimodal capabilities of the configured Gemini model to analyze the image content and incorporate it into the idea generation process.
    -   The prompt engineering dynamically adjusts based on the `generatorMode` and the presence of an `imageUrl`.
-   **`shopping-assistant.ts`**: Provides shopping assistance to users. This flow now uses the `/api/products` endpoint to fetch product data from the database instead of mock data.
-   **`virtual-try-on.ts`**: A new flow designed to generate a virtual try-on image given a user image and a product image.

These flows are defined using Genkit's `defineFlow` and can be invoked via API endpoints (typically set up in `src/app/api/genkit/[...flow].ts` or similar).

### Virtual Try-On Flow (`virtual-try-on.ts`)

-   **Input**: `userImageUrl` (URL), `productImageUrl` (URL), optional `userDescription` (string), optional `productDescription` (string).
-   **Output**: `generatedImageUrl` (URL), optional `errorMessage` (string).
-   **Current Implementation Details**:
    -   This flow uses a multimodal model (e.g., `gemini-2.0-flash`) to understand the content of the user and product images.
    -   It then constructs a detailed text prompt that is *intended* to be used by an advanced image generation model (like Imagen 2) to create the virtual try-on image.
    -   **Important**: As of the current implementation, this flow *does not perform actual image generation*. It logs the detailed text prompt (that could be used for image generation) to the server console.
    -   The `generatedImageUrl` returned is a placeholder (e.g., one of the input image URLs).
    -   The `errorMessage` field in the output explicitly states: "Actual image generation for Virtual Try-On is not yet available due to limitations in accessing a suitable image generation model (e.g., Imagen 2) via the current Genkit GoogleAI plugin. This flow has successfully generated a detailed text prompt that *could* be used with such a model."
    -   **Reason for Limitation**: True image generation for virtual try-on requires advanced models like Imagen 2. Accessing these typically requires using the `@genkit-ai/vertexai` plugin and appropriate Google Cloud Vertex AI setup, which is different from the current project's Genkit configuration using `@genkit-ai/googleai` with the standard Gemini API key.
    -   The current flow successfully demonstrates the initial step of understanding the input images and generating a sophisticated prompt for a subsequent image generation stage.

## Logging

Basic console logging is implemented within the flows to trace their execution. For production environments, consider integrating a more robust logging solution.

## Product Data Access

Currently, some flows might be using mock product data. For a production system, these flows will need access to real product data from the application's database (PostgreSQL). This may involve:
- Adding new API endpoints for the AI backend to query product information.
- Modifying existing data access layers to be usable by the Genkit flows or their tools.
(Further details on product data integration will be specified in relevant subtasks.)

## Firebase Integration (for Image Storage etc.)

This project uses Firebase services, such as Firebase Storage for user image uploads.

### 1. Firebase Admin SDK Configuration

To enable backend services to interact with Firebase (e.g., uploading images via a Next.js API route):

-   **Firebase Admin SDK JSON Credentials**:
    1.  Go to your Firebase Project Settings -> Service accounts.
    2.  Generate a new private key (JSON file).
    3.  **Do NOT commit this JSON file to your repository.**
    4.  Encode the entire content of this JSON file into a Base64 string. You can use an online tool or a command-line utility:
        ```bash
        # For Linux/macOS:
        cat /path/to/your-service-account-file.json | base64
        # For Windows (PowerShell):
        [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.IO.File]::ReadAllText("C:\path\to\your-service-account-file.json")))
        ```
    5.  Set this Base64 encoded string as an environment variable named `FIREBASE_ADMIN_SDK_CONFIG_BASE64`.

-   **Firebase Storage Bucket URL**:
    1.  In your Firebase console, go to Storage.
    2.  Your storage bucket URL is typically in the format `gs://<your-project-id>.appspot.com`.
    3.  Copy the bucket name (e.g., `<your-project-id>.appspot.com`).
    4.  Set this as an environment variable named `FIREBASE_STORAGE_BUCKET_URL`.

### 2. Environment Variables Summary for Firebase

Add these to your `.env.local` for local development, or set them in your deployment environment:

```env
# For Firebase Admin SDK (JSON content base64 encoded)
FIREBASE_ADMIN_SDK_CONFIG_BASE64="your_base64_encoded_sdk_json_here"

# For Firebase Storage
FIREBASE_STORAGE_BUCKET_URL="your-project-id.appspot.com"
```

Ensure these variables (especially `FIREBASE_ADMIN_SDK_CONFIG_BASE64`) are kept secure and not exposed on the client-side. The `firebaseAdmin.ts` utility initializes the Admin SDK using these variables.

## CJdropshipping Integration

To enable fetching and importing products from CJdropshipping:

-   **CJdropshipping API Key**:
    1.  Obtain your API key from your CJdropshipping account (usually under Account -> API).
    2.  Set this key as an environment variable named `CJ_API_KEY`.

-   **Environment Variable for CJ API Key**:
    Add this to your `.env.local` for local development or set it in your deployment environment:
    ```env
    CJ_API_KEY="your_cjdropshipping_api_key_here"
    ```
    This key is used by admin-protected API endpoints (`/api/admin/cj/*`) to interact with the CJdropshipping API.
