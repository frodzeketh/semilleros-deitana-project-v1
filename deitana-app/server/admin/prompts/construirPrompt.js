// =====================================
// CONSTRUCTOR DINÁMICO DE PROMPTS
// =====================================

const { promptBase } = require('./base');
const { sqlRules } = require('./sqlRules');
const { formatoRespuesta } = require('./formatoRespuesta');
const { ejemplosSQL, ejemplosConversacion } = require('./ejemplos');
const { comportamiento } = require('./comportamiento');
const ragInteligente = require('../ragInteligente');

/**
 * Analiza la intención del usuario usando IA real en lugar de patrones regex
 */
async function analizarIntencionIA(mensaje, openaiClient) {
    console.log('🧠 [INTENCION-IA] Analizando consulta con inteligencia artificial...');
    
    try {
        const completion = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini', // Modelo rápido y económico para clasificación
            messages: [{
                role: 'system',
                content: `Eres un clasificador de intenciones para un asistente ERP agrícola de Semilleros Deitana.

CATEGORÍAS:
- SALUDO: saludos, presentaciones, cortesías básicas
- CONSULTA_SIMPLE: pedir datos específicos (un cliente, un artículo, información puntual)
- CONSULTA_COMPLEJA: análisis, comparaciones, múltiples tablas, tendencias, reportes
- CONVERSACION: preguntas generales, explicaciones, ayuda sobre el sistema
- COMANDO_MEMORIA: comandos para gestionar memoria/recordar cosas

EJEMPLOS:
"Hola" → SALUDO
"Dame un cliente" → CONSULTA_SIMPLE  
"¿Cuántos clientes tenemos de Murcia y cuáles son sus principales pedidos?" → CONSULTA_COMPLEJA
"¿Qué es Semilleros Deitana?" → CONVERSACION
"Recuerda que el cliente X prefiere tomates" → COMANDO_MEMORIA

Responde SOLO con: SALUDO|CONSULTA_SIMPLE|CONSULTA_COMPLEJA|CONVERSACION|COMANDO_MEMORIA`
            }, {
                role: 'user',
                content: mensaje
            }],
            max_tokens: 20,
            temperature: 0.1
        });

        const clasificacion = completion.choices[0].message.content.trim();
        console.log('🎯 [INTENCION-IA] Clasificación:', clasificacion);

        // Mapear a estructura interna
        switch (clasificacion) {
            case 'SALUDO':
                return { tipo: 'saludo', complejidad: 'simple', requiereIA: false };
            case 'CONSULTA_SIMPLE':
                return { tipo: 'sql', complejidad: 'simple', requiereIA: true };
            case 'CONSULTA_COMPLEJA':
                return { tipo: 'sql', complejidad: 'compleja', requiereIA: true };
            case 'CONVERSACION':
                return { tipo: 'conversacion', complejidad: 'media', requiereIA: true };
            case 'COMANDO_MEMORIA':
                return { tipo: 'memoria', complejidad: 'simple', requiereIA: false };
            default:
                console.log('⚠️ [INTENCION-IA] Clasificación desconocida, usando conversación');
                return { tipo: 'conversacion', complejidad: 'media', requiereIA: true };
        }

    } catch (error) {
        console.error('❌ [INTENCION-IA] Error en clasificación:', error.message);
        // Fallback inteligente: asumir que es consulta SQL si menciona entidades del ERP
        const entidadesERP = /(cliente|proveedor|articulo|bandeja|tecnico|accion|pedido|factura|almacen|invernadero)/i;
        if (entidadesERP.test(mensaje)) {
            return { tipo: 'sql', complejidad: 'simple', requiereIA: true };
        }
        return { tipo: 'conversacion', complejidad: 'media', requiereIA: true };
    }
}

/**
 * Detecta qué tablas del mapaERP son relevantes para la consulta usando IA
 */
async function detectarTablasRelevantesIA(mensaje, mapaERP, openaiClient) {
    console.log('📊 [TABLAS-IA] Detectando tablas relevantes con IA...');
    
    const tablasDisponibles = Object.keys(mapaERP);
    const descripcionesTablas = tablasDisponibles.map(tabla => 
        `${tabla}: ${mapaERP[tabla].descripcion || 'Sin descripción'}`
    ).join('\n');

    try {
        const completion = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
                role: 'system',
                content: `Analiza la consulta del usuario y determina qué tablas del ERP son relevantes.

TABLAS DISPONIBLES:
${descripcionesTablas}

Responde SOLO con los nombres de las tablas separados por comas. Si no estás seguro, incluye tablas relacionadas. Máximo 5 tablas.

Ejemplo: "clientes,articulos,pedidos"`
            }, {
                role: 'user',
                content: mensaje
            }],
            max_tokens: 50,
            temperature: 0.1
        });

        const respuesta = completion.choices[0].message.content.trim();
        const tablasDetectadas = respuesta.split(',').map(t => t.trim()).filter(t => 
            tablasDisponibles.includes(t)
        );

        console.log('📊 [TABLAS-IA] Tablas detectadas:', tablasDetectadas);
        return tablasDetectadas;

    } catch (error) {
        console.error('❌ [TABLAS-IA] Error detectando tablas:', error.message);
        // Fallback: usar mapeo básico por palabras clave
        return detectarTablasRelevantesBasico(mensaje, mapaERP);
    }
}

/**
 * Fallback básico para detección de tablas
 */
function detectarTablasRelevantesBasico(mensaje, mapaERP) {
    const mensajeLower = mensaje.toLowerCase();
    const tablasRelevantes = [];
    
    const mapaPalabras = {
        'cliente': ['clientes'],
        'proveedor': ['proveedores'], 
        'articulo': ['articulos'],
        'bandeja': ['bandejas'],
        'tecnico': ['tecnicos'],
        'accion': ['acciones_com'],
        'pedido': ['pedidos'],
        'factura': ['facturas-e', 'facturas-r'],
        'albaran': ['alb-venta', 'alb-compra']
    };
    
    for (const [palabra, tablas] of Object.entries(mapaPalabras)) {
        if (mensajeLower.includes(palabra)) {
            tablasRelevantes.push(...tablas);
        }
    }
    
    return [...new Set(tablasRelevantes)];
}

/**
 * Construye el contexto del mapaERP de forma selectiva
 */
function construirContextoMapaERP(tablasRelevantes, mapaERP) {
    if (tablasRelevantes.length === 0) {
        return ''; // No incluir mapaERP si no es necesario
    }
    
    let contexto = '\n=== ESTRUCTURA DE DATOS RELEVANTE ===\n';
    
    tablasRelevantes.forEach(tabla => {
        if (mapaERP[tabla]) {
            contexto += `\n${tabla}: ${mapaERP[tabla].descripcion || 'Sin descripción'}\n`;
            if (mapaERP[tabla].columnas) {
                const columnasPrincipales = Object.keys(mapaERP[tabla].columnas).slice(0, 8); // Limitar a 8 columnas
                contexto += `Columnas: ${columnasPrincipales.join(', ')}\n`;
            }
        }
    });
    
    return contexto;
}

/**
 * Selecciona el modelo GPT más apropiado según la complejidad Y tipo de tarea
 */
function seleccionarModeloInteligente(intencion, tablasRelevantes) {
    const { tipo, complejidad, requiereIA } = intencion;
    
    // Para tareas que NO requieren IA sofisticada
    if (!requiereIA) {
        return {
            modelo: 'gpt-4o-mini',
            maxTokens: 500,
            temperature: 0.7,
            razon: 'Respuesta simple sin consulta SQL'
        };
    }
    
    // Para consultas SQL: siempre usar modelos capaces
    if (tipo === 'sql') {
        if (complejidad === 'compleja' || tablasRelevantes.length > 2) {
            return {
                modelo: 'gpt-4o',
                maxTokens: 2000,
                temperature: 0.3, // Más determinístico para SQL complejo
                razon: 'SQL complejo con múltiples tablas'
            };
        } else {
            return {
                modelo: 'gpt-4o',
                maxTokens: 1200,
                temperature: 0.3, // Más determinístico para SQL
                razon: 'SQL simple pero requiere precisión'
            };
        }
    }
    
    // Para conversaciones: modelo equilibrado
    return {
        modelo: 'gpt-4o-mini',
        maxTokens: 800,
        temperature: 0.8, // Más creativo para conversación
        razon: 'Conversación general'
    };
}

/**
 * Función principal: construye el prompt dinámico optimizado con IA real
 */
async function construirPromptInteligente(mensaje, mapaERP, openaiClient, contextoPinecone = '', contextoDatos = '', modoDesarrollo = false) {
    console.log('🧠 [PROMPT-BUILDER] Construyendo prompt con IA real...');
    
    // 1. Analizar intención con IA
    const intencion = await analizarIntencionIA(mensaje, openaiClient);
    console.log('🎯 [PROMPT-BUILDER] Intención detectada:', intencion);
    
    // 2. Detectar tablas relevantes con IA
    const tablasRelevantes = intencion.tipo === 'sql' 
        ? await detectarTablasRelevantesIA(mensaje, mapaERP, openaiClient)
        : [];
    console.log('📊 [PROMPT-BUILDER] Tablas relevantes:', tablasRelevantes);
    
    // 2.5. Recuperar conocimiento RAG si es relevante
    let contextoRAG = '';
    const necesitaRAG = intencion.tipo === 'conversacion' || 
                       mensaje.toLowerCase().includes('empresa') ||
                       mensaje.toLowerCase().includes('semilleros') ||
                       mensaje.toLowerCase().includes('cultivo') ||
                       mensaje.toLowerCase().includes('proceso');
    
    if (necesitaRAG) {
        console.log('🧠 [RAG] Recuperando conocimiento de empresa...');
        try {
            contextoRAG = await ragInteligente.recuperarConocimientoRelevante(mensaje, 'sistema');
            if (contextoRAG) {
                console.log('✅ [RAG] Contexto de empresa agregado');
            }
        } catch (error) {
            console.error('❌ [RAG] Error recuperando contexto:', error.message);
        }
    }
    
    // 3. Seleccionar modelo de forma inteligente
    const configModelo = seleccionarModeloInteligente(intencion, tablasRelevantes);
    console.log('🤖 [PROMPT-BUILDER] Modelo seleccionado:', configModelo.modelo, '-', configModelo.razon);
    
    // 4. Construir prompt según tipo de consulta
    let promptCompleto = promptBase;
    
    switch (intencion.tipo) {
        case 'saludo':
            promptCompleto += `\n\n${formatoRespuesta}\n\n${ejemplosConversacion}`;
            break;
            
        case 'sql':
            promptCompleto += `\n\n${sqlRules}\n\n${formatoRespuesta}`;
            
            // Agregar contexto del mapaERP solo para las tablas relevantes
            const contextoMapaERP = construirContextoMapaERP(tablasRelevantes, mapaERP);
            if (contextoMapaERP) {
                promptCompleto += contextoMapaERP;
            }
            
            // Agregar ejemplos SQL para consultas complejas
            if (intencion.complejidad === 'compleja' || modoDesarrollo) {
                promptCompleto += `\n\n${ejemplosSQL}`;
            }
            break;
            
        case 'conversacion':
            promptCompleto += `\n\n${formatoRespuesta}`;
            break;
            
        case 'memoria':
            // Para comandos de memoria, prompt especializado
            promptCompleto += `\n\nEres un asistente que gestiona memoria semántica. El usuario quiere que recuerdes o gestiones información específica.`;
            break;
            
        default:
            promptCompleto += `\n\n${formatoRespuesta}`;
            break;
    }
    
    // 5. Agregar contextos adicionales
    if (contextoRAG) {
        promptCompleto += `\n\n${contextoRAG}`;
    }
    
    if (contextoPinecone) {
        promptCompleto += `\n\n=== MEMORIA SEMÁNTICA ===\n${contextoPinecone}`;
    }
    
    if (contextoDatos) {
        promptCompleto += `\n\n=== DATOS PREVIOS ===\n${contextoDatos}`;
    }
    
    // 6. Agregar comportamiento avanzado para tareas complejas
    if (intencion.complejidad === 'compleja' || intencion.tipo === 'sql') {
        promptCompleto += `\n\n${comportamiento}`;
    }
    
    return {
        prompt: promptCompleto,
        configModelo: configModelo,
        intencion: intencion,
        tablasRelevantes: tablasRelevantes,
        metricas: {
            usaIA: true,
            modeloSeleccionado: configModelo.modelo,
            razonSeleccion: configModelo.razon,
            tablasDetectadas: tablasRelevantes.length
        }
    };
}

module.exports = {
    construirPromptInteligente,
    analizarIntencionIA,
    detectarTablasRelevantesIA,
    seleccionarModeloInteligente
}; 