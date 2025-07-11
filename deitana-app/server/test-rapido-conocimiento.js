const { processQueryStream } = require('./admin/core/openAI');

// ========================================
// TEST RÁPIDO DE CONOCIMIENTO EMPRESARIAL
// ========================================

class TestRapidoConocimiento {
    constructor() {
        this.consultasTest = [
            // Información básica de la empresa
            "¿Cuándo fue fundada Semilleros Deitana?",
            "¿Dónde está ubicada Semilleros Deitana?",
            "¿Qué certificación de calidad tiene la empresa?",
            "¿Quiénes son los líderes de Semilleros Deitana?",
            
            // Información técnica específica
            "¿Qué significa CL_DENO en la tabla de clientes?",
            "¿Para qué sirve el campo AR_PRV en artículos?",
            "¿Qué es BN_ALV en las bandejas?",
            "¿Dónde se encuentra la información de clientes en el ERP?",
            
            // Procesos y productos
            "¿Cuántos días toma la siembra de sandía en verano?",
            "¿Qué cultivos maneja Semilleros Deitana?",
            "¿Cómo funcionan los injertos?",
            "¿Qué es un portainjerto?",
            
            // Ejemplos específicos
            "¿Cuál es el código del tomate amarelo?",
            "¿Qué información hay sobre Roberto como cliente ejemplo?",
            "¿Cuántos alvéolos tiene una bandeja forestal?",
            "¿Qué dosis tiene el Previcur Energy?"
        ];
        
        this.resultados = [];
    }

    async ejecutarTestRapido() {
        console.log('🚀 [TEST RÁPIDO] Iniciando test de conocimiento empresarial...');
        console.log(`📋 [INFO] Ejecutando ${this.consultasTest.length} consultas específicas`);
        console.log('⏱️ [ESTIMADO] Tiempo: 2-3 minutos\n');
        
        const inicioTotal = Date.now();
        
        for (let i = 0; i < this.consultasTest.length; i++) {
            const consulta = this.consultasTest[i];
            console.log(`\n🔍 [${i + 1}/${this.consultasTest.length}] ${consulta}`);
            
            const resultado = await this.testearConsultaIndividual(consulta, i + 1);
            this.resultados.push(resultado);
            
            // Mostrar resultado inmediato
            this.mostrarResultadoInmediato(resultado);
        }
        
        const tiempoTotal = Date.now() - inicioTotal;
        this.mostrarResumenFinal(tiempoTotal);
    }

    async testearConsultaIndividual(consulta, numero) {
        const inicio = Date.now();
        
        try {
            // Simular respuesta HTTP para el streaming
            let respuestaCapturada = '';
            const mockResponse = {
                writeHead: () => {},
                write: (data) => {
                    if (typeof data === 'string') {
                        respuestaCapturada += data;
                    }
                },
                end: () => {}
            };
            
            const resultado = await processQueryStream({
                message: consulta,
                userId: 'test-rapido-conocimiento',
                response: mockResponse
            });
            
            const tiempoRespuesta = Date.now() - inicio;
            
            // Analizar calidad de respuesta
            const analisis = this.analizarRespuesta(consulta, respuestaCapturada, numero);
            
            return {
                numero,
                consulta,
                tiempoRespuesta,
                exitosa: resultado.success,
                respuesta: respuestaCapturada.substring(0, 200) + '...',
                analisis,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            const tiempoRespuesta = Date.now() - inicio;
            
            return {
                numero,
                consulta,
                tiempoRespuesta,
                exitosa: false,
                error: error.message,
                analisis: {
                    puntuacion: 0,
                    razon: `Error del sistema: ${error.message}`,
                    categoria: 'ERROR'
                },
                timestamp: new Date().toISOString()
            };
        }
    }

    analizarRespuesta(consulta, respuesta, numero) {
        // Definir expectativas por tipo de consulta
        const expectativas = {
            "¿Cuándo fue fundada Semilleros Deitana?": {
                palabrasEsperadas: ['1989', 'fundada'],
                categoria: 'INFORMACION_BASICA'
            },
            "¿Dónde está ubicada Semilleros Deitana?": {
                palabrasEsperadas: ['Totana', 'Murcia', 'Carretera', 'Mazarrón'],
                categoria: 'INFORMACION_BASICA'
            },
            "¿Qué certificación de calidad tiene la empresa?": {
                palabrasEsperadas: ['ISO 9001', 'certificación'],
                categoria: 'INFORMACION_BASICA'
            },
            "¿Quiénes son los líderes de Semilleros Deitana?": {
                palabrasEsperadas: ['Galera', 'Antonio Francisco', 'José Luis', 'hermanos'],
                categoria: 'INFORMACION_BASICA'
            },
            "¿Qué significa CL_DENO en la tabla de clientes?": {
                palabrasEsperadas: ['denominación', 'nombre', 'cliente', 'razón social'],
                categoria: 'CAMPO_TECNICO'
            },
            "¿Para qué sirve el campo AR_PRV en artículos?": {
                palabrasEsperadas: ['proveedor', 'suministra', 'artículo'],
                categoria: 'CAMPO_TECNICO'
            },
            "¿Qué es BN_ALV en las bandejas?": {
                palabrasEsperadas: ['alvéolos', 'huecos', 'bandeja'],
                categoria: 'CAMPO_TECNICO'
            },
            "¿Cuántos días toma la siembra de sandía en verano?": {
                palabrasEsperadas: ['35 días', '35', 'verano', 'sandía'],
                categoria: 'PROCESO_TECNICO'
            },
            "¿Cuál es el código del tomate amarelo?": {
                palabrasEsperadas: ['00000013', 'TOMATE AMARELO'],
                categoria: 'DATO_ESPECIFICO'
            }
        };
        
        const expectativa = expectativas[consulta];
        if (!expectativa) {
            return {
                puntuacion: 5,
                razon: 'Consulta sin expectativas definidas - análisis básico',
                categoria: 'GENERAL'
            };
        }
        
        const respuestaLower = respuesta.toLowerCase();
        let palabrasEncontradas = 0;
        let palabrasFaltantes = [];
        
        expectativa.palabrasEsperadas.forEach(palabra => {
            if (respuestaLower.includes(palabra.toLowerCase())) {
                palabrasEncontradas++;
            } else {
                palabrasFaltantes.push(palabra);
            }
        });
        
        const porcentajeAcierto = (palabrasEncontradas / expectativa.palabrasEsperadas.length) * 100;
        let puntuacion = Math.round((porcentajeAcierto / 100) * 10);
        
        let razon = '';
        if (porcentajeAcierto >= 80) {
            razon = `Excelente - ${palabrasEncontradas}/${expectativa.palabrasEsperadas.length} palabras clave encontradas`;
        } else if (porcentajeAcierto >= 50) {
            razon = `Bueno - ${palabrasEncontradas}/${expectativa.palabrasEsperadas.length} palabras clave, faltan: ${palabrasFaltantes.join(', ')}`;
        } else {
            razon = `Deficiente - Solo ${palabrasEncontradas}/${expectativa.palabrasEsperadas.length} palabras clave, faltan: ${palabrasFaltantes.join(', ')}`;
        }
        
        return {
            puntuacion,
            porcentajeAcierto: Math.round(porcentajeAcierto),
            razon,
            categoria: expectativa.categoria,
            palabrasEncontradas,
            palabrasFaltantes
        };
    }

    mostrarResultadoInmediato(resultado) {
        if (resultado.exitosa) {
            const emoji = resultado.analisis.puntuacion >= 7 ? '✅' : 
                         resultado.analisis.puntuacion >= 5 ? '⚠️' : '❌';
            
            console.log(`${emoji} [${resultado.analisis.puntuacion}/10] ${resultado.analisis.razon}`);
            console.log(`⏱️ Tiempo: ${resultado.tiempoRespuesta}ms`);
            
            if (resultado.analisis.palabrasFaltantes && resultado.analisis.palabrasFaltantes.length > 0) {
                console.log(`🔍 Palabras faltantes: ${resultado.analisis.palabrasFaltantes.join(', ')}`);
            }
        } else {
            console.log(`❌ [ERROR] ${resultado.error || 'Sin respuesta'}`);
            console.log(`⏱️ Tiempo: ${resultado.tiempoRespuesta}ms`);
        }
    }

    mostrarResumenFinal(tiempoTotal) {
        const exitosas = this.resultados.filter(r => r.exitosa).length;
        const fallidas = this.resultados.length - exitosas;
        
        const puntuaciones = this.resultados
            .filter(r => r.exitosa)
            .map(r => r.analisis.puntuacion);
        
        const promedioGeneral = puntuaciones.length > 0 ? 
            Math.round((puntuaciones.reduce((sum, p) => sum + p, 0) / puntuaciones.length) * 10) / 10 : 0;
        
        const tiempoPromedio = Math.round(
            this.resultados.reduce((sum, r) => sum + r.tiempoRespuesta, 0) / this.resultados.length
        );
        
        // Análisis por categorías
        const categorias = {};
        this.resultados.forEach(r => {
            if (r.exitosa) {
                const cat = r.analisis.categoria;
                if (!categorias[cat]) {
                    categorias[cat] = { total: 0, suma: 0, promedio: 0 };
                }
                categorias[cat].total++;
                categorias[cat].suma += r.analisis.puntuacion;
            }
        });
        
        Object.keys(categorias).forEach(cat => {
            categorias[cat].promedio = Math.round((categorias[cat].suma / categorias[cat].total) * 10) / 10;
        });
        
        console.log('\n🎯 [RESUMEN FINAL] ========================================');
        console.log(`📊 Total consultas: ${this.resultados.length}`);
        console.log(`✅ Exitosas: ${exitosas} (${Math.round((exitosas/this.resultados.length)*100)}%)`);
        console.log(`❌ Fallidas: ${fallidas}`);
        console.log(`📈 Puntuación promedio: ${promedioGeneral}/10`);
        console.log(`⏱️ Tiempo promedio: ${tiempoPromedio}ms`);
        console.log(`🕐 Tiempo total: ${Math.round(tiempoTotal/1000)}s`);
        
        console.log('\n📋 [ANÁLISIS POR CATEGORÍAS]');
        Object.keys(categorias).forEach(cat => {
            const info = categorias[cat];
            console.log(`   ${cat}: ${info.promedio}/10 (${info.total} consultas)`);
        });
        
        // Identificar problemas principales
        const problematicos = this.resultados.filter(r => 
            !r.exitosa || (r.analisis && r.analisis.puntuacion < 5)
        );
        
        if (problematicos.length > 0) {
            console.log('\n⚠️ [PROBLEMAS DETECTADOS]');
            problematicos.forEach(p => {
                console.log(`   • ${p.consulta}`);
                console.log(`     Razón: ${p.analisis?.razon || p.error || 'Error desconocido'}`);
            });
        }
        
        // Recomendaciones rápidas
        console.log('\n🔧 [RECOMENDACIONES INMEDIATAS]');
        if (promedioGeneral < 6) {
            console.log('   • CRÍTICO: Puntuación muy baja - ejecutar diagnóstico completo');
        } else if (promedioGeneral < 7.5) {
            console.log('   • MEJORABLE: Considerar optimización de chunks específicos');
        } else {
            console.log('   • BUENO: Sistema funcionando adecuadamente');
        }
        
        if (tiempoPromedio > 2000) {
            console.log('   • LENTO: Tiempos de respuesta altos - revisar configuración');
        }
        
        if (fallidas > 2) {
            console.log('   • ERRORES: Múltiples fallos - verificar conectividad');
        }
        
        console.log('========================================');
    }
}

// ========================================
// EJECUCIÓN PRINCIPAL
// ========================================

async function main() {
    console.log('🚀 [INICIO] Test Rápido de Conocimiento Empresarial');
    console.log('📋 [INFO] Evaluación rápida del estado actual del RAG');
    console.log('🎯 [OBJETIVO] Detectar problemas críticos inmediatos');
    
    const testRapido = new TestRapidoConocimiento();
    
    try {
        await testRapido.ejecutarTestRapido();
        
        console.log('\n✅ [COMPLETADO] Test rápido finalizado');
        console.log('🔍 [SIGUIENTE] Si hay problemas, ejecuta el sistema completo de optimización');
        
    } catch (error) {
        console.error('❌ [ERROR CRÍTICO] El test rápido falló:', error);
        console.error('🔍 [DEBUG] Stack trace:', error.stack);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main();
}

module.exports = { TestRapidoConocimiento }; 