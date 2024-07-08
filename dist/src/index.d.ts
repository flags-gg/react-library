import { FC } from "react";
import { FlagsProviderProps } from "./types";
export declare const FlagsProvider: FC<FlagsProviderProps>;
export declare const useFlags: () => {
    toggle: (flagName: string) => void;
    is: (flag: string) => {
        enabled: () => boolean;
        initialize: (defaultValue?: boolean) => void;
    };
};
