import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import { pool } from "./db.js";

const app = express();
const PORT = 3000;
const JWT_SECRET = "tu_clave_secreta";

app.use(cors());
app.use(bodyParser.json());

// ==============================
// 🌐 ENDPOINTS DE LA API
// ==============================

// 1️⃣ Registrar usuario (POST)
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Datos incompletos" });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO usuarios (nombreusuario, contraseña) VALUES ($1, $2) RETURNING id",
      [username, hash]
    );
    res.json({ message: "Usuario registrado", userId: result.rows[0].id });
  } catch (error) {
    console.error("Error al registrar usuario:", error);
    res.status(500).json({ error: "Error al registrar usuario" });
  }
});

// 2️⃣ Login usuario (POST)
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Datos incompletos" });

    const result = await pool.query("SELECT * FROM usuarios WHERE nombreusuario=$1", [username]);
    if (result.rows.length === 0) return res.status(400).json({ error: "Usuario no existe" });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.contraseña);
    if (!valid) return res.status(400).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token, userId: user.id });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ error: "Error en BD" });
  }
});

// 3️⃣ Guardar búsqueda de clima (POST)
app.post("/search", async (req, res) => {
  try {
    const { userId, city, lat, lon, temp, description, humidity, wind_speed } = req.body;
    await pool.query(
      `INSERT INTO busquedas 
       (usuario_id, ciudad, latitud, longitud, temperatura, descripcion, humedad, velocidad_viento)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId, city, lat, lon, temp, description, humidity, wind_speed]
    );
    res.json({ message: "Búsqueda guardada correctamente" });
  } catch (error) {
    console.error("Error al guardar búsqueda:", error);
    res.status(500).json({ error: "Error al guardar búsqueda" });
  }
});

// 4️⃣ Consultar historial de un usuario (GET)
app.get("/historial/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      "SELECT * FROM busquedas WHERE usuario_id=$1 ORDER BY id DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener historial:", error);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

// 5️⃣ Listar todos los usuarios (GET)
app.get("/usuarios", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, nombreusuario FROM usuarios");
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

// 6️⃣ Listar todas las búsquedas (GET)
app.get("/busquedas", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id, u.nombreusuario, b.ciudad, b.temperatura, b.descripcion, b.fecha 
       FROM busquedas b
       JOIN usuarios u ON b.usuario_id = u.id
       ORDER BY b.id DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener búsquedas:", error);
    res.status(500).json({ error: "Error al obtener búsquedas" });
  }
});

// ============================
//  Crear o actualizar perfil
// ============================
app.post("/perfiles", async (req, res) => {
  const { userId, fecha_nacimiento, ciudad, estado, pais, bio } = req.body;

  try {
    const existing = await pool.query(
      "SELECT * FROM perfiles WHERE user_id=$1",
      [userId]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE perfiles 
         SET fecha_nacimiento=$1, ciudad=$2, estado=$3, pais=$4, bio=$5
         WHERE user_id=$6`,
        [fecha_nacimiento, ciudad, estado, pais, bio, userId]
      );
      res.json({ message: "Perfil actualizado correctamente" });
    } else {
      await pool.query(
        `INSERT INTO perfiles (user_id, fecha_nacimiento, ciudad, estado, pais, bio)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [userId, fecha_nacimiento, ciudad, estado, pais, bio]
      );
      res.json({ message: "Perfil creado correctamente" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error guardando perfil" });
  }
});

// ============================
//  Obtener todos los perfiles
// ============================
app.get("/perfiles", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM perfiles ORDER BY user_id");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo perfiles" });
  }
});
// ============================
//  Obtener perfil de un usuario específico
// ============================
app.get("/perfiles/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      "SELECT * FROM perfiles WHERE user_id=$1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Perfil no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo perfil" });
  }
});




// ------------------ Iniciar servidor ------------------
app.listen(PORT, () => {
  console.log(`✅ Backend corriendo en http://localhost:${PORT}`);
});
