import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FlagsProvider, useFlags } from '../src';
import { setupFetchMock, mockServerResponse, waitForNextUpdate, setupConsoleSpy } from './test-utils';

// Mock the cache module
jest.mock('../src/cache', () => ({
  Cache: jest.fn().mockImplementation(() => ({
    getCacheEntry: jest.fn().mockReturnValue(null),
    setCacheEntry: jest.fn(),
    clearExpiredCacheEntries: jest.fn(),
  })),
}));

// Mock jotai
jest.mock('jotai', () => ({
  useAtom: jest.fn(() => [{}, jest.fn()]),
}));

jest.mock('jotai/utils', () => ({
  atomWithStorage: jest.fn().mockReturnValue({}),
  RESET: Symbol('RESET'),
}));


// Test component to access flags context
const TestComponent: React.FC<{ testId?: string }> = ({ testId = 'test-component' }) => {
  const { is } = useFlags();
  const featureA = is('featureA');
  const featureB = is('featureB');

  return (
    <div data-testid={testId}>
      <div>Feature A: {featureA.enabled() ? 'enabled' : 'disabled'}</div>
      <div>Feature B: {featureB.enabled() ? 'enabled' : 'disabled'}</div>
    </div>
  );
};

describe('FlagsProvider', () => {
  let consoleSpy: ReturnType<typeof setupConsoleSpy>;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = setupConsoleSpy();
    // Reset fetch mock
    global.fetch = jest.fn();
  });

  afterEach(() => {
    consoleSpy.restore();
    jest.useRealTimers();
  });

  describe('Basic rendering', () => {
    it('should render children without fetching when no IDs provided', () => {
      render(
        <FlagsProvider>
          <div>Test content</div>
        </FlagsProvider>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should render children with empty flags initially', () => {
      render(
        <FlagsProvider options={{ projectId: 'test-project' }}>
          <TestComponent />
        </FlagsProvider>
      );

      expect(screen.getByText('Feature A: disabled')).toBeInTheDocument();
      expect(screen.getByText('Feature B: disabled')).toBeInTheDocument();
    });
  });

  describe('Flag fetching', () => {
    it('should fetch flags when project ID is provided', async () => {
      setupFetchMock();

      render(
        <FlagsProvider options={{ projectId: 'test-project' }}>
          <TestComponent />
        </FlagsProvider>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.flags.gg/flags',
          expect.objectContaining({
            method: 'GET',
            headers: expect.any(Headers),
          })
        );
      });

      const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
      expect(headers.get('x-project-id')).toBe('test-project');
    });

    it('should fetch flags when agent ID is provided', async () => {
      setupFetchMock();

      render(
        <FlagsProvider options={{ agentId: 'test-agent' }}>
          <TestComponent />
        </FlagsProvider>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
      expect(headers.get('x-agent-id')).toBe('test-agent');
    });

    it('should fetch flags when environment ID is provided', async () => {
      setupFetchMock();

      render(
        <FlagsProvider options={{ environmentId: 'test-env' }}>
          <TestComponent />
        </FlagsProvider>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
      expect(headers.get('x-environment-id')).toBe('test-env');
    });

    it('should use custom flags URL when provided', async () => {
      setupFetchMock();
      const customUrl = 'https://custom.flags.api/v1/flags';

      render(
        <FlagsProvider options={{ 
          flagsURL: customUrl,
          projectId: 'test-project' 
        }}>
          <TestComponent />
        </FlagsProvider>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          customUrl,
          expect.any(Object)
        );
      });
    });

    it('should update component when flags are fetched', async () => {
      setupFetchMock();

      render(
        <FlagsProvider options={{ projectId: 'test-project' }}>
          <TestComponent />
        </FlagsProvider>
      );

      // Initially disabled
      expect(screen.getByText('Feature A: disabled')).toBeInTheDocument();

      // Wait for flags to be fetched and applied
      await waitFor(() => {
        expect(screen.getByText('Feature A: enabled')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Feature B: disabled')).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('should handle network errors gracefully', async () => {
      setupFetchMock({}, { shouldFail: true });

      render(
        <FlagsProvider options={{ 
          projectId: 'test-project',
          enableLogs: true 
        }}>
          <TestComponent />
        </FlagsProvider>
      );

      await waitFor(() => {
        expect(consoleSpy.spies.log).toHaveBeenCalledWith(
          'Flags.gg',
          expect.any(String),
          'Error fetching flags:',
          'Network error'
        );
      });

      // Should still render with default values
      expect(screen.getByText('Feature A: disabled')).toBeInTheDocument();
    });

    it('should handle non-OK responses', async () => {
      setupFetchMock({ error: 'Unauthorized' }, { status: 401 });

      render(
        <FlagsProvider options={{ 
          projectId: 'test-project',
          enableLogs: true 
        }}>
          <TestComponent />
        </FlagsProvider>
      );

      await waitFor(() => {
        expect(consoleSpy.spies.log).toHaveBeenCalledWith(
          'Flags.gg',
          expect.any(String),
          'Error fetching flags:',
          expect.stringContaining('HTTP 401')
        );
      });
    });

    it('should handle invalid JSON responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
        text: () => Promise.resolve('invalid json'),
      });

      render(
        <FlagsProvider options={{ 
          projectId: 'test-project',
          enableLogs: true 
        }}>
          <TestComponent />
        </FlagsProvider>
      );

      await waitFor(() => {
        expect(consoleSpy.spies.log).toHaveBeenCalledWith(
          'Flags.gg',
          expect.any(String),
          'Error fetching flags:',
          'Invalid JSON response from server'
        );
      });
    });

  });

  describe('Interval fetching', () => {
    it('should fetch flags at specified interval', async () => {
      jest.useFakeTimers();
      setupFetchMock({
        ...mockServerResponse,
        intervalAllowed: 5, // 5 seconds
      });

      render(
        <FlagsProvider options={{ projectId: 'test-project' }}>
          <TestComponent />
        </FlagsProvider>
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Advance time by 5 seconds
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Advance time by another 5 seconds
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3);
      });
    });


    it('should clean up interval on unmount', async () => {
      jest.useFakeTimers();
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      setupFetchMock();

      const { unmount } = render(
        <FlagsProvider options={{ projectId: 'test-project' }}>
          <TestComponent />
        </FlagsProvider>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Wait for the interval to be set up after initial fetch
      await waitFor(() => {
        expect(setIntervalSpy).toHaveBeenCalled();
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Caching', () => {

  });

  describe('Secret menu', () => {

  });

  describe('Logging', () => {

  });

  describe('Local overrides', () => {
  });

});