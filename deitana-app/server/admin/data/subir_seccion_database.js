const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const pinecone = new Pinecone({
    apiKey: 'pcsk_ctXEB_EytPZdg6HJhk2HPbfvEfknyuM671AZUmwz82YSMVgjYfGfR3QfsLMXC8BcRjUvY'
});

const index = pinecone.index('deitana-database');

async function subirSeccion() {
    try {
        console.log('🚀 Subiendo contenido de mapaERP.txt a Pinecone...\n');
        
        const mapaERPPath = path.resolve(__dirname, '../core/mapaERP.txt');
        const mapaERPContent = fs.readFileSync(mapaERPPath, 'utf-8');
        
        if (!mapaERPContent || mapaERPContent.trim().length === 0) {
            console.log('⚠️ El archivo mapaERP.txt está vacío');
            return;
        }
        
        // Dividir por secciones usando separador ===== (puedes agregar esto entre secciones)
        const sections = mapaERPContent.split(/={5,}/).filter(s => s.trim().length > 100);
        
        console.log(`📊 Secciones encontradas: ${sections.length}\n`);
        
        if (sections.length === 0) {
            // Si no hay separadores, tratar todo el archivo como UNA sección
            sections.push(mapaERPContent);
            console.log('📝 Sin separadores ===== , tratando todo el archivo como una sección\n');
        }
        
        const vectors = [];
        
        for (let i = 0; i < sections.length; i++) {
            const sectionContent = sections[i].trim();
            
            // Extraer nombre de la sección (primera línea o primera tabla mencionada)
            const firstLine = sectionContent.split('\n')[0];
            let sectionName = `seccion_${i + 1}`;
            
            const tableMatch = sectionContent.match(/Tabla de la base de datos:\s*(\w+)/);
            if (tableMatch) {
                sectionName = tableMatch[1];
            }
            
            console.log(`📊 Sección ${i + 1}/${sections.length}: ${sectionName}`);
            console.log(`   📏 ${sectionContent.length} caracteres`);
            
            // Crear embedding de TODA la sección
            const embeddingResponse = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: sectionContent,
                dimensions: 512
            });
            
            const embedding = embeddingResponse.data[0].embedding;
            
            // Metadata (Pinecone soporta hasta 40KB)
            const metadata = {
                sectionName: sectionName,
                content: sectionContent.substring(0, 10000), // Aumentado a 10000 chars
                fullLength: sectionContent.length
            };
            
            vectors.push({
                id: `section_${sectionName}_${Date.now()}`,
                values: embedding,
                metadata: metadata
            });
            
            console.log(`   ✅ Embedding generado\n`);
        }
        
        // Subir TODOS los vectores
        if (vectors.length > 0) {
            console.log(`📤 Subiendo ${vectors.length} secciones a Pinecone (deitana-database)...\n`);
            
            let retries = 3;
            while (retries > 0) {
                try {
                    await index.upsert(vectors);
                    console.log(`✅ Sección(es) subida(s) correctamente\n`);
                    break;
                } catch (err) {
                    retries--;
                    console.log(`⚠️ Error subiendo, reintentando... (${retries} restantes)`);
                    if (retries === 0) throw err;
                    await new Promise(r => setTimeout(r, 5000));
                }
            }
        }
        
        console.log(`🎉 ¡COMPLETADO!`);
        console.log(`   ✅ Secciones indexadas: ${vectors.length}`);
        console.log(`   📊 Índice: deitana-database`);
        console.log(`\n💡 Para agregar más secciones:`);
        console.log(`   1. Agrega contenido a mapaERP.txt`);
        console.log(`   2. Separa secciones con: =====`);
        console.log(`   3. Vuelve a ejecutar: node server/admin/data/subir_seccion_database.js`);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

subirSeccion();
