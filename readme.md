# React Library for Flags.gg

The easiest way to use this is to wrap your app code

```jsx
import {BrowserRouter} from "react-router-dom";
import {FlagsProvider} from "@flags-gg/react-library";

import SiteRouter from "@C/SiteRouter";

function App() {
  return (
    <BrowserRouter>
      <FlagsProvider options={{
        companyId: "bob",
        agentId: "bob",
        environmentId: "bob",
      }}>
        <SiteRouter />
      </FlagsProvider>
    </BrowserRouter>
  );
}

export default App;
```

You can get the companyId, agentId, and environmentId from flags.gg 

