import { CSSProperties, FC, useEffect, useState, useMemo } from "react";
import {SecretMenuProps, SecretMenuStyle} from "./types";
import { useFlags } from "./";
import { CircleX, RefreshCcw } from "lucide-react";

const baseStyles: { [key: string]: CSSProperties } = {
  closeButton: {
    position: "absolute",
    top: "0.3rem",
    right: "0.5rem",
    color: "#F8F8F2",
    cursor: "pointer",
    background: "transparent",
    fontWeight: 900,
  },
  resetButton: {
    position: "absolute",
    top: "0.3rem",
    left: "0.5rem",
    color: "#F8F8F2",
    cursor: "pointer",
    background: "transparent",
    fontWeight: 900,
  },
  container: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 9001,
    backgroundColor: "#282A36",
    color: "#000000",
    borderStyle: "solid",
    borderColor: "#BD93F9",
    borderWidth: "2px",
    borderRadius: "0.5rem",
    padding: "1rem",
  },
  flag: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.5rem",
    backgroundColor: "#44475A",
    margin: "0.5rem",
    color: "#F8F8F2",
    minWidth: "20rem",
  },
  buttonEnabled: {
    background: "#BD93F9",
    padding: "0.4rem",
    borderRadius: "0.5rem",
    color: "#44475A",
    fontWeight: 500,
  },
  buttonDisabled: {
    background: "#FF79C6",
    padding: "0.4rem",
    borderRadius: "0.5rem",
    color: "#44475A",
    fontWeight: 500,
  },
  header: {
    fontWeight: 700,
    color: "#8BE9FD",
    top: "-0.6rem",
    position: "relative",
    marginRight: "1rem",
    marginLeft: "1.5rem",
    width: "10rem",
  }
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
  secretMenu,
  toggleFlag,
  flags,
  secretMenuStyles,
  resetFlags,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [keySequence, setKeySequence] = useState<string[]>([]);
  const { is } = useFlags();

  if (typeof secretMenu === "undefined") {
    secretMenu = [];
  }

  const handleToggle = (key: string) => {
    const flag = is(key);
    flag.initialize();
    toggleFlag(key);
  };

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

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      setKeySequence((seq) => [
        ...seq.slice(-(secretMenu.length - 1)),
        event.key,
      ]);
    };

    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  }, [secretMenu]); // Depend on secretMenu

  useEffect(() => {
    if (JSON.stringify(keySequence) === JSON.stringify(secretMenu)) {
      setShowMenu(true);
    } else {
      setShowMenu(false);
    }
  }, [keySequence, secretMenu]);

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

  return (
    showMenu && (
      <div style={styles.container}>
        <button style={styles.resetButton} onClick={resetDefaults}><RefreshCcw /></button>
        <button style={styles.closeButton} onClick={closeMenu}><CircleX /></button>
        <h1 style={styles.header}>Secret Menu</h1>
        {formattedFlags.map(({ key, name, enabled }) => (
          <div key={`sm_item_${key}`} style={styles.flag}>
            <span>{name}</span>
            <button onClick={() => handleToggle(key)} style={enabled ? styles.buttonEnabled : styles.buttonDisabled}>
              {enabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        ))}
      </div>
    )
  );
};
