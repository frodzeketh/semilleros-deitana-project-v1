const fs = require('fs');
const path = require('path');

// Función para analizar directamente el archivo informacionEmpresa.txt
async function analizarInformacionEmpresa() {
    console.log('🔍 [ANÁLISIS DIRECTO] Evaluando informacionEmpresa.txt');
    
    try {
        // Leer el archivo informacionEmpresa.txt
        const rutaArchivo = path.join(__dirname, 'admin', 'data', 'informacionEmpresa.txt');
        const contenido = fs.readFileSync(rutaArchivo, 'utf-8');
        
        console.log(`📄 [ARCHIVO] Tamaño: ${contenido.length} caracteres`);
        console.log(`📄 [ARCHIVO] Líneas: ${contenido.split('\n').length}`);
        
        // Analizar secciones
        const secciones = analizarSecciones(contenido);
        
        // Analizar información crítica
        const infoCritica = analizarInformacionCritica(contenido);
        
        // Generar reporte
        const reporte = {
            archivo: {
                tamaño: contenido.length,
                lineas: contenido.split('\n').length,
                palabras: contenido.split(/\s+/).length
            },
            secciones,
            informacionCritica: infoCritica,
            problemasDetectados: detectarProblemas(contenido, secciones),
            recomendaciones: generarRecomendaciones(secciones, infoCritica)
        };
        
        mostrarAnalisis(reporte);
        guardarReporte(reporte);
        
        return reporte;
        
    } catch (error) {
        console.error('❌ [ERROR] No se pudo analizar el archivo:', error.message);
        return null;
    }
}

function analizarSecciones(contenido) {
    console.log('\n📋 [SECCIONES] Analizando estructura del contenido...');
    
    const secciones = [];
    const lineas = contenido.split('\n');
    let seccionActual = null;
    let contadorLinea = 0;
    
    lineas.forEach((linea, index) => {
        contadorLinea++;
        
        // Detectar inicio de nueva sección
        if (linea.includes('SECCIÓN:') || linea.includes('===') || linea.match(/^\d+\./)) {
            if (seccionActual) {
                secciones.push(seccionActual);
            }
            
            seccionActual = {
                titulo: linea.trim(),
                inicio: contadorLinea,
                contenido: '',
                palabrasClave: [],
                ejemplos: []
            };
        } else if (seccionActual && linea.trim()) {
            seccionActual.contenido += linea + '\n';
            
            // Detectar ejemplos
            if (linea.includes('Ejemplo:') || linea.includes('ID:') || linea.includes('Denominación:')) {
                seccionActual.ejemplos.push(linea.trim());
            }
        }
    });
    
    // Agregar última sección
    if (seccionActual) {
        secciones.push(seccionActual);
    }
    
    // Analizar palabras clave por sección
    secciones.forEach(seccion => {
        seccion.palabrasClave = extraerPalabrasClave(seccion.contenido);
        seccion.longitud = seccion.contenido.length;
        seccion.fin = seccion.inicio + seccion.contenido.split('\n').length;
    });
    
    console.log(`✅ [SECCIONES] Encontradas ${secciones.length} secciones`);
    return secciones;
}

function extraerPalabrasClave(contenido) {
    const palabrasImportantes = [];
    
    // Buscar campos técnicos (AR_, CL_, BN_, etc.)
    const camposTecnicos = contenido.match(/[A-Z]{2,}_[A-Z]{2,}/g) || [];
    palabrasImportantes.push(...camposTecnicos);
    
    // Buscar códigos y IDs
    const codigos = contenido.match(/ID:\s*\w+/g) || [];
    palabrasImportantes.push(...codigos);
    
    // Buscar nombres específicos
    const nombres = contenido.match(/Denominación:\s*[^\n]+/g) || [];
    palabrasImportantes.push(...nombres);
    
    return [...new Set(palabrasImportantes)]; // Eliminar duplicados
}

function analizarInformacionCritica(contenido) {
    console.log('\n🎯 [INFO CRÍTICA] Buscando información empresarial clave...');
    
    const infoCritica = {
        empresa: {
            nombre: extraerInfo(contenido, /Semilleros Deitana/gi),
            fundacion: extraerInfo(contenido, /1989|treinta años|fundó/gi),
            ubicacion: extraerInfo(contenido, /Totana|Murcia|España/gi),
            certificacion: extraerInfo(contenido, /ISO 9001|ISO|certificación/gi)
        },
        
        camposTecnicos: {
            clientes: extraerInfo(contenido, /CL_DENO|CL_DOM|cliente/gi),
            articulos: extraerInfo(contenido, /AR_DENO|AR_PRV|artículo/gi),
            bandejas: extraerInfo(contenido, /BN_ALV|bandeja|alvéolo/gi),
            proveedores: extraerInfo(contenido, /PR_DENO|proveedor/gi)
        },
        
        procesos: {
            injertos: extraerInfo(contenido, /injerto|patrón|variedad/gi),
            siembra: extraerInfo(contenido, /siembra|semilla|germinación/gi),
            facturacion: extraerInfo(contenido, /facturación|facturas/gi),
            invernaderos: extraerInfo(contenido, /invernadero|sección|cultivo/gi)
        },
        
        ejemplos: {
            clientes: extraerEjemplos(contenido, /Roberto|cliente.*ejemplo/gi),
            productos: extraerEjemplos(contenido, /tomate.*amarillo|código/gi),
            maquinaria: extraerEjemplos(contenido, /atomizador|tractor/gi)
        }
    };
    
    const totalInfo = Object.values(infoCritica).reduce((total, categoria) => {
        return total + Object.values(categoria).reduce((sum, items) => sum + items.length, 0);
    }, 0);
    
    console.log(`✅ [INFO CRÍTICA] ${totalInfo} elementos clave identificados`);
    return infoCritica;
}

function extraerInfo(contenido, patron) {
    const matches = contenido.match(patron) || [];
    return [...new Set(matches)]; // Eliminar duplicados
}

function extraerEjemplos(contenido, patron) {
    const lineas = contenido.split('\n');
    const ejemplos = [];
    
    lineas.forEach(linea => {
        if (patron.test(linea)) {
            ejemplos.push(linea.trim());
        }
    });
    
    return ejemplos;
}

function detectarProblemas(contenido, secciones) {
    console.log('\n🔍 [PROBLEMAS] Detectando posibles issues...');
    
    const problemas = [];
    
    // Verificar secciones muy largas (problemáticas para embeddings)
    secciones.forEach(seccion => {
        if (seccion.longitud > 2000) {
            problemas.push({
                tipo: 'SECCION_MUY_LARGA',
                seccion: seccion.titulo,
                problema: `Sección de ${seccion.longitud} caracteres - puede ser difícil de procesar`,
                recomendacion: 'Dividir en chunks más pequeños'
            });
        }
        
        if (seccion.ejemplos.length === 0) {
            problemas.push({
                tipo: 'FALTA_EJEMPLOS',
                seccion: seccion.titulo,
                problema: 'Sección sin ejemplos específicos',
                recomendacion: 'Agregar ejemplos concretos para mejorar búsquedas'
            });
        }
    });
    
    // Verificar información crítica faltante
    const infoEsperada = [
        'Semilleros Deitana',
        '1989',
        'Totana',
        'ISO 9001',
        'CL_DENO',
        'AR_PRV'
    ];
    
    infoEsperada.forEach(info => {
        if (!contenido.includes(info)) {
            problemas.push({
                tipo: 'INFO_CRITICA_FALTANTE',
                problema: `No se encuentra: ${info}`,
                recomendacion: 'Verificar y agregar información faltante'
            });
        }
    });
    
    console.log(`⚠️ [PROBLEMAS] ${problemas.length} problemas detectados`);
    return problemas;
}

function generarRecomendaciones(secciones, infoCritica) {
    const recomendaciones = [];
    
    // Recomendaciones de chunking
    const seccionesLargas = secciones.filter(s => s.longitud > 1500);
    if (seccionesLargas.length > 0) {
        recomendaciones.push({
            prioridad: 'ALTA',
            categoria: 'CHUNKING',
            accion: `Dividir ${seccionesLargas.length} secciones largas en chunks de 800-1200 caracteres`,
            impacto: 'Mejorará precisión de búsquedas RAG'
        });
    }
    
    // Recomendaciones de indexación
    const totalEjemplos = Object.values(infoCritica.ejemplos).reduce((sum, items) => sum + items.length, 0);
    if (totalEjemplos < 10) {
        recomendaciones.push({
            prioridad: 'MEDIA',
            categoria: 'EJEMPLOS',
            accion: 'Crear chunks específicos para cada ejemplo mencionado',
            impacto: 'Mejorará respuestas a preguntas específicas'
        });
    }
    
    // Recomendaciones de campos técnicos
    const totalCampos = Object.values(infoCritica.camposTecnicos).reduce((sum, items) => sum + items.length, 0);
    if (totalCampos > 0) {
        recomendaciones.push({
            prioridad: 'ALTA',
            categoria: 'CAMPOS_TECNICOS',
            accion: 'Crear embeddings especializados para campos como CL_DENO, AR_PRV, etc.',
            impacto: 'Mejorará respuestas técnicas del ERP'
        });
    }
    
    return recomendaciones;
}

function mostrarAnalisis(reporte) {
    console.log('\n🎯 [ANÁLISIS COMPLETO] ========================================');
    console.log(`📄 Archivo: ${reporte.archivo.palabras} palabras en ${reporte.secciones.length} secciones`);
    
    console.log('\n📋 [SECCIONES PRINCIPALES]:');
    reporte.secciones.slice(0, 5).forEach((seccion, i) => {
        console.log(`${i + 1}. ${seccion.titulo} (${seccion.longitud} chars, ${seccion.ejemplos.length} ejemplos)`);
    });
    
    console.log('\n🎯 [INFORMACIÓN CRÍTICA]:');
    Object.entries(reporte.informacionCritica).forEach(([categoria, items]) => {
        const total = Object.values(items).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`• ${categoria}: ${total} elementos`);
    });
    
    if (reporte.problemasDetectados.length > 0) {
        console.log('\n⚠️ [PROBLEMAS DETECTADOS]:');
        reporte.problemasDetectados.slice(0, 3).forEach((problema, i) => {
            console.log(`${i + 1}. [${problema.tipo}] ${problema.problema}`);
        });
    }
    
    console.log('\n🔧 [RECOMENDACIONES]:');
    reporte.recomendaciones.forEach((rec, i) => {
        console.log(`${i + 1}. [${rec.prioridad}] ${rec.accion}`);
    });
    
    console.log('========================================');
}

function guardarReporte(reporte) {
    try {
        const nombreArchivo = `analisis-informacion-empresa-${new Date().toISOString().split('T')[0]}.json`;
        const rutaArchivo = path.join(__dirname, 'reportes', nombreArchivo);
        
        // Crear directorio si no existe
        const dirReportes = path.dirname(rutaArchivo);
        if (!fs.existsSync(dirReportes)) {
            fs.mkdirSync(dirReportes, { recursive: true });
        }
        
        fs.writeFileSync(rutaArchivo, JSON.stringify(reporte, null, 2));
        console.log(`\n📁 [GUARDADO] ${rutaArchivo}`);
        
    } catch (error) {
        console.log(`⚠️ [ADVERTENCIA] No se pudo guardar: ${error.message}`);
    }
}

// Ejecutar análisis
async function main() {
    console.log('🚀 [INICIO] Análisis Directo de informacionEmpresa.txt');
    console.log('🎯 [OBJETIVO] Evaluar contenido y generar plan de optimización');
    
    try {
        const reporte = await analizarInformacionEmpresa();
        
        if (reporte) {
            console.log('\n✅ [COMPLETADO] Análisis finalizado');
            console.log('📊 [RESULTADO] Revisa el reporte para el plan de acción');
            
            // Mostrar conclusión
            const totalProblemas = reporte.problemasDetectados.length;
            const totalRecomendaciones = reporte.recomendaciones.length;
            
            if (totalProblemas > 5) {
                console.log('\n🚨 [CONCLUSIÓN] El archivo necesita optimización urgente');
            } else if (totalRecomendaciones > 0) {
                console.log('\n⚠️ [CONCLUSIÓN] El archivo es bueno pero mejorable');
            } else {
                console.log('\n✅ [CONCLUSIÓN] El archivo está bien estructurado');
            }
        }
        
    } catch (error) {
        console.error('❌ [ERROR] Análisis falló:', error.message);
    }
}

if (require.main === module) {
    main();
}

module.exports = { analizarInformacionEmpresa }; 