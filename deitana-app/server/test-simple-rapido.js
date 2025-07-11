const { chatManager } = require('./chatManager');
const fs = require('fs');
const path = require('path');

class TestSimpleRapido {
    constructor() {
        this.preguntasBasicas = [
            "¿Cuándo se fundó Semilleros Deitana?",
            "¿Dónde está ubicada la empresa?", 
            "¿Qué certificación tiene la empresa?",
            "¿Quiénes son los fundadores?",
            "¿Qué significa CL_DENO?",
            "¿Qué es AR_PRV?",
            "¿Cómo funcionan los injertos?",
            "¿Qué son las bandejas?",
            "¿Qué proceso siguen las semillas?",
            "¿Cuál es el proceso de germinación?"
        ];
        
        this.resultados = [];
        this.exitosos = 0;
        this.fallos = 0;
    }

    async ejecutarTestRapido() {
        console.log('🚀 [TEST SIMPLE] Evaluando 10 preguntas básicas');
        console.log('⏱️ [ESTIMADO] 2-3 minutos máximo');
        
        const inicio = Date.now();
        
        for (let i = 0; i < this.preguntasBasicas.length; i++) {
            const pregunta = this.preguntasBasicas[i];
            console.log(`\n📋 [${i + 1}/10] ${pregunta}`);
            
            try {
                const inicioTest = Date.now();
                
                // Usar el chatManager directamente
                const respuesta = await chatManager.procesarMensaje(
                    pregunta, 
                    'test-simple-rapido'
                );
                
                const tiempo = Date.now() - inicioTest;
                
                const evaluacion = this.evaluarRespuesta(pregunta, respuesta, tiempo);
                
                if (evaluacion.exito) {
                    console.log(`✅ ÉXITO (${tiempo}ms) - ${evaluacion.razon}`);
                    this.exitosos++;
                } else {
                    console.log(`❌ FALLO (${tiempo}ms) - ${evaluacion.razon}`);
                    this.fallos++;
                }
                
                this.resultados.push({
                    pregunta,
                    respuesta: respuesta.substring(0, 200),
                    tiempo,
                    ...evaluacion
                });
                
            } catch (error) {
                console.log(`💥 ERROR - ${error.message}`);
                this.fallos++;
                this.resultados.push({
                    pregunta,
                    error: error.message,
                    exito: false,
                    tiempo: 0
                });
            }
        }
        
        const tiempoTotal = Date.now() - inicio;
        return this.generarReporte(tiempoTotal);
    }

    evaluarRespuesta(pregunta, respuesta, tiempo) {
        if (!respuesta || respuesta.length < 30) {
            return { exito: false, razon: 'Respuesta muy corta o vacía' };
        }
        
        // Verificar si es una respuesta genérica
        const frasesProblematicas = [
            'no tengo información',
            'no encuentro datos',
            'no está disponible',
            'no puedo ayudar',
            'información no encontrada'
        ];
        
        const esGenerico = frasesProblematicas.some(frase => 
            respuesta.toLowerCase().includes(frase)
        );
        
        if (esGenerico) {
            return { exito: false, razon: 'Respuesta genérica - no encuentra información' };
        }
        
        // Verificar información específica esperada
        const infoEsperada = this.obtenerInfoEsperada(pregunta);
        const contieneInfo = infoEsperada.some(info => 
            respuesta.toLowerCase().includes(info.toLowerCase())
        );
        
        if (!contieneInfo) {
            return { exito: false, razon: 'No contiene información específica esperada' };
        }
        
        if (tiempo > 15000) {
            return { exito: false, razon: `Muy lento (${tiempo}ms)` };
        }
        
        return { exito: true, razon: 'Respuesta satisfactoria' };
    }

    obtenerInfoEsperada(pregunta) {
        const mapeo = {
            'fundó': ['1989', 'treinta años'],
            'ubicada': ['Totana', 'Murcia'],
            'certificación': ['ISO 9001', 'ISO'],
            'fundadores': ['Galera', 'hermanos'],
            'CL_DENO': ['denominación', 'nombre'],
            'AR_PRV': ['proveedor'],
            'injertos': ['injerto', 'patrón'],
            'bandejas': ['bandeja', 'alvéolo'],
            'semillas': ['semilla', 'siembra'],
            'germinación': ['germinación', 'cámara']
        };
        
        for (const [clave, valores] of Object.entries(mapeo)) {
            if (pregunta.toLowerCase().includes(clave)) {
                return valores;
            }
        }
        
        return []; // Si no encuentra, no requiere información específica
    }

    generarReporte(tiempoTotal) {
        const tasaExito = Math.round((this.exitosos / this.preguntasBasicas.length) * 100);
        const tiempos = this.resultados.filter(r => r.tiempo > 0).map(r => r.tiempo);
        const tiempoPromedio = tiempos.length > 0 ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;
        
        const reporte = {
            fecha: new Date().toISOString(),
            total: this.preguntasBasicas.length,
            exitosos: this.exitosos,
            fallos: this.fallos,
            tasaExito,
            tiempoTotalMs: tiempoTotal,
            tiempoPromedioMs: tiempoPromedio,
            resultados: this.resultados
        };
        
        this.mostrarResumen(reporte);
        this.guardarReporte(reporte);
        
        return reporte;
    }

    mostrarResumen(reporte) {
        console.log('\n🎯 [RESUMEN RÁPIDO] ========================================');
        console.log(`✅ Tasa de éxito: ${reporte.tasaExito}% (${reporte.exitosos}/${reporte.total})`);
        console.log(`⏱️ Tiempo promedio: ${reporte.tiempoPromedioMs}ms`);
        console.log(`⏳ Tiempo total: ${Math.round(reporte.tiempoTotalMs / 1000)}s`);
        
        if (reporte.fallos > 0) {
            console.log('\n❌ [FALLOS DETECTADOS]:');
            this.resultados.filter(r => !r.exito).forEach((r, i) => {
                console.log(`${i + 1}. ${r.pregunta} → ${r.razon || r.error}`);
            });
        }
        
        console.log('\n🔧 [DIAGNÓSTICO]:');
        if (reporte.tasaExito < 50) {
            console.log('🚨 CRÍTICO: RAG no está funcionando - Necesita optimización urgente');
        } else if (reporte.tasaExito < 80) {
            console.log('⚠️ MEJORABLE: RAG funciona parcialmente - Se recomienda optimización');
        } else {
            console.log('✅ BUENO: RAG funcionando correctamente');
        }
        
        console.log('========================================');
    }

    guardarReporte(reporte) {
        try {
            const nombreArchivo = `test-simple-rapido-${new Date().toISOString().split('T')[0]}.json`;
            const rutaArchivo = path.join(__dirname, 'reportes', nombreArchivo);
            
            // Crear directorio si no existe
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
    console.log('🚀 [INICIO] Test Simple y Rápido del RAG');
    console.log('🎯 [OBJETIVO] Evaluación básica en 2-3 minutos');
    
    const tester = new TestSimpleRapido();
    
    try {
        await tester.ejecutarTestRapido();
        console.log('\n✅ [COMPLETADO] Test simple finalizado');
        
    } catch (error) {
        console.error('❌ [ERROR] Test falló:', error.message);
    }
}

if (require.main === module) {
    main();
}

module.exports = { TestSimpleRapido }; 