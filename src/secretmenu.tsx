import { CSSProperties, FC, useEffect, useState, useMemo, useCallback } from "react";
import {SecretMenuProps, SecretMenuStyle} from "./types";
import { useFlags } from "./";
import { CircleX, RefreshCcw } from "lucide-react";

const baseStyles: { [key: string]: CSSProperties } = {
  closeButton: {
    position: "absolute",
    top: "0.3rem",
    right: "0.5rem",
    color: "#FF5555",
    backgroundColor: "transparent",
    width: "24px",
    height: "27px",
    padding: "0px",
  },
  resetButton: {
    position: "absolute",
    top: "0.3rem",
    left: "0.5rem",
    color: "#50FA7B",
    backgroundColor: "transparent",
    width: "24px",
    height: "27px",
    padding: "0px",
  },
  container: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    backgroundColor: "#282A36",
    color: "#000000",
    borderRadius: "0.5rem",
    borderStyle: "solid",
    borderColor: "#BD93F9",
    borderWidth: "2px",
    padding: "1rem",
  },
  flag: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.5rem",
    backgroundColor: "#44475A",
    margin: "0.5rem",
    color: "#F1FA8C",
    minWidth: "20rem",
    borderRadius: "0.5rem",
  },
  buttonEnabled: {
    background: "#BD93F9",
    padding: "0.4rem",
    borderRadius: "0.5rem",
    color: "#44475A",
  },
  buttonDisabled: {
    background: "#FF79C6",
    padding: "0.4rem",
    borderRadius: "0.5rem",
    color: "#44475A",
  },
  header: {
    fontWeight: 700,
    color: "#8BE9FD",
    top: "-1.8rem",
    position: "relative",
    marginRight: "1rem",
    marginLeft: "1.5rem",
    width: "10rem",
    padding: "0px",
    marginBottom: "0px",
  },
  flagsContainer: {
    marginTop: "-7%",
  },
};

export const formatFeatureName = (name: string): string => {
  return name
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/([0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const parseStyle = (elementName: string, styleString: string): CSSProperties => {
  try {
    const styleObject = JSON.parse(styleString);
    return Object.fromEntries(
      Object.entries(styleObject).map(([key, value]) => [
        key.replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace('-', '').replace('_', '')),
        value
      ])
    );
  } catch (error) {
    console.error(`Error parsing style for ${elementName}:`, error);
    return {};
  }
};

export const SecretMenu: FC<SecretMenuProps> = ({
  secretMenu = [],
  toggleFlag,
  flags,
  secretMenuStyles,
  resetFlags,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [, setKeySequence] = useState<string[]>([]);
  const { is } = useFlags();

  if (typeof secretMenu === "undefined") {
    secretMenu = [];
  }

  const handleToggle = useCallback((key: string) => {
    const flag = is(key);
    flag.initialize();
    toggleFlag(key);
  }, [is, toggleFlag]);

  const styles = useMemo(() => {
    const updatedStyles = { ...baseStyles }
    if (secretMenuStyles) {
      secretMenuStyles.forEach((style: SecretMenuStyle) => {
        const parsedStyle = parseStyle(style.name, style.value)
        updatedStyles[style.name] = {
          ...updatedStyles[style.name],
          ...parsedStyle
        }
      })
    }
    return updatedStyles
  }, [secretMenuStyles])

  const isSequence = useCallback((seq: string[]) => {
    return seq.length == secretMenu.length && seq.every((key, index) => key === secretMenu[index])
  }, [secretMenu])

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      setKeySequence((seq) => {
        const newSeq = [...seq.slice(-(secretMenu.length - 1)), event.key]
        setShowMenu(isSequence(newSeq))
        return newSeq
      });
    };

    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  }, [secretMenu, isSequence]);

  const formattedFlags = useMemo(() => {
    return Object.entries(flags).map(([key, value]) => ({
      key,
      name: formatFeatureName(key),
      enabled: value.enabled,
    }))
  }, [flags])

  const closeMenu = () => {
    setShowMenu(false);
    setKeySequence([]);
  }

  const resetDefaults = () => {
    resetFlags()
  }

  if (!showMenu) { return null }
  console.info("showMenu isnt null", styles, formattedFlags)

  return (
    <div style={styles.container}>
      <button style={styles.resetButton} onClick={resetDefaults}><RefreshCcw /></button>
      <button style={styles.closeButton} onClick={closeMenu}><CircleX /></button>
      <h3 style={styles.header}>Secret Menu</h3>
      <div style={styles.flagsContainer}>
        {formattedFlags.map(({ key, name, enabled }) => (
          <div key={`sm_item_${key}`} style={styles.flag}>
            <span key={`sm_item_span_${key}`}>{name}</span>
            <button key={`sm_item_button_${key}`} onClick={() => handleToggle(key)} style={enabled ? styles.buttonEnabled : styles.buttonDisabled}>
              {enabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
