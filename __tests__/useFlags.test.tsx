import React from 'react';
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FlagsProvider, useFlags } from '../src';
import { mockFlags } from './test-utils';

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
  useAtom: jest.fn().mockReturnValue([{}, jest.fn()]),
}));

jest.mock('jotai/utils', () => ({
  atomWithStorage: jest.fn().mockReturnValue({}),
  RESET: Symbol('RESET'),
}));

describe('useFlags', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <FlagsProvider>{children}</FlagsProvider>
  );

  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('Hook validation', () => {
    it('should throw error when used outside FlagsProvider', () => {
      // Suppress error output for this test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      expect(() => {
        renderHook(() => useFlags());
      }).toThrow('useFlags must be inside a FlagsContext.Provider');

      consoleErrorSpy.mockRestore();
    });

    it('should work when used inside FlagsProvider', () => {
      const { result } = renderHook(() => useFlags(), { wrapper });

      expect(result.current).toHaveProperty('is');
      expect(result.current).toHaveProperty('toggle');
      expect(result.current).toHaveProperty('initialize');
    });
  });

  describe('is() method', () => {
    it('should return flag checker object', () => {
      const { result } = renderHook(() => useFlags(), { wrapper });

      const flagChecker = result.current.is('testFlag');
      
      expect(flagChecker).toHaveProperty('enabled');
      expect(flagChecker).toHaveProperty('disabled');
      expect(flagChecker).toHaveProperty('initialize');
      expect(flagChecker).toHaveProperty('details');
    });

    it('should return false for enabled() when flag does not exist', () => {
      const { result } = renderHook(() => useFlags(), { wrapper });

      const flagChecker = result.current.is('nonExistentFlag');
      
      expect(flagChecker.enabled()).toBe(false);
      expect(flagChecker.disabled()).toBe(true);
    });

    it('should return correct details for non-existent flag', () => {
      const { result } = renderHook(() => useFlags(), { wrapper });

      const flagChecker = result.current.is('nonExistentFlag');
      
      expect(flagChecker.details).toEqual({
        name: 'nonExistentFlag',
        id: '',
      });
    });

    it('should return correct values for existing flags', () => {
      // Create a custom wrapper with initial flags
      const customWrapper = ({ children }: { children: React.ReactNode }) => {
        const { FlagsContext, SetFlagsContext } = require('../src');
        return (
          <SetFlagsContext.Provider value={jest.fn()}>
            <FlagsContext.Provider value={mockFlags}>
              {children}
            </FlagsContext.Provider>
          </SetFlagsContext.Provider>
        );
      };

      const { result } = renderHook(() => {
        const { is } = useFlags();
        return {
          featureA: is('featureA'),
          featureB: is('featureB'),
        };
      }, { wrapper: customWrapper });

      expect(result.current.featureA.enabled()).toBe(true);
      expect(result.current.featureA.disabled()).toBe(false);
      expect(result.current.featureA.details).toEqual({
        name: 'featureA',
        id: 'test-featureA-id',
      });

      expect(result.current.featureB.enabled()).toBe(false);
      expect(result.current.featureB.disabled()).toBe(true);
    });
  });

  describe('initialize() method', () => {
    it('should initialize a new flag with default value', () => {
      const setFlagsMock = jest.fn();
      
      // Custom wrapper with mocked setFlags
      const customWrapper = ({ children }: { children: React.ReactNode }) => {
        const { FlagsContext, SetFlagsContext } = require('../src');
        return (
          <SetFlagsContext.Provider value={setFlagsMock}>
            <FlagsContext.Provider value={{}}>
              {children}
            </FlagsContext.Provider>
          </SetFlagsContext.Provider>
        );
      };

      const { result } = renderHook(() => useFlags(), { wrapper: customWrapper });

      act(() => {
        result.current.initialize('newFlag');
      });

      expect(setFlagsMock).toHaveBeenCalledWith(expect.any(Function));
      
      // Test the function passed to setFlags
      const updateFunction = setFlagsMock.mock.calls[0][0];
      const newState = updateFunction({});
      
      expect(newState).toHaveProperty('newFlag');
      expect(newState.newFlag.enabled).toBe(false);
      expect(newState.newFlag.details.name).toBe('newFlag');
      expect(newState.newFlag.details.id).toBeTruthy();
    });

    it('should initialize with custom default value', () => {
      const setFlagsMock = jest.fn();
      
      const customWrapper = ({ children }: { children: React.ReactNode }) => {
        const { FlagsContext, SetFlagsContext } = require('../src');
        return (
          <SetFlagsContext.Provider value={setFlagsMock}>
            <FlagsContext.Provider value={{}}>
              {children}
            </FlagsContext.Provider>
          </SetFlagsContext.Provider>
        );
      };

      const { result } = renderHook(() => useFlags(), { wrapper: customWrapper });

      act(() => {
        result.current.initialize('newFlag', true);
      });

      const updateFunction = setFlagsMock.mock.calls[0][0];
      const newState = updateFunction({});
      
      expect(newState.newFlag.enabled).toBe(true);
    });

    it('should not initialize existing flag', () => {
      const setFlagsMock = jest.fn();
      const existingFlags = { existingFlag: mockFlags.featureA };
      
      const customWrapper = ({ children }: { children: React.ReactNode }) => {
        const { FlagsContext, SetFlagsContext } = require('../src');
        return (
          <SetFlagsContext.Provider value={setFlagsMock}>
            <FlagsContext.Provider value={existingFlags}>
              {children}
            </FlagsContext.Provider>
          </SetFlagsContext.Provider>
        );
      };

      const { result } = renderHook(() => useFlags(), { wrapper: customWrapper });

      act(() => {
        result.current.initialize('existingFlag');
      });

      expect(setFlagsMock).not.toHaveBeenCalled();
    });

    it('should work through is().initialize()', () => {
      const setFlagsMock = jest.fn();
      
      const customWrapper = ({ children }: { children: React.ReactNode }) => {
        const { FlagsContext, SetFlagsContext } = require('../src');
        return (
          <SetFlagsContext.Provider value={setFlagsMock}>
            <FlagsContext.Provider value={{}}>
              {children}
            </FlagsContext.Provider>
          </SetFlagsContext.Provider>
        );
      };

      const { result } = renderHook(() => useFlags(), { wrapper: customWrapper });

      act(() => {
        const flag = result.current.is('testFlag');
        flag.initialize(true);
      });

      expect(setFlagsMock).toHaveBeenCalled();
      const updateFunction = setFlagsMock.mock.calls[0][0];
      const newState = updateFunction({});
      expect(newState.testFlag.enabled).toBe(true);
    });
  });

  describe('toggle() method', () => {
    it('should toggle existing flag', () => {
      const setFlagsMock = jest.fn();
      const existingFlags = {
        testFlag: { enabled: false, details: { name: 'testFlag', id: '123' } }
      };
      
      const customWrapper = ({ children }: { children: React.ReactNode }) => {
        const { FlagsContext, SetFlagsContext } = require('../src');
        return (
          <SetFlagsContext.Provider value={setFlagsMock}>
            <FlagsContext.Provider value={existingFlags}>
              {children}
            </FlagsContext.Provider>
          </SetFlagsContext.Provider>
        );
      };

      const { result } = renderHook(() => useFlags(), { wrapper: customWrapper });

      act(() => {
        result.current.toggle('testFlag');
      });

      expect(setFlagsMock).toHaveBeenCalledWith(expect.any(Function));
      
      const updateFunction = setFlagsMock.mock.calls[0][0];
      const newState = updateFunction(existingFlags);
      
      expect(newState.testFlag.enabled).toBe(true);
      expect(newState.testFlag.details).toEqual(existingFlags.testFlag.details);
    });

    it('should log error when toggling non-existent flag', () => {
      const setFlagsMock = jest.fn();
      
      const customWrapper = ({ children }: { children: React.ReactNode }) => {
        const { FlagsContext, SetFlagsContext } = require('../src');
        return (
          <SetFlagsContext.Provider value={setFlagsMock}>
            <FlagsContext.Provider value={{}}>
              {children}
            </FlagsContext.Provider>
          </SetFlagsContext.Provider>
        );
      };

      const { result } = renderHook(() => useFlags(), { wrapper: customWrapper });

      act(() => {
        result.current.toggle('nonExistentFlag');
      });

      expect(setFlagsMock).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Flags.gg',
        expect.any(String),
        'Flag not found',
        'nonExistentFlag'
      );
    });

    it('should toggle from true to false', () => {
      const setFlagsMock = jest.fn();
      const existingFlags = {
        testFlag: { enabled: true, details: { name: 'testFlag', id: '123' } }
      };
      
      const customWrapper = ({ children }: { children: React.ReactNode }) => {
        const { FlagsContext, SetFlagsContext } = require('../src');
        return (
          <SetFlagsContext.Provider value={setFlagsMock}>
            <FlagsContext.Provider value={existingFlags}>
              {children}
            </FlagsContext.Provider>
          </SetFlagsContext.Provider>
        );
      };

      const { result } = renderHook(() => useFlags(), { wrapper: customWrapper });

      act(() => {
        result.current.toggle('testFlag');
      });

      const updateFunction = setFlagsMock.mock.calls[0][0];
      const newState = updateFunction(existingFlags);
      
      expect(newState.testFlag.enabled).toBe(false);
    });
  });

  describe('Hook stability', () => {
    it('should maintain stable references for methods', () => {
      const { result, rerender } = renderHook(() => useFlags(), { wrapper });

      const firstRender = {
        is: result.current.is,
        toggle: result.current.toggle,
        initialize: result.current.initialize,
      };

      rerender();

      expect(result.current.is).toBe(firstRender.is);
      expect(result.current.toggle).toBe(firstRender.toggle);
      expect(result.current.initialize).toBe(firstRender.initialize);
    });

    it('should update flag checkers when flags change', () => {
      let currentFlags = {};
      
      const customWrapper = ({ children }: { children: React.ReactNode }) => {
        const { FlagsContext, SetFlagsContext } = require('../src');
        return (
          <SetFlagsContext.Provider value={jest.fn()}>
            <FlagsContext.Provider value={currentFlags}>
              {children}
            </FlagsContext.Provider>
          </SetFlagsContext.Provider>
        );
      };

      const { result, rerender } = renderHook(() => {
        const { is } = useFlags();
        return is('testFlag');
      }, { wrapper: customWrapper });

      expect(result.current.enabled()).toBe(false);

      // Update flags
      currentFlags = {
        testFlag: { enabled: true, details: { name: 'testFlag', id: '123' } }
      };

      rerender();

      expect(result.current.enabled()).toBe(true);
    });
  });

  describe('Integration scenarios', () => {
    it('should work with multiple flags', () => {
      const flags = {
        feature1: { enabled: true, details: { name: 'feature1', id: '1' } },
        feature2: { enabled: false, details: { name: 'feature2', id: '2' } },
        feature3: { enabled: true, details: { name: 'feature3', id: '3' } },
      };
      
      const customWrapper = ({ children }: { children: React.ReactNode }) => {
        const { FlagsContext, SetFlagsContext } = require('../src');
        return (
          <SetFlagsContext.Provider value={jest.fn()}>
            <FlagsContext.Provider value={flags}>
              {children}
            </FlagsContext.Provider>
          </SetFlagsContext.Provider>
        );
      };

      const { result } = renderHook(() => {
        const { is } = useFlags();
        return {
          feature1: is('feature1'),
          feature2: is('feature2'),
          feature3: is('feature3'),
          feature4: is('feature4'), // non-existent
        };
      }, { wrapper: customWrapper });

      expect(result.current.feature1.enabled()).toBe(true);
      expect(result.current.feature2.enabled()).toBe(false);
      expect(result.current.feature3.enabled()).toBe(true);
      expect(result.current.feature4.enabled()).toBe(false);
    });
  });
});