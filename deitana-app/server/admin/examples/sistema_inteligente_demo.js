// =====================================
// DEMOSTRACIÓN DEL SISTEMA INTELIGENTE DE ERRORES
// =====================================
// 
// Este archivo muestra cómo funciona el nuevo sistema inteligente
// de manejo de errores y razonamiento implementado en openAI.js
// 
// CARACTERÍSTICAS IMPLEMENTADAS:
// 1. Sistema de TO-DO List para trackear tareas
// 2. Análisis inteligente de errores SQL
// 3. Reintentos automáticos con estrategias alternativas
// 4. Respuestas inteligentes usando RAG cuando falla SQL
// 5. Mantenimiento automático del sistema
// =====================================

const { 
    todoManager, 
    SQLErrorAnalyzer, 
    EnhancedSQLError,
    performSystemMaintenance,
    isSystemStatusQuery 
} = require('../core/openAI');

// =====================================
// EJEMPLOS DE USO DEL SISTEMA TODO
// =====================================

function demoTodoSystem() {
    console.log('🚀 DEMO: Sistema de TO-DO List');
    
    // Agregar algunas tareas de ejemplo
    const todoId1 = todoManager.addTodo('Ejecutar consulta de clientes', 'high', 'SELECT * FROM clientes');
    const todoId2 = todoManager.addTodo('Validar estructura de tabla', 'medium', 'Verificar columnas');
    const todoId3 = todoManager.addTodo('Generar reporte de ventas', 'low', 'Análisis mensual');
    
    // Simular progreso de tareas
    todoManager.updateTodo(todoId1, { status: 'in_progress' });
    todoManager.markCompleted(todoId1, { rowCount: 25 });
    
    todoManager.markFailed(todoId2, 'Tabla no encontrada', true);
    todoManager.markFailed(todoId2, 'Error persistente', false); // Segundo intento fallido
    
    // Mostrar estado del sistema
    console.log('\n📊 Estado actual del sistema:');
    console.log(todoManager.generateStatusReport());
    
    return {
        todoId1,
        todoId2,
        todoId3,
        systemStatus: todoManager.getSystemStatus()
    };
}

// =====================================
// EJEMPLOS DE ANÁLISIS DE ERRORES SQL
// =====================================

function demoErrorAnalysis() {
    console.log('\n🧠 DEMO: Análisis Inteligente de Errores');
    
    // Simular diferentes tipos de errores
    const errors = [
        {
            message: "Table 'empresa.clientess' doesn't exist",
            sql: "SELECT * FROM clientess WHERE provincia = 'Almería'",
            context: "Consulta sobre clientes de Almería"
        },
        {
            message: "Unknown column 'nombre_cliente' in 'field list'",
            sql: "SELECT nombre_cliente FROM clientes",
            context: "Obtener nombres de clientes"
        },
        {
            message: "You have an error in your SQL syntax",
            sql: "SELECT * FROM clientes WHERE",
            context: "Consulta malformada"
        }
    ];
    
    errors.forEach((error, index) => {
        console.log(`\n--- Error ${index + 1} ---`);
        console.log(`SQL: ${error.sql}`);
        console.log(`Error: ${error.message}`);
        
        const analysis = SQLErrorAnalyzer.analyzeError(
            { message: error.message }, 
            error.sql, 
            error.context
        );
        
        console.log(`Análisis:`, analysis);
        
        // Crear error mejorado
        const enhancedError = new EnhancedSQLError(
            error.message,
            analysis,
            error.sql,
            error.context,
            1
        );
        
        console.log(`Respuesta inteligente:`);
        console.log(enhancedError.getIntelligentResponse());
    });
}

// =====================================
// DEMO DE DETECCIÓN DE CONSULTAS DE ESTADO
// =====================================

function demoSystemStatusDetection() {
    console.log('\n🔍 DEMO: Detección de Consultas de Estado');
    
    const testQueries = [
        'como estas',
        'estado del sistema',
        'cuantos clientes tenemos',
        'todo list',
        'qué tal funciona el asistente',
        'dame los productos disponibles',
        'estadísticas del sistema',
        'show me the sales report'
    ];
    
    testQueries.forEach(query => {
        const isStatus = isSystemStatusQuery(query);
        console.log(`"${query}" -> ${isStatus ? '✅ Estado del sistema' : '❌ Consulta normal'}`);
    });
}

// =====================================
// DEMO COMPLETO
// =====================================

function runCompleteDemo() {
    console.log('🎯 INICIANDO DEMOSTRACIÓN COMPLETA DEL SISTEMA INTELIGENTE\n');
    
    // 1. Demostrar sistema TODO
    const todoDemo = demoTodoSystem();
    
    // 2. Demostrar análisis de errores
    demoErrorAnalysis();
    
    // 3. Demostrar detección de estado
    demoSystemStatusDetection();
    
    // 4. Ejecutar mantenimiento del sistema
    console.log('\n🧹 DEMO: Mantenimiento del Sistema');
    const maintenanceResult = performSystemMaintenance();
    console.log('Resultado del mantenimiento:', maintenanceResult);
    
    console.log('\n✅ DEMOSTRACIÓN COMPLETADA');
    console.log('\n📋 RESUMEN DE FUNCIONALIDADES IMPLEMENTADAS:');
    console.log('- ✅ Sistema de TO-DO List con estados y prioridades');
    console.log('- ✅ Análisis inteligente de errores SQL');
    console.log('- ✅ Reintentos automáticos con estrategias alternativas');
    console.log('- ✅ Respuestas inteligentes usando RAG');
    console.log('- ✅ Detección de consultas de estado del sistema');
    console.log('- ✅ Mantenimiento automático cada hora');
    console.log('- ✅ Logging detallado para debugging');
    
    return {
        todoDemo,
        maintenanceResult,
        timestamp: new Date().toISOString()
    };
}

// =====================================
// CASOS DE USO REALES
// =====================================

function realWorldScenarios() {
    console.log('\n🌍 ESCENARIOS DEL MUNDO REAL:\n');
    
    console.log('ESCENARIO 1: Usuario pregunta "Puedes decirme toda la planta libre que tenemos?"');
    console.log('- ✅ Sistema detecta intención SQL');
    console.log('- ✅ Genera consulta: SELECT * FROM partidas WHERE PAR_TIPO = "L"');
    console.log('- ❌ Error: Table "partidas" no existe');
    console.log('- 🧠 Análisis inteligente: table_not_found');
    console.log('- 🔄 Reintento con tabla similar encontrada en mapaERP');
    console.log('- ✅ Éxito con consulta corregida o respuesta RAG alternativa\n');
    
    console.log('ESCENARIO 2: Usuario pregunta "¿Cómo está el sistema?"');
    console.log('- 🔍 Detección: isSystemStatusQuery() = true');
    console.log('- 📊 Genera reporte automático del estado');
    console.log('- 📋 Muestra TODOs pendientes, completados y fallidos');
    console.log('- ✅ Respuesta inmediata sin llamadas a IA\n');
    
    console.log('ESCENARIO 3: Consulta SQL compleja falla múltiples veces');
    console.log('- 🔄 Intento 1: Error de sintaxis -> Corrección automática');
    console.log('- 🔄 Intento 2: Tabla no encontrada -> Búsqueda fuzzy');
    console.log('- 🔄 Intento 3: Aún falla -> Consulta RAG para respuesta alternativa');
    console.log('- 🧠 Respuesta inteligente explicando el problema y sugerencias');
    console.log('- 📋 TODO creado para trackear el problema');
}

// =====================================
// EXPORTAR FUNCIONES PARA TESTING
// =====================================

module.exports = {
    demoTodoSystem,
    demoErrorAnalysis,
    demoSystemStatusDetection,
    runCompleteDemo,
    realWorldScenarios
};

// Ejecutar demo si se llama directamente
if (require.main === module) {
    runCompleteDemo();
    realWorldScenarios();
}
