const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const pinecone = new Pinecone({
    apiKey: 'pcsk_ctXEB_EytPZdg6HJhk2HPbfvEfknyuM671AZUmwz82YSMVgjYfGfR3QfsLMXC8BcRjUvY'
});

// ÍNDICE SEPARADO PARA ESTRUCTURA DE BASE DE DATOS
const index = pinecone.index('deitana-database');

async function indexarMapaERP() {
    try {
        console.log('🚀 Iniciando indexación de mapaERP en Pinecone (deitana-database)...');
        
        const mapaERP = require('../core/mapaERP.js');
        const vectors = [];
        let count = 0;
        
        for (const [tableName, tableInfo] of Object.entries(mapaERP)) {
            // Crear texto descriptivo de la tabla para el embedding
            let tableText = `Tabla: ${tableName}\n`;
            tableText += `Descripción: ${tableInfo.descripcion || 'Sin descripción'}\n\n`;
            
            // Agregar columnas
            if (tableInfo.columnas) {
                tableText += `Columnas disponibles:\n`;
                for (const [colName, colDesc] of Object.entries(tableInfo.columnas)) {
                    tableText += `${colName}: ${colDesc}\n`;
                }
                tableText += '\n';
            }
            
            // Agregar relaciones si existen
            if (tableInfo.relaciones) {
                tableText += `Relaciones:\n`;
                for (const [key, rel] of Object.entries(tableInfo.relaciones)) {
                    if (rel.tabla_relacionada) {
                        tableText += `- ${rel.tabla_relacionada}: ${rel.descripcion || ''}\n`;
                    }
                }
                tableText += '\n';
            }
            
            // Agregar ejemplos si existen
            if (tableInfo.ejemplos) {
                tableText += `Casos de uso:\n`;
                for (const [key, value] of Object.entries(tableInfo.ejemplos)) {
                    if (typeof value === 'string') {
                        tableText += `${key}: ${value}\n`;
                    }
                }
            }
            
            console.log(`📊 [${count + 1}] Procesando: ${tableName} (${tableText.length} caracteres)`);
            
            // Crear embedding
            const embeddingResponse = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: tableText,
                dimensions: 512
            });
            
            const embedding = embeddingResponse.data[0].embedding;
            
            // Preparar metadata (Pinecone tiene límite de 40KB por metadata)
            const metadata = {
                tableName: tableName,
                descripcion: (tableInfo.descripcion || 'Sin descripción').substring(0, 1000),
                tableText: tableText.substring(0, 3000) // Guardar el texto completo (limitado)
            };
            
            // Guardar columnas como string compacto
            if (tableInfo.columnas) {
                const columnNames = Object.keys(tableInfo.columnas).join(', ');
                metadata.columnas = columnNames.substring(0, 2000);
            }
            
            vectors.push({
                id: `table_${tableName}`,
                values: embedding,
                metadata: metadata
            });
            
            count++;
            
            // Upsert en lotes de 50 con reintento
            if (vectors.length >= 50) {
                console.log(`📤 Subiendo lote de ${vectors.length} tablas a Pinecone (deitana-database)...`);
                
                let retries = 3;
                while (retries > 0) {
                    try {
                        await index.upsert(vectors);
                        console.log(`✅ Lote subido correctamente`);
                        vectors.length = 0;
                        break;
                    } catch (err) {
                        retries--;
                        console.log(`⚠️ Error subiendo lote, reintentando... (${retries} intentos restantes)`);
                        if (retries === 0) throw err;
                        await new Promise(r => setTimeout(r, 5000)); // Esperar 5s
                    }
                }
            }
        }
        
        // Subir el último lote con reintento
        if (vectors.length > 0) {
            console.log(`📤 Subiendo último lote de ${vectors.length} tablas a Pinecone...`);
            
            let retries = 3;
            while (retries > 0) {
                try {
                    await index.upsert(vectors);
                    console.log(`✅ Último lote subido`);
                    break;
                } catch (err) {
                    retries--;
                    console.log(`⚠️ Error subiendo último lote, reintentando... (${retries} intentos restantes)`);
                    if (retries === 0) throw err;
                    await new Promise(r => setTimeout(r, 5000));
                }
            }
        }
        
        console.log(`\n🎉 ¡COMPLETADO! ${count} tablas indexadas en 'deitana-database'`);
        console.log(`\n📊 Estadísticas:`);
        console.log(`   - Total de tablas: ${count}`);
        console.log(`   - Índice: deitana-database`);
        console.log(`   - Dimensiones: 512`);
        console.log(`   - Modelo: text-embedding-3-small`);
        
    } catch (error) {
        console.error('❌ Error indexando mapaERP:', error);
        process.exit(1);
    }
}

// Ejecutar
indexarMapaERP();

