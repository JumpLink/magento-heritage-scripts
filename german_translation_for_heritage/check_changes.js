var config = require(__dirname+"/config.json");
var path = require("path");
var sets = require('simplesets'); // sets
var moment = require(__dirname+'/node_modules/moment'); // http://momentjs.com/
var mandrill = require('mandrill-api/mandrill');
var mandrill_client = new mandrill.Mandrill(config.mandrill.key);

var key = "sku";

var argv = require('optimist')
    .usage('Usage: $0 -a [string] -b [string] \nExample: $0 -a ./bugwelder-german-2015-03-15T19_37_37+01_00.json -b ./bugwelder-german-2015-03-30T05:41:12+02:00.json')
    .string('a', 'b')
    .demand(['a','b'])
    .alias('a', 'json_a')
    .alias('b', 'json_b')
    .describe('a', 'json path numer one to compare')
    .describe('b', 'json path numer two to compare')
    .argv;

var sendMail = function (attachments, callback) {
    switch(config.send_mail_with) {
        case 'mandrill':
            sendMailWithMandrill(attachments, callback);
        break;
        default:
            // sendMailWithGMail(attachments, callback);
        break;
    }
}

var sendMailWithMandrill = function (attachments, callback) {
    var message = config.mandrill.report;
    message.subject = message.subject+" "+moment().format('MMMM Do YYYY, h:mm:ss a'); // Subject line
    message.attachments = attachments;
    var async = false;
    var ip_pool = "Main Pool";
    var send_at = null; //moment().utc().format('YYYY-MM-DD hh:mm:ss');
    mandrill_client.messages.send({"message": message, "async": async, "ip_pool": ip_pool, "send_at": send_at}, function(result) {
        callback(null, result);
    }, function(e) {
        // Mandrill returns the error as an object with name and message keys
        callback('A mandrill error occurred: ' + e.name + ' - ' + e.message);
        // A mandrill error occurred: Unknown_Subaccount - No subaccount exists with the id 'customer-123'
    });
}

var generateCSV = function (name, array, callback) {
    var filename = name+".csv";

    var attachment = {
        filename: filename,
        name: filename,
        content:  new Buffer(array_to_csv(name, array)).toString('base64'),
        contentType: 'text/csv',
        type: 'text/csv',
    };

    return attachment;
}

function array_to_csv(name, array) {
    var result = '"'+name+'"'+"\r\n";
    for (var i = 0; i < array.length; i++) {
        result += '"'+array[i]+'"\r\n';
    }
    return result;
}

var array_of_objects_to_set = function (json, key) {
    var set = new sets.Set();

    for (var i = json.length - 1; i >= 0; i--) {
        set.add(json[i][key]);
    };

    return set;
}

var print_break = function () {
    console.log("\n=========================\n");
}

var json_a = {
    path: argv.a,
    basename: path.basename(argv.a),
    json: require(argv.a)
};
json_a.datestring = json_a.basename.replace("bugwelder-german-", "").replace(".json", "");
json_a.date = moment(json_a.date.format('MMMM Do YYYY'), "JJJJ-MM-DDTHH_mm_ssZ");

var json_b = {
    path: argv.b,
    basename: path.basename(argv.b),
    json: require(argv.b)
};
json_b.datestring = json_b.basename.replace("bugwelder-german-", "").replace(".json", "");
json_b.date = moment(json_b.date.format('MMMM Do YYYY'), "JJJJ-MM-DDTHH_mm_ssZ");


json_a.set = array_of_objects_to_set(json_a.json, key);
json_b.set = array_of_objects_to_set(json_b.json, key);

json_a.difference = json_a.set.difference(json_b.set);
json_a.attachment = generateCSV("SKU's in "+json_a.datestring+" aber nicht in "+json_b.datestring, json_a.difference.array());

print_break();
console.log("sku's removed in "+json_b.basename);
json_a.difference.each(function (value) {
    console.log(value);
});

json_b.difference = json_b.set.difference(json_a.set);
json_b.attachment = generateCSV("SKU's in "+json_b.datestring+" aber nicht in "+json_a.datestring, json_b.difference.array());

print_break();
console.log("sku's removed in "+json_a.basename);
json_a.difference.each(function (value) {
    console.log(value);
});

sendMail([json_a.attachment, json_b.attachment], function (err, info) {
    if(err) console.error(err);
    console.log("done");
});