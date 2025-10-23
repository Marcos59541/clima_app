// db.js
import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "clima_app",
  password: "Marcos59541",
  port: 5432,
});

