# Genkit Migration Status

## Overview
This document tracks the status of migrating away from Genkit dependencies to standard TypeScript implementations.

## Deprecated Dependencies
The following Genkit-related dependencies are marked for removal:

- `genkit`: ^1.11.0
- `genkitx-mcp`: ^1.12.0
- `@genkit-ai/googleai`: ^1.11.0
- `@genkit-ai/next`: ^1.11.0
- `genkit-cli`: ^1.11.0 (dev dependency)

## Migration Progress

### Completed
- ✅ Product Idea Generator: Fully migrated to standard TypeScript
  - Removed from `src/ai/flows/product-idea-generator.ts`
  - Removed from `src/app/api/ai/product-ideas/route.ts`

### In Progress
- 🔄 Shopping Assistant: New implementation created
  - Created new non-Genkit implementation in `src/ai/flows/shopping-assistant-new.ts`
  - Created new API route in `src/app/api/ai/shopping-assistant/route.ts`
  - Created new schemas in `src/ai/schemas/shopping-assistant-schemas-new.ts`
  - Created new product tool in `src/ai/tools/get-products-new.ts`
  - Created new keyword extractor in `src/ai/prompts/keyword-extractor-prompt-new.ts`
  - **Next steps:** Wire up the new implementation to the frontend and remove old files

### Pending
- ❌ Remove old Genkit files after confirming new implementation works:
  - `src/ai/flows/shopping-assistant.ts`
  - `src/ai/tools/get-products.ts`
  - `src/ai/schemas/shopping-assistant-schemas.ts`
  - `src/ai/prompts/keyword-extractor-prompt.ts`
- ❌ Remove Genkit dependencies from `package.json` after all migrations are complete

## Testing
- ❌ Test new Shopping Assistant implementation
- ❌ Verify all functionality works without Genkit dependencies

## Final Steps
- ❌ Remove all Genkit dependencies from `package.json`
- ❌ Update documentation to reflect new architecture
