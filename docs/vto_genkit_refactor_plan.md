# ⚠️ DEPRECATED: Virtual Try-On (VTO) Genkit Refactor Plan

> **Note**: This document is deprecated as of June 2025. The project has transitioned to a FastAPI/MCPUs/A2A architecture, and Genkit is no longer the recommended approach for new development.

---

## Why This Is Deprecated
- The project has moved to a FastAPI-based architecture
- New development should follow the MCPUs/A2A pattern
- This document is kept for historical reference only

---

## 1. Introduction & Goals

### 1.1. Objective
The primary objective of this refactor is to migrate the core AI logic of the Virtual Try-On (VTO) feature to use Google's Genkit framework. This will provide a model-agnostic architecture, enabling the platform to easily switch between different underlying image generation models or providers (e.g., OpenAI DALL-E, Google Gemini, Stable Diffusion via a Genkit plugin) without significant code changes to the core flow.

### 1.2. Context
Currently, the VTO feature is implemented with a specific image generation provider (OpenAI) directly integrated within the Next.js backend. This refactor aims to abstract the model interaction layer using Genkit.

### 1.3. Scope
*   **Leverage Existing Entry Point:** The existing Next.js API route (`/api/virtual-try-on/route.ts`) will be maintained as the primary entry point for VTO requests from the frontend.
*   **Maintain Functionality:** The core functionality (user uploads an image, selects a product, receives a VTO image) should be preserved and potentially enhanced.
*   **Model Agnosticism:** The key outcome is the ability to switch image generation models through configuration.
*   **Database Integration:** Interaction with the `vto_images` PostgreSQL table for metadata storage will be streamlined.

## 2. Proposed Genkit Flow Structure (`src/ai/flows/virtual-try-on.ts` - Conceptual)

A new Genkit flow will orchestrate the VTO process.

### 2.1. Input/Output Schemas (`src/ai/flows/virtual-try-on.schema.ts` - Conceptual)

*   **`VirtualTryOnInput` (Zod Schema):**
    *   `userId: string` (ID of the authenticated user)
    *   `userImage: { url: string; id?: string; }` (URL of the user's uploaded image, optionally its DB ID if already stored)
    *   `productImage: { url: string; id?: string; }` (URL of the main product image, optionally its DB ID)
    *   `productDescription: string` (Detailed description of the product to be tried on)
    *   `userDescription: Optional<string>` (Optional user preferences or notes, e.g., "make it look natural", "focus on the fit on shoulders")
    *   `productId: string` (ID of the product being tried on)

*   **`VirtualTryOnOutput` (Zod Schema):**
    *   `generatedImageUrl: string` (Publicly accessible URL of the generated VTO image)
    *   `generatedImageId: string` (ID of the metadata record for the generated image in `vto_images` table)
    *   `originalUserImageId?: string` (ID of the user's image metadata record)
    *   `status: 'success' | 'failure'`
    *   `errorMessage?: string`

### 2.2. Main Flow: `virtualTryOnGenkitFlow`

```typescript
// src/ai/flows/virtual-try-on.ts (Conceptual)
import { defineFlow } from '@genkit-ai/flow';
import { virtualTryOnInputSchema, virtualTryOnOutputSchema } from './virtual-try-on.schema';
import { generateVtoPromptTool } from '../tools/prompt_generator_tool'; // Conceptual
import { openAIVtoTool } from '../tools/openai_vto_tool'; // Conceptual
import { geminiVtoTool } from '../tools/gemini_vto_tool'; // Conceptual
import { saveVtoResultTool } from '../tools/vto_db_tool'; // Conceptual
import * as z from 'zod'; // If using Zod for schema definition

export const virtualTryOnFlow = defineFlow(
  {
    name: 'virtualTryOnFlow',
    inputSchema: virtualTryOnInputSchema,
    outputSchema: virtualTryOnOutputSchema,
  },
  async (input: z.infer<typeof virtualTryOnInputSchema>): Promise<z.infer<typeof virtualTryOnOutputSchema>> => {
    console.log("VTO Genkit Flow started with input:", input);

    // 1. Validate Input (Genkit does this based on schema, additional validation if needed)
    if (!input.userImage.url || !input.productImage.url || !input.productDescription) {
      // Basic validation example
      return { status: 'failure', errorMessage: 'Missing required inputs for VTO generation.' };
    }

    // 2. Generate Descriptive Prompt for Image Generation Model
    // This step uses a text LLM (configurable via Genkit tool definition)
    const promptGenerationResult = await generateVtoPromptTool.run({
      userImageUrl: input.userImage.url, // LLM might use this for context if it's multimodal
      productDescription: input.productDescription,
      userPreferences: input.userDescription,
    });

    if (!promptGenerationResult.success || !promptGenerationResult.detailedPrompt) {
      return { status: 'failure', errorMessage: 'Failed to generate detailed image prompt.' };
    }
    const imageGenPrompt = promptGenerationResult.detailedPrompt;
    console.log("Generated Image Generation Prompt:", imageGenPrompt);

    // 3. Select Image Generation Tool based on Configuration
    const vtoProvider = process.env.VTO_IMAGE_GENERATION_PROVIDER || 'openai'; // Default to OpenAI
    let generatedImageResult: { success: boolean; imageUrl?: string; error?: string; imageBuffer?: Buffer };

    console.log(`Using VTO provider: ${vtoProvider}`);
    if (vtoProvider === 'openai') {
      generatedImageResult = await openAIVtoTool.run({
        userImage: { url: input.userImage.url },
        imageGenPrompt: imageGenPrompt,
        // OpenAI DALL-E edit might not need a separate product image if prompt is descriptive enough
      });
    } else if (vtoProvider === 'gemini') {
      generatedImageResult = await geminiVtoTool.run({
        userImage: { url: input.userImage.url },
        productImage: { url: input.productImage.url }, // Gemini might prefer separate product image
        imageGenPrompt: imageGenPrompt,
      });
    } else {
      return { status: 'failure', errorMessage: `Unsupported VTO provider: ${vtoProvider}` };
    }

    if (!generatedImageResult.success || (!generatedImageResult.imageUrl && !generatedImageResult.imageBuffer)) {
      return { status: 'failure', errorMessage: generatedImageResult.error || 'Image generation failed.' };
    }

    // 4. Save Generated Image & Metadata
    // The saveVtoResultTool will handle uploading to storage (if buffer) and DB recording.
    // It needs to know the original user image ID if it exists, or create one if not.
    const saveResult = await saveVtoResultTool.run({
      userId: input.userId,
      productId: input.productId,
      originalUserImageUrl: input.userImage.url, // For reference or if original needs to be stored/recorded
      originalUserImageId: input.userImage.id,
      generatedImageData: generatedImageResult.imageUrl
        ? { type: 'url', data: generatedImageResult.imageUrl }
        : { type: 'buffer', data: generatedImageResult.imageBuffer! }, // Non-null assertion as one must exist
      vtoProviderUsed: vtoProvider,
    });

    if (!saveResult.success || !saveResult.finalImageUrl || !saveResult.generatedImageId) {
      return { status: 'failure', errorMessage: saveResult.error || 'Failed to save VTO result.' };
    }

    // 5. Return Output
    return {
      status: 'success',
      generatedImageUrl: saveResult.finalImageUrl,
      generatedImageId: saveResult.generatedImageId,
      originalUserImageId: saveResult.originalUserImageId,
    };
  }
);
```

## 3. Genkit Tool Definitions (Conceptual)

### 3.1. Prompt Generation Tool (`src/ai/tools/prompt_generator_tool.ts`)
*   **Purpose:** Uses a powerful text model (e.g., Gemini Pro, GPT-4o) to generate an optimal prompt for the subsequent image generation model.
*   **Input:** `userImageUrl: string` (optional, for context), `productDescription: string`, `userPreferences?: string`.
*   **Output:** `{ success: boolean; detailedPrompt?: string; error?: string; }`
*   **Logic:**
    *   Constructs a meta-prompt for the LLM.
    *   Example meta-prompt: "You are a creative assistant. Given a product description, user preferences, and context from a user's image (if available), generate a detailed and effective prompt for an image generation model to perform a virtual try-on. The prompt should clearly describe how the garment should look on the person, preserving the person's features and pose, while accurately depicting the product's material, fit, color, and style. Product: '{productDescription}'. User notes: '{userPreferences}'. User image context (if any): analyze features from [userImageUrl]."
    *   Calls the configured Genkit text model (e.g., `geminiPro` or `gpt4o`).

### 3.2. OpenAI VTO Image Editing Tool (`src/ai/tools/openai_vto_tool.ts`)
*   **Purpose:** Adapts the existing OpenAI VTO logic into a Genkit tool.
*   **Input:** `userImage: { url: string } | { buffer: Buffer }`, `imageGenPrompt: string`.
*   **Output:** `{ success: boolean; imageUrl?: string; imageBuffer?: Buffer; error?: string; }`
*   **Logic:**
    *   Downloads the user image if a URL is provided.
    *   Calls the OpenAI `/v1/images/edits` (or potentially `/v1/images/generations` if a different approach is better with the new prompt) API using the OpenAI SDK configured in Genkit.
    *   The `imageGenPrompt` from the previous step is used as the main instruction.
    *   Returns the URL of the generated image from OpenAI or the image buffer.

### 3.3. Gemini VTO Image Generation Tool (`src/ai/tools/gemini_vto_tool.ts`)
*   **Purpose:** Implements VTO using a Google Gemini multimodal model.
*   **Input:** `userImage: { url: string } | { buffer: Buffer }`, `productImage?: { url: string } | { buffer: Buffer }`, `imageGenPrompt: string`.
*   **Output:** `{ success: boolean; imageUrl?: string; imageBuffer?: Buffer; error?: string; }`
*   **Logic:**
    *   Downloads images if URLs are provided.
    *   Uses the Genkit Google AI plugin to interact with a Gemini model capable of image generation/editing based on text prompts and input images.
    *   Returns the generated image URL (e.g., from a temporary store or if Gemini API returns one directly) or buffer.

### 3.4. Save VTO Result Tool (`src/ai/tools/vto_db_tool.ts`)
*   **Purpose:** Handles storage of the generated image and metadata recording.
*   **Input:** `userId: string`, `productId: string`, `originalUserImageUrl: string`, `originalUserImageId?: string`, `generatedImageData: { type: 'url' | 'buffer', data: string | Buffer }`, `vtoProviderUsed: string`.
*   **Output:** `{ success: boolean; finalImageUrl?: string; generatedImageId?: string; originalUserImageId?: string; error?: string; }`
*   **Logic:**
    1.  **Record/Verify Original User Image:**
        *   If `originalUserImageId` is provided and valid, use it.
        *   If not, or if it needs to be recorded for the first time (e.g., if the upload endpoint doesn't pre-record it), this tool could handle recording the `originalUserImageUrl` in `vto_images` with `image_type = 'user_profile_for_vto'`. This depends on the final design of the `/upload-vto-image` FastAPI endpoint.
    2.  **Store Generated Image:**
        *   If `generatedImageData.type === 'buffer'`, upload the buffer to configured storage (e.g., Firebase Storage, Google Cloud Storage).
        *   If `generatedImageData.type === 'url'`, and it's a temporary URL from the provider, download and re-upload to persistent storage. If it's already a persistent URL, this step might be skipped or just verified.
        *   Obtain the final public URL (`finalImageUrl`).
    3.  **Record Generated Image Metadata:**
        *   Generate a new UUID for the generated VTO image.
        *   Insert a new record into the `vto_images` PostgreSQL table:
            *   `id`: New UUID.
            *   `user_id`: `input.userId`.
            *   `image_type`: `'generated_vto_result'`.
            *   `original_filename`: e.g., `generated_vto_{productId}_{timestamp}.png`.
            *   `stored_filepath`: Path in storage.
            *   `mime_type`: (e.g., 'image/png').
            *   `file_size_bytes`: Size of the generated image.
            *   `related_product_id`: `input.productId`.
            *   `created_at`: NOW().
            *   (Potentially add a field for `source_vto_provider` or `source_image_id` linking to the original user image ID in `vto_images`).
        *   This database interaction can occur via:
            *   A direct call from this Node.js Genkit tool to PostgreSQL (if DB is accessible).
            *   Calling a dedicated FastAPI endpoint (e.g., `POST /api/internal/vto-images/record-metadata`).

## 4. Configuration for Model Selection

*   An environment variable, `VTO_IMAGE_GENERATION_PROVIDER` (e.g., set to `"openai"` or `"gemini"`), will be read by the `virtualTryOnGenkitFlow`.
*   The flow will use a conditional block (if/else or switch) to invoke the appropriate Genkit tool (`openAIVtoTool`, `geminiVtoTool`, etc.) based on this variable.
*   Each tool will have its own specific configuration for API keys and model names (e.g., `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENAI_VTO_MODEL_NAME`, `GEMINI_VTO_MODEL_NAME`) also managed via environment variables.

## 5. Database Interaction for `vto_images` table

*   **Preferred Approach (Option 1 in prompt):** The Next.js API route (`/api/virtual-try-on/route.ts`) will handle the final database interactions after the `virtualTryOnGenkitFlow` returns the necessary information (like the generated image URL/buffer and original image details).
    *   **Rationale:** Keeps Genkit flows focused on AI orchestration. Centralizes DB interaction within the Next.js backend which already has DB access patterns (or can call FastAPI for it). Simplifies Genkit tool responsibilities.
*   **Alternative (Option 2 - If Genkit flow handles DB):** The `saveVtoResultTool` (running in Node.js environment where Genkit flow executes) would need direct DB access (e.g., using `pg` library) or would make an internal HTTP call to a FastAPI endpoint designed for recording VTO metadata. This adds complexity to the Genkit tool or requires an internal API.

For this plan, **Option 1 (Next.js API route handles DB interaction post-flow)** is recommended for cleaner separation of concerns, assuming the Next.js backend can securely manage DB connections or call dedicated FastAPI endpoints for DB operations. If the FastAPI backend already has robust VTO image metadata CRUD operations, the Next.js route can call those.

## 6. Updates to Next.js API Route (`/api/virtual-try-on/route.ts`)

The existing Next.js API route will be refactored:

1.  **Authentication:** Continue to handle user authentication and retrieve `userId`.
2.  **Input Preparation:**
    *   Validate incoming request body (e.g., using Zod, matching `VirtualTryOnInput` structure).
    *   Fetch/construct URLs for the user's uploaded image and the selected product image. This might involve looking up paths from the `vto_images` table (for user image) and `products` table (for product image) using their respective IDs if they are passed from the frontend.
3.  **Call Genkit Flow:**
    *   Invoke `virtualTryOnFlow.run(preparedInput)`.
4.  **Process Flow Output:**
    *   Receive `VirtualTryOnOutput` from the flow.
    *   If `status === 'success'`:
        *   **If DB interaction is handled here (Preferred Option 1):**
            *   The `virtualTryOnFlow` might return a temporary URL or image buffer.
            *   This route would then handle:
                *   Uploading the generated image to persistent storage (e.g., Firebase Storage) if not already done by a tool.
                *   Recording the metadata of the *original user image* (if not already present with an ID) and the *newly generated VTO image* into the `vto_images` PostgreSQL table. This could be a call to a FastAPI endpoint like `POST /api/vto/record-vto-result-metadata` (which would need to be created).
        *   Return the final public URL of the generated image and other relevant data to the client.
    *   If `status === 'failure'`, return an appropriate error response to the client based on `errorMessage`.

This refactor will result in a more flexible, maintainable, and future-proof VTO system.
