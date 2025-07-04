// src/ai/prompts/keyword-extractor-prompt-new.ts

import { z } from 'zod';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources';

export const KeywordExtractorOutputSchema = z.object({
  keywords: z.string().describe('The extracted keywords, optimized for a product search engine.'),
});

export type KeywordExtractorOutput = z.infer<typeof KeywordExtractorOutputSchema>;

export function buildKeywordExtractorMessages(query: string): ChatCompletionMessageParam[] {
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
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: `User Query: "${query}"`,
    },
  ];
}

/**
 * Extract keywords from a user query using OpenAI
 */
export async function extractKeywords(query: string): Promise<string> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: buildKeywordExtractorMessages(query),
      temperature: 0.1,
      max_tokens: 100,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('[extractKeywords] No content in response');
      return query; // Fallback to original query
    }
    
    try {
      const parsedContent = JSON.parse(content);
      const result = KeywordExtractorOutputSchema.safeParse(parsedContent);
      
      if (result.success) {
        return result.data.keywords;
      } else {
        console.error('[extractKeywords] Failed to parse response:', result.error);
        return query; // Fallback to original query
      }
    } catch (parseError) {
      console.error('[extractKeywords] Error parsing JSON response:', parseError);
      return query; // Fallback to original query
    }
  } catch (error) {
    console.error('[extractKeywords] Error calling OpenAI:', error);
    return query; // Fallback to original query
  }
}
