const { OpenAI } = require('openai');
const pool = require('./db');
require('dotenv').config();
const promptBase = require('./promptBase').promptBase;
const mapaERP = require('./mapaERP').mapaERP;

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Variable para mantener el historial de mensajes
let messageHistory = [];

// Función para obtener las relaciones de una tabla
function obtenerRelaciones(tabla) {
    const seccion = Object.entries(mapaERP).find(([_, datos]) => datos.tabla === tabla)?.[1];
    return seccion?.relaciones || {};
}

// Función para formatear resultados en Markdown (solo datos, sin frases automáticas)
function formatResultsAsMarkdown(results) {
    if (!results || results.length === 0) {
        return "No se han encontrado resultados para tu consulta.";
    }

    // Si es un conteo simple, devolver solo el número
    if (results.length === 1 && Object.keys(results[0]).length === 1) {
        const value = Object.values(results[0])[0];
        return `Total: ${value}`;
    }

    // Para otros tipos de resultados, formatear como tabla
    const columns = Object.keys(results[0]);
    let markdown = "| " + columns.join(" | ") + " |\n";
    markdown += "| " + columns.map(() => "---").join(" | ") + " |\n";
    results.forEach(row => {
        markdown += "| " + columns.map(col => (row[col] ?? "No disponible")).join(" | ") + " |\n";
    });
    return markdown;
}

// Función para ejecutar consultas SQL
async function executeQuery(sql) {
    try {
        console.log('Ejecutando consulta SQL:', sql);
        const [rows] = await pool.query(sql);
        console.log('Resultados de la consulta:', rows);
        
        // Verificar si hay resultados vacíos
        if (rows.length === 0) {
            console.log('La consulta no devolvió resultados');
            return [];
        }

        // Verificar si los campos están vacíos
        const hasEmptyFields = rows.some(row => 
            Object.values(row).every(value => value === null || value === '')
        );

        if (hasEmptyFields) {
            console.log('Advertencia: Algunos campos están vacíos en los resultados');
        }

        return rows;
    } catch (error) {
        console.error('Error al ejecutar la consulta:', error);
        throw error;
    }
}

// Función para procesar la consulta del usuario
async function processQuery(userQuery) {
    try {
        console.log('Procesando consulta:', userQuery);
        console.log('API Key configurada:', process.env.OPENAI_API_KEY ? 'Sí' : 'No');

        // Obtener el prompt base del esquema de la base de datos
        const promptBase = require('./promptBase').promptBase;

        // Agregar el mensaje del usuario al historial
        messageHistory.push({
            role: "user",
            content: userQuery
        });

        // Construir el mensaje completo para el modelo
        const messages = [
            {
                role: "system",
                content: promptBase
            },
            ...messageHistory
        ];

        // Realizar la llamada a la API de OpenAI
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000
        });

        // Extraer la respuesta
        const response = completion.choices[0].message.content;
        console.log('Respuesta generada:', response);

        // Extraer la consulta SQL de la respuesta usando las etiquetas <sql>
        const sqlMatch = response.match(/<sql>([\s\S]*?)<\/sql>/i);
        if (sqlMatch) {
            const sql = sqlMatch[1].trim();
            console.log('Ejecutando consulta SQL:', sql);
            
            // Ejecutar la consulta
            const results = await executeQuery(sql);
            console.log('Resultados de la consulta:', results);
            
            // Formatear los resultados en Markdown
            const markdownResults = formatResultsAsMarkdown(results);

            // Crear un nuevo mensaje para que la IA analice los resultados
            const analysisPrompt = `Los datos EXACTOS de la base de datos son:\n\n${markdownResults}\n\n
            INSTRUCCIONES ESTRICTAS:
            1. Usa SOLO los números y datos mostrados en la tabla arriba
            2. NO inventes números ni datos
            3. NO uses placeholders como [número] o [cantidad]
            4. NO muestres la consulta SQL
            5. Si es un conteo, muestra EXACTAMENTE el número que aparece en la tabla
            6. NO redondees ni modifiques los números
            7. Si la tabla está vacía, di que no hay datos
            8. Si hay un error en la consulta, di que no se pudieron obtener los datos
            9. NO agregues información adicional que no esté en los datos
            10. NO hagas suposiciones sobre los datos
            11. Formatea los datos en un texto legible y conversacional
            12. Mantén un tono amigable y profesional
            13. Ofrece ayuda adicional al final de tu respuesta
            14. IMPORTANTE: Si ves un número en la tabla, úsalo EXACTAMENTE como está, sin modificarlo ni usar placeholders`;

            // Obtener el análisis de la IA
            const analysisCompletion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "Eres un asistente amigable y conversacional que muestra los datos exactos de la base de datos en un formato legible. NUNCA uses placeholders o variables, muestra los números exactos como aparecen en los datos."
                    },
                    {
                        role: "user",
                        content: analysisPrompt
                    }
                ],
                temperature: 0.1, // Reducimos la temperatura para respuestas más precisas
                max_tokens: 1000
            });

            const analysis = analysisCompletion.choices[0].message.content;
            console.log('Análisis generado:', analysis);
            
            return {
                success: true,
                data: {
                    message: analysis
                }
            };
        }

        return {
            success: true,
            data: {
                message: response
            }
        };

    } catch (error) {
        console.error('Error al procesar la consulta:', error);
        return {
            success: false,
            error: 'Error al procesar la consulta: ' + error.message
        };
    }
}

// Exportar la función para su uso en otros archivos
module.exports = {
    processQuery
}; 