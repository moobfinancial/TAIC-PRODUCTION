// src/ai/prompts/keyword-extractor-prompt.ts

import { z } from 'genkit';

export const KeywordExtractorOutputSchema = z.object({
  keywords: z.string().describe('The extracted keywords, optimized for a product search engine.'),
});

export function buildKeywordExtractorMessages(query: string) {
  const systemPrompt = `
You are an expert at query optimization for an e-commerce product search engine.
Your task is to extract the most relevant product-related keywords from a user's query.
Focus on nouns, adjectives, and product categories. Ignore conversational filler like "hello", "can you show me", "I'm looking for", etc.
Combine the keywords into a single, concise search string.

Respond ONLY with a valid JSON object that conforms to the following structure:
{ "keywords": "string" }

Example 1:
User Query: "hey there, can you show me some cool AI-themed t-shirts?"
Your JSON response: { "keywords": "cool AI t-shirts" }

Example 2:
User Query: "I need a new black cap for running"
Your JSON response: { "keywords": "black running cap" }

Example 3:
User Query: "do you have any mugs?"
Your JSON response: { "keywords": "mugs" }
`;

  return [
    {
      role: 'system' as const,
      content: [{ text: systemPrompt }],
    },
    {
      role: 'user' as const,
      content: [{ text: `User Query: "${query}"` }],
    },
  ];
}
