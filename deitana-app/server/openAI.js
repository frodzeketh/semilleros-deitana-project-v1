const { OpenAI } = require('openai');
const pool = require('./db');
require('dotenv').config();
const promptBase = require('./promptBase').promptBase;

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Variable para mantener el historial de mensajes
let messageHistory = [];

// Función para formatear resultados en Markdown
function formatResultsAsMarkdown(results) {
    if (!results || results.length === 0) {
        return "No se encontraron resultados.";
    }

    // Determinar el tipo de datos basado en las columnas presentes
    const columns = Object.keys(results[0]);
    let markdown = "";
    
    if (columns.includes('CL_DENO')) {
        // Formato para clientes
        markdown = "Información de Clientes\nSemilleros Deitana S.L.\n\n";
        results.forEach((row, index) => {
            markdown += `Cliente ${index + 1}\n`;
            markdown += `Nombre: ${row.CL_DENO || 'No disponible'}\n`;
            markdown += `Dirección: ${row.CL_DOM || 'No disponible'}\n`;
            markdown += `Población: ${row.CL_POB || 'No disponible'}\n`;
            markdown += `Provincia: ${row.CL_PROV || 'No disponible'}\n`;
            markdown += `Código Postal: ${row.CL_CDP || 'No disponible'}\n`;
            markdown += `Teléfono: ${row.CL_TEL || 'No disponible'}\n`;
            markdown += `CIF: ${row.CL_CIF || 'No disponible'}\n`;
            if (row.CL_PAIS) {
                markdown += `País: ${row.CL_PAIS}\n`;
            }
            markdown += "\n";
        });
    } else if (columns.includes('AR_DENO')) {
        // Formato para artículos
        markdown = "Información de Artículos\nSemilleros Deitana S.L.\n\n";
        results.forEach((row, index) => {
            markdown += `Artículo ${index + 1}\n`;
            markdown += `Código: ${row.id || 'No disponible'}\n`;
            markdown += `Descripción: ${row.AR_DENO || 'No disponible'}\n`;
            markdown += `Referencia: ${row.AR_REF || 'No disponible'}\n`;
            markdown += `Código de Barras: ${row.AR_BAR || 'No disponible'}\n`;
            markdown += `Grupo: ${row.AR_GRP || 'No disponible'}\n`;
            markdown += `Familia: ${row.AR_FAM || 'No disponible'}\n\n`;
            
        });
    } else if (columns.includes('ACCO_DENO')) {
        // Formato para acciones comerciales
        markdown = "Información de Acciones Comerciales\nSemilleros Deitana S.L.\n\n";
        results.forEach((row, index) => {
            markdown += `Acción ${index + 1}\n`;
            markdown += `Tipo: ${row.ACCO_DENO || 'No disponible'}\n`;
            markdown += `Cliente: ${row.CL_DENO || 'No disponible'}\n`;
            markdown += `Vendedor: ${row.VD_DENO || 'No disponible'}\n`;
            markdown += `Fecha: ${row.ACCO_FEC || 'No disponible'}\n`;
            markdown += `Hora: ${row.ACCO_HOR || 'No disponible'}\n\n`;
        });
    } else if (columns.includes('FP_DENO')) {
        // Formato para formas de pago
        markdown = "Información de Formas de Pago\nSemilleros Deitana S.L.\n\n";
        results.forEach((row, index) => {
            markdown += `Forma de Pago ${index + 1}\n`;
            markdown += `Denominación: ${row.FP_DENO || 'No disponible'}\n`;
            if (row.FP_NVT) {
                markdown += `Número de Vencimientos: ${row.FP_NVT}\n`;
            }
            markdown += "\n";
        });
    } else {
        // Formato genérico para otros tipos de datos
        markdown = "Resultados de la Consulta\n\n";
        results.forEach((row, index) => {
            markdown += `Registro ${index + 1}\n`;
            Object.entries(row).forEach(([key, value]) => {
                markdown += `${key}: ${value || 'No disponible'}\n`;
            });
            markdown += "\n";
        });
    }

    // Agregar recomendaciones técnicas cuando sea apropiado
    if (columns.includes('CL_DENO') || columns.includes('AR_DENO')) {
        markdown += "Recomendaciones Técnicas\n";
        markdown += "Para estos registros, recomendamos:\n\n";
        markdown += "• Asesoramiento personalizado sobre variedades de semillas adaptadas a sus zonas\n";
        markdown += "• Información sobre prácticas agrícolas sostenibles\n";
        markdown += "• Recomendaciones específicas según el clima y tipo de suelo\n";
        markdown += "• Estrategias para optimizar la productividad y calidad de cultivos\n";
    }
    
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
            ...messageHistory // Incluir todo el historial de mensajes
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

        // Agregar la respuesta al historial
        messageHistory.push({
            role: "assistant",
            content: response
        });

        // Mantener solo los últimos 10 mensajes para no exceder el límite de tokens
        if (messageHistory.length > 10) {
            messageHistory = messageHistory.slice(-10);
        }

        // Extraer la consulta SQL de la respuesta usando las etiquetas <sql>
        const sqlMatch = response.match(/<sql>([\s\S]*?)<\/sql>/i);
        if (sqlMatch) {
            const sql = sqlMatch[1].trim();
            console.log('Ejecutando consulta SQL:', sql);
            
            // Ejecutar la consulta
            const results = await executeQuery(sql);
            
            // Formatear la respuesta con los resultados en Markdown
            const markdownResults = formatResultsAsMarkdown(results);
            
            return {
                success: true,
                data: {
                    message: markdownResults
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