import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Every page hydrates from localStorage in a mount effect
      // (`useEffect(() => setX(loadX()), [])`). localStorage only exists
      // in the browser, so reading it during render would cause a
      // server/client hydration mismatch. This is the intended pattern
      // here; a useSyncExternalStore-based store would be the refactor
      // if we ever want to drop this override.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
