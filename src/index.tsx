import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  FC,
  useCallback,
  SetStateAction,
  Dispatch,
  useMemo,
} from "react";
import {deepEqual as equal} from "fast-equals";

import {
  Flag,
  type FlagChecker,
  Flags,
  FlagsProviderProps,
  SecretMenuStyle,
  ServerResponse,
} from "./types";
import { SecretMenu } from "./secretmenu";
import {Cache} from "./cache";
import { useAtom } from "jotai";
import { atomWithStorage, RESET } from "jotai/utils";
import { ErrorBoundary } from "./ErrorBoundary";

const defaultFlags: Flags = {
  dummyFlag: {
    enabled: false,
    details: {
      name: "dummyFlag",
      id: "dummy"
    }
  }
};

// Context
const FlagsContext = createContext<Flags>(defaultFlags);
const SetFlagsContext = createContext<
  Dispatch<SetStateAction<Flags>> | undefined
>(undefined);

// Local Flags
const localFlagSettings = atomWithStorage<Flags>("localFlags", {})

const logIt = (...message: unknown[]) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bugfixes = (window as any)?.bugfixes
    if (bugfixes && typeof bugfixes.log === "function") {
      bugfixes.log(["flags.gg library", ...message])
    } else {
      console.log.apply(console, ["Flags.gg", new Date().toISOString(), ...message])
    }
  } catch {
    console.log.apply(console, ["Flags.gg", new Date().toISOString(), ...message])
  }
};

const FlagsProviderInner: FC<FlagsProviderProps> = ({
  options = {},
  children,
}) => {
  const {
    flagsURL = "https://api.flags.gg/flags",
    projectId,
    agentId,
    environmentId,
    enableLogs,
  } = options;

  const [flags, setFlags] = useState<Flags>({});
  const [intervalAllowed, setIntervalAllowed] = useState(60);
  const [secretMenu, setSecretMenu] = useState<string[]>([]);
  const [localOverrides, setLocalOverrides] = useAtom(localFlagSettings);
  const [secretMenuStyles, setSecretMenuStyles] = useState<SecretMenuStyle[]>([]);
  const cache = new Cache();
  const initialFetchDoneRef = useRef(false)
  const intervalAllowedRef = useRef(60);

  const fetchFlags = useCallback(async () => {
    const cacheKey = `flags_${projectId}_${agentId}_${environmentId}`;
    
    try {
      const cachedEntry = cache.getCacheEntry(cacheKey);
      if (cachedEntry && cachedEntry.data && equal(flags, cachedEntry.data)) {
        return;
      }
    } catch (cacheError) {
      if (enableLogs) {
        logIt("Cache error:", cacheError);
      }
    }

    const headers = new Headers({
      "Content-Type": "application/json",
      ...(projectId && { "x-project-id": projectId }),
      ...(agentId && { "x-agent-id": agentId }),
      ...(environmentId && { "x-environment-id": environmentId }),
    });

    if (!agentId && !projectId && !environmentId) {
      if (enableLogs) {
        logIt("No project, agent, or environment ID provided. Skipping flag fetch.");
      }
      return
    }

    let response: Response | null = null;
    try {
      const ac = new AbortController()
      const timeoutId = setTimeout(() => ac.abort(), 30000); // 30 second timeout
      
      try {
        response = await fetch(flagsURL, {
          method: "GET",
          headers: headers,
          signal: ac.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            throw new Error('Request timeout: Flag fetch took too long');
          }
          throw fetchError;
        }
        throw new Error('Unknown fetch error');
      }
      
      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch {
          errorText = 'Unable to read error response';
        }
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      let data: ServerResponse;
      try {
        const responseText = await response.text();
        if (!responseText) {
          throw new Error('Empty response from server');
        }
        data = JSON.parse(responseText);
      } catch (parseError) {
        if (enableLogs) {
          logIt("JSON parse error:", parseError);
        }
        throw new Error('Invalid JSON response from server');
      }
      
      if (enableLogs) {
        logIt("Flags fetched:", data);
      }
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response structure');
      }
      
      const newInterval = data.intervalAllowed ?? 900;
      setIntervalAllowed(newInterval);
      intervalAllowedRef.current = newInterval;
      
      if (data.secretMenu) {
        setSecretMenu(data.secretMenu.sequence || []);
        setSecretMenuStyles(data.secretMenu.styles || []);
      }
      
      const newFlags = data.flags ? data.flags.reduce((acc: Flags, flag: Flag) => {
        if (flag && flag.details && flag.details.name) {
          return {
            ...acc,
            [flag.details.name]: flag,
          };
        }
        return acc;
      }, {}) : {};
      
      if (!equal(flags, newFlags)) {
        try {
          cache.setCacheEntry(cacheKey, newFlags, (intervalAllowedRef.current * 1000));
        } catch (cacheError) {
          if (enableLogs) {
            logIt("Failed to cache flags:", cacheError);
          }
        }
        
        setFlags((prevFlags) => {
          const updatedFlags = { ...prevFlags };
          let shouldUpdate = false;
          Object.keys(newFlags).forEach((flagKey) => {
            const override = localOverrides[flagKey]
            if (override && override.enabled !== undefined) {
              updatedFlags[flagKey] = {...newFlags[flagKey], enabled: override.enabled}
            } else {
              if (newFlags[flagKey].enabled !== prevFlags[flagKey]?.enabled) {
                shouldUpdate = true;
                updatedFlags[flagKey] = newFlags[flagKey];
              }
            }
          });
          return shouldUpdate ? updatedFlags : prevFlags;
        });
      }
    } catch (error) {
      if (enableLogs) {
        logIt("Error fetching flags:", error instanceof Error ? error.message : error);
      }
      // Use cached flags if available
      try {
        const cachedEntry = cache.getCacheEntry(cacheKey);
        if (cachedEntry && cachedEntry.data && !equal(flags, cachedEntry.data)) {
          setFlags(cachedEntry.data);
          if (enableLogs) {
            logIt("Using cached flags due to fetch error");
          }
        }
      } catch (cacheError) {
        if (enableLogs) {
          logIt("Failed to retrieve cached flags:", cacheError);
        }
      }
    }
  }, [flagsURL, intervalAllowed, agentId, projectId, environmentId, enableLogs, cache, flags, localOverrides, setFlags]);

  // Initial fetch effect
  useEffect(() => {
    const ac = new AbortController()
    const initialFetch = async () => {
      await fetchFlags()
      if (!initialFetchDoneRef.current) {
        initialFetchDoneRef.current = true
      }
    }

    initialFetch().catch(console.error)

    return () => {
      ac.abort();
    };
  }, [fetchFlags]);

  // Interval effect - separate to avoid re-creating when intervalAllowed changes
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    const startInterval = () => {
      // Clear any existing interval
      if (intervalId) {
        clearInterval(intervalId);
      }
      
      const intervalDuration = (intervalAllowedRef.current || 900) * 1000;
      intervalId = setInterval(() => {
        fetchFlags().catch(console.error);
      }, intervalDuration);
    };

    // Start the interval after initial fetch is done
    if (initialFetchDoneRef.current) {
      startInterval();
    } else {
      // Wait for initial fetch to complete
      const checkInterval = setInterval(() => {
        if (initialFetchDoneRef.current) {
          clearInterval(checkInterval);
          startInterval();
        }
      }, 100);
      
      return () => {
        clearInterval(checkInterval);
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    }

    // Cleanup function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchFlags]);

  const toggleFlag = useCallback((flagName: string) => {
    setLocalOverrides(prevOverrides => {
      const currentOverride = prevOverrides[flagName];
      const currentEnabled =
        currentOverride?.enabled ?? flags[flagName]?.enabled ?? false;
      const updatedOverride = {
        ...currentOverride,
        enabled: !currentEnabled,
      };

      return {
        ...prevOverrides,
        [flagName]: updatedOverride,
      };
    });
  }, [flags, setLocalOverrides]);

  const resetFlags = useCallback(() => {
    setLocalOverrides(RESET)
  }, [setLocalOverrides])

  const effectiveFlags = useMemo(() => {
    const mergedFlags = { ...flags };
    Object.keys(localOverrides).forEach(flagName => {
      mergedFlags[flagName] = {
        ...mergedFlags[flagName],
        enabled: localOverrides[flagName].enabled,
      };
    });
    return mergedFlags;
  }, [flags, localOverrides]);

  const isFlag = useCallback((flag: string): FlagChecker => ({
    enabled: () => effectiveFlags[flag]?.enabled ?? false,
    disabled: () => !(effectiveFlags[flag]?.enabled ?? false),
    initialize: () => {
    },
    details: effectiveFlags[flag]?.details ?? {
      name: flag,
      id: '',
    }
  }), [effectiveFlags])

  return (
    <SetFlagsContext.Provider value={setFlags}>
      <FlagsContext.Provider value={effectiveFlags}>
        {children}
        {secretMenu?.length >= 1 && (
          <SecretMenu
            secretMenu={secretMenu}
            flags={effectiveFlags}
            toggleFlag={toggleFlag}
            secretMenuStyles={secretMenuStyles}
            resetFlags={resetFlags}
            isFlag={isFlag}
          />
        )}
      </FlagsContext.Provider>
    </SetFlagsContext.Provider>
  );
};

export const FlagsProvider: FC<FlagsProviderProps> = (props) => {
  return (
    <ErrorBoundary 
      fallback={
        <div>Feature flags system encountered an error. Using default values.</div>
      }
      onError={(error, errorInfo) => {
        console.error('FlagsProvider Error:', error, errorInfo);
      }}
    >
      <FlagsProviderInner {...props} />
    </ErrorBoundary>
  );
};

export const useFlags = () => {
  const flags = useContext(FlagsContext);
  const setFlags = useContext(SetFlagsContext);

  if (!setFlags) {
    throw new Error("useFlags must be inside a FlagsContext.Provider")
  }

  const toggle = useCallback((flagName: string) => {
    if (Object.prototype.hasOwnProperty.call(flags, flagName)) {
      setFlags(prevFlags => ({
        ...prevFlags,
        [flagName]: {
          ...prevFlags[flagName],
          enabled: !prevFlags[flagName].enabled
        }
      }));
    } else {
      logIt("Flag not found", flagName)
    }
  }, [flags, setFlags]);

  const initialize = useCallback((flag: string, defaultValue = false) => {
    if (!Object.prototype.hasOwnProperty.call(flags, flag)) {
      setFlags((prevFlags) => ({
        ...prevFlags,
        [flag]: {
          details: {
            name: flag,
            id: (999 + Math.random()).toString(36).substring(2),
          },
          enabled: defaultValue,
        },
      }));
    }
  }, [flags, setFlags])

  const is = useCallback((flag: string): FlagChecker => ({
    enabled: () => flags[flag]?.enabled ?? false,
    disabled: () => !(flags[flag]?.enabled ?? false),
    initialize: (defaultValue:boolean = false) => initialize(flag, defaultValue),
    details: flags[flag]?.details ?? {
      name: flag,
      id: "",
    }
  }), [flags, initialize]);

  return {
    toggle,
    is,
    initialize,
  };
};

export { ErrorBoundary, withErrorBoundary } from './ErrorBoundary';

// Export contexts for testing
export { FlagsContext, SetFlagsContext };
