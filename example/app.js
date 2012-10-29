// sublime: tab_size 2; translate_tabs_to_spaces true

var config = require('json-fs').open(__dirname+"/config/general.json");
var heritage = require('heritage')(config.heritage);
var magento = require('magento')(config.magento);

magento.auto.catalog.product.info("021-198-009/B", config.magento.store_view[0].code, function (error, result) {
  console.log(result);
});

heritage.auto.catalog.product.info("021-198-009/B", function(data) {
  console.log(data);
});

heritage.auto.catalog.product.list(function(data) {
  console.log(data.CODE);
});