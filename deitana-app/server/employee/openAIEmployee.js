// =====================================
// IMPORTACIONES Y CONFIGURACIÓN INICIAL
// =====================================

const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const pool = require('../db');
const chatManager = require('../utils/chatManager');
const admin = require('../firebase-admin');
require('dotenv').config();
const { promptBase } = require('./promptBaseEmployee');
const { promptComportamiento } = require('./promptComportamientoEmployee');
const mapaERP = require('./mapaERPEmployee');

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// =====================================
// SISTEMA RAG (RETRIEVAL-AUGMENTED GENERATION)
// =====================================

/**
 * Función RAG que lee la base de conocimiento y extrae información relevante
 * basada en la consulta del usuario
 */
function obtenerConocimientoRelevante(consulta) {
    try {
        console.log('📚 [RAG] Iniciando búsqueda en base de conocimiento...');
        
        // Leer el archivo de base de conocimiento
        const rutaBaseConocimiento = path.join(__dirname, 'baseConocimiento.txt');
        const contenidoCompleto = fs.readFileSync(rutaBaseConocimiento, 'utf8');
        
        // Extraer palabras clave de la consulta del usuario
        const palabrasClave = consulta.toLowerCase()
            .replace(/[¿?¡!.,;:()\[\]]/g, ' ')
            .split(/\s+/)
            .filter(palabra => palabra.length > 2)
            .filter(palabra => !['que', 'cual', 'como', 'donde', 'cuando', 'quien', 'cuantos', 'cuantas'].includes(palabra));
        
        console.log('🔍 [RAG] Palabras clave extraídas:', palabrasClave);
        
        // Dividir el contenido en secciones
        const secciones = contenidoCompleto.split(/SECCIÓN:/);
        const informacionEmpresa = secciones[0]; // La parte inicial antes de las secciones
        
        let conocimientoRelevante = '';
        let seccionesEncontradas = [];
        
        // Siempre incluir información básica de la empresa
        if (palabrasClave.some(palabra => ['empresa', 'deitana', 'semilleros', 'historia', 'fundada'].includes(palabra))) {
            conocimientoRelevante += '\n=== INFORMACIÓN DE LA EMPRESA ===\n';
            conocimientoRelevante += informacionEmpresa.substring(0, 1000) + '...\n';
        }
        
        // Buscar secciones relevantes
        secciones.slice(1).forEach((seccion, index) => {
            const tituloSeccion = seccion.split('\n')[0].trim();
            const contenidoSeccion = seccion.substring(0, 1500); // Limitar tamaño por sección
            
            // Verificar si alguna palabra clave coincide con el contenido de la sección
            const coincide = palabrasClave.some(palabra => {
                const seccionLower = contenidoSeccion.toLowerCase();
                return seccionLower.includes(palabra) || 
                       tituloSeccion.toLowerCase().includes(palabra);
            });
            
            if (coincide) {
                console.log(`✅ [RAG] Sección relevante encontrada: ${tituloSeccion}`);
                conocimientoRelevante += `\n=== SECCIÓN: ${tituloSeccion} ===\n`;
                conocimientoRelevante += contenidoSeccion + '\n';
                seccionesEncontradas.push(tituloSeccion);
            }
        });
        
        // Si no se encontraron secciones específicas, proporcionar contexto general
        if (seccionesEncontradas.length === 0) {
            console.log('⚠️ [RAG] No se encontraron secciones específicas, proporcionando contexto general');
            conocimientoRelevante += '\n=== CONTEXTO GENERAL DISPONIBLE ===\n';
            conocimientoRelevante += 'Tengo información sobre: clientes, artículos, proveedores, partidas, almacenes, sustratos, invernaderos, productos fitosanitarios, y más secciones del sistema ERP.\n';
        }
        
        console.log(`📚 [RAG] Conocimiento extraído: ${conocimientoRelevante.length} caracteres`);
        console.log(`📚 [RAG] Secciones incluidas: ${seccionesEncontradas.join(', ')}`);
        
        return conocimientoRelevante;
        
    } catch (error) {
        console.error('❌ [RAG] Error al procesar base de conocimiento:', error);
        return ''; // Retornar vacío en caso de error, el sistema continuará sin RAG
    }
}

/**
 * Función para combinar RAG con el mapaERP existente
 */
function obtenerContextoCompleto(consulta, historialConversacion = []) {
    console.log('🧠 [CONTEXTO] Combinando RAG + mapaERP para contexto completo...');
    
    // Obtener conocimiento de RAG
    const conocimientoRAG = obtenerConocimientoRelevante(consulta);
    
    // Obtener contexto del mapaERP (función existente)
    const contextoERP = obtenerContenidoMapaERP(consulta, historialConversacion);
    
    // Combinar ambos contextos
    let contextoCompleto = '';
    
    if (conocimientoRAG) {
        contextoCompleto += '=== BASE DE CONOCIMIENTO SEMILLEROS DEITANA ===\n';
        contextoCompleto += conocimientoRAG;
        contextoCompleto += '\n';
    }
    
    if (contextoERP) {
        contextoCompleto += '=== ESTRUCTURA TÉCNICA DE TABLAS ERP ===\n';
        contextoCompleto += contextoERP;
    }
    
    console.log(`🧠 [CONTEXTO] Contexto total generado: ${contextoCompleto.length} caracteres`);
    return contextoCompleto;
}

// =====================================
// CONFIGURACIÓN DE VARIABLES GLOBALES
// =====================================

// Historial global de conversación (en memoria, para demo)
const conversationHistory = [];
// Contexto de datos reales de la última consulta relevante
let lastRealData = null;

// =====================================
// FUNCIÓN PRINCIPAL - MODELO GPT Y PROCESAMIENTO
// Se encarga de coordinar todo el proceso de la consulta
// =====================================

async function processQuery({ message, userId, conversationId }) {
    try {
        console.log('🚀 [SISTEMA] ===== INICIANDO PROCESO DE CONSULTA =====');
        console.log('🚀 [SISTEMA] Procesando consulta de empleado:', message);
        
        // =====================================
        // PREPARACIÓN DEL CONTEXTO Y HISTORIAL
        // =====================================
        
        // Obtener el historial de la conversación
        const conversationHistory = await getConversationHistory(userId, conversationId);
        
        // Construir el contexto con el historial completo (limitado para evitar sobrecarga)
        const contextMessages = conversationHistory
            .slice(-4)  // Solo los últimos 4 mensajes para contexto
            .map(msg => ({
                role: msg.role,
                content: msg.content
            }));
        
        // Obtener contexto completo: RAG + mapaERP para la consulta
        const contextoCompleto = obtenerContextoCompleto(message, conversationHistory);
        
        // DEBUG: Log para ver exactamente qué información recibe GPT
        console.log('📚 [DEBUG-RAG+ERP] Contexto completo enviado a GPT:');
        console.log('📚 [DEBUG-RAG+ERP]', contextoCompleto.substring(0, 500) + '...');
        console.log('📚 [DEBUG-RAG+ERP] Longitud total:', contextoCompleto.length, 'caracteres');
        
        // DEBUG GENÉRICO: Mostrar columnas de todas las tablas incluidas en contexto
        const tablasEnContexto = Object.keys(mapaERP).filter(tabla => 
            contextoCompleto.toLowerCase().includes(tabla.toLowerCase())
        );
        
        if (tablasEnContexto.length > 0) {
            console.log('🔍 [DEBUG-TABLAS] Tablas incluidas en contexto:', tablasEnContexto.join(', '));
            
            tablasEnContexto.forEach(tabla => {
                if (mapaERP[tabla]?.columnas) {
                    const columnas = Object.keys(mapaERP[tabla].columnas);
                    console.log(`🔍 [DEBUG-COLUMNAS] ${tabla}:`, columnas.join(', '));
                    
                    // Buscar columnas de relación (genérico)
                    const columnasRelacion = columnas.filter(col => 
                        col.includes('_PRV') || col.includes('_CLI') || col.includes('_ID') || col === 'id'
                    );
                    if (columnasRelacion.length > 0) {
                        console.log(`🔗 [DEBUG-RELACION] ${tabla} - Columnas de relación:`, columnasRelacion.join(', '));
                    }
                }
            });
        }
        
        // DEBUG: Log para confirmar arquitectura modular
        console.log('🏗️ [ARQUITECTURA] Módulos del prompt cargados:');
        console.log('🏗️ [ARQUITECTURA] Base:', promptBase.length, 'chars');
        console.log('🏗️ [ARQUITECTURA] Comportamiento:', promptComportamiento.length, 'chars');
        console.log('🏗️ [ARQUITECTURA] Total prompts reducidos para optimización de costos');
        
        // =====================================
        // CONSTRUCCIÓN DE MENSAJES PARA GPT
        // =====================================
        
        const messages = [
            {
                role: "system",
                content: `${promptBase}
                
${contextoCompleto}

${promptComportamiento}`
            },
            ...contextMessages,
            {
                role: "user",
                content: message
            }
        ];

        // ETAPA 1: GPT RECIBE LA CONSULTA
        console.log('🧠 [ETAPA-1] ===== GPT RECIBE LA CONSULTA =====');
        console.log('🧠 [ETAPA-1] Usuario:', userId);
        console.log('🧠 [ETAPA-1] Consulta:', message);
        console.log('🧠 [ETAPA-1] Contexto disponible:', contextMessages.length, 'mensajes previos');
        
        // DEBUG: Mostrar contexto conversacional que recibe GPT
        if (contextMessages.length > 0) {
            console.log('💬 [CONTEXTO] ===== HISTORIAL ENVIADO A GPT =====');
            contextMessages.forEach((msg, index) => {
                console.log(`💬 [CONTEXTO] ${index + 1}. ${msg.role}: "${msg.content}"`);
            });
            console.log('💬 [CONTEXTO] ===============================');
        }
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview", // ← Cambiado a modelo más económico
            messages: messages,
            temperature: 0.7,
            max_tokens: 400 // ← Reducido para ahorrar costos
        });

        const response = completion.choices[0].message.content;
        
        // =====================================
        // ANÁLISIS DE COSTOS Y TOKENS
        // =====================================
        const tokensUsados = completion.usage;
        const promptTokens = tokensUsados.prompt_tokens;
        const completionTokens = tokensUsados.completion_tokens;
        const totalTokens = tokensUsados.total_tokens;
        
        // Costos aproximados para gpt-3.5-turbo (precios actualizados)
        const costoPorPromptToken = 0.01 / 1000; // $0.01 por 1K tokens de entrada
        const costoPorCompletionToken = 0.03 / 1000; // $0.03 por 1K tokens de salida
        
        const costoPrompt = promptTokens * costoPorPromptToken;
        const costoCompletion = completionTokens * costoPorCompletionToken;
        const costoTotal = costoPrompt + costoCompletion;
        
        console.log('💰 [ANÁLISIS-COSTOS] ===== TOKENS Y COSTOS =====');
        console.log('💰 [TOKENS-ENTRADA] Prompt tokens:', promptTokens);
        console.log('💰 [TOKENS-SALIDA] Completion tokens:', completionTokens);
        console.log('💰 [TOKENS-TOTAL] Total tokens:', totalTokens);
        console.log('💰 [COSTO-ENTRADA] Costo prompt: $' + costoPrompt.toFixed(6));
        console.log('💰 [COSTO-SALIDA] Costo completion: $' + costoCompletion.toFixed(6));
        console.log('💰 [COSTO-TOTAL] Costo total consulta: $' + costoTotal.toFixed(6));
        console.log('💰 [COSTO-ESTIMADO] Costo por 100 consultas: $' + (costoTotal * 100).toFixed(4));
        console.log('💰 [COSTO-ESTIMADO] Costo por 1000 consultas: $' + (costoTotal * 1000).toFixed(2));
        console.log('💰 [ANÁLISIS-COSTOS] =====================================');
        
        console.log('🧠 [ETAPA-1] GPT procesó la consulta exitosamente');
        console.log('📋 [RESPUESTA-GPT] Respuesta generada:', response);
        console.log('📋 [RESPUESTA-GPT] Longitud:', response.length, 'caracteres');

        // =====================================
        // DETECCIÓN Y EXTRACCIÓN DE CONSULTAS SQL
        // =====================================
        
        // Detectar TODAS las consultas SQL (tanto en formato <sql> como ```sql)
        let queries = [];
        
        // Buscar consultas en formato <sql></sql> (formato preferido)
        const sqlTagMatches = [...response.matchAll(/<sql>([\s\S]*?)<\/sql>/gim)];
        if (sqlTagMatches.length > 0) {
            queries = sqlTagMatches.map(match => {
                let sql = match[1].trim();
                // Aplicar las mismas validaciones que validarRespuestaSQL
                if (!sql.toLowerCase().startsWith('select')) {
        return null;
    }
                // Agregar LIMIT si no es consulta de conteo/agrupación
    const esConsultaConteo = sql.toLowerCase().includes('count(*)');
    const tieneDistinct = /select\s+distinct/i.test(sql);
    const tieneGroupBy = /group by/i.test(sql);
    const tieneJoin = /join/i.test(sql);
                if (!esConsultaConteo && !tieneDistinct && !tieneGroupBy && !sql.toLowerCase().includes('limit') && !tieneJoin) {
        sql = sql.replace(/;*\s*$/, '');
        sql += ' LIMIT 50';
    }
    return sql;
            }).filter(sql => sql !== null);
        }
        
        // Si no encontró consultas <sql>, buscar en formato ```sql (fallback)
        if (queries.length === 0) {
        const sqlBlocks = [...response.matchAll(/```sql[\s\S]*?(SELECT[\s\S]*?;)[\s\S]*?```/gim)].map(m => m[1]);
            queries = sqlBlocks;
        }
        
        // Si aún no hay consultas, usar el método original
        if (queries.length === 0) {
            const singleSql = validarRespuestaSQL(response);
            if (singleSql) queries.push(singleSql);
        }

        // ETAPA 2: GPT DECIDE TIPO DE RESPUESTA
        console.log('🧠 [ETAPA-2] ===== GPT DECIDE TIPO DE RESPUESTA =====');
        if (queries.length > 0) {
            console.log('🧠 [ETAPA-2] Decisión: CONSULTA SQL + INFORMACIÓN');
            console.log('🧠 [ETAPA-2] Consultas SQL generadas:', queries.length);
            console.log('🧠 [ETAPA-2] Tipo: Necesita datos de base de datos para responder');
            
            // DEBUG: Mostrar las consultas SQL que se van a ejecutar
            queries.forEach((sql, index) => {
                console.log(`🔍 [SQL-DEBUG] Consulta ${index + 1}: ${sql}`);
            });
        } else {
            console.log('🧠 [ETAPA-2] Decisión: INFORMACIÓN EXTERNA/GENERAL');
            console.log('🧠 [ETAPA-2] Tipo: Saludo, información general, o conocimiento interno');
            console.log('🧠 [ETAPA-2] No requiere acceso a base de datos');
        }
        
        if (queries.length > 0) {
            console.log('⚙️ [JAVASCRIPT] ===== EJECUTANDO TRABAJO MECÁNICO =====');
            console.log('⚙️ [JAVASCRIPT] Ejecutando consultas que GPT generó...');
            let allResults = [];
            
            // JavaScript ejecuta silenciosamente las consultas que GPT le dijo
            for (let i = 0; i < queries.length; i++) {
                const sql = queries[i];
                try {
                    console.log(`⚙️ [JAVASCRIPT] Ejecutando consulta ${i + 1}/${queries.length}: ${sql}`);
                    const results = await executeQueryWithFuzzySearch(sql, message);
                    console.log(`⚙️ [JAVASCRIPT] Resultados consulta ${i + 1}:`, results);
                    if (results && results.length > 0) {
                        allResults = allResults.concat(results);
                        console.log(`⚙️ [JAVASCRIPT] Total acumulado: ${allResults.length} registros`);
                    } else {
                        console.log(`⚠️ [JAVASCRIPT] Consulta ${i + 1} no devolvió resultados`);
                    }
                } catch (err) {
                    console.error(`❌ [JAVASCRIPT] Error ejecutando consulta ${i + 1}:`, err.message);
                    console.error(`❌ [JAVASCRIPT] SQL que falló: ${sql}`);
                }
            }
            
            console.log(`⚙️ [JAVASCRIPT] RESUMEN: ${allResults.length} registros obtenidos en total`);
            console.log('⚙️ [JAVASCRIPT] Reemplazando marcadores con datos reales...');
            
            let finalResponse = response;
            
            // Limpiar etiquetas SQL (GPT no debe mostrarlas al usuario)
            finalResponse = finalResponse.replace(/<sql>[\s\S]*?<\/sql>/g, '').trim();
            
            // DEBUG: Mostrar respuesta antes del reemplazo
            console.log(`🔄 [DEBUG-ANTES] Respuesta antes de reemplazo: "${finalResponse}"`);
            
            // SISTEMA INTELIGENTE: Buscar CUALQUIER marcador entre corchetes
            const todosLosMarcadores = finalResponse.match(/\[[^\]]+\]/g) || [];
            console.log(`🔄 [REEMPLAZO-INTELIGENTE] Marcadores encontrados: ${todosLosMarcadores.length}`);
            console.log(`🔄 [REEMPLAZO-INTELIGENTE] Marcadores: ${todosLosMarcadores.join(', ')}`);
            console.log(`🔄 [REEMPLAZO-INTELIGENTE] Resultados disponibles: ${allResults.length}`);
            
            if (todosLosMarcadores.length === 0) {
                console.log(`⚠️ [REEMPLAZO-INTELIGENTE] No se encontraron marcadores para reemplazar`);
                

            }
            
            if (allResults.length === 0) {
                console.log(`⚠️ [REEMPLAZO-INTELIGENTE] ¡NO HAY DATOS PARA REEMPLAZAR!`);
                console.log(`⚠️ [REEMPLAZO-INTELIGENTE] Todas las consultas SQL fallaron o no devolvieron datos`);
                
                // SOLUCIÓN: Si hay marcadores pero no datos, informar al usuario del problema
                if (todosLosMarcadores.length > 0) {
                    console.log(`🚨 [ERROR-CRÍTICO] GPT generó marcadores pero no hay datos para reemplazar`);
                    console.log(`🚨 [ERROR-CRÍTICO] Esto indica que GPT usó nombres incorrectos de tablas/columnas`);
                    
                    finalResponse = `❌ **Error en la consulta:** La consulta generada usó nombres de tablas o columnas que no existen en el sistema.

**Problema detectado:**
- Se intentó buscar información pero la consulta falló
- Es posible que se hayan usado nombres incorrectos de tablas o columnas

**Solución:**
Por favor, reformula tu pregunta o especifica mejor qué información necesitas. El sistema utilizará solo las tablas y columnas que están definidas correctamente.

¿Puedes intentar hacer la consulta de otra manera?`;
                }
            }
            
            if (todosLosMarcadores.length > 0 && allResults.length > 0) {
                console.log(`🔄 [REEMPLAZO-INTELIGENTE] Iniciando reemplazo inteligente...`);
                
                // SISTEMA SIMPLE Y ROBUSTO: Trabajar con TODOS los registros
                console.log(`🔄 [REEMPLAZO-INTELIGENTE] Registros disponibles: ${allResults.length}`);
                
                // MAPEO DIRECTO: 1 marcador = 1 registro
                let contadorMarcadores = 0;
                
                finalResponse = finalResponse.replace(/\[([^\]]+)\]/g, (marcadorCompleto, nombreCampo) => {
                    // SIMPLE: Cada marcador usa el registro correspondiente por orden
                    const indiceRegistro = contadorMarcadores < allResults.length ? contadorMarcadores : 0;
                    const registroActual = allResults[indiceRegistro];
                    
                    console.log(`🔄 [REEMPLAZO-INTELIGENTE] Marcador ${contadorMarcadores + 1}: ${marcadorCompleto} → Registro ${indiceRegistro + 1}/${allResults.length}`);
                    contadorMarcadores++;
                    
                    // CASO 1: Marcador específico (ej: [id], [BN_DENO], [BN_ALV])
                    if (nombreCampo !== 'DATO_BD' && registroActual.hasOwnProperty(nombreCampo)) {
                        let valor = registroActual[nombreCampo];
                        
                        // Formatear fechas
                        if (valor && (typeof valor === 'string' || valor instanceof Date)) {
                            try {
                                const fecha = new Date(valor);
                                if (!isNaN(fecha.getTime()) && valor.toString().includes('T')) {
                                    valor = fecha.toLocaleDateString('es-ES', {
                                        year: 'numeric',
                                        month: 'long', 
                                        day: 'numeric'
                                    });
                                }
                            } catch (error) {
                                // Mantener valor original
                            }
                        }
                        
                        console.log(`🔄 [REEMPLAZO-INTELIGENTE] ${marcadorCompleto} → "${valor}" (del registro ${indiceRegistro + 1})`);
                        return valor;
                    }
                    
                    // CASO 2: Marcador genérico [DATO_BD] - primer valor del registro actual
                    if (nombreCampo === 'DATO_BD') {
                        const valoresDisponibles = Object.entries(registroActual).filter(([key, value]) => 
                            value !== null && value !== undefined && value !== ''
                        );
                        
                        if (valoresDisponibles.length > 0) {
                            const [clave, valor] = valoresDisponibles[0];
                            console.log(`🔄 [REEMPLAZO-INTELIGENTE] ${marcadorCompleto} → "${valor}" (DATO_BD del registro ${indiceRegistro + 1}: ${clave})`);
                            return valor;
                        }
                    }
                    
                    console.log(`⚠️ [REEMPLAZO-INTELIGENTE] Sin datos para ${marcadorCompleto} en registro ${indiceRegistro + 1}`);
                    return marcadorCompleto; // Mantener marcador si no hay datos
                });
            }
            
            // DEBUG: Mostrar respuesta después del reemplazo
            console.log(`🔄 [DEBUG-DESPUÉS] Respuesta después de reemplazo: "${finalResponse}"`);
            
            // Verificar si aún quedan marcadores sin reemplazar
            const marcadoresRestantes = (finalResponse.match(/\[DATO_BD\]/g) || []).length;
            if (marcadoresRestantes > 0) {
                console.log(`⚠️ [ERROR-REEMPLAZO] ¡QUEDAN ${marcadoresRestantes} MARCADORES SIN REEMPLAZAR!`);
                console.log(`⚠️ [ERROR-REEMPLAZO] Esto causará que se muestre [DATO_BD] al usuario`);
            }
            
            console.log(`🔄 [REEMPLAZO] Respuesta final: "${finalResponse.substring(0, 200)}${finalResponse.length > 200 ? '...' : ''}"`);
            
            // ETAPA 3: GPT FORMATEA COMO CHATGPT NATURAL
            console.log('🧠 [ETAPA-3] ===== GPT FORMATEA RESPUESTA NATURAL =====');
            console.log('🧠 [ETAPA-3] Datos integrados con comportamientos de promptBaseEmployee');
            console.log('🧠 [ETAPA-3] Estilo: Conversacional, amigable y contextual tipo ChatGPT');
            console.log('🧠 [ETAPA-3] Resultado: Respuesta completa lista para usuario');
            
            // VERIFICACIÓN ANTI-ROBÓTICA
            if (finalResponse.toLowerCase().includes('actualmente, contamos con')) {
                console.log('⚠️ [ANTI-ROBÓTICO] ¡DETECTADO PATRÓN REPETITIVO!');
                console.log('⚠️ [ANTI-ROBÓTICO] El modelo está ignorando instrucciones de variedad');
                console.log('⚠️ [ANTI-ROBÓTICO] promptComportamiento no se está aplicando correctamente');
            }
            
            console.log('🎉 [RESUMEN] ===== PROCESO COMPLETADO EXITOSAMENTE =====');
            console.log('🎉 [RESUMEN] UN SOLO MODELO GPT manejó toda la inteligencia');
            console.log('🎉 [RESUMEN] JavaScript solo hizo trabajo mecánico (SQL + reemplazo)');
            
            return {
                success: true,
                data: {
                    message: finalResponse
                }
            };
        }

        // ETAPA 3: GPT FORMATEA COMO CHATGPT NATURAL
        console.log('🧠 [ETAPA-3] ===== GPT FORMATEA RESPUESTA NATURAL =====');
        console.log('🧠 [ETAPA-3] Respuesta directa con comportamientos de promptBaseEmployee');
        console.log('🧠 [ETAPA-3] Estilo: Conversacional, amigable y contextual tipo ChatGPT');
        console.log('🧠 [ETAPA-3] Resultado: Respuesta completa lista para usuario');
        
        console.log('🎉 [RESUMEN] ===== PROCESO COMPLETADO EXITOSAMENTE =====');
        console.log('🎉 [RESUMEN] UN SOLO MODELO GPT manejó toda la inteligencia');
        console.log('🎉 [RESUMEN] No se requirió acceso a base de datos');
        
        return {
            success: true,
            data: {
                message: response
            }
        };
    } catch (error) {
        console.error('❌ [ERROR] Error en processQuery:', error);
        
        return {
            success: false,
            error: 'Error procesando consulta'
        };
    }
}

// =====================================
// FUNCIONES DE GESTIÓN DE FIRESTORE Y CONVERSACIONES
// =====================================

// Función para obtener el historial de mensajes de una conversación
async function getConversationHistory(userId, conversationId) {
    try {
        const userChatRef = chatManager.chatsCollection.doc(userId);
        const conversationRef = userChatRef.collection('conversations').doc(conversationId);
        const conversationDoc = await conversationRef.get();
        
        if (!conversationDoc.exists) {
            return [];
        }
        
        return conversationDoc.data().messages || [];
    } catch (error) {
        console.error('Error al obtener historial de conversación:', error);
        throw error;
    }
}

// Función para guardar mensaje en Firestore
async function saveMessageToFirestore(userId, message, conversationId) {
    try {
        console.log('Iniciando saveMessageToFirestore...');
        const now = new Date();
        const messageData = {
            content: message,
            role: 'user',
            timestamp: now
        };

        const userChatRef = chatManager.chatsCollection.doc(userId);
        const conversationRef = userChatRef.collection('conversations').doc(conversationId);
        
        console.log('Obteniendo documento actual...');
        const conversationDoc = await conversationRef.get();
        let messages = [];
        
        if (conversationDoc.exists) {
            console.log('Documento existente encontrado');
            messages = conversationDoc.data().messages || [];
        } else {
            console.log('Creando nuevo documento de conversación');
            // Si es una nueva conversación, crear el documento con título inicial
            await conversationRef.set({
                title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
                createdAt: now,
                lastUpdated: now,
                messages: []
            });
        }
        
        console.log('Agregando nuevo mensaje...');
        messages.push(messageData);
        
        console.log('Actualizando documento...');
        await conversationRef.set({
            lastUpdated: now,
            messages: messages
        }, { merge: true });

        console.log('Mensaje guardado exitosamente');
        return true;
    } catch (error) {
        console.error('Error al guardar mensaje en Firestore:', error);
        throw error;
    }
}

async function saveAssistantMessageToFirestore(userId, message, conversationId) {
    try {
        console.log('Iniciando saveAssistantMessageToFirestore...');
        const now = new Date();
        const messageData = {
            content: message,
            role: 'assistant',
            timestamp: now
        };

        const userChatRef = chatManager.chatsCollection.doc(userId);
        const conversationRef = userChatRef.collection('conversations').doc(conversationId);
        
        console.log('Obteniendo documento actual...');
        const conversationDoc = await conversationRef.get();
        let messages = [];
        
        if (conversationDoc.exists) {
            console.log('Documento existente encontrado');
            messages = conversationDoc.data().messages || [];
        } else {
            console.log('Creando nuevo documento de conversación');
        }
        
        console.log('Agregando nuevo mensaje...');
        messages.push(messageData);
        
        console.log('Actualizando documento...');
        await conversationRef.set({
            lastUpdated: now,
            messages: messages
        }, { merge: true });

        console.log('Mensaje del asistente guardado exitosamente');
        return true;
    } catch (error) {
        console.error('Error al guardar mensaje del asistente en Firestore:', error);
        throw error;
    }
}

// =====================================
// FUNCIONES DE MAPEO Y CONTEXTO ERP
// =====================================

// Función para obtener contenido relevante de mapaERP - VERSIÓN SIMPLE SIN HARDCODEO
function obtenerContenidoMapaERP(consulta, historialConversacion = []) {
    try {
        // Extraer palabras clave básicas
        const palabrasClave = consulta.toLowerCase()
            .replace(/[¿?¡!.,;:()]/g, ' ')
            .split(/\s+/)
            .filter(palabra => palabra.length > 2);
        
        console.log('🔍 Palabras clave extraídas:', palabrasClave);

        // Buscar tablas relevantes basadas en la consulta actual
        const tablasRelevantes = Object.entries(mapaERP).filter(([key, value]) => {
            const nombreTabla = key.toLowerCase();
            const descripcion = value.descripcion.toLowerCase();
            
            return palabrasClave.some(palabra => {
                if (nombreTabla.includes(palabra) || palabra.includes(nombreTabla)) {
                    console.log(`✅ Coincidencia en tabla: "${palabra}" -> ${key}`);
                    return true;
                }
                if (descripcion.includes(palabra)) {
                    console.log(`✅ Coincidencia en descripción: "${palabra}" -> ${key}`);
                    return true;
                }
                return false;
            });
        });

        // CONFIAR EN GPT: Agregar contexto del historial reciente SIEMPRE
        // Sin hardcodear palabras específicas, simplemente dar contexto
        if (historialConversacion.length > 0) {
            console.log('🧠 Proporcionando contexto del historial para que GPT entienda naturalmente...');
            
            const mensajesRecientes = historialConversacion.slice(-2); // Solo últimos 2 mensajes
            const tablasDelHistorial = new Set();
            
            mensajesRecientes.forEach(mensaje => {
                Object.keys(mapaERP).forEach(tabla => {
                    if (mensaje.content.toLowerCase().includes(tabla.substring(0, 5))) {
                        tablasDelHistorial.add(tabla);
                        console.log(`🧠 Tabla del contexto: ${tabla}`);
                    }
                });
            });
            
            // Agregar tablas del contexto si no están ya incluidas
            tablasDelHistorial.forEach(tabla => {
                if (!tablasRelevantes.find(([key]) => key === tabla)) {
                    console.log(`🧠 Agregando contexto: ${tabla}`);
                    tablasRelevantes.push([tabla, mapaERP[tabla]]);
                }
            });
        }

        console.log(`📊 Total de tablas disponibles para GPT: ${tablasRelevantes.length}`);

        // Si no hay tablas específicas, dar un contexto mínimo
        if (tablasRelevantes.length === 0) {
            console.log('⚠️ Sin tablas específicas, enviando información general');
            return `Tablas disponibles: ${Object.keys(mapaERP).join(', ')}`;
        }

        // Generar información para GPT con detalles de columnas
        let respuesta = '';
        tablasRelevantes.forEach(([tabla, info]) => {
            respuesta += `\nTABLA ${tabla}:\n`;
            respuesta += `Descripción: ${info.descripcion}\n`;
            respuesta += `Columnas disponibles:\n`;
            
            // Mostrar cada columna con su descripción para que GPT entienda qué significa
            Object.entries(info.columnas).forEach(([columna, descripcion]) => {
                respuesta += `  - ${columna}: ${descripcion}\n`;
            });
            
            // Agregar información de columnas de relación para JOINs
            const columnasRelacion = Object.keys(info.columnas).filter(col => 
                col.includes('_PRV') || col.includes('_CLI') || col.includes('_ID') || col === 'id'
            );
            if (columnasRelacion.length > 0) {
                respuesta += `Columnas de relación para JOINs: ${columnasRelacion.join(', ')}\n`;
            }
        });

        return respuesta;
    } catch (error) {
        console.error('❌ Error al obtener contenido de mapaERP:', error);
        return '';
    }
}

// =====================================
// FUNCIONES DE EJECUCIÓN SQL Y FUZZY SEARCH
// =====================================

// Función para ejecutar consultas SQL con fuzzy search y reintentos
async function executeQueryWithFuzzySearch(sql, mensaje, intentoNumero = 1) {
    try {
        console.log(`🔍 [FUZZY-SEARCH] Intento ${intentoNumero}/3: ${sql}`);
        
        // Para fuzzy search, validaciones más relajadas
        if (intentoNumero === 1) {
            // Solo validar en el primer intento
            if (!validarTablaEnMapaERP(sql)) {
                throw new Error('Tabla no encontrada en mapaERP');
            }
        }

        // Reemplazar los nombres de las tablas con sus nombres reales
        const sqlModificado = reemplazarNombresTablas(sql);
        console.log('Ejecutando consulta SQL:', sqlModificado);
        
        const [rows] = await pool.query(sqlModificado);
        console.log('Resultados de la consulta:', rows);
        
        if (rows.length === 0 && intentoNumero < 3) {
            console.log(`🔍 [FUZZY-SEARCH] Sin resultados, evaluando si usar búsqueda alternativa...`);
            
            // Extraer términos de búsqueda del mensaje original
            const palabrasBusqueda = extraerPalabrasClave(mensaje);
            console.log(`🔍 [FUZZY-SEARCH] Palabras clave extraídas:`, palabrasBusqueda);
            
            // INTELIGENCIA MEJORADA: Solo usar fuzzy search si el error NO es de columnas incorrectas
            const errorSQL = sql.match(/ERROR|Unknown column|doesn't exist/i);
            if (errorSQL) {
                console.log(`🚫 [FUZZY-SEARCH] Error de SQL detectado, no usar fuzzy search genérico`);
                console.log(`⚠️ [FUZZY-SEARCH] GPT debe corregir la consulta SQL original`);
                return []; // Devolver vacío para que GPT se replantee
            }
            
            // Solo usar fuzzy search si hay palabras clave relevantes para productos
            if (palabrasBusqueda.length > 0) {
                console.log(`🔍 [FUZZY-SEARCH] Evaluando ${palabrasBusqueda.length} palabras clave para fuzzy search`);
                
                console.log(`🔍 [FUZZY-SEARCH] Activando búsqueda alternativa - confiando en IA`);
                
                // Generar consulta fuzzy basada en la original
                const sqlFuzzy = generarConsultaFuzzy(sql, palabrasBusqueda, intentoNumero + 1);
                console.log(`🔍 [FUZZY-SEARCH] Nueva consulta generada:`, sqlFuzzy);
                
                if (sqlFuzzy) {
                    return await executeQueryWithFuzzySearch(sqlFuzzy, mensaje, intentoNumero + 1);
        } else {
                    console.log(`🔍 [FUZZY-SEARCH] No se pudo generar consulta alternativa`);
                }
            } else {
                console.log(`🚫 [FUZZY-SEARCH] Sin palabras clave útiles, no usar fuzzy search`);
            }
        }
        
        return rows;
    } catch (error) {
        console.error(`🔍 [FUZZY-SEARCH] Error en intento ${intentoNumero}:`, error.message);
        
        // DIAGNÓSTICO INTELIGENTE DE ERRORES
        if (error.message.includes('Unknown column')) {
            const columnaIncorrecta = error.message.match(/'([^']+)'/)?.[1];
            console.log(`🚨 [ERROR-SQL] Columna incorrecta detectada: ${columnaIncorrecta}`);
            console.log(`🚨 [ERROR-SQL] GPT debe verificar nombres en mapaERP y corregir`);
            console.log(`⚠️ [ERROR-SQL] NO usar fuzzy search genérico para errores de columnas`);
            return []; // Devolver vacío para forzar a GPT a replantear
        }
        
        if (intentoNumero < 3) {
            console.log(`🔍 [FUZZY-SEARCH] Reintentando con búsqueda más flexible...`);
            
            // En caso de error, intentar una búsqueda más simple
            const sqlSimple = generarConsultaSimple(sql, mensaje, intentoNumero);
            if (sqlSimple) {
                return await executeQueryWithFuzzySearch(sqlSimple, mensaje, intentoNumero + 1);
            }
        }
        
        throw error;
    }
}

// =====================================
// FUNCIONES DE FORMATEO Y UTILIDADES DE DATOS
// =====================================

// Función de JavaScript para formateo inteligente de datos (ÚNICA Y EFICIENTE)
function formatearResultados(results, query) {
    if (!results || results.length === 0) {
        return "no se encontraron resultados para esta consulta";
    }
    
    // VALIDACIÓN INTELIGENTE: Detectar si los resultados son relevantes para la consulta
    const palabrasConsulta = query.toLowerCase().split(/\s+/);
    const terminosBuscados = palabrasConsulta.filter(p => p.length > 3);
    
    console.log(`🔍 [VALIDACIÓN-RESULTADOS] Términos buscados: ${terminosBuscados.join(', ')}`);
    
    // Verificar si los resultados contienen términos relacionados
    if (terminosBuscados.length > 0 && results.length > 0) {
        let primerValor = '';
        try {
            const valor = Object.values(results[0])[0];
            if (valor !== null && valor !== undefined) {
                primerValor = valor.toString().toLowerCase();
            }
        } catch (error) {
            console.log(`🛡️ [PROTECCIÓN-VALIDACIÓN] Error al procesar primer valor para validación: ${error.message}`);
            primerValor = '';
        }
        
        const tieneRelacion = terminosBuscados.some(termino => 
            primerValor.includes(termino) || 
            primerValor.includes(termino.substring(0, 4)) // Buscar parte del término
        );
        
        if (!tieneRelacion) {
            console.log(`⚠️ [VALIDACIÓN-RESULTADOS] POSIBLE IRRELEVANCIA: buscó "${terminosBuscados.join(', ')}" pero obtuvo "${primerValor}"`);
            console.log(`⚠️ [VALIDACIÓN-RESULTADOS] GPT debería replantear la consulta`);
        } else {
            console.log(`✅ [VALIDACIÓN-RESULTADOS] Resultados parecen relevantes para la consulta`);
        }
    }
    
    // VALIDACIÓN ESPECÍFICA: Detectar campos vacíos en consultas de proveedores
    if (query.toLowerCase().includes('proveedor') && results.length > 0) {
        const camposVacios = results.filter(registro => {
            const valores = Object.values(registro);
            return valores.some(valor => valor === '' || valor === null);
        });
        
        if (camposVacios.length > 0) {
            console.log(`⚠️ [VALIDACIÓN-PROVEEDORES] ${camposVacios.length}/${results.length} registros tienen campos vacíos`);
            console.log(`⚠️ [VALIDACIÓN-PROVEEDORES] GPT debería filtrar con: WHERE campo IS NOT NULL AND campo != ''`);
        }
    }

    const pideCompleto = /completa|detallad[ao]s?|explicaci[óo]n|todo(s)?|todas/i.test(query);
    const pideAleatorio = /aleatori[ao]|ejemplo|cualquiera|al azar/i.test(query);
    
    let tablaDetectada = null;
    if (results.length > 0) {
        const columnasResultado = Object.keys(results[0]);
        tablaDetectada = determinarTabla(columnasResultado);
    }

    const resultadosLimitados = limitarResultados(results, pideCompleto ? 10 : 5, pideAleatorio);
    
    // Para consultas de conteo simple
    if (resultadosLimitados.length === 1 && Object.keys(resultadosLimitados[0]).length === 1) {
        const valor = Object.values(resultadosLimitados[0])[0];
        // PROTECCIÓN CONTRA NULL: Verificar si el valor existe antes de convertir
        if (valor === null || valor === undefined) {
            return "0";
        }
        return valor.toString();
    }
    
    // Para múltiples registros - formato natural
    if (resultadosLimitados.length > 1 && Object.keys(resultadosLimitados[0]).length === 1) {
        // Si es una sola columna (como nombres), listar naturalmente
        // FILTRAR datos vacíos/sucios ANTES de formatear
        const valoresOriginales = resultadosLimitados.map(registro => Object.values(registro)[0]);
        const valores = valoresOriginales.filter(valor => {
            // PROTECCIÓN ROBUSTA CONTRA NULL/UNDEFINED
            if (valor === null || valor === undefined) return false;
            try {
                return valor.toString().trim() !== '';
            } catch (error) {
                console.log(`🛡️ [PROTECCIÓN] Error al convertir valor a string: ${valor}`);
                return false;
            }
        });
        
        // DEBUG: Mostrar filtrado de datos sucios
        if (valoresOriginales.length !== valores.length) {
            console.log(`🧹 [DATOS-SUCIOS] Filtrados ${valoresOriginales.length - valores.length} registros vacíos/inválidos`);
            console.log(`🧹 [DATOS-SUCIOS] Originales: [${valoresOriginales.map(v => `"${v}"`).join(', ')}]`);
            console.log(`🧹 [DATOS-SUCIOS] Filtrados: [${valores.map(v => `"${v}"`).join(', ')}]`);
        }
        
        if (valores.length === 0) {
            return "no se encontraron datos válidos";
        }
        if (valores.length === 1) {
            return valores[0];
        }
        if (valores.length === 2) {
            return `${valores[0]} y ${valores[1]}`;
        } else if (valores.length > 2) {
            const ultimoValor = valores.pop();
            return `${valores.join(', ')} y ${ultimoValor}`;
        }
        return valores[0];
    }
    
    // Para registros complejos con múltiples campos - FORMATO NATURAL SIN NOMBRES TÉCNICOS
    let resultado = '';
    resultadosLimitados.forEach((registro, index) => {
        const campos = Object.entries(registro);
        
        // ESTRATEGIA SIMPLE: Mostrar todos los valores, sin clasificaciones complejas
        const valoresLimpios = [];
        
        campos.forEach(([campo, valor]) => {
            // PROTECCIÓN ROBUSTA: Verificar si el valor es null/undefined
            if (valor === null || valor === undefined) {
                return;
            }
            
            // Limpiar y formatear valor
            try {
                // Convertir fechas a formato legible  
                if (campo.toLowerCase().includes('fec') && valor) {
                    const fecha = new Date(valor);
                    if (!isNaN(fecha.getTime())) {
                        valor = fecha.toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long', 
                            day: 'numeric'
                        });
                    }
                }
            } catch (error) {
                console.log(`🛡️ [PROTECCIÓN-FECHA] Error al formatear fecha ${campo}: ${error.message}`);
                // Mantener valor original si hay error
            }
            
            // Solo agregar valores no vacíos
            if (valor && valor.toString().trim() !== '') {
                valoresLimpios.push(valor);
            }
        });
        
        // CONSTRUCCIÓN DEL RESULTADO: Todos los valores separados naturalmente
        if (index > 0) resultado += ', ';
        resultado += valoresLimpios.join(' - ');
    });

    return resultado;
}

// Función para obtener la descripción de una columna
function obtenerDescripcionColumna(tabla, columna) {
    if (mapaERP[tabla] && mapaERP[tabla].columnas && mapaERP[tabla].columnas[columna]) {
        return mapaERP[tabla].columnas[columna];
    }
    return columna;
}

// Función para determinar la tabla basada en las columnas
function determinarTabla(columnas) {
    for (const [tabla, info] of Object.entries(mapaERP)) {
        const columnasTabla = Object.keys(info.columnas || {});
        if (columnas.every(col => columnasTabla.includes(col))) {
            return tabla;
        }
    }
    return null;
}

// Función para limitar resultados
function limitarResultados(results, limite = 5, aleatorio = false) {
    if (!results || results.length === 0) return [];
    if (aleatorio && results.length > 1) {
        const shuffled = results.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, limite);
    }
    return results.slice(0, limite);
}

// =====================================
// FUNCIONES DE VALIDACIÓN SQL Y FORMATO
// =====================================

// Función para validar que la respuesta contiene una consulta SQL
function validarRespuestaSQL(response) {
    let sqlMatch = response.match(/<sql>([\s\S]*?)<\/sql>/);
    if (!sqlMatch) {
        sqlMatch = response.match(/```sql\s*([\s\S]*?)```/);
        if (sqlMatch) {
            console.log('Advertencia: SQL encontrado en formato markdown, convirtiendo a formato <sql>');
            response = response.replace(/```sql\s*([\s\S]*?)```/, '<sql>$1</sql>');
            sqlMatch = response.match(/<sql>([\s\S]*?)<\/sql>/);
        }
    }
    if (!sqlMatch) {
        return null;
    }
    let sql = sqlMatch[1].trim();
    if (!sql) {
        throw new Error('La consulta SQL está vacía');
    }
    if (!sql.toLowerCase().startsWith('select')) {
        throw new Error('La consulta debe comenzar con SELECT');
    }
    if (sql.includes('OFFSET')) {
        const offsetMatch = sql.match(/LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i);
        if (offsetMatch) {
            sql = sql.replace(
                /LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i,
                `LIMIT ${offsetMatch[2]}, ${offsetMatch[1]}`
            );
        }
    }
    const esConsultaConteo = sql.toLowerCase().includes('count(*)');
    const tieneDistinct = /select\s+distinct/i.test(sql);
    const tieneGroupBy = /group by/i.test(sql);
    const tieneJoin = /join/i.test(sql);
    const tieneFiltroFecha = /where[\s\S]*fpe_fec|where[\s\S]*fecha|where[\s\S]*_fec/i.test(sql);
    if (!esConsultaConteo && !tieneDistinct && !tieneGroupBy && !sql.toLowerCase().includes('limit') && !(tieneJoin && tieneFiltroFecha)) {
        sql = sql.replace(/;*\s*$/, '');
        sql += ' LIMIT 50';
    }
    return sql;
}

// Función para reemplazar nombres de tablas en la consulta SQL
function reemplazarNombresTablas(sql) {
    let sqlModificado = sql;
    Object.keys(mapaERP).forEach(key => {
        if (mapaERP[key].tabla && mapaERP[key].tabla.includes('-')) {
            const regex = new RegExp(`FROM\\s+\`?${key}\`?`, 'gi');
            sqlModificado = sqlModificado.replace(regex, `FROM \`${mapaERP[key].tabla}\``);
        }
    });
    return sqlModificado;
}

// Función para validar que la tabla existe en mapaERP
function validarTablaEnMapaERP(sql) {
    const tablasEnMapa = Object.keys(mapaERP);
    const tablasEnSQL = sql.match(/FROM\s+`?([^`\s,;]+)`?/i) || [];
    const tabla = tablasEnSQL[1];
    
    if (!tabla) return true; // Si no se detecta tabla, permitir la consulta
    
    // Verificar si la tabla existe en mapaERP (ignorando backticks)
    const tablaSinBackticks = tabla.replace(/`/g, '');
    if (!tablasEnMapa.includes(tablaSinBackticks)) {
        throw new Error(`La tabla '${tabla}' no está definida en mapaERPEmployee. Tablas disponibles: ${tablasEnMapa.join(', ')}`);
    }
    
    return true;
}

// =====================================
// FUNCIONES AUXILIARES SQL ADICIONALES
// =====================================

// Función para extraer palabras clave del mensaje - CONFIANDO EN IA
function extraerPalabrasClave(mensaje) {
    // SIMPLE: Solo filtrar palabras muy cortas y signos, CONFIAR EN GPT
    const palabras = mensaje.toLowerCase()
        .replace(/[¿?¡!.,;:()]/g, ' ')
        .split(/\s+/)
        .filter(palabra => palabra.length >= 3)
        .slice(0, 4);
    
    console.log(`🔍 [PALABRAS-CLAVE] Extraídas de "${mensaje}":`, palabras);
    return palabras;
}

// Función para generar consulta fuzzy más inteligente
function generarConsultaFuzzy(sqlOriginal, palabrasClave, intento) {
    const tabla = sqlOriginal.match(/FROM\s+`?(\w+)`?/i)?.[1];
    if (!tabla || !mapaERP[tabla]) {
        console.log(`🔍 [FUZZY-SEARCH] Tabla no válida: ${tabla}`);
        return null;
    }
    
    const columnas = Object.keys(mapaERP[tabla].columnas);
    const columnaPrincipal = columnas.find(col => col.includes('DENO')) || columnas[0];
    
    console.log(`🔍 [FUZZY-SEARCH] Tabla: ${tabla}, Columna: ${columnaPrincipal}, Intento: ${intento}`);
    console.log(`🔍 [FUZZY-SEARCH] Palabras disponibles:`, palabrasClave);
    
    // Si no hay palabras clave útiles, no hacer fuzzy search
    if (palabrasClave.length === 0) {
        console.log(`🚫 [FUZZY-SEARCH] Sin palabras clave útiles, cancelando fuzzy search`);
        return null;
    }
    
    if (intento === 2) {
        // Usar la primera palabra disponible - CONFIAR EN IA
        const termino = palabrasClave[0];
        const consulta = `SELECT ${columnaPrincipal}, id FROM ${tabla} WHERE ${columnaPrincipal} LIKE '%${termino}%' LIMIT 5`;
        console.log(`🔍 [FUZZY-SEARCH] Consulta intento 2 con "${termino}": ${consulta}`);
        return consulta;
    } else if (intento === 3) {
        // Búsqueda con múltiples términos combinados
        if (palabrasClave.length > 1) {
            const terminos = palabrasClave.slice(0, 2); // Máximo 2 términos
            const condiciones = terminos.map(t => `${columnaPrincipal} LIKE '%${t}%'`).join(' OR ');
            const consulta = `SELECT ${columnaPrincipal}, id FROM ${tabla} WHERE ${condiciones} LIMIT 5`;
            console.log(`🔍 [FUZZY-SEARCH] Consulta intento 3 con múltiples términos: ${consulta}`);
            return consulta;
        } else {
            // Último intento: búsqueda general solo si hay al menos una palabra
            const consulta = `SELECT ${columnaPrincipal}, id FROM ${tabla} LIMIT 5`;
            console.log(`🔍 [FUZZY-SEARCH] Consulta intento 3 (general): ${consulta}`);
            return consulta;
        }
    }
    
    return null;
}

// Función para generar consulta simple en caso de error
function generarConsultaSimple(sqlOriginal, mensaje, intento) {
    const tabla = sqlOriginal.match(/FROM\s+`?(\w+)`?/i)?.[1];
    if (!tabla || !mapaERP[tabla]) return null;
    
    const columnas = Object.keys(mapaERP[tabla].columnas);
    const columnaPrincipal = columnas.find(col => col.includes('DENO')) || columnas[0];
    
    // Consulta simple sin WHERE
    return `SELECT ${columnaPrincipal} FROM ${tabla} LIMIT 5`;
}

// =====================================
// EXPORTACIÓN DE FUNCIONES PRINCIPALES
// =====================================

module.exports = {
    processQuery
}; 