# AI Product Idea & Gift Idea Generator

## 1. Overview

The AI Product Idea Generator is a feature that assists users in brainstorming new product ideas or finding suitable gift suggestions. Users can input a description, optionally provide an image for context, and select whether they are looking for new product inspiration or gift recommendations. The system leverages a Large Language Model (LLM) to generate creative suggestions and can also search the existing product catalog for relevant items.

This feature includes Speech-to-Text (STT) for voice input and Text-to-Speech (TTS) to read out the AI's suggestions.

## 2. Core Architecture & Workflow

The feature follows a client-server architecture primarily involving a Next.js frontend, a Next.js server action, and a Next.js API route that utilizes the Genkit AI framework with a Google Gemini LLM.

**High-Level Workflow:**

1.  **User Input (Client):** User provides a description, an optional image, and selects a generator mode ('product' or 'gift') via the UI (`src/app/ai-product-ideas/page.tsx`).
2.  **Image Upload (Client to Server):** If an image is provided, it's first uploaded to `/api/upload-image` which returns a URL for the image.
3.  **Server Action (Client to Server):** The UI calls the `generateProductIdeas` server action (`src/ai/flows/product-idea-generator.ts`) with the description, image URL (if any), and mode.
4.  **API Route (Server-Side):** The server action makes a `POST` request to the `/api/ai/product-ideas` API route (`src/app/api/ai/product-ideas/route.ts`).
5.  **Genkit AI Processing (Server-Side):**
    *   The API route uses a Genkit flow (`generateProductIdeasFlow_APIRoute`).
    *   This flow constructs a prompt for the Gemini LLM based on the input and mode.
    *   The LLM is equipped with a tool (`getProductCatalogTool`) to search the application's product catalog (via `POST /api/products`).
    *   The LLM generates suggestions and may use the tool to find matching products.
6.  **Response Handling (Server to Client):** The API route returns the LLM's suggestions and any found products. The server action transforms product data for client consumption and forwards the result to the UI.
7.  **Display & TTS (Client):** The UI displays the suggestions and products. If suggestions are present, TTS is automatically triggered to read them out.

## 3. Key Files and Components

### 3.1. Frontend UI Page

*   **File:** `src/app/ai-product-ideas/page.tsx`
*   **Responsibilities:**
    *   Manages user input for description, image, and generator mode.
    *   Handles image selection, preview, and upload to `/api/upload-image`.
    *   Integrates STT for voice input of the description using `useWebSpeech`.
    *   Calls the `generateProductIdeas` server action upon submission.
    *   Displays the conversation history (user prompts and AI suggestions/products).
    *   Triggers TTS for AI suggestions using `useWebSpeech`.
    *   Conditionally renders a `ProductCanvas` to display products if returned by the AI.
    *   Uses `shadcn/ui` components and `lucide-react` icons.

### 3.2. Server Action (Client-Side Interaction Layer)

*   **File:** `src/ai/flows/product-idea-generator.ts`
*   **Exported Function:** `async function generateProductIdeas(input: GenerateProductIdeasInput): Promise<GenerateProductIdeasOutput>`
*   **Responsibilities:**
    *   Acts as a bridge between the client UI and the backend API route.
    *   Receives `productDescription`, `imageUrl` (optional), and `generatorMode`.
    *   Makes a `POST` request to `/api/ai/product-ideas`.
    *   Transforms product data from the API's snake_case format (`ProductAISchema`) to the client's camelCase format (`ProductForClientSchema`) for components like `ProductCard`.
    *   Defines/imports Zod schemas for input and output, ensuring type safety.

### 3.3. API Route (Core AI Logic)

*   **File:** `src/app/api/ai/product-ideas/route.ts`
*   **Endpoint:** `POST /api/ai/product-ideas`
*   **Responsibilities:**
    *   Initializes a local Genkit AI instance (`localAI`) with Google AI (Gemini model, e.g., 'gemini-2.0-flash').
    *   **`getProductCatalogTool` (Genkit Tool):**
        *   Searches the product catalog by making an internal `fetch` call to the application's `/api/products` endpoint.
        *   Takes `searchQuery`, `platform_category_id`, and `limit` as input.
        *   Returns an array of products or an error.
    *   **`generateProductIdeasFlow_APIRoute` (Genkit Flow):**
        *   Takes `GenerateProductIdeasInput` (description, image URL, mode).
        *   Constructs a detailed prompt for the Gemini LLM. The prompt is tailored based on `generatorMode`:
            *   **'product' mode:** LLM acts as a product innovation expert.
            *   **'gift' mode:** LLM acts as a gift advisor.
        *   Provides the `getProductCatalogTool` to the LLM.
        *   Instructs the LLM to first generate creative ideas and then use the tool to find relevant catalog items.
        *   Processes the LLM's response, including parsing structured JSON output for suggestions and products. Includes robust error handling for LLM output variations.
    *   The `POST` handler in the route executes this flow.

### 3.4. Speech Functionality (STT & TTS)

*   **Hook:** `src/hooks/useWebSpeech.ts`
    *   Exports `useWebSpeech` custom React hook.
    *   Encapsulates browser Web Speech API (`SpeechRecognition` for STT, `SpeechSynthesis` for TTS).
    *   Provides functions and state for: `startListening`, `stopListening`, `isListening`, `finalTranscript` (STT), and `speak`, `cancelSpeaking`, `isSpeaking`, `availableVoices` (TTS).
    *   Handles API support detection and error handling.
*   **Type Definitions:** `src/types/web-speech.d.ts`
    *   Provides TypeScript definitions for Web Speech API interfaces, ensuring type safety.

### 3.5. Product Display

*   **Component (Assumed Usage):** `src/components/products/ProductCard.tsx`
    *   Used by the UI page to render individual product details when the AI returns matching products from the catalog. Expects product data in `ProductForClient` format (camelCase).
*   **Component (Canvas):** `src/components/products/ProductCanvas.tsx`
    *   Used by the UI page (`src/app/ai-product-ideas/page.tsx`) to display a collection of products returned by the AI in a potentially more visual layout.

## 4. Data Schemas (Zod)

Key Zod schemas are defined in both `src/ai/flows/product-idea-generator.ts` and `src/app/api/ai/product-ideas/route.ts` to ensure data consistency:

*   **`GenerateProductIdeasInputSchema`**: Defines the input structure for the AI.
    *   `productDescription: string`
    *   `imageUrl: string().url().optional()`
    *   `generatorMode: z.enum(['product', 'gift'])`
*   **`ProductAISchema`**: Defines how products are represented for the AI and internal API calls (snake_case).
    *   `id: string`
    *   `name: string`
    *   `description: string | null`
    *   `price: number`
    *   `image_url: string | null`
    *   `category_name: string | null`
    *   `data_ai_hint: string | null`
    *   `source: z.enum(['MANUAL', 'CJ']).optional()`
*   **`ProductForClientSchema`**: Defines how products are transformed for client-side display (camelCase, used by `ProductCard`).
    *   (Fields similar to `ProductAISchema` but with `imageUrl`, `dataAiHint`)
*   **`GenerateProductIdeasOutputSchema`**: Defines the expected output from the AI flow/API.
    *   `suggestions: string`
    *   `products: z.array(ProductAISchema | ProductForClientSchema).optional()` (The API route outputs `ProductAISchema`, the server action transforms it to `ProductForClientSchema` for the client)
    *   `error: string().optional()` (Added in server action for client error reporting)

## 5. API Endpoints Involved

*   **`POST /api/ai/product-ideas`**: The primary endpoint for generating product/gift ideas. Consumes `GenerateProductIdeasInput` and produces `GenerateProductIdeasOutput` (with `ProductAISchema` for products).
*   **`POST /api/products`**: (Internal) Used by `getProductCatalogTool` to search the product catalog.
*   **`POST /api/upload-image`**: (Internal) Used by the UI page to upload an image file, which returns a URL for the image to be used as context.

## 6. Environment Variables

*   **`GOOGLE_API_KEY`**: Required by Genkit for authenticating with the Google AI (Gemini) service. Should be in `.env.local` or server environment.
*   **`NEXT_PUBLIC_APP_URL`**: Used for constructing absolute URLs for internal API calls (e.g., by `getProductCatalogTool` to call `/api/products`). Should be set in `.env.local` (e.g., `http://localhost:PORT`).

## 7. Setup & Usage Notes

*   Ensure all necessary environment variables are configured.
*   The Web Speech API for STT/TTS requires browser permissions and may have varying support across browsers.
*   The image upload endpoint (`/api/upload-image`) must be implemented and functional for the image context feature to work.

This document provides a comprehensive overview of the AI Product Idea and Gift Idea Generator feature, its components, and its operational flow.

## 8. Future Enhancements & Roadmap

Based on strategic review, the following updates are planned for the AI Idea Generator feature:

### 8.1. For the Shopper-Facing Application:

*   **"Gift Idea" Mode:**
    *   This mode will be retained as is, as it provides direct value to shoppers.
*   **"Product Idea" Mode Re-framing to "Solution Finder / Needs-Based Discovery":**
    *   The current "Product Idea" mode label in the UI will be changed to something more shopper-centric, like "Find a Solution" or "Product Discovery."
    *   The backend prompt for this mode (currently targeting product innovation) will be significantly updated. The new prompt will guide the LLM to act as a helpful assistant that:
        *   Understands a user's described problem, need, or scenario (e.g., "I need ideas for organizing my small kitchen," "What can I use for a long flight?").
        *   Suggests types of products or specific products from the catalog that can address that need.
    *   This aims to transform it into an advanced search and recommendation tool for shoppers.

### 8.2. For the Future Merchant Portal:

*   **Original "Product Idea" Mode Relocation:**
    *   The original "Product Idea" generation logic, with its "product innovation expert" persona (as currently defined in the prompt for `generatorMode: 'product'`), is better suited for merchants and entrepreneurs.
    *   This functionality will be preserved and integrated into a dedicated Merchant Portal in the future. It will help sellers brainstorm new product ideas, refine existing ones, and identify market opportunities.

These changes will ensure that each audience (shoppers and merchants) is served with the most relevant and valuable AI-powered idea generation tools.
