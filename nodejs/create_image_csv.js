var fs = require('fs');
var config = require(__dirname+'/config/general.json');
var heritage = require('heritage')(config.heritage);

var import_path = "/home/jumplink/Bilder/bugwelder/products/import/";

var foldername = "heritage_700_700_default";
//var foldername = "heritage_700_700_mittelgross_small";
//var foldername = "heritage_700_700_schrauben_small";

var path = import_path+foldername;
var images = [];

var csv = "";

var COUNT_OF_ENTRIES = 500;

function add_break_to_csv() {
	csv += "\r\n";
}
function add_line_to_csv(string) {
	csv += string;
	add_break_to_csv();
}
function create_new_csv() {
	csv = "";
	add_line_to_csv('"sku","_type","_attribute_set","_store","_media_image","_media_attribute_id","_media_is_disabled","_media_position","_media_lable","image","small_image","thumbnail"');
}
function save_csv(filename) {
	fs.writeFile(filename, csv, function(err) {
		if(err) {
			console.log(err);
		} else {
			console.log("The file was saved!");
		}
	});
}

heritage.auto.catalog.product.list(function(data) {
	heritage_list = data;
	fs.readdir(path, function(err, files) {
		create_new_csv();
		var count = 0;
		var parts = 1;
		for (var h = 0; h < files.length; h++) {
			count++;
			var image_attribiutes = files[h].split('_');
			if (image_attribiutes.length !== 3) {
				//console.log('wrong filename: '+files[h]);
			}
			// find sku for ITEMID 
			for (var a = data.ITEMID.length - 1; a >= 0; a--) {
				if(image_attribiutes[0] == data.ITEMID[a]) {
					//console.log(files[h]+' - '+data.ITEMID[a]+' - '+data.CODE[a] );
					var sku = data.CODE[a];
					var image_path = '/'+foldername+'/'+files[h];
					if(image_attribiutes[1] == '01') { // Wie ist die Bildnummer
						if (count >= COUNT_OF_ENTRIES) {
							console.log("Erzeuge Teildatei "+parts);
							save_csv(import_path+foldername+"_"+parts+".csv");
							create_new_csv();
							parts++;
							count = 0;
						}
						add_line_to_csv('"'+sku+'",,,,"'+image_path+'",88,0,'+image_attribiutes[1]+',,"'+image_path+'","'+image_path+'","'+image_path+'"' );
					} else {
						if(image_attribiutes[0] === prev_image_attribiutes[0]) {
							add_line_to_csv(',,,,"'+image_path+'",88,0,'+image_attribiutes[1]+',,,,');
						}
					}
				}
			}
			var prev_image_attribiutes = image_attribiutes;
		}
		save_csv(import_path+foldername+"_"+parts+".csv");
	});
});

