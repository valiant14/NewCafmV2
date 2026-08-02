/*
  Use this file when running schema setup manually in SSMS/sqlcmd against a database
  that may already contain CAFM tables.

  The normal app command is still preferred:
    npm run db:schema

  This wrapper executes the schema file through the backend runner, which skips existing
  table/index/constraint batches. It is intentionally a SQLCMD-mode script.

  In SSMS:
    1. Query -> SQLCMD Mode
    2. Update the path below if your project is in a different folder
    3. Execute
*/

:setvar ProjectRoot "C:\Users\Window 10\Desktop\CafmV3\NewCafmV2\backendCafm"

!! cd "$(ProjectRoot)" && npm run db:schema
