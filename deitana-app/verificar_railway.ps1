Write-Host "Verificando tablas en Railway..." -ForegroundColor Green
mysql -h centerbeam.proxy.rlwy.net -P 32877 -u root -pgbrIerodvEYzzDQbgtlQjelgLaLlgPuf railway -e "SELECT COUNT(*) as total_tablas FROM information_schema.tables WHERE table_schema = 'railway';"

Write-Host "`nBuscando tabla 'partidas'..." -ForegroundColor Yellow
mysql -h centerbeam.proxy.rlwy.net -P 32877 -u root -pgbrIerodvEYzzDQbgtlQjelgLaLlgPuf railway -e "SHOW TABLES LIKE '%partidas%';"

Write-Host "`nBuscando tabla 'pedidos_pr'..." -ForegroundColor Yellow
mysql -h centerbeam.proxy.rlwy.net -P 32877 -u root -pgbrIerodvEYzzDQbgtlQjelgLaLlgPuf railway -e "SHOW TABLES LIKE '%pedidos%';" 