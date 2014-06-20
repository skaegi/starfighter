/**
* @license
* Licensed Materials - Property of IBM
* 5725-G92 (C) Copyright IBM Corp. 2006, 2013. All Rights Reserved.
* US Government Users Restricted Rights - Use, duplication or
* disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
*/

var displayMode = (getUrlVars()["mode"] == null) ? "normal" : getUrlVars()["mode"];
var prefix = "starfighter/";

function getUrlVars() {
	var vars = {};
	var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, value) {
		vars[key] = value;
	});
	return vars;
}

var hasWorker = (navigator.userAgent.toLowerCase().indexOf('firefox') > -1) ? false : true;

actions = {
	connect: function(server, port, clientId, uuid) {
		sendMessage("connect", JSON.stringify({ server: server, port: port, clientId: clientId, 
		                                        prefix: prefix, uuid: uuid }));
	},
	subscribe: function(topic, callback) { // TODO: add callback
		sendMessage("subscribe", JSON.stringify({ topic: topic }));
		callback.onSuccess();
	},
	unsubscribe: function(topic, callback) { // TODO: add callback
		sendMessage("unsubscribe", JSON.stringify({ topic: topic }));
		callback.onSuccess();
	},
	publish: function(topic, message, retained) {
		app.stats.outMessageCount++;
		sendMessage("publish", JSON.stringify({ topic: topic, message: message, retained: retained }));
	},
}

callbacks = {
	debug: function(data) {
		console.log("debug: ", data);
	},
	onMessage: function(data) {
		var msg = data;
		var topic = msg.destinationName;
		var payload = msg.payloadString;
		app.processMessage(topic, payload);
	},
	isConnected: function(data) {
		app.onConnection();
	}
}


function sendMessage(type, data) {
	myWorker.postMessage(JSON.stringify({ type: type, data: data }));
}

if (!hasWorker) {
	var client = null;
	sendMessage = function(type, data) {
		var params = JSON.parse(data);
		switch (type) {
			case "connect":
				app.client = new Messaging.Client(app.server, app.port, app.clientId);
				app.client.onMessageArrived = function(msg) {
					callbacks.onMessage({ destinationName: msg.destinationName, payloadString: msg.payloadString });
				}
				app.client.onConnectionLost = function() {
					console.log("lost connection to MessageSight!");
					app.connected = false;
				}
				var willMessage = new Messaging.Message(JSON.stringify({
					uuid: app.uuid,
					action: "left"
				}));
				willMessage.destinationName = prefix + "players/event/0/0/0/"+app.uuid;

				app.client.connect({
					keepAliveInterval: 3600,
					userName: "starfighter",
					password: "starfighter",
					onSuccess: function() {
						app.onConnection();
					},
					willMessage: willMessage
				});
				break;
			case "subscribe":
				app.client.subscribe(params.topic);
				break;
			case "unsubscribe":
				app.client.unsubscribe(params.topic);
				break;
			case "publish":
				var msgObj = new Messaging.Message(params.message);
				msgObj.destinationName = params.topic;
				if (params.retained) { msgObj.retained = true; }
				app.client.send(msgObj);
				break;
		}
	}
}

var sounds_count = 5;
var sounds = {
	asteroid: {
		s: new Array(),
		i: 0
	},
	explosion: {
		s: new Array(),
		i: 0
	},
	hit: {
		s: new Array(),
		i: 0
	},
	shoot: {
		s: new Array(),
		i: 0
	}
};

function playSound(name) {
	if (!window.isMobile) {
		sounds[name].s[sounds[name].i].play();
		sounds[name].i = (sounds[name].i + 1) % sounds_count;
	}
}

function init(){
	if (hasWorker) {
		window.myWorker = new Worker("js/mqtt_ww.js");
		window.myWorker.onmessage = function(e) {
			try {
				var msg = JSON.parse(e.data);
				if (msg.type && callbacks[msg.type]) {
					callbacks[msg.type](msg.data);
				} else {
					console.log("no callback exists for: " + msg.type);
				}
			} catch (err) {
				console.log("bad data: ", e.data, err);
			}
		}
	}
	if (displayMode == "viewer") {
		window.app = new ViewerApp();
		console.log("VIEWER");
		app.startShipCleanupInterval();
		app.startMessageRateCalcInterval();
	} else {
		window.app = new StarfighterApp();
		console.log("STARFIGHTER");
		app.startAsteroidCreateInterval();
		app.startShipPublishInterval();
		app.startMessageRateCalcInterval();
		app.startShipCleanupInterval();
	}

	if (!window.isMobile) {
		for (var i in sounds) {
			for (var j = 0; j < sounds_count; j++) {
				sounds[i].s.push(new Audio("sounds/"+i+".wav"));
				sounds[i].s[j].load();
			}
		}
	}

	setupInput();
	setupEvents();

	resize();

	(function animLoop() {
		requestAnimationFrame(animLoop);
		app.doFrame();
	})();
}
var frames = 0;

function setupInput() {
	window.keys = [];
	if (window.isMobile) {
		$("#canvas").on("vmousemove", function(event) {
			/*
			var x = event.pageX;
			var y = event.pageY - $("canvas").offset().top;
			var w = getViewportWidth() / 2;
			var h = getViewportHeight() / 2;
			var perc_x = x / w;
			var perc_y = y / h;
			if (perc_x > 0.3 && perc_x < 0.7 && perc_y > 0.7) {
				window.keys[38] = true;
				window.keys[37] = false;
				window.keys[39] = false;
			} else if (perc_x < 0.5) {
				window.keys[37] = true;
				window.keys[38] = false;
				window.keys[39] = false;
			} else if (perc_x > 0.5) {
				window.keys[38] = false;
				window.keys[37] = false;
				window.keys[39] = true;
			}
			*/
			event.preventDefault();
		});
		$("#canvas").on("vmousedown", function(event) {
			var x = event.pageX;
			var y = event.pageY - $("canvas").offset().top;
			var w = getViewportWidth() / 2;
			var h = getViewportHeight() / 2;
			var perc_x = x / w;
			var perc_y = y / h;
			if (perc_x > 0.3 && perc_x < 0.7 && perc_y > 0.7) {
				window.keys[38] = true;
			} else if (perc_x < 0.5 && perc_y < 0.7) {
				window.keys[37] = true;
			} else if (perc_x < 0.5 && perc_y > 0.7) {
				window.keys[65] = true;
			} else if (perc_x > 0.5 && perc_y < 0.7) {
				window.keys[39] = true;
			} else if (perc_x > 0.5 && perc_y > 0.7) {
				window.keys[68] = true;
			}
		});
		$("#canvas").on("vmouseup", function(event) {
			var x = event.pageX;
			var y = event.pageY - $("canvas").offset().top;
			var w = getViewportWidth();
			var h = getViewportHeight();
			var perc_x = x / w;
			var perc_y = y / h;
			window.keys[37] = false;
			window.keys[38] = false;
			window.keys[39] = false;
			window.keys[65] = false;
			window.keys[68] = false;
		});

		$("#canvas").bind("tap", function(event) {
			/*
			if (event.touches) {
				var touch = event.touches[0];
				var x = touch.pageX;
				var y = touch.pageY - $("canvas").offset().top;
			} else {
				var x = event.pageX;
				var y = event.pageY - $("canvas").offset().top;
			}
			var w = $("#canvas")[0].width;
			var h = $("#canvas")[0].height;
			var perc_x = x / w;
			var perc_y = y / h;
			console.log("tap", x, y, perc_x, perc_y);
			if (perc_x < 0.4 && perc_y < 0.5) {
				window.keys[37] = true;
				setTimeout(function() { window.keys[37] = false; }, 50);
			}
			if (perc_x > 0.6 && perc_y < 0.5) {
				window.keys[39] = true;
				setTimeout(function() { window.keys[39] = false; }, 50);
			}
			if (perc_x < 0.5 && perc_y > 0.6) {
				window.keys[38] = true;
				setTimeout(function() { window.keys[38] = false; }, 50);
			}
			*/
			event.preventDefault();
		});
	} else {
		$("body").keydown(function(event) {
			window.keys[event.which] = true;
			//if (event.which == 192) { app.score += 100; }
			//if (event.which == 83) { $("#iscoreboard").bPopup(); }
		});

		$("body").keyup(function(event) {
			window.keys[event.which] = false;
			if (event.which == 83) {
				app.showDebugInfo = (!app.showDebugInfo);
			}
		});

		$("body").keypress(function(event) {
			console.log(event.which);
			if (event.which == 112) {
				app.gamePaused = !app.gamePaused;
			}
			switch (event.which) {
				case 49:
					playSound("asteroid");
					break;
				case 50:
					playSound("explosion");
					break;
				case 51:
					playSound("hit");
					break;
				case 52:
					playSound("shoot");
					break;
			}
		});
	}
	
	/*
	if (window.isMobile) { 
		setTimeout(function() {
			$("#uname").val("Mobile");
			$("#loginSubmit").click();
			setTimeout(function() {
				window.keys[32] = true; 
			}, 200);
		}, 500);
	}
	*/
}

function setupEvents() {
	$("#game-choice-easy").on("click", function() {
		if (app.gameMode == 0) {
			$("#game-choice-normal").click();
			$("#difficultyRadio").buttonset("refresh");
			return;
		}
		app.difficulty = 0;
		$("#sPts").html(app.scoreForShipKill());
		$("#aPts").html(app.scoreForAsteroidKill());
		app.createInitialAsteroids();
	});
	$("#game-choice-normal").on("click", function() {
		app.difficulty = 1;
		$("#sPts").html(app.scoreForShipKill());
		$("#aPts").html(app.scoreForAsteroidKill());
		app.createInitialAsteroids();
	});
	$("#game-choice-insane").on("click", function() {
		if (app.gameMode == 0) {
			$("#game-choice-normal").click();
			$("#difficultyRadio").buttonset("refresh");
			return;
		}
		app.difficulty = 3;
		$("#sPts").html(app.scoreForShipKill());
		$("#aPts").html(app.scoreForAsteroidKill());
		app.createInitialAsteroids();
	});

	$("#game-mode-timed").on("click", function() {
		app.gameMode = 0;
		$("#game-choice-normal").click();
		$("#radio-choice-1").click();
		$("#difficultyRadio").buttonset("refresh");
	});
	$("#game-mode-standard").on("click", function() {
		app.gameMode = 1;
		$("#game-choice-easy").click();
		$("#radio-choice-4").click();
		$("#difficultyRadio").buttonset("refresh");
	});

	$("#radio-choice-1").on("click", function() {
		$("#tabs-1").show();
		$("#tabs-2").hide();
		$("#tabs-3").hide();
		$("#tabs-4").hide();
		$("#radio-choice-1").attr("checked", "checked");
		$("#radio-choice-2").attr("checked", false);
		$("#radio-choice-3").attr("checked", false);
		$("#radio-choice-4").attr("checked", false);
		$(".radioChoice").checkboxradio("refresh");
	});
	$("#radio-choice-2").on("click", function() {
		$("#tabs-1").hide();
		$("#tabs-2").show();
		$("#tabs-3").hide();
		$("#tabs-4").hide();
		$("#radio-choice-1").attr("checked", false);
		$("#radio-choice-2").attr("checked", "checked");
		$("#radio-choice-3").attr("checked", false);
		$("#radio-choice-4").attr("checked", false);
		$(".radioChoice").checkboxradio("refresh");
	});
	$("#radio-choice-3").on("click", function() {
		$("#tabs-1").hide();
		$("#tabs-2").hide();
		$("#tabs-3").show();
		$("#tabs-4").hide();
		$("#radio-choice-1").attr("checked", false);
		$("#radio-choice-2").attr("checked", false);
		$("#radio-choice-3").attr("checked", "checked");
		$("#radio-choice-4").attr("checked", false);
		$(".radioChoice").checkboxradio("refresh");
	});
	$("#radio-choice-4").on("click", function() {
		$("#tabs-1").hide();
		$("#tabs-2").hide();
		$("#tabs-3").hide();
		$("#tabs-4").show();
		$("#radio-choice-1").attr("checked", false);
		$("#radio-choice-2").attr("checked", false);
		$("#radio-choice-3").attr("checked", false);
		$("#radio-choice-4").attr("checked", "checked");
		$(".radioChoice").checkboxradio("refresh");
	});

	$("#sPts").html(app.scoreForShipKill());
	$("#aPts").html(app.scoreForAsteroidKill());

	$(window).on('resize', function() { resize(); } );
}

function difficultyString(difficulty) {
	if (difficulty == 0) { return "Easy"; }
	if (difficulty == 1) { return "Normal"; }
	if (difficulty == 2) { return "Normal"; }
	if (difficulty == 3) { return "Insane"; }
}

///////////////////////////////

var resize = function() {
	var size = {
			width: window.innerWidth || document.body.clientWidth,
			height: window.innerHeight || document.body.clientHeight
	};
	
	// make page fit window size
	$("#content").css("width", size.width);
	$("#content").css("height", size.height);
	
	if (window.isMobile) {
		if (window.devicePixelRatio == 2 && size.width < 500) {
			$("canvas")[0].width = size.width * 4;
			$("canvas")[0].height = size.height * 4;
			$("canvas").css("width", size.width);
			$("canvas").css("height", size.height);
			var context = $("#canvas")[0].getContext("2d");
			context.scale(2, 2);
		} else {
			$("canvas")[0].width = size.width * 2;
			$("canvas")[0].height = size.height * 2;
			$("canvas").css("width", size.width);
			$("canvas").css("height", size.height);
			var context = $("#canvas")[0].getContext("2d");
		}
	} else {
		$("canvas")[0].width = size.width;
		$("canvas")[0].height = size.height;
	}

	// force the viewport to be recalculated on the next getter
	viewport.width = null;
	viewport.height = null;
}

var viewport = {
	height: null,
	width: null
};
function getViewportWidth() {
	if (!viewport.width) {
		console.log("setting viewport width");
		if (window.isMobile && window.innerWidth < 500) {
			viewport.width = $("canvas")[0].width / window.devicePixelRatio;
		} else {
			viewport.width = $("canvas")[0].width;
		}
	}
	return viewport.width;
}

function getViewportHeight() {
	if (!viewport.height) {
		console.log("setting viewport height");
		if (window.isMobile && window.innerWidth < 500) {
			viewport.height = $("canvas")[0].height / window.devicePixelRatio;
		} else {
			viewport.height = $("canvas")[0].height;
		}
	}
	return viewport.height;
}

// give us a random string of length "length"
var randomString = function(length) {
	var str = "", chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", chars2 = "0123456789";
	for (var i = 0; i < length; i++) {
		if (i % 2 == 0) {
			str += chars[Math.floor(Math.random() * chars.length)];
		} else {
			str += chars2[Math.floor(Math.random() * chars2.length)];
		}
	}
	return str;
}

var ASTEROID_BOUNDS_LENGTH = 3000;
var WORLD_BOUNDS_LENGTH = 16000;
var WORLD_BOUNDS = {
	x: {
		min: 0,
		max: WORLD_BOUNDS_LENGTH
	},
	y: {
		min: 0,
		max: WORLD_BOUNDS_LENGTH
	}
}

function setWorldBounds(size) {
	WORLD_BOUNDS_LENGTH = size;
	WORLD_BOUNDS = {
		x: {
			min: 0,
			max: WORLD_BOUNDS_LENGTH
		},
		y: {
			min: 0,
			max: WORLD_BOUNDS_LENGTH
		}
	}
}

// should be a power of 2
var SHIP_PUBLISHES_PER_SECOND = 16;

var INITIAL_ASTEROID_DENSITY = 0.00001;
var getInitialAsteroidCount = function() {
	return Math.floor(ASTEROID_BOUNDS_LENGTH * ASTEROID_BOUNDS_LENGTH * INITIAL_ASTEROID_DENSITY) * (1 + (app.difficulty / 2));
}
var getMaxAsteroidCount = function() {
	return getInitialAsteroidCount() * 2 * (1 + app.difficulty/2);
}

var centerWorldPos = {
	x: null,
	y: null,
	zoom: 1
};

var SHIP_TURN_SPEED = 3;
var SHIP_THRUST = 300;
var SHIP_FIRE_INTERVAL_MILLIS = 300;

function Ship(uuid) {
	this.angle = 5 * Math.PI / 4;
	this.name = "Anonymous";
	this.uuid = uuid;
	this.type = "ship";
	this.velocity = {
		x: 0,
		y: 0
	};
	this.shield = 1;
	this.radius = 30;
	this.lastUpdate = null;
	this.lastShot = null;
	this.damageToProcess = 0;
	this.lastHitTime = null;
	this.worldPos = {
		x: null,
		y: null
	};
	this.setStartPosition();
	this.visible = false;
	this.invulnerable = false;
}
Ship.prototype.setStartPosition = function() {
	var bValid = false;
	var minDist = 200;
	var wallDist = 400;
	while (!bValid) {
		var start_x = wallDist + Math.random() * (WORLD_BOUNDS.x.max - WORLD_BOUNDS.x.min - 2*wallDist);
		var start_y = wallDist + Math.random() * (WORLD_BOUNDS.y.max - WORLD_BOUNDS.y.min - 2*wallDist);
		/*
		if (Math.sqrt(
				Math.pow(this.ship.worldPos.x - start_x, 2) +
				Math.pow(this.ship.worldPos.y - start_y, 2)
			) > minDist) {
			bValid = true;
		}
		*/
		bValid = true;
	}
	this.worldPos.x = start_x;
	this.worldPos.y = start_y;
}
Ship.prototype.setInvulnerable = function(millis) {
	this.invulnerable = true;
	setTimeout((function(ship) { return function() { ship.invulnerable = false; } })(this), millis);
}
Ship.prototype.update = function(delta) {
	if (this.type == "ship") {
		if (window.keys[65]) {
			// 'a'
			this.strafeLeft(delta);
		}
		if (window.keys[68]) {
			// 'd'
			this.strafeRight(delta);
		}
		if (window.keys[37]) {
			this.turn(-delta);
		}
		if (window.keys[38]) {
			this.accelerate(delta);
		}
		if (window.keys[39]) {
			this.turn(delta);
		}
		if (window.keys[32]) {
			var now = (new Date()).getTime();
			if (this.lastShot == null || now - this.lastShot > SHIP_FIRE_INTERVAL_MILLIS) {
				var bullets = 1;
				if (app.score > 100) { bullets = 2; }
				if (app.score > 1000) { bullets = 3; }
				if (app.score > 2500) { bullets = 4; }
				if (app.score > 5000) { bullets = 5; }
				this.shoot(bullets);
				this.lastShot = now;
			}
		}
	}

	if (this.damageToProcess > 0) {
		this.shield -= this.damageToProcess;
		if (this.shield < 0) { this.shield = 0; }

		this.lastHitTime = (new Date()).getTime();
		this.damageToProcess = 0;
	}

	this.worldPos.x += delta * this.velocity.x;
	this.worldPos.y += delta * this.velocity.y;

	if (this.type == "ship" || (app.followShips && app.following == this.uuid)) {
		centerWorldPos.x = app.ship.worldPos.x;
		centerWorldPos.y = app.ship.worldPos.y;
	}

	if (this.worldPos.x - this.radius < WORLD_BOUNDS.x.min || this.worldPos.x + this.radius > WORLD_BOUNDS.x.max) {
		this.velocity.x *= -1;
		var vec = Math.sqrt(Math.pow(this.velocity.x, 2) + Math.pow(this.velocity.y, 2));
		this.damageToProcess += vec * 0.0002;
	}
	if (this.worldPos.y - this.radius < WORLD_BOUNDS.y.min || this.worldPos.y + this.radius > WORLD_BOUNDS.y.max) {
		this.velocity.y *= -1;
		var vec = Math.sqrt(Math.pow(this.velocity.x, 2) + Math.pow(this.velocity.y, 2));
		this.damageToProcess += vec * 0.0002;
	}
}
Ship.prototype.shoot = function(bullets) {
	//if (window.app.bulletCount >= 20) { return; }
	if (bullets == 5) {
		var b1 = new Bullet(
					this.getFrontOfShip().x, this.getFrontOfShip().y, 
					-Math.sin(this.angle) * BULLET_VELOCITY + this.velocity.x, 
					Math.cos(this.angle) * BULLET_VELOCITY + this.velocity.y,
					12, this
				);
		if (this.type == "enemyShip") { b1.type = "enemyBullet"; }
		if (this.type == "AI") { b1.type = "AIBullet"; }
		window.app.bullets[b1.id] = b1;
		window.app.bulletCount++;
//		console.log("shooting bullet " + b1.id);

		var b2 = new Bullet(
					this.getRightFrontOfShip().x, this.getRightFrontOfShip().y, 
					-Math.sin(this.angle + Math.PI/12) * BULLET_VELOCITY + this.velocity.x, 
					Math.cos(this.angle + Math.PI/12) * BULLET_VELOCITY + this.velocity.y,
					12, this
				);
		if (this.type == "enemyShip") { b2.type = "enemyBullet"; }
		if (this.type == "AI") { b2.type = "AIBullet"; }
		window.app.bullets[b2.id] = b2;
		window.app.bulletCount++;
//		console.log("shooting bullet " + b2.id);
		
		var b3 = new Bullet(
					this.getLeftFrontOfShip().x, this.getLeftFrontOfShip().y, 
					-Math.sin(this.angle - Math.PI/12) * BULLET_VELOCITY + this.velocity.x, 
					Math.cos(this.angle - Math.PI/12) * BULLET_VELOCITY + this.velocity.y,
					12, this
				);
		if (this.type == "enemyShip") { b3.type = "enemyBullet"; }
		if (this.type == "AI") { b3.type = "AIBullet"; }
		window.app.bullets[b3.id] = b3;
		window.app.bulletCount++;
//		console.log("shooting bullet " + b3.id);
	} else if (bullets == 4) {
		var b1 = new Bullet(
					this.getLeftFrontOfShip().x, this.getLeftFrontOfShip().y, 
					-Math.sin(this.angle) * BULLET_VELOCITY + this.velocity.x, 
					Math.cos(this.angle) * BULLET_VELOCITY + this.velocity.y,
					4, this
				);
		if (this.type == "enemyShip") { b1.type = "enemyBullet"; }
		if (this.type == "AI") { b1.type = "AIBullet"; }
		window.app.bullets[b1.id] = b1;
		window.app.bulletCount++;
//		console.log("shooting bullet " + b1.id);

		var b2 = new Bullet(
					this.getRightFrontOfShip().x, this.getRightFrontOfShip().y, 
					-Math.sin(this.angle) * BULLET_VELOCITY + this.velocity.x, 
					Math.cos(this.angle) * BULLET_VELOCITY + this.velocity.y,
					4, this
				);
		if (this.type == "enemyShip") { b2.type = "enemyBullet"; }
		if (this.type == "AI") { b2.type = "AIBullet"; }
		window.app.bullets[b2.id] = b2;
		window.app.bulletCount++;
//		console.log("shooting bullet " + b2.id);

		var b3 = new Bullet(
					this.getRightFrontOfShip().x, this.getRightFrontOfShip().y, 
					-Math.sin(this.angle + Math.PI/8) * BULLET_VELOCITY + this.velocity.x, 
					Math.cos(this.angle + Math.PI/8) * BULLET_VELOCITY + this.velocity.y,
					4, this
				);
		if (this.type == "enemyShip") { b3.type = "enemyBullet"; }
		if (this.type == "AI") { b3.type = "AIBullet"; }
		window.app.bullets[b3.id] = b3;
		window.app.bulletCount++;
//		console.log("shooting bullet " + b3.id);
		
		var b4 = new Bullet(
					this.getLeftFrontOfShip().x, this.getLeftFrontOfShip().y, 
					-Math.sin(this.angle - Math.PI/8) * BULLET_VELOCITY + this.velocity.x, 
					Math.cos(this.angle - Math.PI/8) * BULLET_VELOCITY + this.velocity.y,
					4, this
				);
		if (this.type == "enemyShip") { b4.type = "enemyBullet"; }
		if (this.type == "AI") { b4.type = "AIBullet"; }
		window.app.bullets[b4.id] = b4;
		window.app.bulletCount++;
//		console.log("shooting bullet " + b4.id);
	} else if (bullets == 3) {
		var b1 = new Bullet(
					this.getFrontOfShip().x, this.getFrontOfShip().y, 
					-Math.sin(this.angle) * BULLET_VELOCITY + this.velocity.x, 
					Math.cos(this.angle) * BULLET_VELOCITY + this.velocity.y,
					4, this
				);
		if (this.type == "enemyShip") { b1.type = "enemyBullet"; }
		if (this.type == "AI") { b1.type = "AIBullet"; }
		window.app.bullets[b1.id] = b1;
		window.app.bulletCount++;
//		console.log("shooting bullet " + b1.id);

		var b2 = new Bullet(
					this.getRightFrontOfShip().x, this.getRightFrontOfShip().y, 
					-Math.sin(this.angle + Math.PI/12) * BULLET_VELOCITY + this.velocity.x, 
					Math.cos(this.angle + Math.PI/12) * BULLET_VELOCITY + this.velocity.y,
					4, this
				);
		if (this.type == "enemyShip") { b2.type = "enemyBullet"; }
		if (this.type == "AI") { b2.type = "AIBullet"; }
		window.app.bullets[b2.id] = b2;
		window.app.bulletCount++;
//		console.log("shooting bullet " + b2.id);
		
		var b3 = new Bullet(
					this.getLeftFrontOfShip().x, this.getLeftFrontOfShip().y, 
					-Math.sin(this.angle - Math.PI/12) * BULLET_VELOCITY + this.velocity.x, 
					Math.cos(this.angle - Math.PI/12) * BULLET_VELOCITY + this.velocity.y,
					4, this
				);
		if (this.type == "enemyShip") { b3.type = "enemyBullet"; }
		if (this.type == "AI") { b3.type = "AIBullet"; }
		window.app.bullets[b3.id] = b3;
		window.app.bulletCount++;
//		console.log("shooting bullet " + b3.id);
	} else if (bullets == 2) {
		var b1 = new Bullet(
					this.getLeftFrontOfShip().x, this.getLeftFrontOfShip().y, 
					-Math.sin(this.angle) * BULLET_VELOCITY + this.velocity.x, 
					Math.cos(this.angle) * BULLET_VELOCITY + this.velocity.y,
					4, this
				);
		if (this.type == "enemyShip") { b1.type = "enemyBullet"; }
		if (this.type == "AI") { b1.type = "AIBullet"; }
		window.app.bullets[b1.id] = b1;
		window.app.bulletCount++;
//		console.log("shooting bullet " + b1.id);

		var b2 = new Bullet(
					this.getRightFrontOfShip().x, this.getRightFrontOfShip().y, 
					-Math.sin(this.angle) * BULLET_VELOCITY + this.velocity.x, 
					Math.cos(this.angle) * BULLET_VELOCITY + this.velocity.y,
					4, this
				);
		if (this.type == "enemyShip") { b2.type = "enemyBullet"; }
		if (this.type == "AI") { b2.type = "AIBullet"; }
		window.app.bullets[b2.id] = b2;
		window.app.bulletCount++;
//		console.log("shooting bullet " + b2.id);
	} else {
		var b = new Bullet(
					this.getFrontOfShip().x, this.getFrontOfShip().y, 
					-Math.sin(this.angle) * BULLET_VELOCITY + this.velocity.x, 
					Math.cos(this.angle) * BULLET_VELOCITY + this.velocity.y,
					4, this
				);
		if (this.type == "enemyShip") { b.type = "enemyBullet"; }
		if (this.type == "AI") { b.type = "AIBullet"; }
		window.app.bullets[b.id] = b;
		window.app.bulletCount++;
		//console.log("shooting bullet " + b.id, b);
	}

	if (this.type == "ship") {
		var payload = JSON.stringify({
			uuid: app.uuid,
			action: "shoot",
			bullets: bullets
		});
		playSound("shoot");
		var topicBit = coordToBuckets(this.worldPos.x, this.worldPos.y, 0);
		actions.publish(prefix + "players/bullet/" + topicBit + "/" + app.uuid, payload);
		var topicBit = coordToBuckets(this.worldPos.x, this.worldPos.y, 4);
		actions.publish(prefix + "players/bullet/" + topicBit + "/" + app.uuid, payload);
	}
}
Ship.prototype.turn = function(delta) {
	this.angle += delta * SHIP_TURN_SPEED;
}
Ship.prototype.accelerate = function(delta) {
	this.velocity.x += -1 * delta * SHIP_THRUST * Math.sin(this.angle);
	this.velocity.y += delta * SHIP_THRUST * Math.cos(this.angle);
	//console.log(Math.sin(this.angle), Math.cos(this.angle), this.velocity);
}
Ship.prototype.strafeLeft = function(delta) {
	this.velocity.x += -1 * delta * SHIP_THRUST * Math.sin(this.angle + Math.PI / 2);
	this.velocity.y += delta * SHIP_THRUST * Math.cos(this.angle + Math.PI / 2);
	//console.log(Math.sin(this.angle), Math.cos(this.angle), this.velocity);
}
Ship.prototype.strafeRight = function(delta) {
	this.velocity.x += -1 * delta * SHIP_THRUST * Math.sin(this.angle - Math.PI / 2);
	this.velocity.y += delta * SHIP_THRUST * Math.cos(this.angle - Math.PI / 2);
	//console.log(Math.sin(this.angle), Math.cos(this.angle), this.velocity);
}
Ship.prototype.draw = function(appType) {
	var context = $("#canvas")[0].getContext("2d");

	// draw shield
	var now = (new Date()).getTime();
	var delta = (now - ((this.lastHitTime != null) ? this.lastHitTime : now)) / 1000;

	if (this.type == "enemyShip" || this.type == "AI" || (delta > 0 && delta < 2)) {
		context.save();
		context.translate(getDispX(this.worldPos.x), getDispY(this.worldPos.y));

		context.beginPath();
		context.strokeStyle = "#0aa";

		context.beginPath();
		context.strokeStyle = "#0ff";
		context.lineWidth = 4 * getDispScale();
		var radius = (1.2 * this.radius + 2) * getDispScale();
		context.arc(0, 0, radius, 0, this.shield * Math.PI*2);
		context.stroke();

		context.restore();
	}

	// draw ship
	var disp_x = getDispX(this.worldPos.x);
	var disp_y = getDispY(this.worldPos.y);

	// draw "bubbles" on outside of map if ship is off-screen
	//if (this.type != "ship" && !window.isMobile && displayMode != "viewer") {
	if (this.type != "ship") {
		var innerWidth = getViewportWidth();
		var innerHeight = getViewportHeight();
		if ((disp_x < -100 || disp_x > innerWidth + 100) ||
			(disp_y < -100 || disp_y > innerHeight + 100)) {
			var dx = disp_x - innerWidth / 2;
			var dy = disp_y - innerHeight / 2;
			var ly = -1;
			var lx = -1;
			if (Math.abs(dx) >= Math.abs(dy)) {
				ly = dy / dx;
				lx = (dx > 0) ? 1 : -1;
			} else {
				lx = dx / dy;
				ly = (dy > 0) ? 1 : -1;
			}

			if (dx * lx < 0) { lx *= -1; }
			if (dy * ly < 0) { ly *= -1; }

			lx = innerWidth / 2 * lx + innerWidth / 2;
			ly = innerHeight / 2 * ly + innerHeight / 2;

			var dist = Math.sqrt(dx * dx + dy * dy);
			var rad = 12 - (dist / WORLD_BOUNDS_LENGTH) * 9;
			var alpha = (rad + 1) / 12;

			context.save();
			context.beginPath();
			if (this.type == "enemyShip") {
				context.fillStyle = "rgba(224, 0, 0, " + alpha.toFixed(2) + ")";
			}
			if (this.type == "AI") {
				context.fillStyle = "rgba(0, 0, 224, " + alpha.toFixed(2) + ")";
			}
			context.strokeStyle = "rgba(255, 255, 255, " + alpha.toFixed(2) + ")";
			context.lineWidth = 2;
			context.arc(lx, ly, rad, 0, Math.PI*2);
			context.fill();
			context.stroke();
			context.restore();
		}
	}

	context.save();
	if (this.invulnerable || this.gamePaused || (this.status && this.status == "PAUSED")) { context.globalAlpha = 0.6; }
	context.translate(disp_x, disp_y);
	var ship_radius = this.radius * getDispScale();
	context.rotate(this.angle);
	context.beginPath();
	context.lineWidth = 3;
	context.strokeStyle = "#ffffff";
	if (window.keys[38] && this.type == "ship") {
		context.moveTo(-0.6 * ship_radius * Math.sqrt(3) / 2, -1.4 * ship_radius / 2);
		context.fillStyle = "orange";
		context.fillRect(0.3 * ship_radius * Math.sqrt(3) / 2, -1.4 * ship_radius / 2 - 0.5*ship_radius,
							0.2*ship_radius*Math.sqrt(3)/2, 0.5*ship_radius);
		context.fillRect(-0.5 * ship_radius * Math.sqrt(3) / 2, -1.4 * ship_radius / 2 - 0.5*ship_radius,
							0.2*ship_radius*Math.sqrt(3)/2, 0.5*ship_radius);
	}
	if (window.keys[65] && this.type == "ship") {
		context.fillStyle = "orange";
		context.fillRect( 0.4 * ship_radius, 0.0*ship_radius,
							0.3*ship_radius, 0.2*ship_radius);
	}
	if (window.keys[68] && this.type == "ship") {
		context.fillStyle = "orange";
		context.fillRect(-0.7 * ship_radius, 0.0*ship_radius,
							0.3*ship_radius, 0.2*ship_radius);
	}
	context.fillStyle = "#0f0";
	if (this.type == "enemyShip") {
		context.fillStyle = "#d00";
	}
	if (this.type == "AI") {
		context.fillStyle = "#00d";
	}
	context.moveTo(0, ship_radius);
	context.lineTo(0.8 *ship_radius * Math.sqrt(3) / 2, -1.4*ship_radius / 2);
	context.lineTo(-0.8 * ship_radius * Math.sqrt(3) / 2, -1.4*ship_radius / 2);
	context.lineTo(0, ship_radius);
	context.closePath();
	context.fill();
	context.stroke();
	context.restore();

	if (this.type == "enemyShip" || this.type == "AI") {
		context.save();
		context.fillStyle = "#ff0";
		var fontSize = Math.max(14, 20 * getDispScale());
		if (appType == "viewer") {
			if (this.type == "enemyShip") {
				fontSize *= 2;
				context.fillStyle = "#0f0";
			}
		}
		context.font = fontSize + "px HelveticaNeue-Light";
		if (this.isPointingLeft()) {
			context.textAlign = "left";
		} else {
			context.textAlign = "right";
		}
		context.textBaseline = "middle";
		context.fillText(this.name, getDispX(this.getBackOfShip().x), getDispY(this.getBackOfShip().y));
		context.restore();
	}
}
Ship.prototype.isPointingLeft = function() {
	return (Math.sin(this.angle) > 0);
}
Ship.prototype.isPointingUp = function() {
	return (Math.cos(this.angle) < 0);
}
Ship.prototype.getFrontOfShip = function() {
	return {
		x: this.worldPos.x - Math.sin(this.angle) * this.radius,
		y: this.worldPos.y + Math.cos(this.angle) * this.radius
	}
}
Ship.prototype.getBackOfShip = function() {
	return {
		x: this.worldPos.x + Math.sin(this.angle) * this.radius * 1.6,
		y: this.worldPos.y - Math.cos(this.angle) * this.radius * 1.6
	}
}
Ship.prototype.getLeftFrontOfShip = function() {
	return {
		x: this.worldPos.x - Math.sin(this.angle - Math.PI/8) * this.radius * 0.8,
		y: this.worldPos.y + Math.cos(this.angle - Math.PI/8) * this.radius * 0.8
	}
}
Ship.prototype.getRightFrontOfShip = function() {
	return {
		x: this.worldPos.x - Math.sin(this.angle + Math.PI/8) * this.radius * 0.8,
		y: this.worldPos.y + Math.cos(this.angle + Math.PI/8) * this.radius * 0.8
	}
}
Ship.prototype.needsDelete = function() {
	return (app.gameTimeRemaining < 0 || this.shield <= 0);
}


var BULLET_MAX_TIME = 2.5;
var AI_BULLET_MAX_TIME = 1.5;
var BULLET_VELOCITY = 500;
var BULLET_TURN_SPEED = 4;
function Bullet(x, y, vx, vy, radius, ship) {
	this.id = Math.random().toString(36).slice(2).substring(0, 8);
	this.totalTime = 0;
	this.angle = 0;
	this.radius = radius;
	this.type = "bullet";
	this.ship = ship;
	this.createdAt = (new Date()).getTime();
	this.velocity = {
		x: vx,
		y: vy
	}
	this.lastPos = {
		x: x,
		y: y
	}
	this.worldPos = {
		x: x,
		y: y
	}
	this.wasHit = false;
}
Bullet.prototype.update = function(delta) {
	this.lastPos.x = this.worldPos.x;
	this.lastPos.y = this.worldPos.y;
	this.worldPos.x += delta * this.velocity.x;
	this.worldPos.y += delta * this.velocity.y;
	var dist = Math.sqrt(Math.pow(delta * this.velocity.x, 2) + Math.pow(delta * this.velocity.y, 2));
	this.totalTime += delta;
	this.angle += delta * BULLET_TURN_SPEED;
	if (this.worldPos.x - this.radius < WORLD_BOUNDS.x.min || this.worldPos.x + this.radius > WORLD_BOUNDS.x.max) {
		this.velocity.x *= -1;
	}
	if (this.worldPos.y - this.radius < WORLD_BOUNDS.y.min || this.worldPos.y + this.radius > WORLD_BOUNDS.y.max) {
		this.velocity.y *= -1;
	}
}
Bullet.prototype.draw = function() {
	var context = $("#canvas")[0].getContext("2d");
	context.save();
	context.translate(getDispX(this.worldPos.x), getDispY(this.worldPos.y));
	context.rotate(this.angle);
	var maxTime = (this.type == "AIBullet") ? AI_BULLET_MAX_TIME : BULLET_MAX_TIME;
	if (this.totalTime < maxTime) {
		context.globalAlpha = 1 - Math.pow(this.totalTime / maxTime, 8);
	} else {
		context.globalAlpha = 0;
	}
	if (this.type == "enemyBullet") { 
		context.fillStyle = "red"; 
		context.strokeStyle = "white";
	} else if (this.type == "AIBullet") { 
		context.fillStyle = "blue"; 
		context.strokeStyle = "white";
	} else {
		context.fillStyle = "white";
		context.strokeStyle = "teal";
	}
	var halfSide = this.radius * getDispScale() / Math.sqrt(2);
	context.fillRect(-halfSide, -halfSide, halfSide*2+1, halfSide*2 + 1);
	context.strokeRect(-halfSide, -halfSide, halfSide*2+1, halfSide*2 + 1);
	context.restore();
}
Bullet.prototype.needsDelete = function() {
	var maxTime = (this.type == "AIBullet") ? AI_BULLET_MAX_TIME : BULLET_MAX_TIME;
	return (this.totalTime > maxTime) || this.wasHit;
}

function Asteroid(x, y, vx, vy, asteroidClass) {
	this.id = Math.random().toString(36).slice(2).substring(0, 8);
	this.angle = 0;
	this.asteroidClass = asteroidClass;
	if (this.asteroidClass == 3) {
		this.rotationSpeed = Math.random() * 4 - 2;
		this.radius = 20;
	} else if (this.asteroidClass == 2) {
		this.rotationSpeed = Math.random() * 8 - 4;
		this.radius = 14;
	} else if (this.asteroidClass == 1) {
		this.rotationSpeed = Math.random() * 16 - 8;
		this.radius = 8;
	}
	var point_data = [];
	var num_points = this.radius / 2;
	for (var i = 0; i < num_points; i++) {
		point_data.push(i * (Math.PI * 2 / num_points) * 0.9 * (1 + Math.random() * 0.2));
	}

	point_data.sort();

	this.points = [];
	for (var i in point_data) {
		var p = {
			x: this.radius * Math.cos(point_data[i]),
			y: this.radius * Math.sin(point_data[i])
		}
		this.points.push(p);
	}

	this.velocity = {
		x: vx,
		y: vy
	}
	this.worldPos = {
		x: x,
		y: y
	}
	this.wasHit = false;
}
Asteroid.prototype.update = function(delta) {
	this.worldPos.x += delta * this.velocity.x;
	this.worldPos.y += delta * this.velocity.y;
	var dist = Math.sqrt(Math.pow(delta * this.velocity.x, 2) + Math.pow(delta * this.velocity.y, 2));
	this.angle += delta * this.rotationSpeed;
	if (this.worldPos.x - this.radius < WORLD_BOUNDS.x.min || this.worldPos.x + this.radius > WORLD_BOUNDS.x.max) {
		this.velocity.x *= -1;
	}
	if (this.worldPos.y - this.radius < WORLD_BOUNDS.y.min || this.worldPos.y + this.radius > WORLD_BOUNDS.y.max) {
		this.velocity.y *= -1;
	}
}
Asteroid.prototype.draw = function() {
	var context = $("#canvas")[0].getContext("2d");

	/*
	context.save();
	context.translate(getDispX(this.worldPos.x), getDispY(this.worldPos.y));
	var rad = this.radius * getDispScale();
	var grd = context.createRadialGradient(0, 0, rad/2, 0, 0, 1.5*rad);
	grd.addColorStop(0, "rgba(144, 144, 144, 1.0)");
	grd.addColorStop(1, "rgba(144, 144, 144, 0.0)");
	context.fillStyle = grd;
	context.arc(0, 0, 2*rad, 0, Math.PI * 2);
	context.fill();
	context.restore();
	*/

	context.save();
	context.translate(getDispX(this.worldPos.x), getDispY(this.worldPos.y));
	context.rotate(this.angle);
	context.fillStyle = "#999";
	context.lineWidth = this.asteroidClass * getDispScale();
	if (this.asteroidClass == 3) {
		context.strokeStyle = "#faa";
	} else if (this.asteroidClass == 2) {
		context.strokeStyle = "#0ff";
	} else {
		context.strokeStyle = "#aaf";
	}
	context.beginPath();
	for (var i in this.points) {
		if (i == 0) { context.moveTo(this.points[i].x * getDispScale(), this.points[i].y * getDispScale()); }
		else        { context.lineTo(this.points[i].x * getDispScale(), this.points[i].y * getDispScale()); }
	}
	context.closePath();
	context.fill();
	context.stroke();
	context.restore();
}
Asteroid.prototype.needsDelete = function() {
	return this.wasHit;
	//return (this.totalDist > BULLET_MAX_DIST);
}

function getDispX(worldx) {
	return ((worldx - centerWorldPos.x) * centerWorldPos.zoom + getViewportWidth() / 2);
}

function getDispY(worldy) {
	return ((worldy - centerWorldPos.y) * centerWorldPos.zoom + getViewportHeight() / 2);
}

function getDispScale() {
	return centerWorldPos.zoom;
}

function StarfighterApp() {
	//this.server = "messagesight.demos.ibm.com";
	this.server = "192.84.45.43";
	this.port = 1883;
	this.showDebugInfo = false;
	this.uuid = Math.random().toString(36).slice(2).substring(0,10);
	this.name = "Anonymous";
	this.clientId = "sf-"+this.uuid;
	this.canvas = $("canvas")[0];
	this.ship = new Ship(this.uuid);
	this.enemyShips = {};
	this.bullets = [];
	this.bulletCount = 0;
	this.asteroids = {};
	this.bigAsteroidCount = 0;
	this.asteroidCount = 0;
	this.score = 0;
	this.stats = {};
	this.difficulty = 1;
	this.gameMode = 0;
	this.gamePaused = false;
	this.gameTimeRemaining = null;
	setTimeout(function() { app.connect(); }, 100);
	this.openNamePopup();
	setTimeout(function() {
		app.setDefaultShipPosition();
		app.createInitialAsteroids();
	}, 1000);
}

StarfighterApp.prototype.createInitialAsteroids = function() {
	this.asteroids = {};
	this.asteroidCount = 0;
	for (var i = 0; i < getInitialAsteroidCount(); i++) {
		this.createAsteroid();
	}
	this.bigAsteroidCount = 0;
	for (var i in this.asteroids) { 
		if (this.asteroids[i].asteroidClass == 3) { this.bigAsteroidCount++; }
	}
}

StarfighterApp.prototype.startGameTimer = function() {
	this.gameTimeRemaining = 180;  // 3 min
}

StarfighterApp.prototype.moveAsteroids = function() {
	// if an asteroid is farther than ASTEROID_BOUNDS_LENGTH from the ship, respawn it in range (delete/create)
	var toDelete = [];
	var maxDist = ASTEROID_BOUNDS_LENGTH;
	for (var i in this.asteroids) {
		var a = this.asteroids[i];
		var d = Math.sqrt(Math.pow(a.worldPos.x - this.ship.worldPos.x, 2) +
		              Math.pow(a.worldPos.y - this.ship.worldPos.y, 2));
		if (d > maxDist) {
			toDelete.push(a.id);
		}
	}
	for (var i in toDelete) {
		this.createAsteroid(this.asteroids[toDelete[i]].asteroidClass);
		delete this.asteroids[toDelete[i]];
		this.asteroidCount--;
	}
	if (toDelete.length > 0) { console.log("moving " + toDelete.length + " asteroids"); }
}

StarfighterApp.prototype.setDefaultShipPosition = function() {
	this.ship.setStartPosition();
}
StarfighterApp.prototype.openNamePopup = function() {
	$("#loginSubmit").click(function(event) {
		app.nameEntered($("#uname").val());
		if (typeof(Storage) !== "undefined" && localStorage) {
			localStorage.setItem("starfighter_name", $("#uname").val());
		}
		$("#enterName").fadeOut();
		app.ship.visible = true;
		app.ship.setInvulnerable(3000);
		setTimeout(function() {
			if (app.gameMode == 0) {
				app.startGameTimer();
			}
		});
		if (window.isMobile) { window.keys[32] = true; }
	});
	$("#enterName").bPopup({
		modalClose: false,
		escClose: false
	});
	if (typeof(Storage) !== "undefined" && localStorage) {
		var storedName = localStorage.getItem("starfighter_name");
		$("#uname").val(storedName);
	}
}

StarfighterApp.prototype.changeSubscriptions = function(buckets) {
	//console.log(buckets);
	if (!this.bucketList) { this.bucketList = []; }

	var oldBucketList = this.bucketList;
	var newBucketList = buckets;
	
	var rmSubs = oldBucketList.filter(function( el ) {
		return newBucketList.indexOf( el ) < 0;
	});
	for (var i in rmSubs) {
		var topic = prefix + "players/+/"+rmSubs[i]+"/+";
		actions.unsubscribe(topic, 
			{ 
				onSuccess: (function(t, b) { return function() { 
					//console.log("unsubscribed from " + t); 
					var index = -1;
					for (var i in app.subList) {
						if (app.subList[i].topic == t) {
							index = i;
						}
					}
					if (index !== -1) {
						app.subList.splice(index, 1);
					}

					index = -1;
					for (var i in app.bucketList) {
						if (app.bucketList[i] == b) {
							index = i;
						}
					}
					if (index !== -1) {
						app.bucketList.splice(index, 1);
					}
				} })(topic, rmSubs[i])
			}
		);
	}

	if (newBucketList) {
		var addSubs = newBucketList.filter(function( el ) {
			return oldBucketList.indexOf( el ) < 0;
		});
		for (var i in addSubs) {
			var topic = prefix + "players/+/"+addSubs[i]+"/+";
			actions.subscribe(topic, 
				{ 
					onSuccess: (function(t, b) { return function() { 
						//console.log("subscribed to " + t); 
						var match = t.replace(/\+/g,"[^\\/]*");
						app.subList.push({ topic: t, match: match, count: 0 });
						app.bucketList.push(b);
					} })(topic, addSubs[i])
				}
			);
		}
	}
	this.bucketList = buckets;
}

StarfighterApp.prototype.nameEntered = function(name) {
	this.name = (name != "") ? name : this.uuid;
	this.ship.name = this.name;
}

function timeSince(date) {

    var seconds = Math.floor((new Date() - date) / 1000);

    var interval = Math.floor(seconds / 31536000);

    if (interval > 1) {
        return interval + " years";
    }
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) {
        return interval + " months";
    }
    interval = Math.floor(seconds / 86400);
    if (interval > 1) {
        return interval + " days";
    }
    interval = Math.floor(seconds / 3600);
    if (interval > 1) {
        return interval + " hours";
    }
    interval = Math.floor(seconds / 60);
    if (interval > 1) {
        return interval + " minutes";
    }
    return Math.floor(seconds) + " seconds";
}

StarfighterApp.prototype.updateScoreboard = function() {
	
	var timed_tableStr = "<tr><th>Place</th><th>Name</th><th>Date</th><th>Score</th><th style='width:80px'>Difficulty</th></tr>";
	var standard_tableStr = "<tr><th>Place</th><th>Name</th><th>Date</th><th>Score</th><th style='width:80px'>Difficulty</th></tr>";
	var timed_count = 0;
	var standard_count = 0;

	var place_timed = 0;
	var place_standard = 0;

	var categories = {
		timed_currentHour: {
			tableStr: "<tr><th>Place</th><th>Name</th><th>Date</th><th>Score</th><th style='width:80px'>Difficulty</th></tr>",
			gameMode: 0,
			currentHour: true,
			currentDay: true,
			place: 0,
			count: 0,
			shownMyScore: false
		},
		timed_today: {
			tableStr: "<tr><th>Place</th><th>Name</th><th>Date</th><th>Score</th><th style='width:80px'>Difficulty</th></tr>",
			gameMode: 0,
			currentHour: false,
			currentDay: true,
			place: 0,
			count: 0,
			shownMyScore: false
		},
		timed_allTime: {
			tableStr: "<tr><th>Place</th><th>Name</th><th>Date</th><th>Score</th><th style='width:80px'>Difficulty</th></tr>",
			gameMode: 0,
			currentHour: false,
			currentDay: false,
			place: 0,
			count: 0,
			shownMyScore: false
		},
		standard_allTime: {
			tableStr: "<tr><th>Place</th><th>Name</th><th>Date</th><th>Score</th><th style='width:80px'>Difficulty</th></tr>",
			gameMode: 1,
			currentHour: false,
			currentDay: false,
			place: 0,
			count: 0,
			shownMyScore: false
		}
	};

	for (var j in highscores) {
		var name = highscores[j].name;
		var time = highscores[j].time;   // unix seconds
		var gameMode = highscores[j].gameMode;
		var date = timeSince(new Date(time)) + " ago";
		var difficulty = window.difficultyString(highscores[j].difficulty);
		var score = highscores[j].score;
		for (var i in categories) {
			var cat = categories[i];
			// 1st check if we match game mode
			if (gameMode != cat.gameMode) { continue; }

			// 2nd check if this matches the day
			var dStr = (new Date(time)).toUTCString();
			var dDayStr = dStr.substring(0,16);
			var nStr = (new Date()).toUTCString();
			var nDayStr = nStr.substring(0,16);

			if (cat.currentDay && dDayStr != nDayStr) { continue; }

			// 3rd check if this matches the hour
			var dHour = dStr.substring(17).split(":")[0];
			var nHour = nStr.substring(17).split(":")[0];

			if (cat.currentHour && dHour != nHour) { continue; }

			cat.place++;
			if (cat.count < 15) {
				if (highscores[j].uuid == this.uuid) {
					cat.tableStr += "<tr><td style='color: #0f0; '>"+cat.place+"</td><td style='color: #0f0; '>"+name+"</td><td style='color: #0f0;' class='dateCell'>"+date+"</td><td style='color: #0f0; '>"+score+"</td><td style='width: 80px; color: #0f0; '>"+difficulty+"</td></tr>";
					cat.shownMyScore = true;
					cat.count++;
				} else if (cat.count < 14 || (cat.shownMyScore || cat.gameMode != gameMode)) {
					cat.tableStr += "<tr><td>"+cat.place+"</td><td>"+name+"</td><td class='dateCell'>"+date+"</td><td>"+score+"</td><td>"+difficulty+"</td></tr>";
					cat.count++;
				}
			}
		}
	}

	for (var i in categories) {
		if (categories[i].count == 0) {
			categories[i].tableStr += "<tr><td>----</td><td>----</td><td>----</td><td>----</td><td style='width: 80px'>----</td></tr>";
		}
		$("#scoreTable-"+i).html(categories[i].tableStr);
	}
}
StarfighterApp.prototype.clearScoreboard = function() {
	for (var i in highscores) {
		actions.publish(prefix + "scores/" + highscores[i].uuid, "", true);
	}
	this.updateScoreboard();
}

StarfighterApp.prototype.connect = function() {
	this.subList = [];
	this.stats.inMessageCount = 0;
	this.stats.outMessageCount = 0;
	this.stats.inMessageRate = 0;
	this.stats.outMessageRate = 0;
	actions.connect(this.server, this.port, this.clientId, this.uuid);
}

StarfighterApp.prototype.onConnection = function() {
	actions.subscribe(prefix + "config/+", { onSuccess: function() { app.subList.push({ topic: prefix + "config/+", match: prefix + "config/[^\\/]*", count: 0 }); } });
	this.loadScores();
	actions.subscribe(prefix + "players/ship/0/#", { onSuccess: function() { app.subList.push({ topic: prefix + "players/ship/0/#", match: prefix + "players/ship/0/.*", count: 0 }); } });
	actions.subscribe(prefix + "players/event/0/#", { onSuccess: function() { app.subList.push({ topic: prefix + "players/event/0/#", match: prefix + "players/event/0/.*", count: 0 }); } });
	app.connected = true;
}

var highscores = [];
function getHighestScore() { 
	if (highscores != null && highscores.length >= 1) {
		for (var i in highscores) {
			if (highscores[i].gameMode == 0) {
				return highscores[i].score;
			}
		}
	}
	return 0;
}
function getHighestScoreName() { 
	if (highscores != null && highscores.length >= 1) {
		for (var i in highscores) {
			if (highscores[i].gameMode == 0) {
				return highscores[i].name;
			}
		}
	}
	return "";
}

StarfighterApp.prototype.processMessage = function(topic, payload) {
	app.stats.inMessageCount++;
	for (var i in app.subList) {
		if (topic.match(app.subList[i].match) != null) {
			app.subList[i].count++;
		}
	}
	if (topic.match(prefix + "config/gameSize") != null) {
		gameSize = payload;
		setWorldBounds(gameSize);
	} else if (topic.match(prefix + "scores") != null) {
		var data = JSON.parse(payload);
		highscores.push({
			uuid: topic.split("/")[2],
			name: data.name,
			gameMode: (data.gameMode ? data.gameMode : 1),
			score: parseFloat(data.score),
			difficulty: data.difficulty,
			time: data.time
		});
		//console.log("Score: ", data);
		highscores.sort(function(a, b) { return b.score-a.score; });
		$("#gamesPlayed").html(highscores.length);
		this.updateScoreboard();
		// https://m2mdemos.cloudant.com/starfighter/_all_docs
	} else if (topic.match(prefix + "players/ship/.*")) {
	//} else if (topic.match(prefix + "players/.*/ship") || topic.match(prefix + "players/ship/.*")) {
		var uuid = topic.split("/")[6];
		if (uuid == this.uuid || payload == "") { return; }
		//console.log(topic, payload);
		var data = JSON.parse(payload);
		var name = data.name;
		var worldPos = {
			x: parseFloat(data.worldPos.x),
			y: parseFloat(data.worldPos.y)
		};
		var velocity = {
			x: parseFloat(data.velocity.x),
			y: parseFloat(data.velocity.y)
		};
		var angle = parseFloat(data.angle);
		var shield = parseFloat(data.shield);
		if (!this.enemyShips[uuid]) { 
			this.enemyShips[uuid] = new Ship(uuid);
			this.enemyShips[uuid].type = "enemyShip";
			if (data.AI) { 
				this.enemyShips[uuid].type = "AI";
			}
		}
		if (!data.status) { data.status = "NORMAL"; }
		this.enemyShips[uuid].angle = angle;
		this.enemyShips[uuid].velocity = velocity;
		this.enemyShips[uuid].lastHitTime = data.lastHitTime;
		this.enemyShips[uuid].lastUpdate = (new Date()).getTime();
		this.enemyShips[uuid].shield = shield;
		this.enemyShips[uuid].status = data.status;
		this.enemyShips[uuid].worldPos = worldPos;
		this.enemyShips[uuid].name = name;
	} else if (topic.match(prefix + "players/event/.*") || topic.match(prefix + "players/bullet/.*")) {
		var uuid = topic.split("/")[6];
		if (uuid == this.uuid) { return; }
		var data = JSON.parse(payload);
		var action = data.action;
		if (action == "shoot") {
			console.log("enemy " + data.uuid + " is shooting!");
			this.enemyShips[data.uuid].shoot(data.bullets);
		}
		if (action == "destroyed") {
			console.log("enemy " + data.uuid + " is destroyed!");
			playSound("explosion");
			if (data.by && data.by == this.uuid) {
				//var bonus = 500;
				//if (data.bonus) { bonus = data.bonus; }
				//this.score += bonus;
				this.score += this.scoreForShipKill();
			}
			delete this.enemyShips[data.uuid];
		}
		if (action == "left") {
			console.log("enemy " + data.uuid + " left!");
			delete this.enemyShips[data.uuid];
		}
	}
}

StarfighterApp.prototype.doFrame = function() {
	frames++;
	this.update();
	this.draw();
}

StarfighterApp.prototype.createAsteroid = function(asteroidClass) {
	if (!asteroidClass) { asteroidClass = 3; }
	var bValid = false;
	var minDist = 200;
	var maxDist = ASTEROID_BOUNDS_LENGTH;
	while (!bValid) {
		var start_x = Math.random() * (WORLD_BOUNDS.x.max - WORLD_BOUNDS.x.min);
		var start_y = Math.random() * (WORLD_BOUNDS.y.max - WORLD_BOUNDS.y.min);
		var start_vx = Math.random() * 50 - 25;
		var start_vy = Math.random() * 50 - 25;
		if (Math.sqrt(
				Math.pow(this.ship.worldPos.x - start_x, 2) +
				Math.pow(this.ship.worldPos.y - start_y, 2)
			) > minDist &&
		    Math.sqrt(
				Math.pow(this.ship.worldPos.x - start_x, 2) +
				Math.pow(this.ship.worldPos.y - start_y, 2)
			) < maxDist) {
			bValid = true;
		}
	}
	var a = new Asteroid(start_x, start_y, start_vx, start_vy, asteroidClass);
	this.asteroids[a.id] = a;
	this.asteroidCount++;
}

StarfighterApp.prototype.update = function() {
	var now = (new Date()).getTime();
	var delta = (now - ((this.lastUpdate != null) ? this.lastUpdate : now)) / 1000;
	if (this.gameTimeRemaining) { this.gameTimeRemaining -= delta; }

	this.checkCollisions();
	this.checkDeletes();

	if (!this.gamePaused) {
		if (this.ship) {
			this.ship.update(delta);
		}
	}
	for (var i in this.enemyShips) {
		if (this.enemyShips[i].status == "NORMAL") {
			this.enemyShips[i].update(delta);
		}
	}
	for (var i in this.bullets) {
		this.bullets[i].update(delta);
	}
	for (var i in this.asteroids) {
		this.asteroids[i].update(delta);
	}

	this.lastUpdate = now;
}

function sqr(x) {
	return x * x;
}

function dist2(v, w) {
	return sqr(v.x - w.x) + sqr(v.y - w.y);
}

function distToSegmentSquared(p, v, w) {
	var l2 = dist2(v, w);
	if (l2 === 0) return dist2(p, v);
	var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
	if (t < 0) return dist2(p, v);
	if (t > 1) return dist2(p, w);
	return dist2(p, { x: v.x + t * (w.x - v.x),
		              y: v.y + t * (w.y - v.y) });
}

function distToSegment(p, v, w) {
	return Math.sqrt(distToSegmentSquared(p, v, w));
}

StarfighterApp.prototype.checkCollisions = function() {
	for (var j in this.asteroids) {
		var a = this.asteroids[j];
		for (var i in this.bullets) {
			var b = this.bullets[i];
			if (b.type == "enemyBullet") { continue; }
			if (b.type == "AIBullet") { continue; }

			var d = distToSegment(a.worldPos, b.lastPos, b.worldPos);

			/*
			var d = Math.sqrt(
				Math.pow(a.worldPos.x - b.worldPos.x, 2) +
				Math.pow(a.worldPos.y - b.worldPos.y, 2)
			);
			*/

			if (d < (a.radius + b.radius)) {
				a.wasHit = true;
				b.wasHit = true;
			}
		}

		if (this.ship && this.ship.visible && !this.gamePaused && !this.ship.invulnerable) {
			var s = this.ship;
			var d = Math.sqrt(
				Math.pow(a.worldPos.x - s.worldPos.x, 2) +
				Math.pow(a.worldPos.y - s.worldPos.y, 2)
			);

			if (d < (a.radius + s.radius)) {
				a.wasHit = true;
				s.damageToProcess += this.damageForAsteroidHit();
				var payload = JSON.stringify({
					uuid: s.uuid,
					action: "hit",
					damage: this.damageForAsteroidHit(),
					by: "asteroid"
				});
				playSound("hit");
				var topicBit = coordToBuckets(s.worldPos.x, s.worldPos.y, 4);
				actions.publish(prefix + "players/event/" + topicBit + "/" + s.uuid, payload);
				s.destroyedBy = null;
			}
		}
	}

	var now = (new Date()).getTime();
	for (var i in this.bullets) {
		var b = this.bullets[i];
		if (this.ship && this.ship.visible && !this.gamePaused) {

			var s = this.ship;
			var d = distToSegment(s.worldPos, b.lastPos, b.worldPos);

			if (d < (b.radius + s.radius) && b.ship.uuid != s.uuid) {
				b.wasHit = true;
				if (b.type == "enemyBullet" || b.type == "AIBullet") {
					s.damageToProcess += this.damageForEnemyBulletHit();
					var payload = JSON.stringify({
						uuid: s.uuid,
						action: "hit",
						damage: this.damageForEnemyBulletHit(),
						by: b.ship.uuid
					});
					playSound("hit");
					var topicBit = coordToBuckets(s.worldPos.x, s.worldPos.y, 4);
					actions.publish(prefix + "players/event/" + topicBit + "/" + s.uuid, payload);
				} else {
					var payload = JSON.stringify({
						uuid: s.uuid,
						action: "hit",
						damage: this.damageForBulletHit(),
						by: s.uuid
					});
					playSound("hit");
					var topicBit = coordToBuckets(s.worldPos.x, s.worldPos.y, 4);
					actions.publish(prefix + "players/event/" + topicBit + "/" + s.uuid, payload);
					s.damageToProcess += this.damageForBulletHit();
				}
				s.destroyedBy = b.ship.uuid;
			}
		}
		for (var i in this.enemyShips) {
			var s = this.enemyShips[i];
			if (s.status && s.status != "NORMAL") { continue; }
			var d = distToSegment(s.worldPos, b.lastPos, b.worldPos);

			if (d < (b.radius + s.radius) && b.ship.uuid != s.uuid) {
				b.wasHit = true;
				playSound("hit");
				// don't damage other enemy ships, let them damage themselves (only AI)
				if (s.type == "AI" && b.type == "bullet") {
					var payload = JSON.stringify({
						uuid: s.uuid,
						action: "hit",
						by: this.uuid,
						damage: 0.05
					});
					var topicBit = coordToBuckets(s.worldPos.x, s.worldPos.y, 4);
					actions.publish(prefix + "players/event/" + topicBit + "/" + s.uuid, payload);
				} 
			}
		}
	}
}

StarfighterApp.prototype.submitScore = function() {
	if (this.gameTimeRemaining) { this.gameTimeRemaining = null; }
	var scoreData = {
		uuid: this.uuid,
		name: this.name,
		score: this.score,
		gameMode: this.gameMode,
		difficulty: this.difficulty,
		time: (new Date()).getTime()
	};

	highscores.push(scoreData);
	highscores.sort(function(a, b) { return b.score-a.score; });
	window.app.updateScoreboard();

	$.ajax({
		type: "POST",
		url: "/newScore",
		data: scoreData,
		success: function(data) {
			console.log(data);
		}
	});
}

StarfighterApp.prototype.loadScores = function() {
	$.ajax({
		type: "GET",
		url: "/scores",
		success: function(data) {
			for (var i in data) {
				if (!data[i].gameMode) { data[i].gameMode = 1; } // default to standard play
				data[i].time = parseFloat(data[i].time);
				data[i].gameMode = parseFloat(data[i].gameMode);
				highscores.push(data[i]);
			}
			highscores.sort(function(a, b) { return b.score-a.score; });
			$("#gamesPlayed").html(highscores.length);
			window.app.updateScoreboard();
		},
	});
}

//https://m2mdemos.cloudant.com/starfighter/_all_docs?include_docs=true

StarfighterApp.prototype.checkDeletes = function() {
	if (this.ship && this.ship.needsDelete()) {
		this.submitScore();

		var destroyedData = { 
			uuid: this.uuid, 
			name: this.name, 
			action: "destroyed",
			bonus: 500
		}
		playSound("explosion");
		if (this.ship.destroyedBy && this.ship.destroyedBy != this.ship.uuid) { destroyedData.by = this.ship.destroyedBy; }
		var topicBit = coordToBuckets(this.ship.worldPos.x, this.ship.worldPos.y, 0);
		actions.publish(prefix + "players/event/" + topicBit + "/" + this.uuid, JSON.stringify(destroyedData), false);

		delete this.ship;

		if (window.isMobile && window.innerWidth < 500) {
			setTimeout(function() {
				document.location.reload();
			}, 3000);
		} else {
			$("#scoreboard").bPopup({
				onClose: function() { 
					document.location.reload();
				}
			});
		}
		return;
	}
	var toDelete = [];
	for (var i in this.bullets) {
		if (this.bullets[i].needsDelete()) {
			if (this.bullets[i].radius == 4) {
				toDelete.push(i);
			} else {
				this.bullets[i].radius = 4;
				this.bullets[i].wasHit = false;
			}
		}
	}
	for (var i in toDelete) {
		//console.log("deleting bullet " + toDelete[i]);
		delete this.bullets[toDelete[i]];
		this.bulletCount--;
	}

	toDelete = [];
	var bDeletedAsteroid = false;
	for (var i in this.asteroids) {
		if (this.asteroids[i].needsDelete()) {
			toDelete.push(i);
		}
	}
	if (toDelete.length > 0) {
		playSound("asteroid");
	}
	for (var i in toDelete) {
		console.log("deleting asteroid " + toDelete[i]);
		/* respawn asteroids */
		if (this.asteroids[toDelete[i]].asteroidClass == 3) {
			var start_x = this.asteroids[toDelete[i]].worldPos.x;
			var start_y = this.asteroids[toDelete[i]].worldPos.y;
			for (var j = 0; j < 4; j++) {
				var angle = Math.random() * Math.PI*2;
				var a = new Asteroid(start_x, start_y, 
						(Math.random() * 20 + 50 + 20 * this.difficulty) * Math.cos(angle), 
						(Math.random() * 20 + 50 + 20 * this.difficulty) * Math.sin(angle), 
						2);
				this.asteroids[a.id] = a;
				this.asteroidCount++;
			}

		} else if (this.asteroids[toDelete[i]].asteroidClass == 2) {
			var start_x = this.asteroids[toDelete[i]].worldPos.x;
			var start_y = this.asteroids[toDelete[i]].worldPos.y;
			for (var j = 0; j < 2; j++) {
				var angle = Math.random() * Math.PI*2;
				var a = new Asteroid(start_x, start_y, 
						(Math.random() * 20 + 90 + 40 * this.difficulty) * Math.cos(angle), 
						(Math.random() * 20 + 90 + 40 * this.difficulty) * Math.sin(angle), 
						1);
				this.asteroids[a.id] = a;
				this.asteroidCount++;
			}
		} else if (this.asteroids[toDelete[i]].asteroidClass == 1) {
			// do nothing
		}
		//this.score += this.asteroids[toDelete[i]].asteroidClass;
		this.score += this.scoreForAsteroidKill();
		if (this.asteroids[toDelete[i]].asteroidClass == 3) { 
			bDeletedAsteroid = true; 
		}
		delete this.asteroids[toDelete[i]];
		this.asteroidCount--;
	}

	if (bDeletedAsteroid) {
		this.bigAsteroidCount = 0;
		for (var i in this.asteroids) { 
			if (this.asteroids[i].asteroidClass == 3) { this.bigAsteroidCount++; }
		}
		if (this.bigAsteroidCount < getMaxAsteroidCount() && Math.random() > 0.9) {
			this.createAsteroid();
		}
	}
}

StarfighterApp.prototype.damageForAsteroidHit = function() {
	var bulletDmg = this.damageForEnemyBulletHit();
	if (this.difficulty == 0) { return bulletDmg / 4; }
	else { return (this.damageForEnemyBulletHit()); }
}
StarfighterApp.prototype.damageForBulletHit = function() {
	return (this.damageForEnemyBulletHit() / 4);
}
StarfighterApp.prototype.damageForEnemyBulletHit = function() {
	switch (this.difficulty) {
		case 0:
		default:
			return 0.02;
		case 1:
			return 0.03;
		case 2:
			return 0.05;
		case 3:
			return 0.09;
	}
}
StarfighterApp.prototype.scoreForAsteroidKill = function() {
	switch (this.difficulty) {
		case 0:
		default:
			return 1;
		case 1:
			return 2;
		case 2:
			return 3;
		case 3:
			return 5;
	}
}
StarfighterApp.prototype.scoreForShipKill = function() {
	switch (this.difficulty) {
		case 0:
		default:
			return 200;
		case 1:
			return 500;
		case 2:
			return 1000;
		case 3:
			return 2500;
	}
}

StarfighterApp.prototype.draw = function() {
		var time_s = (new Date()).getTime();
	var context = this.canvas.getContext("2d");
	var shade = Math.random() 
	context.save();
	context.fillStyle = "#111";
	//context.fillStyle = "#" + Math.random().toString(3).slice(2).substring(20,26);
	context.fillRect(0, 0, this.canvas.width, this.canvas.height);
	context.restore();

	for (var i = 0; i <= WORLD_BOUNDS.x.max; i += 100) {
		context.save();
		if (i == 0 || i == WORLD_BOUNDS.x.max) {
			var val = Math.sin(Math.PI * Math.abs((new Date()).getTime() % 5000 - 2500) / 2500);
			context.strokeStyle = "rgb("+(Math.floor(200+val*55))+",0,0)";
			context.lineWidth = 1 + (val * 3) * getDispScale();
		} else {
			context.strokeStyle = "#888";
			context.lineWidth = 1;
		}
		context.beginPath();
		context.moveTo(getDispX(i), getDispY(0));
		context.lineTo(getDispX(i), getDispY(WORLD_BOUNDS.y.max));
		context.closePath();
		context.stroke();
		context.restore();
	}
	for (var i = 0; i <= WORLD_BOUNDS.y.max; i += 100) {
		context.save();
		if (i == 0 || i == WORLD_BOUNDS.y.max) {
			var val = Math.sin(Math.PI * Math.abs((new Date()).getTime() % 5000 - 2500) / 2500);
			context.strokeStyle = "rgb("+(Math.floor(200+val*55))+",0,0)";
			context.lineWidth = 1 + (val * 3) * getDispScale();
		} else {
			context.strokeStyle = "#888";
			context.lineWidth = 1;
		}
		context.beginPath();
		context.moveTo(getDispX(0), getDispY(i));
		context.lineTo(getDispX(WORLD_BOUNDS.x.max), getDispY(i));
		context.closePath();
		context.stroke();
		context.restore();
	}

	if (this.ship && this.ship.visible) {
		this.ship.draw();
	}
	for (var i in this.asteroids) {
		this.asteroids[i].draw();
	}
	for (var i in this.enemyShips) {
		this.enemyShips[i].draw();
	}
	for (var i in this.bullets) {
		this.bullets[i].draw();
	}

	if (this.gamePaused) {
		context.save();
		context.lineWidth = 0;
		context.fillStyle = "rgba(0,0,255,0.1)";
		context.fillRect(0, 0, getViewportWidth(), getViewportHeight());
		context.strokeRect(x, y, w, h);
		context.restore();

		context.save();
		context.font = "56px HelveticaNeue-Light";
		context.textBaseline = "middle";
		context.textAlign = "middle";
		context.fillStyle = "#fff";
		var txt = "GAME PAUSED";
		context.fillText(txt, (getViewportWidth() - context.measureText(txt).width) / 2, getViewportHeight() / 2 + 80);
		context.restore();
	}

	if (window.isMobile) {
		if (this.ship.invulnerable) {
			context.save();
			context.font = "56px HelveticaNeue-Light";
			context.textBaseline = "middle";
			context.textAlign = "middle";
			context.fillStyle = "#fff";
			var txt = "Goto Starfighter";
			context.fillText(txt, (getViewportWidth() - context.measureText(txt).width) / 2, 60);
			context.restore();
		} else {
			if (this.gameTimeRemaining) {
				context.save();
				context.font = "48px HelveticaNeue-Light";
				context.textBaseline = "middle";
				context.textAlign = "middle";
				context.fillStyle = "#f00";
				var min = Math.floor(this.gameTimeRemaining / 60).toString();
				var sec = Math.floor(this.gameTimeRemaining % 60).toString();
				if (sec.length == 1) { sec = "0" + sec; }
				var txt = min + ":" + sec;
				context.fillText(txt, (getViewportWidth() - context.measureText(txt).width) / 2, 30);
				context.restore();
			}
		}
		context.save();
		context.font = "28px HelveticaNeue-Light";
		context.textBaseline = "middle";
		context.textAlign = "middle";
		context.fillStyle = "#fff";
		context.fillText("[ shields: " + ((this.ship == null) ? 0 : Math.floor(this.ship.shield * 1000) / 10) + "% ]", 20, getViewportHeight() - 80);
		context.fillText("[ score: " + this.score + " ]", 20, getViewportHeight() - 40);

		var players = 0;
		var ais = 0;
		for (var i in this.enemyShips) { 
			if (this.enemyShips[i].type == "AI") { ais++; } else { players++; }
		}
		if (this.ship && this.ship.visible) { players++; }

		var str = "[ players: ";
		context.textAlign = "right";
		context.font = "28px HelveticaNeue-Light";
		str += players + " ]";
		context.fillText(str, getViewportWidth() - 20, getViewportHeight() - 80);

		var str = "[ bots: ";
		context.textAlign = "right";
		context.font = "28px HelveticaNeue-Light";
		str += ais + " ]";
		context.fillText(str, getViewportWidth() - 20, getViewportHeight() - 40);
		context.restore();

		var alpha1 = 0.2;
		var alpha2 = 0.05;
		var up = (window.keys[37]) ? 2 : 1;
		var right = (window.keys[39]) ? 2 : 1;
		var left = (window.keys[38]) ? 2 : 1;
		var strafe_left = (window.keys[65]) ? 2 : 1;
		var strafe_right = (window.keys[68]) ? 2 : 1;

		context.save();
		context.strokeStyle = "rgba(0,255,0,"+alpha1*left+")";
		context.lineWidth = 4;
		context.fillStyle = "rgba(0,255,0,"+alpha2*left+")";
		var x = 0.32 * getViewportWidth();
		var y = 0.72 * getViewportHeight();
		var w = 0.36 * getViewportWidth();
		var h = 0.26 * getViewportHeight();
		context.fillRect(x, y, w, h);
		context.strokeRect(x, y, w, h);
		context.restore();

		context.save();
		context.strokeStyle = "rgba(0,255,0,"+alpha1*strafe_left+")";
		context.lineWidth = 4;
		context.fillStyle = "rgba(0,255,0,"+alpha2*strafe_left+")";
		var x = 0.02 * getViewportWidth();
		var y = 0.72 * getViewportHeight();
		var w = 0.26 * getViewportWidth();
		var h = 0.26 * getViewportHeight();
		context.fillRect(x, y, w, h);
		context.strokeRect(x, y, w, h);
		context.restore();

		context.save();
		context.strokeStyle = "rgba(0,255,0,"+alpha1*up+")";
		context.lineWidth = 4;
		context.fillStyle = "rgba(0,255,0,"+alpha2*up+")";
		var x = 0.02 * getViewportWidth();
		var y = 0.02 * getViewportHeight();
		var w = 0.26 * getViewportWidth();
		var h = 0.66 * getViewportHeight();
		context.fillRect(x, y, w, h);
		context.strokeRect(x, y, w, h);
		context.restore();

		context.save();
		context.strokeStyle = "rgba(0,255,0,"+alpha1*strafe_right+")";
		context.lineWidth = 4;
		context.fillStyle = "rgba(0,255,0,"+alpha2*strafe_right+")";
		var x = 0.72 * getViewportWidth();
		var y = 0.72 * getViewportHeight();
		var w = 0.36 * getViewportWidth();
		var h = 0.26 * getViewportHeight();
		context.fillRect(x, y, w, h);
		context.strokeRect(x, y, w, h);
		context.restore();

		context.save();
		context.strokeStyle = "rgba(0,255,0,"+alpha1*right+")";
		context.lineWidth = 4;
		context.fillStyle = "rgba(0,255,0,"+alpha2*right+")";
		var x = 0.72 * getViewportWidth();
		var y = 0.02 * getViewportHeight();
		var w = 0.26 * getViewportWidth();
		var h = 0.66 * getViewportHeight();
		context.fillRect(x, y, w, h);
		context.strokeRect(x, y, w, h);
		context.restore();

		context.save();
		context.font = "36px HelveticaNeue-Light";
		context.textBaseline = "middle";
		context.textAlign = "middle";
		context.fillStyle = "#fff";
		var txt = "TURN";
		context.fillText(txt, 0.15 * getViewportWidth() - (context.measureText(txt).width / 2), getViewportHeight() / 3);
		context.restore();

		context.save();
		context.font = "36px HelveticaNeue-Light";
		context.textBaseline = "middle";
		context.textAlign = "middle";
		context.fillStyle = "#fff";
		var txt = "TURN";
		context.fillText(txt, 0.85 * getViewportWidth() - (context.measureText(txt).width / 2), getViewportHeight() / 3);
		context.restore();

		context.save();
		context.font = "36px HelveticaNeue-Light";
		context.textBaseline = "middle";
		context.textAlign = "middle";
		context.fillStyle = "#fff";
		var txt = "THRUST";
		context.fillText(txt, 0.5 * getViewportWidth() - (context.measureText(txt).width / 2), 0.85 * getViewportHeight());
		context.restore();

		context.save();
		context.font = "36px HelveticaNeue-Light";
		context.textBaseline = "middle";
		context.textAlign = "middle";
		context.fillStyle = "#fff";
		var txt = "STRAFE";
		context.fillText(txt, 0.15 * getViewportWidth() - (context.measureText(txt).width / 2), 0.85 * getViewportHeight());
		context.restore();

		context.save();
		context.font = "36px HelveticaNeue-Light";
		context.textBaseline = "middle";
		context.textAlign = "middle";
		context.fillStyle = "#fff";
		var txt = "STRAFE";
		context.fillText(txt, 0.85 * getViewportWidth() - (context.measureText(txt).width / 2), 0.85 * getViewportHeight());
		context.restore();
	} else {
		context.save();
		context.font = "28px HelveticaNeue-Light";
		context.textBaseline = "middle";
		context.textAlign = "middle";
		context.fillStyle = "#fff";
		var txt = "Goto Starfighter";
		context.fillText(txt, (getViewportWidth() - context.measureText(txt).width) / 2, 30);
		context.restore();

		if (this.gameTimeRemaining) {
			context.save();
			context.font = "32px HelveticaNeue-Light";
			context.textBaseline = "middle";
			context.textAlign = "middle";
			context.fillStyle = "#f00";
			var min = Math.floor(this.gameTimeRemaining / 60).toString();
			var sec = Math.floor(this.gameTimeRemaining % 60).toString();
			if (sec.length == 1) { sec = "0" + sec; }
			var txt = min + ":" + sec;
			context.fillText(txt, (getViewportWidth() - context.measureText(txt).width) / 2, 65);
			context.restore();
		}

		context.save();
		context.font = "20px HelveticaNeue-Light";
		context.textBaseline = "middle";
		context.textAlign = "left";
		context.fillStyle = "#fff";
		context.fillText("Shield: " + ((this.ship == null) ? 0 : Math.floor(this.ship.shield * 1000) / 10) + "%", 25, getViewportHeight() - 90);
		context.fillText("Score:  " + this.score, 25, getViewportHeight() - 55);

		context.font = "14px HelveticaNeue-Light";
		var highScoreName = (this.score > getHighestScore()) ? this.name : getHighestScoreName();
		if (highScoreName != "") { highScoreName = "(" + highScoreName + ")"; }
		var highScoreTxt = "High:  " + Math.max(getHighestScore(), this.score) + "  " + highScoreName;
		context.fillText(highScoreTxt, 25, getViewportHeight() - 25);
		context.restore();

		context.save();
		context.font = "14px HelveticaNeue-Light";
		context.textBaseline = "middle";
		context.textAlign = "left";
		context.fillStyle = "#fff";
		context.fillText("up", getViewportWidth() - 180, getViewportHeight() - 200);
		context.fillText("a, d", getViewportWidth() - 180, getViewportHeight() - 180);
		context.fillText("left, right", getViewportWidth() - 180, getViewportHeight() - 160);
		context.fillText("space", getViewportWidth() - 180, getViewportHeight() - 140);
		context.fillText("s", getViewportWidth() - 180, getViewportHeight() - 120);
		if (this.gameMode != 0) { context.fillText("p", getViewportWidth() - 180, getViewportHeight() - 100); }

		context.fillText("thrust", getViewportWidth() - 60, getViewportHeight() - 200);
		context.fillText("strafe", getViewportWidth() - 60, getViewportHeight() - 180);
		context.fillText("turn", getViewportWidth() - 60, getViewportHeight() - 160);
		context.fillText("fire", getViewportWidth() - 60, getViewportHeight() - 140);
		context.fillText("debug", getViewportWidth() - 60, getViewportHeight() - 120);
		if (this.gameMode != 0) { context.fillText("pause", getViewportWidth() - 60, getViewportHeight() - 100); }

		context.fillText("Players", getViewportWidth() - 180, getViewportHeight() - 60);
		context.fillText("Bots", getViewportWidth() - 180, getViewportHeight() - 40);
		context.fillText("Asteroids", getViewportWidth() - 180, getViewportHeight() - 20);
		var players = 0;
		var ais = 0;
		for (var i in this.enemyShips) { 
			if (this.enemyShips[i].type == "AI") { ais++; } else { players++; }
		}
		if (this.ship && this.ship.visible) { players++; }

		context.font = "18px HelveticaNeue-Light";
		context.fillText(players, getViewportWidth() - 50, getViewportHeight() - 60);
		context.fillText(ais, getViewportWidth() - 50, getViewportHeight() - 40);
		context.fillText(this.bigAsteroidCount, getViewportWidth() - 50, getViewportHeight() - 20);
		context.restore();



		if (this.showDebugInfo) {
			context.save();
			context.font = "14px HelveticaNeue-Light";
			context.textBaseline = "middle";
			context.textAlign = "left";
			context.fillStyle = "#fff";
			if (this.subList.length > 0) {
				context.font = "18px HelveticaNeue-Light";
				context.fillText("Subscriptions", 20, 20);
				context.fillText("Msgs", 280, 20);
			}
			var y = 45;
			context.font = "14px HelveticaNeue-Light";
			//var list = this.subList.concat().sort(function(a, b) { return a.topic < b.topic; }).reverse();
			for (var i in this.subList) {
				context.fillText(this.subList[i].topic, 20, y);
				context.fillText(this.subList[i].count, 280, y);
				y += 18;
			}


			context.font = "18px HelveticaNeue-Light";
			context.fillText("FPS", getViewportWidth() - 140, 20);
			context.fillText("Rate (in)", getViewportWidth() - 140, 45);
			context.fillText("Rate (out)", getViewportWidth() - 140, 70);
			context.fillText(this.fps, getViewportWidth() - 50, 20);
			context.fillText(this.stats.inMessageRate, getViewportWidth() - 50, 45);
			context.fillText(this.stats.outMessageRate, getViewportWidth() - 50, 70);

			context.font = "14px HelveticaNeue-Light";
			context.fillText("Location:", getViewportWidth() - 140, 110);
			context.fillText("(" + Math.round(app.ship.worldPos.x) + ", " + Math.round(app.ship.worldPos.y) + ")", getViewportWidth() - 140, 130);

			context.restore();

		}
	}
	var time_e = (new Date()).getTime();
	//console.log("frame time: " + (time_e - time_s));
}

var lastInCount = 0;
var lastOutCount = 0;
var lastFrames = 0;
StarfighterApp.prototype.startMessageRateCalcInterval = function() {
	setInterval((function(self) {
		return function() {
			var inDelta = self.stats.inMessageCount - lastInCount;
			//console.log(inDelta);
			self.stats.inMessageRate = inDelta;
			lastInCount = self.stats.inMessageCount;

			var outDelta = self.stats.outMessageCount - lastOutCount;
			//console.log(outDelta);
			self.stats.outMessageRate = outDelta;
			lastOutCount = self.stats.outMessageCount;

			var frameDelta = frames - lastFrames;
			self.fps = frameDelta;
			lastFrames = frames;
			// check if we need to change subscriptions
		}
	})(this), 1000);
}


var publishIndex = 0;
StarfighterApp.prototype.startShipPublishInterval = function() {
	setInterval((function(self) {
		return function() {
			if (self.connected && self.ship && self.ship.visible) {
				var msg = JSON.stringify({
					uuid: self.uuid,
					time: (new Date()).getTime(),
					name: self.ship.name,
					type: self.ship.type,
					worldPos: {
						x: self.ship.worldPos.x.toFixed(1),
						y: self.ship.worldPos.y.toFixed(1)
					},
					lastHitTime: self.ship.lastHitTime,
					velocity: {
						x: self.ship.velocity.x.toFixed(1),
						y: self.ship.velocity.y.toFixed(1)
					},
					angle: self.ship.angle.toFixed(1),
					shield: self.ship.shield.toFixed(4),
					status: ((self.gamePaused ? "PAUSED" : "NORMAL")),
					score: self.score
				});

				for (var i = 0; i <= 4; i++) {
					if (publishIndex % (SHIP_PUBLISHES_PER_SECOND / Math.pow(2, i)) == 0) {
						var topicBit = coordToBuckets(self.ship.worldPos.x, self.ship.worldPos.y, i);
						var topic = prefix + "players/ship/" + topicBit + "/" + self.uuid;
						actions.publish(topic, msg, false);
					}
				}
				if (publishIndex % SHIP_PUBLISHES_PER_SECOND == 0) {
					self.changeSubscriptions(getBucketList(self.ship.worldPos.x, self.ship.worldPos.y, 4));
				}
			}
			publishIndex++;
		}
	})(this), 1000 / SHIP_PUBLISHES_PER_SECOND);
}

StarfighterApp.prototype.startAsteroidCreateInterval = function() {
	setInterval((function(self) {
		return function() {
			if (!(self.ship && self.ship.visible)) { return; }
			var count = 0;
			for (var i in self.asteroids) { 
				if (self.asteroids[i].asteroidClass == 3) { count++; }
			}
			var bCreate = false;
			if (self.score < 1000) {
				if (Math.random() < 0.2) { bCreate = true; }
			} else if (self.score < 2000) {
				if (Math.random() < 0.35) { bCreate = true; }
			} else if (self.score < 3000) {
				if (Math.random() < 0.43) { bCreate = true; }
			} else if (self.score < 5000) {
				if (Math.random() < 0.6) { bCreate = true; }
			} else {
				bCreate = true;
			}
			if (bCreate && count < getMaxAsteroidCount()) {
				self.createAsteroid();
			}
			if (self.ship.shield < 1) {
				self.ship.shield += Math.min(0.001 + Math.random() * 0.001, 1 - self.ship.shield);
			}
			self.moveAsteroids();
		}
	})(this), 1000);
}

StarfighterApp.prototype.startShipCleanupInterval = function() {
	setInterval((function(self) {
		return function() {
			var toDelete = [];
			var now = (new Date()).getTime();
			for (var i in self.enemyShips) {
				if (now - self.enemyShips[i].lastUpdate > 3000) {
					toDelete.push(i);
				}
			}
			for (var i in toDelete) {
				delete self.enemyShips[toDelete[i]];
			}
		}
	})(this), 3000);
}

















function ViewerApp() {
	//this.server = "messagesight.demos.ibm.com";
	this.server = "192.84.45.43";
	this.port = 1883;
	this.showDebugInfo = true;
	this.uuid = Math.random().toString(36).slice(2).substring(0,5);
	this.name = "Anonymous";
	this.clientId = "sf-"+this.uuid;
	this.canvas = $("canvas")[0];
	this.ship = null;
	this.enemyShips = {};
	this.bullets = [];
	this.bulletCount = 0;
	this.asteroids = {};
	this.asteroidCount = 0;
	this.followShips = true;
	this.following = null;
	this.stats = {};
	this.score = 0;
	this.difficulty = 0;
	this.bestScore = 0;
	this.bestName = "";
	centerWorldPos.x = WORLD_BOUNDS_LENGTH / 2;
	centerWorldPos.y = WORLD_BOUNDS_LENGTH / 2;
	centerWorldPos.zoom = 0.2;
	setTimeout(function() { app.connect(); }, 100);
}

ViewerApp.prototype.openNamePopup = function() {
	$("#loginSubmit").click(function(event) {
		app.nameEntered($("#uname").val());
		$("#enterName").fadeOut();
		app.ship.visible = true;
		app.ship.setInvulnerable(3000);
	});
	$("#enterName").bPopup({
		modalClose: false,
		escClose: false
	});
}

ViewerApp.prototype.nameEntered = function(name) {
	if (!this.ship) { return; }
	this.name = (name != "") ? name : this.name;
	this.ship.name = name;
}

ViewerApp.prototype.updateScoreboard = function() {
	
	var tableStr = "<tr><th>Name</th><th>Date</th><th>Score</th><th style='width:80px'>Difficulty</th></tr>";
	var count = 0;
	for (var i in highscores) {
		var name = highscores[i].name;
		var time = highscores[i].time;   // unix seconds
		var date = timeSince(new Date(time)) + " ago";
		var difficulty = window.difficultyString(highscores[i].difficulty);
		var score = highscores[i].score;
		if (highscores[i].uuid == this.uuid) {
			tableStr += "<tr><td style='color: #0f0; '>"+name+"</td><td style='color: #0f0;' class='dateCell'>"+date+"</td><td style='color: #0f0; '>"+score+"</td><td style='width: 80px; color: #0f0; '>"+difficulty+"</td></tr>";
		} else {
			tableStr += "<tr><td>"+name+"</td><td class='dateCell'>"+date+"</td><td>"+score+"</td><td width: 80px;>"+difficulty+"</td></tr>";
		}
		count++;
		if (count == 10) { break; }
	}

	$("#scoreTable").html(tableStr);
}
ViewerApp.prototype.clearScoreboard = function() {
	for (var i in highscores) {
		actions.publish(prefix + "scores/" + highscores[i].uuid, "", true);
	}
	this.updateScoreboard();
}

var msgs = 0;
ViewerApp.prototype.connect = function() {
	this.subList = [];
	this.stats.inMessageCount = 0;
	this.stats.outMessageCount = 0;
	this.stats.inMessageRate = 0;
	this.stats.outMessageRate = 0;
	actions.connect(this.server, this.port, this.clientId, this.uuid);
}

ViewerApp.prototype.changeSubscriptions = function(buckets) {
	//console.log(buckets);
	if (!this.bucketList) { this.bucketList = []; }

	var oldBucketList = this.bucketList;
	var newBucketList = buckets;
	
	var rmSubs = oldBucketList.filter(function( el ) {
		return newBucketList.indexOf( el ) < 0;
	});
	for (var i in rmSubs) {
		var topic = prefix + "players/+/"+rmSubs[i]+"/+";
		actions.unsubscribe(topic, 
			{ 
				onSuccess: (function(t, b) { return function() { 
					//console.log("unsubscribed from " + t); 
					var index = -1;
					for (var i in app.subList) {
						if (app.subList[i].topic == t) {
							index = i;
						}
					}
					if (index !== -1) {
						app.subList.splice(index, 1);
					}

					index = -1;
					for (var i in app.bucketList) {
						if (app.bucketList[i] == b) {
							index = i;
						}
					}
					if (index !== -1) {
						app.bucketList.splice(index, 1);
					}
				} })(topic, rmSubs[i])
			}
		);
	}

	if (newBucketList) {
		var addSubs = newBucketList.filter(function( el ) {
			return oldBucketList.indexOf( el ) < 0;
		});
		for (var i in addSubs) {
			var topic = prefix + "players/+/"+addSubs[i]+"/+";
			actions.subscribe(topic, 
				{ 
					onSuccess: (function(t, b) { return function() { 
						//console.log("subscribed to " + t); 
						var match = t.replace(/\+/g,"[^\\/]*");
						app.subList.push({ topic: t, match: match, count: 0 });
						app.bucketList.push(b);
					} })(topic, addSubs[i])
				}
			);
		}
	}
	this.bucketList = buckets;
}


ViewerApp.prototype.onConnection = function() {
	this.loadScores();
	actions.subscribe(prefix + "scores/+", { onSuccess: function() { app.subList.push({ topic: prefix + "scores/+", match: prefix + "scores/[^\\/]*", count: 0 }); } });
	actions.subscribe(prefix + "viewControl", { onSuccess: function() { app.subList.push({ topic: prefix + "viewControl/+", match: prefix + "viewControl/[^\\/]*", count: 0 }); } });
	actions.subscribe(prefix + "config/+", { onSuccess: function() { app.subList.push({ topic: prefix + "config/+", match: prefix + "config/[^\\/]*", count: 0 }); } });
	actions.subscribe(prefix + "players/ship/0/#", { onSuccess: function() { app.subList.push({ topic: prefix + "players/ship/0/#", match: prefix + "players/ship/0/.*", count: 0 }); } });
	actions.subscribe(prefix + "players/event/0/#", { onSuccess: function() { app.subList.push({ topic: prefix + "players/event/0/#", match: prefix + "players/event/0/.*", count: 0 }); } });
	actions.subscribe(prefix + "players/bullet/0/#", { onSuccess: function() { app.subList.push({ topic: prefix + "players/bullet/0/#", match: prefix + "players/bullet/0/.*", count: 0 }); } });
	app.connected = true;
}

ViewerApp.prototype.processMessage = function(topic, payload) {
	app.stats.inMessageCount++;
	for (var i in app.subList) {
		if (topic.match(app.subList[i].match) != null) {
			app.subList[i].count++;
		}
	}
	if (topic.match(prefix + "config/gameSize") != null) {
		gameSize = payload;
		setWorldBounds(gameSize);
		centerWorldPos.x = WORLD_BOUNDS_LENGTH / 2;
		centerWorldPos.y = WORLD_BOUNDS_LENGTH / 2;
	} else if (topic.match(prefix + "scores") != null) {
		var data = JSON.parse(payload);
		highscores.push({
			uuid: topic.split("/")[2],
			name: data.name,
			gameMode: (data.gameMode ? data.gameMode : 1),
			score: parseFloat(data.score),
			difficulty: data.difficulty,
			time: data.time
		});
		//console.log("Score: ", data);
		highscores.sort(function(a, b) { return b.score-a.score; });
		$("#gamesPlayed").html(highscores.length);
		this.updateScoreboard();
	} else if (topic.match(prefix + "viewControl") != null) {
		var data = payload;
		if (data == "up") {
			centerWorldPos.y -= 50 / centerWorldPos.zoom;
		}
		if (data == "left") {
			centerWorldPos.x -= 50 / centerWorldPos.zoom;
		}
		if (data == "down") {
			centerWorldPos.y += 50 / centerWorldPos.zoom;
		}
		if (data == "right") {
			centerWorldPos.x += 50 / centerWorldPos.zoom;
		}
		if (data == "in") {
			centerWorldPos.zoom *= 0.97;
			if (centerWorldPos.zoom < 0.025) { centerWorldPos.zoom = 0.025; }
		}
		if (data == "out") {
			centerWorldPos.zoom *= 1.03;
			if (centerWorldPos.zoom > 2) { centerWorldPos.zoom = 2; }
		}
	} else if (topic.match(prefix + "players/ship/.*")) {
	//} else if (topic.match(prefix + "players/.*/ship") || topic.match(prefix + "players/ship/.*")) {
		var uuid = topic.split("/")[6];
		if (uuid == this.uuid || payload == "") { return; }
		var data = JSON.parse(payload);
		var name = data.name;
		var worldPos = {
			x: parseFloat(data.worldPos.x),
			y: parseFloat(data.worldPos.y)
		};
		var velocity = {
			x: parseFloat(data.velocity.x),
			y: parseFloat(data.velocity.y)
		};
		var angle = parseFloat(data.angle);
		var shield = parseFloat(data.shield);
		var score = parseFloat((data.score) ? data.score : "0");
		if (!this.enemyShips[uuid]) { 
			this.enemyShips[uuid] = new Ship(uuid);
			this.enemyShips[uuid].type = "enemyShip";
			if (data.AI) { 
				this.enemyShips[uuid].type = "AI";
			}
		}
		if (!data.status) { data.status = "NORMAL"; }
		this.enemyShips[uuid].angle = angle;
		this.enemyShips[uuid].velocity = velocity;
		this.enemyShips[uuid].lastHitTime = data.lastHitTime;
		this.enemyShips[uuid].lastUpdate = (new Date()).getTime();
		this.enemyShips[uuid].shield = shield;
		this.enemyShips[uuid].score = score;
		this.enemyShips[uuid].status = data.status;
		this.enemyShips[uuid].worldPos = worldPos;
		this.enemyShips[uuid].name = name;
	} else if (topic.match(prefix + "players/event/.*") || topic.match(prefix + "players/bullet/.*")) {
		var bucket_zoom = topic.split("/")[3];
		var uuid = topic.split("/")[6];
		if (uuid == this.uuid) { return; }
		var data = JSON.parse(payload);
		var action = data.action;
		if (action == "shoot" && bucket_zoom == 0) {
			//console.log("enemy " + data.uuid + " is shooting!");
			if (this.enemyShips[data.uuid]) { this.enemyShips[data.uuid].shoot(data.bullets); }
		}
		if (action == "destroyed") {
			console.log("enemy " + data.uuid + " is destroyed!");
			if (data.by && data.by == this.uuid) {
				//var bonus = 500;
				//if (data.bonus) { bonus = data.bonus; }
				//this.score += bonus;
				this.score += this.scoreForShipKill();
			}
			delete this.enemyShips[data.uuid];
		}
		if (action == "left") {
			console.log("enemy " + data.uuid + " left!");
			delete this.enemyShips[data.uuid];
		}
	}
}

ViewerApp.prototype.loadScores = function() {
	$.ajax({
		type: "GET",
		url: "/scores",
		success: function(data) {
			for (var i in data) {
				if (!data[i].gameMode) { data[i].gameMode = 1; } // default to standard play
				data[i].time = parseFloat(data[i].time);
				data[i].gameMode = parseFloat(data[i].gameMode);
				highscores.push(data[i]);
			}
			highscores.sort(function(a, b) { return b.score-a.score; });
			$("#gamesPlayed").html(highscores.length);
			window.app.updateScoreboard();
		},
	});
}


ViewerApp.prototype.doFrame = function() {
	frames++;
	this.update();
	this.draw();
}

ViewerApp.prototype.update = function() {
	var now = (new Date()).getTime();
	var delta = (now - ((this.lastUpdate != null) ? this.lastUpdate : now)) / 1000;

	this.checkCollisions();
	this.checkDeletes();

	if (window.keys[37]) {
		centerWorldPos.x -= 5 / centerWorldPos.zoom;
	}
	if (window.keys[38]) {
		centerWorldPos.y -= 5 / centerWorldPos.zoom;
	}
	if (window.keys[39]) {
		centerWorldPos.x += 5 / centerWorldPos.zoom;
	}
	if (window.keys[40]) {
		centerWorldPos.y += 5 / centerWorldPos.zoom;
	}
	if (window.keys[75]) {
		centerWorldPos.zoom *= 0.99;
		if (centerWorldPos.zoom < 0.025) { centerWorldPos.zoom = 0.025; }
	}

	if (window.keys[73]) {
		centerWorldPos.zoom *= 1.01;
		if (centerWorldPos.zoom > 2) { centerWorldPos.zoom = 2; }
	}


	if (this.ship) {
		this.ship.update(delta);
	}
	for (var i in this.enemyShips) {
		this.enemyShips[i].update(delta);
	}
	for (var i in this.bullets) {
		this.bullets[i].update(delta);
	}
	for (var i in this.asteroids) {
		this.asteroids[i].update(delta);
	}

	this.lastUpdate = now;
}

ViewerApp.prototype.checkCollisions = function() {
	for (var j in this.asteroids) {
		var a = this.asteroids[j];
		for (var i in this.bullets) {
			var b = this.bullets[i];
			if (b.type == "enemyBullet") { continue; }
			if (b.type == "AIBullet") { continue; }

			var d = Math.sqrt(
				Math.pow(a.worldPos.x - b.worldPos.x, 2) +
				Math.pow(a.worldPos.y - b.worldPos.y, 2)
			);

			if (d < (a.radius + b.radius)) {
				a.wasHit = true;
				b.wasHit = true;
			}
		}

		if (this.ship && this.ship.visible && !this.ship.invulnerable) {
			var s = this.ship;
			var d = Math.sqrt(
				Math.pow(a.worldPos.x - s.worldPos.x, 2) +
				Math.pow(a.worldPos.y - s.worldPos.y, 2)
			);

			if (d < (a.radius + s.radius)) {
				a.wasHit = true;
				s.damageToProcess += this.damageForAsteroidHit();
				var payload = JSON.stringify({
					uuid: s.uuid,
					action: "hit",
					damage: this.damageForAsteroidHit(),
					by: "asteroid"
				});
				var topicBit = coordToBuckets(s.worldPos.x, s.worldPos.y, 0);
				actions.publish(prefix + "players/event/" + topicBit + "/" + s.uuid, payload);
				topicBit = coordToBuckets(s.worldPos.x, s.worldPos.y, 4);
				actions.publish(prefix + "players/event/" + topicBit + "/" + s.uuid, payload);
				s.destroyedBy = null;
			}
		}
	}

	var now = (new Date()).getTime();
	for (var i in this.bullets) {
		var b = this.bullets[i];
		if (now - b.createdAt < 50) { return; }
		if (this.ship && this.ship.visible) {
			var s = this.ship;
			var d = Math.sqrt(
				Math.pow(b.worldPos.x - s.worldPos.x, 2) +
				Math.pow(b.worldPos.y - s.worldPos.y, 2)
			);

			if (d < (b.radius + s.radius)) {
				b.wasHit = true;
				if (b.type == "enemyBullet" || b.type == "AIBullet") {
					s.damageToProcess += this.damageForEnemyBulletHit();
					var payload = JSON.stringify({
						uuid: s.uuid,
						action: "hit",
						damage: this.damageForEnemyBulletHit(),
						by: b.ship.uuid
					});
					var topicBit = coordToBuckets(s.worldPos.x, s.worldPos.y, 0);
					actions.publish(prefix + "players/event/" + topicBit + "/" + s.uuid, payload);
					topicBit = coordToBuckets(s.worldPos.x, s.worldPos.y, 4);
					actions.publish(prefix + "players/event/" + topicBit + "/" + s.uuid, payload);
				} else {
					var payload = JSON.stringify({
						uuid: s.uuid,
						action: "hit",
						damage: this.damageForBulletHit(),
						by: s.uuid
					});
					var topicBit = coordToBuckets(s.worldPos.x, s.worldPos.y, 0);
					actions.publish(prefix + "players/event/" + topicBit + "/" + s.uuid, payload);
					topicBit = coordToBuckets(s.worldPos.x, s.worldPos.y, 4);
					actions.publish(prefix + "players/event/" + topicBit + "/" + s.uuid, payload);
					s.damageToProcess += this.damageForBulletHit();
				}
				s.destroyedBy = b.ship.uuid;
			}
		}
		for (var i in this.enemyShips) {
			var s = this.enemyShips[i];
			var d = Math.sqrt(
				Math.pow(b.worldPos.x - s.worldPos.x, 2) +
				Math.pow(b.worldPos.y - s.worldPos.y, 2)
			);

			if (d < (b.radius + s.radius)) {
				b.wasHit = true;
				// don't damage other enemy ships, let them damage themselves (only AI)
				if (s.type == "AI" && b.type == "bullet") {
					var payload = JSON.stringify({
						uuid: s.uuid,
						action: "hit",
						by: this.uuid,
						damage: 0.05
					});
					var topicBit = coordToBuckets(s.worldPos.x, s.worldPos.y, 0);
					actions.publish(prefix + "players/event/" + topicBit + "/" + s.uuid, payload);
					topicBit = coordToBuckets(s.worldPos.x, s.worldPos.y, 4);
					actions.publish(prefix + "players/event/" + topicBit + "/" + s.uuid, payload);
				}
			}
		}
	}
}

ViewerApp.prototype.checkDeletes = function() {
	if (this.ship && this.ship.needsDelete()) {
		var scoreData = {
			uuid: this.uuid,
			name: this.name,
			score: this.score,
			difficulty: this.difficulty,
			time: (new Date()).getTime()
		};
		actions.publish(prefix + "scores/" + this.uuid, JSON.stringify(scoreData), true);

		var destroyedData = { 
			uuid: this.uuid, 
			name: this.name, 
			action: "destroyed",
			bonus: 500
		}
		if (this.ship.destroyedBy && this.ship.destroyedBy != this.ship.uuid) { destroyedData.by = this.ship.destroyedBy; }
		var topicBit = coordToBuckets(s.worldPos.x, s.worldPos.y, 0);
		actions.publish(prefix + "players/event/" + topicBit + "/" + this.uuid, JSON.stringify(destroyedData));

		delete this.ship;

		if (window.isMobile) {
			setTimeout(function() {
				document.location.reload();
			}, 3000);
		} else {
			$("#scoreboard").bPopup({
				onClose: function() { 
					document.location.reload();
				}
			});
		}
		return;
	}
	var toDelete = [];
	for (var i in this.bullets) {
		if (this.bullets[i].needsDelete()) {
			if (this.bullets[i].radius == 4) {
				toDelete.push(i);
			} else {
				this.bullets[i].radius = 4;
				this.bullets[i].wasHit = false;
			}
		}
	}
	for (var i in toDelete) {
		//console.log("deleting bullet " + toDelete[i]);
		delete this.bullets[toDelete[i]];
		this.bulletCount--;
	}

	toDelete = [];
	var bDeletedAsteroid = false;
	for (var i in this.asteroids) {
		if (this.asteroids[i].needsDelete()) {
			toDelete.push(i);
		}
	}
	for (var i in toDelete) {
		console.log("deleting asteroid " + toDelete[i]);
		/* respawn asteroids */
		if (this.asteroids[toDelete[i]].asteroidClass == 3) {
			var start_x = this.asteroids[toDelete[i]].worldPos.x;
			var start_y = this.asteroids[toDelete[i]].worldPos.y;
			for (var j = 0; j < 4; j++) {
				var angle = Math.random() * Math.PI*2;
				var a = new Asteroid(start_x, start_y, 
						(Math.random() * 20 + 50 + 20 * this.difficulty) * Math.cos(angle), 
						(Math.random() * 20 + 50 + 20 * this.difficulty) * Math.sin(angle), 
						2);
				this.asteroids[a.id] = a;
				this.asteroidCount++;
			}

		} else if (this.asteroids[toDelete[i]].asteroidClass == 2) {
			var start_x = this.asteroids[toDelete[i]].worldPos.x;
			var start_y = this.asteroids[toDelete[i]].worldPos.y;
			for (var j = 0; j < 2; j++) {
				var angle = Math.random() * Math.PI*2;
				var a = new Asteroid(start_x, start_y, 
						(Math.random() * 20 + 90 + 40 * this.difficulty) * Math.cos(angle), 
						(Math.random() * 20 + 90 + 40 * this.difficulty) * Math.sin(angle), 
						1);
				this.asteroids[a.id] = a;
				this.asteroidCount++;
			}
		} else if (this.asteroids[toDelete[i]].asteroidClass == 1) {
			// do nothing
		}
		//this.score += this.asteroids[toDelete[i]].asteroidClass;
		this.score += this.scoreForAsteroidKill();
		if (this.asteroids[toDelete[i]].asteroidClass == 3) { 
			bDeletedAsteroid = true; 
		}
		delete this.asteroids[toDelete[i]];
		this.asteroidCount--;
	}

}

ViewerApp.prototype.damageForAsteroidHit = function() {
	return 0.02 * Math.pow(2, this.difficulty);
}
ViewerApp.prototype.damageForBulletHit = function() {
	if (this.difficulty == 0) { return 0; }
	return 0.05 * Math.pow(2, this.difficulty);
}
ViewerApp.prototype.damageForEnemyBulletHit = function() {
	return 0.02 * Math.pow(2, this.difficulty);
}
ViewerApp.prototype.scoreForAsteroidKill = function() {
	return 2 * Math.pow(2, this.difficulty);
}
ViewerApp.prototype.scoreForShipKill = function() {
	return 200 * Math.pow(2, this.difficulty);
}

ViewerApp.prototype.draw = function() {
	var context = this.canvas.getContext("2d");
	var shade = Math.random() 
	context.save();
	context.fillStyle = "#111";
	//context.fillStyle = "#" + Math.random().toString(3).slice(2).substring(20,26);
	context.fillRect(0, 0, this.canvas.width, this.canvas.height);
	context.restore();

	var interval = WORLD_BOUNDS.x.max / 256;
	if (centerWorldPos.zoom <= 1.0) { interval = WORLD_BOUNDS.x.max / 128; }
	if (centerWorldPos.zoom <= 0.5) { interval = WORLD_BOUNDS.x.max / 64; }
	if (centerWorldPos.zoom <= 0.25) { interval = WORLD_BOUNDS.x.max / 32; }
	if (centerWorldPos.zoom <= 0.125) { interval = WORLD_BOUNDS.x.max / 16; }
	for (var i = 0; i <= WORLD_BOUNDS.x.max; i += interval) {
		context.save();
		if (i == 0 || i == WORLD_BOUNDS.x.max) {
			var val = Math.sin(Math.PI * Math.abs((new Date()).getTime() % 5000 - 2500) / 2500);
			context.strokeStyle = "rgb("+(Math.floor(200+val*55))+",0,0)";
			context.lineWidth = 1 + (val * 3) * getDispScale();
		} else {
			context.strokeStyle = "#888";
			context.lineWidth = 1;
		}
		context.beginPath();
		context.moveTo(getDispX(i), getDispY(0));
		context.lineTo(getDispX(i), getDispY(WORLD_BOUNDS.y.max));
		context.closePath();
		context.stroke();
		context.restore();
	}
	var interval = WORLD_BOUNDS.x.max / 256;
	if (centerWorldPos.zoom <= 1.0) { interval = WORLD_BOUNDS.x.max / 128; }
	if (centerWorldPos.zoom <= 0.5) { interval = WORLD_BOUNDS.x.max / 64; }
	if (centerWorldPos.zoom <= 0.25) { interval = WORLD_BOUNDS.x.max / 32; }
	if (centerWorldPos.zoom <= 0.125) { interval = WORLD_BOUNDS.x.max / 16; }
	for (var i = 0; i <= WORLD_BOUNDS.y.max; i += interval) {
		context.save();
		if (i == 0 || i == WORLD_BOUNDS.y.max) {
			var val = Math.sin(Math.PI * Math.abs((new Date()).getTime() % 5000 - 2500) / 2500);
			context.strokeStyle = "rgb("+(Math.floor(200+val*55))+",0,0)";
			context.lineWidth = 1 + (val * 3) * getDispScale();
		} else {
			context.strokeStyle = "#888";
			context.lineWidth = 1;
		}
		context.beginPath();
		context.moveTo(getDispX(0), getDispY(i));
		context.lineTo(getDispX(WORLD_BOUNDS.x.max), getDispY(i));
		context.closePath();
		context.stroke();
		context.restore();
	}

	if (this.ship && this.ship.visible) {
		this.ship.draw();
	}
	for (var i in this.asteroids) {
		var time_s = (new Date()).getTime();
		this.asteroids[i].draw();
		var time_e = (new Date()).getTime();
		console.log(time_e - time_s);
	}
	for (var i in this.enemyShips) {
		this.enemyShips[i].draw("viewer");
	}
	for (var i in this.bullets) {
		this.bullets[i].draw();
	}

	var txt = "Goto Starfighter";
	context.save();
	context.font = "28px HelveticaNeue-Light";
	context.strokeStyle = "#aaa";
	context.lineWidth = 2;
	context.fillStyle = "rgba(0,0,0,0.7)";
	context.strokeRect((getViewportWidth() - context.measureText(txt).width) / 2 - 20, 5, context.measureText(txt).width + 40, 50);
	context.fillRect((getViewportWidth() - context.measureText(txt).width) / 2 - 20, 5, context.measureText(txt).width + 40, 50);
	context.textBaseline = "middle";
	context.textAlign = "middle";
	context.fillStyle = "#fff";
	context.fillText(txt, (getViewportWidth() - context.measureText(txt).width) / 2, 30);
	context.restore();

	var arr = [];
	for (var i in this.enemyShips) {
		if (this.enemyShips[i].type == "AI") { continue; }
		var name = this.enemyShips[i].name;
		var score = this.enemyShips[i].score;
		arr.push({ name: name, score: score });
	}
	arr.sort(function(a, b) { return a.score < b.score; });

	var playerScoresY = 60;
	for (var i in arr) {
		playerScoresY += 25;
	}

	context.save();
	context.strokeStyle = "#aaa";
	context.lineWidth = 2;
	context.fillStyle = "rgba(0,0,0,0.7)";
	if (arr.length > 0) {
		context.strokeRect(30, 25, 255, playerScoresY);
		context.fillRect(30, 25, 255, playerScoresY);
	}
	context.restore();
	context.save();
	context.font = "28px HelveticaNeue-Light";
	context.textBaseline = "middle";
	context.textAlign = "left";
	context.fillStyle = "#fff";
	if (arr.length > 0) { context.fillText("Players", 105, 50); }
	var bestNameStr = (this.bestName != "") ? "("+this.bestName+")" : "";
	//context.fillText("Best Score:  " + this.bestScore + "  " + bestNameStr, 25, getViewportHeight() - 55);
	var highScoreName = (this.score > getHighestScore()) ? this.name : getHighestScoreName();
	if (highScoreName != "") { highScoreName = "(" + highScoreName + ")"; }
	context.fillText("Best Score:  " + Math.max(getHighestScore(), this.score) + "  " + highScoreName, 25, getViewportHeight() - 35);


	var y = 90;
	for (var i in arr) {
		var name = arr[i].name;
		var score = arr[i].score;
		context.save();
		context.font = "18px HelveticaNeue-Light";
		context.fillText(name, 50, y);
		context.textAlign = "right";
		context.fillText(score, 230, y);
		context.textAlign = "left";
		context.fillText("pts", 240, y);
		context.restore();
		y += 25;
		if (score > this.bestScore) { 
			this.bestScore = score;
			this.bestName = name;
		}
	}

	/*
	context.font = "14px HelveticaNeue-Light";
	var highScoreName = (this.score > getHighestScore()) ? this.name : getHighestScoreName();
	if (highScoreName != "") { highScoreName = "(" + highScoreName + ")"; }
	var highScoreTxt = "High:  " + Math.max(getHighestScore(), this.score) + "  " + highScoreName;
	context.fillText(highScoreTxt, 25, getViewportHeight() - 25);
	context.restore();
	*/

	context.save();
	context.font = "14px HelveticaNeue-Light";
	context.textBaseline = "middle";
	context.textAlign = "left";
	context.fillStyle = "#fff";
	context.fillText("'i' / 'k'", getViewportWidth() - 120, getViewportHeight() - 120);
	context.fillText("arrows", getViewportWidth() - 120, getViewportHeight() - 100);
	context.fillText("'s'", getViewportWidth() - 120, getViewportHeight() - 80);

	context.fillText("zoom", getViewportWidth() - 60, getViewportHeight() - 120);
	context.fillText("pan", getViewportWidth() - 60, getViewportHeight() - 100);
	context.fillText("debug", getViewportWidth() - 60, getViewportHeight() - 80);

	context.fillText("Players", getViewportWidth() - 120, getViewportHeight() - 40);
	context.fillText("Bots", getViewportWidth() - 120, getViewportHeight() - 20);
	var players = 0;
	var ais = 0;
	for (var i in this.enemyShips) { 
		if (this.enemyShips[i].type == "AI") { ais++; } else { players++; }
	}
	if (this.ship && this.ship.visible) { players++; }

	context.font = "18px HelveticaNeue-Light";
	context.fillText(players, getViewportWidth() - 50, getViewportHeight() - 40);
	context.fillText(ais, getViewportWidth() - 50, getViewportHeight() - 20);
	context.restore();

	if (this.showDebugInfo) {
		var startY = 40;
		var endY = startY + 145;
		for (var i in this.subList) {
			endY += 18;
		}
		endY += 20;


		context.save();
		context.strokeStyle = "#aaa";
		context.lineWidth = 2;
		context.fillStyle = "rgba(0,0,0,0.7)";
		context.strokeRect(getViewportWidth() - 320, startY - 20, 300, endY - startY);
		context.fillRect(getViewportWidth() - 320, startY - 20, 300, endY - startY);
		context.restore();

		context.save();
		context.font = "14px HelveticaNeue-Light";
		context.textBaseline = "middle";
		context.textAlign = "left";
		context.fillStyle = "#fff";
		if (this.subList.length > 0) {
			context.font = "18px HelveticaNeue-Light";
			context.fillText("Subscriptions", getViewportWidth() - 300, startY + 120);
			context.fillText("Msgs", getViewportWidth() - 80, startY + 120);
		}
		var y = startY + 145;
		context.font = "14px HelveticaNeue-Light";
		for (var i in this.subList) {
			context.fillText(this.subList[i].topic, getViewportWidth() - 300, y);
			context.fillText(this.subList[i].count, getViewportWidth() - 80, y);
			y += 18;
		}
		console.log(y);

		context.font = "18px HelveticaNeue-Light";
		context.fillText("FPS", getViewportWidth() - 300, startY);
		context.fillText("Rate (in)", getViewportWidth() - 300, startY + 25);
		context.fillText("Rate (out)", getViewportWidth() - 300, startY + 50);
		context.fillText(this.fps, getViewportWidth() - 80, startY);
		context.fillText(this.stats.inMessageRate, getViewportWidth() - 80, startY + 25);
		context.fillText(this.stats.outMessageRate, getViewportWidth() - 80, startY + 50);
		context.restore();
	}
}

ViewerApp.prototype.startShipPublishInterval = function() {
	setInterval((function(self) {
		return function() {
			if (self.connected && self.ship && self.ship.visible) {
				var topic = prefix + "players/"+self.uuid+"/ship";
				var msg = JSON.stringify({
					uuid: self.uuid,
					time: (new Date()).getTime(),
					name: self.ship.name,
					worldPos: {
						x: self.ship.worldPos.x.toFixed(1),
						y: self.ship.worldPos.y.toFixed(1)
					},
					lastHitTime: self.ship.lastHitTime,
					velocity: {
						x: self.ship.velocity.x.toFixed(1),
						y: self.ship.velocity.y.toFixed(1)
					},
					angle: self.ship.angle.toFixed(1),
					shield: self.ship.shield.toFixed(4)
				});
				actions.publish(topic, msg);
			}
		}
	})(this), 50);
}

ViewerApp.prototype.startMessageRateCalcInterval = function() {
	setInterval((function(self) {
		return function() {
			var inDelta = self.stats.inMessageCount - lastInCount;
			//console.log(inDelta);
			self.stats.inMessageRate = inDelta;
			lastInCount = self.stats.inMessageCount;

			var outDelta = self.stats.outMessageCount - lastOutCount;
			//console.log(outDelta);
			self.stats.outMessageRate = outDelta;
			lastOutCount = self.stats.outMessageCount;

			var frameDelta = frames - lastFrames;
			self.fps = frameDelta;
			lastFrames = frames;

			// check if we need to change subscriptions
			var viewable_x = getViewportWidth() / centerWorldPos.zoom;
			var viewable_y = getViewportHeight() / centerWorldPos.zoom;
			var max_viewable = Math.max(viewable_x, viewable_y);
			var bucket_zoom = 0;
			for (var z = 4; z >= 1; z--) {
				var bucket_size = WORLD_BOUNDS_LENGTH / Math.pow(2, z);
				if (max_viewable < 2 * bucket_size) {
					bucket_zoom = z;
					break;
				}
			}
			if (bucket_zoom == 0) {
				self.changeSubscriptions([]);
			} else {
				self.changeSubscriptions(getBucketList(centerWorldPos.x, centerWorldPos.y, bucket_zoom));
			}
		}
	})(this), 1000);
}

ViewerApp.prototype.startAsteroidCreateInterval = function() {
	setInterval((function(self) {
		return function() {
			if (!(self.ship && self.ship.visible)) { return; }
			var count = 0;
			for (var i in self.asteroids) { 
				if (self.asteroids[i].asteroidClass == 3) { count++; }
			}
			var bCreate = false;
			if (self.score < 1000) {
				if (Math.random() < 0.1) { bCreate = true; }
			} else if (self.score < 2000) {
				if (Math.random() < 0.25) { bCreate = true; }
			} else if (self.score < 3000) {
				if (Math.random() < 0.33) { bCreate = true; }
			} else if (self.score < 5000) {
				if (Math.random() < 0.5) { bCreate = true; }
			} else {
				bCreate = true;
			}
			if (bCreate && count < getMaxAsteroidCount()) {
				self.createAsteroid();
			}
			if (self.ship.shield < 1) {
				self.ship.shield += Math.min(0.001 + Math.random() * 0.001, 1 - self.ship.shield);
			}
		}
	})(this), 1000);
}

ViewerApp.prototype.startShipCleanupInterval = function() {
	setInterval((function(self) {
		return function() {
			var toDelete = [];
			var now = (new Date()).getTime();
			for (var i in self.enemyShips) {
				if (now - self.enemyShips[i].lastUpdate > 3000) {
					toDelete.push(i);
				}
			}
			for (var i in toDelete) {
				delete self.enemyShips[toDelete[i]];
			}
		}
	})(this), 3000);
}

function coordToBuckets(x, y, z) {
	var bucket_size = WORLD_BOUNDS_LENGTH / Math.pow(2, z);
	var bucket_x = Math.floor(x / bucket_size);
	var bucket_y = Math.floor(y / bucket_size);
	return z + "/" + bucket_x + "/" + bucket_y;
}

function getBucketList(x, y, z) {
	var neighbors = [];
	var maxBucket = Math.pow(2, z) - 1;
	var bucket_size = WORLD_BOUNDS_LENGTH / Math.pow(2, z);
	var bucket_x = Math.floor(x / bucket_size);
	var bucket_y = Math.floor(y / bucket_size);

	for (var i = -1; i <= 1; i++) {
		for (var j = -1; j <= 1; j++) {
			var nx = parseFloat(bucket_x) + i;
			var ny = parseFloat(bucket_y) + j;
			if (nx >= 0 && nx <= maxBucket && ny >= 0 && ny <= maxBucket) {
				neighbors.push(z + "/" + nx + "/" + ny);
			}
		}
	}
	return neighbors;
}
