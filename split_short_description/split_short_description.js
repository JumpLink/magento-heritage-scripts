var config = require("./config.json");

var async = require('async');
var htmlparser = require("htmlparser2"); // https://github.com/fb55/htmlparser2
var util = require("util");
var ent = require('ent'); // https://github.com/substack/node-ent
var moment = require('moment'); // http://momentjs.com/
var easyXML = require('easyxml'); // https://github.com/QuickenLoans/node-easyxml
var json2csv = require('json2csv');

easyXML.configure({ singularizeChildren: true, underscoreAttributes: true, manifest: true, indent: 2 });


var isDefined = function(value) {
    return value !== null && typeof(value) !== 'undefined' && value !== 'undefined';
}

var isEmptyChar = function(value) {
    return !isDefined(value) || value == "" || value == " " || value == " " || value == '' || value == ' ' || value == '\t' || value == '\r' || value == '\n' || value == '\x0b';
}

var isArray = function (value) {
    return Object.prototype.toString.call( value ) === '[object Array]';
}

var isEmpty = function(value) {
    if(isArray(value)) {
        return !isDefined(value.length) || value.length <= 0;
    } else {
        return !isDefined(value) || value == "<br>" || !isDefined(value.length) || value.length <= 1 || isEmptyChar(value);
    }
}


var contains = function (str, substring) {
    return str.indexOf(substring) != -1;
}

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

// var replaceUmlaute = function (stringValue) {
//     return stringValue.replace("&acute;", "'").replace("-&acute;", "-'").replace("&#39;;", "'").replace("&auml;", "ä").replace("&uuml;", "ü").replace("&ouml;", "ö").replace("&szlig;", "ß").replace("&amp;", "&");
// }

var removeWhitespaces = function (stringValue) {

    var regex = new RegExp("\r|\n|  ", 'g');

    //var result = stringValue.replace("\r", "").replace("\n", "").replace("  ", " ");
    var result = stringValue.replace(regex, "");
    

    // remove first space
    if(!isEmpty(result) && isEmptyChar(result.charAt(0)))
        result = result.slice(1);

    // remove last space
    if(!isEmpty(result) && isEmptyChar(result.charAt(result.length-1)))
        result = result.substring(0, result.length-1);

    return result;
}

// var replaceHtml = function (stringValue) {
//     return stringValue.replace("<br>", "");
// }

// var replaceUmlauteWhitespaces = function (stringValue) {
//     return removeWhitespaces(replaceUmlaute(stringValue));
// }

// var replaceUmlauteWhitespacesHtml = function (stringValue) {
//     return replaceHtml(ent.decode(stringValue));
// }

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
            dom.data = ent.decode(dom.data);
            dom.data = removeWhitespaces(dom.data);    

            console.log(dom.data+";");  

            if(!isEmpty(dom.data)) {
                datas.push(dom.data);
            }
        }
    }

    return datas;
}



var seperateShortDescriptionHtmlDataArray = function (datas) {

    var currentData = "unknown"; // unknown | quality | applications | metrics | inst_position | fittinginfo | technical_data

    var result = {
        unknown: []
        , quality: []
        , applications: []          // Passend für
        , metrics: []               // Maße
        , inst_position: []         // Einbauposition / Einbaulage
        , fittinginfo: []           // Einbauhinweis / Montagehinweis
        , technical_data: []        // Technische Daten
        , short_description: datas
    }

    for (var i = 0; i < datas.length; i++) {

        switch(datas[i].toLowerCase()) {
            case 'passend für:':
                currentData = "applications";
                break;
            case 'maße:':
                currentData = "metrics";
                break;
            case 'einbaulage:':
            case 'einbauposition':
                currentData = "inst_position";
                break;
            case 'technische daten:':
                currentData = "technical_data";
                break;
            case 'einbauhinweis:':
            case 'montagehinweis:':
                currentData = "fittinginfo";
                break;
            case 'qualität:':
                currentData = "quality";
                break;
            default:
                result[currentData].push(datas[i]);
                break;
        }
        
    };

    return result;
}

var seperateDescriptionHtmlDataArray = function (datas) {

    var currentData = "unknown"; // unknown | quality | applications | metrics | inst_position | fittinginfo | technical_data

    var result = {
        quality: ""
        , description: datas
    }

    for (var i = 0; i < datas.length; i++) {

        var currentString = datas[i].toLowerCase();

        if(contains(currentString, 'beste qualität')) {
            result.quality = "Beste Qualität";
        } else if(contains(currentString, 'originalqualität')) {
            result.quality = "Originalqualität";
        } else if(contains(currentString, 'handgefertigte topqualität')) {
             result.quality = 'Handgefertigte Topqualität';
        } else if(contains(currentString, 'zubehörqualität') || contains(currentString, 'zubehör qualität')) {
            result.quality = 'Zubehörqualität';
        } else if(contains(currentString, 'erstausrüster-qualität') || contains(currentString, 'erstausrüster qualität')  || contains(currentString, 'erstausrüsterqualität')) {
            result.quality = 'Erstausrüster-Qualität';
        } else if(contains(currentString, 'oe-qualität') || contains(currentString, 'oe qualität')) {
            result.quality = 'OE Qualität';
        } else if(contains(currentString, 'deutsche qualität')) {
            result.quality = 'Deutsche Qualität';
        } else if(contains(currentString, 'top qualität')) {
            result.quality = 'Top Qualität';
        } else if(contains(currentString, 'gute qualität')) {
            result.quality = 'Gute Qualität';
        }

        if(contains(currentString, 'hergestellt in deutschland')) {
            result.quality += " Hergestellt in Deutschland";
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

    return seperateShortDescriptionHtmlDataArray(datas);
}

var extractFromDescription = function (item) {
    var handler = new htmlparser.DomHandler();
    var parser = new htmlparser.Parser(handler);
    parser.parseComplete(item.description);
    var datas = getDatasOfDom(handler.dom);
   
    return seperateDescriptionHtmlDataArray(datas);
}

var transformProductInfo = function (item, callback) {
    

    var extracted = extractFromShortDescription(item);

    var extractedDescription = extractFromDescription(item);

    extracted.description = extractedDescription.description;
    extracted.quality = extractedDescription.quality;

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
        , short_description: item.short_description
        , description: item.description
    }

    // remove html umlaute usw evtl wieder entfernen
    if(isDefined(transformed.quality))
        transformed.quality = removeWhitespaces(ent.decode(transformed.quality));
    
    if(isDefined(transformed.applications))
        transformed.applications = removeWhitespaces(ent.decode(transformed.applications));           // Passend für
    
    if(isDefined(transformed.metrics))
        transformed.metrics = removeWhitespaces(ent.decode(transformed.metrics));                     // Maße
    
    if(isDefined(transformed.inst_position))
        transformed.inst_position = removeWhitespaces(ent.decode(transformed.inst_position));         // Einbauposition / Einbaulage
    
    if(isDefined(transformed.fittinginfo))
        transformed.fittinginfo = removeWhitespaces(ent.decode(transformed.fittinginfo));             // Einbauhinweis / Montagehinweis
    
    if(isDefined(transformed.technical_data))
        transformed.technical_data = removeWhitespaces(ent.decode(transformed.technical_data));       // Technische Daten
    
    if(isDefined(transformed.unknown))
        transformed.unknown = removeWhitespaces(ent.decode(transformed.unknown));                                                                              // unbekannter Wert (Backup)

    if(isDefined(transformed.short_description)) {
        transformed.short_description = removeWhitespaces(ent.decode(transformed.short_description));
        transformed.short_description_html = transformed.short_description;
    }

    if(isDefined(transformed.description)) {
        transformed.description = removeWhitespaces(ent.decode(transformed.description));
        transformed.description_html = transformed.description;
    }


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

    if(extracted.short_description.length > 0)
        transformed.short_description = extracted.short_description;

    if(extracted.description.length > 0)
        transformed.description = extracted.description;


    if (isEmpty(transformed.unknown))
        delete transformed.unknown;

    if (isEmpty(transformed.quality))
        delete transformed.quality;

    if (isEmpty(transformed.applications))
        delete transformed.applications;

    if (isEmpty(transformed.metrics))
        delete transformed.metrics;

    if (isEmpty(transformed.inst_position))
        delete transformed.inst_position;

    if (isEmpty(transformed.fittinginfo))
        delete transformed.fittinginfo;

    if (isEmpty(transformed.technical_data))
        delete transformed.technical_data;

    if (isEmpty(transformed.short_description))
        delete transformed.short_description;

    if (isEmpty(transformed.description))
        delete transformed.description;



    // if no array, make array
    if (isDefined(transformed.unknown) && !isArray(transformed.unknown))
        transformed.unknown =[transformed.unknown];

    if (isDefined(transformed.quality) && !isArray(transformed.quality))
        transformed.quality = [transformed.quality];

    if (isDefined(transformed.applications) && !isArray(transformed.applications))
        transformed.applications = [transformed.applications];

    if (isDefined(transformed.metrics) && !isArray(transformed.metrics))
        transformed.metrics = [transformed.metrics];

    if (isDefined(transformed.inst_position) && !isArray(transformed.inst_position))
        transformed.inst_position = [transformed.inst_position];

    if (isDefined(transformed.fittinginfo) && !isArray(transformed.fittinginfo))
        transformed.fittinginfo = [transformed.fittinginfo];

    if (isDefined(transformed.technical_data) && !isArray(transformed.technical_data))
        transformed.technical_data = [transformed.technical_data];

    if (isDefined(transformed.short_description) && !isArray(transformed.short_description))
        transformed.short_description = [transformed.short_description];

    if (isDefined(transformed.description) && !isArray(transformed.description))
        transformed.description = [transformed.description];

    // WORKAROUND remove descripton
    delete transformed.description;
    delete transformed.description_html;

    callback(null, transformed);
}

var isActive = function (item, callback)  {

    // filter all products they are not activated (unactivated products are not translated)
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

    var mailOptions = config.mailoptions;
    var fileName = "bugwelder-german-"+moment().format();

    mailOptions.subject += " "+moment().format('MMMM Do YYYY, h:mm:ss a'); // Subject line
    mailOptions.attachments = [
        {   // utf-8 string as an attachment
            fileName: fileName+".json",
            contents:  JSON.stringify(jsonObject, null, 2)
        },
        {   // utf-8 string as an attachment
            fileName: fileName+".xml",
            contents: easyXML.render(jsonObject)
        }
    ];

    json2csv({data: jsonObject, fields: ['id', 'sku', 'sku_clean', 'name', 'quality', 'applications', 'metrics', 'inst_position', 'fittinginfo', 'technical_data', 'short_description', 'short_description_html' ]}, function(err, csv) {
        if (err) console.log(err);
        else {
            mailOptions.attachments.push({fileName: fileName+".csv", contents: csv})
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
    });
}

splitShortDescription( function (error, results) {
    console.log(util.inspect(error, showHidden=false, depth=4, colorize=false));
    console.log(util.inspect(results, showHidden=false, depth=4, colorize=true));
    sendMail(results);
});