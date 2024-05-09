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
import {deepEqual as equal} from "fast-equals";

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
    if (cachedFlags && equal(flags, cachedFlags)) {
      return;
    }

    const headers = new Headers({
      "Content-Type": "application/json",
      ...(companyId && { "x-company-id": companyId }),
      ...(agentId && { "x-agent-id": agentId }),
      ...(environmentId && { "x-environment-id": environmentId }),
    });

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
        enabled: !(currentOverride?.enabled ?? false),
      };
      return {
        ...prevOverrides,
        [flagName]: updatedOverride,
      };
    });
  }, []);

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

  return {
    is: (flag: string) => ({
      enabled: () => flags[flag]?.enabled ?? false,
      initialize: (defaultValue = false) => {
        if (!flags.hasOwnProperty(flag)) {
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
      },
    }),
  };
};
