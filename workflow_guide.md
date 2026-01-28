# Recommended Workflow for Team Development (You + Luke)

Since you are both working on the same project using Git and Railway/Next.js/Rust, you need a workflow that avoids conflicts (like the `sqlx` issue) and keeps you in sync.

## 1. Daily/Per-Task Workflow

### A. Before You Start Coding (Every Morning/Session)
Always pull the latest changes from GitHub to ensure you have Luke's work.
```bash
git checkout main
git pull origin main
```
*If you are working on a feature branch (Recommended):*
```bash
git checkout -b feature/my-new-feature
```

### B. When Making Database Changes (CRITICAL for Rust/SQLx)
If you or Luke modify the database schema (migrations) or add new SQL queries in Rust:
1.  **Run Migrations Locally**: `sqlx migrate run`
2.  **Update `.sqlx` Data**: You **MUST** run this command before pushing, otherwise the production build will fail (as you saw).
    ```bash
    cargo sqlx prepare --workspace
    ```
    *Tip: Make this a pre-commit hook or just remember to do it whenever you touch `sqlx::query!` macros.*
3.  **Commit the `.sqlx` folder**: These JSON files are required for the server to build.

### C. Pushing Your Changes
1.  Add and commit your files on your feature branch.
2.  **Switch to Main and Update**:
    ```bash
    git checkout main
    git pull origin main
    ```
3.  **Merge Your Feature**:
    ```bash
    git merge feature/my-new-feature
    ```
    (Resolve any merge conflicts if they happen).
4.  **Push to GitHub**:
    ```bash
    git push origin main
    ```