const { SistemaTestingConocimiento } = require('./test-sistema-conocimiento-empresarial');
const { DiagnosticoRAGEmpresarial } = require('./test-diagnostico-rag-empresarial');
const fs = require('fs');
const path = require('path');

class TestingUltraRapido {
    constructor() {
        this.preguntasCriticas = [
            // Información básica empresa (5 preguntas)
            "¿Cuándo se fundó Semilleros Deitana?",
            "¿Dónde está ubicada la empresa?",
            "¿Qué certificación tiene Semilleros Deitana?",
            
            // Campos técnicos críticos (5 preguntas)
            "¿Qué significa CL_DENO en clientes?",
            "¿Qué es AR_PRV en artículos?",
            
            // Ejemplos específicos (5 preguntas)
            "¿Qué información hay sobre Roberto como cliente ejemplo?",
            "¿Cuál es el código del tomate amarillo?",
            
            // Procesos operativos (5 preguntas)
            "¿Cómo funcionan los injertos?",
            "¿Cuál es el proceso de siembra?",
            "¿Cómo se gestionan las bandejas?"
        ];
        
        this.resultados = [];
        this.fallos = [];
        this.tiempos = [];
    }

    async ejecutarTestRapido() {
        console.log('🚀 [ULTRA-RÁPIDO] Iniciando evaluación crítica (15 preguntas)');
        console.log('⏱️ [INFO] Tiempo estimado: 2-3 minutos');
        
        const inicio = Date.now();
        let exitosos = 0;
        
        for (let i = 0; i < this.preguntasCriticas.length; i++) {
            const pregunta = this.preguntasCriticas[i];
            console.log(`\n📋 [${i + 1}/15] ${pregunta}`);
            
            try {
                const inicioTest = Date.now();
                const resultado = await this.evaluarPreguntaCritica(pregunta);
                const tiempo = Date.now() - inicioTest;
                
                this.tiempos.push(tiempo);
                
                if (resultado.exito) {
                    console.log(`✅ ÉXITO (${tiempo}ms)`);
                    exitosos++;
                } else {
                    console.log(`❌ FALLO (${tiempo}ms): ${resultado.razon}`);
                    this.fallos.push({ pregunta, razon: resultado.razon, tiempo });
                }
                
                this.resultados.push({ pregunta, ...resultado, tiempo });
                
            } catch (error) {
                console.log(`💥 ERROR: ${error.message}`);
                this.fallos.push({ pregunta, razon: error.message, tiempo: 0 });
            }
        }
        
        const tiempoTotal = Date.now() - inicio;
        
        return this.generarReporteRapido(exitosos, tiempoTotal);
    }

    async evaluarPreguntaCritica(pregunta) {
        try {
            // Simular llamada al chat (usando el mismo sistema que las 400 preguntas)
            const { openAIAdmin } = require('./admin/core/openAI');
            const mapaERP = require('./admin/core/mapaERP');
            
            const inicio = Date.now();
            
            const respuesta = await openAIAdmin.procesarConsultaStream(
                pregunta,
                'test-ultra-rapido',
                mapaERP,
                true // stream = true
            );
            
            const tiempo = Date.now() - inicio;
            
            // Evaluar calidad de la respuesta
            const evaluacion = this.evaluarCalidadRespuesta(pregunta, respuesta, tiempo);
            
            return evaluacion;
            
        } catch (error) {
            return {
                exito: false,
                razon: `Error en consulta: ${error.message}`,
                respuesta: null,
                tiempoMs: 0
            };
        }
    }

    evaluarCalidadRespuesta(pregunta, respuesta, tiempo) {
        // Criterios de evaluación rápida
        const criterios = {
            tieneRespuesta: respuesta && respuesta.length > 50,
            noEsGenerico: !this.esRespuestaGenerica(respuesta),
            contieneInformacionEspecifica: this.contieneInfoEspecifica(pregunta, respuesta),
            velocidadAceptable: tiempo < 15000 // 15 segundos máximo
        };
        
        const puntuacion = Object.values(criterios).filter(Boolean).length;
        const exito = puntuacion >= 3; // Al menos 3 de 4 criterios
        
        let razon = '';
        if (!criterios.tieneRespuesta) razon += 'Sin respuesta adecuada. ';
        if (!criterios.noEsGenerico) razon += 'Respuesta muy genérica. ';
        if (!criterios.contieneInformacionEspecifica) razon += 'Falta información específica. ';
        if (!criterios.velocidadAceptable) razon += `Muy lento (${tiempo}ms). `;
        
        return {
            exito,
            razon: exito ? 'Respuesta satisfactoria' : razon.trim(),
            respuesta,
            tiempoMs: tiempo,
            puntuacion,
            criterios
        };
    }

    esRespuestaGenerica(respuesta) {
        const frasesGenericas = [
            'no tengo información',
            'no encuentro datos',
            'necesitaría más información',
            'consulta la documentación',
            'no está especificado',
            'información no disponible'
        ];
        
        return frasesGenericas.some(frase => 
            respuesta.toLowerCase().includes(frase.toLowerCase())
        );
    }

    contieneInfoEspecifica(pregunta, respuesta) {
        // Mapeo pregunta -> información esperada
        const esperado = {
            'fundó': ['1989', 'treinta', '30'],
            'ubicada': ['Totana', 'Murcia', 'España'],
            'certificación': ['ISO 9001', 'ISO'],
            'CL_DENO': ['denominación', 'nombre', 'cliente'],
            'AR_PRV': ['proveedor', 'proveedor preferente'],
            'Roberto': ['Roberto', 'cliente'],
            'tomate amarillo': ['tomate', 'amarillo', 'código'],
            'injertos': ['injerto', 'patrón', 'variedad'],
            'siembra': ['siembra', 'semilla', 'bandeja'],
            'bandejas': ['bandeja', 'alvéolo', 'siembra']
        };
        
        for (const [clave, terminos] of Object.entries(esperado)) {
            if (pregunta.toLowerCase().includes(clave)) {
                return terminos.some(termino => 
                    respuesta.toLowerCase().includes(termino.toLowerCase())
                );
            }
        }
        
        return true; // Si no encuentra mapeo específico, asume que es válido
    }

    generarReporteRapido(exitosos, tiempoTotal) {
        const tasaExito = Math.round((exitosos / this.preguntasCriticas.length) * 100);
        const tiempoPromedio = Math.round(this.tiempos.reduce((a, b) => a + b, 0) / this.tiempos.length);
        
        const reporte = {
            resumen: {
                fecha: new Date().toISOString(),
                totalPreguntas: this.preguntasCriticas.length,
                exitosos,
                fallos: this.fallos.length,
                tasaExito,
                tiempoTotalMs: tiempoTotal,
                tiempoPromedioMs: tiempoPromedio
            },
            
            problemasCriticos: this.fallos,
            
            estadisticas: {
                tiempoMinimo: Math.min(...this.tiempos),
                tiempoMaximo: Math.max(...this.tiempos),
                preguntasLentas: this.tiempos.filter(t => t > 10000).length
            },
            
            recomendaciones: this.generarRecomendacionesRapidas(tasaExito, tiempoPromedio)
        };
        
        // Guardar reporte
        this.guardarReporte(reporte);
        
        // Mostrar resumen
        this.mostrarResumen(reporte);
        
        return reporte;
    }

    generarRecomendacionesRapidas(tasaExito, tiempoPromedio) {
        const recomendaciones = [];
        
        if (tasaExito < 60) {
            recomendaciones.push({
                prioridad: 'CRÍTICA',
                problema: 'Tasa de éxito muy baja',
                accion: 'Ejecutar diagnóstico completo y optimización RAG inmediata'
            });
        } else if (tasaExito < 80) {
            recomendaciones.push({
                prioridad: 'ALTA',
                problema: 'Tasa de éxito mejorable',
                accion: 'Optimizar chunks específicos de información empresarial'
            });
        }
        
        if (tiempoPromedio > 8000) {
            recomendaciones.push({
                prioridad: 'MEDIA',
                problema: 'Respuestas lentas',
                accion: 'Optimizar configuración de embeddings y Pinecone'
            });
        }
        
        if (this.fallos.length > 5) {
            recomendaciones.push({
                prioridad: 'ALTA',
                problema: 'Muchos fallos en preguntas básicas',
                accion: 'Revisar y reindexar informacionEmpresa.txt'
            });
        }
        
        return recomendaciones;
    }

    guardarReporte(reporte) {
        const nombreArchivo = `reporte-ultra-rapido-${new Date().toISOString().split('T')[0]}.json`;
        const rutaArchivo = path.join(__dirname, 'reportes', nombreArchivo);
        
        // Crear directorio si no existe
        const dirReportes = path.dirname(rutaArchivo);
        if (!fs.existsSync(dirReportes)) {
            fs.mkdirSync(dirReportes, { recursive: true });
        }
        
        fs.writeFileSync(rutaArchivo, JSON.stringify(reporte, null, 2));
        console.log(`\n📁 [REPORTE] Guardado: ${rutaArchivo}`);
    }

    mostrarResumen(reporte) {
        console.log('\n🎯 [RESUMEN ULTRA RÁPIDO] ========================================');
        console.log(`✅ Tasa de éxito: ${reporte.resumen.tasaExito}% (${reporte.resumen.exitosos}/${reporte.resumen.totalPreguntas})`);
        console.log(`⏱️ Tiempo promedio: ${reporte.resumen.tiempoPromedioMs}ms`);
        console.log(`🚨 Fallos críticos: ${reporte.resumen.fallos}`);
        console.log(`⏳ Tiempo total: ${Math.round(reporte.resumen.tiempoTotalMs / 1000)}s`);
        
        if (reporte.recomendaciones.length > 0) {
            console.log(`\n🔧 [RECOMENDACIONES]:`);
            reporte.recomendaciones.forEach((rec, i) => {
                console.log(`${i + 1}. [${rec.prioridad}] ${rec.problema} → ${rec.accion}`);
            });
        }
        
        console.log('========================================');
        
        // Decisión automática
        if (reporte.resumen.tasaExito < 70) {
            console.log('\n🚨 [DECISIÓN] Tasa de éxito baja - Ejecutando optimización automática...');
            return 'OPTIMIZAR';
        } else if (reporte.resumen.tasaExito < 90) {
            console.log('\n⚠️ [DECISIÓN] Rendimiento mejorable - Recomendado optimizar');
            return 'RECOMENDAR_OPTIMIZAR';
        } else {
            console.log('\n✅ [DECISIÓN] Sistema funcionando bien');
            return 'MANTENER';
        }
    }
}

// Función principal
async function main() {
    console.log('🚀 [INICIO] Sistema de Testing Ultra Rápido');
    console.log('🎯 [OBJETIVO] Evaluación crítica en 2-3 minutos');
    
    const tester = new TestingUltraRapido();
    
    try {
        const reporte = await tester.ejecutarTestRapido();
        
        console.log('\n✅ [COMPLETADO] Evaluación ultra rápida finalizada');
        console.log('📊 [RESULTADO] Revisa el reporte para decisiones');
        
        return reporte;
        
    } catch (error) {
        console.error('❌ [ERROR CRÍTICO] El testing ultra rápido falló:', error);
        console.error('🔍 [DEBUG] Stack trace:', error.stack);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main();
}

module.exports = { TestingUltraRapido }; 