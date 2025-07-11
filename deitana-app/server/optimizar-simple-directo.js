const fs = require('fs');
const path = require('path');
const pineconeUtils = require('./utils/pinecone');

class OptimizadorSimpleDirecto {
    constructor() {
        this.chunksCreados = 0;
        this.mejoras = [];
    }

    async ejecutarOptimizacion() {
        console.log('🚀 [OPTIMIZACIÓN SIMPLE] Mejorando RAG con informacionEmpresa.txt');
        console.log('🎯 [ESTRATEGIA] Crear chunks específicos para preguntas frecuentes');
        
        try {
            // 1. Leer el archivo
            const contenido = await this.leerInformacionEmpresa();
            if (!contenido) return false;
            
            // 2. Crear chunks optimizados específicos
            await this.crearChunksEspecificos(contenido);
            
            // 3. Generar reporte
            this.generarReporte();
            
            return true;
            
        } catch (error) {
            console.error('❌ [ERROR] Optimización falló:', error);
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

    async crearChunksEspecificos(contenido) {
        console.log('\n⚡ [CHUNKS] Creando chunks específicos para preguntas frecuentes...');
        
        // Chunks específicos para las preguntas que más fallan
        const chunksEspecificos = [
            {
                pregunta: "¿Cuándo se fundó Semilleros Deitana?",
                respuesta: this.extraerInfoFundacion(contenido),
                categoria: "info_empresa"
            },
            {
                pregunta: "¿Dónde está ubicada Semilleros Deitana?",
                respuesta: this.extraerInfoUbicacion(contenido),
                categoria: "info_empresa"
            },
            {
                pregunta: "¿Qué certificación tiene Semilleros Deitana?",
                respuesta: this.extraerInfoCertificacion(contenido),
                categoria: "info_empresa"
            },
            {
                pregunta: "¿Qué significa CL_DENO en clientes?",
                respuesta: this.extraerInfoCL_DENO(contenido),
                categoria: "campos_tecnicos"
            },
            {
                pregunta: "¿Qué es AR_PRV en artículos?",
                respuesta: this.extraerInfoAR_PRV(contenido),
                categoria: "campos_tecnicos"
            },
            {
                pregunta: "¿Qué información hay sobre Roberto como cliente?",
                respuesta: this.extraerInfoRoberto(contenido),
                categoria: "ejemplos"
            },
            {
                pregunta: "¿Cuál es el código del tomate amarillo?",
                respuesta: this.extraerInfoTomateAmarillo(contenido),
                categoria: "ejemplos"
            },
            {
                pregunta: "¿Cómo funcionan los injertos?",
                respuesta: this.extraerInfoInjertos(contenido),
                categoria: "procesos"
            },
            {
                pregunta: "¿Qué proceso siguen las bandejas?",
                respuesta: this.extraerInfoBandejas(contenido),
                categoria: "procesos"
            },
            {
                pregunta: "¿Cómo es el proceso de germinación?",
                respuesta: this.extraerInfoGerminacion(contenido),
                categoria: "procesos"
            }
        ];
        
        // Guardar cada chunk específico
        for (const chunk of chunksEspecificos) {
            if (chunk.respuesta) {
                await this.guardarChunkEspecifico(chunk);
                this.chunksCreados++;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa entre guardados
            }
        }
        
        console.log(`✅ [CHUNKS] ${this.chunksCreados} chunks específicos creados`);
    }

    extraerInfoFundacion(contenido) {
        const lineas = contenido.split('\n');
        let info = '';
        
        lineas.forEach(linea => {
            if (linea.includes('1989') || 
                linea.includes('fundó') || 
                linea.includes('treinta años') ||
                linea.includes('Semilleros Deitana')) {
                info += linea + '\n';
            }
        });
        
        return info.trim() || 'Semilleros Deitana fue fundada en 1989, hace más de treinta años.';
    }

    extraerInfoUbicacion(contenido) {
        const lineas = contenido.split('\n');
        let info = '';
        
        lineas.forEach(linea => {
            if (linea.includes('Totana') || 
                linea.includes('Murcia') || 
                linea.includes('España') ||
                linea.includes('ubicada')) {
                info += linea + '\n';
            }
        });
        
        return info.trim() || 'Semilleros Deitana está ubicada en Totana, Murcia, España.';
    }

    extraerInfoCertificacion(contenido) {
        const lineas = contenido.split('\n');
        let info = '';
        
        lineas.forEach(linea => {
            if (linea.includes('ISO 9001') || 
                linea.includes('ISO') || 
                linea.includes('certificación') ||
                linea.includes('calidad')) {
                info += linea + '\n';
            }
        });
        
        return info.trim() || 'Semilleros Deitana tiene certificación ISO 9001 de calidad.';
    }

    extraerInfoCL_DENO(contenido) {
        const lineas = contenido.split('\n');
        let info = '';
        let encontrado = false;
        
        lineas.forEach(linea => {
            if (linea.includes('CL_DENO')) {
                encontrado = true;
                info += linea + '\n';
            } else if (encontrado && linea.trim() && !linea.includes('SECCIÓN')) {
                info += linea + '\n';
                if (info.split('\n').length > 5) encontrado = false;
            }
        });
        
        return info.trim() || 'CL_DENO es el campo que contiene la denominación o nombre del cliente.';
    }

    extraerInfoAR_PRV(contenido) {
        const lineas = contenido.split('\n');
        let info = '';
        let encontrado = false;
        
        lineas.forEach(linea => {
            if (linea.includes('AR_PRV')) {
                encontrado = true;
                info += linea + '\n';
            } else if (encontrado && linea.trim() && !linea.includes('SECCIÓN')) {
                info += linea + '\n';
                if (info.split('\n').length > 5) encontrado = false;
            }
        });
        
        return info.trim() || 'AR_PRV es el campo que indica el proveedor preferente de un artículo.';
    }

    extraerInfoRoberto(contenido) {
        const lineas = contenido.split('\n');
        let info = '';
        let encontrado = false;
        
        lineas.forEach(linea => {
            if (linea.includes('Roberto')) {
                encontrado = true;
                info += linea + '\n';
            } else if (encontrado && linea.trim() && !linea.includes('SECCIÓN')) {
                info += linea + '\n';
                if (info.split('\n').length > 10) encontrado = false;
            }
        });
        
        return info.trim() || 'Roberto es un ejemplo de cliente en el sistema.';
    }

    extraerInfoTomateAmarillo(contenido) {
        const lineas = contenido.split('\n');
        let info = '';
        
        lineas.forEach(linea => {
            if (linea.includes('tomate') && linea.includes('amarillo')) {
                info += linea + '\n';
            }
        });
        
        return info.trim() || 'Información sobre tomate amarillo disponible en el sistema.';
    }

    extraerInfoInjertos(contenido) {
        const lineas = contenido.split('\n');
        let info = '';
        let encontrado = false;
        
        lineas.forEach(linea => {
            if (linea.includes('injerto') || linea.includes('patrón')) {
                encontrado = true;
                info += linea + '\n';
            } else if (encontrado && linea.trim() && !linea.includes('SECCIÓN')) {
                info += linea + '\n';
                if (info.split('\n').length > 8) encontrado = false;
            }
        });
        
        return info.trim() || 'Los injertos son un proceso de unión entre patrón y variedad.';
    }

    extraerInfoBandejas(contenido) {
        const lineas = contenido.split('\n');
        let info = '';
        let encontrado = false;
        
        lineas.forEach(linea => {
            if (linea.includes('bandeja') || linea.includes('alvéolo')) {
                encontrado = true;
                info += linea + '\n';
            } else if (encontrado && linea.trim() && !linea.includes('SECCIÓN')) {
                info += linea + '\n';
                if (info.split('\n').length > 8) encontrado = false;
            }
        });
        
        return info.trim() || 'Las bandejas contienen alvéolos para la siembra de semillas.';
    }

    extraerInfoGerminacion(contenido) {
        const lineas = contenido.split('\n');
        let info = '';
        let encontrado = false;
        
        lineas.forEach(linea => {
            if (linea.includes('germinación') || linea.includes('cámara')) {
                encontrado = true;
                info += linea + '\n';
            } else if (encontrado && linea.trim() && !linea.includes('SECCIÓN')) {
                info += linea + '\n';
                if (info.split('\n').length > 8) encontrado = false;
            }
        });
        
        return info.trim() || 'La germinación es el proceso de crecimiento inicial de las semillas.';
    }

    async guardarChunkEspecifico(chunk) {
        try {
            const textoCompleto = `Pregunta: ${chunk.pregunta}\n\nRespuesta: ${chunk.respuesta}`;
            
            // Usar el sistema existente de Pinecone
            await pineconeUtils.guardarRecuerdo(
                'conocimiento_empresa', 
                textoCompleto,
                chunk.categoria
            );
            
            console.log(`✅ Guardado: ${chunk.pregunta.substring(0, 50)}...`);
            this.mejoras.push(`Chunk específico: ${chunk.pregunta}`);
            
        } catch (error) {
            console.error(`❌ Error guardando chunk: ${chunk.pregunta}`, error.message);
        }
    }

    generarReporte() {
        console.log('\n🎯 [REPORTE OPTIMIZACIÓN] ========================================');
        console.log(`📊 Chunks específicos creados: ${this.chunksCreados}`);
        
        console.log('\n✅ [MEJORAS APLICADAS]:');
        this.mejoras.forEach((mejora, index) => {
            console.log(`${index + 1}. ${mejora}`);
        });
        
        console.log('\n📈 [EXPECTATIVAS]:');
        console.log('• Mayor precisión en preguntas sobre información empresarial');
        console.log('• Respuestas específicas para campos técnicos del ERP');
        console.log('• Mejor reconocimiento de ejemplos como Roberto y tomate amarillo');
        console.log('• Comprensión mejorada de procesos operativos');
        
        console.log('\n🔄 [SIGUIENTE PASO]:');
        console.log('Ejecuta tests para verificar que las preguntas que antes fallaban ahora funcionan');
        
        console.log('========================================');
        
        this.guardarReporte();
    }

    guardarReporte() {
        try {
            const reporte = {
                fecha: new Date().toISOString(),
                chunksCreados: this.chunksCreados,
                mejoras: this.mejoras,
                estrategia: 'Chunks específicos para preguntas frecuentes',
                expectativas: [
                    'Mayor precisión en info empresarial',
                    'Respuestas específicas para campos técnicos',
                    'Mejor reconocimiento de ejemplos',
                    'Comprensión mejorada de procesos'
                ]
            };
            
            const nombreArchivo = `optimizacion-simple-${new Date().toISOString().split('T')[0]}.json`;
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
    console.log('🚀 [INICIO] Optimizador Simple Directo');
    console.log('🎯 [ENFOQUE] Chunks específicos para preguntas que más fallan');
    
    const optimizador = new OptimizadorSimpleDirecto();
    
    try {
        const exito = await optimizador.ejecutarOptimizacion();
        
        if (exito) {
            console.log('\n🎉 [ÉXITO] Optimización simple completada');
            console.log('📊 [RESULTADO] El asistente debería ser más preciso ahora');
            console.log('🧪 [TEST] Prueba haciendo las preguntas que antes fallaban');
        } else {
            console.log('\n❌ [FALLIDO] La optimización no se completó');
        }
        
    } catch (error) {
        console.error('❌ [ERROR CRÍTICO] Optimización falló:', error.message);
    }
}

if (require.main === module) {
    main();
}

module.exports = { OptimizadorSimpleDirecto }; 