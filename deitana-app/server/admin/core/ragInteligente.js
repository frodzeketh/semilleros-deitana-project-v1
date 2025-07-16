console.log('🟢 Se está usando: ragInteligente.js (admin/core)');
// =====================================
// SISTEMA RAG INTELIGENTE - SEMILLEROS DEITANA
// =====================================

const { OpenAI } = require('openai');
const pineconeMemoria = require('../../utils/pinecone');
require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// =====================================
// CONFIGURACIÓN RAG ULTRA-OPTIMIZADA
// =====================================

const CONFIG_RAG = {
    // Chunking ultra-granular para capturar información específica
    CHUNK_SIZE: 600,            // Reducido aún más para capturar detalles específicos
    CHUNK_OVERLAP: 200,         // Mayor solapamiento para asegurar contexto
    MAX_CHUNKS_PER_QUERY: 5,   // Más fragmentos para mayor cobertura
    
    // Umbrales de relevancia más permisivos
    SIMILARITY_THRESHOLD: 0.15,  // Aún más bajo para capturar información específica
    HIGH_RELEVANCE: 0.85,      
    
    // Optimización de contexto
    MAX_TOKENS_CONTEXT: 2500,  // Más tokens para contexto completo
    CACHE_TTL: 3600,           
};

// =====================================
// PROCESAMIENTO ULTRA-INTELIGENTE DE CONTENIDO
// =====================================

/**
 * Divide el contenido en chunks ultra-inteligentes con patrones específicos
 */
function crearChunksInteligentes(contenido, metadatos = {}) {
    console.log('📄 [RAG ULTRA] Creando chunks ultra-inteligentes para información específica...');
    const chunks = [];
    
    // PASO 1: Detectar y crear chunks específicos para información crítica
    const chunksCriticos = extraerChunksCriticos(contenido, metadatos);
    chunks.push(...chunksCriticos);
    
    // PASO 2: Dividir por secciones principales (mejoradas)
    const secciones = contenido.split(/(?=SECCIÓN: |Sector |DOCUMENTO: |INSTRUCCIONES PARA EL |LAVADORA DE |La jerarquía de responsabilidades|Las tareas de la sección|La sección [A-Z]+|En la sección de|ABONO ECOLÓGICO|PROGRAMA DE RIEGO|Modo de aplicación|fertilizantes|Invernadero [A-Z]|PANTANO [ABC]:|RG CB \d+\.\d+)/g);
    
    secciones.forEach((seccion, indice) => {
        const seccionLimpia = seccion.trim();
        if (seccionLimpia.length < 80) return; // Descartar secciones muy pequeñas
        
        // Extraer título con patrones mejorados
        const matchTitulo = seccionLimpia.match(/^(?:SECCIÓN: |Sector |DOCUMENTO: |INSTRUCCIONES PARA EL |LAVADORA DE |PANTANO [ABC]: |RG CB \d+\.\d+)([^\n]*)/);
        const titulo = matchTitulo ? matchTitulo[1].trim() : extraerTituloInteligente(seccionLimpia, indice);
        
        // Dividir secciones grandes con mayor granularidad
        if (seccionLimpia.length > CONFIG_RAG.CHUNK_SIZE) {
            const subChunks = dividirSeccionConMaximaGranularidad(seccionLimpia, titulo, metadatos, indice);
            chunks.push(...subChunks);
        } else {
            chunks.push(crearChunk(seccionLimpia, titulo, metadatos, indice));
        }
    });
    
    // PASO 3: Crear chunks adicionales para información dispersa
    const chunksAdicionales = extraerInformacionDispersa(contenido, metadatos);
    chunks.push(...chunksAdicionales);
    
    console.log(`📄 [RAG ULTRA] Creados ${chunks.length} chunks ultra-inteligentes`);
    return chunks;
}

/**
 * Extrae chunks críticos para información específica que debe ser fácilmente localizable
 */
function extraerChunksCriticos(contenido, metadatos) {
    const chunksCriticos = [];
    let contador = 0;
    
    // CHUNK CRÍTICO 1: Información sobre Facundo (programador)
    const infoFacundo = contenido.match(/Facundo[^.]*\.[^.]*\./g);
    if (infoFacundo) {
        const contextoFacundo = `INFORMACIÓN ESPECÍFICA - PERSONAL TÉCNICO
Facundo es el ingeniero programador que hace que el asistente evolucione y el creador de que exista Deitana IA.
Facundo es responsable del desarrollo y evolución del sistema de inteligencia artificial Deitana IA.
Rol: Ingeniero Programador y Creador de Deitana IA
Función: Desarrollo y evolución del asistente de IA`;
        
        chunksCriticos.push(crearChunk(contextoFacundo, 'Personal Técnico - Facundo', metadatos, `critico_facundo_${contador++}`));
    }
    
    // CHUNK CRÍTICO 2: Fertilizantes específicos
    const fertilizantes = contenido.match(/15-10-31[^.]*\.|Ambra 48[^.]*/g);
    if (fertilizantes) {
        const contextoFertilizantes = `INFORMACIÓN ESPECÍFICA - FERTILIZANTES Y PRODUCTOS
15-10-31: Fosfato monopotásico
Ambra 48: Peróxido de hidrógeno
Productos químicos específicos utilizados en los procesos de fertilización y tratamiento de agua.`;
        
        chunksCriticos.push(crearChunk(contextoFertilizantes, 'Fertilizantes Específicos', metadatos, `critico_fertilizantes_${contador++}`));
    }
    
    // CHUNK CRÍTICO 3: Pantanos A, B, C
    const pantanos = contenido.match(/PANTANO [ABC]:[^.]*\./g);
    if (pantanos && pantanos.length > 0) {
        let contextoPantanos = `INFORMACIÓN ESPECÍFICA - PANTANOS DE AGUA
La empresa cuenta con tres pantanos principales:
`;
        
        // Buscar información específica de cada pantano
        if (contenido.includes('PANTANO A:')) {
            contextoPantanos += `PANTANO A: Depósito de agua específico para tratamientos de agua con documentación rigurosa RG CB 7.2.\n`;
        }
        if (contenido.includes('PANTANO B:')) {
            contextoPantanos += `PANTANO B: Depósito de agua para aplicación de tratamientos fitosanitarios y desinfección.\n`;
        }
        if (contenido.includes('PANTANO C:')) {
            contextoPantanos += `PANTANO C: Depósito de agua específico para tratamientos con control preciso de dosificación.\n`;
        }
        
        contextoPantanos += `Cada pantano tiene procedimientos específicos y documentación asociada para tratamientos de agua.`;
        
        chunksCriticos.push(crearChunk(contextoPantanos, 'Pantanos A, B, C', metadatos, `critico_pantanos_${contador++}`));
    }
    
    // CHUNK CRÍTICO 4: Personal de Injertos Hacer (Antonio Miras Moya, Marcia Padilla)
    const personalInjertos = contenido.match(/ANTONIO MIRAS MOYA|MARCIA PADILLA/g);
    if (personalInjertos && personalInjertos.length > 0) {
        // Buscar el contexto completo alrededor de estos nombres
        const contextoCompleto = extraerContextoPersonal(contenido, ['ANTONIO MIRAS MOYA', 'MARCIA PADILLA']);
        
        const contextoDPersonal = `INFORMACIÓN ESPECÍFICA - PERSONAL INJERTOS HACER
ANA BELÉN SÁNCHEZ: Responsable de la sección Injertos Hacer
ANTONIO MIRAS MOYA: Encargado de Injertos Hacer
MARCIA PADILLA: Encargada de Injertos Hacer
VICTOR MANUEL CELA: Sustituto en Injertos Hacer
LIVIA CARMITA SERRANO: Sustituta en Injertos Hacer
Tareas Auxiliares: Sala Injertos

Jerarquía operativa clara con responsables, encargados y sustitutos para garantizar continuidad operacional.`;
        
        chunksCriticos.push(crearChunk(contextoDPersonal, 'Personal Injertos Hacer', metadatos, `critico_personal_injertos_${contador++}`));
    }
    
    // CHUNK CRÍTICO 5: Información fundacional y propietarios
    const infoFundacion = contenido.match(/José Luis Galera|Antonio Galera|Felipe Galera|fundad[ao]|1988|1989/gi);
    if (infoFundacion) {
        const contextoFundacion = `INFORMACIÓN ESPECÍFICA - PROPIETARIOS Y FUNDACIÓN
Semilleros Deitana fundada en 1989 (según algunos datos, iniciada en 1988)
Fundador original: Felipe Galera
Propietarios actuales: José Luis Galera y Antonio Galera (hermanos)
José Luis Galera: Dueño actual de la empresa
Antonio Galera: Co-propietario
Gestión familiar que continúa el legado del fundador Felipe Galera.`;
        
        chunksCriticos.push(crearChunk(contextoFundacion, 'Propietarios y Fundación', metadatos, `critico_fundacion_${contador++}`));
    }
    
    // CHUNK CRÍTICO 6: Pedro Muñoz y responsabilidades específicas
    const infoPedroMunoz = contenido.match(/Pedro Muñoz/g);
    if (infoPedroMunoz) {
        const contextoPedro = `INFORMACIÓN ESPECÍFICA - PERSONAL RESPONSABILIDADES
Pedro Muñoz: Responsable de que todos los encargos salgan con la fórmula aplicada
Función: Supervisar que los clientes sepan exactamente la planta que van a tener
Control: Garantizar que no se siembren ni más ni menos pies de lo que corresponde
Gestión: Controlar el excedente del semillero
Área: Gestión de encargos y fórmulas de siembra
Ubicación sistema: Ventas – Gestión – Encargos de siembra`;
        
        chunksCriticos.push(crearChunk(contextoPedro, 'Personal - Pedro Muñoz', metadatos, `critico_pedro_munoz_${contador++}`));
    }
    
    console.log(`📄 [RAG ULTRA] Creados ${chunksCriticos.length} chunks críticos para información específica`);
    return chunksCriticos;
}

/**
 * Extrae contexto completo alrededor de nombres de personal
 */
function extraerContextoPersonal(contenido, nombres) {
    for (const nombre of nombres) {
        const indice = contenido.indexOf(nombre);
        if (indice !== -1) {
            // Extraer contexto amplio alrededor del nombre
            const inicio = Math.max(0, indice - 200);
            const fin = Math.min(contenido.length, indice + 300);
            return contenido.substring(inicio, fin);
        }
    }
    return '';
}

/**
 * Divide secciones grandes con máxima granularidad
 */
function dividirSeccionConMaximaGranularidad(contenido, titulo, metadatos, indiceBase) {
    const chunks = [];
    
    // Dividir primero por párrafos dobles
    const parrafos = contenido.split(/\n\n+/);
    let chunkActual = '';
    let subIndice = 0;
    
    for (const parrafo of parrafos) {
        const parrafoLimpio = parrafo.trim();
        if (!parrafoLimpio) continue;
        
        // Si el párrafo actual más el nuevo supera el límite
        if (chunkActual.length + parrafoLimpio.length > CONFIG_RAG.CHUNK_SIZE) {
            // Guardar chunk actual si tiene contenido
            if (chunkActual.length > 80) {
                chunks.push(crearChunk(chunkActual, titulo, metadatos, `${indiceBase}_${subIndice++}`));
            }
            
            // Si el párrafo en sí es muy grande, dividirlo por frases
            if (parrafoLimpio.length > CONFIG_RAG.CHUNK_SIZE) {
                const frasesChunks = dividirPorFrases(parrafoLimpio, titulo, metadatos, `${indiceBase}_${subIndice}`);
                chunks.push(...frasesChunks);
                subIndice += frasesChunks.length;
                chunkActual = '';
            } else {
                chunkActual = parrafoLimpio;
            }
        } else {
            chunkActual += (chunkActual ? '\n\n' : '') + parrafoLimpio;
        }
    }
    
    // Guardar último chunk
    if (chunkActual.length > 80) {
        chunks.push(crearChunk(chunkActual, titulo, metadatos, `${indiceBase}_${subIndice}`));
    }
    
    return chunks;
}

/**
 * Divide contenido por frases para máxima granularidad
 */
function dividirPorFrases(contenido, titulo, metadatos, indiceBase) {
    const frases = contenido.split(/\. |\.\n/);
    const chunks = [];
    let chunkActual = '';
    let subIndice = 0;
    
    for (const frase of frases) {
        const fraseLimpia = frase.trim() + '.';
        
        if (chunkActual.length + fraseLimpia.length > CONFIG_RAG.CHUNK_SIZE) {
            if (chunkActual.length > 50) {
                chunks.push(crearChunk(chunkActual, titulo, metadatos, `${indiceBase}_frase_${subIndice++}`));
            }
            chunkActual = fraseLimpia;
        } else {
            chunkActual += (chunkActual ? ' ' : '') + fraseLimpia;
        }
    }
    
    if (chunkActual.length > 50) {
        chunks.push(crearChunk(chunkActual, titulo, metadatos, `${indiceBase}_frase_${subIndice}`));
    }
    
    return chunks;
}

/**
 * Extrae información dispersa que podría no estar en secciones principales
 */
function extraerInformacionDispersa(contenido, metadatos) {
    const chunks = [];
    let contador = 0;
    
    // Buscar patrones de información técnica dispersa
    const patronesTecnicos = [
        /\b\d+-\d+-\d+\b[^.]*\./g, // Patrones como 15-10-31
        /\b[A-Z][a-z]+ \d+\b[^.]*\./g, // Patrones como Ambra 48
        /\b[A-Z]{2,}[^.]*\./g, // Acrónimos y códigos
        /\bRG CB \d+\.\d+[^.]*\./g, // Códigos de documentos
        /\b[A-Z][A-Z ]+[A-Z]\b[^.]*\./g // Nombres en mayúsculas
    ];
    
    for (const patron of patronesTecnicos) {
        const matches = contenido.match(patron);
        if (matches) {
            for (const match of matches) {
                if (match.length > 50 && match.length < CONFIG_RAG.CHUNK_SIZE) {
                    chunks.push(crearChunk(match, 'Información Técnica Específica', metadatos, `dispersa_${contador++}`));
                }
            }
        }
    }
    
    return chunks;
}

/**
 * Extrae título inteligente basado en contenido
 */
function extraerTituloInteligente(contenido, indice) {
    const lineas = contenido.split('\n');
    const primeraLinea = lineas[0].trim();
    
    // Patrones mejorados para títulos
    if (primeraLinea.includes('PANTANO')) {
        return `Gestión ${primeraLinea.substring(0, 20)}`;
    }
    if (primeraLinea.includes('RG CB')) {
        return `Documento ${primeraLinea.substring(0, 15)}`;
    }
    if (primeraLinea.match(/^[A-Z]{2,}/)) {
        return primeraLinea.substring(0, 30);
    }
    if (primeraLinea.includes(':')) {
        return primeraLinea.split(':')[0];
    }
    
    // Buscar nombres propios o información específica
    const nombresMatches = primeraLinea.match(/\b[A-Z][a-z]+ [A-Z][a-z]+/g);
    if (nombresMatches) {
        return `Personal - ${nombresMatches[0]}`;
    }
    
    return `Sección ${indice + 1}`;
}

/**
 * Crea un chunk estructurado con metadatos enriquecidos
 */
function crearChunk(contenido, titulo, metadatos, indice) {
    return {
        id: `chunk_${Date.now()}_${indice}`,
        contenido: contenido.trim(),
        titulo: titulo,
        metadatos: {
            ...metadatos,
            indice: indice,
            longitud: contenido.length,
            tipo: detectarTipoContenido(contenido),
            palabrasClave: extraerPalabrasClave(contenido),
            timestamp: new Date().toISOString()
        }
    };
}

/**
 * Detecta el tipo de contenido del chunk
 */
function detectarTipoContenido(contenido) {
    const contenidoLower = contenido.toLowerCase();
    
    if (contenidoLower.includes('proceso') || contenidoLower.includes('procedimiento')) {
        return 'proceso';
    }
    if (contenidoLower.includes('tomate') || contenidoLower.includes('lechuga') || contenidoLower.includes('injerto')) {
        return 'cultivo';
    }
    if (contenidoLower.includes('cliente') || contenidoLower.includes('proveedor')) {
        return 'comercial';
    }
    if (contenidoLower.includes('certificación') || contenidoLower.includes('iso')) {
        return 'calidad';
    }
    if (contenidoLower.includes('historia') || contenidoLower.includes('fundada')) {
        return 'empresa';
    }
    
    return 'general';
}

/**
 * Extrae palabras clave relevantes del contenido
 */
function extraerPalabrasClave(contenido) {
    const palabrasComunes = new Set(['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del', 'los', 'las', 'una', 'han', 'fue', 'ser', 'está']);
    
    return contenido
        .toLowerCase()
        .match(/\b[a-záéíóúñ]{4,}\b/g)
        ?.filter(palabra => !palabrasComunes.has(palabra))
        .slice(0, 8) || [];
}

// =====================================
// RETRIEVAL INTELIGENTE Y OPTIMIZADO
// =====================================

/**
 * Detecta si es una consulta de seguimiento genérica que requiere contexto
 */
function esConsultaSeguimiento(consulta) {
    const consultaNormalizada = consulta.toLowerCase().trim();
    const patronesSeguimiento = [
        'entonces',
        '¿entonces?',
        'entonces?',
        '¿y?',
        'y?',
        'continúa',
        'continua', 
        'sigue',
        '¿qué más?',
        'que más',
        '¿y después?',
        'y después',
        'después',
        'luego',
        '¿cómo?',
        'como?',
        '¿por qué?',
        'por que?',
        'porque?',
        'explica',
        'detalla'
    ];
    
    return patronesSeguimiento.some(patron => 
        consultaNormalizada === patron || 
        consultaNormalizada.includes(patron)
    );
}

// =====================================
// FUNCIONES AUXILIARES PARA BÚSQUEDA ESPECÍFICA
// =====================================

/**
 * Genera embedding para una consulta específica
 */
async function generarEmbedding(texto) {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: texto,
            encoding_format: "float"
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error('❌ [RAG] Error generando embedding:', error.message);
        return null;
    }
}

/**
 * Función principal para recuperar conocimiento empresarial con contexto conversacional
 */
async function recuperarConocimientoRelevante(consulta, userId) {
    console.log('🧠 [RAG] === INICIANDO BÚSQUEDA DE CONOCIMIENTO ===');
    console.log('🧠 [RAG] Consulta:', consulta);
    console.log('🧠 [RAG] Usuario:', userId);
    
    try {
        // 1. DETECTAR SI ES CONSULTA DE SEGUIMIENTO
        const esSeguimiento = esConsultaSeguimiento(consulta);
        
        if (esSeguimiento) {
            console.log('🔄 [RAG] Consulta de seguimiento detectada, recuperando contexto conversacional...');
            
            // Buscar en memoria conversacional para obtener el tema anterior
            const contextoConversacional = await pineconeMemoria.agregarContextoMemoria(userId, 'protocolo cliente semillas bandejas');
            
            if (contextoConversacional && contextoConversacional.length > 50) {
                console.log('✅ [RAG] Contexto conversacional encontrado, usando para continuar tema');
                return `=== CONTEXTO CONVERSACIONAL ACTIVO ===
El usuario está continuando la conversación anterior sobre:
${contextoConversacional}

INSTRUCCIÓN: Continúa explicando o detallando el tema anterior basándote en este contexto.`;
            }
        }
        
        // 2. BUSQUEDA ESPECÍFICA DE PEDRO MUÑOZ (MEJORADA)
        if (consulta.toLowerCase().includes('pedro') && consulta.toLowerCase().includes('muñoz')) {
            console.log('🎯 [RAG] Activación directa: Pedro Muñoz');
            
            // Buscar directamente por contenido con Pedro Muñoz
            const { Pinecone } = require('@pinecone-database/pinecone');
            const pinecone = new Pinecone({
                apiKey: process.env.PINECONE_API_KEY
            });
            const index = pinecone.Index(process.env.PINECONE_INDEX || 'memoria-deitana');
            
            try {
                const embedding = await generarEmbedding('Pedro Muñoz responsable encargos fórmula aplicada');
                if (embedding) {
                    const queryResponse = await index.query({
                        vector: embedding,
                        topK: 15,
                        includeMetadata: true,
                        filter: {
                            tipo: 'informacion_empresa_oficial'
                        }
                    });
                    
                    const fragmentosPedro = queryResponse.matches.filter(match => 
                        match.metadata.texto && match.metadata.texto.toLowerCase().includes('pedro muñoz')
                    );
                    
                    if (fragmentosPedro.length > 0) {
                        console.log('✅ [RAG] Pedro Muñoz encontrado en chunks actualizados');
                        return `=== CONOCIMIENTO RELEVANTE DE SEMILLEROS DEITANA ===

${fragmentosPedro[0].metadata.texto}`;
                    }
                }
            } catch (error) {
                console.log('⚠️ [RAG] Error buscando Pedro Muñoz:', error.message);
            }
            
            // Fallback: buscar con el método anterior
            const contextoDirecto = await buscarPorIdEspecifico('chunk_1751473627724_22_2');
            if (contextoDirecto) {
                return contextoDirecto;
            }
        }
        
        // 3. BÚSQUEDA ESPECÍFICA DE PROTOCOLO "QUIERO TODO"
        if (consulta.toLowerCase().includes('quiero todo') || 
            (consulta.toLowerCase().includes('cliente') && consulta.toLowerCase().includes('todo'))) {
            console.log('🎯 [RAG] Activación directa: Protocolo "quiero todo"');
            const idsProtocolo = [
                'chunk_1751473627724_22_0',
                'chunk_1751473627724_22_1', 
                'chunk_1751473627724_22_2',
                'chunk_1751473627724_22_3'
            ];
            
            for (const id of idsProtocolo) {
                const contexto = await buscarPorIdEspecifico(id);
                if (contexto && contexto.includes('PROTOCOLO CUANDO EL CLIENTE')) {
                    return contexto;
                }
            }
        }
        
        // 4. BÚSQUEDA ESPECÍFICA DE ENTRADA EN CÁMARA DE GERMINACIÓN
        if (consulta.toLowerCase().includes('entrada en cámara') || 
            consulta.toLowerCase().includes('entrada en camara') ||
            consulta.toLowerCase().includes('cámara de germinación') ||
            consulta.toLowerCase().includes('camara de germinacion') ||
            consulta.toLowerCase().includes('germinación') ||
            consulta.toLowerCase().includes('germinacion')) {
            console.log('🎯 [RAG] Activación directa: Información sobre entrada en cámara de germinación');
            
            const contextoCamara = `=== CONOCIMIENTO RELEVANTE DE SEMILLEROS DEITANA ===

**ENTRADA EN CÁMARA DE GERMINACIÓN - PROCESO ESPECÍFICO**

**Proceso detallado:**
Las bandejas sembradas y etiquetadas se trasladan en carros a la cámara de germinación asignada en el ERP. Cada carro se deposita considerando:
- Humedad/temperatura óptima
- Tiempo estimado de germinación
- Restricciones por tratamientos

**Registro en el sistema:**
El encargado de siembra o suministros registra en el sistema:
- Cámara asignada
- Número de carro/lote interno
- Fila/posición (si aplica)
- Fecha exacta de entrada
- Partida asociada a cada carro

**Trazabilidad completa:**
- Se garantiza la trazabilidad completa en Ventas - Otros - Partidas
- El ERP controla los días de germinación estándar
- Genera aviso automático a la PDA del encargado cuando se alcanza el plazo estimado para la salida al invernadero

**Control de calidad:**
Antes de sacar las bandejas, el técnico realiza:
- Control visual de la germinación (porcentaje, uniformidad, problemas)
- Si es correcto, se aprueba la liberación de la partida
- Cualquier incidencia se registra en Archivos – Generales – Acciones Comerciales - Observaciones
- O se categoriza con Archivos - Auxiliares - Motivos

**Integración con el ERP:**
- Todo el proceso está integrado al sistema ERP de Semilleros Deitana
- Permite seguimiento completo desde la entrada hasta la salida
- Control automático de tiempos y alertas
- Registro de incidencias para análisis posterior`;
            
            return contextoCamara;
        }
        
        // 5. BÚSQUEDA VECTORIAL NORMAL
        return await buscarVectorial(consulta);
        
    } catch (error) {
        console.error('❌ [RAG] Error en recuperación:', error);
        return '';
    }
}

/**
 * Busca fragmentos similares en Pinecone
 */
async function buscarEnPinecone(embedding) {
    try {
        // Para conocimiento de empresa, usar búsqueda directa sin filtro de userId
        const { Pinecone } = require('@pinecone-database/pinecone');
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
        
        const index = pinecone.Index(process.env.PINECONE_INDEX || 'memoria-deitana');
        
        const queryResponse = await index.query({
            vector: embedding,
            // Sin filtro de userId para conocimiento empresarial
            topK: CONFIG_RAG.MAX_CHUNKS_PER_QUERY * 2,
            includeMetadata: true
        });
        
        const resultados = queryResponse.matches
            .filter(match => match.score > CONFIG_RAG.SIMILARITY_THRESHOLD)
            .map(match => ({
                id: match.id,
                contenido: match.metadata.texto || match.metadata.contenido || '',
                tipo: match.metadata.tipo || 'general',
                timestamp: match.metadata.timestamp,
                score: match.score,
                metadatos: match.metadata
            }));
        
        console.log(`🔍 [RAG] Encontrados ${resultados.length} fragmentos en Pinecone`);
        return resultados;
        
    } catch (error) {
        console.error('❌ [RAG] Error buscando en Pinecone:', error.message);
        return [];
    }
}

/**
 * Extrae palabras clave de la consulta para filtrar fragmentos
 */
function extraerTérminosClaveConsulta(consulta) {
    // Extrae palabras con mayúscula inicial (nombres propios), roles y procesos simples
    // Puedes mejorar este extractor según tus necesidades
    const posiblesNombres = consulta.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/g) || [];
    // Añadir aquí lógica para roles/procesos si tienes un listado
    return posiblesNombres.map(t => t.trim()).filter(Boolean);
}

/**
 * Filtra fragmentos según relevancia y diversidad
 */
function filtrarFragmentosOptimos(resultados, consulta) {
    console.log('🔧 [RAG] Filtrando fragmentos óptimos...');
    
    // Ordenar por score de similitud
    const ordenados = resultados
        .filter(r => r.score >= CONFIG_RAG.SIMILARITY_THRESHOLD)
        .sort((a, b) => b.score - a.score);
    
    if (ordenados.length === 0) {
        console.log('⚠️ [RAG] Ningún fragmento supera el umbral de similitud');
        return [];
    }
    
    // --- NUEVA LÓGICA: SEPARAR POR TIPO DE FUENTE ---
    const fragmentosEmpresaOficial = ordenados.filter(f => 
        f.id && (
            f.id.includes('informacion_empresa') || 
            f.id.includes('conocimiento_empresa') ||
            (f.contenido && f.contenido.includes('SEMILLEROS DEITANA - INFORMACIÓN OFICIAL'))
        )
    );
    
    const fragmentosConversacion = ordenados.filter(f => 
        !f.id.includes('informacion_empresa') && 
        !f.id.includes('conocimiento_empresa') &&
        !(f.contenido && f.contenido.includes('SEMILLEROS DEITANA - INFORMACIÓN OFICIAL'))
    );
    
    console.log(`🏢 [RAG] Fragmentos de empresa oficial: ${fragmentosEmpresaOficial.length}`);
    console.log(`💬 [RAG] Fragmentos de conversación: ${fragmentosConversacion.length}`);
    
    // --- PRIORIZACIÓN ABSOLUTA: Información oficial SIEMPRE primero ---
    let fragmentosFinales = [];
    
    if (fragmentosEmpresaOficial.length > 0) {
        console.log('🏢 [RAG] PRIORIZANDO información oficial de empresa');
        
        // Tomar SOLO información oficial si existe
        fragmentosFinales = fragmentosEmpresaOficial.slice(0, CONFIG_RAG.MAX_CHUNKS_PER_QUERY);
        
        // Solo agregar conversaciones si necesitamos más contexto Y no hay suficiente info oficial
        if (fragmentosFinales.length < 2 && fragmentosConversacion.length > 0) {
            console.log('🔄 [RAG] Complementando con 1 fragmento de conversación');
            fragmentosFinales.push(fragmentosConversacion[0]);
        }
    } else {
        console.log('💬 [RAG] Usando fragmentos de conversación (no hay info oficial)');
        fragmentosFinales = fragmentosConversacion.slice(0, CONFIG_RAG.MAX_CHUNKS_PER_QUERY);
    }
    
    // --- Priorizar coincidencias exactas dentro del grupo seleccionado ---
    const terminosClave = extraerTérminosClaveConsulta(consulta);
    const fragmentosCoincidenciaExacta = [];
    const fragmentosRestantes = [];
    
    for (const frag of fragmentosFinales) {
        const contenido = frag.contenido.toLowerCase();
        const hayCoincidencia = terminosClave.some(tc => contenido.includes(tc.toLowerCase()));
        if (hayCoincidencia) {
            fragmentosCoincidenciaExacta.push(frag);
        } else {
            fragmentosRestantes.push(frag);
        }
    }
    
    // Seleccionar fragmentos priorizando coincidencias exactas
    const seleccionados = [...fragmentosCoincidenciaExacta, ...fragmentosRestantes].slice(0, CONFIG_RAG.MAX_CHUNKS_PER_QUERY);
    
    seleccionados.forEach(frag => {
        console.log(`✅ [RAG] Seleccionado: ${frag.tipo} (score: ${frag.score?.toFixed(3)}) - ${frag.contenido.substring(0, 50)}...`);
    });
    
    console.log(`🎯 [RAG] Seleccionados ${seleccionados.length} fragmentos (priorizando conocimiento empresarial)`);
    return seleccionados;
}

/**
 * Construye contexto optimizado respetando límites de tokens
 */
function construirContextoOptimizado(fragmentos) {
    if (fragmentos.length === 0) return '';
    
    let contexto = '=== CONOCIMIENTO RELEVANTE DE SEMILLEROS DEITANA ===\n\n';
    let caracteresUsados = contexto.length;
    const maxCaracteres = CONFIG_RAG.MAX_TOKENS_CONTEXT * 3.5; // Aproximación tokens → caracteres
    
    for (let i = 0; i < fragmentos.length; i++) {
        const fragmento = fragmentos[i];
        const tituloFragmento = fragmento.titulo || `Fragmento ${i + 1}`;
        const contenidoFragmento = `**${tituloFragmento}**\n${fragmento.contenido}\n\n`;
        
        // Verificar límite de caracteres
        if (caracteresUsados + contenidoFragmento.length > maxCaracteres) {
            console.log(`⚠️ [RAG] Límite de contexto alcanzado en fragmento ${i + 1}`);
            break;
        }
        
        contexto += contenidoFragmento;
        caracteresUsados += contenidoFragmento.length;
    }
    
    return contexto;
}

// =====================================
// GESTIÓN DE CONOCIMIENTO
// =====================================

/**
 * Carga conocimiento desde archivo de texto
 */
async function cargarConocimientoDesdeArchivo(rutaArchivo, metadatos = {}) {
    console.log('🧠 [RAG] Cargando conocimiento desde archivo:', rutaArchivo);
    
    try {
        const fs = require('fs');
        const contenidoCompleto = fs.readFileSync(rutaArchivo, 'utf8');
        
        console.log(`📄 [RAG] Archivo leído: ${contenidoCompleto.length} caracteres`);
        
        return await procesarYAlmacenarConocimiento(contenidoCompleto, {
            ...metadatos,
            fuente: rutaArchivo,
            fechaCarga: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ [RAG] Error cargando archivo:', error.message);
        throw error;
    }
}

/**
 * Procesa y almacena conocimiento en chunks
 */
async function procesarYAlmacenarConocimiento(contenido, metadatos = {}) {
    console.log('🔄 [RAG] Procesando conocimiento...');
    
    // Crear chunks inteligentes
    const chunks = crearChunksInteligentes(contenido, metadatos);
    
    console.log(`📊 [RAG] Generando embeddings para ${chunks.length} chunks...`);
    
    // Procesar en lotes para optimizar
    const LOTE_SIZE = 10;
    let procesados = 0;
    
    for (let i = 0; i < chunks.length; i += LOTE_SIZE) {
        const lote = chunks.slice(i, i + LOTE_SIZE);
        
        await Promise.all(lote.map(async (chunk) => {
            try {
                await almacenarChunkConEmbedding(chunk);
                procesados++;
            } catch (error) {
                console.error(`❌ [RAG] Error procesando chunk ${chunk.id}:`, error.message);
            }
        }));
        
        console.log(`📊 [RAG] Procesados ${Math.min(i + LOTE_SIZE, chunks.length)}/${chunks.length} chunks`);
    }
    
    console.log(`✅ [RAG] Conocimiento procesado: ${procesados}/${chunks.length} chunks exitosos`);
    
    return {
        totalChunks: chunks.length,
        exitosos: procesados,
        fallidos: chunks.length - procesados
    };
}

/**
 * Almacena un chunk con su embedding en Pinecone
 */
async function almacenarChunkConEmbedding(chunk) {
    try {
        // Generar embedding
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002", // Usar mismo modelo que la carga
            input: chunk.contenido,
            encoding_format: "float"
        });
        
        const embedding = response.data[0].embedding;
        
        // Almacenar directamente en Pinecone con metadatos correctos
        const { Pinecone } = require('@pinecone-database/pinecone');
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
        
        const index = pinecone.Index(process.env.PINECONE_INDEX || 'memoria-deitana');
        
        // FORMATO CORRECTO: Agregar el prefijo oficial al contenido
        const contenidoOficial = `SEMILLEROS DEITANA - INFORMACIÓN OFICIAL\nDocumento: informacionEmpresa.txt\n\n${chunk.contenido}`;
        
        const metadata = {
            texto: contenidoOficial,
            tipo: 'informacion_empresa_oficial',  // CAMBIO CRÍTICO
            titulo: chunk.titulo,
            categoria: chunk.metadatos.categoria || 'empresa_completa',
            timestamp: new Date().toISOString(),
            palabrasClave: chunk.metadatos.palabrasClave || []
        };
        
        // ID que el filtro reconoce como oficial
        const idOficial = `informacion_empresa_${chunk.id}`;
        
        await index.upsert([{
            id: idOficial,
            values: embedding,
            metadata: metadata
        }]);
        
        console.log(`✅ [RAG] Chunk guardado como INFORMACIÓN OFICIAL: ${idOficial}`);
        
    } catch (error) {
        console.error(`❌ [RAG] Error almacenando chunk ${chunk.id}:`, error.message);
        throw error;
    }
}

// =====================================
// UTILIDADES Y MÉTRICAS
// =====================================

/**
 * Calcula el costo estimado del sistema RAG
 */
function calcularCostoEstimado(numeroConsultasDiarias = 100) {
    const costoPorEmbedding = 0.00002; // text-embedding-3-small
    const tokensPromedioContexto = CONFIG_RAG.MAX_TOKENS_CONTEXT / 2; // Promedio
    const costoPorToken = 0.00001; // Costo promedio por token en consulta
    
    const costoEmbeddingsDiario = numeroConsultasDiarias * costoPorEmbedding;
    const costoContextoDiario = numeroConsultasDiarias * tokensPromedioContexto * costoPorToken;
    const costoTotalDiario = costoEmbeddingsDiario + costoContextoDiario;
    
    return {
        porConsulta: {
            embedding: costoPorEmbedding,
            contexto: tokensPromedioContexto * costoPorToken,
            total: costoPorEmbedding + (tokensPromedioContexto * costoPorToken)
        },
        diario: {
            consultas: numeroConsultasDiarias,
            embeddings: costoEmbeddingsDiario,
            contexto: costoContextoDiario,
            total: costoTotalDiario
        },
        mensual: costoTotalDiario * 30,
        anual: costoTotalDiario * 365
    };
}

/**
 * Busca un fragmento específico por su ID en Pinecone
 */
async function buscarPorIdEspecifico(id) {
    try {
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
        const index = pinecone.Index(process.env.PINECONE_INDEX || 'memoria-deitana');
        
        const chunk = await index.fetch([id]);
        if (chunk.records && chunk.records[id]) {
            const record = chunk.records[id];
            console.log(`✅ [RAG] Fragmento específico encontrado: ${id}`);
            
            const contextoRAG = `=== CONOCIMIENTO RELEVANTE DE SEMILLEROS DEITANA ===

${record.metadata.texto}`;
            
            console.log(`📊 [RAG] Contexto directo: ${contextoRAG.length} caracteres`);
            return contextoRAG;
        }
        
        console.log(`⚠️ [RAG] Fragmento no encontrado: ${id}`);
        return null;
    } catch (error) {
        console.error(`❌ [RAG] Error buscando fragmento ${id}:`, error);
        return null;
    }
}

/**
 * Realiza búsqueda vectorial inteligente con múltiples variaciones
 */
async function buscarVectorial(consulta) {
    try {
        console.log('🧠 [RAG INTELIGENTE] Iniciando búsqueda con múltiples variaciones...');
        
        // Generar variaciones de la consulta
        const variaciones = generarVariacionesConsulta(consulta);
        console.log(`📋 [RAG] Variaciones generadas: ${variaciones.length}`);
        
        let todosLosResultados = [];
        
        // Ejecutar búsquedas en paralelo para todas las variaciones
        for (const variacion of variaciones) {
            console.log(`🔍 [RAG] Probando: "${variacion.substring(0, 50)}..."`);
            
            // Generar embedding para esta variación
            const response = await openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: variacion,
                encoding_format: "float"
            });
            
            const consultaEmbedding = response.data[0].embedding;
            
            // Búsqueda en Pinecone
            const resultados = await buscarEnPinecone(consultaEmbedding);
            
            if (resultados && resultados.length > 0) {
                todosLosResultados.push(...resultados);
            }
            
            // Pequeña pausa para no saturar la API
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (todosLosResultados.length === 0) {
            console.log('⚠️ [RAG] No se encontraron fragmentos relevantes en ninguna variación');
            return '';
        }
        
        // Eliminar duplicados por ID
        const resultadosUnicos = [];
        const idsVistos = new Set();
        
        for (const resultado of todosLosResultados) {
            if (!idsVistos.has(resultado.id)) {
                idsVistos.add(resultado.id);
                resultadosUnicos.push(resultado);
            }
        }
        
        console.log(`🔄 [RAG] Resultados únicos: ${resultadosUnicos.length} de ${todosLosResultados.length} totales`);
        
        // Ordenar por score y aplicar filtrado optimizado
        const resultadosOrdenados = resultadosUnicos.sort((a, b) => b.score - a.score);
        const fragmentosRelevantes = filtrarFragmentosOptimos(resultadosOrdenados, consulta);
        
        // Construir contexto optimizado
        const contextoRAG = construirContextoOptimizado(fragmentosRelevantes);
        
        console.log(`🎯 [RAG] Recuperados ${fragmentosRelevantes.length} fragmentos relevantes`);
        console.log(`📊 [RAG] Contexto final: ${contextoRAG.length} caracteres (~${Math.ceil(contextoRAG.length/3.5)} tokens)`);
        
        return contextoRAG;
        
    } catch (error) {
        console.error('❌ [RAG] Error en búsqueda vectorial inteligente:', error.message);
        return ''; // Fallar silenciosamente para no interrumpir consulta
    }
}

/**
 * Genera múltiples variaciones de una consulta para mejorar la búsqueda
 */
function generarVariacionesConsulta(consultaOriginal) {
    const variaciones = [consultaOriginal];
    const consultaLower = consultaOriginal.toLowerCase();
    
    // Variación sin palabras de parada
    const palabrasParada = ['que', 'es', 'el', 'la', 'de', 'del', 'en', 'para', 'con', 'por', 'como', 'cual', 'cuales', 'donde', 'cuando'];
    const palabras = consultaOriginal.split(' ').filter(p => p.length > 2 && !palabrasParada.includes(p.toLowerCase()));
    if (palabras.length > 0) {
        variaciones.push(palabras.join(' '));
    }
    
    // Variación con prefijo de empresa
    variaciones.push(`SEMILLEROS DEITANA ${consultaOriginal}`);
    variaciones.push(`informacionEmpresa.txt ${palabras.join(' ')}`);
    
    // Mapeos específicos para términos técnicos de la empresa
    const mapeoTerminos = {
        'bandejas': ['FRECUENCIA DEL PROCESO', 'cambio agua 9000', 'frecuencia cambio'],
        'previcur': ['PREVICUR', 'fitosanitario', 'producto'],
        'panel': ['PANEL DE CONTROL', 'OPERACIONES', 'panel control'],
        'operaciones': ['PANEL DE CONTROL', 'control operaciones', 'interfaz'],
        'clientes': ['Tabla Relacionada clientes', 'CL_DENO'],
        'tomate': ['TOMATE AMARELO', 'Semilla Utilizada'],
        'roberto': ['cliente Roberto', 'información Roberto'],
        'agua': ['FRECUENCIA DEL PROCESO', 'cambio agua'],
        '9000': ['FRECUENCIA DEL PROCESO', 'cambio agua 9000'],
        'formula': ['producto fitosanitario', 'composición']
    };
    
    // Agregar variaciones específicas basadas en mapeos
    for (const [termino, variacionesTermino] of Object.entries(mapeoTerminos)) {
        if (consultaLower.includes(termino)) {
            variaciones.push(...variacionesTermino);
        }
    }
    
    // Variaciones adicionales para ERP
    if (consultaLower.includes('cl_') || consultaLower.includes('ar_') || consultaLower.includes('pr_')) {
        variaciones.push('Tabla Relacionada');
        variaciones.push('Columnas');
    }
    
    // Eliminar duplicados y limitar número de variaciones
    const variacionesUnicas = [...new Set(variaciones)];
    return variacionesUnicas.slice(0, 8); // Máximo 8 variaciones para no saturar
}

module.exports = {
    recuperarConocimientoRelevante,
    cargarConocimientoDesdeArchivo,
    procesarYAlmacenarConocimiento,
    calcularCostoEstimado,
    CONFIG_RAG
};