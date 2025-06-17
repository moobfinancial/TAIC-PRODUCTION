import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_API_KEY, // Using GOOGLE_API_KEY to match .env.local
      // You might also want to configure other options like default model settings, etc.
    }),
  ],
  model: 'googleai/gemini-2.0-flash', // This can be a default, but specific models can also be chosen per-flow
});
