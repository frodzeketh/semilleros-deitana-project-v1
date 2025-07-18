// =====================================
// TEST ESPECÍFICO - ACTIVIDADES INCENTIVADAS
// =====================================

const fs = require('fs');
const path = require('path');

async function testActividadesIncentivadas() {
    console.log('🧪 [TEST] Buscando información sobre actividades incentivadas...');
    
    try {
        // Leer el archivo informacionEmpresa.txt
        const rutaArchivo = path.join(__dirname, 'admin', 'data', 'informacionEmpresa.txt');
        const contenido = fs.readFileSync(rutaArchivo, 'utf8');
        
        console.log('📄 [TEST] Archivo leído, buscando información específica...');
        
        // Buscar información sobre actividades incentivadas
        const patrones = [
            /actividades incentivadas/gi,
            /incentivos/gi,
            /productividad/gi,
            /tasa de productividad/gi,
            /600 plantas por hora/gi,
            /código 1/gi,
            /código 63/gi,
            /Z-ENTERRAR/gi
        ];
        
        let encontrado = false;
        
        for (const patron of patrones) {
            const matches = contenido.match(patron);
            if (matches) {
                console.log(`✅ [TEST] Encontrado patrón: ${patron.source}`);
                encontrado = true;
            }
        }
        
        if (encontrado) {
            console.log('✅ [TEST] Se encontró información sobre actividades incentivadas');
            
            // Extraer el contexto específico
            const contextoActividades = contenido.match(/Actividades Incentivadas y Productividad[^]*?Okay, entiendo/);
            
            if (contextoActividades) {
                console.log('📋 [TEST] Contexto encontrado:');
                console.log('='.repeat(50));
                console.log(contextoActividades[0]);
                console.log('='.repeat(50));
            }
            
            // Buscar información específica sobre códigos
            const codigosIncentivados = contenido.match(/Sector: Injertos hacer \(código 1\)[^]*?Tasa de productividad: 600 plantas por hora/);
            
            if (codigosIncentivados) {
                console.log('🎯 [TEST] Información específica de códigos incentivados:');
                console.log('='.repeat(50));
                console.log(codigosIncentivados[0]);
                console.log('='.repeat(50));
            }
            
        } else {
            console.log('❌ [TEST] NO se encontró información específica sobre actividades incentivadas');
        }
        
        // Buscar en el listado de secciones y tareas
        const seccionesTareas = contenido.match(/Listado de Secciones y Tareas por Código[^]*?253 \(Este parece ser un código sin tarea definida/);
        
        if (seccionesTareas) {
            console.log('📋 [TEST] Listado de secciones y tareas encontrado');
            
            // Buscar específicamente la sección de INJERTOS HACER
            const injertosHacer = seccionesTareas[0].match(/INJERTOS HACER \(Código de Sección: 1\)[^]*?SIEMBRA \(Código de Sección: 2\)/);
            
            if (injertosHacer) {
                console.log('🔍 [TEST] Sección INJERTOS HACER encontrada:');
                console.log('='.repeat(50));
                console.log(injertosHacer[0]);
                console.log('='.repeat(50));
            }
        }
        
    } catch (error) {
        console.error('❌ [TEST] Error:', error.message);
    }
}

// Ejecutar la prueba
testActividadesIncentivadas().catch(console.error); 