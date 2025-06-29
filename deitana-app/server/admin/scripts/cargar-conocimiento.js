// =====================================
// SCRIPT PARA CARGAR CONOCIMIENTO DE EMPRESA
// =====================================

const ragInteligente = require('../core/ragInteligente');
const fs = require('fs');
const path = require('path');

console.log('🧠 CARGADOR DE CONOCIMIENTO - SEMILLEROS DEITANA\n');

// =====================================
// CONFIGURACIÓN
// =====================================

const CONFIG = {
    // Archivos de conocimiento a procesar
    archivos: [
        {
            ruta: '../data/baseConocimiento.txt',
            categoria: 'empresa_general',
            version: '1.0'
        },
        {
            ruta: '../data/descripcionERP.txt', 
            categoria: 'erp_sistema',
            version: '1.0'
        },
        {
            ruta: '../data/conocimiento-empresa-optimizado.txt',
            categoria: 'empresa_optimizada',
            version: '1.0'
        }
        // Añadir más archivos aquí cuando estén disponibles
    ],
    
    // Metadatos adicionales
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
    const { ruta, categoria, version } = configArchivo;
    const rutaCompleta = path.join(__dirname, ruta);
    
    console.log(`📄 [CARGA] Procesando: ${ruta}`);
    
    try {
        // Verificar que el archivo existe
        if (!fs.existsSync(rutaCompleta)) {
            console.log(`⚠️ [CARGA] Archivo no encontrado: ${ruta}`);
            return { archivo: ruta, error: 'Archivo no encontrado' };
        }
        
        // Obtener información del archivo
        const stats = fs.statSync(rutaCompleta);
        const tamañoKB = (stats.size / 1024).toFixed(2);
        
        console.log(`📊 [CARGA] Tamaño: ${tamañoKB} KB`);
        
        // Preparar metadatos específicos
        const metadatos = {
            ...CONFIG.metadatosGlobales,
            categoria: categoria,
            version: version,
            archivo: ruta,
            tamañoOriginal: stats.size,
            fechaModificacion: stats.mtime.toISOString()
        };
        
        // Cargar y procesar el conocimiento
        const resultado = await ragInteligente.cargarConocimientoDesdeArchivo(rutaCompleta, metadatos);
        
        console.log(`✅ [CARGA] Exitoso: ${resultado.exitosos}/${resultado.totalChunks} chunks`);
        
        if (resultado.fallidos > 0) {
            console.log(`⚠️ [CARGA] Fallidos: ${resultado.fallidos} chunks`);
        }
        
        return {
            archivo: ruta,
            categoria: categoria,
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
    
    // Procesar cada archivo
    for (const configArchivo of CONFIG.archivos) {
        const resultado = await cargarArchivo(configArchivo);
        resultados.push(resultado);
        
        if (!resultado.error) {
            totalChunks += resultado.totalChunks || 0;
            totalExitosos += resultado.exitosos || 0;
            totalFallidos += resultado.fallidos || 0;
        }
        
        console.log(''); // Línea en blanco entre archivos
    }
    
    // Mostrar resumen final
    console.log('📊 [RESUMEN] Carga completada:');
    console.log(`   📄 Archivos procesados: ${resultados.filter(r => !r.error).length}/${CONFIG.archivos.length}`);
    console.log(`   🧩 Total chunks: ${totalChunks}`);
    console.log(`   ✅ Chunks exitosos: ${totalExitosos}`);
    console.log(`   ❌ Chunks fallidos: ${totalFallidos}`);
    console.log(`   📈 Tasa de éxito: ${totalChunks > 0 ? ((totalExitosos / totalChunks) * 100).toFixed(1) : 0}%`);
    
    // Calcular costos estimados
    console.log('\n💰 [COSTOS] Estimación de carga:');
    const costoCarga = totalExitosos * 0.00002; // Costo de embedding por chunk
    console.log(`   🧠 Embeddings generados: ${totalExitosos}`);
    console.log(`   💸 Costo estimado de carga: $${costoCarga.toFixed(4)}`);
    
    // Mostrar errores si los hay
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

// =====================================
// VERIFICACIÓN DEL SISTEMA
// =====================================

async function verificarSistema() {
    console.log('🔍 [VERIFICACIÓN] Comprobando sistema...\n');
    
    const verificaciones = [
        {
            nombre: 'Archivos de conocimiento',
            check: () => {
                let encontrados = 0;
                CONFIG.archivos.forEach(archivo => {
                    const rutaCompleta = path.join(__dirname, archivo.ruta);
                    if (fs.existsSync(rutaCompleta)) {
                        encontrados++;
                        const stats = fs.statSync(rutaCompleta);
                        console.log(`   ✅ ${archivo.ruta} (${(stats.size/1024).toFixed(2)} KB)`);
                    } else {
                        console.log(`   ❌ ${archivo.ruta} (no encontrado)`);
                    }
                });
                return encontrados;
            }
        },
        {
            nombre: 'Variables de entorno',
            check: () => {
                const required = ['OPENAI_API_KEY', 'PINECONE_API_KEY'];
                let encontradas = 0;
                required.forEach(env => {
                    if (process.env[env]) {
                        console.log(`   ✅ ${env} configurada`);
                        encontradas++;
                    } else {
                        console.log(`   ❌ ${env} faltante`);
                    }
                });
                return encontradas;
            }
        }
    ];
    
    let todoOK = true;
    verificaciones.forEach(verificacion => {
        console.log(`🔍 [CHECK] ${verificacion.nombre}:`);
        const resultado = verificacion.check();
        if (resultado === 0) todoOK = false;
        console.log('');
    });
    
    return todoOK;
}

// =====================================
// FUNCIÓN PRINCIPAL
// =====================================

async function main() {
    try {
        // Verificar sistema antes de cargar
        const sistemaOK = await verificarSistema();
        
        if (!sistemaOK) {
            console.log('❌ [ERROR] Sistema no está listo. Por favor revisa los archivos y configuración.');
            process.exit(1);
        }
        
        console.log('✅ [SISTEMA] Verificación completada. Iniciando carga...\n');
        
        // Cargar conocimiento
        const resultados = await cargarTodoElConocimiento();
        
        // Mostrar siguiente pasos
        console.log('\n🎯 [PRÓXIMOS PASOS] Para usar el sistema RAG:');
        console.log('   1. 🧪 Prueba consultas sobre la empresa');
        console.log('   2. 📊 Monitorea los logs para ver el RAG en acción');
        console.log('   3. ➕ Añade más conocimiento con ragInteligente.añadirConocimientoNuevo()');
        console.log('   4. 🔧 Ajusta CONFIG_RAG según necesidades\n');
        
        console.log('🚀 [RESULTADO] Sistema RAG listo para usar!');
        
    } catch (error) {
        console.error('❌ [ERROR FATAL]:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// =====================================
// UTILIDADES ADICIONALES
// =====================================

function mostrarAyuda() {
    console.log(`
🆘 AYUDA - CARGADOR DE CONOCIMIENTO

USO:
   node cargar-conocimiento.js [opciones]

OPCIONES:
   --help, -h     Muestra esta ayuda
   --verify, -v   Solo verifica el sistema sin cargar
   --dry-run, -d  Simula la carga sin enviar a Pinecone

ARCHIVOS REQUERIDOS:
   • baseConocimiento.txt - Información general de la empresa
   • descripcionERP.txt - Descripción del sistema ERP
   
VARIABLES DE ENTORNO:
   • OPENAI_API_KEY - Clave de API de OpenAI
   • PINECONE_API_KEY - Clave de API de Pinecone

EJEMPLO:
   node cargar-conocimiento.js
   
💡 NOTAS:
   - La primera carga puede tomar varios minutos
   - Los embeddings se almacenan en Pinecone namespace 'conocimiento_empresa'
   - Puedes ejecutar este script múltiples veces (actualizará el conocimiento)
`);
}

// =====================================
// PROCESAMIENTO DE ARGUMENTOS
// =====================================

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    mostrarAyuda();
    process.exit(0);
}

if (args.includes('--verify') || args.includes('-v')) {
    verificarSistema().then(ok => {
        console.log(ok ? '✅ Sistema verificado correctamente' : '❌ Sistema tiene problemas');
        process.exit(ok ? 0 : 1);
    });
} else {
    // Ejecutar carga normal
    main();
}

module.exports = { cargarTodoElConocimiento, verificarSistema };