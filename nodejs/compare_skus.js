#!/usr/bin/env node
var fs = require('fs');
var config = require(__dirname+'/config/general.json');
var csv = require('csv');
var sets = require('simplesets'); // sets
var email   = require("emailjs"); // send emails
var argv = require('optimist')
    .usage('Usage: $0 -a [string] -b [string] ')
    .string('a', 'b')
    .alias('a', 'csv_a')
    .alias('b', 'csv_b')
    .describe('a', 'csv number one to compare')
    .describe('b', 'csv number two to compare')
    .argv;


function load_csv(cb) {
	console.log(argv);
	fs.readFile(argv.a, 'utf8', function(err, data_a) {
		if (err) throw err;
		console.log('OK: ' + filename);
		console.log(data_a)
		csv.parse(data_a, {}, function(err, csv_a){
			console.log(csv_a);
			fs.readFile(argv.b, 'utf8', function(err, data_b) {
				if (err) throw err;
				console.log('OK: ' + filename);
				console.log(data_b)
				csv.parse(data_b, {}, function(err, csv_b){
					console.log(csv_b);
					cb(csv_a, csv_b);
				});
			});
		});
	});

}

function compare() {
	load_csv(function(csv_a, csv_b) {
		
	});
}
