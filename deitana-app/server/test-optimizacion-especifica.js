// test-optimizacion-especifica.js
const ragInteligente = require('./admin/core/ragInteligente');

console.log('🧪 [TEST ESPECÍFICO] === VERIFICANDO OPTIMIZACIONES ULTRA-GRANULARES ===\n');

async function testInformacionEspecifica() {
    const preguntas = [
        {
            consulta: "¿Quién es Facundo y cuál es su rol en la empresa?",
            infoEsperada: ["ingeniero programador", "Deitana IA", "asistente", "evolucione"],
            peso: 25
        },
        {
            consulta: "¿Qué fertilizantes específicos 15-10-31 y Ambra 48 utiliza la empresa?",
            infoEsperada: ["15-10-31", "Fosfato monopotásico", "Ambra 48", "Peróxido de hidrógeno"],
            peso: 25
        },
        {
            consulta: "¿Cuáles son los pantanos A, B y C de la empresa?",
            infoEsperada: ["PANTANO A", "PANTANO B", "PANTANO C", "depósito", "agua"],
            peso: 25
        },
        {
            consulta: "¿Quiénes son Antonio Miras Moya y Marcia Padilla en Injertos Hacer?",
            infoEsperada: ["ANTONIO MIRAS MOYA", "MARCIA PADILLA", "encargado", "Injertos Hacer"],
            peso: 25
        }
    ];

    let totalExitosos = 0;
    let detallesResultados = [];

    console.log('🔍 PROBANDO INFORMACIÓN ESPECÍFICA ULTRA-GRANULAR:\n');

    for (const pregunta of preguntas) {
        console.log(`📋 Pregunta: ${pregunta.consulta}`);
        
        try {
            const inicio = Date.now();
            const contexto = await ragInteligente.recuperarConocimientoRelevante(pregunta.consulta, 'test-especifico');
            const tiempo = Date.now() - inicio;
            
            let coincidencias = 0;
            let detallesCoincidencias = [];
            
            for (const termino of pregunta.infoEsperada) {
                if (contexto.toLowerCase().includes(termino.toLowerCase())) {
                    coincidencias++;
                    detallesCoincidencias.push(`✅ ${termino}`);
                } else {
                    detallesCoincidencias.push(`❌ ${termino} - NO ENCONTRADO`);
                }
            }
            
            const porcentajeExito = (coincidencias / pregunta.infoEsperada.length) * 100;
            const exitoso = porcentajeExito >= 75; // 75% o más de coincidencias
            
            if (exitoso) {
                totalExitosos++;
                console.log(`✅ ÉXITO (${porcentajeExito.toFixed(1)}% - ${coincidencias}/${pregunta.infoEsperada.length})`);
            } else {
                console.log(`❌ FALLO (${porcentajeExito.toFixed(1)}% - ${coincidencias}/${pregunta.infoEsperada.length})`);
            }
            
            detallesResultados.push({
                pregunta: pregunta.consulta,
                exitoso,
                porcentajeExito,
                coincidencias,
                total: pregunta.infoEsperada.length,
                tiempo,
                detallesCoincidencias,
                contexto: contexto.substring(0, 300) + '...'
            });
            
            console.log(`   Tiempo: ${tiempo}ms`);
            console.log(`   Contexto: ${contexto.length} caracteres`);
            console.log(`   Detalles: ${detallesCoincidencias.join(', ')}`);
            console.log('');
            
        } catch (error) {
            console.log(`❌ ERROR: ${error.message}`);
            detallesResultados.push({
                pregunta: pregunta.consulta,
                exitoso: false,
                error: error.message,
                tiempo: 0
            });
            console.log('');
        }
    }

    // Calcular estadísticas finales
    const tasaExitoGeneral = (totalExitosos / preguntas.length) * 100;
    
    console.log('📊 === RESULTADOS FINALES DE OPTIMIZACIÓN ESPECÍFICA ===');
    console.log(`✅ Preguntas exitosas: ${totalExitosos}/${preguntas.length}`);
    console.log(`📈 Tasa de éxito: ${tasaExitoGeneral.toFixed(1)}%`);
    console.log('');

    // Analizar mejoras por categoría
    console.log('🔍 ANÁLISIS POR CATEGORÍA:');
    
    for (let i = 0; i < detallesResultados.length; i++) {
        const resultado = detallesResultados[i];
        console.log(`\n${i+1}. ${resultado.pregunta}`);
        
        if (resultado.exitoso) {
            console.log(`   ✅ MEJORADO: ${resultado.porcentajeExito.toFixed(1)}% de información específica capturada`);
        } else {
            console.log(`   ❌ AÚN NECESITA OPTIMIZACIÓN: ${resultado.porcentajeExito ? resultado.porcentajeExito.toFixed(1) : 0}%`);
            if (resultado.detallesCoincidencias) {
                console.log(`   📝 Detalles: ${resultado.detallesCoincidencias.filter(d => d.includes('NO ENCONTRADO')).join(', ')}`);
            }
        }
    }

    // Evaluación de progreso
    console.log('\n🎯 EVALUACIÓN DE PROGRESO:');
    
    if (tasaExitoGeneral >= 80) {
        console.log('🏆 EXCELENTE: Las optimizaciones ultra-granulares funcionan perfectamente');
        console.log('   ✅ Sistema captura información específica eficazmente');
        console.log('   ✅ Chunks críticos funcionando correctamente');
    } else if (tasaExitoGeneral >= 60) {
        console.log('⚡ BUENO: Mejoras significativas, pero aún se puede optimizar');
        console.log('   ✅ Progreso notable en captura específica');
        console.log('   🔧 Considerar ajustes adicionales en patrones críticos');
    } else if (tasaExitoGeneral >= 40) {
        console.log('⚠️ PROGRESO MODERADO: Se requieren ajustes adicionales');
        console.log('   🔧 Revisar patrones de chunks críticos');
        console.log('   🔧 Ajustar umbrales de similitud');
    } else {
        console.log('❌ REQUIERE TRABAJO ADICIONAL: Optimizaciones no son suficientes');
        console.log('   🔧 Revisar completamente estrategia de fragmentación');
        console.log('   🔧 Considerar patrones de extracción más específicos');
    }

    return {
        tasaExito: tasaExitoGeneral,
        exitosos: totalExitosos,
        total: preguntas.length,
        detalles: detallesResultados
    };
}

// Ejecutar test
testInformacionEspecifica()
    .then(resultado => {
        console.log('\n🔚 [TEST ESPECÍFICO] Test de optimización específica completado');
        process.exit(resultado.tasaExito >= 60 ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ [TEST ESPECÍFICO] Error en test:', error);
        process.exit(1);
    }); 