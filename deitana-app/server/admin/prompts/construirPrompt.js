// =====================================
// CONSTRUCTOR DINÁMICO DE PROMPTS OPTIMIZADO
// =====================================

const { promptBase } = require('./base');
const { sqlRules } = require('./sqlRules');
const { formatoRespuesta } = require('./formatoRespuesta');
const { ejemplosSQL, ejemplosConversacion } = require('./ejemplos');
const { comportamiento, comportamientoAsistente } = require('./comportamiento');
const { comportamientoChatGPT } = require('./comportamientoChatGPT');
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
        modelo: 'gpt-4o',
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
    // USAR EL NUEVO COMPORTAMIENTO CHATGPT COMPLETO
    let instrucciones = comportamientoChatGPT + '\n\n';
    
    // Agregar contexto específico de la empresa
    instrucciones += `
## 🏢 CONTEXTO EMPRESARIAL

Trabajas para **Semilleros Deitana**, empresa agrícola especializada en:
- 🌱 Producción de semillas de tomate
- 🍅 Cultivo y distribución de tomates
- 🔬 Investigación y desarrollo de variedades
- 🌿 Servicios de injertos y plántulas

Los usuarios son **empleados de la empresa** que necesitan información para su trabajo diario.

`;

    // Instrucciones específicas según el tipo de consulta
    if (intencion.tipo === 'rag_sql') {
        instrucciones += `
## 🎯 PROCESO PARA CONSULTAS TÉCNICAS (RAG + SQL):

### 📚 **1. Usa el conocimiento empresarial como base**
- El contexto de Pinecone contiene manuales y procedimientos
- Úsalo como GUÍA principal para explicar procesos y conceptos
- Siempre proporciona contexto antes de datos específicos

### 📊 **2. Complementa con datos SQL cuando sea útil**
- Si es apropiado, genera consulta SQL: \`<sql>SELECT...</sql>\`
- Usa EXACTAMENTE las columnas de la estructura de datos
- Explica qué muestra la consulta antes de generarla

### 🤝 **3. Combina ambas fuentes inteligentemente**
- Información de manuales + ejemplos reales de la base de datos
- Explica el "por qué" usando manuales
- Muestra el "qué" usando datos SQL

### ✅ **4. IMPORTANTE:**
- **SIEMPRE responde**, incluso sin información específica
- Si no hay datos exactos, explica el concepto general
- Ofrece alternativas y siguientes pasos
- Sé útil y completo, no restrictivo

`;
    } else if (intencion.tipo === 'sql') {
        instrucciones += `
## 📊 PROCESO PARA CONSULTAS DE DATOS:

### 🎯 **1. Genera consulta SQL apropiada**
- Usa estructura de datos proporcionada exactamente
- Formato: \`<sql>SELECT...</sql>\`
- Explica qué hace la consulta antes de generarla

### 📝 **2. Interpreta resultados de forma natural**
- No solo muestres datos, explica qué significan
- Proporciona contexto y análisis
- Sugiere acciones basadas en los resultados

`;
    } else {
        instrucciones += `
## 💬 PROCESO PARA CONVERSACIÓN GENERAL:

### 🧠 **1. Respuesta inteligente y completa**
- Usa tu conocimiento general sobre agricultura y semillas
- Relaciona con el contexto de Semilleros Deitana cuando sea relevante
- Proporciona ejemplos prácticos y actionables

### 🔄 **2. Mantén la conversación fluida**
- Ofrece seguir explorando temas relacionados
- Proporciona sugerencias útiles para el trabajo del usuario

`;
    }

    // Recordatorio final sobre formato
    instrucciones += `
## 🎨 RECORDATORIO FINAL DE FORMATO:

**OBLIGATORIO en cada respuesta:**
- 🏷️ **Título con emoji** relevante
- 📋 **Estructura organizada** con encabezados
- ✅ **Listas con emojis** para puntos clave
- 💡 **Blockquotes** para tips importantes
- 🔧 **Código formateado** cuando corresponda
- 📊 **Tablas** para comparaciones/datos
- 😊 **Emojis apropiados** al contexto
- 🤔 **Preguntas de seguimiento** útiles

**¡Sé exactamente como ChatGPT: útil, inteligente y visualmente atractivo!** 🚀
`;

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
    
    // 6. OBTENER CONOCIMIENTO RAG (solo cuando realmente se necesita)
    let contextoRAG = '';
    
    // Skip RAG para consultas conversacionales simples
    const consultasSimples = /(^hola|^hi|^buenos|^buenas|dime algo|cuéntame|cuentame|quién eres|quien eres|qué eres|que eres|sobre ti|acerca de ti|algo de ti|acerca tuyo|quien soy|quines eres)/i;
    const esConsultaSimple = consultasSimples.test(mensaje.trim());
    
    if ((intencion.tipo === 'conversacion' || intencion.tipo === 'rag_sql') && !esConsultaSimple) {
        try {
            console.log('🧠 [RAG] Recuperando conocimiento empresarial...');
            contextoRAG = await ragInteligente.recuperarConocimientoRelevante(mensaje, 'sistema');
            console.log('✅ [RAG] Conocimiento recuperado:', contextoRAG ? contextoRAG.length : 0, 'caracteres');
        } catch (error) {
            console.error('❌ [RAG] Error recuperando conocimiento:', error.message);
        }
    } else if (esConsultaSimple) {
        console.log('⚡ [OPTIMIZACIÓN] Consulta simple detectada - saltando RAG');
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