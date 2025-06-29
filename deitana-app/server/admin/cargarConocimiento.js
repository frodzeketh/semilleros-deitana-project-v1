// =====================================
// SCRIPT PARA CARGAR CONOCIMIENTO DE EMPRESA
// =====================================

const ragInteligente = require('./ragInteligente');
const fs = require('fs');
const path = require('path');

console.log('🧠 CARGADOR DE CONOCIMIENTO - SEMILLEROS DEITANA\n');

// =====================================
// CONFIGURACIÓN
// =====================================

const CONFIG = {
    archivos: [
        {
            ruta: './conocimiento-empresa-optimizado.txt',
            categoria: 'empresa_completa',
            version: '2.0',
            prioridad: 'alta'
        },
        {
            ruta: './baseConocimiento.txt',
            categoria: 'empresa_general',
            version: '1.0',
            prioridad: 'media'
        },
        {
            ruta: './descripcionERP.txt', 
            categoria: 'erp_sistema',
            version: '1.0',
            prioridad: 'baja'
        }
    ],
    
    metadatosGlobales: {
        empresa: 'Semilleros Deitana',
        pais: 'España',
        sector: 'Agricultura',
        especialidad: 'Injertos y Plantas Hortícolas',
        fechaCarga: new Date().toISOString()
    }
};

// =====================================
// FUNCIONES DE CARGA
// =====================================

async function cargarArchivo(configArchivo) {
    const { ruta, categoria, version, prioridad } = configArchivo;
    const rutaCompleta = path.join(__dirname, ruta);
    
    console.log(`📄 [CARGA] Procesando: ${ruta} (${prioridad} prioridad)`);
    
    try {
        if (!fs.existsSync(rutaCompleta)) {
            console.log(`⚠️ [CARGA] Archivo no encontrado: ${ruta}`);
            return { archivo: ruta, error: 'Archivo no encontrado' };
        }
        
        const stats = fs.statSync(rutaCompleta);
        const tamañoKB = (stats.size / 1024).toFixed(2);
        
        console.log(`📊 [CARGA] Tamaño: ${tamañoKB} KB`);
        
        const metadatos = {
            ...CONFIG.metadatosGlobales,
            categoria: categoria,
            version: version,
            prioridad: prioridad,
            archivo: ruta,
            tamañoOriginal: stats.size,
            fechaModificacion: stats.mtime.toISOString()
        };
        
        const resultado = await ragInteligente.cargarConocimientoDesdeArchivo(rutaCompleta, metadatos);
        
        console.log(`✅ [CARGA] Exitoso: ${resultado.exitosos}/${resultado.totalChunks} chunks`);
        
        if (resultado.fallidos > 0) {
            console.log(`⚠️ [CARGA] Fallidos: ${resultado.fallidos} chunks`);
        }
        
        return {
            archivo: ruta,
            categoria: categoria,
            prioridad: prioridad,
            ...resultado,
            tamañoKB: tamañoKB
        };
        
    } catch (error) {
        console.error(`❌ [CARGA] Error procesando ${ruta}:`, error.message);
        return { archivo: ruta, error: error.message };
    }
}

async function cargarTodoElConocimiento() {
    console.log('🚀 [SISTEMA] Iniciando carga de conocimiento...\n');
    
    const resultados = [];
    let totalChunks = 0;
    let totalExitosos = 0;
    let totalFallidos = 0;
    
    // Procesar archivos por orden de prioridad
    const archivosOrdenados = CONFIG.archivos.sort((a, b) => {
        const prioridades = { 'alta': 3, 'media': 2, 'baja': 1 };
        return prioridades[b.prioridad] - prioridades[a.prioridad];
    });
    
    for (const configArchivo of archivosOrdenados) {
        const resultado = await cargarArchivo(configArchivo);
        resultados.push(resultado);
        
        if (!resultado.error) {
            totalChunks += resultado.totalChunks || 0;
            totalExitosos += resultado.exitosos || 0;
            totalFallidos += resultado.fallidos || 0;
        }
        
        console.log('');
    }
    
    console.log('📊 [RESUMEN] Carga completada:');
    console.log(`   📄 Archivos procesados: ${resultados.filter(r => !r.error).length}/${CONFIG.archivos.length}`);
    console.log(`   🧩 Total chunks: ${totalChunks}`);
    console.log(`   ✅ Chunks exitosos: ${totalExitosos}`);
    console.log(`   ❌ Chunks fallidos: ${totalFallidos}`);
    console.log(`   📈 Tasa de éxito: ${totalChunks > 0 ? ((totalExitosos / totalChunks) * 100).toFixed(1) : 0}%`);
    
    console.log('\n💰 [COSTOS] Estimación de carga:');
    const costoCarga = totalExitosos * 0.00002;
    console.log(`   🧠 Embeddings generados: ${totalExitosos}`);
    console.log(`   💸 Costo estimado de carga: $${costoCarga.toFixed(4)}`);
    
    // Mostrar desglose por archivo
    console.log('\n📋 [DESGLOSE] Por archivo:');
    resultados.filter(r => !r.error).forEach(resultado => {
        console.log(`   📄 ${resultado.archivo}: ${resultado.exitosos} chunks (${resultado.categoria})`);
    });
    
    const errores = resultados.filter(r => r.error);
    if (errores.length > 0) {
        console.log('\n❌ [ERRORES] Archivos con problemas:');
        errores.forEach(error => {
            console.log(`   • ${error.archivo}: ${error.error}`);
        });
    }
    
    return {
        total: resultados.length,
        exitosos: resultados.filter(r => !r.error).length,
        totalChunks,
        totalExitosos,
        totalFallidos,
        costoCarga
    };
}

async function verificarSistema() {
    console.log('🔍 [VERIFICACIÓN] Comprobando sistema...\n');
    
    let todoOK = true;
    
    console.log('🔍 [CHECK] Archivos de conocimiento:');
    CONFIG.archivos.forEach(archivo => {
        const rutaCompleta = path.join(__dirname, archivo.ruta);
        if (fs.existsSync(rutaCompleta)) {
            const stats = fs.statSync(rutaCompleta);
            console.log(`   ✅ ${archivo.ruta} (${(stats.size/1024).toFixed(2)} KB) - ${archivo.prioridad} prioridad`);
        } else {
            console.log(`   ❌ ${archivo.ruta} (no encontrado)`);
            if (archivo.prioridad === 'alta') {
                todoOK = false;
            }
        }
    });
    
    console.log('\n🔍 [CHECK] Variables de entorno:');
    const required = ['OPENAI_API_KEY'];
    required.forEach(env => {
        if (process.env[env]) {
            console.log(`   ✅ ${env} configurada`);
        } else {
            console.log(`   ❌ ${env} faltante`);
            todoOK = false;
        }
    });
    
    return todoOK;
}

async function main() {
    try {
        const sistemaOK = await verificarSistema();
        
        if (!sistemaOK) {
            console.log('❌ [ERROR] Sistema no está listo. Archivos de alta prioridad faltantes o configuración incompleta.');
            console.log('\n💡 [SOLUCIÓN] Asegúrate de tener:');
            console.log('   1. conocimiento-empresa-optimizado.txt (archivo principal)');
            console.log('   2. Variable OPENAI_API_KEY configurada');
            process.exit(1);
        }
        
        console.log('✅ [SISTEMA] Verificación completada. Iniciando carga...\n');
        
        const resultados = await cargarTodoElConocimiento();
        
        console.log('\n🎯 [PRÓXIMOS PASOS] Para usar el sistema RAG:');
        console.log('   1. 🧪 Prueba consultas sobre la empresa');
        console.log('   2. 📊 Monitorea los logs para ver el RAG en acción');
        console.log('   3. ➕ Añade más conocimiento con ragInteligente.añadirConocimientoNuevo()');
        console.log('   4. 🔧 Ajusta CONFIG_RAG según necesidades\n');
        
        console.log('🚀 [RESULTADO] Sistema RAG listo para usar!');
        
    } catch (error) {
        console.error('❌ [ERROR FATAL]:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { cargarTodoElConocimiento, verificarSistema }; 