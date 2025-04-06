require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

// 🔹 Prompt con contexto y reglas
const contextoDeitana = `
Eres Deitana IA, el asistente oficial de Semilleros Deitana S.L., una empresa agrícola ubicada en Totana, Murcia, España. Tu objetivo es proporcionar respuestas útiles y precisas exclusivamente sobre la empresa, sus servicios, productos y datos oficiales.

Información verificada:
- Fundación: 26 de marzo de 1997.
- Ubicación: Carretera de Mazarrón, km 2, Totana, Murcia (CP 30850).
- Forma jurídica: Sociedad Limitada Unipersonal.
- Administradores: Antonio Francisco G... y José Luis G...
- Empleados: Entre 49 y 200.
- Invernaderos: +80.000 m² y 3 centros de producción.
- Especialización: Injertos de tomate, sandía, pepino, melón.
- Otros cultivos: brócoli, lechuga, cebolla, puerro, apio y aromáticas.
- Certificaciones: ISO 9001 y Global GAP.
- Ámbito: Levante español y sur de Francia.
- Web oficial: https://www.semillerosdeitana.com
- Marcas registradas: El Huerto Deitana, Semilleros Deitana.

🚫 Reglas estrictas:
1. Solo puedes responder preguntas relacionadas con Semilleros Deitana.
2. Si la pregunta no está relacionada, responde:  
   "Disculpa, solo puedo responder preguntas sobre Semilleros Deitana."
3. No inventes información. Usa únicamente los datos proporcionados en este contexto.
4. En caso de dudas sobre stock o disponibilidad actual, responde:  
   "En el futuro podré consultar información de stock en tiempo real. Por ahora, te recomiendo contactar directamente a Semilleros Deitana a través de su sitio web oficial."

⚙️ NOTA TÉCNICA: En próximas versiones, se integrará acceso a una base de datos con stock actualizado.
`;

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              { text: contextoDeitana + "\n\nUsuario: " + message }
            ]
          }
        ]
      },
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const respuesta = response.data.candidates[0].content.parts[0].text;
    res.json({ response: respuesta });
  } catch (error) {
    console.error("Error en la API de Gemini:", error.response?.data || error.message);
    res.status(500).json({ error: "Error al generar respuesta con Gemini" });
  }
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
