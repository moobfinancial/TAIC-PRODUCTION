/**
 * Translation utilities for the TAIC platform
 * This module provides functions for translating text between languages
 */

/**
 * Translates text from one language to another using the Google Translate API
 * 
 * @param text The text to translate
 * @param targetLanguage The language code to translate to (e.g., 'en' for English)
 * @param sourceLanguage Optional source language code (auto-detected if not provided)
 * @returns The translated text or the original text if translation fails
 */
export async function translateText(
  text: string,
  targetLanguage: string = 'en',
  sourceLanguage: string = 'auto'
): Promise<string> {
  // Skip translation for empty strings
  if (!text || text.trim() === '') {
    return text;
  }

  try {
    // For production, you would use a proper translation API like Google Translate
    // This is a placeholder implementation that uses a free translation API
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.append('client', 'gtx');
    url.searchParams.append('sl', sourceLanguage);
    url.searchParams.append('tl', targetLanguage);
    url.searchParams.append('dt', 't');
    url.searchParams.append('q', text);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.error(`Translation API error: ${response.status} ${response.statusText}`);
      return text; // Return original text on error
    }

    const data = await response.json();
    
    // Extract translated text from response
    // The response format is a nested array where the first element contains translation segments
    if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
      // Concatenate all translated segments
      const translatedText = data[0]
        .filter(segment => Array.isArray(segment) && segment.length > 0)
        .map(segment => segment[0])
        .join('');
      
      return translatedText || text;
    }
    
    return text; // Return original text if response format is unexpected
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Return original text on error
  }
}

/**
 * Detects if text likely contains Chinese characters
 * 
 * @param text The text to check
 * @returns True if the text contains Chinese characters
 */
export function containsChineseCharacters(text: string): boolean {
  // Unicode ranges for Chinese characters
  const chineseRegex = /[\u4E00-\u9FFF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\u2CEB0-\u2EBEF\u30000-\u3134F]/;
  return chineseRegex.test(text);
}
