import React from 'react';

export interface SecretMenuStyle {
  name: string;
  value: string;
}
interface SecretMenuResponse {
  sequence: string[];
  styles: SecretMenuStyle[];
}

export interface Flag {
  enabled?: boolean;
  secretMenu: string[];
  featureValue?: string;
  feature: {
    name: string;
    id: string
  }
}
export interface Flags {
  [key: string]: Flag;
}

export interface FlagsProviderOptions {
  flagsURL?: string;
  companyId?: string;
  agentId?: string;
  enableLogs?: boolean;

}

export interface FlagsProviderProps {
  options: FlagsProviderOptions;
  children: React.ReactNode;
}

export interface ServerResponse {
  intervalAllowed: number;
  secretMenu: SecretMenuResponse;
  flags: Flag[];
}

export interface SecretMenuProps {
  secretMenu?: string[];
  secretMenuStyles?: SecretMenuStyle[];
  flags: { [key: string]: Flag };
  toggleFlag: (name: string) => void;
}
