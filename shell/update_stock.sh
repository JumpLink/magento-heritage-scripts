#!/bin/sh
time=$(date +%Y%m%d_%H%M%S)

echo "exportiere aktuellen lagerbestand"
php /var/www/bugwelder-shop-mageplus/scripts/export_importexport.php original_product_stock_$(time).csv

echo "generiere neue csv"
node /var/www/bugwelder-sync/magento-heritage-scripts/nodejs/update_stock_csv.js -s /var/www/bugwelder-shop-mageplus/var/export/original_product_stock_$(time).csv -f /var/www/bugwelder-shop-mageplus/var/import/generated_product_stock_$(time).csv

echo "importiere neuen lagerbestand"
php var/www/bugwelder-shop-mageplus/scripts/import_importexport.php generated_product_stock_$(time).csv

echo "fertig"