// sublime: tab_size 2; translate_tabs_to_spaces true
var json_fs = require('json-fs');
var fs = require('fs');
var config = json_fs.open(__dirname+"/config/general.json");
var heritage = require('heritage')(config.heritage);
var magento = require('magento')(config.mageplus);
var translations = require('./translations');

var for_vehicles = []; // translations for heritage "for vehicles" attribute
var quality = []; // translations for heritage "quality" attribute

var heritage_data = [];
var heritage_data_part = {};
var magento_data_en = []; // english transformed heritage data for magento 
var magento_data_de = []; // german transformed heritage data for magento 

var magento_created = []; // list of created products with sku (item-id) and magento-db-id
var magento_updated = []; // list of updated products with sku (item-id) and magento-db-id

var MWST = 1.19; // VAT
var EURO = 1.27;

function cb_for_vehicles(data, count) {
  for_vehicles = data;
}

function cb_quality(data, count) {
  quality = data;
}

// Loads the translations from a csv-table
translations.load(cb_for_vehicles, cb_quality);

function get_one_from_heritage_and_translate(data, number, cb) {
  heritage.auto.catalog.product.info(data, function(data) {
    if(data.sku) { // WICHTIG nur wenn sku vorhanden ist, beim debuggen evtl auskommentieren!
      console.log(data.sku);
      if(data.applications && data.applications.length > 0) {
        data.applications_de = [];

        for (var i = data.applications.length - 1; i >= 0; i--) {

          data.applications_de.push(translations.search(for_vehicles, data.applications[i], 1, 2));
          // Falls nichts gefunden
          if (!data.applications_de[data.applications_de.length -1]) {
            // Überprüft ob der String am Ende der Form ##-## entspricht
            if(!isNaN(data.applications[i].charAt(data.applications[i].length-1)) && !isNaN(data.applications[i].charAt(data.applications[i].length-2)) && data.applications[i].charAt(data.applications[i].length-3) == '-' && !isNaN(data.applications[i].charAt(data.applications[i].length-4)) && !isNaN(data.applications[i].charAt(data.applications[i].length-5))) {
              var name_only = data.applications[i].substring(0,data.applications[i].length-5);
              var date_only_de = "&#39;"+data.applications[i].charAt(data.applications[i].length-5)+data.applications[i].charAt(data.applications[i].length-4)+"-&#39;"+data.applications[i].charAt(data.applications[i].length-2)+data.applications[i].charAt(data.applications[i].length-1);
              var name_only_de = translations.search(for_vehicles, name_only, 1, 2);
              if(name_only_de)
                data.applications_de[data.applications_de.length -1] = name_only_de +" "+date_only_de;
              else
                data.applications_de[data.applications_de.length -1] = data.applications[i];
            } else
              data.applications_de[data.applications_de.length -1] = data.applications[i];
          }
        }
      }
      if(data.quality) {
        var quality_de = translations.search(quality, data.quality, 1, 2);
        if (quality_de)
          data.quality_de = quality_de;
      }
      heritage_data.push(data);
      if(number===0) {
        cb(heritage_data);
      }
    }
  });
}

function get_list_from_heritage_and_do_each(do_it, cb) {
  heritage.auto.catalog.product.list(function(data) {
    json_fs.save(__dirname+"/heritage_data_list.json", data, function () {
      for (var i = data.CODE.length - 1; i >= 0; i--) {
        do_it(data.CODE[i], i, cb);
      }
    });
  });
}

/*
 * language can be "de" or "en" (string)
 * set category_ids if you want to move the product to new category_ids (array of strings) 
 */
function transform_heritage_to_magento (language, data, category_ids) {
  var tier_price = [
    {
      customer_group_id: 4, // 4 = Rabattstufe 1
      website: "all",
      qty: 1, // Menge
      price: data.PRICE2 * EURO * MWST // (double)
    },
    {
      customer_group_id: 5, // 5 = Rabattstufe 2
      website: "all",
      qty: 1,
      price: data.PRICE3 * EURO * MWST
    },
    {
      customer_group_id: 6, // 6 = Rabattstufe 3
      website: "all",
      qty: 1,
      price: data.PRICE4 * EURO * MWST
    }
  ];

  var url_key = data.itemname.replace(/\s/g, "-").replace(/,/g, "");

  var data_new = {
    sku: data.sku,
    websites: [ config.mageplus.website],
    name: data.itemname,
    weight: data.weight.toString(),
    //, applications: data.applications
    status: 2, //deaktiviert
    url_key: url_key,
    url_path: url_key+".html",
    visibility:  "4", //Katalog, Suche
    price: data.RETAILPRICE * MWST * EURO,
    recommend_price: data.RETAILPRICE * MWST * EURO,
    recommend_price_netto: data.RETAILPRICE * EURO,
    cost_price: data.COSTPRICE * EURO, // netto
    //, special_price: 
    tax_class_id: 5, // 5 = Umsatzsteuerpfichtige Güter 19%
    tier_price: tier_price,
    delivery_time: "2-3"
  };

  if (category_ids)
    data_new.category_ids = category_ids;

  if(data.metrics) {
    data_new.metrics = "<ul>";
    for (var i = data.metrics.length - 1; i >= 0; i--) {
      data_new.metrics += "<li>"+data.metrics[i]+"</li>";
    }
    data_new.metrics += "</ul>";
  }

  if(data.fittinginfo) {
    data_new.fittinginfo = data.fittinginfo;
  }

  /* Deutsche Übersetzung */
  if (language == "de") {

    if(data.quality_de)
      data_new.quality = data.quality_de;

    /* short description */
    {
      var short_description = "";
      // applications in die short description integrieren
      if(data.applications_de) {

        data_new.applications = "<ul>";
        for (var b = data.applications_de.length - 1; b >= 0; b--) {
          data_new.applications += "<li>"+data.applications_de[b]+"</li>";
        }
        data_new.applications += "</ul>";

        short_description += "<b>Passend f&uuml;r:</b><br>"+data_new.applications;
      }
      // metrics in die short description integrieren
      if(data_new.metrics) {
        short_description += "<b>Ma&szlig;e:</b><br>"+data_new.metrics;
      }

      data_new.short_description = short_description;
    }

    /*long description*/
    {
      var long_description = "";
      if(data.description)
        long_description += data.description;
      if(data.fittinginfo && data.fittinginfo.length > 5) {
        long_description += "<br><b>Einbauhinweis:</b>"+data.fittinginfo;
      }
      data_new.description = long_description;
    }
  /* Englische Formatierung */
  } else if(language == "en") {
    if(data.quality)
      data_new.quality = data.quality;

    /* short description */
    {
      var short_description = "";

      if(data.applications) {

        data_new.applications = "<ul>";
        for (var a = data.applications.length - 1; a >= 0; a--) {
          data_new.applications += "<li>"+data.applications[a]+"</li>";
        }
        data_new.applications += "</ul>";

        // applications in die short description integrieren
        short_description += "<b>For Vehicles:</b><br>"+data_new.applications;
      }
      // metrics in die short description integrieren
      if(data_new.metrics) {
        short_description += "<b>Metrics:</b><br>"+data_new.metrics;
      }

      data_new.short_description = short_description;
    }

    /*long description*/
    {
      var long_description = "";
      if(data.description)
        long_description += data.description;
      if(data.fittinginfo && data.fittinginfo.length > 5) {
        long_description += "<br><b>Fitting Info:</b>"+data.fittinginfo;
      }
      data_new.description = long_description;
    }
  }

  return data_new;
}

function create_one(type, set, data, number, store_view, cb) {
  var sku = data.sku;
  //console.log(data);
  delete data.sku;
  data.category_ids = [config.mageplus.root_id.toString()]; // root workaround delete this if it is not good for you
    magento.auto.catalog.product.create(type, set, sku, data, store_view, function (error, result, sku) {
      if(sku)
        console.log(sku);
      if(error)
        console.log(error);
      if(result)
        console.log(result);
      magento_created.push({id:result,sku:sku,error:error});
      cb(error, result, sku, number);
    });
}

function create_all(data, store_view, cb) {
  console.log("start create_all!");

  var type = "simple";
  var set = 4;

  magento.manual.init(function(err) {
    for (var i = data.length - 1; i >= 0; i--) {
      create_one (type, set, data[i], i, store_view, function(error, result, sku, number){
        //console.log("\n"+number+"\n");
        if(number===0) {
          cb();
        }
      });
    }
  });
}

function update_one(data, number, store_view, cb) {
  var sku = data.sku;
  delete data.sku;
  magento.auto.catalog.product.update(sku, data, store_view, function (error, result, sku) {
    if(sku)
      console.log(sku);
    if(error)
      console.log(error);
    if(result)
      console.log(result);
    magento_updated.push({id:result,sku:sku,error:error});
    cb(error, result, sku, number);
  });
}


function update_all(data, store_view, cb) {
  console.log("start update_all!");
  magento.manual.init(function(err) {
    for (var i = data.length - 1; i >= 0; i--) {
      update_one (data[i], i, store_view, function(error, result, sku, number){
        if(number===0)
          cb();
      });
    }
  });
}

function import_heritage_data(cb) {
  console.log("start import_heritage_data!");
  console.log("get list");
  get_list_from_heritage_and_do_each(get_one_from_heritage_and_translate, function(data, sku) {
    json_fs.save(__dirname+"/heritage_data.json", data, function () {
      cb(data);
    });
  });
}

function get_heritage_data(overwrite, cb) {
  console.log("start get_heritage_data!");
  // Wenn daten nicht geladen
  if(heritage_data.length < 1) {
    // Daten lokal vorhanden?
    fs.exists(__dirname+"/heritage_data.json", function(exists) {
      // Daten SIND lokal vorhanden!
      if (exists && overwrite !== true) {
        // Lade lokale Heritage-Daten!
        console.log("load heritage_data from file!");
        heritage_data = json_fs.open(__dirname+"/heritage_data.json");
        cb(heritage_data);
      } else { // Daten sind NICHT lokal vorhanden!
        // Lade Heritage-Daten extern
        import_heritage_data(cb);
      }
    });
  } else {
    console.log("heritage_data already loaded!");
    // Daten sind bereits geladen
    cb(heritage_data);
  }
}

/*
 * language can be "de" or "en"
 */
function import_magento_data (language, cb) {
  console.log("start import_magento_data!");
  get_heritage_data(false, function(data) {
    if(language == "de") {
      for (var i = data.length - 1; i >= 0; i--) {
        magento_data_de[i] = transform_heritage_to_magento(language, data[i]);
      }
      json_fs.save(__dirname+"/magento_data_de.json", magento_data_de, function () {
        cb(magento_data_de);
      });
    }
    else if(language == "en") {
      for (var j = data.length - 1; j >= 0; j--) {
        magento_data_en[j] = transform_heritage_to_magento(language, data[j]);
      }
      json_fs.save(__dirname+"/magento_data_en.json", magento_data_en, function () {
        cb(magento_data_en);
      });
    }
  });
}

/*
 * language can be "de" or "en"
 */
function get_magento_data(language, overwrite, cb) {
  console.log("start get_magento_data for language: "+language);
  var filename = "magento_data_"+language+".json";
  // Wenn daten nicht geladen
  if((language == "de" && magento_data_de.length < 1) || (language == "en" && magento_data_en.length < 1)) {
    // Daten lokal vorhanden?
    fs.exists(__dirname+"/"+filename, function(exists) {
      // Daten SIND lokal vorhanden!
      if (exists && overwrite !== true) {
        // Lade lokale Daten!
        console.log("load magento_data from file!");
        if(language=="de") { magento_data_de = json_fs.open(__dirname+"/"+filename); cb(magento_data_de); }
        if(language=="en") { magento_data_en = json_fs.open(__dirname+"/"+filename); cb(magento_data_en); }

      } else { // Daten sind NICHT lokal vorhanden!
        // Lade daten extern
        import_magento_data(language, cb);
      }
    });
  } else {
    console.log("magento_data already loaded!");
    // Daten sind bereits geladen
    if(language=="de") cb(magento_data_de);
    if(language=="én") cb(magento_data_en);
  }
}

function create_all_heritage_products_for_magento(language, store_view, cb) {
  console.log("starte create_all_heritage_products_for_magento!");

  get_magento_data(language, false, function(data) {
    //  = german store view
    create_all(data, store_view, function() {
      json_fs.save(__dirname+"/magento_created.json", magento_created, function () {
        cb();
      });
    });
  });
}

function update_all_heritage_products_for_magento(language, store_view, cb) {
  console.log("starte update_all_heritage_products_for_magento!");

  get_magento_data(language, false, function(data) {
    // config.mageplus.store_view[1].code = english store view
    update_all(data, store_view, function() {
      json_fs.save(__dirname+"/magento_updated.json", magento_created, function () {
        cb();
      });
    });
  });
}

var german_store_view = config.mageplus.store_view[0].code;
var english_store_view = config.mageplus.store_view[1].code;

// create_all_heritage_products_for_magento("de", german_store_view, function() {
//   update_all_heritage_products_for_magento("de", german_store_view, function() {
//     update_all_heritage_products_for_magento("en", english_store_view, function() {
//       console.log("fertig");
//     });
//   });
// });


// update_all_heritage_products_for_magento("de", german_store_view, function() {
//   update_all_heritage_products_for_magento("en", english_store_view, function() {
//     console.log("fertig");
//   });
// });

// heritage.auto.catalog.product.info("ac999rs014", function(data) {
//   console.log(data);
// });

// heritage.auto.catalog.product.list(function() { });

// console.log(heritage.manual.catalog.product.info.url("ac999rs014", null));

function import_heritage_data_in_parts(cb) {
  heritage.auto.catalog.product.list(function(data) {
    console.log("list.length: "+data.CODE.length);
    heritage.auto.catalog.product.infos( data.CODE, function(data) {
      //console.log(data);
      heritage_data_part = data;
      console.log("hallo von app.js");
      json_fs.save(__dirname+"/heritage_data_part.json", heritage_data_part, function () {
        //console.log("done");
        cb();
      });
    });
  });
}

function get_heritage_data_in_parts(overwrite, cb) {
  console.log("start get_heritage_data_in_parts!");
  // Wenn daten nicht geladen
  if(heritage_data_part.length < 1) {
    // Daten lokal vorhanden?
    fs.exists(__dirname+"/heritage_data_part.json", function(exists) {
      // Daten SIND lokal vorhanden und sollen nicht überschrieben werden!
      if (exists && overwrite !== true) {
        // Lade lokale Heritage-Daten!
        console.log("load heritage_data_part from file!");
        heritage_data_part = json_fs.open(__dirname+"/heritage_data_part.json");
        cb(heritage_data_part);
      } else { // Daten sind NICHT lokal vorhanden!
        // Lade Heritage-Daten extern
        import_heritage_data_in_parts(cb);
      }
    });
  } else { 
    console.log("heritage_data already loaded!");
    // Daten sind bereits geladen
    cb(heritage_data_part);
  }
}

function update_magento_stock_from_heritage_data(cb) {
  console.log("starte update_magento_stock_from_heritage_data!");
  magento.manual.init(function(err) {
    for (var i = 0; i < heritage_data_part.sku.length; i++) {
      //heritage_data_part.sku[i]
    }
  });
}


magento.manual.init(function(err) {
  console.log(err);
  magento.auto.catalog.product.info("151-801-129/A", "", function (error, result) {
    console.log(error);
    console.log(result);
  });
});

var filter = magento.auto.set_filter.sku("021-198-009/B");
magento.auto.catalog.product.list(filter, config.mageplus.store_view[0].code, function (error, result) {
  console.log(result);
});