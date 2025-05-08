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

// Local Flags
const localFlagSettings = atomWithStorage<Flags>("localFlags", {})

const logIt = (...message: unknown[]) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const bugfixes = (window as any)?.bugfixes || require("bugfixes")
    if (bugfixes && typeof bugfixes.log === "function") {
      bugfixes.log(["flags.gg library", ...message])
    } else {
      console.log.apply(console, ["Flags.gg", new Date().toISOString(), ...message])
    }
  } catch {
    console.log.apply(console, ["Flags.gg", new Date().toISOString(), ...message])
  }
};

export const FlagsProvider: FC<FlagsProviderProps> = ({
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

  const fetchFlags = useCallback(async () => {
    const cacheKey = `flags_${projectId}_${agentId}_${environmentId}`;
    const cachedFlags = cache.getCacheEntry(cacheKey);
    if (cachedFlags && equal(flags, cachedFlags)) {
      return;
    }

    const headers = new Headers({
      "Content-Type": "application/json",
      ...(projectId && { "x-project-id": projectId }),
      ...(agentId && { "x-agent-id": agentId }),
      ...(environmentId && { "x-environment-id": environmentId }),
    });

    if (!agentId && !projectId && !environmentId) {
      return
    }

    try {
      const ac = new AbortController()
      const response = await fetch(flagsURL, {
        method: "GET",
        headers: headers,
        signal: ac.signal,
      });
      if (!response.ok) {
        const errorText = await response.text()
        if (enableLogs) {
          logIt(`Error fetching flags, status: ${response.status}: ${errorText}`);
        }
        return
      }
      
      const data: ServerResponse = await response.json();
      if (enableLogs) {
        logIt("Flags fetched:", data);
      }
      setIntervalAllowed(data.intervalAllowed ?? 900);
      setSecretMenu(data.secretMenu.sequence);
      setSecretMenuStyles(data.secretMenu.styles);
      const newFlags = data.flags ? data.flags.reduce((acc: Flags, flag: Flag) => ({
        ...acc,
        [flag.details.name]: flag,
      }), {}) : {};
      if (!equal(flags, newFlags)) {
        cache.setCacheEntry(cacheKey, newFlags, (intervalAllowed * 2000));
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
        logIt("Error fetching flags:", error);
      }
    }
  }, [flagsURL, intervalAllowed, agentId, projectId, environmentId]);

  useEffect(() => {
    const ac = new AbortController()
    const fetchAndSchedule = async () => {
      await fetchFlags()
      if (!initialFetchDoneRef.current) {
        initialFetchDoneRef.current = true
      }
    }

    fetchAndSchedule().catch(console.error)
    setInterval(fetchAndSchedule, (intervalAllowed * 1000), {
      signal: ac.signal,
    });
    return () => {
      ac.abort()
    }
  }, [fetchFlags, intervalAllowed]);

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

export const useFlags = () => {
  const flags = useContext(FlagsContext);
  const setFlags = useContext(SetFlagsContext);

  if (!flags || !setFlags) {
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
