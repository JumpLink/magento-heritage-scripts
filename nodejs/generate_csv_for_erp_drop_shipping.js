#!/usr/bin/env node
var fs = require('fs');
var config = require(__dirname+'/config/general.json');
var heritage = require('heritage')(config.heritage);
var csv = require('csv');
var sets = require('simplesets'); // sets
var email   = require("emailjs"); // send emails
var argv = require('optimist')
  .usage('Usage: $0 -o [string] ')
  .string('o')
  .demand(['o'])
  .alias('o', 'output')
  .describe('o', 'Outputfilename to save the new csv')
  .default('o', 'stockk.csv')
  .argv;

/*
 * magentobug: magento sets all attributes wit a defaultvalue to the defaultvalue: https://plus.google.com/111468575764025343400/posts/BvtYDPyoDw6
 * WORKAROUND for the magentobug: forward the attrbutes e.g. manufacturer
 */
var stock_price_csv_file = '"SKU";"Stock";"Price"\r\n';
var heritage_data;
var heritage_skus_set;
var magento_skus_set = new sets.Set();
var MWST = 1.19; // VAT
var EURO = 1.3;
var result_csv_filename = argv.output;

function save_csv_file(string_to_save, filename) {
  console.log("save_csv_file", filename);
  fs.writeFile(filename, string_to_save, function(err) {
    if(err) {
      console.log(err);
    } else {
      console.log("The file was saved!");
    }
  });
}

function import_heritage_data_in_parts(cb) {
  heritage.auto.catalog.product.list(function(err, data) {
    if(err) return cb(err);
    if(typeof(data) === 'undefined' || data === null) {
      console.log("Error: data not set");
      return cb("Error: data not set");
    }
    console.log("list.length: "+data.CODE.length);
    heritage.auto.catalog.product.infos( data.CODE, function(data) {
      if(data !== null) {
        heritage_data = data;
        heritage_skus_set = new sets.Set(heritage_data.sku);
        cb(null, heritage_data);
      } else {
        heritage_data = data;
        console.warn("data is null!");
        cb("data is null!");
      }
    });
  });
}

function get_number_or_null(value) {
  var tmp_number = parseInt(value,10);
  if ( isNaN(tmp_number) ) {
    return 0;
  }
  return tmp_number;
}

function get_price_or_null(value) {
  var tmp_number = parseFloat(value,10);
  if ( isNaN(tmp_number) ) {
    return 0;
  }
  return tmp_number;
}

function precise_round(num,decimals){
  return Math.round(num*Math.pow(10,decimals))/Math.pow(10,decimals);
}

import_heritage_data_in_parts(function(err, heritage_data) {
  console.log(new_line);
  for (var i = 0; i < heritage_data.sku.length; i++) {
    var sku = heritage_data.sku[i];
    var stock = get_number_or_null(heritage_data.FREESTOCKQUANTITY[i]);
    var vwheritage_price_pound = precise_round( get_price_or_null(heritage_data.COSTPRICE[i]), 2 );
    var price = precise_round( vwheritage_price_pound*EURO, 2);
    // var price = precise_round( get_price_or_null(row.cost_price), 2 );
    var new_line = '"'+sku+'";"'+stock+'";"'+price+'"\r\n';
    console.log(heritage_data);
    console.log(new_line);
    stock_price_csv_file += new_line;
  }
  save_csv_file(stock_price_csv_file, result_csv_filename);
});
