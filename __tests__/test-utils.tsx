import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { FlagsProvider } from '../src';
import { FlagsProviderOptions } from '../src/types';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  providerOptions?: FlagsProviderOptions;
}

export const customRender = (
  ui: ReactElement,
  options?: CustomRenderOptions
) => {
  const { providerOptions, ...renderOptions } = options || {};

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <FlagsProvider options={providerOptions}>
      {children}
    </FlagsProvider>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

export * from '@testing-library/react';
export { customRender as render };

// Mock data helpers
export const mockFlag = (name: string, enabled: boolean = false) => ({
  enabled,
  details: {
    name,
    id: `test-${name}-id`,
  },
});

export const mockFlags = {
  featureA: mockFlag('featureA', true),
  featureB: mockFlag('featureB', false),
  featureC: mockFlag('featureC', true),
};

export const mockServerResponse = {
  flags: Object.values(mockFlags),
  intervalAllowed: 60,
  secretMenu: {
    sequence: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown'],
    styles: [],
  },
};

// Fetch mock helper
export const setupFetchMock = (
  response: any = mockServerResponse,
  options: {
    status?: number;
    statusText?: string;
    delay?: number;
    shouldFail?: boolean;
  } = {}
) => {
  const { status = 200, statusText = 'OK', delay = 0, shouldFail = false } = options;

  global.fetch = jest.fn().mockImplementation((url, config) => {
    if (shouldFail) {
      return Promise.reject(new Error('Network error'));
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        resolve({
          ok: status >= 200 && status < 300,
          status,
          statusText,
          json: () => Promise.resolve(response),
          text: () => Promise.resolve(JSON.stringify(response)),
        });
      }, delay);
      
      // Handle abort signal if provided
      if (config?.signal) {
        config.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }
    });
  });
};

// Wait helper for async operations
export const waitForNextUpdate = (ms: number = 100) => 
  new Promise(resolve => setTimeout(resolve, ms));

// Local storage mock
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
};

// Console spy helper
export const setupConsoleSpy = () => {
  const originalConsole = { ...console };
  const spies = {
    error: jest.spyOn(console, 'error').mockImplementation(),
    warn: jest.spyOn(console, 'warn').mockImplementation(),
    log: jest.spyOn(console, 'log').mockImplementation(),
  };

  return {
    spies,
    restore: () => {
      Object.entries(spies).forEach(([method, spy]) => {
        spy.mockRestore();
        (console as any)[method] = originalConsole[method as keyof typeof originalConsole];
      });
    },
  };
};