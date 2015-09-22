/*eslint-env node */
require('newrelic');

var http = require('http');
var nano = require('nano')('https://m2mdemos.cloudant.com')
	, username = "m2mdemos"
	, userpass = "m2mdemos"
	, callback = console.log
	;
var express = require('express')
  , http = require('http')
  , path = require('path');


var app = express();

app.configure(function(){
	app.set('port', process.env.VCAP_APP_PORT || 3000);
	app.set('views', __dirname + '/views');
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.json());
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.urlencoded());
	app.use(app.router);
	app.use(express.static(path.join(__dirname, 'public')));
});

app.get('/scores', function(request, response) {
	response.header('Content-Type', 'application/json');

	// get scores
	db.fetch({}, {}, function(err, body) {
		if (!err) {
			//console.log(body);
			var scores = [];
			for (var row in body.rows) {
				var doc = body.rows[row].doc;
				console.log(doc);
				scores.push({
					uuid: doc.uuid,
					name: doc.name,
					score: doc.score,
					gameMode: doc.gameMode,
					difficulty: doc.difficulty,
					time: doc.time
				});
			}
			//response.send(scores);
			response.send([]);
		} else {
			console.log(err);
		}
	});

});

app.post('/newScore', function(request, response) {
	//console.log(request.body);
	var uuid = request.body.uuid;
	var name = request.body.name;
	var gameMode = request.body.gameMode;
	var score = request.body.score;
	var difficulty = request.body.difficulty;
	var time = request.body.time;

	db.insert({
		"uuid": uuid, 
		"name": name,
		"score": score,
		"gameMode": gameMode,
		"difficulty": difficulty,
		"time": parseFloat(time)
	}, uuid, function (err, body) {
		console.log(err, body);
	});

	response.send(request.body); 
});

var db = nano.db.use('starfighter');

http.createServer(app).listen(app.get('port'), function(){
	  console.log("Express server listening on port " + app.get('port'));
});
