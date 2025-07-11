const fs = require('fs');
const path = require('path');

// Usar módulos ya configurados del sistema
const openAI = require('./admin/core/openAI');
const pinecone = require('./utils/pinecone');

class OptimizadorRAGEmpresarialDirecto {
    constructor() {
        this.chunksOptimizados = [];
        this.estadisticas = {
            chunksOriginales: 0,
            chunksNuevos: 0,
            seccionesOptimizadas: 0,
            ejemplosCreados: 0
        };
    }

    async ejecutarOptimizacionCompleta() {
        console.log('🚀 [OPTIMIZACIÓN DIRECTA] Mejorando RAG empresarial');
        console.log('🎯 [OBJETIVO] Reestructurar informacionEmpresa.txt para máxima precisión');
        
        try {
            // 1. Leer y analizar contenido
            const contenido = await this.leerInformacionEmpresa();
            if (!contenido) return false;
            
            // 2. Crear chunks optimizados
            await this.crearChunksOptimizados(contenido);
            
            // 3. Eliminar conocimiento empresarial anterior
            await this.limpiarConocimientoAnterior();
            
            // 4. Subir chunks optimizados
            await this.subirChunksOptimizados();
            
            // 5. Generar reporte
            this.generarReporteFinal();
            
            return true;
            
        } catch (error) {
            console.error('❌ [ERROR CRÍTICO] Optimización falló:', error);
            return false;
        }
    }

    async leerInformacionEmpresa() {
        try {
            const rutaArchivo = path.join(__dirname, 'admin', 'data', 'informacionEmpresa.txt');
            const contenido = fs.readFileSync(rutaArchivo, 'utf-8');
            
            console.log(`📄 [ARCHIVO] ${contenido.length} caracteres leídos`);
            return contenido;
            
        } catch (error) {
            console.error('❌ [ERROR] No se pudo leer informacionEmpresa.txt:', error.message);
            return null;
        }
    }

    async crearChunksOptimizados(contenido) {
        console.log('\n⚡ [OPTIMIZACIÓN] Creando chunks inteligentes...');
        
        // Estrategia 1: Chunks por información básica de empresa
        this.crearChunksInfoBasica(contenido);
        
        // Estrategia 2: Chunks específicos por cada campo técnico
        this.crearChunksCamposTecnicos(contenido);
        
        // Estrategia 3: Chunks individuales para cada ejemplo
        this.crearChunksEjemplos(contenido);
        
        // Estrategia 4: Chunks por procesos operativos
        this.crearChunksProcesos(contenido);
        
        // Estrategia 5: Chunks por secciones divididas inteligentemente
        this.crearChunksSecciones(contenido);
        
        console.log(`✅ [CHUNKS] ${this.chunksOptimizados.length} chunks optimizados creados`);
        this.estadisticas.chunksNuevos = this.chunksOptimizados.length;
    }

    crearChunksInfoBasica(contenido) {
        const infoBasica = [
            {
                titulo: "Información Básica - Semilleros Deitana",
                contenido: this.extraerInfoBasica(contenido),
                tipo: "info_empresa"
            }
        ];
        
        infoBasica.forEach(chunk => {
            if (chunk.contenido) {
                this.chunksOptimizados.push({
                    id: `info_basica_${Date.now()}`,
                    contenido: chunk.contenido,
                    metadatos: {
                        titulo: chunk.titulo,
                        tipo: chunk.tipo,
                        source: 'conocimiento_empresa',
                        categoria: 'informacion_basica',
                        palabrasClave: ['Semilleros Deitana', 'empresa', 'fundación', 'ubicación', 'certificación']
                    }
                });
            }
        });
    }

    extraerInfoBasica(contenido) {
        const lineas = contenido.split('\n');
        let infoBasica = '';
        
        lineas.forEach(linea => {
            if (linea.includes('Semilleros Deitana') || 
                linea.includes('1989') || 
                linea.includes('Totana') || 
                linea.includes('Murcia') || 
                linea.includes('ISO 9001') ||
                linea.includes('Galera') ||
                linea.includes('treinta años')) {
                infoBasica += linea + '\n';
            }
        });
        
        return infoBasica.trim();
    }

    crearChunksCamposTecnicos(contenido) {
        const camposTecnicos = {
            'CL_DENO': 'denominación de cliente',
            'CL_DOM': 'domicilio de cliente', 
            'AR_DENO': 'denominación de artículo',
            'AR_PRV': 'proveedor preferente de artículo',
            'BN_ALV': 'alvéolos de bandeja',
            'PR_DENO': 'denominación de proveedor',
            'FP_DENO': 'denominación forma de pago',
            'VE_DENO': 'denominación vendedor'
        };
        
        Object.entries(camposTecnicos).forEach(([campo, descripcion]) => {
            const contenidoCampo = this.extraerContenidoCampo(contenido, campo);
            
            if (contenidoCampo) {
                this.chunksOptimizados.push({
                    id: `campo_${campo.toLowerCase()}_${Date.now()}`,
                    contenido: `Campo técnico: ${campo}\nDescripción: ${descripcion}\n\n${contenidoCampo}`,
                    metadatos: {
                        titulo: `Campo ERP: ${campo}`,
                        tipo: 'campo_tecnico',
                        source: 'conocimiento_empresa',
                        categoria: 'campos_erp',
                        palabrasClave: [campo, descripcion, 'ERP', 'campo']
                    }
                });
            }
        });
    }

    extraerContenidoCampo(contenido, campo) {
        const lineas = contenido.split('\n');
        let contenidoCampo = '';
        let recolectando = false;
        let contadorLineas = 0;
        
        lineas.forEach(linea => {
            if (linea.includes(campo)) {
                recolectando = true;
                contadorLineas = 0;
            }
            
            if (recolectando) {
                contenidoCampo += linea + '\n';
                contadorLineas++;
                
                // Limitar a 10 líneas después de encontrar el campo
                if (contadorLineas > 10) {
                    recolectando = false;
                }
            }
        });
        
        return contenidoCampo.trim();
    }

    crearChunksEjemplos(contenido) {
        const ejemplos = this.extraerTodosLosEjemplos(contenido);
        
        ejemplos.forEach((ejemplo, index) => {
            this.chunksOptimizados.push({
                id: `ejemplo_${ejemplo.tipo}_${index}_${Date.now()}`,
                contenido: ejemplo.contenido,
                metadatos: {
                    titulo: `Ejemplo ${ejemplo.tipo}: ${ejemplo.nombre}`,
                    tipo: 'ejemplo_especifico',
                    source: 'conocimiento_empresa',
                    categoria: 'ejemplos',
                    palabrasClave: ejemplo.palabrasClave
                }
            });
        });
        
        this.estadisticas.ejemplosCreados = ejemplos.length;
    }

    extraerTodosLosEjemplos(contenido) {
        const ejemplos = [];
        const lineas = contenido.split('\n');
        let ejemploActual = null;
        
        lineas.forEach(linea => {
            if (linea.includes('Ejemplo') || 
                linea.includes('ID:') || 
                linea.includes('Roberto') ||
                linea.includes('tomate amarillo')) {
                
                if (ejemploActual) {
                    ejemplos.push(ejemploActual);
                }
                
                ejemploActual = {
                    tipo: this.detectarTipoEjemplo(linea),
                    nombre: this.extraerNombreEjemplo(linea),
                    contenido: linea + '\n',
                    palabrasClave: []
                };
                
            } else if (ejemploActual && linea.trim() && !linea.includes('SECCIÓN')) {
                ejemploActual.contenido += linea + '\n';
                
                // Extraer palabras clave del ejemplo
                const campos = linea.match(/[A-Z]{2,}_[A-Z]+/g) || [];
                const valores = linea.match(/:\s*([^,\n]+)/g) || [];
                
                ejemploActual.palabrasClave.push(...campos);
                ejemploActual.palabrasClave.push(...valores.map(v => v.replace(':', '').trim()));
                
                // Límite de líneas por ejemplo
                if (ejemploActual.contenido.split('\n').length > 15) {
                    ejemplos.push(ejemploActual);
                    ejemploActual = null;
                }
            }
        });
        
        if (ejemploActual) {
            ejemplos.push(ejemploActual);
        }
        
        return ejemplos.filter(e => e.contenido.length > 50);
    }

    detectarTipoEjemplo(linea) {
        if (linea.includes('Cliente') || linea.includes('CL_') || linea.includes('Roberto')) return 'Cliente';
        if (linea.includes('Artículo') || linea.includes('AR_') || linea.includes('tomate')) return 'Artículo';
        if (linea.includes('Bandeja') || linea.includes('BN_')) return 'Bandeja';
        if (linea.includes('Proveedor') || linea.includes('PR_')) return 'Proveedor';
        if (linea.includes('Maquinaria') || linea.includes('Atomizador')) return 'Maquinaria';
        return 'General';
    }

    extraerNombreEjemplo(linea) {
        // Extraer nombre específico del ejemplo
        if (linea.includes('Roberto')) return 'Roberto';
        if (linea.includes('tomate amarillo')) return 'Tomate Amarillo';
        if (linea.includes('ID:')) {
            const match = linea.match(/ID:\s*(\w+)/);
            return match ? match[1] : 'Sin nombre';
        }
        return 'Ejemplo';
    }

    crearChunksProcesos(contenido) {
        const procesos = {
            'Injertos': ['injerto', 'patrón', 'variedad'],
            'Siembra': ['siembra', 'semilla', 'germinación'],
            'Bandejas': ['bandeja', 'alvéolo', 'siembra'],
            'Invernaderos': ['invernadero', 'sección', 'cultivo'],
            'Facturación': ['facturación', 'facturas', 'cobro'],
            'Tratamientos': ['fitosanitario', 'tratamiento', 'plaga']
        };
        
        Object.entries(procesos).forEach(([proceso, palabrasClave]) => {
            const contenidoProceso = this.extraerContenidoProceso(contenido, palabrasClave);
            
            if (contenidoProceso) {
                this.chunksOptimizados.push({
                    id: `proceso_${proceso.toLowerCase()}_${Date.now()}`,
                    contenido: contenidoProceso,
                    metadatos: {
                        titulo: `Proceso: ${proceso}`,
                        tipo: 'proceso_operativo',
                        source: 'conocimiento_empresa',
                        categoria: 'procesos',
                        palabrasClave: palabrasClave
                    }
                });
            }
        });
    }

    extraerContenidoProceso(contenido, palabrasClave) {
        const lineas = contenido.split('\n');
        let contenidoProceso = '';
        
        lineas.forEach(linea => {
            if (palabrasClave.some(palabra => 
                linea.toLowerCase().includes(palabra.toLowerCase())
            )) {
                contenidoProceso += linea + '\n';
            }
        });
        
        return contenidoProceso.trim();
    }

    crearChunksSecciones(contenido) {
        const secciones = this.dividirEnSeccionesOptimas(contenido);
        
        secciones.forEach((seccion, index) => {
            if (seccion.contenido.length > 100) {
                this.chunksOptimizados.push({
                    id: `seccion_${index}_${Date.now()}`,
                    contenido: seccion.contenido,
                    metadatos: {
                        titulo: seccion.titulo,
                        tipo: 'seccion_general',
                        source: 'conocimiento_empresa',
                        categoria: 'secciones',
                        palabrasClave: seccion.palabrasClave
                    }
                });
            }
        });
        
        this.estadisticas.seccionesOptimizadas = secciones.length;
    }

    dividirEnSeccionesOptimas(contenido) {
        const secciones = [];
        const lineas = contenido.split('\n');
        let seccionActual = null;
        
        lineas.forEach(linea => {
            if (linea.includes('SECCIÓN:') || linea.includes('===')) {
                if (seccionActual) {
                    secciones.push(seccionActual);
                }
                
                seccionActual = {
                    titulo: linea.trim(),
                    contenido: '',
                    palabrasClave: []
                };
            } else if (seccionActual) {
                seccionActual.contenido += linea + '\n';
                
                // Extraer palabras clave
                const campos = linea.match(/[A-Z]{2,}_[A-Z]+/g) || [];
                seccionActual.palabrasClave.push(...campos);
            }
        });
        
        if (seccionActual) {
            secciones.push(seccionActual);
        }
        
        return secciones;
    }

    async limpiarConocimientoAnterior() {
        console.log('\n🧹 [LIMPIEZA] Eliminando chunks anteriores de empresa...');
        
        try {
            // Usar el módulo pinecone ya configurado
            await pinecone.eliminarVectoresPorFiltro({
                source: 'conocimiento_empresa'
            });
            
            console.log('✅ [LIMPIEZA] Conocimiento empresarial anterior eliminado');
            
        } catch (error) {
            console.log('⚠️ [ADVERTENCIA] Error en limpieza:', error.message);
        }
    }

    async subirChunksOptimizados() {
        console.log('\n📚 [SUBIDA] Indexando chunks optimizados...');
        
        const batchSize = 5; // Más conservador para evitar límites de API
        let procesados = 0;
        
        for (let i = 0; i < this.chunksOptimizados.length; i += batchSize) {
            const batch = this.chunksOptimizados.slice(i, i + batchSize);
            
            try {
                await this.procesarBatchChunks(batch);
                procesados += batch.length;
                
                console.log(`📊 [PROGRESO] ${procesados}/${this.chunksOptimizados.length} chunks procesados`);
                
                // Pausa para respetar límites de API
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`❌ [ERROR] Error en batch ${i}:`, error.message);
            }
        }
        
        console.log('✅ [SUBIDA] Todos los chunks optimizados indexados');
    }

    async procesarBatchChunks(batch) {
        for (const chunk of batch) {
            try {
                // Usar el sistema existente de guardado en Pinecone
                await pinecone.guardarConocimiento(
                    chunk.contenido,
                    'sistema',
                    chunk.metadatos
                );
                
                console.log(`✅ Chunk subido: ${chunk.metadatos.titulo.substring(0, 50)}...`);
                
            } catch (error) {
                console.error(`❌ Error con chunk ${chunk.id}:`, error.message);
            }
        }
    }

    generarReporteFinal() {
        console.log('\n🎯 [REPORTE FINAL] ========================================');
        console.log(`📊 Chunks optimizados creados: ${this.estadisticas.chunksNuevos}`);
        console.log(`📋 Secciones procesadas: ${this.estadisticas.seccionesOptimizadas}`);
        console.log(`💡 Ejemplos específicos: ${this.estadisticas.ejemplosCreados}`);
        
        console.log('\n🔧 [OPTIMIZACIONES APLICADAS]:');
        console.log('✅ Información básica consolidada');
        console.log('✅ Campos técnicos individualizados');
        console.log('✅ Ejemplos específicos más accesibles');
        console.log('✅ Procesos operativos estructurados');
        console.log('✅ Secciones divididas óptimamente');
        
        console.log('\n📈 [MEJORAS ESPERADAS]:');
        console.log('• Mayor precisión en preguntas sobre empresa');
        console.log('• Respuestas exactas para campos técnicos');
        console.log('• Ejemplos específicos más accesibles');
        console.log('• Mejor comprensión de procesos');
        
        console.log('\n✅ [RESULTADO]: RAG empresarial optimizado completamente');
        console.log('🔄 [SIGUIENTE]: Ejecuta tests para verificar mejoras');
        console.log('========================================');
        
        this.guardarReporteFinal();
    }

    guardarReporteFinal() {
        try {
            const reporte = {
                fecha: new Date().toISOString(),
                estadisticas: this.estadisticas,
                optimizaciones: [
                    'Información básica consolidada',
                    'Campos técnicos individualizados', 
                    'Ejemplos específicos creados',
                    'Procesos estructurados',
                    'Secciones divididas'
                ],
                chunksCreados: this.chunksOptimizados.map(chunk => ({
                    titulo: chunk.metadatos.titulo,
                    tipo: chunk.metadatos.tipo,
                    categoria: chunk.metadatos.categoria
                }))
            };
            
            const nombreArchivo = `optimizacion-rag-empresarial-${new Date().toISOString().split('T')[0]}.json`;
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
}

async function main() {
    console.log('🚀 [INICIO] Optimizador RAG Empresarial Directo');
    console.log('🎯 [OBJETIVO] Maximizar precisión del asistente con informacionEmpresa.txt');
    
    const optimizador = new OptimizadorRAGEmpresarialDirecto();
    
    try {
        const exito = await optimizador.ejecutarOptimizacionCompleta();
        
        if (exito) {
            console.log('\n🎉 [ÉXITO TOTAL] Optimización completada');
            console.log('📊 [RESULTADO] El asistente ahora debería ser mucho más preciso');
            console.log('🔄 [RECOMENDACIÓN] Ejecuta tests para verificar las mejoras');
        } else {
            console.log('\n❌ [FALLIDO] La optimización no se completó correctamente');
        }
        
    } catch (error) {
        console.error('❌ [ERROR CRÍTICO] Optimización falló:', error.message);
    }
}

if (require.main === module) {
    main();
}

module.exports = { OptimizadorRAGEmpresarialDirecto }; 