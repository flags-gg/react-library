// setupTests.js
import '@testing-library/jest-dom'; // Provides more readable extended APIs for jest

// jsdom lacks TextEncoder (browsers and Node have it); the rollout hash needs it
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}
