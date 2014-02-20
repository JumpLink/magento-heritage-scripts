var config = require("./config.json");

var async = require('async');
var htmlparser = require("htmlparser2"); // https://github.com/fb55/htmlparser2
var util = require("util");

var nodemailer = require("nodemailer");                     // https://github.com/andris9/Nodemailer
var smtpTransport = nodemailer.createTransport("SMTP",config.nodemailer);



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

        if(typeof dom.data !== 'undefined') {
            //console.log("data found");
            dom.data = dom.data.replace("\r", "").replace("\n", "");
            if(dom.data.length > 0)
                datas.push(dom.data);
            //console.log(datas);
        }
    }

    return datas;
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
    
    return datas;
}


var transformProductInfo = function (item, callback) {
    

    var transformed = {
        id:  item.id
        , sku: item.id
        , sku_clean: item.sku_clean
        , name: item.name
        , quality: item.quality
        , applications: item.applications           // Passend für
        , metrics: item.metrics                     // Maße
        , inst_position: item.inst_position         // Einbauposition / Einbaulage
        , fittinginfo: item.fittinginfo             // Einbauhinweis / Montagehinweis
        , test : extractFromShortDescription(item)
    }

    callback(null, transformed);
}

var isActive = function (item, callback)  {

    // filter all products they are not activated
    // callback(item.status === 'activated');

    // no filter
    callback(true)
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


splitShortDescription( function (error, results) {
    console.log(util.inspect(error, showHidden=false, depth=4, colorize=true));
    console.log(util.inspect(results, showHidden=false, depth=4, colorize=true));
});
