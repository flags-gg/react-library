import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  FC,
  useCallback,
  SetStateAction,
  Dispatch,
} from "react";
import {deepEqual as equal} from "fast-equals";

import {
  Flag,
  Flags,
  FlagsProviderProps,
  SecretMenuStyle,
  ServerResponse,
} from "./types.d.ts";
import { SecretMenu } from "./secretmenu.tsx";
import {Cache} from "./cache.ts";

const defaultFlags: Flags = {};

// Contextx
const FlagsContext = createContext<Flags>(defaultFlags);
const SetFlagsContext = createContext<
  Dispatch<SetStateAction<Flags>> | undefined
>(undefined);

const logIt = (...message: unknown[]) => {
  console.log.apply(console, [
    "Flags.gg",
    new Date().toISOString(),
    ...message,
  ]);
};

export const FlagsProvider: FC<FlagsProviderProps> = ({
  options = {},
  children,
}) => {
  const {
    flagsURL = "https://api.flags.gg/v1/flags",
    projectId,
    agentId,
    environmentId,
    enableLogs,
  } = options;

  const [flags, setFlags] = useState<Flags>({});
  const [intervalAllowed, setIntervalAllowed] = useState(60);
  const [secretMenu, setSecretMenu] = useState<string[]>([]);
  const [localOverrides, setLocalOverrides] = useState<Flags>({});
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

    try {
      const response = await fetch(flagsURL, {
        method: "GET",
        headers: headers,
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
      setIntervalAllowed(data.intervalAllowed);
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
    const fetchAndSchedule = async () => {
      await fetchFlags()
      if (!initialFetchDoneRef.current) {
        initialFetchDoneRef.current = true
      }
    }

    fetchAndSchedule().catch(console.error)
    const interval = setInterval(fetchAndSchedule, (intervalAllowed * 1000));
    return () => clearInterval(interval);
  }, [fetchFlags, intervalAllowed]);

  useEffect(() => {
    setFlags(prevFlags => {
      const updatedFlags = {...prevFlags}
      Object.keys(localOverrides).forEach(key => {
        const override = localOverrides[key]
        if (override) {
          updatedFlags[key] = {
            ...prevFlags[key],
            enabled: override.enabled
          }
        }
      })
      return updatedFlags
    })
  }, [localOverrides])

  const toggleFlag = useCallback((flagName: string) => {
    setFlags(prevFlags => {
      const currentFlag = prevFlags[flagName];
      const updatedFlag = {
        ...currentFlag,
        enabled: !currentFlag.enabled,
      };
      return {
        ...prevFlags,
        [flagName]: updatedFlag,
      };
    });
    setLocalOverrides(prevOverrides => {
      const currentOverride = prevOverrides[flagName];
      const updatedOverride = {
        ...currentOverride,
        enabled: !(currentOverride?.enabled ?? flags[flagName]?.enabled),
      };
      return {
        ...prevOverrides,
        [flagName]: updatedOverride,
      };
    });
  }, [flags, setFlags, setLocalOverrides]);

  return (
    <SetFlagsContext.Provider value={setFlags}>
      <FlagsContext.Provider value={flags}>
        {children}
        {secretMenu?.length >= 1 && (
          <SecretMenu
            secretMenu={secretMenu}
            flags={flags}
            toggleFlag={toggleFlag}
            secretMenuStyles={secretMenuStyles}
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

  return {
    toggle,
    is: (flag: string) => ({
      enabled: () => {
        return flags[flag]?.enabled ?? false
      },
      initialize: (defaultValue = false) => initialize(flag, defaultValue),
    }),
  };
};
