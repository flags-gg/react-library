declare module '@flags-gg/react-library' {
  import { FC, ReactNode } from 'react';

  interface FlagsProviderProps {
    options: {
      flagsURL: string;
      projectId: string;
      agentId: string;
      environmentId: string;
    };
    children?: ReactNode;
  }

  export const FlagsProvider: FC<FlagsProviderProps>;
}
