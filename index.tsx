import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  FC,
  useCallback,
  SetStateAction,
  Dispatch,
} from "react";
// @ts-ignore
import equal from "fast-deep-equal";

import {
  Flag,
  Flags,
  FlagsProviderProps,
  SecretMenuStyle,
  ServerResponse,
} from "./types";
import { SecretMenu } from "./secretmenu";
import {Cache} from "./cache";

const defaultFlags: Flags = {};
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
  options,
  children,
}) => {
  const {
    flagsURL = "https://api.flags.gg/v1/flags",
    companyId,
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

  const fetchFlags = useCallback(async () => {
    const cacheKey = `flags_${companyId}_${agentId}_${environmentId}`;
    const cachedFlags = cache.getCacheEntry(cacheKey);
    if (cachedFlags) {
      if (!equal(flags, cachedFlags)) {
        setFlags(cachedFlags);
      }
      return;
    }

    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    if (companyId) {
      headers.append("x-company-id", companyId);
    }
    if (agentId) {
      headers.append("x-agent-id", agentId);
    }
    if (environmentId) {
      headers.append("x-environment-id", environmentId);
    }

    try {
      const response = await fetch(flagsURL, {
        method: "GET",
        headers: headers,
      });
      const data: ServerResponse = await response.json();
      if (enableLogs) {
        logIt("Flags fetched:", data);
      }
      setIntervalAllowed(data.intervalAllowed);
      setSecretMenu(data.secretMenu.sequence);
      setSecretMenuStyles(data.secretMenu.styles);
      const newFlags = data.flags ? data.flags.reduce(
        (acc: Flags, flag: Flag) => ({
          ...acc,
          [flag.details.name]: flag,
        }),
        {},
      ) : {};
      if (!equal(flags, newFlags)) {
        cache.setCacheEntry(cacheKey, newFlags, (intervalAllowed * 2000));
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
      console.error("Error fetching flags:", error);
    }
  }, [flagsURL, intervalAllowed, agentId, companyId, environmentId]);

  useEffect(() => {
    fetchFlags().catch(console.error);
    const interval = setInterval(fetchFlags, (intervalAllowed * 1000));
    return () => clearInterval(interval);
  }, [fetchFlags, intervalAllowed]);

  const toggleFlag = (flagName: string) => {
    if (enableLogs) {
      logIt("Toggling flag:", flagName);
    }

    setFlags((prevFlags) => ({
      ...prevFlags,
      [flagName]: {
        ...prevFlags[flagName],
        enabled: !prevFlags[flagName].enabled,
      },
    }));
    setLocalOverrides((prevLocalOverrides) => ({
      ...prevLocalOverrides,
      [flagName]: {
        ...prevLocalOverrides[flagName],
        enabled: !prevLocalOverrides[flagName]?.enabled,
      },
    }));
  };

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

  if (flags === undefined) {
    throw new Error("useFlags must be used within a FlagsContext.Provider");
  }
  if (setFlags === undefined) {
    throw new Error("useFlags must be used within a SetFlagsContext.Provider");
  }

  return {
    is: (flag: string) => ({
      enabled: () => flags[flag]?.enabled ?? false,
      initialize: (defaultValue = false) => {
        if (!flags.hasOwnProperty(flag)) {
          if (setFlags) {
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
        }
      },
    }),
  };
};
