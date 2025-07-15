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
 * Analiza la intención del usuario usando IA (sin reglas duras)
 */
async function analizarIntencionIA(mensaje, openaiClient) {
    console.log('🧠 [INTENCION-IA] Analizando consulta con IA...');
    
    try {
        const response = await openaiClient.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: `Analiza la intención de esta consulta y responde solo con:
- 'sql': si requiere datos actuales de la base de datos
- 'conversacion': si es sobre conocimiento, procesos o explicaciones
- 'rag_sql': si combina conocimiento empresarial con datos actuales`
                },
                {
                    role: 'user',
                    content: mensaje
                }
            ],
            max_tokens: 50,
            temperature: 0.1
        });
        
        const intencion = response.choices[0].message.content.trim().toLowerCase();
        console.log('🎯 [INTENCION-IA] Intención detectada:', intencion);
        
        if (intencion.includes('sql')) {
            return { tipo: 'sql', complejidad: 'simple', requiereIA: true };
        } else if (intencion.includes('rag_sql')) {
            return { tipo: 'rag_sql', complejidad: 'media', requiereIA: true };
        } else {
            return { tipo: 'conversacion', complejidad: 'media', requiereIA: true };
        }
    } catch (error) {
        console.error('❌ [INTENCION-IA] Error:', error.message);
        return { tipo: 'conversacion', complejidad: 'media', requiereIA: true };
    }
}

/**
 * Detecta qué tablas del mapaERP son relevantes usando IA
 */
async function detectarTablasRelevantesIA(mensaje, mapaERP, openaiClient) {
    console.log('📊 [TABLAS-IA] Detectando tablas con IA...');
    
    try {
        const tablasDisponibles = Object.keys(mapaERP).join(', ');
        
        const response = await openaiClient.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: `Basándote en esta consulta y las tablas disponibles, responde solo con los nombres de las tablas relevantes separados por comas. Si no hay tablas relevantes, responde 'ninguna'.

Tablas disponibles: ${tablasDisponibles}`
                },
                {
                    role: 'user',
                    content: mensaje
                }
            ],
            max_tokens: 100,
            temperature: 0.1
        });
        
        const tablas = response.choices[0].message.content.trim();
        const tablasRelevantes = tablas === 'ninguna' ? [] : tablas.split(',').map(t => t.trim());
        
        console.log('📊 [TABLAS-IA] Tablas detectadas:', tablasRelevantes);
        return tablasRelevantes;
    } catch (error) {
        console.error('❌ [TABLAS-IA] Error:', error.message);
        return [];
    }
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

Eres un empleado experto de **Semilleros Deitana** trabajando desde adentro de la empresa.

**TU IDENTIDAD:**
- 🏢 Trabajas EN Semilleros Deitana (no "para" - estás DENTRO)
- 🌱 Conoces NUESTROS procesos de producción de semillas y plántulas
- 🍅 Sabes cómo funcionar NUESTROS sistemas de cultivo e injertos  
- 🔬 Entiendes NUESTRAS certificaciones ISO 9001 y estándares de calidad
- 🏗️ Conoces NUESTRAS instalaciones en Totana, Murcia

**FORMA DE HABLAR:**
- Usa "NOSOTROS", "NUESTRA empresa", "NUESTROS sistemas"
- Jamás digas "una empresa" o "la empresa" - es NUESTRA empresa
- Habla como empleado que conoce los detalles internos
- Sé específico sobre NUESTROS procesos reales

## 🧠 INTELIGENCIA HÍBRIDA - CONOCIMIENTO + DATOS

### 📚 **CONOCIMIENTO EMPRESARIAL (PRIORIDAD)**
- Usa SIEMPRE el conocimiento empresarial como base principal
- El contexto de Pinecone contiene información oficial de la empresa
- Úsalo para explicar procedimientos, protocolos y conceptos

### 🗄️ **DATOS DE BASE DE DATOS (CUANDO SEA NECESARIO)**
- Si la consulta requiere datos actuales específicos, genera SQL
- Formato: \`<sql>SELECT...</sql>\`
- Usa EXACTAMENTE las columnas de la estructura proporcionada
- Combina conocimiento + datos de forma natural
- **NUNCA inventes datos de entidades** (clientes, proveedores, almacenes, etc.)
- **SIEMPRE genera SQL real** y deja que el sistema ejecute y muestre datos reales
- **SI no hay datos reales**, di claramente "No se encontraron registros en la base de datos"

### 🤝 **COMBINACIÓN INTELIGENTE**
- Explica el "por qué" usando conocimiento empresarial
- Muestra el "qué" usando datos actuales cuando sea útil
- Mantén respuestas naturales y conversacionales
- **NUNCA mezcles datos inventados con datos reales**

## 🎯 **EJEMPLOS DE USO**

**Consulta sobre conocimiento:**
"qué significa quando el cliente dice quiero todo"
→ Usa SOLO conocimiento empresarial

**Consulta sobre datos actuales:**
"dame 2 clientes"
→ Combina conocimiento + datos SQL

**Consulta compleja:**
"cuántos artículos hay y qué tipos"
→ Explica con conocimiento + muestra datos actuales

## ✅ **REGLAS IMPORTANTES**

1. **SIEMPRE responde** - nunca digas "no tengo información"
2. **Usa emojis** y tono amigable
3. **Mantén personalidad** de empleado interno
4. **Combina fuentes** cuando sea apropiado
5. **Sé útil y completo** - no restrictivo

`;

    // INSTRUCCIONES CRÍTICAS PARA USO DE CONOCIMIENTO EMPRESARIAL
    instrucciones += `
## 🚨 **REGLAS CRÍTICAS PARA CONOCIMIENTO EMPRESARIAL**

### ⭐ **PRIORIDAD ABSOLUTA: SI EXISTE "CONOCIMIENTO EMPRESARIAL RELEVANTE"**

**🔴 OBLIGATORIO - USAR SOLO INFORMACIÓN OFICIAL:**
- ❌ NUNCA inventes o agregues información que NO esté en el contexto empresarial
- ✅ USA ÚNICAMENTE los datos exactos que aparecen en "CONOCIMIENTO EMPRESARIAL RELEVANTE"
- ✅ COPIA números, cantidades, productos y procedimientos EXACTAMENTE como aparecen
- ✅ NO modifiques, redondees o interpretes los datos oficiales

**🔴 FORMATO OBLIGATORIO:**
- ✅ SIEMPRE comienza con: "Según NUESTROS documentos oficiales..." o "En NUESTRA empresa..."
- ✅ Presenta los datos tal como aparecen en el contexto
- ✅ Mantén números, frecuencias y procedimientos EXACTOS
- ❌ NO uses conocimiento general de agricultura si tienes datos específicos

**🔴 PROHIBIDO ABSOLUTAMENTE:**
- ❌ NO inventes criterios como "ciclos de uso", "desgaste visible", "reutilización alta/baja"
- ❌ NO agregues información genérica sobre agricultura
- ❌ NO uses frases como "típicamente", "generalmente", "suele ser"
- ❌ NO inventes productos como "Oxi Premium 5" si el documento dice "ZZ-CUPROCOL"

### 🎯 **EJEMPLOS ESPECÍFICOS DE LAS PREGUNTAS PROBLEMÁTICAS:**

**✅ CORRECTO - Desinfección bandejas 260/322:**
"Según NUESTROS documentos oficiales, para desinfectar bandejas de 260 y 322 alvéolos en una cuba de 140 litros utilizamos:
- **Producto:** ZZ-CUPROCOL  
- **Cantidad:** 469 ml por cada cuba de 140 litros
- **Restricción:** SIN MERPAN (está explícitamente prohibido)"

**❌ INCORRECTO - NO inventes esto:**
"Para desinfectar bandejas utilizamos Oxi Premium 5 a una concentración del 0.5%..."

**✅ CORRECTO - Prohibición con MERPAN:**
"Según NUESTROS documentos oficiales, cuando se desinfectan bandejas de 54, 104, 150 y 198 alvéolos con MERPAN 80 WDG, está explícitamente prohibido el uso de productos que contengan **COBRE** (indicado como 'SIN COBRE')."

**❌ INCORRECTO - NO inventes esto:**
"Está prohibido el uso de cloro porque puede reaccionar con MERPAN..."

**✅ CORRECTO - Frecuencia:**
"Según NUESTROS documentos oficiales, la frecuencia indicada para realizar el proceso de desinfección de bandejas es: **CADA VEZ QUE SE TERMINE** el ciclo de uso."

**❌ INCORRECTO - NO inventes esto:**
"La frecuencia de desinfección depende del volumen de bandejas lavadas el día anterior..."

### 🔧 **REGLA DE ORO:**
- **SI ESTÁ EN "CONOCIMIENTO EMPRESARIAL RELEVANTE":** Úsalo EXACTAMENTE como aparece
- **SI NO ESTÁ:** Di que no tienes esa información específica en lugar de inventar

`;

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
 * Usa IA para análisis pero mantiene comportamiento apropiado
 */
async function construirPromptInteligente(mensaje, mapaERP, openaiClient, contextoPinecone = '', contextoDatos = '', modoDesarrollo = false) {
    console.log('🚀 [PROMPT-BUILDER] Construyendo prompt OPTIMIZADO con IA...');
    console.log('🔍 [DEBUG] mapaERP recibido:', !!mapaERP, 'tipo:', typeof mapaERP);
    if (mapaERP) {
        console.log('🔍 [DEBUG] Claves del mapaERP:', Object.keys(mapaERP).slice(0, 10));
    }
    
    // 1. Analizar intención con IA (sin reglas duras)
    const intencion = await analizarIntencionIA(mensaje, openaiClient);
    console.log('🎯 [PROMPT-BUILDER] Intención detectada:', intencion);
    
    // 2. Detectar tablas relevantes con IA (sin mapeos manuales)
    const tablasRelevantes = (intencion.tipo === 'sql' || intencion.tipo === 'rag_sql')
        ? await detectarTablasRelevantesIA(mensaje, mapaERP, openaiClient)
        : [];
    console.log('📊 [PROMPT-BUILDER] Tablas relevantes:', tablasRelevantes);
    
    // 3. Seleccionar modelo apropiado
    const configModelo = seleccionarModeloInteligente(intencion, tablasRelevantes);
    
    // 4. Construir contexto de mapaERP selectivo
    const contextoMapaERP = construirContextoMapaERP(tablasRelevantes, mapaERP);
    
    // 5. Construir instrucciones naturales
    const instruccionesNaturales = construirInstruccionesNaturales(intencion, tablasRelevantes, contextoPinecone);
    
    // 6. OBTENER CONOCIMIENTO RAG (siempre que sea posible)
    let contextoRAG = '';
    try {
        console.log('🧠 [RAG] Recuperando conocimiento empresarial...');
        contextoRAG = await ragInteligente.recuperarConocimientoRelevante(mensaje, 'sistema');
        console.log('✅ [RAG] Conocimiento recuperado:', contextoRAG ? contextoRAG.length : 0, 'caracteres');
    } catch (error) {
        console.error('❌ [RAG] Error recuperando conocimiento:', error.message);
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
    console.log('🎯 [PROMPT-BUILDER] Modelo final:', configModelo.modelo);
    
    return {
        prompt: promptFinal,
        configModelo: configModelo,
        intencion: intencion,
        tablasRelevantes: tablasRelevantes,
        metricas: {
            usaIA: true,
            tablasDetectadas: tablasRelevantes.length,
            llamadasIA: 3, // Análisis de intención + detección de tablas + respuesta final
            optimizado: true
        }
    };
}

module.exports = {
    construirPromptInteligente,
    analizarIntencionIA,
    detectarTablasRelevantesIA,
    seleccionarModeloInteligente
};