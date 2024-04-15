import {
  createContext,
  useContext,
  useEffect,
  useState,
  FC,
  useCallback,
  SetStateAction,
  Dispatch
} from 'react';
import equal from 'fast-deep-equal';

import {Flag, Flags, FlagsProviderProps, SecretMenuStyle, ServerResponse} from './types';
import SecretMenu from "./secretmenu";

const defaultFlags: Flags = {};
const FlagsContext = createContext<Flags>(defaultFlags);
const SetFlagsContext = createContext<Dispatch<SetStateAction<Flags>> | undefined>(undefined);

const logIt = (...message: unknown[]) => {
  console.log.apply(console, [
    'Flags.gg',
    new Date().toISOString(),
    ...message,
  ]);
}

export const FlagsProvider: FC<FlagsProviderProps> = ({ options, children }) => {
  const { flagsURL = "https://api.flags.gg/v1/flags", companyId, agentId, enableLogs } = options;

  const [flags, setFlags] = useState<Flags>({});
  const [intervalAllowed, setIntervalAllowed] = useState(60);
  const [secretMenu, setSecretMenu] = useState<string[]>([]);
  const [localOverrides, setLocalOverrides] = useState<Flags>({});
  const [secretMenuStyles, setSecretMenuStyles] = useState<SecretMenuStyle[]>([]);

  const fetchFlags = useCallback(async () => {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    if (companyId) {
      headers.append('x-company-id', companyId);
    }
    if (agentId) {
      headers.append('x-agent-id', agentId);
    }

    try {
      const response = await fetch(flagsURL, {
        method: 'GET',
        headers: headers,
      });
      const data: ServerResponse = await response.json();
      if (enableLogs) { logIt('Flags fetched:', data); }
      setIntervalAllowed(data.intervalAllowed);
      setSecretMenu(data.secretMenu.sequence);
      setSecretMenuStyles(data.secretMenu.styles);
      const newFlags = data.flags.reduce((acc: Flags, flag: Flag) => ({
        ...acc,
        [flag.feature.name]: flag
      }), {});
      if (!equal(flags, newFlags)) {
        setFlags(prevFlags => {
          const updatedFlags = {...newFlags};
          Object.keys(prevFlags).forEach(flagKey => {
            if (localOverrides[flagKey] && localOverrides[flagKey].hasOwnProperty!('enabled')) {
              updatedFlags[flagKey].enabled = localOverrides[flagKey].enabled;
            }
          });
          return updatedFlags;
        });
      }
    } catch (error) {
      console.error('Error fetching flags:', error);
    }
  }, [flagsURL, intervalAllowed, agentId, companyId]);

  useEffect(() => {
    fetchFlags().catch(console.error);
    const interval = setInterval(fetchFlags, intervalAllowed * 1000)
    return () => clearInterval(interval);
  }, [fetchFlags, intervalAllowed]);

  const toggleFlag = (flagName: string) => {
    if (enableLogs) { logIt('Toggling flag:', flagName); }

    setFlags(prevFlags => ({
      ...prevFlags,
      [flagName]: {
        ...prevFlags[flagName],
        enabled: !prevFlags[flagName].enabled,
      },
    }));
    setLocalOverrides(prevLocalOverrides => ({
      ...prevLocalOverrides,
      [flagName]: {
        ...prevLocalOverrides[flagName],
        enabled: !prevLocalOverrides[flagName]?.enabled,
      },
    }));
  }

  return (
    <SetFlagsContext.Provider value={setFlags}>
      <FlagsContext.Provider value={flags}>
        {children}
        {secretMenu && <SecretMenu secretMenu={secretMenu} flags={flags} toggleFlag={toggleFlag} secretMenuStyles={secretMenuStyles} />}
      </FlagsContext.Provider>
    </SetFlagsContext.Provider>
  );
};

export const useFlags = () => {
  const flags = useContext(FlagsContext);
  const setFlags = useContext(SetFlagsContext);

  if (flags === undefined) {
    throw new Error('useFlags must be used within a FlagsContext.Provider');
  }
  if (setFlags === undefined) {
    throw new Error('useFlags must be used within a SetFlagsContext.Provider');
  }

  return {
    is: (flag: string) => ({
      enabled: () => flags[flag]?.enabled ?? false,
      initialize: (defaultValue = false) => {
        if (!flags.hasOwnProperty(flag)) {
          if (setFlags) {
            setFlags(prevFlags => ({
              ...prevFlags,
              [flag]: {
                feature: {
                  name: flag,
                  id: (999 + Math.random()).toString(36).substring(2),
                },
                enabled: defaultValue,
              }
            }));
          }
        }
      }
    })
  };
};
