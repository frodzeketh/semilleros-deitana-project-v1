const { chatManager } = require('./chatManager');

class TestPostOptimizacion {
    constructor() {
        this.preguntasOptimizadas = [
            "¿Qué significa CL_DENO en clientes?",
            "¿Qué es AR_PRV en artículos?", 
            "¿Qué información hay sobre Roberto como cliente?",
            "¿Cuál es el código del tomate amarillo?",
            "¿Cómo funcionan los injertos?",
            "¿Qué proceso siguen las bandejas?",
            "¿Cómo es el proceso de germinación?"
        ];
        
        this.resultados = [];
        this.exitosos = 0;
    }

    async ejecutarTestVerificacion() {
        console.log('🧪 [TEST POST-OPTIMIZACIÓN] Verificando mejoras del RAG');
        console.log('🎯 [OBJETIVO] Comprobar que las preguntas optimizadas ahora funcionan');
        
        const inicio = Date.now();
        
        for (let i = 0; i < this.preguntasOptimizadas.length; i++) {
            const pregunta = this.preguntasOptimizadas[i];
            console.log(`\n📋 [${i + 1}/7] ${pregunta}`);
            
            try {
                const inicioTest = Date.now();
                
                const respuesta = await chatManager.procesarMensaje(
                    pregunta, 
                    'test-post-optimizacion'
                );
                
                const tiempo = Date.now() - inicioTest;
                const evaluacion = this.evaluarMejora(pregunta, respuesta, tiempo);
                
                if (evaluacion.mejorado) {
                    console.log(`✅ MEJORADO (${tiempo}ms) - ${evaluacion.razon}`);
                    this.exitosos++;
                } else {
                    console.log(`❌ SIN MEJORA (${tiempo}ms) - ${evaluacion.razon}`);
                }
                
                this.resultados.push({
                    pregunta,
                    respuesta: respuesta.substring(0, 150) + '...',
                    tiempo,
                    ...evaluacion
                });
                
            } catch (error) {
                console.log(`💥 ERROR - ${error.message}`);
                this.resultados.push({
                    pregunta,
                    error: error.message,
                    mejorado: false,
                    tiempo: 0
                });
            }
        }
        
        const tiempoTotal = Date.now() - inicio;
        this.generarReporteVerificacion(tiempoTotal);
    }

    evaluarMejora(pregunta, respuesta, tiempo) {
        if (!respuesta || respuesta.length < 30) {
            return { mejorado: false, razon: 'Respuesta muy corta' };
        }
        
        // Verificar que no sea genérica
        const frasesProblematicas = [
            'no tengo información',
            'no encuentro datos',
            'no está disponible',
            'no puedo ayudar'
        ];
        
        const esGenerico = frasesProblematicas.some(frase => 
            respuesta.toLowerCase().includes(frase)
        );
        
        if (esGenerico) {
            return { mejorado: false, razon: 'Respuesta genérica (sin mejora)' };
        }
        
        // Verificar contenido específico según la pregunta
        const contieneInfoEspecifica = this.verificarInfoEspecifica(pregunta, respuesta);
        
        if (!contieneInfoEspecifica) {
            return { mejorado: false, razon: 'Falta información específica esperada' };
        }
        
        if (tiempo > 12000) {
            return { mejorado: false, razon: `Muy lento (${tiempo}ms)` };
        }
        
        return { mejorado: true, razon: 'Respuesta específica y precisa' };
    }

    verificarInfoEspecifica(pregunta, respuesta) {
        const verificaciones = {
            'CL_DENO': ['denominación', 'nombre', 'cliente'],
            'AR_PRV': ['proveedor', 'preferente', 'artículo'],
            'Roberto': ['Roberto', 'cliente', 'ejemplo'],
            'tomate amarillo': ['tomate', 'amarillo', 'código'],
            'injertos': ['injerto', 'patrón', 'variedad'],
            'bandejas': ['bandeja', 'alvéolo', 'siembra'],
            'germinación': ['germinación', 'semilla', 'proceso']
        };
        
        for (const [clave, terminos] of Object.entries(verificaciones)) {
            if (pregunta.includes(clave)) {
                return terminos.some(termino => 
                    respuesta.toLowerCase().includes(termino.toLowerCase())
                );
            }
        }
        
        return true; // Si no encuentra verificación específica, asume válido
    }

    generarReporteVerificacion(tiempoTotal) {
        const tasaExito = Math.round((this.exitosos / this.preguntasOptimizadas.length) * 100);
        const tiempos = this.resultados.filter(r => r.tiempo > 0).map(r => r.tiempo);
        const tiempoPromedio = tiempos.length > 0 ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;
        
        console.log('\n🎯 [REPORTE VERIFICACIÓN] ========================================');
        console.log(`✅ Mejoras confirmadas: ${tasaExito}% (${this.exitosos}/7)`);
        console.log(`⏱️ Tiempo promedio: ${tiempoPromedio}ms`);
        console.log(`⏳ Tiempo total: ${Math.round(tiempoTotal / 1000)}s`);
        
        if (this.exitosos > 0) {
            console.log('\n✅ [PREGUNTAS MEJORADAS]:');
            this.resultados.filter(r => r.mejorado).forEach((r, i) => {
                console.log(`${i + 1}. ${r.pregunta} ✓`);
            });
        }
        
        if (this.exitosos < this.preguntasOptimizadas.length) {
            console.log('\n❌ [PREGUNTAS SIN MEJORA]:');
            this.resultados.filter(r => !r.mejorado).forEach((r, i) => {
                console.log(`${i + 1}. ${r.pregunta} → ${r.razon}`);
            });
        }
        
        console.log('\n📊 [ANÁLISIS]:');
        if (tasaExito >= 80) {
            console.log('🎉 EXCELENTE: La optimización fue muy exitosa');
        } else if (tasaExito >= 60) {
            console.log('✅ BUENO: La optimización mejoró significativamente el RAG');
        } else if (tasaExito >= 40) {
            console.log('⚠️ REGULAR: Algunos chunks funcionan, pero necesita más optimización');
        } else {
            console.log('❌ BAJO: La optimización no tuvo el efecto esperado');
        }
        
        console.log('\n🔄 [RECOMENDACIONES]:');
        if (tasaExito < 80) {
            console.log('• Ejecutar más optimizaciones para las preguntas que aún fallan');
            console.log('• Revisar chunks que tuvieron timeout en Pinecone');
        }
        if (tiempoPromedio > 8000) {
            console.log('• Optimizar velocidad de respuesta');
        }
        
        console.log('========================================');
    }
}

async function main() {
    console.log('🚀 [INICIO] Test de Verificación Post-Optimización');
    console.log('🎯 [OBJETIVO] Comprobar si las optimizaciones mejoraron la precisión');
    
    const tester = new TestPostOptimizacion();
    
    try {
        await tester.ejecutarTestVerificacion();
        console.log('\n✅ [COMPLETADO] Verificación finalizada');
        
    } catch (error) {
        console.error('❌ [ERROR] Test de verificación falló:', error.message);
    }
}

if (require.main === module) {
    main();
}

module.exports = { TestPostOptimizacion }; 