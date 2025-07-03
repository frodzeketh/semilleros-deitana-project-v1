// =====================================
// TEST DE DIAGNÓSTICO DE CONSULTAS ESPECÍFICAS
// =====================================

const { processQuery } = require('./admin/core/openAI');
const pool = require('./db');

console.log('🔬 [TEST] === DIAGNÓSTICO DE CONSULTAS ESPECÍFICAS ===');

// =====================================
// FUNCIONES DE TESTING
// =====================================

async function testConsultaSQL(consulta, descripcion) {
    console.log(`\n🧪 [TEST] ${descripcion}`);
    console.log(`📝 [CONSULTA] "${consulta}"`);
    console.log('⏱️ [TIEMPO] Iniciando...');
    
    const tiempoInicio = Date.now();
    
    try {
        const resultado = await processQuery({
            message: consulta,
            userId: 'test-user-diagnostico'
        });
        
        const tiempoTotal = Date.now() - tiempoInicio;
        
        console.log(`⏱️ [TIEMPO] Completado en ${tiempoTotal}ms`);
        console.log('📤 [RESPUESTA]:', resultado.data?.message || resultado.response || 'Sin respuesta');
        console.log('✅ [ESTADO]:', resultado.success ? 'ÉXITO' : 'FALLO');
        
        // Análisis de la respuesta
        const respuesta = resultado.data?.message || resultado.response || '';
        
        // Verificar si responde como bot genérico
        const esBotGenerico = /semillero\./i.test(respuesta) && 
                             !/SELECT|FROM|WHERE/i.test(respuesta) &&
                             respuesta.length < 100;
        
        // Verificar si respeta la cantidad solicitada
        const pideNumero = consulta.match(/(\d+)\s+(almacenes?|tecnicos?|clientes?|articulos?|proveedores?)/i);
        const numeroSolicitado = pideNumero ? parseInt(pideNumero[1]) : null;
        
        console.log('🔍 [ANÁLISIS]:');
        console.log('  - Es respuesta genérica:', esBotGenerico ? '❌ SÍ' : '✅ NO');
        if (numeroSolicitado) {
            console.log(`  - Número solicitado: ${numeroSolicitado}`);
            // Contar elementos en la respuesta (simplificado)
            const elementosEncontrados = (respuesta.match(/\n/g) || []).length;
            console.log(`  - Elementos en respuesta: ${elementosEncontrados}`);
            console.log(`  - Respeta cantidad: ${elementosEncontrados >= numeroSolicitado ? '✅ SÍ' : '❌ NO'}`);
        }
        
        return {
            exito: resultado.success,
            respuesta: respuesta,
            tiempo: tiempoTotal,
            esBotGenerico: esBotGenerico,
            respetaCantidad: numeroSolicitado ? elementosEncontrados >= numeroSolicitado : true
        };
        
    } catch (error) {
        const tiempoTotal = Date.now() - tiempoInicio;
        console.log(`⏱️ [TIEMPO] Error tras ${tiempoTotal}ms`);
        console.log('❌ [ERROR]:', error.message);
        return {
            exito: false,
            error: error.message,
            tiempo: tiempoTotal
        };
    }
}

async function testDirectoDB(consulta, descripcion) {
    console.log(`\n🔧 [TEST-DB] ${descripcion}`);
    
    try {
        const [rows] = await pool.query(consulta);
        console.log(`📊 [RESULTADOS] ${rows.length} filas encontradas`);
        
        if (rows.length > 0) {
            console.log('📋 [MUESTRA] Primeras 3 filas:');
            rows.slice(0, 3).forEach((row, index) => {
                console.log(`  ${index + 1}. ${JSON.stringify(row)}`);
            });
        }
        
        return rows;
        
    } catch (error) {
        console.log('❌ [ERROR-DB]:', error.message);
        return null;
    }
}

// =====================================
// EJECUCIÓN DE TESTS
// =====================================

async function ejecutarDiagnostico() {
    console.log('\n🎯 [INICIO] Comenzando diagnóstico de consultas problemáticas...\n');
    
    // =====================================
    // 1. TESTS DIRECTOS A BASE DE DATOS
    // =====================================
    
    console.log('🔧 [FASE-1] TESTING DIRECTO A BASE DE DATOS');
    
    await testDirectoDB(
        'SELECT * FROM almacenes LIMIT 5',
        'Verificar tabla almacenes existe y tiene datos'
    );
    
    await testDirectoDB(
        'SELECT * FROM tecnicos LIMIT 5', 
        'Verificar tabla tecnicos existe y tiene datos'
    );
    
    // =====================================
    // 2. TESTS DE CONSULTAS ESPECÍFICAS PROBLEMÁTICAS
    // =====================================
    
    console.log('\n🧪 [FASE-2] TESTING CONSULTAS ESPECÍFICAS PROBLEMÁTICAS');
    
    const consultasProblematicas = [
        {
            consulta: "necesito que me digas 2 almacenes",
            descripcion: "Consulta de 2 almacenes (problema reportado)"
        },
        {
            consulta: "necesito que me digas 2 tecnicos", 
            descripcion: "Consulta de 2 técnicos (problema reportado)"
        },
        {
            consulta: "dame 3 clientes",
            descripcion: "Consulta de 3 clientes (test de cantidad)"
        },
        {
            consulta: "muestra 5 articulos",
            descripcion: "Consulta de 5 artículos (test de cantidad)"
        }
    ];
    
    const resultados = [];
    
    for (const test of consultasProblematicas) {
        const resultado = await testConsultaSQL(test.consulta, test.descripcion);
        resultados.push({
            consulta: test.consulta,
            resultado: resultado
        });
        
        // Pausa entre tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // =====================================
    // 3. ANÁLISIS FINAL Y RECOMENDACIONES
    // =====================================
    
    console.log('\n📊 [RESUMEN] ANÁLISIS DE RESULTADOS');
    console.log('=====================================');
    
    let problemasEncontrados = [];
    let exitosos = 0;
    
    resultados.forEach((test, index) => {
        console.log(`\n${index + 1}. "${test.consulta}"`);
        
        if (test.resultado.exito) {
            exitosos++;
            console.log('   ✅ Ejecutado correctamente');
            
            if (test.resultado.esBotGenerico) {
                console.log('   ⚠️ PROBLEMA: Respuesta genérica de bot');
                problemasEncontrados.push('Respuestas genéricas en lugar de usar BD');
            }
            
            if (!test.resultado.respetaCantidad) {
                console.log('   ⚠️ PROBLEMA: No respeta cantidad solicitada');
                problemasEncontrados.push('No respeta cantidades numéricas');
            }
            
        } else {
            console.log('   ❌ Error en ejecución');
            problemasEncontrados.push('Errores de ejecución');
        }
    });
    
    console.log(`\n📈 [ESTADÍSTICAS]`);
    console.log(`- Tests exitosos: ${exitosos}/${resultados.length}`);
    console.log(`- Problemas únicos encontrados: ${[...new Set(problemasEncontrados)].length}`);
    
    if (problemasEncontrados.length > 0) {
        console.log('\n🔧 [PROBLEMAS IDENTIFICADOS]:');
        [...new Set(problemasEncontrados)].forEach((problema, index) => {
            console.log(`${index + 1}. ${problema}`);
        });
        
        console.log('\n💡 [RECOMENDACIONES]:');
        if (problemasEncontrados.includes('Respuestas genéricas en lugar de usar BD')) {
            console.log('- Verificar que el sistema detecte correctamente consultas SQL');
            console.log('- Revisar la construcción del prompt para enfatizar uso de BD');
        }
        if (problemasEncontrados.includes('No respeta cantidades numéricas')) {
            console.log('- Modificar el prompt para respetar números específicos');
            console.log('- Incluir ejemplos de consultas con cantidades específicas');
        }
    } else {
        console.log('\n✅ [RESULTADO] No se detectaron problemas graves');
    }
    
    console.log('\n🏁 [FIN] Diagnóstico completado');
}

// =====================================
// EJECUCIÓN
// =====================================

if (require.main === module) {
    ejecutarDiagnostico()
        .then(() => {
            console.log('\n✅ [SISTEMA] Diagnóstico finalizado exitosamente');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ [SISTEMA] Error durante diagnóstico:', error);
            process.exit(1);
        });
}

module.exports = { testConsultaSQL, testDirectoDB, ejecutarDiagnostico }; 