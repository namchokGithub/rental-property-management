# CORS fails closed outside the emulator

`CORS_ALLOWED_ORIGINS` unset means "allow every origin" — an intentional convenience for local development, since Phase 4 hasn't picked a deployed frontend origin yet. Left alone, that default would also apply to a real deployment if someone forgot to set the variable. `createCorsMiddleware()` now throws at startup when the origin list is empty *and* `process.env.K_SERVICE` is set — `K_SERVICE` is a Cloud Run environment variable, present only in a real deployed 2nd-gen Function, never in the Functions Emulator or a plain local `node` run. A real deployment refuses to boot without an explicit origin list; the emulator and local scripts (smoke/unit tests) keep today's permissive default.

## Considered Options

- **Fail closed outside the emulator (chosen)** — turns "forgot to configure CORS" from a silent open-CORS deployment into a startup crash.
- **Leave as documented convenience** — rely on the `.env.example` comment and deployment discipline alone; rejected because a comment doesn't stop a bad deploy.
