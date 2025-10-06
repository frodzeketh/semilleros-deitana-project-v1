const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, isEmployee } = require('../middleware/authMiddleware');
const chatManager = require('../utils/chatManager');
const { adminEmails } = require('../adminEmails');
const { processQueryStream } = require('../admin/core/openAI');

// Middleware para todas las rutas
router.use(verifyToken);

// =====================================
// RUTA PARA STREAMING EN TIEMPO REAL
// =====================================
router.post('/stream', async (req, res) => {
    try {
        const { message, conversationId, image } = req.body;
        const userId = req.user.uid;
        const isAdmin = req.user.isAdmin;
        
        console.log('🚀 [STREAM-ROUTE] Iniciando streaming para usuario:', userId);
        console.log('🚀 [STREAM-ROUTE] Mensaje:', message);
        console.log('🚀 [STREAM-ROUTE] Conversación ID:', conversationId);
        console.log('🚀 [STREAM-ROUTE] Es admin:', isAdmin);
        console.log('🚀 [STREAM-ROUTE] Tiene imagen:', !!image);
        
        let currentConversationId = conversationId;

        // Si no hay conversación o es temporal, crear una nueva
        if (!currentConversationId || currentConversationId.startsWith('temp_')) {
            currentConversationId = await chatManager.createConversation(userId, message);
            console.log('🆕 [STREAM-ROUTE] Nueva conversación creada:', currentConversationId);
        }

        // Verificar que la conversación existe
        try {
            await chatManager.verifyChatOwnership(userId, currentConversationId);
        } catch (error) {
            console.error('❌ [STREAM-ROUTE] Error al verificar la conversación:', error);
            return res.status(404).json({
                success: false,
                error: 'Conversación no encontrada'
            });
        }

        // Procesar imagen si existe
        let processedMessage = message;
        if (image) {
            console.log('🖼️ [STREAM-ROUTE] Procesando imagen con OCR...');
            console.log('🖼️ [STREAM-ROUTE] Tipo de imagen:', typeof image);
            console.log('🖼️ [STREAM-ROUTE] Tamaño de imagen:', image ? image.length : 'N/A');
            console.log('🖼️ [STREAM-ROUTE] Prefijo de imagen:', image ? image.substring(0, 50) + '...' : 'N/A');
            try {
                const { processImageWithOCR } = require('../admin/core/openAI');
                const extractedText = await processImageWithOCR(image);
                console.log('📝 [STREAM-ROUTE] Texto extraído de la imagen:', extractedText);
                
                // Combinar el mensaje del usuario con el texto extraído
                if (extractedText) {
                    if (message && message.trim()) {
                        // Si el mensaje pregunta por una partida y hay imagen, extraer el número
                        if (message.toLowerCase().includes('partida') && extractedText) {
                            // Buscar diferentes formatos de números de partida
                            const partidaMatch = extractedText.match(/(?:partida|Partida)[:\s]*(\d+)|Número de partida[:\s]*(\d+)|(\d{8,})/i);
                            if (partidaMatch) {
                                const numeroPartida = partidaMatch[1] || partidaMatch[2] || partidaMatch[3];
                                processedMessage = `De quien es esta partida ${numeroPartida}`;
                            } else {
                                processedMessage = `${message}\n\n📷 Información de la imagen:\n${extractedText}`;
                            }
                        } else {
                            processedMessage = `${message}\n\n📷 Información de la imagen:\n${extractedText}`;
                        }
                    } else {
                        // Si no hay mensaje de texto, crear uno automático basado en la imagen
                        // Extraer el número de partida si existe
                        const partidaMatch = extractedText.match(/(?:partida|Partida)[:\s]*(\d+)|Número de partida[:\s]*(\d+)|(\d{8,})/i);
                        if (partidaMatch) {
                            const numeroPartida = partidaMatch[1] || partidaMatch[2] || partidaMatch[3];
                            processedMessage = `De quien es esta partida ${numeroPartida}`;
                        } else {
                            processedMessage = `📷 Información extraída de la imagen:\n${extractedText}\n\nPor favor, analiza esta información y genera la consulta SQL apropiada.`;
                        }
                    }
                    console.log('📝 [STREAM-ROUTE] Mensaje procesado final:', processedMessage);
                } else {
                    console.log('⚠️ [STREAM-ROUTE] No se pudo extraer texto de la imagen');
                    processedMessage = message || 'No se pudo procesar la imagen correctamente';
                }
            } catch (error) {
                console.error('❌ [STREAM-ROUTE] Error procesando imagen:', error);
                processedMessage = message || 'Error al procesar la imagen';
            }
        }

        // Agregar mensaje del usuario al historial
        await chatManager.addMessageToConversation(userId, currentConversationId, {
            role: 'user',
            content: processedMessage
        });
        
        // Llamar a la función de streaming que maneja la respuesta según el rol
        let streamResult;
        if (isAdmin) {
            streamResult = await processQueryStream({ 
                message: processedMessage, 
                userId, 
                conversationId: currentConversationId,
                response: res
            });
        } else {
            // Para empleados, usar función de streaming específica (si existe)
            streamResult = await processQueryStream({ 
                message: processedMessage, 
                userId, 
                conversationId: currentConversationId,
                response: res
            });
        }
        
        // Nota: La respuesta ya fue enviada por processQueryStream
        console.log('✅ [STREAM-ROUTE] Stream completado exitosamente');
        
    } catch (error) {
        console.error('❌ [STREAM-ROUTE] Error en streaming:', error);
        
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false, 
                error: 'Error interno del servidor en streaming' 
            });
        }
    }
});

// Rutas para empleados
router.post('/employee/chat', isEmployee, async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user.uid;
        
        // Crear nueva conversación o continuar existente
        const conversationId = await chatManager.createConversation(userId, message);
        
        res.json({ 
            success: true, 
            conversationId,
            message: 'Mensaje guardado correctamente'
        });
    } catch (error) {
        console.error('Error en chat de empleado:', error);
        res.status(500).json({ error: 'Error al procesar el mensaje' });
    }
});

// Rutas para administradores
router.post('/admin/chat', isAdmin, async (req, res) => {
    try {
        const { message, userId } = req.body;
        
        // Verificar si el userId existe
        const userRecord = await admin.auth().getUser(userId);
        if (!userRecord) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const conversationId = await chatManager.createConversation(userId, message);
        
        res.json({ 
            success: true, 
            conversationId,
            message: 'Mensaje guardado correctamente'
        });
    } catch (error) {
        console.error('Error en chat de administrador:', error);
        res.status(500).json({ error: 'Error al procesar el mensaje' });
    }
});

// Obtener historial de conversaciones
router.get('/conversations', async (req, res) => {
    try {
        const userId = req.user.uid;
        const conversations = await chatManager.getUserConversations(userId);
        res.json({ success: true, conversations });
    } catch (error) {
        console.error('Error al obtener conversaciones:', error);
        res.status(500).json({ error: 'Error al obtener el historial de conversaciones' });
    }
});

// Obtener mensajes de una conversación específica
router.get('/conversations/:conversationId', async (req, res) => {
    try {
        const userId = req.user.uid;
        const { conversationId } = req.params;
        
        const messages = await chatManager.getConversationHistory(userId, conversationId);
        res.json({ success: true, messages });
    } catch (error) {
        console.error('Error al obtener mensajes:', error);
        res.status(500).json({ error: 'Error al obtener los mensajes de la conversación' });
    }
});

// =====================================
// RUTA PARA OBTENER DATOS DE SEMILLAS DE LA VPS
// =====================================
router.get('/semillas/stock', async (req, res) => {
    try {
        const userId = req.user.uid;
        console.log('🌱 [SEMILLAS] Obteniendo datos de semillas para usuario:', userId);
        
        // Importar la conexión a la base de datos
        const { query } = require('../db-bridge');
        
        // Consulta completa para obtener todas las semillas en cámara
        const sqlQuery = `
            SELECT 
                ra.id AS remesa,
                a.AR_DENO AS articulo,
                c.CL_DENO AS cliente,
                ra.REA_ORI AS origen,
                ev.EV_DENO AS envase,
                SUM(rm.REM_UDS * rm.REM_UXE) AS stock
            FROM 
                remesas_art ra
                INNER JOIN remesas_mov rm ON ra.id = rm.REM_REA
                LEFT JOIN articulos a ON ra.REA_AR = a.id
                LEFT JOIN clientes c ON ra.REA_CCL = c.id
                LEFT JOIN envases_vta ev ON ra.REA_SOB = ev.id
            GROUP BY 
                ra.id, 
                a.AR_DENO, 
                c.CL_DENO, 
                ra.REA_ORI, 
                ev.EV_DENO
            HAVING 
                SUM(rm.REM_UDS * rm.REM_UXE) > 0
            ORDER BY 
                ra.id;
        `;
        
        console.log('🌱 [SEMILLAS] Ejecutando consulta SQL...');
        const results = await query(sqlQuery);
        
        console.log('🌱 [SEMILLAS] Resultados SQL raw:', results);
        
        // Aplanar el array si está anidado
        const flatResults = Array.isArray(results[0]) ? results[0] : results;
        console.log('🌱 [SEMILLAS] Resultados aplanados:', flatResults);
        
        // Datos de ejemplo con la nueva estructura
        const datosEjemplo = [
            { id: 1, articulo: "Semilla de Tomate Cherry", cliente: "Agrícola San José", origen: "Invernadero A", envase: "Bolsa 1kg", stock: 250 },
            { id: 2, articulo: "Semilla de Lechuga Romana", cliente: "Huertos del Valle", origen: "Campo B", envase: "Bolsa 500g", stock: 180 },
            { id: 3, articulo: "Semilla de Zanahoria", cliente: "Cultivos Modernos", origen: "Invernadero C", envase: "Bolsa 2kg", stock: 320 },
            { id: 4, articulo: "Semilla de Pepino", cliente: "Agrícola San José", origen: "Campo A", envase: "Bolsa 1kg", stock: 150 },
            { id: 5, articulo: "Semilla de Pimiento Rojo", cliente: "Invernaderos del Norte", origen: "Invernadero B", envase: "Bolsa 500g", stock: 200 },
            { id: 6, articulo: "Semilla de Calabacín", cliente: "Huertos del Valle", origen: "Campo C", envase: "Bolsa 1kg", stock: 175 }
        ];
        
        // Si hay datos de la VPS, usarlos; si no, usar ejemplos
        const semillasData = flatResults.length > 0 ? flatResults.map((row, index) => ({
            id: row.remesa || index + 1,
            articulo: row.articulo || 'Semilla sin nombre',
            cliente: row.cliente || 'Cliente no especificado',
            origen: row.origen || 'Origen no especificado',
            envase: row.envase || 'Envase no especificado',
            stock: Math.round(parseFloat(row.stock) || 0)
        })) : datosEjemplo;
        
        console.log('🌱 [SEMILLAS] Datos obtenidos:', semillasData.length, 'registros');
        console.log('🌱 [SEMILLAS] Datos finales:', semillasData);
        
        res.json({ 
            success: true, 
            data: semillasData,
            total: semillasData.length,
            source: flatResults.length > 0 ? 'vps' : 'ejemplo'
        });
        
    } catch (error) {
        console.error('❌ [SEMILLAS] Error al obtener datos de semillas:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al obtener los datos de semillas de la VPS',
            details: error.message
        });
    }
});

// =====================================
// RUTA PARA OBTENER DATOS DE PARTIDAS DE RIESGO DE LA VPS
// =====================================
router.get('/partidas/riesgo', async (req, res) => {
    try {
        const userId = req.user.uid;
        console.log('🚨 [PARTIDAS-RIESGO] Obteniendo datos de partidas de riesgo para usuario:', userId);
        
        // Importar la conexión a la base de datos
        const { query } = require('../db-bridge');
        
        // Consulta SQL para obtener datos de usuarios vendedores
        const sqlQuery = `
            SELECT 
                id AS Codigo,
                VD_DENO AS Nombre_Completo,
                VD_DOM AS Domicilio,
                VD_POB AS Poblacion,
                VD_PROV AS Provincia,
                VD_PDA AS Numero_Tecnico
            FROM 
                vendedores
            ORDER BY 
                VD_DENO
        `;
        
        console.log('🚨 [VENDEDORES] Ejecutando consulta SQL...');
        
        // Ejecutar consulta en la VPS
        const results = await query(sqlQuery);
        
        console.log('🚨 [VENDEDORES] Resultados obtenidos:', results.length, 'registros');
        console.log('🚨 [VENDEDORES] Tipo de results:', typeof results, Array.isArray(results));
        console.log('🚨 [VENDEDORES] Primer registro raw:', results[0]);
        
        // Los resultados vienen como array de arrays, necesitamos acceder al primer elemento
        const dataArray = Array.isArray(results[0]) ? results[0] : results;
        console.log('🚨 [VENDEDORES] Data array length:', dataArray.length);
        
        // Transformar datos al formato esperado por el frontend
        const vendedoresData = dataArray.map((row, index) => {
            console.log(`🚨 [VENDEDORES] Procesando registro ${index + 1}:`, {
                Codigo: row.Codigo,
                Nombre_Completo: row.Nombre_Completo,
                Domicilio: row.Domicilio,
                Poblacion: row.Poblacion,
                Provincia: row.Provincia,
                Numero_Tecnico: row.Numero_Tecnico
            });
            
            return {
                id: row.Codigo || `VEN-${String(index + 1).padStart(3, '0')}`,
                codigoVendedor: row.Codigo || 'SIN CÓDIGO',
                nombreCompleto: row.Nombre_Completo || 'Sin nombre',
                domicilio: row.Domicilio || 'Sin domicilio',
                poblacion: row.Poblacion || 'Sin población',
                provincia: row.Provincia || 'Sin provincia',
                numeroTecnico: row.Numero_Tecnico || 'Sin número técnico'
            };
        });
        
        console.log('🚨 [VENDEDORES] Datos transformados:', vendedoresData.length, 'registros');
        console.log('🚨 [VENDEDORES] Datos finales:', vendedoresData);
        
        res.json({ 
            success: true, 
            data: vendedoresData,
            total: vendedoresData.length,
            source: 'vps'
        });
        
    } catch (error) {
        console.error('❌ [PARTIDAS-RIESGO] Error al obtener datos de partidas de riesgo:', error);
        
        // Datos de ejemplo en caso de error
        const datosEjemplo = [
            {
                id: "VEN-001",
                codigoVendedor: "001",
                nombreCompleto: "Juan Pérez García",
                domicilio: "Calle Mayor, 123",
                poblacion: "Madrid",
                provincia: "Madrid",
                numeroTecnico: "TEC001"
            },
            {
                id: "VEN-002",
                codigoVendedor: "002",
                nombreCompleto: "María López Martínez",
                domicilio: "Avenida Diagonal, 456",
                poblacion: "Barcelona",
                provincia: "Barcelona",
                numeroTecnico: "TEC002"
            },
            {
                id: "VEN-003",
                codigoVendedor: "003",
                nombreCompleto: "Carlos Rodríguez Sánchez",
                domicilio: "Paseo de la Castellana, 789",
                poblacion: "Valencia",
                provincia: "Valencia",
                numeroTecnico: "TEC003"
            }
        ];
        
        res.json({ 
            success: true, 
            data: datosEjemplo,
            total: datosEjemplo.length,
            source: 'ejemplo',
            error: 'Error al conectar con la VPS, mostrando datos de ejemplo'
        });
    }
});


module.exports = router; 