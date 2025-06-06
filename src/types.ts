import {CSSProperties, ReactNode} from "react";

export interface SecretMenuStyle {
  name: string;
  value: string;
}
interface SecretMenuResponse {
  sequence: string[];
  styles: SecretMenuStyle[];
}

export interface Flag {
  enabled: boolean;
  details: {
    name: string;
    id: string
  }
}
export interface Flags {
  [key: string]: Flag;
}

export interface FlagsProviderOptions {
  projectId?: string;
  agentId?: string;
  environmentId?: string;

  flagsURL?: string;
  enableLogs?: boolean;
}

export interface FlagsProviderProps {
  options?: FlagsProviderOptions;
  children: ReactNode;
}

export interface ServerResponse {
  intervalAllowed: number;
  secretMenu: SecretMenuResponse;
  flags?: Flag[];
}

export interface SecretMenuProps {
  secretMenu?: string[];
  secretMenuStyles?: SecretMenuStyle[];
  flags: { [key: string]: Flag };
  toggleFlag: (name: string) => void;
  resetFlags: () => void;
  isFlag: (flag: string) => FlagChecker;
}

export interface CacheEntry {
  data: Flags;
  timestamp: number;
  ttl: number;
}

export interface ExtendsCSSProperties extends CSSProperties {
  [key: string]: string | number | undefined;
}

export type FlagChecker = Omit<Flag, 'enabled'> & {
  enabled: () => boolean;
  disabled: () => boolean;
  initialize: (defaultValue?: boolean) => void;
}
