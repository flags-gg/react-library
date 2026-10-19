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

const DEFAULT_FLAGS_URL = "https://api.flags.gg/flags";
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

// Only https, or plain http to a local dev server
const safeFlagsURL = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || (parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) {
      return url;
    }
  } catch {
    // fall through
  }
  console.warn(`Flags.gg: refusing insecure flagsURL "${url}", using ${DEFAULT_FLAGS_URL}`);
  return DEFAULT_FLAGS_URL;
};

// Server-provided interval in seconds, clamped to [10, 3600]
const clampInterval = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 60;
  }
  return Math.min(3600, Math.max(10, value));
};

const readCappedText = async (response: Response): Promise<string> => {
  const length = Number(response.headers?.get("content-length"));
  if (length > MAX_RESPONSE_BYTES) {
    throw new Error("Response too large");
  }
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new Error("Response too large");
  }
  return text;
};

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
    flagsURL: rawFlagsURL = DEFAULT_FLAGS_URL,
    projectId,
    agentId,
    environmentId,
    enableLogs,
  } = options;
  const flagsURL = useMemo(() => safeFlagsURL(rawFlagsURL), [rawFlagsURL]);
  // Overrides are namespaced per project/agent/environment
  const overridesKey = `flagsgg:overrides:${projectId ?? ""}:${agentId ?? ""}:${environmentId ?? ""}`;
  const localFlagSettings = useMemo(() => atomWithStorage<Flags>(overridesKey, {}), [overridesKey]);

  const [flags, setFlags] = useState<Flags>({});
  const [intervalAllowed, setIntervalAllowed] = useState(900); // Default to 900s fallback
  const [secretMenu, setSecretMenu] = useState<string[]>([]);
  const [localOverrides, setLocalOverrides] = useAtom(localFlagSettings);
  const [secretMenuStyles, setSecretMenuStyles] = useState<SecretMenuStyle[]>([]);
  const [serverFlagNames, setServerFlagNames] = useState<string[]>([]);
  const [cache] = useState(() => new Cache());
  const intervalAllowedRef = useRef(900); // Default to 900s fallback
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const fetchFlagsRef = useRef<() => Promise<void>>(async () => {})

  const fetchFlags = useCallback(async () => {
    const cacheKey = `flags_${projectId}_${agentId}_${environmentId}`;

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
          errorText = (await readCappedText(response)).slice(0, 200);
        } catch {
          errorText = 'Unable to read error response';
        }
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const responseText = await readCappedText(response);
      let data: ServerResponse;
      try {
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
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response structure');
      }
      
      const newInterval = clampInterval(data.intervalAllowed);
      if (newInterval !== intervalAllowedRef.current) {
        setIntervalAllowed(newInterval);
        intervalAllowedRef.current = newInterval;
        // Reconfigure the polling interval immediately to avoid waiting for the effect tick
        const intervalDuration = newInterval * 1000;
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = null;
        }
        if (enableLogs) {
          logIt(`Reconfiguring interval immediately to: ${intervalDuration}ms (${newInterval}s)`);
        }
        intervalIdRef.current = setInterval(() => {
          fetchFlagsRef.current()
            .catch((error) => {
              if (enableLogs) {
                logIt("Interval fetch error, will retry in next interval:", error);
              }
            });
        }, intervalDuration);
      }
      
      // Secret menu is only active while the server sends a non-empty sequence
      const sequence = Array.isArray(data.secretMenu?.sequence)
        ? data.secretMenu.sequence.filter((key) => typeof key === "string")
        : [];
      setSecretMenu((prev) => equal(prev, sequence) ? prev : sequence);
      setSecretMenuStyles(sequence.length > 0 && Array.isArray(data.secretMenu.styles) ? data.secretMenu.styles : []);
      if (sequence.length === 0) {
        setLocalOverrides(RESET);
      }
      
      const newFlags = Array.isArray(data.flags) ? data.flags.reduce((acc: Flags, flag: Flag) => {
        if (flag && flag.details && flag.details.name) {
          return {
            ...acc,
            [flag.details.name]: flag,
          };
        }
        return acc;
      }, {}) : {};
      const newFlagNames = Object.keys(newFlags);
      setServerFlagNames((prev) => equal(prev, newFlagNames) ? prev : newFlagNames);

      if (enableLogs) {
        logIt(`Flags fetched: ${newFlagNames.length}`, newFlagNames);
      }
      
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
            if (newFlags[flagKey].enabled !== prevFlags[flagKey]?.enabled) {
              shouldUpdate = true;
              updatedFlags[flagKey] = newFlags[flagKey];
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
  }, [flagsURL, agentId, projectId, environmentId, enableLogs, cache, flags, setLocalOverrides, setFlags]);

  // Keep a stable ref to the latest fetchFlags to avoid effect re-creations
  useEffect(() => {
    fetchFlagsRef.current = fetchFlags
  }, [fetchFlags])

  // Initial fetch effect
  useEffect(() => {
    const ac = new AbortController()
    const run = async () => {
      try {
        await fetchFlagsRef.current()
      } catch (e) {
        if (enableLogs) {
          logIt("Initial fetch failed:", e)
        }
      }
    }

    run().catch(() => {})

    return () => {
      ac.abort();
    };
  }, [enableLogs]);

  // Interval effect - responds to intervalAllowed changes
  useEffect(() => {
    // Clear any existing interval
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    // Start new interval with current intervalAllowed value
    // Always use intervalAllowed which defaults to 900s if server fails
    const intervalDuration = intervalAllowed * 1000;
    if (enableLogs) {
      logIt(`Setting up interval with duration: ${intervalDuration}ms (${intervalAllowed}s)`);
    }
    
    intervalIdRef.current = setInterval(() => {
      fetchFlagsRef.current()
        .catch((error) => {
          if (enableLogs) {
            logIt("Interval fetch error, will retry in next interval:", error);
          }
        });
    }, intervalDuration);

    // Cleanup function
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [intervalAllowed, enableLogs]);

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

  // Overrides only apply while the secret menu is active, and only to flags the server returned
  const secretMenuActive = secretMenu.length > 0;
  const effectiveFlags = useMemo(() => {
    const mergedFlags = { ...flags };
    if (!secretMenuActive) {
      return mergedFlags;
    }
    Object.keys(localOverrides).forEach(flagName => {
      if (!serverFlagNames.includes(flagName) || !mergedFlags[flagName] || typeof localOverrides[flagName]?.enabled !== "boolean") {
        return;
      }
      mergedFlags[flagName] = {
        ...mergedFlags[flagName],
        enabled: localOverrides[flagName].enabled,
      };
    });
    return mergedFlags;
  }, [flags, localOverrides, secretMenuActive, serverFlagNames]);

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
        {secretMenuActive && (
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
  return <FlagsProviderInner {...props} />;
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
