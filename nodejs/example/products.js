// sublime: tab_size 2; translate_tabs_to_spaces true

var config = require(__dirname+"/../config/general.json");
var heritage = require('heritage')(config.heritage);

heritage.get_product("021-198-009/B", function(data) {
  console.log(data);
});