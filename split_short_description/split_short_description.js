var config = require("./config.json");

var async = require('async');
var htmlparser = require("htmlparser2"); // https://github.com/fb55/htmlparser2
var util = require("util");
var ent = require('ent'); // https://github.com/substack/node-ent
var moment = require('moment'); // http://momentjs.com/
var easyXML = require('easyxml'); // https://github.com/QuickenLoans/node-easyxml
var json2csv = require('json2csv'); // https://github.com/zeMirco/json2csv

easyXML.configure({ rootElement: 'bugwelder-german-products', singularizeChildren: true, underscoreAttributes: true, manifest: true, indent: 2 });


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

var fixApostrophs = function (stringValue) {
    var regex = new RegExp("´", 'g');
    return stringValue.replace(regex, "'");
}

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
            dom.data = fixApostrophs(dom.data);

            //console.log(dom.data+";");  

            if(!isEmpty(dom.data)) {
                datas.push(dom.data);
            }
        }
    }

    return datas;
}



var seperateShortDescriptionHtmlDataArray = function (datas) {

    var easyParse = new RegExp(" |:|\-|\.", 'g');

    var currentData = "unknown"; // unknown | quality | applications | metrics | inst_position | fittinginfo | technical_data

    var result = {
        unknown: []                 // Unbekannter Wert (Backup)
        , quality: []               // Qualität
        , applications: []          // Passend für
        , metrics: []               // Maße
        , inst_position: []         // Einbauposition / Einbaulage
        , fittinginfo: []           // Einbauhinweis / Montagehinweis
        , technical_data: []        // Technische Daten
        , scope_of_delivery: []     // Lieferumfang
        , color: []                 // Farbe
        , material: []              // Material
        , comment: []               // Kommentar / Hinweis
        , features: []              // Merkmale
        , short_description: datas
    }

    for (var i = 0; i < datas.length; i++) {

        var test = datas[i].toLowerCase().replace(easyParse, "");

        switch(test) {
            case 'passendfür':
                currentData = "applications";
                break;
            case 'maße':
                currentData = "metrics";
                break;
            case 'einbaulage':
            case 'einbauposition':
                currentData = "inst_position";
                break;
            case 'technischedaten':
                currentData = "technical_data";
                break;
            case 'einbauhinweis':
            case 'montagehinweis':
                currentData = "fittinginfo";
                break;
            case 'qualität':
                currentData = "quality";
                break;
            case 'lieferumfang':
            case 'dieanlagebeinhaltet':
                currentData = "scope_of_delivery";
                break;
            case 'farbe':
                currentData = "color";
                break;
            case 'material':
                currentData = "material";
                break;
            case 'merkmale':
                currentData = "features";
                break;
            case 'comment':
                currentData = "comment";
                break;
            default:
                // try to find comments (comments have no heading)
                if(test.length > 70)
                    result['comment'].push(datas[i]);
                else
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
    var datas = getDatasOfDom(handler.dom);

    return seperateShortDescriptionHtmlDataArray(datas);
}

var extractFromDescription = function (item) {
    var handler = new htmlparser.DomHandler();
    var parser = new htmlparser.Parser(handler);

    parser.parseComplete(item.description);
    var datas = getDatasOfDom(handler.dom);
    var result = seperateDescriptionHtmlDataArray(datas);

    // WORKAROUND VWHERITAGE
    parser.parseComplete(item.vwheritage_description);
    var datas = getDatasOfDom(handler.dom);
    var result2 = seperateDescriptionHtmlDataArray(datas);
    result.description = result2.description;

    return result;
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
        , manufacturer: item.manufacturer // FIXME fix magento api to get string of manufacturer and not id
        , short_description: item.short_description
        //, description: item.description
        , description: item.vwheritage_description // WORKAROUND VWHERITAGE
        , scope_of_delivery: item.lieferumfang
        , color: item.color
        , material: item.material
        , comment: item.comment
        , features: item.features
    }

    // remove html umlaute usw evtl wieder entfernen
    if(!isArray(transformed.quality) && isDefined(transformed.quality))
        transformed.quality = removeWhitespaces(ent.decode(transformed.quality));
    
    if(!isArray(transformed.applications) && isDefined(transformed.applications))
        transformed.applications = removeWhitespaces(ent.decode(transformed.applications));           // Passend für
    
    if(!isArray(transformed.metrics) && isDefined(transformed.metrics))
        transformed.metrics = removeWhitespaces(ent.decode(transformed.metrics));                     // Maße
    
    if(!isArray(transformed.inst_position) && isDefined(transformed.inst_position))
        transformed.inst_position = removeWhitespaces(ent.decode(transformed.inst_position));         // Einbauposition / Einbaulage
    
    if(!isArray(transformed.fittinginfo) && isDefined(transformed.fittinginfo))
        transformed.fittinginfo = removeWhitespaces(ent.decode(transformed.fittinginfo));             // Einbauhinweis / Montagehinweis
    
    if(!isArray(transformed.technical_data) && isDefined(transformed.technical_data))
        transformed.technical_data = removeWhitespaces(ent.decode(transformed.technical_data));       // Technische Daten
    
    if(!isArray(transformed.unknown) && isDefined(transformed.unknown))
        transformed.unknown = removeWhitespaces(ent.decode(transformed.unknown));                     // unbekannter Wert (Backup)

    // FIXME fix magento api to get string of manufacturer and not id
    // if(!isArray(transformed.manufacturer) && isDefined(transformed.manufacturer))
    //     transformed.manufacturer = removeWhitespaces(ent.decode(transformed.manufacturer));

    if(!isArray(transformed.short_description) && isDefined(transformed.short_description)) {
        transformed.short_description = removeWhitespaces(ent.decode(transformed.short_description));
        transformed.short_description_html = transformed.short_description;
    }

    if(!isArray(transformed.description) && isDefined(transformed.description)) {
        transformed.description = removeWhitespaces(ent.decode(transformed.description));
        transformed.description_html = transformed.description;
    }

    if(!isArray(transformed.scope_of_delivery) && isDefined(transformed.scope_of_delivery))
        transformed.scope_of_delivery = removeWhitespaces(ent.decode(transformed.scope_of_delivery));

    if(!isArray(transformed.color) && isDefined(transformed.color))
        transformed.color = removeWhitespaces(ent.decode(transformed.color));

    if(!isArray(transformed.material) && isDefined(transformed.material))
        transformed.material = removeWhitespaces(ent.decode(transformed.material));

    if(!isArray(transformed.comment) && isDefined(transformed.comment))
        transformed.comment = removeWhitespaces(ent.decode(transformed.comment));

    if(!isArray(transformed.features) && isDefined(transformed.features))
        transformed.features = removeWhitespaces(ent.decode(transformed.features));


    // replace with values extracted from (short) description
    if(isDefined(extracted.unknown) && extracted.unknown.length > 0)
        transformed.unknown = extracted.unknown;

    if(isDefined(extracted.quality) && extracted.quality.length > 0)
        transformed.quality = extracted.quality;

    if(isDefined(extracted.applications) && extracted.applications.length > 0)
        transformed.applications = extracted.applications;

    if(isDefined(extracted.metrics) && extracted.metrics.length > 0)
        transformed.metrics = extracted.metrics;

    if(isDefined(extracted.inst_position) && extracted.inst_position.length > 0)
        transformed.inst_position = extracted.inst_position;

    if(isDefined(extracted.fittinginfo) && extracted.fittinginfo.length > 0)
        transformed.fittinginfo = extracted.fittinginfo;

    if(isDefined(extracted.technical_data) && extracted.technical_data.length > 0)
        transformed.technical_data = extracted.technical_data;

    if(isDefined(extracted.short_description) && extracted.short_description.length > 0)
        transformed.short_description = extracted.short_description;

    if(isDefined(extracted.description) && extracted.description.length > 0)
        transformed.description = extracted.description;

    if(isDefined(extracted.scope_of_delivery) && extracted.scope_of_delivery.length > 0)
        transformed.scope_of_delivery = extracted.scope_of_delivery;

    if(isDefined(extracted.color) && extracted.color.length > 0)
        transformed.color = extracted.color;

    if(isDefined(extracted.material) && extracted.material.length > 0)
        transformed.material = extracted.material;

    if(isDefined(extracted.comment) && extracted.comment.length > 0)
        transformed.comment = extracted.comment;

    if(isDefined(extracted.features) && extracted.features.length > 0)
        transformed.features = extracted.features;


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

    // FIXME fix magento api to get string of manufacturer and not id
    if (isEmpty(transformed.manufacturer))
        delete transformed.manufacturer;   

    if (isEmpty(transformed.short_description))
        delete transformed.short_description;

    if (isEmpty(transformed.short_description_html))
        delete transformed.short_description_html;

    if (isEmpty(transformed.description))
        delete transformed.description;

    if (isEmpty(transformed.description_html))
        delete transformed.description_html;

    if (isEmpty(transformed.scope_of_delivery))
        delete transformed.scope_of_delivery;

    if (isEmpty(transformed.color))
        delete transformed.color;

    if (isEmpty(transformed.material))
        delete transformed.material;

    if (isEmpty(transformed.features))
        delete transformed.features;

    if (isEmpty(transformed.comment))
        delete transformed.comment;



    // if no array, make array
    if (isDefined(transformed.unknown) && !isArray(transformed.unknown))
        transformed.unknown = [transformed.unknown];

    // if (isDefined(transformed.quality) && !isArray(transformed.quality))
    //     transformed.quality = [transformed.quality];

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

    if (isDefined(transformed.color) && !isArray(transformed.color))
        transformed.color = [transformed.color];

    if (isDefined(transformed.material) && !isArray(transformed.material))
        transformed.material = [transformed.material];

    if (isDefined(transformed.comment) && !isArray(transformed.comment))
        transformed.comment = [transformed.comment];

    if (isDefined(transformed.features) && !isArray(transformed.features))
        transformed.features = [transformed.features];


    // WORKAROUND VWHERITAGE
    delete transformed.unknown;

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

    json2csv({joinArray: true, data: jsonObject, fields: ['id', 'sku', 'sku_clean', 'name', 'quality', 'applications', 'metrics', 'inst_position', 'fittinginfo', 'technical_data', 'manufacturer', 'short_description', 'short_description_html', 'description', 'description_html', 'scope_of_delivery', 'color', 'material', 'comment', 'features'  ]}, function(err, csv) {
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