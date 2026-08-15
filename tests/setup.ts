import '@testing-library/jest-dom';

// Mock console methods to avoid noise in tests
const originalConsole = { ...console };
beforeAll(() => {
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

// Additional test setup can go here
// For example, global test utilities, custom matchers, etc.
