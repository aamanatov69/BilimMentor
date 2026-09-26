require("dotenv").config({ quiet: true });
const { Client } = require("pg");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing. Set it in api/.env.");
    process.exitCode = 1;
    return;
  }
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
    console.log("Database connection is ready. Schema and migrations were not checked.");
  } catch (error) {
    const hints = {
      "28P01": "Authentication failed. Check the username and password in api/.env.",
      "28000": "Authentication rejected. Check PostgreSQL access settings.",
      "3D000": "The configured database does not exist.",
      ECONNREFUSED: "Connection refused. Check that PostgreSQL is running and the host/port are correct.",
      ENOTFOUND: "Database hostname could not be resolved.",
      ETIMEDOUT: "Connection timed out. Check database availability.",
    };
    // Do not print the connection string, raw error, or credentials.
    console.error(hints[error?.code] ?? "Database check failed. Check the connection settings and database availability.");
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
