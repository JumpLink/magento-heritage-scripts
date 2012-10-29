// sublime: tab_size 2; translate_tabs_to_spaces true

var config = require('json-fs').open(__dirname+"/config/general.json");
var heritage = require('heritage')(config.heritage);
var magento = require('magento')(config.magento);
var fs = require('fs');

// magento.auto.catalog.product.info("021-198-009/B", config.magento.store_view[0].code, function (error, result) {
//   console.log(result);
// });

heritage.auto.catalog.product.info("252-711-629", function(data) {
  console.log(data);
});

// magento.auto.catalog.product.available("021-198-009/B", config.magento.store_view[0].code, function (available) {
//   console.log(available);
// });

// heritage.auto.catalog.product.list(function(data) {
//   console.log(data.CODE);
// });

// var products = {};

// var csv = require('csv');
// csv()
// .from.stream(fs.createReadStream(__dirname+'/parts-DE-1.csv'))
// .transform( function(data){
//   data.unshift(data.pop());
//   return data;
// })
// .on('record', function(data,index){
//   //console.log('#'+index+' '+JSON.stringify(data));
//   products[data[2]]=data;
//   console.log(data);
// })
// .on('end', function(count){
//   //console.log('Number of lines: '+count);
//   //console.log(products);
// })
// .on('error', function(error){
//   console.log(error.message);
// });