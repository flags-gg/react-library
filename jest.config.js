module.exports = {
  // Set up the test environment to 'jsdom' to simulate a browser
  testEnvironment: 'jsdom',

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // The directory where Jest should output its coverage reports
  coverageDirectory: 'coverage',

  // An array of file extensions your modules use
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],

  // The paths to modules that run some code to configure or set up the testing environment
  setupFilesAfterEnv: ['<rootDir>/setupTests.js'],

  // The test path ignore patterns
  testPathIgnorePatterns: ['/node_modules/'],

  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js|jsx)',
    '**/?(*.)+(spec|test).+(ts|tsx|js|jsx)'
  ],

  // Module paths aliases and other mappings similar to webpack
  moduleNameMapper: {
    // Handle module aliases (add your own alias mapping here if needed)
    '^@components/(.*)$': '<rootDir>/src/components/$1',

    // Handle CSS imports (if using CSS modules)
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',

    // Handle image imports
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js'
  },

  // Transform property to process `ts|tsx` with `babel-jest`
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },

  // Verbose output for tests
  verbose: true,
};
