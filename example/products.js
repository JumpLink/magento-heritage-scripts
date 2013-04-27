// sublime: tab_size 2; translate_tabs_to_spaces true

var config = require('json-fs').open(__dirname+"/config/config.json");

var heritage = require('../lib/heritage.js')(config);

heritage.get_product("021-198-009/B", function(data) {
  console.log(data);
});