const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Configurar OpenAI (necesitarás tu API key)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'tu-api-key-aqui'
});

async function startFineTuning() {
    try {
        console.log('🚀 Iniciando Fine-Tuning de Deitana IA...');
        
        // 1. Subir el archivo de entrenamiento
        console.log('📤 Subiendo dataset...');
        // Leer y limpiar el archivo (remover líneas vacías)
        const rawData = fs.readFileSync('./processed/training-dataset.jsonl', 'utf8');
        const cleanData = rawData.split('\n').filter(line => line.trim() !== '').join('\n');
        fs.writeFileSync('./processed/training-dataset-clean.jsonl', cleanData);
        
        const file = await openai.files.create({
            file: fs.createReadStream('./processed/training-dataset-fixed.jsonl'),
            purpose: 'fine-tune'
        });
        
        console.log(`✅ Archivo subido: ${file.id}`);
        
        // 2. Crear el fine-tuning job
        console.log('🎯 Creando job de fine-tuning...');
        const fineTune = await openai.fineTuning.jobs.create({
            training_file: file.id,
            model: 'gpt-3.5-turbo',
            hyperparameters: {
                n_epochs: 3
            },
            suffix: 'deitana-natural'
        });
        
        console.log(`🔥 Fine-tuning iniciado: ${fineTune.id}`);
        console.log(`📊 Estado: ${fineTune.status}`);
        
        // 3. Monitorear progreso
        console.log('⏳ Monitoreando progreso...');
        let status = fineTune.status;
        
        while (status !== 'succeeded' && status !== 'failed') {
            await new Promise(resolve => setTimeout(resolve, 30000)); // Esperar 30 segundos
            
            const updated = await openai.fineTuning.jobs.retrieve(fineTune.id);
            status = updated.status;
            
            console.log(`📈 Estado actual: ${status}`);
            
            if (updated.trained_tokens) {
                console.log(`🎯 Tokens entrenados: ${updated.trained_tokens}`);
            }
        }
        
        if (status === 'succeeded') {
            const finalModel = await openai.fineTuning.jobs.retrieve(fineTune.id);
            console.log(`🎉 ¡Fine-tuning completado!`);
            console.log(`🤖 Modelo final: ${finalModel.fine_tuned_model}`);
            console.log(`💰 Costo total: $${(finalModel.trained_tokens * 0.008 / 1000).toFixed(4)}`);
            
            // Guardar información del modelo
            fs.writeFileSync('./model-info.json', JSON.stringify({
                modelId: finalModel.fine_tuned_model,
                jobId: fineTune.id,
                createdAt: new Date().toISOString(),
                trainedTokens: finalModel.trained_tokens,
                examples: 55
            }, null, 2));
            
            console.log('📝 Información guardada en model-info.json');
            
        } else {
            console.log('❌ Fine-tuning falló');
            const failedJob = await openai.fineTuning.jobs.retrieve(fineTune.id);
            console.log('Error:', failedJob.error);
        }
        
    } catch (error) {
        console.error('💥 Error en fine-tuning:', error.message);
    }
}

// Primero cancelar el job anterior
async function cancelAndRestart() {
    try {
        // Cancelar job anterior
        const jobId = 'ftjob-qYwT4d4okngQqr6V3qwUQoc0';
        console.log(`🛑 Cancelando job anterior: ${jobId}`);
        await openai.fineTuning.jobs.cancel(jobId);
        console.log('✅ Job anterior cancelado');
        
        // Esperar un momento y reiniciar con GPT-5
        setTimeout(() => {
            console.log('🚀 Iniciando con GPT-5...');
            startFineTuning();
        }, 3000);
        
    } catch (error) {
        console.log('⚠️ Error cancelando (puede que ya esté terminado):', error.message);
        // Continuar con GPT-5 de todos modos
        startFineTuning();
    }
}

// Ejecutar cancelación y restart
cancelAndRestart();