import {useMemo} from "react";

import { CSSProperties, FC, useEffect, useState } from "react";
import {ExtendsCSSProperties, SecretMenuProps} from "./types";
import { useFlags } from "./";

const styles: { [key: string]: CSSProperties } = {
  closeButton: {
    position: "absolute",
    top: "0.2rem",
    right: "0.5rem",
    color: "#F8F8F2",
    cursor: "pointer",
    background: "transparent",
    fontWeight: 900
  },
  container: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 9001,
    backgroundColor: "#282A36",
    color: "black",
    border: "2px solid #BD93F9",
    borderRadius: "0.5rem",
    padding: "1rem",
  },
  flag: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.5rem",
    background: "#44475A",
    borderRadius: "5px",
    margin: "0.5rem 0",
    color: "#F8F8F2",
    minWidth: "20rem"
  },
  buttonEnabled: {
    background: "#BD93F9",
    padding: "0.4rem",
    borderRadius: "0.5rem",
    color: "#44475A",
    fontWeight: 500
  },
  buttonDisabled: {
    background: "#FF79C6",
    padding: "0.4rem",
    borderRadius: "0.5rem",
    color: "#44475A",
    fontWeight: 500
  },
  header: {
    fontWeight: 700,
    color: "#F8F8F2",
    top: "-0.6rem",
    position: "relative"
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

export const parseStyle = (styleString: string): CSSProperties => {
  styleString = styleString.replace(/",/g, '";');

  const styleObject: ExtendsCSSProperties = {};
  const cssProperties = styleString.split(";");

  cssProperties.forEach((property: string) => {
    if (!property) {
      return;
    }

    const colonIndex = property.indexOf(":");
    if (colonIndex === -1) {
      console.error("Invalid CSS property format:", property);
      return;
    }

    const key = property.substring(0, colonIndex).trim().replace(/"/g, "");
    const value = property
      .substring(colonIndex + 1)
      .trim()
      .replace(/"/g, "");

    if (key && value) {
      styleObject[key] = value
    }
  });

  return styleObject;
};

export const SecretMenu: FC<SecretMenuProps> = ({
  secretMenu,
  toggleFlag,
  flags,
  secretMenuStyles,
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

  if (secretMenuStyles) {
    secretMenuStyles.forEach((style) => {
      styles[style.name] = parseStyle(style.value);
    });
  }

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

  return (
    showMenu && (
      <div style={styles.container}>
        <button style={styles.closeButton} onClick={() => {
            setShowMenu(false);
            setKeySequence([]);
          }}>X</button>
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
