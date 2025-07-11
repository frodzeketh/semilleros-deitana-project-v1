const { recuperarConocimientoRelevante } = require('./admin/core/ragInteligente');
const fs = require('fs');
const path = require('path');

// ========================================
// SISTEMA DE DIAGNÓSTICO RAG EMPRESARIAL
// ========================================

class DiagnosticoRAGEmpresarial {
    constructor() {
        this.problemas = [];
        this.estadisticas = {
            chunksTotales: 0,
            chunksProblematicos: 0,
            palabrasClaveNoEncontradas: [],
            seccionesProblematicas: [],
            tiemposBusqueda: []
        };
    }

    async ejecutarDiagnosticoCompleto() {
        console.log('🔍 [DIAGNÓSTICO] Iniciando análisis completo del RAG empresarial...');
        
        await this.analizarChunksPorSeccion();
        await this.testearBusquedasEspecificas();
        await this.verificarCoberturaTematica();
        await this.analizarTiemposRespuesta();
        
        await this.generarReporteDiagnostico();
    }

    async analizarChunksPorSeccion() {
        console.log('📊 [ANÁLISIS] Verificando chunks por sección...');
        
        const seccionesEsperadas = [
            'CLIENTES', 'ARTÍCULOS', 'BANDEJAS', 'PROVEEDORES',
            'FORMAS DE PAGO', 'VENDEDORES', 'CASAS COMERCIALES',
            'ALMACENES', 'ENVASES DE VENTA', 'INVERNADEROS',
            'PRODUCTOS FITOSANITARIOS', 'SECTORES', 'SUSTRATOS',
            'UBICACIONES', 'ZONAS', 'DEPARTAMENTOS', 'PARTIDAS',
            'MAQUINARIA', 'TÉCNICOS'
        ];
        
        for (const seccion of seccionesEsperadas) {
            await this.verificarSeccionEspecifica(seccion);
        }
    }

    async verificarSeccionEspecifica(seccion) {
        console.log(`🔍 [SECCIÓN] Analizando: ${seccion}`);
        
        const consultasTest = [
            `información sobre ${seccion}`,
            `qué es ${seccion} en Semilleros Deitana`,
            `campos de ${seccion}`,
            `ejemplo de ${seccion}`
        ];
        
        let problemasSeccion = 0;
        
        for (const consulta of consultasTest) {
            try {
                const inicio = Date.now();
                const resultado = await recuperarConocimientoRelevante(consulta, 'sistema');
                const tiempo = Date.now() - inicio;
                
                this.estadisticas.tiemposBusqueda.push(tiempo);
                
                if (!resultado || resultado.length < 100) {
                    problemasSeccion++;
                    this.problemas.push({
                        tipo: 'SECCION_SIN_CONTEXTO',
                        seccion,
                        consulta,
                        problema: `No se encontró contexto suficiente para: ${consulta}`,
                        longitudResultado: resultado ? resultado.length : 0
                    });
                }
                
                // Verificar si contiene información relevante de la sección
                if (resultado && !this.contieneInformacionRelevante(resultado, seccion)) {
                    problemasSeccion++;
                    this.problemas.push({
                        tipo: 'SECCION_CONTEXTO_IRRELEVANTE',
                        seccion,
                        consulta,
                        problema: `El contexto no es específico de la sección ${seccion}`,
                        contextoObtenido: resultado.substring(0, 200) + '...'
                    });
                }
                
            } catch (error) {
                problemasSeccion++;
                this.problemas.push({
                    tipo: 'ERROR_BUSQUEDA',
                    seccion,
                    consulta,
                    error: error.message
                });
            }
        }
        
        if (problemasSeccion > 2) {
            this.estadisticas.seccionesProblematicas.push({
                seccion,
                problemasDetectados: problemasSeccion,
                severidad: problemasSeccion > 3 ? 'CRÍTICA' : 'ALTA'
            });
        }
    }

    contieneInformacionRelevante(contexto, seccion) {
        const palabrasClaveSeccion = {
            'CLIENTES': ['cl_deno', 'cl_dom', 'cl_iban', 'cliente', 'denominación'],
            'ARTÍCULOS': ['ar_deno', 'ar_prv', 'artículo', 'semilla', 'injerto'],
            'BANDEJAS': ['bn_alv', 'alvéolos', 'bandeja', 'reutilizable'],
            'PROVEEDORES': ['pr_deno', 'pr_fpg', 'proveedor', 'suministro'],
            'ALMACENES': ['am_deno', 'am_caja', 'almacén', 'delegación'],
            'PARTIDAS': ['par_enc', 'par_sem', 'partida', 'siembra', 'encargo'],
            'MAQUINARIA': ['ma_mod', 'ma_trab', 'maquinaria', 'equipo'],
            'TÉCNICOS': ['tn_deno', 'tn_act', 'técnico', 'trabajador']
        };
        
        const palabras = palabrasClaveSeccion[seccion] || [seccion.toLowerCase()];
        const contextoLower = contexto.toLowerCase();
        
        return palabras.some(palabra => contextoLower.includes(palabra.toLowerCase()));
    }

    async testearBusquedasEspecificas() {
        console.log('🎯 [BÚSQUEDAS] Testeando consultas específicas...');
        
        const consultasEspecificas = [
            // Información básica de la empresa
            { consulta: "Cuándo fue fundada Semilleros Deitana", esperado: "1989" },
            { consulta: "Dónde está ubicada Semilleros Deitana", esperado: "Totana, Murcia" },
            { consulta: "Qué certificación tiene Semilleros Deitana", esperado: "ISO 9001" },
            
            // Información técnica específica
            { consulta: "Qué significa CL_DENO", esperado: "denominación del cliente" },
            { consulta: "Para qué sirve AR_PRV", esperado: "proveedor" },
            { consulta: "Qué es BN_ALV", esperado: "alvéolos" },
            
            // Procesos específicos
            { consulta: "Tiempos de siembra de sandía", esperado: "35 días verano, 55-60 invierno" },
            { consulta: "Qué cultivos maneja Semilleros Deitana", esperado: "tomate, sandía, pepino, melón" },
            
            // Estructura del ERP
            { consulta: "Dónde se encuentran los clientes en el ERP", esperado: "Archivos – Generales – Clientes" },
            { consulta: "Ubicación de artículos en el ERP", esperado: "Archivos – Generales – Artículos" },
            
            // Datos específicos de ejemplo
            { consulta: "Ejemplo de cliente Roberto", esperado: "SANZ ORADOR" },
            { consulta: "Tomate amarelo código", esperado: "00000013" },
            { consulta: "Previcur energy dosis", esperado: "0.25" }
        ];
        
        for (const { consulta, esperado } of consultasEspecificas) {
            await this.verificarBusquedaEspecifica(consulta, esperado);
        }
    }

    async verificarBusquedaEspecifica(consulta, esperado) {
        try {
            const inicio = Date.now();
            const resultado = await recuperarConocimientoRelevante(consulta, 'sistema');
            const tiempo = Date.now() - inicio;
            
            this.estadisticas.tiemposBusqueda.push(tiempo);
            
            if (!resultado) {
                this.problemas.push({
                    tipo: 'BUSQUEDA_SIN_RESULTADO',
                    consulta,
                    esperado,
                    problema: 'No se obtuvo ningún resultado'
                });
                return;
            }
            
            const resultadoLower = resultado.toLowerCase();
            const esperadoLower = esperado.toLowerCase();
            
            if (!resultadoLower.includes(esperadoLower)) {
                this.problemas.push({
                    tipo: 'RESULTADO_INCOMPLETO',
                    consulta,
                    esperado,
                    problema: `El resultado no contiene la información esperada: "${esperado}"`,
                    contextoObtenido: resultado.substring(0, 300) + '...'
                });
                
                this.estadisticas.palabrasClaveNoEncontradas.push({
                    consulta,
                    palabraEsperada: esperado,
                    contextoLength: resultado.length
                });
            } else {
                console.log(`✅ [ÉXITO] ${consulta} -> Encontrado: ${esperado}`);
            }
            
        } catch (error) {
            this.problemas.push({
                tipo: 'ERROR_BUSQUEDA_ESPECIFICA',
                consulta,
                esperado,
                error: error.message
            });
        }
    }

    async verificarCoberturaTematica() {
        console.log('📋 [COBERTURA] Verificando cobertura temática...');
        
        const temasImportantes = [
            'fundación empresa',
            'ubicación sede',
            'certificaciones calidad',
            'liderazgo hermanos Galera',
            'técnicas injerto',
            'cultivos principales',
            'estructura ERP',
            'gestión clientes',
            'control artículos',
            'proceso partidas',
            'maquinaria empresa',
            'personal técnico',
            'productos fitosanitarios',
            'tarifas precios',
            'almacenes delegaciones'
        ];
        
        for (const tema of temasImportantes) {
            await this.verificarCoberturaTema(tema);
        }
    }

    async verificarCoberturaTema(tema) {
        try {
            const resultado = await recuperarConocimientoRelevante(tema, 'sistema');
            
            if (!resultado || resultado.length < 150) {
                this.problemas.push({
                    tipo: 'COBERTURA_INSUFICIENTE',
                    tema,
                    problema: `Cobertura insuficiente para el tema: ${tema}`,
                    longitudContexto: resultado ? resultado.length : 0
                });
            }
            
        } catch (error) {
            this.problemas.push({
                tipo: 'ERROR_COBERTURA',
                tema,
                error: error.message
            });
        }
    }

    async analizarTiemposRespuesta() {
        console.log('⏱️ [TIEMPOS] Analizando tiempos de respuesta...');
        
        if (this.estadisticas.tiemposBusqueda.length === 0) return;
        
        const tiempos = this.estadisticas.tiemposBusqueda;
        const promedio = tiempos.reduce((sum, t) => sum + t, 0) / tiempos.length;
        const maximo = Math.max(...tiempos);
        const minimo = Math.min(...tiempos);
        
        this.estadisticas.rendimiento = {
            tiempoPromedio: Math.round(promedio),
            tiempoMaximo: maximo,
            tiempoMinimo: minimo,
            busquedasLentas: tiempos.filter(t => t > 2000).length
        };
        
        if (promedio > 1500) {
            this.problemas.push({
                tipo: 'RENDIMIENTO_LENTO',
                problema: `Tiempo promedio muy alto: ${Math.round(promedio)}ms`,
                recomendacion: 'Optimizar índices de Pinecone o reducir tamaño de chunks'
            });
        }
        
        if (this.estadisticas.rendimiento.busquedasLentas > 5) {
            this.problemas.push({
                tipo: 'MULTIPLES_BUSQUEDAS_LENTAS',
                problema: `${this.estadisticas.rendimiento.busquedasLentas} búsquedas > 2 segundos`,
                recomendacion: 'Revisar configuración de embeddings'
            });
        }
    }

    async generarReporteDiagnostico() {
        const reporte = {
            resumen: {
                fecha: new Date().toISOString(),
                totalProblemas: this.problemas.length,
                problemasCriticos: this.problemas.filter(p => p.tipo.includes('SIN_RESULTADO')).length,
                seccionesProblematicas: this.estadisticas.seccionesProblematicas.length,
                rendimiento: this.estadisticas.rendimiento
            },
            problemasDetectados: this.problemas,
            estadisticas: this.estadisticas,
            recomendaciones: this.generarRecomendacionesEspecificas(),
            planAccion: this.generarPlanAccion()
        };
        
        // Guardar reporte
        const nombreArchivo = `diagnostico-rag-empresarial-${new Date().toISOString().split('T')[0]}.json`;
        const rutaArchivo = path.join(__dirname, 'reportes', nombreArchivo);
        
        // Crear directorio si no existe
        const dirReportes = path.dirname(rutaArchivo);
        if (!fs.existsSync(dirReportes)) {
            fs.mkdirSync(dirReportes, { recursive: true });
        }
        
        fs.writeFileSync(rutaArchivo, JSON.stringify(reporte, null, 2));
        
        // Mostrar resumen en consola
        console.log('\n🎯 [DIAGNÓSTICO COMPLETADO] ========================================');
        console.log(`📊 Total problemas detectados: ${reporte.resumen.totalProblemas}`);
        console.log(`🚨 Problemas críticos: ${reporte.resumen.problemasCriticos}`);
        console.log(`📋 Secciones problemáticas: ${reporte.resumen.seccionesProblematicas}`);
        
        if (this.estadisticas.rendimiento) {
            console.log(`⏱️ Tiempo promedio: ${this.estadisticas.rendimiento.tiempoPromedio}ms`);
            console.log(`🐌 Búsquedas lentas: ${this.estadisticas.rendimiento.busquedasLentas}`);
        }
        
        console.log(`📁 Reporte guardado: ${rutaArchivo}`);
        console.log('========================================');
        
        return reporte;
    }

    generarRecomendacionesEspecificas() {
        const recomendaciones = [];
        
        // Analizar tipos de problemas más frecuentes
        const tiposProblemas = {};
        this.problemas.forEach(p => {
            tiposProblemas[p.tipo] = (tiposProblemas[p.tipo] || 0) + 1;
        });
        
        for (const [tipo, count] of Object.entries(tiposProblemas)) {
            if (count >= 3) {
                switch (tipo) {
                    case 'SECCION_SIN_CONTEXTO':
                        recomendaciones.push({
                            prioridad: 'CRÍTICA',
                            problema: `${count} secciones sin contexto adecuado`,
                            solucion: 'Re-procesar informacionEmpresa.txt con chunks más específicos por sección',
                            accion: 'Ejecutar script de re-indexación con separación por secciones'
                        });
                        break;
                        
                    case 'RESULTADO_INCOMPLETO':
                        recomendaciones.push({
                            prioridad: 'ALTA',
                            problema: `${count} búsquedas con resultados incompletos`,
                            solucion: 'Mejorar embeddings y aumentar contexto de chunks relacionados',
                            accion: 'Ajustar parámetros de similitud en Pinecone'
                        });
                        break;
                        
                    case 'ERROR_BUSQUEDA':
                        recomendaciones.push({
                            prioridad: 'CRÍTICA',
                            problema: `${count} errores en búsquedas`,
                            solucion: 'Revisar configuración de Pinecone y conexión',
                            accion: 'Verificar API keys y configuración de conexión'
                        });
                        break;
                }
            }
        }
        
        // Recomendaciones de rendimiento
        if (this.estadisticas.rendimiento && this.estadisticas.rendimiento.tiempoPromedio > 1000) {
            recomendaciones.push({
                prioridad: 'MEDIA',
                problema: 'Tiempos de respuesta lentos',
                solucion: 'Optimizar configuración de Pinecone y reducir tamaño de chunks',
                accion: 'Revisar configuración de similarity_top_k y chunk_size'
            });
        }
        
        return recomendaciones;
    }

    generarPlanAccion() {
        return {
            inmediato: [
                'Ejecutar re-indexación completa de informacionEmpresa.txt',
                'Verificar conectividad con Pinecone',
                'Revisar configuración de embeddings'
            ],
            cortoplazo: [
                'Optimizar chunks por secciones específicas',
                'Ajustar parámetros de similitud',
                'Implementar cache de búsquedas frecuentes'
            ],
            mediano_plazo: [
                'Crear embeddings especializados por tipo de consulta',
                'Implementar sistema de feedback de calidad',
                'Monitoreo automático de rendimiento RAG'
            ]
        };
    }
}

// ========================================
// EJECUCIÓN PRINCIPAL
// ========================================

async function main() {
    console.log('🔍 [INICIO] Sistema de Diagnóstico RAG Empresarial');
    console.log('📋 [INFO] Analizando problemas específicos del RAG');
    console.log('🎯 [OBJETIVO] Identificar y solucionar fallos en informacionEmpresa.txt');
    
    const diagnostico = new DiagnosticoRAGEmpresarial();
    
    try {
        await diagnostico.ejecutarDiagnosticoCompleto();
        
        console.log('\n✅ [COMPLETADO] Diagnóstico finalizado');
        console.log('📁 [RESULTADO] Revisa el archivo de reporte generado');
        console.log('🔧 [SIGUIENTE] Implementa el plan de acción recomendado');
        
    } catch (error) {
        console.error('❌ [ERROR CRÍTICO] El diagnóstico falló:', error);
        console.error('🔍 [DEBUG] Stack trace:', error.stack);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main();
}

module.exports = { DiagnosticoRAGEmpresarial }; 