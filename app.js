// sublime: tab_size 2; translate_tabs_to_spaces true
var json_fs = require('json-fs');
var config = json_fs.open(__dirname+"/config/general.json");
var heritage = require('heritage')(config.heritage);
var magento = require('magento')(config.mageplus);
var translations = require('./translations');

var for_vehicles = [];
var quality = [];

var heritage_data = [];
var magento_data = [];

var magento_created = [];

function round_price(x, n) {
  if (n < 1 || n > 14) return false;
  var e = Math.pow(10, n);
  var k = (Math.round(x * e) / e).toString();
  if (k.indexOf('.') == -1) k += '.';
  k += e.toString().substring(1);
  return k.substring(0, k.indexOf('.') + n+1);
}

function cb_for_vehicles(data, count) {
  console.log('for_vehicles.csv geladen, Anzahl Zeilen: '+count);
  for_vehicles = data;
  //console.log(translations.search(data, "Mk1 / Golf Cabriolet", 1, 2));
}

function cb_quality(data, count) {
  console.log('quality.csv geladen, Anzahl Zeilen: '+count);
  quality = data;
}

translations.load(cb_for_vehicles, cb_quality);

// magento.manual.init(function(err) {
//   magento.auto.catalog.product.info("211-809-252/840", config.magento.store_view[0].code, function (error, result) {  
//     console.log(result);
//   });
// });

// magento.auto.catalog.category.delete(2, function (error, result) {  
//   console.log(result);
// });

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
    if(data.applications && data.applications.length > 0) {
      data.applications_de = [];

      for (var i = data.applications.length - 1; i >= 0; i--) {
        
        data.applications_de.push(translations.search(for_vehicles, data.applications[i], 1, 2))
        // Falls nichts gefunden
        if (!data.applications_de[data.applications_de.length -1]) {
          // Überprüft ob der String am Ende der Form ##-## entspricht
          if(!isNaN(data.applications[i].charAt(data.applications[i].length-1)) && !isNaN(data.applications[i].charAt(data.applications[i].length-2)) && data.applications[i].charAt(data.applications[i].length-3) == '-' && !isNaN(data.applications[i].charAt(data.applications[i].length-4)) && !isNaN(data.applications[i].charAt(data.applications[i].length-5))) {
            //console.log("\npasst!\n");
            var name_only = data.applications[i].substring(0,data.applications[i].length-5);
            var date_only_de = "&#39;"+data.applications[i].charAt(data.applications[i].length-5)+data.applications[i].charAt(data.applications[i].length-4)+"-&#39;"+data.applications[i].charAt(data.applications[i].length-2)+data.applications[i].charAt(data.applications[i].length-1);
            var name_only_de = translations.search(for_vehicles, name_only, 1, 2);
            //console.log(name_only_de +" "+date_only_de);
            //console.log(date_only_de);
            if(name_only_de)
              data.applications_de[data.applications_de.length -1] = name_only_de +" "+date_only_de;
            else
              data.applications_de[data.applications_de.length -1] = data.applications[i];
          } else
            data.applications_de[data.applications_de.length -1] = data.applications[i];
        }
      };
    }
    if(data.quality) {
      var quality_de = translations.search(quality, data.quality, 1, 2);
      if (quality_de)
        data.quality_de = quality_de;
    }
    heritage_data.push(data);
    //console.log(data);
    // magento.auto.catalog.product.available(data.sku, config.magento.store_view[0].code, function (available, sku) {
    //   //console.log("sku: "+sku+" "+available);
    //   data.available_in_magento = available
    //   heritage_data.push(data);
    //   //console.log(number);
    //   if(number==0) {
    //     cb(heritage_data);
    //   }
    // });
    if(number==0) {
      cb(heritage_data);
    }
  });
}

function get_all_from_and_do(do_it, cb) {
  magento.manual.init(function(err) {
    heritage.auto.catalog.product.list(function(data) {
      for (var i = data.CODE.length - 1; i >= 0; i--) {
        //console.log(data.CODE.length)
        // magento.auto.catalog.product.available(data.CODE[i], config.magento.store_view[0].code, function (available, sku) {
        //   console.log("sku: "+sku+" "+available);
        // });
        //console.log(data.CODE[i]);
        do_it(data.CODE[i], i, cb);
      }
    });
  });
}



// heritage.auto.catalog.product.info("126905205NB", function(data) {
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

function transform_heritage_to_magento (data) {

  var tier_price = [
    {
        customer_group_id: 4 // 4 = Rabattstufe 1
      , website: "all"//config.mageplus.website
      , qty: 1 // Menge
      , price: data.PRICE2 * 1.27 * 1.19 // (double)
    },
    {
        customer_group_id: 5 // 5 = Rabattstufe 2
      , website: "all"
      , qty: 1 // Menge
      , price: data.PRICE3 * 1.27 * 1.19 // (double)
    },
    {
        customer_group_id: 6 // 6 = Rabattstufe 3
      , website: "all"
      , qty: 1 // Menge
      , price: data.PRICE4 * 1.27 * 1.19 // (double)
    }
  ];

  var url_key = data.itemname.replace(/\s/g, "-").replace(/,/g, "");

  var data_new = {
      category_ids: [config.mageplus.root_id.toString()]
    , sku: data.sku
    , websites: [ config.mageplus.website]
    , name: data.itemname
    , weight: data.weight.toString()
    //, applications: data.applications
    , status: 2 //deaktiviert
    , url_key: url_key
    , url_path: url_key+".html"
    , visibility:  "4" //Katalog, Suche
    , price: round_price(data.RETAILPRICE * 1.19 * 1.27, 2)
    , recommend_price: round_price(data.RETAILPRICE * 1.19 * 1.27, 2)
    , cost_price: round_price(data.COSTPRICE * 1.19 * 1.27, 2)
    //, special_price: 
    , tax_class_id: 5 // 5 = Umsatzsteuerpfichtige Güter 19%
    , tier_price: tier_price
    , delivery_time: "2-3"
  };

  if(data.quality_de)
    data_new.quality = data.quality_de;
  
  /*short description*/ 
  {
    var short_description = "";
    if(data.applications_de) {
      short_description += "<b>Passend f&uuml;r:</b><br><ul>";
      for (var i = data.applications_de.length - 1; i >= 0; i--) {
        short_description += "<li>"+data.applications_de[i]+"</li>";
      };
      short_description += "</ul>";
    }

    data_new.short_description = short_description;
  }

  /*long description*/ 
  {
    var long_description = "";
    if(data.description)
      long_description += data.description;
    if(data.fittinginfo && data.fittinginfo.length > 5)
      long_description += "<br><b>Einbauhinweis:</b>"+data.fittinginfo;
    data_new.description = long_description;
  }

  return data_new;
}


function create_one(type, set, data, number, cb) {
  var sku = data.sku;
  //console.log(data);
  delete data.sku;
  magento.auto.catalog.product.create(type, set, sku, data, config.mageplus.store_view[0].code, function (error, result, sku) {  
    console.log(sku);
    console.log(error);
    console.log(result);
    magento_created.push({id:result,sku:sku,error:error});
    cb(error, result, sku, number);
  });
}

function create_all(data, cb) {

  var type = "simple";
  var set = 4;

  for (var i = data.length - 1; i >= 0; i--) {
    create_one (type, set, data[i], i, function(error, result, sku, number){
      console.log(number);
      if(number==0)
        cb();
    });
  };
}

function start() {
  get_all_from_and_do(get_one_from_heritage_and_translate, function(data, sku) {
    for (var i = data.length - 1; i >= 0; i--) {
      magento_data[i] = transform_heritage_to_magento(data[i]);
    };

    create_all(magento_data, function() {
      console.log("fertig!");
      json_fs.save("./magento_created.json", magento_created, function () {

      });
    });

    // //console.log(heritage_data);
    // json_fs.save("./heritage_data.json", heritage_data, function () {

    // });
  });
}

start();



// magento.auto.catalog.product.delete(4, function (error, result) {  
//   console.log(error);
//   console.log(result);
// });

// magento.auto.catalog.product.delete(5, function (error, result) { 
//   console.log(error);
//   console.log(result);
// });