// =====================================
// CONSTRUCTOR DINÁMICO DE PROMPTS OPTIMIZADO
// =====================================

const { promptBase } = require('./base');
const { sqlRules } = require('./sqlRules');
const { formatoRespuesta } = require('./formatoRespuesta');
const { ejemplosSQL, ejemplosConversacion } = require('./ejemplos');
const { comportamiento, comportamientoAsistente } = require('./comportamiento');
const ragInteligente = require('../core/ragInteligente');

/**
 * Analiza la intención del usuario usando patrones básicos (SIN IA)
 * Esto elimina la primera llamada costosa a OpenAI
 */
function analizarIntencionBasica(mensaje) {
    console.log('🧠 [INTENCION-BASICA] Analizando consulta con patrones...');
    
    const mensajeLower = mensaje.toLowerCase();
    
    // Patrones de saludo
    if (/^(hola|buenos|buenas|saludos|hello|hi)\b/.test(mensajeLower)) {
        return { tipo: 'saludo', complejidad: 'simple', requiereIA: false };
    }
    
    // Patrones de comandos de memoria
    if (/^(recuerda|guarda|anota|apunta|memoriza)\b/.test(mensajeLower)) {
        return { tipo: 'memoria', complejidad: 'simple', requiereIA: false };
    }
    
    // Patrones de consultas que requieren RAG + SQL combinado (DEBE IR ANTES DE CONVERSACION)
    const consultasRAGSQL = /(qué tipos?|que tipos?|cuáles?|cuales?|cómo se|como se|procedimiento|proceso|función|funcion|utiliza|usa|emplea|manual|entrada|cámara|camara|germinación|germinacion)/i;
    const entidadesERP = /(cliente|proveedor|articulo|bandeja|tecnico|accion|pedido|factura|almacen|invernadero)/i;
    
    // Si pregunta sobre tipos, procedimientos, funciones, manuales, etc. Y menciona entidades ERP
    if (consultasRAGSQL.test(mensajeLower) && entidadesERP.test(mensajeLower)) {
        return { tipo: 'rag_sql', complejidad: 'media', requiereIA: true };
    }
    
    // Si pregunta sobre manuales, procesos, cámaras, etc. (sin entidades ERP específicas)
    const consultasRAGPuro = /(manual|proceso|procedimiento|cámara|camara|germinación|germinacion|entrada|siembra|cultivo|injerto|qué se hace|que se hace|cómo es|como es)/i;
    if (consultasRAGPuro.test(mensajeLower)) {
        return { tipo: 'rag_sql', complejidad: 'media', requiereIA: true };
    }
    
    // Patrones de consultas conversacionales (DEBE IR DESPUÉS DE RAG)
    if (/^(qué es|que es|explica|cómo|como|cuál|cual|por qué|porque|ayuda)\b/.test(mensajeLower)) {
        return { tipo: 'conversacion', complejidad: 'media', requiereIA: true };
    }
    
    // Patrones de consultas complejas SQL
    if (/\b(análisis|análisys|compara|comparison|tendencia|trend|reporte|report|estadística|statistic)\b/.test(mensajeLower)) {
        return { tipo: 'sql', complejidad: 'compleja', requiereIA: true };
    }
    
    // Patrones de consultas SQL puras (listados, cantidades, etc.)
    const consultasSQLPuras = /(cuántos?|cuantas?|listar|lista|mostrar|buscar|encontrar|total|suma|promedio)/i;
    if (consultasSQLPuras.test(mensajeLower) && entidadesERP.test(mensajeLower)) {
        return { tipo: 'sql', complejidad: 'simple', requiereIA: true };
    }
    
    // Por defecto: conversación
    console.log('🎯 [INTENCION-BASICA] Clasificación: conversacion (default)');
    return { tipo: 'conversacion', complejidad: 'media', requiereIA: true };
}

/**
 * Detecta qué tablas del mapaERP son relevantes usando mapeo directo (SIN IA)
 * Esto elimina la segunda llamada costosa a OpenAI
 */
function detectarTablasRelevantesBasico(mensaje, mapaERP) {
    console.log('📊 [TABLAS-BASICAS] Detectando tablas con mapeo directo...');
    
    const mensajeLower = mensaje.toLowerCase();
    const tablasRelevantes = [];
    
    // Mapeo directo de palabras clave a tablas
    const mapaPalabras = {
        'cliente': ['clientes'],
        'clientes': ['clientes'],
        'proveedor': ['proveedores'], 
        'proveedores': ['proveedores'],
        'articulo': ['articulos'],
        'articulos': ['articulos'],
        'producto': ['articulos'],
        'productos': ['articulos'],
        'bandeja': ['bandejas'],
        'bandejas': ['bandejas'],
        'tecnico': ['tecnicos'],
        'tecnicos': ['tecnicos'],
        'empleado': ['tecnicos'],
        'empleados': ['tecnicos'],
        'accion': ['acciones_com'],
        'acciones': ['acciones_com'],
        'pedido': ['pedidos'],
        'pedidos': ['pedidos'],
        'factura': ['facturas-e', 'facturas-r'],
        'facturas': ['facturas-e', 'facturas-r'],
        'albaran': ['alb-venta', 'alb-compra'],
        'albaranes': ['alb-venta', 'alb-compra'],
        'almacen': ['almacenes'],
        'almacenes': ['almacenes'],
        'invernadero': ['invernaderos'],
        'invernaderos': ['invernaderos']
    };
    
    // Buscar coincidencias directas
    for (const [palabra, tablas] of Object.entries(mapaPalabras)) {
        if (mensajeLower.includes(palabra)) {
            tablasRelevantes.push(...tablas);
        }
    }
    
    // Eliminar duplicados
    const tablasUnicas = [...new Set(tablasRelevantes)];
    
    console.log('📊 [TABLAS-BASICAS] Tablas detectadas:', tablasUnicas);
    return tablasUnicas;
}

/**
 * Construye el contexto del mapaERP de forma selectiva
 */
function construirContextoMapaERP(tablasRelevantes, mapaERP) {
    if (!tablasRelevantes || tablasRelevantes.length === 0 || !mapaERP) {
        console.log('⚠️ [MAPA-ERP] No se incluye contexto - tablas:', tablasRelevantes, 'mapaERP:', !!mapaERP);
        return ''; // No incluir mapaERP si no es necesario o no existe
    }
    
    let contexto = '\n=== ESTRUCTURA DE DATOS RELEVANTE ===\n';
    
    tablasRelevantes.forEach(tabla => {
        if (mapaERP && mapaERP[tabla]) {
            console.log(`📋 [MAPA-ERP] Incluyendo tabla: ${tabla}`);
            contexto += `\n${tabla}: ${mapaERP[tabla].descripcion || 'Sin descripción'}\n`;
            
            if (mapaERP[tabla].columnas) {
                // Incluir TODAS las columnas importantes, no solo las primeras 8
                const columnas = Object.entries(mapaERP[tabla].columnas);
                const columnasConDescripcion = columnas.map(([columna, descripcion]) => 
                    `${columna}: ${descripcion}`
                ).join('\n');
                
                contexto += `Columnas disponibles:\n${columnasConDescripcion}\n`;
            }
        } else {
            console.log(`⚠️ [MAPA-ERP] Tabla no encontrada en mapaERP: ${tabla}`);
        }
    });
    
    console.log('📋 [MAPA-ERP] Contexto construido:', contexto.substring(0, 200) + '...');
    return contexto;
}

/**
 * Selecciona el modelo GPT más apropiado según la complejidad
 */
function seleccionarModeloInteligente(intencion, tablasRelevantes) {
    // SIEMPRE usar GPT-4-turbo-preview como en la versión original que funcionaba
    const config = {
        modelo: 'gpt-4-turbo-preview',
        maxTokens: 2000,
        temperature: 0.3,
        razon: 'Usar el modelo original que ya funcionaba correctamente para SQL'
    };
    
    console.log('🤖 [MODELO-SELECTOR] Complejidad:', intencion.complejidad);
    console.log('🤖 [MODELO-SELECTOR] Modelo seleccionado:', config.modelo);
    console.log('🤖 [MODELO-SELECTOR] Razón:', config.razon);
    
    return config;
}

/**
 * Construye instrucciones optimizadas para respuestas más naturales
 */
function construirInstruccionesNaturales(intencion, tablasRelevantes, contextoPinecone) {
    let instrucciones = `Eres el asistente de Semilleros Deitana, una empresa agrícola especializada en semillas y tomates.

IMPORTANTE: Responde de forma NATURAL y CONVERSACIONAL, como si fueras un empleado amigable de la empresa.

`;

    // Instrucciones específicas según el tipo
    if (intencion.tipo === 'rag_sql') {
        instrucciones += `PROCESO PARA CONSULTAS RAG + SQL COMBINADO:
1. PRIMERO: Usa la información del conocimiento empresarial como GUÍA para explicar el contexto, procedimientos y tipos
2. SEGUNDO: Si es apropiado, genera una consulta SQL para dar ejemplos concretos: <sql>SELECT...</sql>
3. TERCERO: Combina la información del RAG con ejemplos de la base de datos
4. Responde de forma NATURAL y CONVERSACIONAL
5. Usa EXACTAMENTE las columnas que aparecen en la estructura de datos proporcionada

IMPORTANTE: 
- El conocimiento empresarial es una GUÍA, no la única fuente
- SIEMPRE responde, incluso si no encuentras información específica
- Si hay información en el RAG, úsala como base pero puedes complementar
- Si no hay información específica, explica el concepto general
- Prioriza ser útil y completo sobre ser restrictivo

EJEMPLOS:
- Para bandejas: Explica tipos según cultivo (usando info del RAG), luego muestra ejemplos de la BD
- Para procedimientos: Explica el proceso (usando info del RAG), luego busca ejemplos relevantes
- Para cámaras: Explica el proceso (usando info del RAG), complementa con información general si es necesario

`;
    } else if (intencion.tipo === 'sql') {
        instrucciones += `PROCESO PARA CONSULTAS DE DATOS:
1. Genera ÚNICAMENTE la consulta SQL en formato: <sql>SELECT...</sql>
2. NO generes texto adicional antes o después del SQL
3. Usa LIMIT para respetar cantidades específicas solicitadas
4. IMPORTANTE: Usa EXACTAMENTE las columnas que aparecen en la estructura de datos proporcionada
5. Para nombres/denominaciones, busca columnas que contengan "DENO" en su nombre

EJEMPLOS CORRECTOS:
- "2 clientes" → <sql>SELECT CL_DENO FROM clientes LIMIT 2</sql>
- "3 artículos" → <sql>SELECT AR_DENO FROM articulos LIMIT 3</sql>
- "5 técnicos" → <sql>SELECT TN_DENO FROM tecnicos LIMIT 5</sql>
- "4 almacenes" → <sql>SELECT AM_DENO FROM almacenes LIMIT 4</sql>
- "10 bandejas" → <sql>SELECT BN_DENO FROM bandejas LIMIT 10</sql>

IMPORTANTE: 
- Revisa la estructura de datos proporcionada para usar las columnas correctas
- SIEMPRE genera SQL válido, no te quedes sin responder
- Si no encuentras la tabla exacta, usa la más similar disponible

`;
    } else if (intencion.tipo === 'conversacion') {
        instrucciones += `RESPUESTAS CONVERSACIONALES:
- Habla como empleado conocedor de la empresa
- Usa información del archivo de conocimiento empresarial como GUÍA
- Sé específico sobre Semilleros Deitana cuando sea posible
- SIEMPRE responde de forma útil y completa
- Si no tienes información específica, explica el concepto general
- Pregunta qué más puede ayudar

`;
    }

    // Añadir contexto de memoria si existe
    if (contextoPinecone) {
        instrucciones += `CONTEXTO DE CONVERSACIONES PREVIAS:
${contextoPinecone}

`;
    }

    return instrucciones;
}

/**
 * Función principal: construye el prompt dinámico OPTIMIZADO
 * ELIMINA las 3 llamadas a OpenAI y las reduce a 0 para construcción
 */
async function construirPromptInteligente(mensaje, mapaERP, openaiClient, contextoPinecone = '', contextoDatos = '', modoDesarrollo = false) {
    console.log('🚀 [PROMPT-BUILDER] Construyendo prompt OPTIMIZADO sin llamadas IA...');
    console.log('🔍 [DEBUG] mapaERP recibido:', !!mapaERP, 'tipo:', typeof mapaERP);
    if (mapaERP) {
        console.log('🔍 [DEBUG] Claves del mapaERP:', Object.keys(mapaERP).slice(0, 10));
    }
    
    // 1. Analizar intención SIN IA (básico)
    const intencion = analizarIntencionBasica(mensaje);
    console.log('🎯 [PROMPT-BUILDER] Intención detectada:', intencion);
    
    // 2. Detectar tablas relevantes SIN IA (básico)  
    const tablasRelevantes = (intencion.tipo === 'sql' || intencion.tipo === 'rag_sql')
        ? detectarTablasRelevantesBasico(mensaje, mapaERP)
        : [];
    console.log('📊 [PROMPT-BUILDER] Tablas relevantes:', tablasRelevantes);
    
    // 3. Seleccionar modelo apropiado
    const configModelo = seleccionarModeloInteligente(intencion, tablasRelevantes);
    
    // 4. Construir contexto de mapaERP selectivo
    const contextoMapaERP = construirContextoMapaERP(tablasRelevantes, mapaERP);
    
    // 5. Construir instrucciones naturales
    const instruccionesNaturales = construirInstruccionesNaturales(intencion, tablasRelevantes, contextoPinecone);
    
    // 6. OBTENER CONOCIMIENTO RAG (solo para conversaciones y RAG+SQL)
    let contextoRAG = '';
    if (intencion.tipo === 'conversacion' || intencion.tipo === 'rag_sql') {
        try {
            console.log('🧠 [RAG] Recuperando conocimiento empresarial...');
            contextoRAG = await ragInteligente.recuperarConocimientoRelevante(mensaje, 'sistema');
            console.log('✅ [RAG] Conocimiento recuperado:', contextoRAG ? contextoRAG.length : 0, 'caracteres');
        } catch (error) {
            console.error('❌ [RAG] Error recuperando conocimiento:', error.message);
        }
    }
    
    // 7. Ensamblar prompt final
    let promptFinal = instruccionesNaturales;
    
    // Añadir conocimiento empresarial para conversaciones y RAG+SQL
    if (intencion.tipo === 'conversacion' || intencion.tipo === 'rag_sql') {
        promptFinal += `${promptBase}\n\n`;
    }
    
    // Añadir estructura de datos solo si es necesario
    if (contextoMapaERP) {
        promptFinal += `${contextoMapaERP}\n\n`;
    }
    
    // Añadir reglas SQL solo para consultas SQL
    if (intencion.tipo === 'sql' || intencion.tipo === 'rag_sql') {
        promptFinal += `${sqlRules}\n\n`;
    }
    
    // Añadir contexto RAG si existe
    if (contextoRAG) {
        promptFinal += `CONOCIMIENTO EMPRESARIAL RELEVANTE:\n${contextoRAG}\n\n`;
    }
    
    // Añadir contexto de datos previos si existe
    if (contextoDatos) {
        promptFinal += `DATOS DE CONTEXTO PREVIO:\n${contextoDatos}\n\n`;
    }
    
    console.log('✅ [PROMPT-BUILDER] Prompt optimizado construido');
    console.log('⚡ [PROMPT-BUILDER] Llamadas IA eliminadas: 3 → 0');
    console.log('🎯 [PROMPT-BUILDER] Modelo final:', configModelo.modelo);
    
    return {
        prompt: promptFinal,
        configModelo: configModelo,
        intencion: intencion,
        tablasRelevantes: tablasRelevantes,
        metricas: {
            usaIA: false, // YA NO USA IA PARA CONSTRUCCIÓN
            tablasDetectadas: tablasRelevantes.length,
            llamadasIA: 0, // CERO llamadas IA
            optimizado: true
        }
    };
}

module.exports = {
    construirPromptInteligente,
    analizarIntencionBasica,
    detectarTablasRelevantesBasico,
    seleccionarModeloInteligente
};