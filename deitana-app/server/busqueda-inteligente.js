require('dotenv').config();
const pineconeUtils = require('./utils/pinecone');

class BusquedaInteligente {
    constructor() {
        this.estrategias = [
            'directa',
            'palabras_clave',
            'contexto_empresa',
            'terminos_especificos'
        ];
    }

    async buscarConEstrategias(consulta, limite = 5) {
        console.log(`🧠 [BÚSQUEDA INTELIGENTE] Consulta: "${consulta}"`);
        
        const variaciones = this.generarVariaciones(consulta);
        let todosResultados = [];
        
        for (const variacion of variaciones) {
            console.log(`🔍 Probando: "${variacion}"`);
            const resultados = await pineconeUtils.buscarRecuerdos(variacion, limite * 2);
            
            // Marcar con estrategia usada
            resultados.forEach(r => r.estrategia = variacion);
            todosResultados = todosResultados.concat(resultados);
        }
        
        // Deduplicar y priorizar
        return this.deduplicarYPriorizar(todosResultados, limite);
    }

    generarVariaciones(consulta) {
        const variaciones = [];
        
        // 1. Consulta directa
        variaciones.push(consulta);
        
        // 2. Extraer palabras clave importantes
        const palabrasClave = this.extraerPalabrasClave(consulta);
        if (palabrasClave.length > 0) {
            variaciones.push(palabrasClave.join(' '));
        }
        
        // 3. Añadir contexto de empresa
        variaciones.push(`SEMILLEROS DEITANA ${consulta}`);
        variaciones.push(`informacionEmpresa.txt ${palabrasClave.join(' ')}`);
        
        // 4. Términos específicos según el dominio
        const terminosEspecificos = this.mapearTerminosEspecificos(consulta);
        variaciones.push(...terminosEspecificos);
        
        console.log(`📋 Variaciones generadas: ${variaciones.length}`);
        return variaciones;
    }

    extraerPalabrasClave(consulta) {
        const stopWords = ['cada', 'que', 'como', 'donde', 'cuando', 'para', 'el', 'la', 'de', 'se', 'es'];
        
        return consulta.toLowerCase()
            .replace(/[¿?¡!.,;:()\[\]]/g, ' ')
            .split(/\s+/)
            .filter(palabra => palabra.length > 2)
            .filter(palabra => !stopWords.includes(palabra))
            .slice(0, 5);
    }

    mapearTerminosEspecificos(consulta) {
        const mapeos = {
            // Cambio de agua
            'agua.*bandejas': ['FRECUENCIA DEL PROCESO', 'cambio agua 9000', 'frecuencia cambio'],
            'tiempo.*agua': ['FRECUENCIA DEL PROCESO', 'cambio agua'],
            'frecuencia.*agua': ['FRECUENCIA DEL PROCESO'],
            
            // Códigos y productos
            'codigo.*tomate': ['TOMATE AMARELO', 'Semilla Utilizada 00000013'],
            'tomate.*amarillo': ['TOMATE AMARELO 00000013'],
            
            // Clientes y términos ERP
            'CL_DENO': ['Tabla Relacionada clientes', 'CL_DENO'],
            'AR_PRV': ['Tabla Relacionada articulos', 'AR_PRV'],
            
            // Injertos y procesos
            'injertos': ['proceso injertos', 'germinación'],
            'bandejas': ['BN_ALV', 'tipos bandejas'],
            
            // Roberto cliente
            'Roberto': ['cliente Roberto', 'información Roberto']
        };
        
        const terminos = [];
        
        for (const [patron, palabras] of Object.entries(mapeos)) {
            const regex = new RegExp(patron, 'i');
            if (regex.test(consulta)) {
                terminos.push(...palabras);
            }
        }
        
        return terminos;
    }

    deduplicarYPriorizar(resultados, limite) {
        // Deduplicar por ID
        const unicos = new Map();
        
        resultados.forEach(resultado => {
            if (!unicos.has(resultado.id)) {
                unicos.set(resultado.id, resultado);
            } else {
                // Si ya existe, mantener el de mayor score
                const existente = unicos.get(resultado.id);
                if (resultado.score > existente.score) {
                    unicos.set(resultado.id, resultado);
                }
            }
        });
        
        // Convertir a array y ordenar por prioridad
        const resultadosUnicos = Array.from(unicos.values());
        
        return resultadosUnicos
            .sort((a, b) => {
                // Priorizar información de empresa
                const aEsEmpresa = this.esInformacionEmpresa(a);
                const bEsEmpresa = this.esInformacionEmpresa(b);
                
                if (aEsEmpresa && !bEsEmpresa) return -1;
                if (!aEsEmpresa && bEsEmpresa) return 1;
                
                // Luego por score
                return b.score - a.score;
            })
            .slice(0, limite);
    }

    esInformacionEmpresa(resultado) {
        return resultado.contenido.includes('SEMILLEROS DEITANA') ||
               resultado.contenido.includes('informacionEmpresa.txt') ||
               resultado.id?.includes('informacion_empresa');
    }
}

// Test de la búsqueda inteligente
async function testBusquedaInteligente() {
    console.log('🧪 [TEST] Búsqueda Inteligente vs Búsqueda Normal\n');
    
    const busqueda = new BusquedaInteligente();
    
    const consultas = [
        "cada que tiempo se cambia el agua para lavar bandejas",
        "que significa CL_DENO en clientes",
        "cual es el codigo del tomate amarillo",
        "que informacion hay sobre Roberto"
    ];
    
    for (const consulta of consultas) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🎯 CONSULTA: "${consulta}"`);
        console.log(`${'='.repeat(60)}`);
        
        // Búsqueda normal
        console.log('\n❌ BÚSQUEDA NORMAL:');
        const normal = await pineconeUtils.buscarRecuerdos(consulta, 3);
        const empresaNormal = normal.filter(r => 
            r.contenido.includes('SEMILLEROS DEITANA') || r.id?.includes('informacion_empresa')
        );
        console.log(`   Resultados empresa: ${empresaNormal.length}/${normal.length}`);
        
        // Búsqueda inteligente
        console.log('\n✅ BÚSQUEDA INTELIGENTE:');
        const inteligente = await busqueda.buscarConEstrategias(consulta, 3);
        const empresaInteligente = inteligente.filter(r => 
            r.contenido.includes('SEMILLEROS DEITANA') || r.id?.includes('informacion_empresa')
        );
        console.log(`   Resultados empresa: ${empresaInteligente.length}/${inteligente.length}`);
        
        if (empresaInteligente.length > 0) {
            console.log('   🎯 MEJOR RESULTADO:');
            console.log(`   ${empresaInteligente[0].contenido.substring(0, 150)}...`);
        }
    }
}

if (require.main === module) {
    testBusquedaInteligente();
}

module.exports = { BusquedaInteligente }; 