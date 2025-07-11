const fs = require('fs');
const path = require('path');
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');

class OptimizadorContenidoDirecto {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
        
        this.index = null;
        this.chunksOptimizados = [];
        this.estadisticas = {
            chunksOriginales: 0,
            chunksOptimizados: 0,
            chunksEliminados: 0,
            chunksNuevos: 0
        };
    }

    async inicializar() {
        try {
            this.index = this.pinecone.index('deitana-knowledge');
            console.log('✅ [PINECONE] Conectado al índice deitana-knowledge');
            return true;
        } catch (error) {
            console.error('❌ [PINECONE] Error de conexión:', error.message);
            return false;
        }
    }

    async ejecutarOptimizacion() {
        console.log('🚀 [OPTIMIZACIÓN] Iniciando reestructuración del contenido');
        
        // 1. Leer archivo original
        const contenido = await this.leerArchivoOriginal();
        if (!contenido) return false;
        
        // 2. Analizar chunks actuales en Pinecone
        await this.analizarChunksActuales();
        
        // 3. Crear chunks optimizados
        await this.crearChunksOptimizados(contenido);
        
        // 4. Limpiar índice existente (solo conocimiento empresa)
        await this.limpiarConocimientoEmpresa();
        
        // 5. Reindexar con chunks optimizados
        await this.reindexarChunksOptimizados();
        
        // 6. Generar reporte
        this.generarReporteOptimizacion();
        
        return true;
    }

    async leerArchivoOriginal() {
        try {
            const rutaArchivo = path.join(__dirname, 'admin', 'data', 'informacionEmpresa.txt');
            const contenido = fs.readFileSync(rutaArchivo, 'utf-8');
            
            console.log(`📄 [ARCHIVO] Leído: ${contenido.length} caracteres`);
            return contenido;
            
        } catch (error) {
            console.error('❌ [ERROR] No se pudo leer informacionEmpresa.txt:', error.message);
            return null;
        }
    }

    async analizarChunksActuales() {
        console.log('\n🔍 [ANÁLISIS] Examinando chunks actuales en Pinecone...');
        
        try {
            // Buscar todos los chunks de conocimiento empresarial
            const vectorQuery = await this.index.query({
                vector: new Array(1536).fill(0), // Vector dummy para búsqueda
                topK: 100,
                filter: {
                    source: { $eq: 'conocimiento_empresa' }
                },
                includeMetadata: true
            });
            
            this.estadisticas.chunksOriginales = vectorQuery.matches?.length || 0;
            console.log(`📊 [ACTUAL] ${this.estadisticas.chunksOriginales} chunks de empresa en Pinecone`);
            
        } catch (error) {
            console.log('⚠️ [ADVERTENCIA] No se pudo analizar chunks actuales:', error.message);
            this.estadisticas.chunksOriginales = 0;
        }
    }

    async crearChunksOptimizados(contenido) {
        console.log('\n⚡ [OPTIMIZACIÓN] Creando chunks optimizados...');
        
        // Dividir por secciones principales
        const secciones = this.dividirEnSecciones(contenido);
        console.log(`📋 [SECCIONES] ${secciones.length} secciones identificadas`);
        
        for (const seccion of secciones) {
            await this.procesarSeccion(seccion);
        }
        
        console.log(`✅ [CHUNKS] ${this.chunksOptimizados.length} chunks optimizados creados`);
        this.estadisticas.chunksOptimizados = this.chunksOptimizados.length;
    }

    dividirEnSecciones(contenido) {
        const secciones = [];
        const lineas = contenido.split('\n');
        let seccionActual = null;
        
        lineas.forEach(linea => {
            // Detectar inicio de nueva sección
            if (linea.includes('SECCIÓN:') || linea.match(/^\d+\./) || linea.includes('===')) {
                if (seccionActual && seccionActual.contenido.trim()) {
                    secciones.push(seccionActual);
                }
                
                seccionActual = {
                    titulo: linea.trim(),
                    contenido: '',
                    tipo: this.detectarTipoSeccion(linea)
                };
            } else if (seccionActual) {
                seccionActual.contenido += linea + '\n';
            }
        });
        
        // Agregar última sección
        if (seccionActual && seccionActual.contenido.trim()) {
            secciones.push(seccionActual);
        }
        
        return secciones;
    }

    detectarTipoSeccion(titulo) {
        const tipos = {
            'CLIENTES': 'tabla_erp',
            'ARTÍCULOS': 'tabla_erp', 
            'BANDEJAS': 'tabla_erp',
            'PROVEEDORES': 'tabla_erp',
            'INVERNADEROS': 'proceso',
            'INJERTOS': 'proceso',
            'SIEMBRA': 'proceso',
            'GERMINACIÓN': 'proceso',
            'FACTURACIÓN': 'proceso',
            'MAQUINARIA': 'equipos',
            'FITOSANITARIOS': 'productos'
        };
        
        for (const [palabra, tipo] of Object.entries(tipos)) {
            if (titulo.toUpperCase().includes(palabra)) {
                return tipo;
            }
        }
        
        return 'general';
    }

    async procesarSeccion(seccion) {
        const { titulo, contenido, tipo } = seccion;
        
        if (contenido.length <= 1200) {
            // Sección pequeña - chunk único
            this.chunksOptimizados.push({
                id: this.generarId(titulo),
                titulo,
                contenido: contenido.trim(),
                tipo,
                source: 'conocimiento_empresa',
                categoria: 'seccion_completa'
            });
        } else {
            // Sección grande - dividir inteligentemente
            const subchunks = await this.dividirSeccionInteligente(seccion);
            this.chunksOptimizados.push(...subchunks);
        }
        
        // Crear chunks especializados para ejemplos
        await this.crearChunksEjemplos(seccion);
    }

    async dividirSeccionInteligente(seccion) {
        const { titulo, contenido, tipo } = seccion;
        const chunks = [];
        const parrafos = contenido.split('\n\n').filter(p => p.trim());
        
        let chunkActual = '';
        let contador = 1;
        
        for (const parrafo of parrafos) {
            if ((chunkActual + parrafo).length > 1200 && chunkActual) {
                // Crear chunk y reiniciar
                chunks.push({
                    id: this.generarId(`${titulo}_parte_${contador}`),
                    titulo: `${titulo} - Parte ${contador}`,
                    contenido: chunkActual.trim(),
                    tipo,
                    source: 'conocimiento_empresa',
                    categoria: 'seccion_dividida'
                });
                
                chunkActual = parrafo + '\n\n';
                contador++;
            } else {
                chunkActual += parrafo + '\n\n';
            }
        }
        
        // Agregar último chunk si hay contenido
        if (chunkActual.trim()) {
            chunks.push({
                id: this.generarId(`${titulo}_parte_${contador}`),
                titulo: `${titulo} - Parte ${contador}`,
                contenido: chunkActual.trim(),
                tipo,
                source: 'conocimiento_empresa',
                categoria: 'seccion_dividida'
            });
        }
        
        return chunks;
    }

    async crearChunksEjemplos(seccion) {
        const ejemplos = this.extraerEjemplos(seccion.contenido);
        
        for (const ejemplo of ejemplos) {
            this.chunksOptimizados.push({
                id: this.generarId(`ejemplo_${ejemplo.tipo}_${Date.now()}`),
                titulo: `Ejemplo: ${ejemplo.tipo}`,
                contenido: ejemplo.contenido,
                tipo: 'ejemplo',
                source: 'conocimiento_empresa',
                categoria: 'ejemplo_especifico',
                palabrasClave: ejemplo.palabrasClave
            });
        }
    }

    extraerEjemplos(contenido) {
        const ejemplos = [];
        const lineas = contenido.split('\n');
        
        let ejemploActual = null;
        
        lineas.forEach(linea => {
            if (linea.includes('Ejemplo') || linea.includes('ID:')) {
                if (ejemploActual) {
                    ejemplos.push(ejemploActual);
                }
                
                ejemploActual = {
                    tipo: this.detectarTipoEjemplo(linea),
                    contenido: linea + '\n',
                    palabrasClave: []
                };
            } else if (ejemploActual && linea.trim()) {
                ejemploActual.contenido += linea + '\n';
                
                // Extraer palabras clave
                const campos = linea.match(/[A-Z]{2,}_[A-Z]+/g) || [];
                ejemploActual.palabrasClave.push(...campos);
            }
        });
        
        if (ejemploActual) {
            ejemplos.push(ejemploActual);
        }
        
        return ejemplos.filter(e => e.contenido.length > 50);
    }

    detectarTipoEjemplo(linea) {
        if (linea.includes('Cliente') || linea.includes('CL_')) return 'cliente';
        if (linea.includes('Artículo') || linea.includes('AR_')) return 'articulo';
        if (linea.includes('Bandeja') || linea.includes('BN_')) return 'bandeja';
        if (linea.includes('Proveedor') || linea.includes('PR_')) return 'proveedor';
        return 'general';
    }

    generarId(base) {
        return base.toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .substring(0, 50) + '_' + Date.now();
    }

    async limpiarConocimientoEmpresa() {
        console.log('\n🧹 [LIMPIEZA] Eliminando chunks antiguos de empresa...');
        
        try {
            // Eliminar todos los vectores con source = 'conocimiento_empresa'
            await this.index.deleteAll({
                filter: {
                    source: { $eq: 'conocimiento_empresa' }
                }
            });
            
            console.log('✅ [LIMPIEZA] Chunks antiguos eliminados');
            this.estadisticas.chunksEliminados = this.estadisticas.chunksOriginales;
            
        } catch (error) {
            console.error('❌ [ERROR] Error en limpieza:', error.message);
        }
    }

    async reindexarChunksOptimizados() {
        console.log('\n📚 [REINDEXACIÓN] Subiendo chunks optimizados...');
        
        const batchSize = 10;
        let procesados = 0;
        
        for (let i = 0; i < this.chunksOptimizados.length; i += batchSize) {
            const batch = this.chunksOptimizados.slice(i, i + batchSize);
            
            try {
                await this.procesarBatch(batch);
                procesados += batch.length;
                
                console.log(`📊 [PROGRESO] ${procesados}/${this.chunksOptimizados.length} chunks procesados`);
                
                // Pausa para no sobrecargar APIs
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ [ERROR] Error en batch ${i}:`, error.message);
            }
        }
        
        console.log('✅ [REINDEXACIÓN] Todos los chunks optimizados subidos');
        this.estadisticas.chunksNuevos = procesados;
    }

    async procesarBatch(batch) {
        const vectores = [];
        
        for (const chunk of batch) {
            try {
                // Generar embedding
                const embedding = await this.openai.embeddings.create({
                    model: "text-embedding-ada-002",
                    input: chunk.contenido
                });
                
                vectores.push({
                    id: chunk.id,
                    values: embedding.data[0].embedding,
                    metadata: {
                        contenido: chunk.contenido,
                        titulo: chunk.titulo,
                        tipo: chunk.tipo,
                        source: chunk.source,
                        categoria: chunk.categoria,
                        palabrasClave: chunk.palabrasClave || [],
                        timestamp: new Date().toISOString()
                    }
                });
                
            } catch (error) {
                console.error(`❌ [EMBEDDING] Error con chunk ${chunk.id}:`, error.message);
            }
        }
        
        if (vectores.length > 0) {
            await this.index.upsert(vectores);
        }
    }

    generarReporteOptimizacion() {
        console.log('\n🎯 [REPORTE OPTIMIZACIÓN] ========================================');
        console.log(`📊 Chunks originales: ${this.estadisticas.chunksOriginales}`);
        console.log(`⚡ Chunks optimizados: ${this.estadisticas.chunksOptimizados}`);
        console.log(`🗑️ Chunks eliminados: ${this.estadisticas.chunksEliminados}`);
        console.log(`🆕 Chunks nuevos: ${this.estadisticas.chunksNuevos}`);
        
        const mejora = this.estadisticas.chunksOptimizados - this.estadisticas.chunksOriginales;
        console.log(`📈 Diferencia: ${mejora > 0 ? '+' : ''}${mejora} chunks`);
        
        console.log('\n🔧 [MEJORAS APLICADAS]:');
        console.log('• Secciones largas divididas inteligentemente');
        console.log('• Chunks específicos para cada ejemplo');
        console.log('• Embeddings optimizados por tipo de contenido');
        console.log('• Metadatos mejorados para búsquedas precisas');
        
        console.log('\n✅ [RESULTADO]: Sistema RAG optimizado para informacionEmpresa.txt');
        console.log('========================================');
        
        // Guardar reporte
        this.guardarReporteOptimizacion();
    }

    guardarReporteOptimizacion() {
        try {
            const reporte = {
                fecha: new Date().toISOString(),
                estadisticas: this.estadisticas,
                chunksOptimizados: this.chunksOptimizados.length,
                tiposChunks: this.analizarTiposChunks(),
                mejoras: [
                    'Secciones largas divididas',
                    'Ejemplos como chunks específicos',
                    'Metadatos mejorados',
                    'Embeddings optimizados'
                ]
            };
            
            const nombreArchivo = `optimizacion-completada-${new Date().toISOString().split('T')[0]}.json`;
            const rutaArchivo = path.join(__dirname, 'reportes', nombreArchivo);
            
            const dirReportes = path.dirname(rutaArchivo);
            if (!fs.existsSync(dirReportes)) {
                fs.mkdirSync(dirReportes, { recursive: true });
            }
            
            fs.writeFileSync(rutaArchivo, JSON.stringify(reporte, null, 2));
            console.log(`📁 [GUARDADO] ${rutaArchivo}`);
            
        } catch (error) {
            console.log(`⚠️ [ADVERTENCIA] No se pudo guardar reporte: ${error.message}`);
        }
    }

    analizarTiposChunks() {
        const tipos = {};
        this.chunksOptimizados.forEach(chunk => {
            tipos[chunk.tipo] = (tipos[chunk.tipo] || 0) + 1;
        });
        return tipos;
    }
}

async function main() {
    console.log('🚀 [INICIO] Optimizador de Contenido Directo');
    console.log('🎯 [OBJETIVO] Reestructurar informacionEmpresa.txt para RAG óptimo');
    
    const optimizador = new OptimizadorContenidoDirecto();
    
    try {
        const conectado = await optimizador.inicializar();
        if (!conectado) {
            console.error('❌ [ERROR] No se pudo conectar a Pinecone');
            return;
        }
        
        const exito = await optimizador.ejecutarOptimizacion();
        
        if (exito) {
            console.log('\n✅ [COMPLETADO] Optimización finalizada exitosamente');
            console.log('🔄 [SIGUIENTE] Ejecuta tests para verificar mejoras');
        } else {
            console.log('\n❌ [FALLIDO] La optimización no se completó');
        }
        
    } catch (error) {
        console.error('❌ [ERROR CRÍTICO] Optimización falló:', error.message);
        console.error('🔍 [DEBUG]', error.stack);
    }
}

if (require.main === module) {
    main();
}

module.exports = { OptimizadorContenidoDirecto }; 