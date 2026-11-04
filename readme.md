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
        projectId: "bob",
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

You can get the projectId, agentId, and environmentId from flags.gg 


## Percentage rollouts

A flag can be rolled out to a percentage of visitors per environment. Each visitor always gets the same answer for a flag. By default the visitor is a random id stored in the browser (`localStorage["flagsgg:visitor"]`). Pass `targetingKey` (e.g. your user id) to keep a user's answer the same across devices:

```jsx
<FlagsProvider options={{ projectId, agentId, environmentId, targetingKey: user.id }}>
```

`is("flag").enabled()` already accounts for the rollout. If storage is blocked and there's no `targetingKey`, partially rolled-out flags stay off.

## Targeting rules

Flags can be turned on or off for specific users, groups or segments with rules set in the dashboard (e.g. "email ends with @acme.com" or "groups in beta"). Pass what you know about the user as `context`:

```jsx
<FlagsProvider options={{ projectId, agentId, environmentId, targetingKey: user.id,
  context: { email: user.email, plan: user.plan, groups: user.groups } }}>
```

The server evaluates the rules and sends back the result, so rule values never reach the browser. The first matching rule decides. If no rule matches, the percentage rollout applies.
