require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
const db = require("./db"); // Conexión a la base de datos

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// 🔹 Importar rutas de stock (si se usan)
const stockRoutes = require('./routes/stock');
app.use('/stock', stockRoutes);

// 🔹 Contexto/PROMPT actualizado para Gemini
const contextoDeitana = `
Eres Deitana IA, el asistente oficial de Semilleros Deitana S.L., una empresa agrícola ubicada en Totana, Murcia, España.

Tienes acceso directo a una base de datos MySQL con las siguientes tablas importantes: abonos, articulos, clientes, especies, inventario y p-inj-sandia.

Tu tarea es interpretar preguntas del usuario relacionadas con Semilleros Deitana y responder generando directamente consultas SQL SEGURAS (únicamente de lectura) que puedas ejecutar en la base de datos. Luego, debes devolver los resultados de esas consultas como respuesta.

🔒 REGLAS:
1. SOLO usa consultas SQL de tipo SELECT.
2. NO generes INSERT, UPDATE, DELETE, DROP ni ninguna otra operación destructiva.
3. Si la pregunta no está relacionada con Semilleros Deitana, responde:
   "Disculpa, solo puedo responder preguntas sobre Semilleros Deitana."
4. Usa nombres reales de las tablas: abonos, articulos, clientes, especies, inventario, p-inj-sandia.
5. No expliques cómo ejecutar una consulta: ejecútala y da el resultado.
6. Responde en un lenguaje claro, basado en el resultado de la base de datos.

Ejemplos válidos:
✅ Usuario: ¿Cuántos artículos hay registrados?
✅ Respuesta: Hay 342 artículos registrados en la base de datos.

✅ Usuario: ¿Qué especies hay?
✅ Respuesta: Estas son las especies registradas: Tomate, Sandía, Melón...

Si no tienes datos, di claramente que no hay resultados.

Fin del contexto.
`;

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: contextoDeitana + "\n\nUsuario: " + message }]
          }
        ]
      },
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const geminiResponse = response.data.candidates[0].content.parts[0].text.trim();

    // Si Gemini generó una consulta SQL segura (SELECT), la ejecutamos
    if (/^SELECT/i.test(geminiResponse)) {
      const [rows] = await db.query(geminiResponse);
      return res.json({ response: rows });
    }

    // Si NO es una consulta SQL, simplemente devolvemos el texto generado
    res.json({ response: geminiResponse });

  } catch (error) {
    console.error("Error en la API de Gemini o la base de datos:", error.response?.data || error.message);
    res.status(500).json({ error: "Error al generar respuesta con Gemini o al ejecutar la consulta SQL" });
  }
});

app.get("/", (req, res) => {
  res.send("Servidor de Semilleros Deitana funcionando correctamente ✅");
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
