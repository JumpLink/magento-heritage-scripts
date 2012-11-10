// sublime: tab_size 2; translate_tabs_to_spaces true

var config = require('json-fs').open(__dirname+"/config/general.json");
var heritage = require('heritage')(config.heritage);
var magento = require('magento')(config.magento);
var fs = require('fs');

// magento.manual.init(function(err) {
//   magento.auto.catalog.product.info("021-198-009/B", config.magento.store_view[0].code, function (error, result) {  
//     console.log(result);
//   });
// });


heritage.auto.catalog.product.list(function(data) {
  magento.manual.init(function(err) {
    for (var i = data.CODE.length - 1; i >= 0; i--) {
      magento.auto.catalog.product.available(data.CODE[i], config.magento.store_view[0].code, function (available, sku) {
        console.log("sku: "+sku+" "+available);
      });
    };
  });
});

// heritage.auto.catalog.product.info("252-711-629", function(data) {
//   console.log(data);
// });

// true
// magento.auto.catalog.product.available("021-198-009/B", config.magento.store_view[0].code, function (available) {
//   console.log(available);
// });

// heritage.auto.catalog.product.list(function(data) {
//   console.log(data.CODE);
// });

// var products = {};
