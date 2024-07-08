import React, {useMemo} from "react";

import { CSSProperties, FC, useEffect, useState } from "react";
import { SecretMenuProps } from "./types.d";
import { useFlags } from "./";

const styles: { [key: string]: CSSProperties } = {
  closeButton: {
    position: "absolute",
    top: 0,
    right: 0,
    color: "black",
    cursor: "pointer",
    background: "transparent",
  },
  container: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 9001,
    backgroundColor: "white",
    color: "black",
    border: "1px solid black",
    borderRadius: "5px",
    padding: "1rem",
  },
  button: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.5rem",
    background: "lightgray",
    borderRadius: "5px",
    margin: "0.5rem 0",
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

export const parseStyle = (styleString: string): CSSProperties => {
  styleString = styleString.replace(/",/g, '";');

  const styleObject: CSSProperties = {};
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
      (styleObject as React.CSSProperties & {[key: string]: any})[key] = value;
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
        <h1>Secret Menu</h1>
        {formattedFlags.map(({ key, name, enabled }) => (
          <div key={`sm_item_${key}`} style={styles.button}>
            <span>{name}</span>
            <button onClick={() => handleToggle(key)}>
              {enabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        ))}
      </div>
    )
  );
};
