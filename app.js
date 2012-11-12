// sublime: tab_size 2; translate_tabs_to_spaces true

var config = require('json-fs').open(__dirname+"/config/general.json");
var heritage = require('heritage')(config.heritage);
var magento = require('magento')(config.magento);
var translations = require('./translations');

var for_vehicles = [];
var quality = [];

var all_translated_article = [];

function cb_for_vehicles(data, count) {
  console.log('for_vehicles.csv geladen, Anzahl Zeilen: '+count);
  for_vehicles = data;
  console.log(translations.search(data, "Mk1 / Golf Cabriolet", 1, 2));
}

function cb_quality(data, count) {
  console.log('quality.csv geladen, Anzahl Zeilen: '+count);
  quality = data;
}

translations.load(cb_for_vehicles, cb_quality);

magento.manual.init(function(err) {
  magento.auto.catalog.product.info("211-809-252/840", config.magento.store_view[0].code, function (error, result) {  
    console.log(result);
  });
});

// magento.auto.catalog.product.create(type, set, sku, productData, config.magento.store_view[0].code, function (error, result) {  
//   console.log(result);
// });

// magento.manual.init(function(err) {
//   magento.manual.catalog_product.create(type, set, sku, productData, config.magento.store_view[0].code, function(error, result){
//     console.log(error);
//     console.log(result);
//   });
// });

function get_one_from_heritage_and_translate(data, number, cb) {
  heritage.auto.catalog.product.info(data, function(data) {
    if(data.applications) {
      data.applications_de = translations.search(for_vehicles, data.applications, 1, 2);
      // Falls nichts gefunden
      if (!data.applications_de) {
        // Überprüft ob der String am Ende der Form ##-## entspricht
        if(!isNaN(data.applications.charAt(data.applications.length-1)) && !isNaN(data.applications.charAt(data.applications.length-2)) && data.applications.charAt(data.applications.length-3) == '-' && !isNaN(data.applications.charAt(data.applications.length-4)) && !isNaN(data.applications.charAt(data.applications.length-5))) {
          //console.log("\npasst!\n");
          var name_only = data.applications.substring(0,data.applications.length-5);
          var date_only_de = "'"+data.applications.charAt(data.applications.length-5)+data.applications.charAt(data.applications.length-4)+"-'"+data.applications.charAt(data.applications.length-2)+data.applications.charAt(data.applications.length-1);
          var name_only_de = translations.search(for_vehicles, name_only, 1, 2);
          //console.log(name_only_de +" "+date_only_de);
          //console.log(date_only_de);
          if(name_only_de)
            data.applications_de = name_only_de +" "+date_only_de;
          else
            data.applications_de = data.applications;
        } else
          data.applications_de = data.applications;
      }
    }
    if(data.quality) {
      var quality_de = translations.search(quality, data.quality, 1, 2);
      if (quality_de)
        data.quality_de = quality_de;
    }
    all_translated_article.push(data);
    //console.log(data);
    magento.auto.catalog.product.available(data.sku, config.magento.store_view[0].code, function (available, sku) {
      //console.log("sku: "+sku+" "+available);
      data.available_in_magento = available
      all_translated_article.push(data);
      //console.log(number);
      if(number==0) {
        cb(all_translated_article);
      }
    });
  });
}

function get_all_from_and_do(do_it, cb) {
  magento.manual.init(function(err) {
    heritage.auto.catalog.product.list(function(data) {
      for (var i = 10/*data.CODE.length - 1*/; i >= 0; i--) {
        //console.log(data.CODE.length);
        // magento.auto.catalog.product.available(data.CODE[i], config.magento.store_view[0].code, function (available, sku) {
        //   console.log("sku: "+sku+" "+available);
        // });
        //console.log(data.CODE[i]);
        do_it(data.CODE[i], i, cb);
      }
    });
  });
}



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

var type = "simple";
var set = "4";


get_all_from_and_do(get_one_from_heritage_and_translate, function(data) {
  for (var i = data.length - 1; i >= 0; i--) {
    var productData = {
        categories: [3] //root
      , websites: [ "shop"]
      , name: data[i].ITEMNAME
      , description: data[i].ITEMNAME
      , short_description: data[i].ITEMNAME
      , weight: data[i].ITEMNAME
      , status: "0" //deaktiviert
      , url_key: data[i].ITEMNAME.replace(/\s/g, "-")
      , url_path: data[i].ITEMNAME.replace(/\s/g, "-")+".html"
      , visibility:  "4" //Katalog, Suche
      , price: 
      , special_price: 
    }
  };
  console.log(data);
});
