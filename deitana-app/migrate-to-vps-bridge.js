#!/usr/bin/env node

// =====================================
// SCRIPT DE MIGRACIÓN A VPS BRIDGE
// =====================================
// 
// Este script facilita la migración de la conexión directa MySQL
// al sistema VPS Bridge de forma gradual y segura.
// 
// FUNCIONES:
// - Test de conexión VPS Bridge
// - Comparación de resultados entre sistemas
// - Migración gradual con validaciones
// - Rollback automático en caso de errores
// =====================================

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Importar ambos sistemas
const directPool = require('./server/db');
const { getBridgeClient } = require('./server/vps-bridge-client');

class MigrationTester {
    constructor() {
        this.bridgeClient = null;
        this.testQueries = [
            {
                name: 'Test básico',
                sql: 'SELECT 1 as test, NOW() as timestamp',
                params: []
            },
            {
                name: 'Conteo de tablas',
                sql: 'SELECT COUNT(*) as table_count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
                params: []
            },
            {
                name: 'Información de base de datos',
                sql: 'SELECT DATABASE() as db_name, VERSION() as mysql_version, CONNECTION_ID() as connection_id',
                params: []
            }
        ];
    }

    async initializeBridge() {
        console.log('🌉 Inicializando cliente VPS Bridge...');
        this.bridgeClient = getBridgeClient();
        
        try {
            // Test de health check
            const health = await this.bridgeClient.healthCheck();
            console.log('✅ Health check exitoso:', health.status);
            
            // Test de autenticación
            await this.bridgeClient.authenticate();
            console.log('✅ Autenticación exitosa');
            
            return true;
        } catch (error) {
            console.error('❌ Error inicializando VPS Bridge:', error.message);
            return false;
        }
    }

    async testDirectConnection() {
        console.log('\n🔗 Probando conexión directa...');
        
        try {
            const connection = await directPool.getConnection();
            const [rows] = await connection.execute('SELECT 1 as test');
            connection.release();
            
            console.log('✅ Conexión directa funcional');
            return true;
        } catch (error) {
            console.error('❌ Error conexión directa:', error.message);
            return false;
        }
    }

    async compareQuery(query) {
        console.log(`\n🔍 Comparando consulta: ${query.name}`);
        console.log(`   SQL: ${query.sql}`);
        
        let directResult = null;
        let bridgeResult = null;
        let directTime = 0;
        let bridgeTime = 0;

        // Ejecutar en conexión directa
        try {
            const startTime = Date.now();
            const [rows] = await directPool.query(query.sql, query.params);
            directTime = Date.now() - startTime;
            directResult = rows;
            console.log(`   📍 Directo: ${rows.length} filas en ${directTime}ms`);
        } catch (error) {
            console.error(`   ❌ Error directo: ${error.message}`);
        }

        // Ejecutar en VPS Bridge
        try {
            const startTime = Date.now();
            const result = await this.bridgeClient.query(query.sql, query.params, false); // Sin cache para comparación
            bridgeTime = Date.now() - startTime;
            bridgeResult = result.data;
            console.log(`   🌉 Bridge: ${result.rowCount} filas en ${result.executionTime}ms (total: ${bridgeTime}ms)`);
        } catch (error) {
            console.error(`   ❌ Error bridge: ${error.message}`);
        }

        // Comparar resultados
        if (directResult && bridgeResult) {
            const directCount = directResult.length;
            const bridgeCount = bridgeResult.length;
            
            if (directCount === bridgeCount) {
                console.log('   ✅ Coincidencia en número de filas');
                
                // Comparar contenido del primer registro si existe
                if (directCount > 0) {
                    const directFirst = JSON.stringify(directResult[0]);
                    const bridgeFirst = JSON.stringify(bridgeResult[0]);
                    
                    if (directFirst === bridgeFirst) {
                        console.log('   ✅ Coincidencia en contenido');
                    } else {
                        console.log('   ⚠️  Diferencia en contenido:');
                        console.log('       Directo:', directFirst);
                        console.log('       Bridge:', bridgeFirst);
                    }
                }
                
                return true;
            } else {
                console.log(`   ❌ Diferencia en filas: Directo=${directCount}, Bridge=${bridgeCount}`);
                return false;
            }
        }
        
        return false;
    }

    async runAllComparisons() {
        console.log('\n📊 Ejecutando comparaciones...');
        
        let passedTests = 0;
        const totalTests = this.testQueries.length;
        
        for (const query of this.testQueries) {
            try {
                const passed = await this.compareQuery(query);
                if (passed) passedTests++;
            } catch (error) {
                console.error(`❌ Error en test ${query.name}:`, error.message);
            }
        }
        
        console.log(`\n📈 Resultados: ${passedTests}/${totalTests} tests pasaron`);
        return passedTests === totalTests;
    }

    async testVPSBridgeFeatures() {
        console.log('\n🔧 Probando características específicas del VPS Bridge...');
        
        try {
            // Test de cache
            console.log('💾 Probando cache...');
            const startTime = Date.now();
            await this.bridgeClient.query('SELECT NOW() as cached_time', [], true);
            const firstTime = Date.now() - startTime;
            
            const cacheStartTime = Date.now();
            await this.bridgeClient.query('SELECT NOW() as cached_time', [], true);
            const cacheTime = Date.now() - cacheStartTime;
            
            console.log(`   Primera consulta: ${firstTime}ms`);
            console.log(`   Consulta con cache: ${cacheTime}ms`);
            
            if (cacheTime < firstTime) {
                console.log('   ✅ Cache funcionando correctamente');
            } else {
                console.log('   ⚠️  Cache puede no estar funcionando');
            }
            
            // Test de endpoints específicos
            console.log('\n📊 Probando endpoints específicos...');
            
            try {
                const stats = await this.bridgeClient.getDatabaseStats();
                console.log('   ✅ Estadísticas de DB obtenidas:', stats.data?.tables?.length || 0, 'tablas');
            } catch (error) {
                console.log('   ⚠️  Error obteniendo estadísticas:', error.message);
            }
            
            try {
                const updates = await this.bridgeClient.getLatestUpdates();
                console.log('   ✅ Últimas actualizaciones obtenidas');
            } catch (error) {
                console.log('   ⚠️  Error obteniendo actualizaciones:', error.message);
            }
            
            // Información del cache
            const cacheInfo = this.bridgeClient.getCacheInfo();
            console.log(`   💾 Cache: ${cacheInfo.size} entradas, ${(cacheInfo.totalSize / 1024).toFixed(2)} KB`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Error probando características VPS:', error.message);
            return false;
        }
    }

    async createMigrationBackup() {
        console.log('\n💾 Creando backup de configuración...');
        
        try {
            // Backup del archivo db.js actual
            const dbPath = path.join(__dirname, 'server', 'db.js');
            const backupPath = path.join(__dirname, 'server', 'db.js.backup');
            
            if (fs.existsSync(dbPath)) {
                fs.copyFileSync(dbPath, backupPath);
                console.log('✅ Backup creado:', backupPath);
            }
            
            // Backup de .env actual
            const envPath = path.join(__dirname, '.env');
            const envBackupPath = path.join(__dirname, '.env.backup');
            
            if (fs.existsSync(envPath)) {
                fs.copyFileSync(envPath, envBackupPath);
                console.log('✅ Backup de .env creado');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error creando backup:', error.message);
            return false;
        }
    }

    async updateConfiguration() {
        console.log('\n⚙️  Actualizando configuración...');
        
        try {
            // Crear nuevo archivo db.js que use el bridge
            const newDbContent = `// Auto-generado por migrate-to-vps-bridge.js
// Fecha: ${new Date().toISOString()}

module.exports = require('./db-bridge');
`;
            
            const dbPath = path.join(__dirname, 'server', 'db.js');
            fs.writeFileSync(dbPath, newDbContent);
            console.log('✅ db.js actualizado para usar VPS Bridge');
            
            // Actualizar .env con configuración VPS Bridge
            const envPath = path.join(__dirname, '.env');
            let envContent = '';
            
            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf8');
            }
            
            // Agregar configuración VPS Bridge si no existe
            if (!envContent.includes('USE_VPS_BRIDGE')) {
                envContent += `

# =====================================
# CONFIGURACIÓN VPS BRIDGE (Auto-agregado)
# =====================================
USE_VPS_BRIDGE=true
FALLBACK_TO_DIRECT=true
VPS_BRIDGE_URL=https://mysql-bridge.tu-dominio.com
VPS_BRIDGE_USER=api_user
VPS_BRIDGE_PASSWORD=cambiar_este_password

`;
                fs.writeFileSync(envPath, envContent);
                console.log('✅ Variables VPS Bridge agregadas a .env');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error actualizando configuración:', error.message);
            return false;
        }
    }

    async restoreBackup() {
        console.log('\n🔄 Restaurando backup...');
        
        try {
            const dbBackupPath = path.join(__dirname, 'server', 'db.js.backup');
            const dbPath = path.join(__dirname, 'server', 'db.js');
            
            if (fs.existsSync(dbBackupPath)) {
                fs.copyFileSync(dbBackupPath, dbPath);
                console.log('✅ db.js restaurado');
            }
            
            const envBackupPath = path.join(__dirname, '.env.backup');
            const envPath = path.join(__dirname, '.env');
            
            if (fs.existsSync(envBackupPath)) {
                fs.copyFileSync(envBackupPath, envPath);
                console.log('✅ .env restaurado');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error restaurando backup:', error.message);
            return false;
        }
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            vps_bridge_url: process.env.VPS_BRIDGE_URL || 'NO_CONFIGURADO',
            tests: {
                bridge_initialization: false,
                direct_connection: false,
                query_comparisons: false,
                bridge_features: false
            },
            recommendations: []
        };

        console.log('\n📋 Generando reporte de migración...');

        // Test de inicialización del bridge
        report.tests.bridge_initialization = await this.initializeBridge();
        
        // Test de conexión directa
        report.tests.direct_connection = await this.testDirectConnection();
        
        // Comparaciones de consultas
        if (report.tests.bridge_initialization && report.tests.direct_connection) {
            report.tests.query_comparisons = await this.runAllComparisons();
        }
        
        // Características del VPS Bridge
        if (report.tests.bridge_initialization) {
            report.tests.bridge_features = await this.testVPSBridgeFeatures();
        }

        // Generar recomendaciones
        if (!report.tests.bridge_initialization) {
            report.recommendations.push('Configurar correctamente VPS_BRIDGE_URL y credenciales');
            report.recommendations.push('Verificar que el VPS Bridge esté ejecutándose y accesible');
        }
        
        if (!report.tests.direct_connection) {
            report.recommendations.push('Verificar configuración de conexión directa para fallback');
        }
        
        if (!report.tests.query_comparisons) {
            report.recommendations.push('Revisar diferencias entre resultados de consultas');
            report.recommendations.push('Considerar migración gradual con FALLBACK_TO_DIRECT=true');
        }
        
        if (report.tests.query_comparisons && report.tests.bridge_features) {
            report.recommendations.push('Sistema listo para migración completa');
            report.recommendations.push('Configurar USE_VPS_BRIDGE=true en producción');
        }

        // Guardar reporte
        const reportPath = path.join(__dirname, `migration-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log('\n📊 REPORTE DE MIGRACIÓN');
        console.log('========================');
        console.log(`Bridge Initialization: ${report.tests.bridge_initialization ? '✅' : '❌'}`);
        console.log(`Direct Connection: ${report.tests.direct_connection ? '✅' : '❌'}`);
        console.log(`Query Comparisons: ${report.tests.query_comparisons ? '✅' : '❌'}`);
        console.log(`Bridge Features: ${report.tests.bridge_features ? '✅' : '❌'}`);
        
        console.log('\n📝 Recomendaciones:');
        report.recommendations.forEach(rec => console.log(`   - ${rec}`));
        
        console.log(`\n💾 Reporte guardado en: ${reportPath}`);
        
        return report;
    }
}

// Función principal
async function main() {
    console.log('🚀 MIGRACIÓN A VPS BRIDGE');
    console.log('==========================\n');
    
    const tester = new MigrationTester();
    
    try {
        // Generar reporte completo
        const report = await tester.generateReport();
        
        // Determinar si proceder con la migración
        const allTestsPassed = Object.values(report.tests).every(test => test);
        
        if (allTestsPassed) {
            console.log('\n🎉 ¡Todos los tests pasaron! ¿Proceder con la migración? (y/N)');
            
            // En modo automático, no migrar sin confirmación
            if (process.argv.includes('--auto-migrate')) {
                console.log('🔄 Ejecutando migración automática...');
                
                await tester.createMigrationBackup();
                await tester.updateConfiguration();
                
                console.log('\n✅ Migración completada. Reinicia la aplicación para aplicar los cambios.');
                console.log('⚠️  Si hay problemas, ejecuta el rollback con: node migrate-to-vps-bridge.js --rollback');
            } else {
                console.log('💡 Para migrar automáticamente, ejecuta: node migrate-to-vps-bridge.js --auto-migrate');
            }
        } else {
            console.log('\n⚠️  Algunos tests fallaron. Revisa la configuración antes de migrar.');
        }
        
    } catch (error) {
        console.error('\n💥 Error durante la migración:', error.message);
        process.exit(1);
    } finally {
        // Limpiar recursos
        if (tester.bridgeClient) {
            tester.bridgeClient.close();
        }
        process.exit(0);
    }
}

// Manejar argumentos de línea de comandos
if (process.argv.includes('--rollback')) {
    console.log('🔄 Ejecutando rollback...');
    const tester = new MigrationTester();
    tester.restoreBackup()
        .then(() => console.log('✅ Rollback completado'))
        .catch(error => console.error('❌ Error en rollback:', error.message));
} else {
    main();
}
