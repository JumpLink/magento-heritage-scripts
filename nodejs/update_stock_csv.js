#!/usr/bin/env node
var fs = require('fs');
var config = require(__dirname+'/config/general.json');
var heritage = require('heritage')(config.heritage);
var csv = require('csv');
var sets = require('simplesets'); // sets
var email   = require("emailjs"); // send emails
var argv = require('optimist')
    .usage('Usage: $0 -s [string] -o [string] ')
    .string('o', 's')
    .boolean('equality')
    .boolean('nopricemail')
    .default('nopricemail', false)
    .demand(['o','s'])
    .alias('o', 'output')
    .alias('s', 'source')
    .describe('o', 'Outputfilename to save the new csv')
    .describe('s', 'Sourcefilename of the exported magento-csv to read the current inventories')
    .describe('equality', 'Check if the SKUs match')
    .describe('nopricemail', 'Do not send an mail on price-changes')
    .argv;

/*
 * magentobug: magento sets all attributes wit a defaultvalue to the defaultvalue: https://plus.google.com/111468575764025343400/posts/BvtYDPyoDw6
 * WORKAROUND for the magentobug: forward the attrbutes e.g. manufacturer
 */
var stock_csv_file = '"sku","_type","_attribute_set","_store","stock_vwheritage_availabilitymessagecode","stock_vwheritage_dueweeks","stock_vwheritage_qty","stock_strichweg_qty","qty","is_in_stock","vwheritage_price_pound","manufacturer"\r\n';
var price_changes_csv_file = '"sku","old_price","new_price","new_price_in_pount"\r\n';
var heritage_data;
var heritage_skus_set;
var magento_skus_set = new sets.Set();
var MWST = 1.19; // VAT
var EURO = 1.27;
//var magento_csv_filename = __dirname+'/csv_tables/25-04-13.csv';
var magento_csv_filename  = argv.source;
//var result_csv_filename = __dirname+'/csv_tables/please_update_product_stock.csv';
var result_csv_filename = argv.output;

function save_csv_file(string_to_save, filename) {
	fs.writeFile(filename, string_to_save, function(err) {
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
			heritage_skus_set = new sets.Set(heritage_data["sku"]);
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

function get_price_or_null(value) {
	var tmp_number = parseFloat(value,10);
	if ( isNaN(tmp_number) ) {
		return 0;
	}
	return tmp_number;
}

function array_to_csv(name, array) {
	var result = '"'+name+'"'+"\r\n";
	for (var i = 0; i < array.length; i++) {
		result += '"'+array[i]+'"\r\n';
	}
	return result;
}

function send_mail_with_sku_equality() {
	var heritage_skus_only_set = heritage_skus_set.difference(magento_skus_set);
	var magento_skus_only_set = magento_skus_set.difference(heritage_skus_set);
	var heritage_only_csv = array_to_csv("sku", heritage_skus_only_set.array() );
	var magento_only_csv = array_to_csv("sku", magento_skus_only_set.array() );
	var message = {
		text:    "Hallo Christopher, ich sende dir hiermit zwei csv-Tabellen, die eine mit den SKUs die nur bei Heritage und die andere die nur bei Bugwelder enthalten sind. Bitte überprüfe diese Manuel!\n\nDein Bot!\n\nP.S. Gib Pascal doch mal ein Bier aus.",
		from:    "Bugwelder System <system@bugwelder.com>",
		to:      "Christopher Heinecke <christopher@bugwelder.com>",
		subject: "Bitte überprüfe die Produkt-SKUs!",
		attachment:
		[
			{data:heritage_only_csv, alternative:false, name:"heritage_only.csv"},
			{data:magento_only_csv, alternative:false, name:"magento_only.csv"}
		]
	};
	var server  = email.server.connect(config.gmail);
	server.send(message, function(err, message) { console.log(err || message); });
}

function send_mail_with_price_equality() {
	var message = {
		text:    "Hallo Christopher, Es unterscheiden sich Preise. Bitte überprüfe diese Manuel (siehe Anhang)!\n\nDein Bot!\n\nP.S. Gib Pascal doch mal ein Snickers aus.",
		from:    "Bugwelder System <system@bugwelder.com>",
		to:      "Christopher Heinecke <christopher@bugwelder.com>",
		subject: "Achtung überprüfe die Produktpreise!",
		attachment:
		[
			{data:price_changes_csv_file, alternative:false, name:"price_changes.csv"}
		]
	};
	var server  = email.server.connect(config.gmail);
	server.send(message, function(err, message) { console.log(err || message); });
}

function precise_round(num,decimals){
	return Math.round(num*Math.pow(10,decimals))/Math.pow(10,decimals);
}

import_heritage_data_in_parts(function() {
	csv()
	.from.path(magento_csv_filename, {columns: true})
	.on('record', function(row,index){
		magento_skus_set.add(row.sku);
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
			var vwheritage_price_pound = precise_round( get_price_or_null(heritage_data["COSTPRICE"][i]), 2 );
			var manufacturer = row.manufacturer;
			var new_line = '"'+sku+'","'+_type+'","'+_attribute_set+'","'+_store+'","'+stock_vwheritage_availabilitymessagecode+'","'+stock_vwheritage_dueweeks+'","'+stock_vwheritage_qty+'","'+stock_strichweg_qty+'","'+qty+'","'+is_in_stock+'","'+vwheritage_price_pound+'","'+manufacturer+'"\r\n';
			stock_csv_file += new_line;

			var new_cost_price = precise_round( vwheritage_price_pound*EURO, 2);
			var current_cost_price = precise_round( get_price_or_null(row.cost_price), 2 );
			if(new_cost_price != current_cost_price) {
				new_line = '"'+sku+'","'+current_cost_price+'","'+new_cost_price+'","'+vwheritage_price_pound+'"';
				//console.log(new_line);
				//add_line_to_csv_file (price_changes_csv_file, new_line);
				price_changes_csv_file += new_line+"\r\n";
			}
		}
	})
	.on('end', function(count){
		console.log('Number of lines: '+count);
		console.log('Length of price_changes_csv_file: '+price_changes_csv_file.length);
		if (price_changes_csv_file.length > 50 && !argv.nopricemail) {
			send_mail_with_price_equality();
		}
		save_csv_file(stock_csv_file, result_csv_filename);
		if (argv.equality)
			send_mail_with_sku_equality();
	})
	.on('error', function(error){
		console.log(error.message);
	});
});