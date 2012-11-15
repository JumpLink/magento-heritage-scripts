// sublime: tab_size 2; translate_tabs_to_spaces true

magento.auto.catalog.product.info("211-809-252/840", config.magento.store_view[0].code, function (error, result) {  
  console.log(result);
});


magento.auto.catalog.category.delete(2, function (error, result) {  
  console.log(result);
});

magento.auto.catalog.product.create(type, set, sku, productData, config.magento.store_view[0].code, function (error, result) {  
  console.log(result);
});


magento.manual.catalog_product.create(type, set, sku, productData, config.magento.store_view[0].code, function(error, result){
  console.log(error);
  console.log(result);
});


// Überprüft ob das Produkt bereits unter Magento existiert
magento.auto.catalog.product.available(data.sku, config.magento.store_view[0].code, function (available, sku) {
  //console.log("sku: "+sku+" "+available);
  data.available_in_magento = available
  heritage_data.push(data);
  //console.log(number);
  if(number==0) {
    cb(heritage_data);
  }
});

heritage.auto.catalog.product.info("126905205NB", function(data) {
  console.log(data);
});

magento.auto.catalog.product.available("021-198-009/B", config.magento.store_view[0].code, function (available) {
  console.log(available);
});

heritage.auto.catalog.product.list(function(data) {
  console.log(data.CODE);
});

magento.auto.catalog.product.delete(4, function (error, result) {  
  console.log(error);
  console.log(result);
});

magento.auto.catalog.product.delete(5, function (error, result) { 
  console.log(error);
  console.log(result);
});