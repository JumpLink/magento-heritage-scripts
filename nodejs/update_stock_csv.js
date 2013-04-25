#!/usr/bin/env node
var fs = require('fs');
var config = require(__dirname+'/config/general.json');
var heritage = require('heritage')(config.heritage);
var csv = require('csv');
var argv = require('optimist')
    .usage('Usage: $0 -f [string] -s [string]')
    .string('f', 's')
    .demand(['f','s'])
    .alias('f', 'filename')
    .alias('s', 'source')
    .describe('f', 'Filename to save the new csv')
    .describe('s', 'Source of the exported magento-csv to read the current inventories')
    .argv;

var csv_file = "";
var heritage_data;

var COUNT_OF_ENTRIES = 500;
//var magento_csv_filename = __dirname+'/csv_tables/25-04-13.csv';
var magento_csv_filename  = argv.source;
//var result_csv_filename = __dirname+'/csv_tables/please_update_product_stock.csv';
var result_csv_filename = argv.filename;

function add_break_to_csv_file() {
	csv_file += "\r\n";
}
function add_line_to_csv_file(string) {
	csv_file += string;
	add_break_to_csv_file();
}
function create_new_csv_file() {
	csv_file = "";
	add_line_to_csv_file('"sku","_type","_attribute_set","_store","stock_vwheritage_availabilitymessagecode","stock_vwheritage_dueweeks","stock_vwheritage_qty","stock_strichweg_qty","qty","is_in_stock"');
}
function save_csv_file(filename) {
	fs.writeFile(filename, csv_file, function(err) {
		if(err) {
			console.log(err);
		} else {
			console.log("The file was saved!");
		}
	});
}

function import_heritage_data_in_parts(cb) {
	heritage.auto.catalog.product.list(function(data) {
		console.log("list.length: "+data.CODE.length);
		heritage.auto.catalog.product.infos( data.CODE, function(data) {
			heritage_data = data;
			cb();
		});
	});
}

function get_index_from_heritage_attribute(name, value) {
	//console.log(heritage_data[name]);
	for (var i = 0; i < heritage_data[name].length; i++) {
		if(heritage_data[name][i] == value) {
			return i;
		}
	}
	return -1;
}

function get_number_or_null(value) {
	var tmp_number = parseInt(value,10);
	if ( isNaN(tmp_number) ) {
		return 0;
	}
	return tmp_number;
}

import_heritage_data_in_parts(function() {
	create_new_csv_file();

	csv()
	.from.path(magento_csv_filename, {columns: true})
	.on('record', function(row,index){
		var i = get_index_from_heritage_attribute("sku", row.sku);

		if(i >= 0) {
			var sku = row.sku;
			var _type = "";
			var _attribute_set = "";
			var _store = "";
			var stock_vwheritage_availabilitymessagecode = get_number_or_null(heritage_data["AVAILABILITYMESSAGECODE"][i]);
			var stock_vwheritage_dueweeks = get_number_or_null(heritage_data["DUEWEEKS"][i]);
			var stock_vwheritage_qty = get_number_or_null(heritage_data["FREESTOCKQUANTITY"][i]);
			var stock_strichweg_qty = get_number_or_null(row.stock_strichweg_qty);
			var qty = stock_vwheritage_qty + stock_strichweg_qty;
			var is_in_stock = qty > 0 ? 1 : 0;

			var new_line = '"'+sku+'","'+_type+'","'+_attribute_set+'","'+_store+'","'+stock_vwheritage_availabilitymessagecode+'","'+stock_vwheritage_dueweeks+'","'+stock_vwheritage_qty+'","'+stock_strichweg_qty+'","'+qty+'","'+is_in_stock+'"';
			//console.log(new_line);
			add_line_to_csv_file( new_line );
			console.log("write product with sku "+row.sku+" to csv" );
		}

	})
	.on('end', function(count){
		console.log('Number of lines: '+count);
		save_csv_file(result_csv_filename);
	})
	.on('error', function(error){
		console.log(error.message);
	});
});