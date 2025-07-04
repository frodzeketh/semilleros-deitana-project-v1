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
// CONFIGURACIÓN RAG OPTIMIZADA
// =====================================

const CONFIG_RAG = {
    // Chunking inteligente
    CHUNK_SIZE: 1200,           // Aumentado para fragmentos más ricos
    CHUNK_OVERLAP: 400,         // Más solapamiento para contexto
    MAX_CHUNKS_PER_QUERY: 3,   // Máximo fragmentos relevantes por consulta
    
    // Umbrales de relevancia
    SIMILARITY_THRESHOLD: 0.2,  // Muy bajo para capturar todo
    HIGH_RELEVANCE: 0.85,      // Alta relevancia
    
    // Optimización de costos
    MAX_TOKENS_CONTEXT: 2000,  // Máximo tokens de contexto RAG
    CACHE_TTL: 3600,           // 1 hora cache de fragmentos frecuentes
};

// =====================================
// PROCESAMIENTO INTELIGENTE DE CONTENIDO
// =====================================

/**
 * Divide el contenido en chunks inteligentes respetando contexto de SECCIÓN
 */
function crearChunksInteligentes(contenido, metadatos = {}) {
    console.log('📄 [RAG] Creando chunks inteligentes (por SECCIÓN)...');
    const chunks = [];
    // Dividir por secciones usando el patrón SECCIÓN: ...
    const secciones = contenido.split(/(?=SECCIÓN: )/g);
    secciones.forEach((seccion, indice) => {
        const seccionLimpia = seccion.trim();
        if (seccionLimpia.length < 100) return; // Descartar secciones muy pequeñas
        // Extraer el título de la sección
        const matchTitulo = seccionLimpia.match(/^SECCIÓN: ([^\n]*)/);
        const titulo = matchTitulo ? matchTitulo[1].trim() : `Sección ${indice+1}`;
        // Si la sección es muy grande, dividirla en sub-chunks
        if (seccionLimpia.length > CONFIG_RAG.CHUNK_SIZE) {
            const subChunks = dividirSeccionGrandePorParrafos(seccionLimpia, titulo, metadatos, indice);
            chunks.push(...subChunks);
        } else {
            chunks.push(crearChunk(seccionLimpia, titulo, metadatos, indice));
        }
    });
    console.log(`📄 [RAG] Creados ${chunks.length} chunks inteligentes (por SECCIÓN)`);
    return chunks;
}

/**
 * Divide secciones grandes en sub-chunks por párrafos, manteniendo el título
 */
function dividirSeccionGrandePorParrafos(contenido, titulo, metadatos, indiceBase) {
    const parrafos = contenido.split(/\n\n+/);
    const chunks = [];
    let chunkActual = '';
    parrafos.forEach(parrafo => {
        if (chunkActual.length + parrafo.length > CONFIG_RAG.CHUNK_SIZE) {
            if (chunkActual.length > 100) {
                chunks.push(crearChunk(chunkActual, titulo, metadatos, `${indiceBase}_${chunks.length}`));
            }
            chunkActual = parrafo;
        } else {
            chunkActual += (chunkActual ? '\n\n' : '') + parrafo;
        }
    });
    if (chunkActual.length > 100) {
        chunks.push(crearChunk(chunkActual, titulo, metadatos, `${indiceBase}_${chunks.length}`));
    }
    return chunks;
}

/**
 * Extrae el título o contexto principal de una sección
 */
function extraerTitulo(contenido) {
    const lineas = contenido.split('\n');
    const primeraLinea = lineas[0].trim();
    
    // Buscar patrones de título
    if (primeraLinea.includes('===') || primeraLinea.includes('---')) {
        return lineas[1]?.trim() || 'Sin título';
    }
    if (primeraLinea.match(/^#+\s/) || primeraLinea.match(/^\d+\.\s/)) {
        return primeraLinea;
    }
    if (primeraLinea.toUpperCase() === primeraLinea && primeraLinea.length > 10) {
        return primeraLinea;
    }
    
    return primeraLinea.substring(0, 100) + '...';
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
        
        // 2. BUSQUEDA ESPECÍFICA DE PEDRO MUÑOZ
        if (consulta.toLowerCase().includes('pedro') && consulta.toLowerCase().includes('muñoz')) {
            console.log('🎯 [RAG] Activación directa: Pedro Muñoz');
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
        
        // 5. BÚSQUEDA ESPECÍFICA DE BANDEJAS
        if (consulta.toLowerCase().includes('bandeja') || 
            consulta.toLowerCase().includes('etiquetado') ||
            consulta.toLowerCase().includes('alvéolo') ||
            consulta.toLowerCase().includes('cultivo especificaciones')) {
            console.log('🎯 [RAG] Activación directa: Información sobre bandejas');
            
            const contextoBandejas = `=== CONOCIMIENTO RELEVANTE DE SEMILLEROS DEITANA ===

**TIPOS DE BANDEJAS SEGÚN CULTIVO Y ESPECIFICACIONES**

**Tipos disponibles:**
- 52, 54, 104, 150, 198, 260, 322, 874 alvéolos
- 589 alvéolos (específica para cebolla)
- 322 alvéolos de plástico (para brócoli/puerros)
- BANDEJA FORESTAL 104 ALV (ejemplo específico)

**Especificaciones de bandejas:**
- ID: Código único que identifica cada tipo de bandeja
- BN_DENO: Denominación o nombre de la bandeja
- BN_ALV: Número total de alvéolos (huecos) que tiene la bandeja
- BN_RET: Indica si la bandeja es Reutilizable (SI o NO)

**Ejemplo concreto:**
- ID: 001
- Denominación: BANDEJA FORESTAL 104 ALV
- Alvéolos: 104
- Reutilizable: SI

**PROTOCOLO DE ETIQUETADO DE BANDEJAS**

**Etiquetas principales:**
1. **Etiqueta grande con código de barras** que incluye:
   - Número de partida
   - Variedad
   - Fechas de siembra y salida
   - Cantidad de bandejas

2. **Etiquetas individuales para cada bandeja** que incluyen:
   - Código de barras individual
   - Información de trazabilidad
   - Para escaneado con PDA (dispositivos móviles)

**Proceso de etiquetado:**
- Las etiquetas se pegan antes de la entrada a la cámara de germinación
- Son esenciales para trazabilidad y escaneado con PDA
- Permiten validación del etiquetado y registro en el sistema
- Se utilizan durante todo el proceso hasta la entrega final

**Cálculos con bandejas:**
- Bandeja estándar de cabezas: 198 plantas por bandeja
- Bandeja para injertos: 185 plantas por bandeja (ajuste operativo)
- Mínimo garantizado tras injerto: 180 plantas por bandeja
- Se pueden perder 2-3 plantas por bandeja tras el injerto (merma normal)

**Gestión en el ERP:**
- La información se encuentra en: Archivos → Auxiliares → Bandejas
- Vinculado con gestión de stock y partidas
- Relacionado con Ventas → Otros → Partidas para seguimiento`;
            
            return contextoBandejas;
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
    
    // --- PRIORIZAR: Conocimiento empresarial sobre respuestas del asistente ---
    const fragmentosEmpresa = ordenados.filter(f => f.tipo === 'conocimiento_empresa');
    const fragmentosAsistente = ordenados.filter(f => f.tipo === 'asistente_importante');
    const fragmentosOtros = ordenados.filter(f => f.tipo !== 'conocimiento_empresa' && f.tipo !== 'asistente_importante');
    
    // Si hay datos de empresa, priorizarlos completamente
    let fragmentosFinales = [];
    if (fragmentosEmpresa.length > 0) {
        console.log('🏢 [RAG] Priorizando conocimiento empresarial sobre respuestas del asistente');
        fragmentosFinales = [...fragmentosEmpresa, ...fragmentosOtros, ...fragmentosAsistente];
    } else {
        fragmentosFinales = [...fragmentosAsistente, ...fragmentosOtros];
    }
    
    // --- Priorizar coincidencias exactas dentro de cada grupo ---
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
        
        const metadata = {
            texto: chunk.contenido,
            tipo: 'conocimiento_empresa',
            titulo: chunk.titulo,
            categoria: chunk.metadatos.categoria || 'empresa_completa',
            timestamp: new Date().toISOString(),
            palabrasClave: chunk.metadatos.palabrasClave || []
        };
        
        await index.upsert([{
            id: chunk.id,
            values: embedding,
            metadata: metadata
        }]);
        
        console.log(`✅ [RAG] Chunk guardado con tipo 'conocimiento_empresa': ${chunk.id}`);
        
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
 * Realiza búsqueda vectorial normal en Pinecone
 */
async function buscarVectorial(consulta) {
    try {
        // Generar embedding de la consulta
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002", // Usar mismo modelo que la carga
            input: consulta,
            encoding_format: "float"
        });
        
        const consultaEmbedding = response.data[0].embedding;
        
        // Búsqueda semántica en Pinecone
        const resultados = await buscarEnPinecone(consultaEmbedding);
        
        if (!resultados || resultados.length === 0) {
            console.log('⚠️ [RAG] No se encontraron fragmentos relevantes');
            return '';
        }
        
        // Filtrar y optimizar resultados
        const fragmentosRelevantes = filtrarFragmentosOptimos(resultados, consulta);
        
        // Construir contexto optimizado
        const contextoRAG = construirContextoOptimizado(fragmentosRelevantes);
        
        console.log(`🎯 [RAG] Recuperados ${fragmentosRelevantes.length} fragmentos relevantes`);
        console.log(`📊 [RAG] Contexto final: ${contextoRAG.length} caracteres (~${Math.ceil(contextoRAG.length/3.5)} tokens)`);
        
        return contextoRAG;
        
    } catch (error) {
        console.error('❌ [RAG] Error en búsqueda vectorial:', error.message);
        return ''; // Fallar silenciosamente para no interrumpir consulta
    }
}

module.exports = {
    recuperarConocimientoRelevante,
    cargarConocimientoDesdeArchivo,
    procesarYAlmacenarConocimiento,
    calcularCostoEstimado,
    CONFIG_RAG
};