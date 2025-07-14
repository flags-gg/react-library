import {CSSProperties, FC, useEffect, useState, useMemo, useCallback, useRef} from "react";
import {SecretMenuProps, SecretMenuStyle} from "./types";
import {ChevronLeft, ChevronRight, CircleX, RefreshCcw} from "lucide-react";
import { withErrorBoundary } from "./ErrorBoundary";

const flagsPerPage = 5;

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
    cursor: "pointer",
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
    cursor: "pointer",
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
    cursor: "pointer",
  },
  buttonDisabled: {
    background: "#FF79C6",
    padding: "0.4rem",
    borderRadius: "0.5rem",
    color: "#44475A",
    cursor: "pointer",
  },
  header: {
    fontWeight: 700,
    color: "#8BE9FD",
    top: "-.6rem",
    left: "25%",
    position: "relative",
    marginRight: "1rem",
    marginLeft: "1.5rem",
    width: "10rem",
    padding: "0px",
    marginBottom: "0px",
  },
  flagsContainer: {
    width: "99%",
  },
  headerContainer: {
    width: "99%",
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
    if (!styleString || typeof styleString !== 'string') {
      console.warn(`Invalid style string for ${elementName}`);
      return {};
    }
    const styleObject = JSON.parse(styleString);
    if (!styleObject || typeof styleObject !== 'object') {
      console.warn(`Invalid style object for ${elementName}`);
      return {};
    }
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

const SecretMenuInner: FC<SecretMenuProps> = ({
                                                  secretMenu = [],
                                                  toggleFlag,
                                                  flags,
                                                  secretMenuStyles,
                                                  resetFlags,
                                                  isFlag,
                                                }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [, setKeySequence] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  if (typeof secretMenu === "undefined") {
    secretMenu = [];
  }

  const handleToggle = useCallback((key: string) => {
    try {
      const flag = isFlag(key);
      flag.initialize();
      toggleFlag(key);
    } catch (error) {
      console.error(`Error toggling flag ${key}:`, error);
    }
  }, [isFlag, toggleFlag]);

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
    const ac = new AbortController()
    const keyHandler = (event: KeyboardEvent) => {
      try {
        setKeySequence((seq) => {
          const newSeq = [...seq.slice(-(secretMenu.length - 1)), event.key]
          setShowMenu(isSequence(newSeq))
          return newSeq
        });
      } catch (error) {
        console.error('Error in key handler:', error);
      }
    };

    try {
      document.addEventListener("keydown", keyHandler, {
        signal: ac.signal,
      });
    } catch (error) {
      console.error('Error adding event listener:', error);
    }
    
    return () => {
      try {
        ac.abort();
      } catch (error) {
        console.error('Error cleaning up event listener:', error);
      }
    }
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

  const totalPages = Math.ceil(formattedFlags.length / flagsPerPage);
  const paginatedFlags = useMemo(() => {
    const startIndex = currentPage * flagsPerPage;
    const endIndex = startIndex + flagsPerPage;
    return formattedFlags.slice(startIndex, endIndex);
  }, [currentPage, formattedFlags]);
  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1));
  }
  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  }

  if (!showMenu) { return null }

  return (
    <div style={styles.container} ref={containerRef}>
      <div style={styles.headerContainer}>
        <button style={styles.resetButton} onClick={resetDefaults}><RefreshCcw /></button>
        <button style={styles.closeButton} onClick={closeMenu}><CircleX /></button>
        <h3 style={styles.header}>Secret Menu</h3>
      </div>
      <div style={styles.flagsContainer}>
        {paginatedFlags.map(({ key, name, enabled }) => (
          <div key={`sm_item_${key}`} style={styles.flag}>
            <span key={`sm_item_span_${key}`}>{name}</span>
            <button key={`sm_item_button_${key}`} onClick={() => handleToggle(key)} style={enabled ? styles.buttonEnabled : styles.buttonDisabled}>
              {enabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
          <button
            style={{
              ...styles.buttonEnabled,
              marginRight: "0.5rem",
              visibility: currentPage > 0 ? "visible" : "hidden",
            }}
            onClick={handlePreviousPage}
          >
            <ChevronLeft />
          </button>
          <button
            style={{
              ...styles.buttonEnabled,
              visibility: currentPage < totalPages - 1 ? "visible" : "hidden",
            }}
            onClick={handleNextPage}
          >
            <ChevronRight />
          </button>
        </div>
      )}
    </div>
  );
};

export const SecretMenu = withErrorBoundary(SecretMenuInner, {
  fallback: null,
  isolate: true,
  onError: (error, errorInfo) => {
    console.error('SecretMenu Error:', error, errorInfo);
  }
});
