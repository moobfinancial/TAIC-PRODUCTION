# Virtual Try-On (VTO) Genkit Refactor - Detailed Design

This document expands on the `vto_genkit_refactor_plan.md` with more specific design considerations and conceptual TypeScript code structures for refactoring the Virtual Try-On (VTO) feature to use Genkit.

## 1. Overall Architecture Diagram (Conceptual)

The data flow will be as follows:

1.  **Frontend (`VTOModal.tsx` or similar):**
    *   User uploads their image (if not already uploaded via FastAPI `/api/vto/upload-vto-image`).
    *   User selects a product.
    *   Frontend sends a request to the Next.js API Route. Request includes:
        *   User ID.
        *   URL of the user's uploaded image (obtained from FastAPI backend or directly uploaded to Next.js backend if design changes).
        *   URL of the product image.
        *   Product description.
        *   Optional user description/preferences.
        *   Product ID.

2.  **Next.js API Route (`src/app/api/virtual-try-on/route.ts`):**
    *   Receives the request from the frontend.
    *   Performs authentication and input validation (using Zod schemas).
    *   Prepares the input object for the Genkit flow.
    *   Invokes the main Genkit VTO flow (`virtualTryOnGenkitFlow`).
    *   Receives the result from the Genkit flow (which includes the generated image URL or buffer).
    *   **Handles Image Storage:** If the flow returns an image buffer or a temporary URL, this route is responsible for uploading it to persistent storage (e.g., Firebase Storage, Google Cloud Storage).
    *   **Handles Database Interaction:** Records metadata for the original user image (if it was a new upload not yet recorded) and the newly generated VTO image into the `vto_images` PostgreSQL table. This can be done by calling the FastAPI backend's VTO image metadata endpoints or, if the Next.js backend has direct DB access configured, performing the DB operations itself.
    *   Returns the final public URL of the generated VTO image and other relevant information to the frontend.

3.  **Genkit VTO Flow (`virtualTryOnGenkitFlow` in `src/ai/flows/virtual-try-on.ts`):**
    *   Orchestrates the AI-driven parts of the VTO process.
    *   **Step 1: Prompt Generation:** Calls a Genkit tool (`vtoPromptGeneratorTool`) which uses a powerful text LLM (e.g., Gemini, Claude, GPT-4o) to create a detailed prompt for the image generation model.
    *   **Step 2: Image Generation Model Selection:** Based on an environment variable (`VTO_IMAGE_GENERATION_PROVIDER`), selects which image generation Genkit Action to call.
    *   **Step 3: Image Generation:** Invokes the selected Genkit Action (e.g., `openAIVTOAction` or `geminiVTOAction`) with the user image data and the detailed prompt.
    *   **Step 4: Output:** Returns the raw generated image data (URL from provider or image buffer) to the calling Next.js API route.

4.  **Genkit Actions (e.g., `openai_vto_action.ts`, `gemini_vto_action.ts`):**
    *   Encapsulate the specific logic for interacting with a particular image generation model provider (OpenAI, Google Gemini, etc.).
    *   Handle API calls, authentication, and data transformation for that provider.

5.  **Storage & Database:**
    *   **Image Files:** Firebase Storage or Google Cloud Storage (configurable).
    *   **Metadata:** PostgreSQL `vto_images` table (managed via FastAPI backend or direct Next.js backend access).

**Diagrammatic Flow:**
`Frontend` -> `Next.js API Route` -> `Genkit Flow (virtualTryOnGenkitFlow)`
    `Genkit Flow` -> `Tool: Prompt Generation (LLM)`
    `Genkit Flow` -> `Action: Image Generation (OpenAI/Gemini/etc.)`
`Genkit Flow` -> `Next.js API Route (returns image data)`
`Next.js API Route` -> `Image Storage (Firebase/GCS)`
`Next.js API Route` -> `PostgreSQL DB (vto_images table via FastAPI or direct)`
`Next.js API Route` -> `Frontend (returns final VTO image URL)`

## 2. File Structure Proposal

```
src/
├── app/
│   └── api/
│       └── virtual-try-on/
│           └── route.ts        // Next.js API Route (entry point)
├── ai/
│   ├── flows/
│   │   └── virtual-try-on.ts   // Main Genkit VTO Flow
│   ├── actions/
│   │   ├── openai_vto_action.ts // Genkit Action for OpenAI VTO
│   │   └── gemini_vto_action.ts // Genkit Action for Gemini VTO (initially placeholder)
│   ├── tools/
│   │   └── vto_prompt_generator_tool.ts // Genkit Tool for detailed prompt generation
│   ├── schemas/
│   │   └── virtual-try-on.schema.ts // Zod schemas for VTO flow inputs/outputs
│   └── genkit.ts               // Main Genkit configuration and instance (ai)
├── lib/
│   ├── openai_vto_utils.ts     // Refactored utilities from existing openai.ts (image download, OpenAI API calls)
│   ├── gemini_vto_utils.ts     // Utilities for Gemini VTO (image download, Gemini API calls)
│   └── storage_utils.ts        // Utilities for uploading images to Firebase/GCS
└── services/                     // (If Next.js backend handles DB directly, or calls FastAPI)
    └── vto_service.ts          // Client for FastAPI VTO metadata endpoints or direct DB logic
```

## 3. Detailed Design for `src/ai/flows/virtual-try-on.ts` (`virtualTryOnGenkitFlow`)

*   **Inputs (from `VirtualTryOnInput` schema):**
    *   `userId: string`
    *   `userImage: { url: string; id?: string; }`
    *   `productImage: { url: string; id?: string; }`
    *   `productDescription: string`
    *   `userDescription?: string`
    *   `productId: string`
*   **Output (to `VirtualTryOnOutput` schema, passed back to Next.js API route):**
    *   `generatedImageData: { type: 'url' | 'buffer', data: string | Buffer }` (Raw output from the image gen action)
    *   `vtoProviderUsed: string`
    *   `detailedPromptGenerated: string`
    *   `error?: string`

```typescript
// src/ai/flows/virtual-try-on.ts (Conceptual)
import { defineFlow, run } from '@genkit-ai/flow';
import { virtualTryOnInputSchema, virtualTryOnFlowOutputSchema } from '@/ai/schemas/virtual-try-on.schema'; // Adjusted output schema for flow
import { vtoPromptGeneratorTool } from '@/ai/tools/vto_prompt_generator_tool';
import { openAIVTOAction } from '@/ai/actions/openai_vto_action';
import { geminiVTOAction } from '@/ai/actions/gemini_vto_action'; // Placeholder
import * as z from 'zod';

// This flow focuses on the AI steps and returns raw image data/URL from the provider.
// The calling Next.js route will handle final storage and DB metadata recording.
export const virtualTryOnGenkitFlow = defineFlow(
  {
    name: 'virtualTryOnGenkitFlow',
    inputSchema: virtualTryOnInputSchema,
    outputSchema: virtualTryOnFlowOutputSchema, // Output is raw data for the Next.js route to process
    auth: async (input) => {
      // Optional: Implement auth policies here if needed at the flow level
      // e.g., checking if input.userId is valid or has certain permissions
      // For now, assume Next.js route handles primary auth.
    },
  },
  async (input: z.infer<typeof virtualTryOnInputSchema>): Promise<z.infer<typeof virtualTryOnFlowOutputSchema>> => {
    console.log("[VTO Genkit Flow] Started with input for user:", input.userId, "product:", input.productId);

    // 1. Generate detailed image editing prompt
    let detailedPrompt: string;
    try {
      const promptResult = await run('vtoPromptGeneratorTool', { // Use run with tool reference or name
        productDescription: input.productDescription,
        userDescription: input.userDescription,
        userImageUrl: input.userImage.url, // For contextual analysis by the LLM
      });
      if (!promptResult?.detailedPrompt) { // Assuming tool output is { detailedPrompt: string }
        throw new Error('Failed to generate detailed prompt from vtoPromptGeneratorTool.');
      }
      detailedPrompt = promptResult.detailedPrompt;
      console.log("[VTO Genkit Flow] Generated detailed prompt:", detailedPrompt);
    } catch (error: any) {
      console.error("[VTO Genkit Flow] Error in prompt generation step:", error);
      return { error: `Prompt generation failed: ${error.message}` };
    }

    // 2. Select VTO provider based on environment config
    const vtoProvider = process.env.VTO_IMAGE_GENERATION_PROVIDER || 'openai'; // Default
    let actionResult: { generatedImageUrl?: string; generatedImageBuffer?: Buffer; error?: string };

    console.log(`[VTO Genkit Flow] Using VTO provider: ${vtoProvider}`);
    try {
      if (vtoProvider === 'openai') {
        actionResult = await run('openAIVTOAction', { // Use run with action reference or name
          userImage: { url: input.userImage.url }, // Action handles download/buffer conversion
          detailedPrompt: detailedPrompt,
          productId: input.productId, // Pass for potential use in action (e.g. specific model variants)
          userId: input.userId,
        });
      } else if (vtoProvider === 'gemini') {
        actionResult = await run('geminiVTOAction', { // Use run with action reference or name
          userImage: { url: input.userImage.url },
          productImage: { url: input.productImage.url },
          detailedPrompt: detailedPrompt,
          productId: input.productId,
          userId: input.userId,
        });
      } else {
        console.error(`[VTO Genkit Flow] Unsupported VTO provider: ${vtoProvider}`);
        return { error: `Unsupported VTO provider: ${vtoProvider}` };
      }

      if (actionResult.error || (!actionResult.generatedImageUrl && !actionResult.generatedImageBuffer)) {
        throw new Error(actionResult.error || 'Image generation action failed to return image data.');
      }

      console.log("[VTO Genkit Flow] Image generation action successful.");
      return {
        generatedImageData: actionResult.generatedImageUrl
          ? { type: 'url', data: actionResult.generatedImageUrl }
          : { type: 'buffer', data: actionResult.generatedImageBuffer! }, // Non-null assertion, one must exist
        vtoProviderUsed: vtoProvider,
        detailedPromptGenerated: detailedPrompt,
      };

    } catch (error: any) {
      console.error(`[VTO Genkit Flow] Error in image generation step with ${vtoProvider}:`, error);
      return { error: `Image generation failed with ${vtoProvider}: ${error.message}` };
    }
  }
);
```

## 4. Detailed Design for `src/ai/actions/openai_vto_action.ts`

*   **Input (Zod Schema):** `userImage: z.object({ url: z.string().url() }) | z.object({ buffer: z.instanceof(Buffer) })`, `detailedPrompt: z.string()`, `productId: z.string()`, `userId: z.string()`.
*   **Output (Zod Schema):** `z.object({ generatedImageUrl: z.string().url().optional(), generatedImageBuffer: z.instanceof(Buffer).optional(), error: z.string().optional() })`.
*   **Logic:**
    ```typescript
    // src/ai/actions/openai_vto_action.ts (Conceptual)
    import { defineAction, context } from '@genkit-ai/flow'; // Assuming 'context' for tracing if needed
    import { openAIVTOActionInputSchema, openAIVTOActionOutputSchema } from '@/ai/schemas/virtual-try-on.schema';
    import { downloadImageAsBuffer, generateOpenAIImageEdit } from '@/lib/openai_vto_utils'; // Refactored
    import * as z from 'zod';

    export const openAIVTOAction = defineAction(
      {
        name: 'openAIVTOAction',
        inputSchema: openAIVTOActionInputSchema,
        outputSchema: openAIVTOActionOutputSchema,
      },
      async (input: z.infer<typeof openAIVTOActionInputSchema>): Promise<z.infer<typeof openAIVTOActionOutputSchema>> => {
        console.log("[OpenAI VTO Action] Started for user:", input.userId, "product:", input.productId);
        let userImageBuffer: Buffer;
        try {
          if ('url' in input.userImage) {
            userImageBuffer = await downloadImageAsBuffer(input.userImage.url);
          } else {
            userImageBuffer = input.userImage.buffer;
          }
        } catch (error: any) {
          console.error("[OpenAI VTO Action] Error downloading/processing user image:", error);
          return { error: `Failed to process user image: ${error.message}` };
        }

        try {
          const result = await generateOpenAIImageEdit({ // This function now encapsulates the OpenAI SDK call
            userImageBuffer: userImageBuffer,
            prompt: input.detailedPrompt,
            // Potentially pass other OpenAI specific params like n, size, response_format
          });

          if (result.error) {
            throw new Error(result.error);
          }

          // Expecting generateOpenAIImageEdit to return a URL directly if response_format='url'
          // or handle buffer conversion if response_format='b64_json'
          if (result.imageUrl) {
            console.log("[OpenAI VTO Action] Image edit successful, returning URL.");
            return { generatedImageUrl: result.imageUrl };
          } else if (result.imageBuffer) {
             console.log("[OpenAI VTO Action] Image edit successful, returning buffer.");
            return { generatedImageBuffer: result.imageBuffer };
          } else {
            throw new Error('OpenAI image edit did not return URL or buffer.');
          }
        } catch (error: any) {
          console.error("[OpenAI VTO Action] Error calling OpenAI image edit API:", error);
          return { error: `OpenAI VTO generation failed: ${error.message}` };
        }
      }
    );
    ```

## 5. Detailed Design for `src/ai/tools/vto_prompt_generator_tool.ts`

*   **Input (Zod Schema):** `productDescription: z.string()`, `userDescription: z.string().optional()`, `userImageUrl: z.string().url().optional()`.
*   **Output (Zod Schema):** `z.object({ detailedPrompt: z.string().optional(), error: z.string().optional() })`.
*   **Logic:**
    ```typescript
    // src/ai/tools/vto_prompt_generator_tool.ts (Conceptual)
    import { defineTool } from '@genkit-ai/tool';
    import { vtoPromptGeneratorInputSchema, vtoPromptGeneratorOutputSchema } from '@/ai/schemas/virtual-try-on.schema';
    import { generate } from '@genkit-ai/ai'; // Genkit's core AI function
    import { geminiPro } from '@genkit-ai/googleai'; // Example, or use a configured model
    import * as z from 'zod';

    export const vtoPromptGeneratorTool = defineTool(
      {
        name: 'vtoPromptGeneratorTool',
        description: 'Generates a detailed prompt for VTO image generation based on product and user info.',
        inputSchema: vtoPromptGeneratorInputSchema,
        outputSchema: vtoPromptGeneratorOutputSchema,
      },
      async (input: z.infer<typeof vtoPromptGeneratorInputSchema>): Promise<z.infer<typeof vtoPromptGeneratorOutputSchema>> => {
        console.log("[VTO Prompt Gen Tool] Generating prompt for product:", input.productDescription);

        const metaPrompt = `Construct an optimal, detailed prompt for an AI image editing model to perform a virtual try-on.
        The user wants to see how a clothing item looks on them.
        User's original image will be provided to the image model.
        Product Description: "${input.productDescription}".
        User Preferences/Notes (if any): "${input.userDescription || 'None'}".
        The generated prompt should instruct the image model to:
        1.  Identify the main person in the user's image.
        2.  Realistically depict the described product on that person.
        3.  Preserve the person's facial features, body pose, hairstyle, and background from the original image as much as possible.
        4.  Ensure the product's material, texture, color, fit (e.g., loose, tight, regular), and style are accurately represented as per the product description.
        5.  The final image should look natural and unedited.
        Focus the prompt on clear instructions for the image editing process.
        Example snippet for prompt: "Edit the provided image: A person is wearing a [color] [product_type] with [specific details from product description]. Ensure the fit is [fit_type] and the material texture of [material_type] is visible. The person's face, pose, and background should remain unchanged."

        Based on the above, generate the detailed prompt:`;

        try {
          const llmResponse = await generate({
            model: geminiPro, // Or any configured Genkit text model (e.g., gpt4o)
            prompt: metaPrompt,
            config: { temperature: 0.3 }, // Adjust for desired creativity/determinism
          });
          const generatedPrompt = llmResponse.text();
          if (!generatedPrompt) {
            return { error: "LLM failed to generate a VTO prompt." };
          }
          console.log("[VTO Prompt Gen Tool] Generated prompt:", generatedPrompt);
          return { detailedPrompt: generatedPrompt };
        } catch (error: any) {
          console.error("[VTO Prompt Gen Tool] Error calling LLM:", error);
          return { error: `LLM prompt generation failed: ${error.message}` };
        }
      }
    );
    ```

## 6. Schema Review (`src/ai/schemas/virtual-try-on.schema.ts`)

The existing Zod schemas will need to be created or adjusted:

*   `virtualTryOnInputSchema`: Matches the input of `virtualTryOnGenkitFlow`.
*   `virtualTryOnFlowOutputSchema`: Defines the output of `virtualTryOnGenkitFlow` (e.g., `{ generatedImageData?: { type: 'url' | 'buffer', data: string | Buffer }, vtoProviderUsed?: string, detailedPromptGenerated?: string, error?: string }`).
*   `openAIVTOActionInputSchema`, `openAIVTOActionOutputSchema`: Specific to the OpenAI VTO action.
*   `geminiVTOActionInputSchema`, `geminiVTOActionOutputSchema`: Specific to the Gemini VTO action.
*   `vtoPromptGeneratorInputSchema`, `vtoPromptGeneratorOutputSchema`: For the prompt generation tool.

## 7. Next.js API Route (`/api/virtual-try-on/route.ts`) Modifications

```typescript
// src/app/api/virtual-try-on/route.ts (Conceptual)
import { NextRequest, NextResponse } from 'next/server';
import { virtualTryOnGenkitFlow } from '@/ai/flows/virtual-try-on';
import { virtualTryOnApiInputSchema } from '@/ai/schemas/virtual-try-on.schema'; // API specific input schema
// import { saveImageToFirebase } from '@/lib/storage_utils'; // Conceptual
// import { recordVtoMetadataInDb } from '@/services/vto_service'; // Conceptual (calls FastAPI or direct DB)
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Authentication (extract userId from session/token)
    const userId = "authenticated_user_id_placeholder"; // Replace with actual auth logic
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // 2. Validate input against API schema (might be same as flow input or slightly different)
    const validatedInput = virtualTryOnApiInputSchema.safeParse({ ...body, userId });
    if (!validatedInput.success) {
      return NextResponse.json({ message: "Invalid input", errors: validatedInput.error.issues }, { status: 400 });
    }
    const flowInput = validatedInput.data;

    // 3. Call Genkit Flow
    const flowResult = await virtualTryOnGenkitFlow.run(flowInput);

    if (flowResult.error || !flowResult.generatedImageData) {
      console.error("VTO Flow execution failed:", flowResult.error);
      return NextResponse.json({ message: "VTO generation failed.", error: flowResult.error }, { status: 500 });
    }

    // 4. Handle Image Storage (if buffer returned or if URL is temporary)
    let finalImageUrl: string;
    // if (flowResult.generatedImageData.type === 'buffer') {
    //   finalImageUrl = await saveImageToFirebase(flowResult.generatedImageData.data, `vto_results/${userId}/${new Date().getTime()}.png`);
    // } else { // type === 'url'
    //   // If URL is temporary (e.g. from OpenAI), might need to download and re-upload
    //   // For now, assume it's a usable public URL or the action already uploaded it.
    //   finalImageUrl = flowResult.generatedImageData.data;
    // }
    finalImageUrl = "placeholder_final_image_url_after_storage"; // Placeholder for actual storage logic

    // 5. Record Metadata to PostgreSQL vto_images table
    // This might involve calling the FastAPI backend: POST /api/vto/record-vto-result
    // const metadataPayload = {
    //   userId: userId,
    //   originalUserImageId: flowInput.userImage.id, // if available from frontend
    //   generatedImageUrl: finalImageUrl,
    //   storedFilePath: "path_in_firebase_or_gcs", // from saveImageToFirebase
    //   productId: flowInput.productId,
    //   vtoProvider: flowResult.vtoProviderUsed,
    //   detailedPrompt: flowResult.detailedPromptGenerated,
    //   mimeType: "image/png", // Determine from buffer or response
    //   fileSizeBytes: 123456 // Determine from buffer or response
    // };
    // const dbResult = await recordVtoMetadataInDb(metadataPayload);
    // const generatedImageId = dbResult.id;
    const generatedImageId = "placeholder_generated_db_id";


    // 6. Return success response to client
    return NextResponse.json({
      generatedImageUrl: finalImageUrl,
      generatedImageId: generatedImageId,
      // originalUserImageId: dbResult.originalUserImageId, // if applicable
      message: "VTO image generated successfully."
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error in /api/virtual-try-on route:", error);
    return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 });
  }
}
```

This detailed design provides a clearer path for implementation, focusing on modularity and leveraging Genkit's strengths for the AI components.
