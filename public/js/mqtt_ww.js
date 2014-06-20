// web worker stuff

importScripts("mqttws31_ww.js");

var client = null;

function sendDebug(msg) {
	sendMessage("debug", msg);
}

function sendMessage(type, data) {
	postMessage(JSON.stringify({type:type,data:data}));
}

function randomString(length) {
	var str = "";
	var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	var chars2 = "0123456789";
	for (var i = 0; i < length; i++) {
		if (i % 2 == 0) {
			str += chars[Math.floor(Math.random() * chars.length)];
		} else {
			str += chars2[Math.floor(Math.random() * chars2.length)];
		}
	}
	return str;
}

onmessage = function (e) {
	try {
		var msg = JSON.parse(e.data);
		//sendDebug(msg);
		if (msg.data != "") {
			actions[msg.type](JSON.parse(msg.data));
		} else {
			actions[msg.type]();
		}
	} catch (err) {
		sendDebug("bad data: " + e.data + " " + err.toString());
		sendDebug(err);
	}
}

var actions = {
	connect: function(params) {
		client = new Messaging.Client(params.server, parseFloat(params.port), "ww-"+params.clientId);
		client.onMessageArrived = function(msg) {
			sendMessage("onMessage", { destinationName: msg.destinationName, payloadString: msg.payloadString });
		}
		client.onConnectionLost = function() { 
			sendDebug("onConnectionLost");
		}

		var willMessage = new Messaging.Message(JSON.stringify({
			uuid: params.uuid,
			action: "left"
		}));
		willMessage.destinationName = params.prefix + "players/event/0/0/0/" + this.uuid;

		var connectOptions = new Object();
		connectOptions.keepAliveInterval = 3600;  // if no activity after one hour, disconnect
		connectOptions.userName = "starfighter";
		connectOptions.password = "starfighter";
		connectOptions.onSuccess = function() { 
			sendDebug("onSuccess");
			sendMessage("isConnected");
		}
		connectOptions.onFailure = function() { 
			sendDebug("onFailure");
		}
		connectOptions.willMessage = willMessage;

		client.connect(connectOptions);
		sendDebug("called connect");
	},
	subscribe: function(params) {
		client.subscribe(params.topic);
	},
	unsubscribe: function(params) {
		client.subscribe(params.topic);
	},
	publish: function(params) {
		var msgObj = new Messaging.Message(params.message);
		msgObj.destinationName = params.topic;
		if (params.retained) { msgObj.retained = true; }
		client.send(msgObj);
	}
}
