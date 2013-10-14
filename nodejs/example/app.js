// sublime: tab_size 2; translate_tabs_to_spaces true

var config = require(__dirname+"/../config/general.json");
var heritage = require('heritage')(config.heritage);
var magento = require('magento')(config.magento);

// magento.auto.catalog.product.info("025-100-022/JV", config.magento.store_view[0].code, function (error, result) {
//   console.log(result);
// });

heritage.auto.catalog.product.info("AC4065", function(data) {
  console.log(data);
});

// heritage.auto.catalog.product.list(function(data) {
//   console.log(data.CODE);
// });