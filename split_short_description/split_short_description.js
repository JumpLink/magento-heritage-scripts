var config = require("./config.json");

var async = require('async');
var htmlparser = require("htmlparser2"); // https://github.com/fb55/htmlparser2
var util = require("util");


var getProductList = function (callback) {

    var magento_shell_api = require("./magento_shell_api.js")(config);

    var options = {
        method: 'product_items'
        , filters: null
        , store: null
    }
    
    magento_shell_api.event.on('ready', function () {
        magento_shell_api.call(options);
    });

    magento_shell_api.event.on('result_'+options.method, function (result) {
        if(config.max_products < result.length)
            result.splice(config.max_products, result.length);

        callback(null, result);
    });

    magento_shell_api.start();
}

var getProductInfo = function (item, callback) {

    //console.log(item);
    var magento_shell_api = require("./magento_shell_api.js")(config);

    var options = {
        method: 'product_export'
        , productId: item.id
        , store: 'shop_de'
        , all_stores: false
        , attributes: null
        , identifierType: 'id'
        , integrate_set: false
        , normalize: true
    }
    
    magento_shell_api.event.on('ready', function () {
        magento_shell_api.call(options);
    });

    magento_shell_api.event.on('result_'+options.method, function (result) {
        //console.log(result);
        callback(null, result);
    });

    magento_shell_api.start();
}

var replaceUmlaute = function (stringValue) {
    return stringValue.replace("&acute;", "'").replace("&auml;", "ä").replace("&uuml;", "ü").replace("&ouml;", "ö").replace("&szlig;", "ß").replace("&amp;", "&");
}

var replaceWhitespaces = function (stringValue) {
    return stringValue.replace("\r", "").replace("\n", "").replace("&nbsp;", "");
}

var getDatasOfDom = function (dom) {
    //console.log("getDatasOfDom");
    var datas = new Array();
    // if dom is array
    if( Object.prototype.toString.call( dom ) === '[object Array]' ) {

        for (var i = 0; i < dom.length; i++) {
            datas = datas.concat(getDatasOfDom(dom[i]));
        };
        // return lastFound;
    } else {
        // has childrens
        if( typeof dom.children !== 'undefined' ) {
            datas = datas.concat(getDatasOfDom(dom.children));
        }

        if(isDefined(dom.data)) {
            //console.log("data found");
            dom.data = replaceUmlaute(replaceWhitespaces(dom.data));

            if(dom.data.charAt(0) == " ")
                dom.data = str.slice(1);
            if(dom.data.length > 0)
                datas.push(dom.data);
            //console.log(datas);
        }
    }

    return datas;
}



var seperateHtmlDataArray = function (datas) {

    var currentData = "unknown"; // unknown | quality | applications | metrics | inst_position | fittinginfo | technical_data

    var result = {
        unknown: []
        , quality: []
        , applications: []          // Passend für
        , metrics: []               // Maße
        , inst_position: []         // Einbauposition / Einbaulage
        , fittinginfo: []           // Einbauhinweis / Montagehinweis
        , technical_data: []        // Technische Daten
    }

    

    for (var i = 0; i < datas.length; i++) {

        switch(datas[i].toLowerCase()) {
            case 'passend f&uuml;r:':
            case 'passend für:':
                currentData = "applications";
                break;
            case 'ma&szlig;e:':
            case 'maße:':
                currentData = "metrics";
            case 'einbaulage:':
            case 'einbauposition':
                currentData = "inst_position";
            case 'technische daten:':
                currentData = "technical_data";
            default:
                result[currentData].push(datas[i]);

        }
        
    };

    return result;
}

var extractFromShortDescription = function (item) {

    // console.log(item.short_description);

    var handler = new htmlparser.DomHandler();
    var parser = new htmlparser.Parser(handler);
    parser.parseComplete(item.short_description);
    // console.log("===========");
    // console.log(util.inspect(handler.dom, showHidden=false, depth=4, colorize=true));
    // console.log("===========");
    var datas = getDatasOfDom(handler.dom);
    
    return seperateHtmlDataArray(datas);
}

var isDefined = function(value) {
    return value !== null && typeof(value) !== 'undefined' && value !== 'undefined';
}

var isArray = function (value) {
    return Object.prototype.value.call( someVar ) === '[object Array]';
}

var transformProductInfo = function (item, callback) {
    

    var extracted = extractFromShortDescription(item);

    var transformed = {
        id:  item.id
        , sku: item.sku
        , sku_clean: item.sku_clean
        , name: item.name
        , quality: item.quality
        , applications: item.applications
        , metrics: item.metrics
        , inst_position: item.inst_position
        , fittinginfo: item.fittinginfo
        , technical_data: item.technical_data
        , unknown: item.unknown
    }

    // remove html umlaute usw evtl wieder entfernen
    if(isDefined(transformed.quality))
        transformed.quality = replaceUmlaute(replaceWhitespaces(transformed.quality)).replace("<br>", "");
    
    if(isDefined(transformed.applications))
        transformed.applications = replaceUmlaute(replaceWhitespaces(transformed.applications)).replace("<br>", "");           // Passend für
    
    if(isDefined(transformed.metrics))
        transformed.metrics = replaceUmlaute(replaceWhitespaces(transformed.metrics)).replace("<br>", "");                     // Maße
    
    if(isDefined(transformed.inst_position))
        transformed.inst_position = replaceUmlaute(replaceWhitespaces(transformed.inst_position)).replace("<br>", "");         // Einbauposition / Einbaulage
    
    if(isDefined(transformed.fittinginfo))
        transformed.fittinginfo = replaceUmlaute(replaceWhitespaces(transformed.fittinginfo)).replace("<br>", "");             // Einbauhinweis / Montagehinweis
    
    if(isDefined(transformed.technical_data))
        transformed.technical_data = replaceUmlaute(replaceWhitespaces(transformed.technical_data)).replace("<br>", "");       // Technische Daten
    
    if(isDefined(transformed.unknown))
        transformed.unknown = transformed.unknown                                                                              // unbekannter Wert (Backup)


    // replace with values from short description
    if(extracted.unknown.length > 0)
        transformed.unknown = extracted.unknown;

    if(extracted.quality.length > 0)
        transformed.quality = extracted.quality;

    if(extracted.applications.length > 0)
        transformed.applications = extracted.applications;

    if(extracted.metrics.length > 0)
        transformed.metrics = extracted.metrics;

    if(extracted.inst_position.length > 0)
        transformed.inst_position = extracted.inst_position;

    if(extracted.fittinginfo.length > 0)
        transformed.fittinginfo = extracted.fittinginfo;

    if(extracted.technical_data.length > 0)
        transformed.technical_data = extracted.technical_data;


    // if no array, make array
    if (!isArray(transformed.unknown))
        transformed.unknown =[transformed.unknown];

    if (!isArray(transformed.quality))
        transformed.quality = [transformed.quality];

    if (!isArray(transformed.applications))
        transformed.applications = [transformed.applications];

    if (!isArray(transformed.metrics))
        transformed.metrics = [transformed.metrics];

    if (!isArray(transformed.inst_position))
        transformed.inst_position = [transformed.inst_position];

    if (!isArray(transformed.fittinginfo))
        transformed.fittinginfo = [transformed.fittinginfo];

    if (!isArray(transformed.technical_data))
        transformed.technical_data = [transformed.technical_data];

    callback(null, transformed);
}

var isActive = function (item, callback)  {

    // filter all products they are not activated
    callback(item.status === 'activated');

    // no filter
    // callback(true)
}

var splitShortDescription = function (callback) {
    async.waterfall([
        getProductList,
        function getEachProductInfo(items, callback) {
            async.mapSeries(items, getProductInfo, callback);
        },
        function removeInactives(items, callback) {
            async.filterSeries(items, isActive, function(results){callback(null, results)});
        },
        function transformEach(items, callback) {
            async.mapSeries(items, transformProductInfo, callback);
        }
    ], function (err, results) {
       callback(null, results); 
    });
}


var sendMail = function (jsonObject) {

    var nodemailer = require("nodemailer");                     // https://github.com/andris9/Nodemailer
    var mailTransport = nodemailer.createTransport(config.nodemailer.transport, config.nodemailer);

    var mailOptions = {
        from: "Bugwelder Sync <admin@bugwelder.com>", // sender address
        to: "pascal@bugwelder.com", // list of receivers
        subject: "Bugwelder German Sync", // Subject line
        // text: util.inspect(jsonObject, showHidden=true, depth=2, colorize=false),
        attachments: [
            {   // utf-8 string as an attachment
                fileName: "bugwelder-german.json",
                contents:  JSON.stringify(jsonObject, null, 2)
            }
        ]
    }

    mailTransport.sendMail(mailOptions, function(error, response){
        if(error){
            console.log(error);
        }else{
            console.log("Message sent: " + response.message);
        }

        // if you don't want to use this transport object anymore, uncomment following line
        mailTransport.close(); // shut down the connection pool, no more messages
    });

}

splitShortDescription( function (error, results) {
    console.log(util.inspect(error, showHidden=false, depth=4, colorize=false));
    console.log(util.inspect(results, showHidden=false, depth=4, colorize=true));
    sendMail(results);
});