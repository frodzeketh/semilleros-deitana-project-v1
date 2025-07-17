# Verificar tablas en la base local
Write-Host "=== VERIFICANDO TABLAS EN BASE LOCAL ===" -ForegroundColor Green
mysql -h 10.120.1.5 -P 3306 -u deitana -p -e "SELECT COUNT(*) as total_tablas FROM information_schema.tables WHERE table_schema = 'eja';"

Write-Host "`n=== VERIFICANDO TABLAS EN RAILWAY ===" -ForegroundColor Green
mysql -h centerbeam.proxy.rlwy.net -P 32877 -u root -pgbrIerodvEYzzDQbgtlQjelgLaLlgPuf railway -e "SELECT COUNT(*) as total_tablas FROM information_schema.tables WHERE table_schema = 'railway';"

Write-Host "`n=== BUSCANDO TABLA 'partidas' EN LOCAL ===" -ForegroundColor Yellow
mysql -h 10.120.1.5 -P 3306 -u deitana -p -e "SHOW TABLES LIKE '%partidas%';"

Write-Host "`n=== BUSCANDO TABLA 'partidas' EN RAILWAY ===" -ForegroundColor Yellow
mysql -h centerbeam.proxy.rlwy.net -P 32877 -u root -pgbrIerodvEYzzDQbgtlQjelgLaLlgPuf railway -e "SHOW TABLES LIKE '%partidas%';" 