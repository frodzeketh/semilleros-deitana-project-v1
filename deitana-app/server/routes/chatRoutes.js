const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { processQueryStream } = require('../admin/core/openAI');

// Middleware para todas las rutas
router.use(verifyToken);

// Ruta simple para streaming
router.post('/stream', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Mensaje requerido' });
        }

        // Respuesta con memoria RAM
        await processQueryStream({ 
            message, 
            conversationId: req.body.conversationId || `temp_${Date.now()}`,
            response: res 
        });
        
    } catch (error) {
        console.error('Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
});

// =====================================
// RUTA PARA OBTENER DATOS DE CASAS COMERCIALES
// =====================================
router.get('/partidas/riesgo', async (req, res) => {
    try {
        const userId = req.user.uid;
        console.log('🏢 [CASAS-COMERCIALES] Obteniendo datos de casas comerciales para usuario:', userId);
        
        // Importar la conexión a la base de datos
        const { query } = require('../db-bridge');
        
        // Consulta SQL para obtener datos de formas de pago con vencimientos
        const sqlQuery = `
            SELECT 
                f.id,
                f.FP_DENO,
                f.FP_NVT,
                f.FP_CART,
                f.FP_TIPO,
                f.FP_RW,
                GROUP_CONCAT(
                    CONCAT('Vto ', d.id2, ': ', d.C0, ' días')
                    ORDER BY d.id2
                    SEPARATOR ' | '
                ) AS Vencimientos_Dias
            FROM
                fpago f
            LEFT JOIN
                fpago_fp_dias d ON f.id = d.id
            GROUP BY
                f.id, f.FP_DENO, f.FP_NVT, f.FP_CART, f.FP_TIPO, f.FP_RW
            ORDER BY
                f.id
        `;
        
        console.log('💳 [FORMAS-PAGO] Ejecutando consulta SQL...');
        
        // Ejecutar consulta en la VPS
        const results = await query(sqlQuery);
        
        console.log('💳 [FORMAS-PAGO] Resultados obtenidos:', results.length, 'registros');
        console.log('💳 [FORMAS-PAGO] Tipo de results:', typeof results, Array.isArray(results));
        console.log('💳 [FORMAS-PAGO] Primer registro raw:', results[0]);
        
        // Los resultados vienen como array de arrays, necesitamos acceder al primer elemento
        const dataArray = Array.isArray(results[0]) ? results[0] : results;
        console.log('💳 [FORMAS-PAGO] Data array length:', dataArray.length);
        
        // Transformar datos al formato esperado por el frontend
        const formasPagoData = dataArray.map((row, index) => {
            console.log(`💳 [FORMAS-PAGO] Procesando registro ${index + 1}:`, {
                id: row.id,
                FP_DENO: row.FP_DENO,
                FP_NVT: row.FP_NVT,
                FP_CART: row.FP_CART,
                FP_TIPO: row.FP_TIPO,
                FP_RW: row.FP_RW,
                Vencimientos_Dias: row.Vencimientos_Dias
            });
            
            // Mapear el tipo de pago según las especificaciones
            let tipoPagoDescripcion = '';
            switch(row.FP_TIPO) {
                case 'C': tipoPagoDescripcion = 'Efectivo'; break;
                case 'J': tipoPagoDescripcion = 'Tarjeta Crédito'; break;
                case 'T': tipoPagoDescripcion = 'Talon'; break;
                case 'E': tipoPagoDescripcion = 'Efecto'; break;
                case 'L': tipoPagoDescripcion = 'Letra Cambio'; break;
                case 'P': tipoPagoDescripcion = 'Pagaré'; break;
                case 'R': tipoPagoDescripcion = 'Recibo'; break;
                case 'X': tipoPagoDescripcion = 'Transferencia'; break;
                case 'O': tipoPagoDescripcion = 'Otros'; break;
                case 'F': tipoPagoDescripcion = 'Confirming'; break;
                default: tipoPagoDescripcion = row.FP_TIPO || 'Sin tipo';
            }
            
            return {
                id: row.id || `FP-${String(index + 1).padStart(3, '0')}`,
                codigoFormaPago: row.id || 'Sin código',
                denominacion: row.FP_DENO || 'Sin denominación',
                numeroVencimientos: row.FP_NVT || 'Sin vencimientos',
                aCartera: row.FP_CART === 'S' ? 'SÍ' : row.FP_CART === 'N' ? 'NO' : 'Sin especificar',
                tipoPago: tipoPagoDescripcion,
                tipoPagoCodigo: row.FP_TIPO || 'Sin código',
                referenciaWeb: row.FP_RW || 'Sin referencia web',
                vencimientosDias: row.Vencimientos_Dias || 'Sin vencimientos especificados'
            };
        });
        
        console.log('💳 [FORMAS-PAGO] Datos transformados:', formasPagoData.length, 'registros');
        console.log('💳 [FORMAS-PAGO] Datos finales:', formasPagoData);
        
        res.json({ 
            success: true, 
            data: formasPagoData,
            total: formasPagoData.length,
            source: 'vps'
        });
        
    } catch (error) {
        console.error('❌ [FORMAS-PAGO] Error al obtener datos de formas de pago:', error);
        
        // Datos de ejemplo en caso de error
        const datosEjemplo = [
            {
                id: "FP-001",
                codigoFormaPago: "1120",
                denominacion: "Pago a 30 días",
                numeroVencimientos: "1",
                aCartera: "SÍ",
                tipoPago: "Efecto",
                tipoPagoCodigo: "E",
                referenciaWeb: "Sin referencia web",
                vencimientosDias: "Vto 1: 30 días"
            },
            {
                id: "FP-002",
                codigoFormaPago: "1121",
                denominacion: "Pago a 60 y 90 días",
                numeroVencimientos: "2",
                aCartera: "SÍ",
                tipoPago: "Pagaré",
                tipoPagoCodigo: "P",
                referenciaWeb: "Sin referencia web",
                vencimientosDias: "Vto 1: 60 días | Vto 2: 90 días"
            },
            {
                id: "FP-003",
                codigoFormaPago: "1122",
                denominacion: "Pago al contado",
                numeroVencimientos: "1",
                aCartera: "NO",
                tipoPago: "Efectivo",
                tipoPagoCodigo: "C",
                referenciaWeb: "Sin referencia web",
                vencimientosDias: "Vto 1: 0 días"
            }
        ];
        
        res.json({ 
            success: true, 
            data: datosEjemplo,
            total: datosEjemplo.length,
            source: 'ejemplo',
            error: 'Error al conectar con la VPS, mostrando datos de ejemplo'
        });
    }
});

module.exports = router; 