const { SistemaTestingConocimiento } = require('./test-sistema-conocimiento-empresarial');
const { DiagnosticoRAGEmpresarial } = require('./test-diagnostico-rag-empresarial');
const { OptimizadorRAGEmpresarial } = require('./optimizacion-rag-empresarial');
const fs = require('fs');
const path = require('path');

// ========================================
// MAESTRO DE OPTIMIZACIÓN DE CONOCIMIENTO
// ========================================

class MaestroOptimizacionConocimiento {
    constructor() {
        this.faseActual = 0;
        this.resultados = {
            testingInicial: null,
            diagnostico: null,
            optimizacion: null,
            testingFinal: null,
            comparacion: null
        };
        
        this.fases = [
            { nombre: 'Testing Inicial', descripcion: 'Evaluar estado actual del RAG' },
            { nombre: 'Diagnóstico', descripcion: 'Identificar problemas específicos' },
            { nombre: 'Optimización', descripcion: 'Aplicar mejoras al sistema' },
            { nombre: 'Testing Final', descripcion: 'Validar mejoras implementadas' },
            { nombre: 'Comparación', descripcion: 'Analizar resultados antes/después' }
        ];
    }

    async ejecutarProcesoCompleto() {
        console.log('🎯 [MAESTRO] Iniciando proceso completo de optimización de conocimiento');
        console.log('📋 [INFO] Este proceso ejecutará 5 fases principales:');
        this.fases.forEach((fase, index) => {
            console.log(`   ${index + 1}. ${fase.nombre}: ${fase.descripcion}`);
        });
        console.log('⏱️ [ESTIMADO] Tiempo total: 2-3 horas');
        console.log('🚀 [INICIO] Comenzando proceso...\n');
        
        const inicioTotal = Date.now();
        
        try {
            // FASE 1: Testing inicial para establecer baseline
            await this.ejecutarFase1TestingInicial();
            
            // FASE 2: Diagnóstico profundo de problemas
            await this.ejecutarFase2Diagnostico();
            
            // FASE 3: Optimización del sistema
            await this.ejecutarFase3Optimizacion();
            
            // FASE 4: Testing final para validar mejoras
            await this.ejecutarFase4TestingFinal();
            
            // FASE 5: Comparación y análisis de resultados
            await this.ejecutarFase5Comparacion();
            
            const tiempoTotal = Date.now() - inicioTotal;
            await this.generarReporteExecutivo(tiempoTotal);
            
        } catch (error) {
            console.error('❌ [ERROR CRÍTICO] El proceso maestro falló:', error);
            await this.generarReporteError(error);
        }
    }

    async ejecutarFase1TestingInicial() {
        this.faseActual = 1;
        console.log('\n🔥 [FASE 1/5] TESTING INICIAL - Estableciendo Baseline');
        console.log('📊 [INFO] Ejecutando 400 preguntas para evaluar estado actual...');
        
        try {
            const sistemaTest = new SistemaTestingConocimiento();
            this.resultados.testingInicial = await sistemaTest.ejecutarBateriaCompleta();
            
            console.log('✅ [FASE 1] Completada - Baseline establecido');
            console.log(`📊 [BASELINE] Tasa de éxito inicial: ${this.resultados.testingInicial.estadisticas.tasaExitoGeneral}%`);
            
        } catch (error) {
            console.error('❌ [FASE 1] Error en testing inicial:', error);
            throw error;
        }
    }

    async ejecutarFase2Diagnostico() {
        this.faseActual = 2;
        console.log('\n🔍 [FASE 2/5] DIAGNÓSTICO - Identificando Problemas');
        console.log('🩺 [INFO] Analizando problemas específicos del RAG...');
        
        try {
            const diagnostico = new DiagnosticoRAGEmpresarial();
            this.resultados.diagnostico = await diagnostico.ejecutarDiagnosticoCompleto();
            
            console.log('✅ [FASE 2] Completada - Problemas identificados');
            console.log(`🚨 [DIAGNÓSTICO] ${this.resultados.diagnostico.resumen.totalProblemas} problemas detectados`);
            
        } catch (error) {
            console.error('❌ [FASE 2] Error en diagnóstico:', error);
            throw error;
        }
    }

    async ejecutarFase3Optimizacion() {
        this.faseActual = 3;
        console.log('\n⚡ [FASE 3/5] OPTIMIZACIÓN - Aplicando Mejoras');
        console.log('🔧 [INFO] Optimizando chunks y reindexando...');
        
        try {
            const optimizador = new OptimizadorRAGEmpresarial();
            this.resultados.optimizacion = await optimizador.ejecutarOptimizacionCompleta();
            
            console.log('✅ [FASE 3] Completada - Optimizaciones aplicadas');
            console.log(`📈 [OPTIMIZACIÓN] ${this.resultados.optimizacion.resumen.chunksOptimizados} chunks optimizados`);
            
        } catch (error) {
            console.error('❌ [FASE 3] Error en optimización:', error);
            throw error;
        }
    }

    async ejecutarFase4TestingFinal() {
        this.faseActual = 4;
        console.log('\n🎯 [FASE 4/5] TESTING FINAL - Validando Mejoras');
        console.log('📊 [INFO] Ejecutando 400 preguntas para validar optimización...');
        
        try {
            // Esperar un poco para que los cambios se propaguen
            console.log('⏳ [INFO] Esperando propagación de cambios (30 segundos)...');
            await new Promise(resolve => setTimeout(resolve, 30000));
            
            const sistemaTest = new SistemaTestingConocimiento();
            this.resultados.testingFinal = await sistemaTest.ejecutarBateriaCompleta();
            
            console.log('✅ [FASE 4] Completada - Validación finalizada');
            console.log(`📊 [RESULTADO] Tasa de éxito final: ${this.resultados.testingFinal.estadisticas.tasaExitoGeneral}%`);
            
        } catch (error) {
            console.error('❌ [FASE 4] Error en testing final:', error);
            throw error;
        }
    }

    async ejecutarFase5Comparacion() {
        this.faseActual = 5;
        console.log('\n📊 [FASE 5/5] COMPARACIÓN - Analizando Resultados');
        console.log('🔍 [INFO] Comparando resultados antes/después...');
        
        try {
            this.resultados.comparacion = this.analizarComparacion();
            
            console.log('✅ [FASE 5] Completada - Análisis finalizado');
            this.mostrarResumenComparacion();
            
        } catch (error) {
            console.error('❌ [FASE 5] Error en comparación:', error);
            throw error;
        }
    }

    analizarComparacion() {
        const inicial = this.resultados.testingInicial;
        const final = this.resultados.testingFinal;
        
        const comparacion = {
            metricas: {
                tasaExitoInicial: inicial.estadisticas.tasaExitoGeneral,
                tasaExitoFinal: final.estadisticas.tasaExitoGeneral,
                mejoraPorcentual: final.estadisticas.tasaExitoGeneral - inicial.estadisticas.tasaExitoGeneral,
                
                tiempoInicialMs: inicial.estadisticas.tiempoPromedioMs,
                tiempoFinalMs: final.estadisticas.tiempoPromedioMs,
                mejoraVelocidad: inicial.estadisticas.tiempoPromedioMs - final.estadisticas.tiempoPromedioMs,
                
                fallosInicial: inicial.problemasCriticos.length,
                fallosFinal: final.problemasCriticos.length,
                reduccionFallos: inicial.problemasCriticos.length - final.problemasCriticos.length
            },
            
            analisis: {
                mejoraSignificativa: false,
                problemasResueltos: [],
                problemasRestantes: [],
                nuevosProblemas: []
            },
            
            recomendaciones: []
        };
        
        // Determinar si la mejora es significativa
        comparacion.analisis.mejoraSignificativa = comparacion.metricas.mejoraPorcentual >= 10;
        
        // Analizar problemas resueltos
        const problemasIniciales = new Set(inicial.problemasCriticos.map(p => p.pregunta));
        const problemasFinales = new Set(final.problemasCriticos.map(p => p.pregunta));
        
        comparacion.analisis.problemasResueltos = inicial.problemasCriticos.filter(
            p => !problemasFinales.has(p.pregunta)
        );
        
        comparacion.analisis.problemasRestantes = final.problemasCriticos.filter(
            p => problemasIniciales.has(p.pregunta)
        );
        
        comparacion.analisis.nuevosProblemas = final.problemasCriticos.filter(
            p => !problemasIniciales.has(p.pregunta)
        );
        
        // Generar recomendaciones
        this.generarRecomendacionesComparacion(comparacion);
        
        return comparacion;
    }

    generarRecomendacionesComparacion(comparacion) {
        const { metricas, analisis } = comparacion;
        
        if (metricas.mejoraPorcentual >= 15) {
            comparacion.recomendaciones.push({
                tipo: 'ÉXITO',
                mensaje: 'Optimización muy exitosa. Considerar aplicar estas técnicas a otros módulos.',
                prioridad: 'BAJA'
            });
        } else if (metricas.mejoraPorcentual >= 5) {
            comparacion.recomendaciones.push({
                tipo: 'MEJORA_MODERADA',
                mensaje: 'Mejora positiva. Revisar problemas restantes para optimización adicional.',
                prioridad: 'MEDIA'
            });
        } else if (metricas.mejoraPorcentual < 0) {
            comparacion.recomendaciones.push({
                tipo: 'REGRESIÓN',
                mensaje: 'CRÍTICO: La optimización causó regresión. Revisar cambios inmediatamente.',
                prioridad: 'CRÍTICA'
            });
        }
        
        if (analisis.nuevosProblemas.length > 10) {
            comparacion.recomendaciones.push({
                tipo: 'NUEVOS_PROBLEMAS',
                mensaje: `${analisis.nuevosProblemas.length} nuevos problemas detectados. Revisar chunks optimizados.`,
                prioridad: 'ALTA'
            });
        }
        
        if (metricas.mejoraVelocidad > 500) {
            comparacion.recomendaciones.push({
                tipo: 'RENDIMIENTO',
                mensaje: 'Mejora significativa en velocidad. Optimización de embeddings exitosa.',
                prioridad: 'BAJA'
            });
        }
    }

    mostrarResumenComparacion() {
        const comp = this.resultados.comparacion;
        
        console.log('\n📊 [RESUMEN COMPARATIVO] ========================================');
        console.log(`✅ Tasa de éxito: ${comp.metricas.tasaExitoInicial}% → ${comp.metricas.tasaExitoFinal}% (${comp.metricas.mejoraPorcentual >= 0 ? '+' : ''}${comp.metricas.mejoraPorcentual}%)`);
        console.log(`⏱️ Tiempo promedio: ${comp.metricas.tiempoInicialMs}ms → ${comp.metricas.tiempoFinalMs}ms (${comp.metricas.mejoraVelocidad >= 0 ? '-' : '+'}${Math.abs(comp.metricas.mejoraVelocidad)}ms)`);
        console.log(`❌ Fallos críticos: ${comp.metricas.fallosInicial} → ${comp.metricas.fallosFinal} (${comp.metricas.reduccionFallos >= 0 ? '-' : '+'}${Math.abs(comp.metricas.reduccionFallos)})`);
        console.log(`🔧 Problemas resueltos: ${comp.analisis.problemasResueltos.length}`);
        console.log(`⚠️ Problemas restantes: ${comp.analisis.problemasRestantes.length}`);
        console.log(`🆕 Nuevos problemas: ${comp.analisis.nuevosProblemas.length}`);
        console.log('========================================');
    }

    async generarReporteExecutivo(tiempoTotal) {
        const reporte = {
            resumenEjecutivo: {
                fecha: new Date().toISOString(),
                tiempoTotalHoras: Math.round(tiempoTotal / 3600000 * 100) / 100,
                fasesCompletadas: this.faseActual,
                exito: this.faseActual === 5,
                mejoraGeneral: this.resultados.comparacion?.metricas.mejoraPorcentual || 0
            },
            
            resultadosDetallados: {
                testingInicial: this.resultados.testingInicial?.resumenEjecutivo,
                diagnostico: this.resultados.diagnostico?.resumen,
                optimizacion: this.resultados.optimizacion?.resumen,
                testingFinal: this.resultados.testingFinal?.resumenEjecutivo,
                comparacion: this.resultados.comparacion
            },
            
            conclusiones: this.generarConclusiones(),
            planSeguimiento: this.generarPlanSeguimiento()
        };
        
        // Guardar reporte ejecutivo
        const nombreArchivo = `reporte-ejecutivo-optimizacion-${new Date().toISOString().split('T')[0]}.json`;
        const rutaArchivo = path.join(__dirname, 'reportes', nombreArchivo);
        
        // Crear directorio si no existe
        const dirReportes = path.dirname(rutaArchivo);
        if (!fs.existsSync(dirReportes)) {
            fs.mkdirSync(dirReportes, { recursive: true });
        }
        
        fs.writeFileSync(rutaArchivo, JSON.stringify(reporte, null, 2));
        
        console.log('\n🎯 [PROCESO COMPLETADO] ========================================');
        console.log(`⏱️ Tiempo total: ${reporte.resumenEjecutivo.tiempoTotalHoras} horas`);
        console.log(`📊 Fases completadas: ${reporte.resumenEjecutivo.fasesCompletadas}/5`);
        console.log(`📈 Mejora general: ${reporte.resumenEjecutivo.mejoraGeneral}%`);
        console.log(`📁 Reporte ejecutivo: ${rutaArchivo}`);
        console.log('========================================');
        
        return reporte;
    }

    async generarReporteError(error) {
        const reporteError = {
            error: {
                fecha: new Date().toISOString(),
                faseError: this.faseActual,
                mensaje: error.message,
                stack: error.stack
            },
            resultadosParciales: this.resultados,
            recomendaciones: [
                'Revisar logs específicos de la fase que falló',
                'Verificar configuración de Pinecone y OpenAI',
                'Comprobar conectividad y permisos',
                'Ejecutar diagnóstico individual de la fase fallida'
            ]
        };
        
        const nombreArchivo = `reporte-error-optimizacion-${new Date().toISOString().split('T')[0]}.json`;
        const rutaArchivo = path.join(__dirname, 'reportes', nombreArchivo);
        
        const dirReportes = path.dirname(rutaArchivo);
        if (!fs.existsSync(dirReportes)) {
            fs.mkdirSync(dirReportes, { recursive: true });
        }
        
        fs.writeFileSync(rutaArchivo, JSON.stringify(reporteError, null, 2));
        
        console.log(`❌ [ERROR] Reporte de error guardado: ${rutaArchivo}`);
    }

    generarConclusiones() {
        const conclusiones = [];
        
        if (this.resultados.comparacion) {
            const mejora = this.resultados.comparacion.metricas.mejoraPorcentual;
            
            if (mejora >= 20) {
                conclusiones.push('Optimización altamente exitosa con mejoras significativas');
            } else if (mejora >= 10) {
                conclusiones.push('Optimización exitosa con mejoras notables');
            } else if (mejora >= 5) {
                conclusiones.push('Optimización moderadamente exitosa');
            } else if (mejora < 0) {
                conclusiones.push('CRÍTICO: Optimización causó regresión en el rendimiento');
            } else {
                conclusiones.push('Optimización con mejoras mínimas - revisar estrategia');
            }
            
            if (this.resultados.comparacion.analisis.problemasResueltos.length > 50) {
                conclusiones.push('Alto número de problemas específicos resueltos');
            }
            
            if (this.resultados.comparacion.metricas.mejoraVelocidad > 200) {
                conclusiones.push('Mejora significativa en velocidad de respuesta');
            }
        }
        
        return conclusiones;
    }

    generarPlanSeguimiento() {
        return {
            inmediato: [
                'Monitorear rendimiento en las próximas 24 horas',
                'Revisar logs de errores en producción',
                'Validar que no hay regresiones en funcionalidad'
            ],
            semanaUno: [
                'Ejecutar testing reducido diario',
                'Recopilar feedback de usuarios',
                'Ajustar parámetros si es necesario'
            ],
            mensual: [
                'Ejecutar batería completa de testing',
                'Revisar métricas de uso y satisfacción',
                'Planificar siguiente ciclo de optimización'
            ]
        };
    }
}

// ========================================
// EJECUCIÓN PRINCIPAL
// ========================================

async function main() {
    console.log('🎯 [MAESTRO] Sistema Maestro de Optimización de Conocimiento');
    console.log('📋 [INFO] Este sistema ejecutará un proceso completo de optimización');
    console.log('🚀 [OBJETIVO] Mejorar drásticamente el rendimiento del RAG empresarial');
    console.log('⚠️ [ADVERTENCIA] Proceso largo (2-3 horas) - Asegurar estabilidad del sistema');
    
    const maestro = new MaestroOptimizacionConocimiento();
    
    try {
        await maestro.ejecutarProcesoCompleto();
        
        console.log('\n🎉 [ÉXITO TOTAL] Proceso maestro completado exitosamente');
        console.log('📊 [RESULTADO] Revisa el reporte ejecutivo para análisis completo');
        console.log('🔄 [SIGUIENTE] Implementa el plan de seguimiento recomendado');
        
    } catch (error) {
        console.error('💥 [FALLO CRÍTICO] El proceso maestro falló:', error);
        console.error('🔍 [DEBUG] Revisa el reporte de error generado');
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main();
}

module.exports = { MaestroOptimizacionConocimiento }; 