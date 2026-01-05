graph TD
    subgraph Frontend [Frontend (Next.js - Port 3000)]
        User[User Browser]
        SignUpPage[Sign Up Page (/signup)]
        HomePage[Home Page (/)]
    end

    subgraph Backend [Backend (Rust/Axum - Port 8080)]
        API[API Server]
        AuthRoute[POST /auth/signup]
        RootRoute[GET /]
    end

    subgraph Database [Database (Postgres - Port 5432)]
        DB[(Praxis DB)]
        UsersTable[Table: users]
        LocalAuthsTable[Table: local_auths]
    end

    %% Flow 1: Home Page Load
    User -->|Opens localhost:3000| HomePage
    HomePage -->|Fetch GET /| RootRoute
    RootRoute -->|Returns 'Hello...'| HomePage

    %% Flow 2: Sign Up
    User -->|Navigates to| SignUpPage
    SignUpPage -->|Submits Form JSON| AuthRoute
    
    AuthRoute -->|1. Check Email| LocalAuthsTable
    LocalAuthsTable -- Returns Result --> AuthRoute
    
    AuthRoute -->|2. Hash Password| AuthRoute
    
    AuthRoute -->|3. Begin Transaction| DB
    AuthRoute -->|4. Insert User| UsersTable
    AuthRoute -->|5. Insert Auth| LocalAuthsTable
    AuthRoute -->|6. Commit Transaction| DB
    
    AuthRoute -- Returns 201 Created --> SignUpPage
    SignUpPage -- Redirects --> HomePage