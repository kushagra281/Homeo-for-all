1. IN-MEMORY MODE (current default - no setup needed):
   - App loads data automatically from JSON files in attached_assets/
   - Ensure the JSON files exist in the attached_assets/ folder
   - The app seeds itself on startup

2. POSTGRESQL MODE (for production):
   a. Provision a PostgreSQL database
   b. Set the DATABASE_URL environment variable
   c. Push schema using Drizzle ORM migration (see package.json scripts)
   d. Run the SQL seed inserts from the SQL SCHEMA section above
   e. Update server/storage.ts to use a DrizzleStorage class

3. FILE ROLES:
   shared/schema.ts            - Table definitions, types, constants
   drizzle.config.ts           - Drizzle ORM config (reads DATABASE_URL)
   server/storage.ts           - Data access layer (CRUD + AI scoring)
   attached_assets/*.json      - Seed data loaded into memory at startup
   SQL SCHEMA (in this file)   - Raw SQL for PostgreSQL table creation