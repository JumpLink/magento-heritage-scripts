function cb_for_vehicles(data, count) {
  console.log('for_vehicles.csv geladen, Anzahl Zeilen: '+count);
  console.log(data);
}

function cb_quality(data, count) {
  console.log('quality.csv geladen, Anzahl Zeilen: '+count);
  console.log(data);
}

module.exports.search = function search(translation, search_string, column_search, column_result) {
  search_string = search_string.replace(/\s/g, "").toLowerCase();

  for (i=0; i<translation.length; i++) {

    current = translation[i][column_search].replace(/\s/g, "").toLowerCase();
    if(current == search_string) {
      //console.log("gefunden!");
      return translation[i][column_result];
    }
  }

}

module.exports.load = function load(cb_for_vehicles, cb_quality) {
  var fs = require('fs');
  var csv = require('csv');

  var for_vehicles = [];
  var quality = [];

  csv()
  .from.stream(fs.createReadStream(__dirname+'/translations/for_vehicles.csv'))
  //.to.path(__dirname+'/translations/for_vehicles.out')
  .transform( function(data){
    data.unshift(data.pop());
    return data;
  })
  .on('record', function(data,index){
    for_vehicles.push(data);
  })
  .on('end', function(count){
    cb_for_vehicles(for_vehicles, count);
  })
  .on('error', function(error){
    console.log(error.message);
  });

  csv()
  .from.stream(fs.createReadStream(__dirname+'/translations/quality.csv'))
  .transform( function(data){
    data.unshift(data.pop());
    return data;
  })
  .on('record', function(data,index){
    quality.push(data);
  })
  .on('end', function(count){
    cb_quality(quality, count);
  })
  .on('error', function(error){
    console.log(error.message);
  });
}

//load_translations(cb_for_vehicles, cb_quality);