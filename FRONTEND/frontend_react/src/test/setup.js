import * as matchers from '@testing-library/jest-dom/matchers';

// Estende o expect do Vitest com os matchers do jest-dom
expect.extend(matchers);

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Configure location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    pathname: '/',
    assign: () => {},
    replace: () => {},
    reload: () => {},
  },
  writable: true,
});
