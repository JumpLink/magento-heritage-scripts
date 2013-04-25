// sublime: tab_size 2; translate_tabs_to_spaces true

var url = require('./url.js');
var fetchUrl = require("fetch").fetchUrl; //https://github.com/andris9/fetch

module.exports = function(config) {

  var heritage =
  {
    manual: {
      get_json: function (uri, cb) {
        fetchUrl(uri, function(error, meta, body){
            if(typeof body != 'undefined') {
              var data = JSON.parse(body.toString());
              cb(data);
            } else {
              cb(null);
            }
        });
      },
      catalog: {
        product: {
          info: {
            url: function (sku, cb) {
              value = decodeURIComponent(sku);
              var url_string = config.host + config.path;
              url_string = url.setParameterUrl(url_string, config.sku_var_name, value);
              url_string = url.setParameterUrl(url_string, config.login, config.pass);
              url_string = encodeURIComponent(url_string);
              if(cb !== null)
                cb(url_string);
              else
                return url_string;
            },
            /*
             * Zerteilt die description in einzele Attribute
             */
            split_description_data: function (data) {
              var description = {};
              description.values = data.DESCRIPTION.toString().split('$');
              //description.names = new Array(description.values.length);

              switch (description.values.length) {
                // do not make a break in this switch case statement!
                case 5:
                  var metrics = description.values[4].replace(/\'/g, "&#39;");
                  if(metrics.length > 1) {
                    data.metrics = metrics.split("\r\n");
                    // ersten Eintrag loeschen, dieser hat keinen Inhalt.
                    data.metrics.splice(0, 1);
                  }
                case 4:
                  data.fittinginfo = description.values[3].replace(/\r\n/g, "<br>");
                case 3:
                  data.quality = description.values[2].replace(/\r\n/g, "");
                case 2:
                  data.description = description.values[1].replace(/\r\n/g, "<br>");
                case 1:
                  data.applications = description.values[0].split("\r\n");//.replace(/\r/g, "").replace(/\n/g, "");
                  // letzten Eintrag loeschen, dieser hat keinen Inhalt.
                  data.applications.splice(data.applications.length-1, data.applications.length-1);
                  delete data.DESCRIPTION;
              }
              return data;
            },
            /*
             * Transformiert das Request-Ergebniss in ein besser behandelbares Format 
             */
            transform_result_data: function (data) {
              data = heritage.manual.catalog.product.info.split_description_data (data.DATA);
              data.sku = data.ITEMNUMBER[0];
              // if(data.sku.charAt(data.sku.length-1)=="/")
              //   data.sku = data.sku.substring(0,data.sku.length-1);
              data.itemname = data.ITEMNAME[0];
              data.weight = data.WEIGHT[0];
              data.FREESTOCKQUANTITY = data.FREESTOCKQUANTITY[0];
              data.SPECIALORDER = data.SPECIALORDER[0];
              data.COSTPRICE = data.COSTPRICE[0];
              data.RETAILPRICE = data.RETAILPRICE[0];
              data.PRICE2 = data.PRICE2[0];
              data.PRICE3 = data.PRICE3[0];
              data.PRICE4 = data.PRICE4[0];
              data.DUEWEEKS = data.DUEWEEKS[0];
              data.AVAILABILITYMESSAGECODE = data.AVAILABILITYMESSAGECODE[0];
              delete data.WEIGHT;
              delete data.ITEMNAME;
              delete data.ITEMNUMBER;
              return data;
            }
          },
          infos: {
            url: function (skus, cb) {
              value = decodeURIComponent(url.transform_array_to_comma_seperated_string(skus));
              var url_string = config.host + config.path;
              url_string = url.setParameterUrl(url_string, config.sku_var_name, value);
              url_string = url.setParameterUrl(url_string, config.login, config.pass);
              url_string = encodeURIComponent(url_string);
              if(cb !== null)
                cb(url_string);
              else
                return url_string;
            },
            transform_1d_array_to_2d_array_of_max: function(one_d_array) {
              var MAX = 200;
              var tow_d_array = [];
              tow_d_array.length = Math.round( (one_d_array.length / MAX) + 0.5 ); // Round up
              var last_array_length = one_d_array.length - ( Math.round( (one_d_array.length / MAX) - 0.5 ) /*Round down*/ * MAX );

              //console.log(tow_d_array.length);
              //console.log(last_array_length);

              for (var i = 0; i < tow_d_array.length; i++) {
                var tmp_array = [];
                for (var a = 0; a < MAX && one_d_array.length > i*MAX+a; a++) {
                  tmp_array.push(one_d_array[i*MAX+a]);
                  //console.log(i*MAX+a);
                }
                tow_d_array[i] = tmp_array;
              }
              //console.log(tow_d_array);
              if (tow_d_array[tow_d_array.length-1].length === last_array_length)
                console.log("OK");
              else
                console.log("ERROR");
              return tow_d_array;
            },
            /*
             * Zerteilt die description in einzele Attribute
             */
            split_description_data: function (data) {
              data.metrics = [];
              data.metrics.length = data.DESCRIPTION.length;
              data.fittinginfo = [];
              data.fittinginfo.length = data.DESCRIPTION.length;
              data.quality = [];
              data.quality.length = data.DESCRIPTION.length;
              data.description = [];
              data.description.length = data.DESCRIPTION.length;
              data.applications = [];
              data.applications.length = data.DESCRIPTION.length;

              for (var i = 0; i < data.DESCRIPTION.length; i++) {
                var description = {};
                description.values = data.DESCRIPTION[i].toString().split('$');
                //description.names = new Array(description.values.length);
                switch (description.values.length) {
                  // do not make a break in this switch case statement!
                  case 5:
                    var metrics = description.values[4].replace(/\'/g, "&#39;");
                    if(metrics.length > 1) {
                      data.metrics[i] = metrics.split("\r\n");
                      // ersten Eintrag loeschen, dieser hat keinen Inhalt.
                      data.metrics[i].splice(0, 1);
                    }
                  case 4:
                    data.fittinginfo[i] = description.values[3].replace(/\r\n/g, "<br>");
                  case 3:
                    data.quality[i] = description.values[2].replace(/\r\n/g, "");
                  case 2:
                    data.description[i] = description.values[1].replace(/\r\n/g, "<br>");
                  case 1:
                    data.applications[i] = description.values[0].split("\r\n");//.replace(/\r/g, "").replace(/\n/g, "");
                    // letzten Eintrag loeschen, dieser hat keinen Inhalt.
                    data.applications[i].splice(data.applications[i].length-1, data.applications[i].length-1);
                }
              }
              delete data.DESCRIPTION;
              return data;
            },
            /*
             * Transformiert das Request-Ergebniss in ein besser behandelbares Format 
             */
            transform_result_data: function (data) {
              data = heritage.manual.catalog.product.infos.split_description_data (data.DATA);
              data.sku = data.ITEMNUMBER;
              data.itemname = data.ITEMNAME;
              data.weight = data.WEIGHT;
              data.FREESTOCKQUANTITY = data.FREESTOCKQUANTITY;
              data.SPECIALORDER = data.SPECIALORDER;
              data.COSTPRICE = data.COSTPRICE;
              data.RETAILPRICE = data.RETAILPRICE;
              data.PRICE2 = data.PRICE2;
              data.PRICE3 = data.PRICE3;
              data.PRICE4 = data.PRICE4;
              data.DUEWEEKS = data.DUEWEEKS;
              data.AVAILABILITYMESSAGECODE = data.AVAILABILITYMESSAGECODE;
              delete data.WEIGHT;
              delete data.ITEMNAME;
              delete data.ITEMNUMBER;
              return data;
            }
          },
          list: {
            url: function (cb) {
              var url_string = config.host + config.partnums_path;
              url_string = url.setParameterUrl(url_string, config.login, config.pass);
              url_string = encodeURIComponent(url_string);
              if(cb !== null) cb(url_string);
              else return url_string;
            },
            /*
             * Transformiert das Request-Ergebniss in ein besser behandelbares Format 
             */
            transform_result_data: function (data) {
              return data.DATA;
            }
          }
        }
      }
    },
    get_date: function () {
      var now = new Date();
      var d = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),  now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
      var curr_date = d.get_date();
      var curr_month = d.getMonth();
      curr_month++;
      var curr_year = d.getFullYear();
      return curr_month + "/" + curr_date + "/" + curr_year;
    },

    get_time: function () {
      var a_p = "";
      var now = new Date();
      var d = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),  now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
      var curr_hour = d.getHours();
      if (curr_hour < 12) {
        a_p = "AM";
      }
      else {
        a_p = "PM";
      }
      if (curr_hour === 0) {
        curr_hour = 12;
      }
      if (curr_hour > 12) {
        curr_hour = curr_hour - 12;
      }

      var curr_min = d.getMinutes();

      curr_min = curr_min + "";

      if (curr_min.length == 1) {
      curr_min = "0" + curr_min;
      }

      return curr_hour + ":" + curr_min + " " + a_p;
    },

    round_price: function (x) {
      var k = (Math.round(x * 100) / 100).toString();
      k += (k.indexOf('.') == -1)? '.00' : '00';
      return Number(k.substring(0, k.indexOf('.') + 3));
    },
    auto: {
      catalog: {
        product: {
          _infos: function (url_string, cb) {
            url_string = decodeURIComponent(url_string);
            //console.log(url_string);
            heritage.manual.get_json(url_string, function(data) {
              if(data !== null) {
                delete data.COLUMNS;
                if(typeof cb != 'undefined')
                  cb(data);
                else
                  return data;
              } else {
                //error.e408(req, res); TODO
              }
            });
          },
          info: function (sku, cb) {
            heritage.auto.catalog.product._infos(heritage.manual.catalog.product.info.url(sku, null), function(data){
              data = heritage.manual.catalog.product.info.transform_result_data(data);
              //data.sku = sku;
              cb(data);
            });
          },
          infos: function (skus, cb) {
            var tow_d_array = heritage.manual.catalog.product.infos.transform_1d_array_to_2d_array_of_max(skus);
            var result_merged = [];
            for (var i = 0; i < tow_d_array.length; i++) {
              var url_string = decodeURIComponent(heritage.manual.catalog.product.infos.url(tow_d_array[i], null));
              heritage.manual.get_json( url_string, function(data) {
                data = heritage.manual.catalog.product.infos.transform_result_data(data);
                //console.log(data);
                result_merged.push( data );
                console.log("Block "+result_merged.length+"/"+tow_d_array.length);
                // Wenn alle daten von heritage erhalten wurden
                if(result_merged.length === tow_d_array.length) {
                  console.log("Alle Daten erhalten.");
                  var result_merged_ordered = {
                      metrics: [],
                      fittinginfo: [],
                      quality: [],
                      description: [],
                      applications: [],
                      sku: [],
                      itemname: [],
                      weight: [],
                      FREESTOCKQUANTITY: [],
                      SPECIALORDER: [],
                      COSTPRICE: [],
                      RETAILPRICE: [],
                      PRICE2: [],
                      PRICE3: [],
                      PRICE4: [],
                      DUEWEEKS: [],
                      AVAILABILITYMESSAGECODE: []
                  };
                  var count = 0;
                  for (var a = 0; a < result_merged.length; a++) {
                    for (var b = 0; b < result_merged[a].sku.length; b++) {
                      ++count;
                      result_merged_ordered.metrics.push(                 result_merged[a].metrics[b]                );
                      result_merged_ordered.fittinginfo.push(             result_merged[a].fittinginfo[b]            );
                      result_merged_ordered.quality.push(                 result_merged[a].quality[b]                );
                      result_merged_ordered.description.push(             result_merged[a].description[b]            );
                      result_merged_ordered.applications.push(            result_merged[a].applications[b]           );
                      result_merged_ordered.sku.push(                     result_merged[a].sku[b]                    );
                      result_merged_ordered.itemname.push(                result_merged[a].itemname[b]               );
                      result_merged_ordered.weight.push(                  result_merged[a].weight[b]                 );
                      result_merged_ordered.FREESTOCKQUANTITY.push(       result_merged[a].FREESTOCKQUANTITY[b]      );
                      result_merged_ordered.SPECIALORDER.push(            result_merged[a].SPECIALORDER[b]           );
                      result_merged_ordered.COSTPRICE.push(               result_merged[a].COSTPRICE[b]              );
                      result_merged_ordered.RETAILPRICE.push(             result_merged[a].RETAILPRICE[b]            );
                      result_merged_ordered.PRICE2.push(                  result_merged[a].PRICE2[b]                 );
                      result_merged_ordered.PRICE3.push(                  result_merged[a].PRICE3[b]                 );
                      result_merged_ordered.PRICE4.push(                  result_merged[a].PRICE4[b]                 );
                      result_merged_ordered.DUEWEEKS.push(                result_merged[a].DUEWEEKS[b]               );
                      result_merged_ordered.AVAILABILITYMESSAGECODE.push( result_merged[a].AVAILABILITYMESSAGECODE[b]);

                      // console.log( "count: "+count);
                      // console.log( "metrics: "+result_merged_ordered.metrics.length );
                      // console.log( "fittinginfo: "+result_merged_ordered.fittinginfo.length );
                      // console.log( "quality: "+result_merged_ordered.quality.length );
                      // console.log( "description: "+result_merged_ordered.description.length );
                      // console.log( "applications: "+result_merged_ordered.applications.length );
                      // console.log( "sku: "+result_merged_ordered.sku.length );
                      // console.log( "itemname: "+result_merged_ordered.itemname.length );
                      // console.log( "weight: "+result_merged_ordered.weight.length );
                      // console.log( "FREESTOCKQUANTITY: "+result_merged_ordered.FREESTOCKQUANTITY.length );
                      // console.log( "SPECIALORDER: "+result_merged_ordered.SPECIALORDER.length );
                      // console.log( "COSTPRICE: "+result_merged_ordered.COSTPRICE.length );
                      // console.log( "RETAILPRICE: "+result_merged_ordered.RETAILPRICE.length );
                      // console.log( "PRICE2: "+result_merged_ordered.PRICE2.length );
                      // console.log( "PRICE3: "+result_merged_ordered.PRICE3.length );
                      // console.log( "PRICE4: "+result_merged_ordered.PRICE4.length );
                      // console.log( "DUEWEEKS: "+result_merged_ordered.DUEWEEKS.length );
                      // console.log(" ---- ");
                    }
                  }
                  cb(result_merged_ordered);
                }
              });
            }
          },
          list: function (cb) {
            var url_string = decodeURIComponent(heritage.manual.catalog.product.list.url(null));
            //console.log(url_string);
            heritage.manual.get_json(url_string, function(data) {
              cb(heritage.manual.catalog.product.list.transform_result_data(data));
            });
          }
        }
      }
    }
  };

  return heritage;
};
