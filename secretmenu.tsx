import {CSSProperties, FC, useEffect, useState} from 'react';
import {SecretMenuProps} from "./types";

function formatFeatureName(name: string): string {
  return name
    .replace(/([A-Z0-9]+)/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}


function parseStyle(styleString: string): CSSProperties {
  styleString = styleString.replace(/",/g, '";');

  const styleObject: CSSProperties = {};
  const cssProperties = styleString.split(';');

  cssProperties.forEach((property: string) => {
    if (!property) { return; }

    const colonIndex = property.indexOf(':');
    if (colonIndex === -1) {
      console.error('Invalid CSS property format:', property);
      return;
    }

    const key = property.substring(0, colonIndex).trim().replace(/"/g, '');
    const value = property.substring(colonIndex + 1).trim().replace(/"/g, '');

    if (key && value) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      styleObject[key] = value;
    }
  });

  return styleObject;
}

const SecretMenu: FC<SecretMenuProps> = ({secretMenu, toggleFlag, flags, secretMenuStyles }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [keySequence, setKeySequence] = useState<string[]>([]);
  if (typeof secretMenu === 'undefined') { secretMenu = []; }

  const styles: {[key: string]: CSSProperties } = {
    "closeButton": {
      position: "absolute",
      top: 0,
      right: -15,
      color: "black",
      cursor: "pointer",
      width: "5px",
    },
    "container": {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: 1000,
      backgroundColor: "white",
      color: "black",
      border: "1px solid black",
      borderRadius: "5px",
      padding: "1rem",
    },
    "button": {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0.5rem",
      background: "lightgray",
      borderRadius: "5px",
      margin: "0.5rem 0",
    }
  }
  if (secretMenuStyles) {
    secretMenuStyles.forEach(style => {
      styles[style.name] = parseStyle(style.value);
    })
  }

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      setKeySequence(seq => [...seq.slice(-(secretMenu.length - 1)), event.key]);
    };

    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  }, [secretMenu]);  // Depend on secretMenu

  useEffect(() => {
    if (JSON.stringify(keySequence) === JSON.stringify(secretMenu)) {
      setShowMenu(true);
    } else {
      setShowMenu(false);
    }
  }, [keySequence, secretMenu]);

  return showMenu ? (
    <div style={styles.container}>
      <button
        style={styles.closeButton}
        onClick={() => {
          setShowMenu(false)
          setKeySequence([])
        }}>X</button>
      <h1>Secret Menu</h1>
      {Object.entries(flags).map(([key, value]) => (
        <div key={`sm_item_${key}`} style={styles.button}>
          <span>{formatFeatureName(key)}</span>
          <button
            key={`sm_button_${key}`}
            onClick={() => toggleFlag(value.feature.name)}
          >
            {value.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      ))}
    </div>
  ) : null;
};

export default SecretMenu;
