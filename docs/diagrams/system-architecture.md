# System Architecture Diagram

```mermaid
flowchart TB
    subgraph Client["Browser"]
        SPA["React 18 SPA\nVite + Tailwind"]
        Auth["AuthContext\nlocalStorage Bearer token"]
        Pages["Role-gated pages\nPatients, Appointments, Clinical, Billing"]
        Charts["Recharts dashboards"]
    end

    subgraph Edge["HTTP boundary"]
        Proxy["Vite proxy / reverse proxy\n/api"]
        CORS["CORS allowlist"]
    end

    subgraph API["Express API"]
        MW["Helmet, rate limits,\nrequest ID, sanitization"]
        AuthMW["Authentication\nJWT cookie or Bearer"]
        RBAC["RBAC + resource scoping"]
        Validation["Zod validation"]
        Routes["Routers and controllers"]
        Services["Domain services\nappointments, clinical, billing,\nreports, audit"]
        Models["Mongoose models"]
        Docs["Swagger / OpenAPI\n/api/docs"]
    end

    subgraph DB["MongoDB"]
        Collections["15 collections\nunique indexes + counters"]
    end

    SPA --> Auth
    SPA --> Pages
    Pages --> Charts
    SPA --> Proxy
    Proxy --> CORS
    CORS --> MW
    MW --> AuthMW
    AuthMW --> RBAC
    RBAC --> Validation
    Validation --> Routes
    Routes --> Services
    Services --> Models
    Models --> Collections
    Routes --> Docs
```

## Trust boundaries

- The browser is untrusted. Every authorization and business rule is rechecked by the API.
- The frontend role guards only improve navigation; they do not replace server authorization.
- MongoDB is the source of truth for uniqueness, slots, balances and audit records.
- Swagger is enabled by the API and documents the same route contracts used by the frontend.
