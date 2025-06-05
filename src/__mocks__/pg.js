'use strict'; // Ensure strict mode for CJS module

const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockConnect = jest.fn(async () => ({
  query: mockQuery,
  release: mockRelease,
}));

const Pool = jest.fn(() => ({
  connect: mockConnect,
}));

// Attach mocks to the Pool constructor for easy access in tests
Pool.mockQuery = mockQuery;
Pool.mockConnect = mockConnect;
Pool.mockRelease = mockRelease;

module.exports = { Pool };
