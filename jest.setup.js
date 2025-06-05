// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Polyfill for Fetch API Request, Response, fetch, URL, URLSearchParams
// These are often needed for testing Next.js API routes or server components in Jest
if (typeof global.Request === 'undefined') {
  global.Request = require('node-fetch').Request;
}
if (typeof global.Response === 'undefined') {
  global.Response = require('node-fetch').Response;
}
if (typeof global.fetch === 'undefined') {
  global.fetch = require('node-fetch');
}
if (typeof global.URL === 'undefined') {
  global.URL = require('url').URL;
}
if (typeof global.URLSearchParams === 'undefined') {
  global.URLSearchParams = require('url').URLSearchParams;
}

// Polyfill for TextEncoder and TextDecoder (used by pg library, among others)
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
