var util = require('util');
var events = require('events');
var dgram = require('dgram');
var https = require('https');
var querystring = require('querystring');
var fs = require('fs');

/**
 * LightwaveRF API
 *
 * @param object config The config
 *
 * An instance of the LightwaveRF API
 */
function LightwaveRF(config,log,callback) {
    if (!(this instanceof LightwaveRF))  {
        return new LightwaveRF(config);
    }
    this.log = log;
    this.timeout = config.timeout || 1000;
    this.queue = [];
    this.ready = true;
    
    this.devices = [];//[{roomId:0,roomName:'',
    //deviceId:0,deviceName:'',
    //deviceType:''}];

	events.EventEmitter.call(this);
	
	//Counter
	this.messageCounter = 0;
	
	//Config
	this.config = config;
	
    if (this.config.file) {
        this.getFileConfiguration(this.config.file, callback);

    } else {
    	//Check config
        if(!this.config.host) {
            this.config.host = "web.trustsmartcloud.com"
        }
        if(!this.config.host_path) {
            this.config.host_path = "/manager/index.php";
        }
    	if (!this.config.ip) {
    		throw new Error("The IP address must be specified in the config");
    	}
        if(!this.config.email || !this.config.pin) {
            this.log("No email or pin specified. The server configuration (rooms, devices, etc.) cannot be obtained")
        }
        else {
            this.getConfiguration(this.config.email,this.config.pin,this.config.host,this.config.host_path,callback)
        }
    }
	
	//Response listeners
	this.responseListeners = {};
	
	//Send Socket
	this.sendSocket = dgram.createSocket("udp4");
	
	//Receive socket
	this.receiveSocket = dgram.createSocket("udp4");
    
    // On error
    this.receiveSocket.on("error", function(err) {
        this.log("server error:\n${err.stack}");
        this.receiveSocket.close();
    }.bind(this));
	
	//Receive message
	this.receiveSocket.on("message", function (message, rinfo) {
		//console.log(" -- Receiver socket got: " + message + " from " + rinfo.address + ":" + rinfo.port);
		
		//Check this came from the lightwave unit
		if (rinfo.address !== this.config.ip) {
			//Came from wrong ip
			return false;
		}
		
		//Message
		message = message.toString("utf8");
        
        // Skip json formats (these start with *!)
        if(message.startsWith("*!")) {
            return false;
        }
		
		//Split off the code for the message
		var parts = message.split(",");
		var code = parts.splice(0,1);
		var content = parts.join(",").replace(/(\r\n|\n|\r)/gm,"");
		
		//Check to see if we have a relevant listener
		var responseListenerData = this.responseListeners[parseInt(code, 10).toString()];
		if (responseListenerData) {
			//Call the response listener
			responseListenerData.listener(code,content);
			delete this.responseListeners[code.toString()];
		}
		
	}.bind(this));
	this.receiveSocket.on("listening", function () {
		var address = this.receiveSocket.address();
		this.log("Receiver socket listening " + address.address + ":" + address.port);
	}.bind(this));
	
	//Bind to the receive port
	this.receiveSocket.bind(9761);
}
util.inherits(LightwaveRF, events.EventEmitter);

/**
 * Register this device with the Wi-Fi Link
 * 
 * @param Function callback The callback function
 * 
 * @return void
 */
LightwaveRF.prototype.register = function(callback) {
	this.sendUdp("!R1Fa", callback);
}

/**
 * Request energy
 * 
 * @param Function callback The callback function
 * 
 * @return void
 */
LightwaveRF.prototype.requestEnergy = function(callback) {
	this.sendUdp("@?\0", function(error, content) {
		if (error) {
			//Send error back
			callback(error);
		} else {
			//Determine if this is the energy monitor
			//ID,?W=current,max,today,yesterday (all kwh)
			var values = content.substring(3).split(",");
			callback(undefined, {
				current:   parseInt(values[0], 10),
				max:       parseInt(values[1], 10), 
				today:     parseInt(values[2], 10),
				yesterday: parseInt(values[3], 10)
			});
		}
	});
}

LightwaveRF.prototype.close = function() {
    this.receiveSocket.close();
}

/**
 * Turn a device off
 * 
 * @param integer  roomId   The room ID
 * @param integer  deviceId The device ID
 * @param Function callback The callback for if there are any errors
 * 
 * @return void
 */
LightwaveRF.prototype.turnDeviceOff = function(roomId, deviceId, callback) {
	var state = "0";
	this.exec("!R" + roomId + "D" + deviceId, "F" + state + "|\0", callback);
}

/**
 * Turn a device on
 * 
 * @param integer  roomId   The room ID
 * @param integer  deviceId The device ID
 * @param Function callback The callback for if there are any errors
 * 
 * @return void
 */
LightwaveRF.prototype.turnDeviceOn = function(roomId, deviceId, callback) {
	var state = "1";
	this.exec("!R" + roomId + "D" + deviceId, "F" + state + "|\0", callback);
}

/**
 * Open a device
 *
 * @param integer  roomId   The room ID
 * @param integer  deviceId The device ID
 * @param Function callback The callback for if there are any errors
 *
 * @return void
 */
LightwaveRF.prototype.openDevice = function(roomId, deviceId, callback) {
    var state = ">";
    this.exec("!R" + roomId + "D" + deviceId, "F" + state + "|\0", callback);
}

/**
 * Close a device
 *
 * @param integer  roomId   The room ID
 * @param integer  deviceId The device ID
 * @param Function callback The callback for if there are any errors
 *
 * @return void
 */
LightwaveRF.prototype.closeDevice = function(roomId, deviceId, callback) {
    var state = "<";
    this.exec("!R" + roomId + "D" + deviceId, "F" + state + "|\0", callback);
}

/**
 * Stop a device
 *
 * @param integer  roomId   The room ID
 * @param integer  deviceId The device ID
 * @param Function callback The callback for if there are any errors
 *
 * @return void
 */
LightwaveRF.prototype.stopDevice = function(roomId, deviceId, callback) {
    var state = "^";
    this.exec("!R" + roomId + "D" + deviceId, "F" + state + "|\0", callback);
}

/**
 * Turn all devices in a room off
 * 
 * @param integer  roomId   The room ID
 * @param Function callback The callback for if there are any errors
 * 
 * @return void
 */
LightwaveRF.prototype.turnRoomOff = function(roomId, callback) {
	this.exec("!R" + roomId, "Fa\0", callback);
}

/**
 * Set the dim percentage of a device
 * 
 * @param integer  roomId        The room ID
 * @param integer  deviceId      The device ID
 * @param integer  dimPercentage The percentage to set the device dim
 * @param Function callback      The callback for if there are any errors
 * 
 * @return void
 */
LightwaveRF.prototype.setDeviceDim = function(roomId, deviceId, dimPercentage , callback) {
	var dimAmount = parseInt(dimPercentage * 0.32, 10); //Dim is on a scale from 0 to 32

    if (dimAmount === 0) {
        this.turnDeviceOff(roomId, deviceId, callback);
    } else {
        this.exec("!R" + roomId + "D" + deviceId, "FdP" + dimAmount + "|\0", callback);
    }
}

/**
 * Get message code
 * 
 * @return string
 */
LightwaveRF.prototype.getMessageCode = function() {
	//Increment message counter
	this.messageCounter++;
	
	//Get 3 digit code from counter
	var code = this.messageCounter.toString();
	while (code.length < 3) {
		code = "0" + code;
	}
	
	//Return the code
	return code;
}

LightwaveRF.prototype.send = function(rd, cmd, callback) {
    this.sendUdp(rd, cmd, callback);
    //if (callback) callback();
};

LightwaveRF.prototype.exec = function(rd, cmd, callback) {
    // Check if the queue has a reasonable size
    while(this.queue.length > 100) {
        this.queue.pop();
    }
        
    // Filter double enteries and only issue last command
    if(this.queue.findIndex(i => i[0] === rd && i[1] === cmd) < 0) {
        // only issue last command for a specific device
        for (i = this.queue.length - 1; i >= 0; --i) {
            if (this.queue[i][0] === rd) {
                this.log.debug("Found same device in queue: " + rd + " removing");
                
                if(this.queue[i][2]) this.queue[i][2]; // Execute callback
                this.queue.splice(i, 1); // remove item
            }
        }
        
        this.queue.push(arguments);
        setTimeout(this.process.bind(this),20);
    } else if(callback) callback();
    
};

/**
 * Send a message over udp
 * 
 * @param string   message  The message to send
 * @param Function callback The callback for if there are any errors
 * 
 * @return void
 */
LightwaveRF.prototype.sendUdp = function(rd, cmd, callback){
	//Add to message
	var code = this.getMessageCode();
	
	//Prepend code to message
	var message = code + "," + rd + cmd;
	
	this.log("Sending message: " + message);
	
	//Create buffer from message
	var buffer = Buffer.from(message);
	
	//Broadcast the message
	this.sendSocket.send(buffer, 0, buffer.length, 9760, this.config.ip);
	
	//Add listener
	if (callback) {
        if(Object.keys(this.responseListeners).length > 1) {
            this.log.warn("LightWaveRF does not seem to receive response from the link.");
            this.log.warn("Please check the link's IP address in the configuration AND if homebridge is registered on the link by viewing its screen after issuing a homekit command");
        }
        
        this.responseListeners[parseInt(code, 10).toString()] = {
			time: new Date().getTime(),
			listener: function(returnedCode, content) {
				callback(undefined);//, content);
			}
		}
	}
}

LightwaveRF.prototype.process = function() {
    if (this.queue.length === 0) return;
    if (!this.ready) return;
    var self = this;
    this.ready = false;
    this.send.apply(this, this.queue.shift());
    setTimeout(function () {
               self.ready = true;
               self.process();
               }, this.timeout);
};


/**
 * Parser to get de devices from https POST
 */
LightwaveRF.prototype.getDevices = function(roomsString,devicesString,typesString,callback){
    
    var nrRooms = 8;
    var nrDevicesPerRoom = 10;
    
    var tempRS = roomsString;
    var tempDS = devicesString;
    var tempTS = typesString;
    var deviceCounter = 0;
    for(var i=0;i<nrRooms;i++) {
        var rId = i+1;
        
        tempRS = tempRS.substring(tempRS.indexOf('\"')+1);
        var rName = tempRS.substring(0,tempRS.indexOf('\"'));
        tempRS = tempRS.substring(tempRS.indexOf('\"')+1);
        //this.log("room=" + rName);
        
        for(var j=0;j<nrDevicesPerRoom;j++) {
            var dId = j+1;
            
            tempDS = tempDS.substring(tempDS.indexOf('\"')+1);
            var dName = tempDS.substring(0,tempDS.indexOf('\"'));
            tempDS = tempDS.substring(tempDS.indexOf('\"')+1);
            //this.log("devices=" + dName);
            
            tempTS = tempTS.substring(tempTS.indexOf('\"')+1);
            var dType = tempTS.substring(0,tempTS.indexOf('\"'));
            tempTS = tempTS.substring(tempTS.indexOf('\"')+1);
            //this.log("devices=" + deviceName + " type=" + dType);
            
            // Get device types
            //   O: On/Off Switch
            //   D: Dimmer
            //   R: Radiator(s)
            //   P: Open/Close
            //   I: Inactive (i.e. not configured)
            //   m: Mood (inactive)
            //   M: Mood (active)
            //   o: All Off
            if(dType == "O" || dType == "D") {
                this.devices.push({roomId:rId,roomName:rName,
                                   deviceId:dId,deviceName:dName,
                                   deviceType:dType});
                //this.log("devices=" + deviceName + " type=" + deviceType);
                deviceCounter += 1;
            }
        }
    }
    
    if(callback) callback(this.devices, this);
    
    //this.log(this.devices);
}

/**
 * Connect to the server and obtain the configuration
 */
LightwaveRF.prototype.getConfiguration = function(email,pin,manager_host, manager_host_path,callback){
    
    if(manager_host === "control-api.lightwaverf.com") {
        this.getConfigurationV2(email, pin, manager_host, callback);
    } else {
        this.getConfigurationV1(email, pin, manager_host, manager_host_path, callback)
    }
}
        
        
LightwaveRF.prototype.getConfigurationV1 = function(email,pin,manager_host, manager_host_path,callback) {
    // An object of options to indicate where to post to
    var post_options = {
        //host: 'lightwaverfhost.co.uk',
        host: manager_host,//'web.trustsmartcloud.com',
        port: 443,
        path: manager_host_path,//'/manager/index.php',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        rejectUnauthorized:false
    };
    
    this.log("Using the following url to obtain configuration: https://" + manager_host + manager_host_path);
    
    // Build the post string from an object
    var post_data = 'pin=' + pin + '&email=' + email;
    
    // Set up the request
    var that = this;
    var post_req = https.request(post_options, function(res) {
     var body = '';
     res.setEncoding('utf8');
     res.on('data', function (chunk) {
            body += chunk;
            
            // Too much POST data, kill the connection!
            // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6) {
                that.log('Received too much data while tying to get configuration. Killing the connection');
                res.connection.destroy();
                if(callback) callback();
            }
            
            //that.log('Response: ' + chunk);
            });
     res.on('end', function () {
            var bodyString = body.toString();
            
            // Get rooms
            // Rooms - gRoomNames is a collection of 8 values, or room names
            var indexRoomsStart = bodyString.indexOf('gRoomNames');
            
            if(indexRoomsStart < 0) {
                that.log('gRoomNames not found');
                that.log(bodyString);
                if(callback) callback();
                return;
            }
            
            var roomsString = bodyString.substring(indexRoomsStart);
            var indexRoomsEnd = roomsString.indexOf(';');
            roomsString = roomsString.substring(0,indexRoomsEnd);
            
            //that.log(roomsString);
            
            // Get devices
            // Devices - gDeviceNames is a collection of 80 values, structured in blocks of ten values for each room:
            //   Devices 1 - 6, Mood 1 - 3, All Off
            var indexDevicesStart = bodyString.indexOf('gDeviceNames');
            
            if(indexDevicesStart < 0) {
                that.log('gDeviceNames not found');
                that.log(bodyString);
                if(callback) callback();
                return;
            }
            
            var devicesString = bodyString.substring(indexDevicesStart);
            var indexDevicesEnd = devicesString.indexOf(';');
            devicesString = devicesString.substring(0,indexDevicesEnd);
            
            //that.log(devicesString);
            
            // Get device types
            //   O: On/Off Switch
            //   D: Dimmer
            //   R: Radiator(s)
            //   P: Open/Close
            //   I: Inactive (i.e. not configured)
            //   m: Mood (inactive)
            //   M: Mood (active)
            //   o: All Off
            var indexTypesStart = bodyString.indexOf('gDeviceStatus');
            
            if(indexTypesStart < 0) {that.log('gDeviceStatus not found'); return;}
            
            var typesString = bodyString.substring(indexTypesStart);
            var indexTypesEnd = typesString.indexOf(';');
            typesString = typesString.substring(0,indexTypesEnd);
            
            //that.log(typesString);
            
            that.getDevices(roomsString,devicesString,typesString,callback);
            
            });
     });
    
    // post the data
    post_req.write(post_data);
    post_req.end();
}

/**
 * New lightwaveRF server methods
 */
LightwaveRF.prototype.getConfigurationV2 = function(user, pin, host, callback)
{
    var host_url = "https://" + host;//control-api.lightwaverf.com';
    this.log("getConfigurationV2 " + host_url);
    this.getApplicationKey(user, pin, host_url, callback);
}

/**
 * Connect to the server and obtain the application key
 */
LightwaveRF.prototype.getApplicationKey = function(user, pin, host, callback)
{
    this.log.debug('Getting Application Key from LightWave');
    
    https.get(host + '/v1/user?password=' + pin + '&username=' + user, function(res) {

        const { statusCode } = res;
        const contentType = res.headers['content-type'];

        let error;
        // Any 2xx status code signals a successful response but
        // here we're only checking for 200.
        if (statusCode !== 200) {
          error = "Request Failed.\nStatus Code: " + statusCode;
        } else if (!/^application\/json/.test(contentType)) {
          error = "Invalid content-type.\nExpected application/json but received " + contentType;
        }
        if (error) {
            this.log.error(error);
            // Consume response data to free up memory
            res.resume();
            if(callback) callback(error);
            return;
        }

        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(rawData);
            this.log.debug("getApplicationKey parsedData = ");
            this.log.debug(parsedData);
              
            this.application_key = parsedData.application_key;
            
            this.getToken(this.application_key, host, callback);
            
          } catch (e) {
              this.log.error(e);
              if(callback) callback(error);
          }
        });
    }.bind(this)).on('error', (e) => {
        this.log.error("Got error: " + e);
        if(callback) callback(error);
    });

}

/**
 * Connect to the server and obtain the token
 */
LightwaveRF.prototype.getToken = function(application_key, host, callback)
{
    this.log.debug('Getting token from LightWave');

    https.get(host + '/v1/auth?application_key=' + application_key, function (res) {

        const { statusCode } = res;
        const contentType = res.headers['content-type'];

        let error;
        // Any 2xx status code signals a successful response but
        // here we're only checking for 200.
        if (statusCode !== 200) {
          error = "Request Failed.\nStatus Code: " + statusCode;
        } else if (!/^application\/json/.test(contentType)) {
          error = "Invalid content-type.\nExpected application/json but received " + contentType;
        }
        if (error) {
            this.log.error(error);
            // Consume response data to free up memory
            res.resume();
            if(callback) callback(error);
            return;
        }

        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(rawData);
            this.log.debug("getToken parsedData = ");
            this.log.debug(parsedData);
              
            this.token = parsedData.token;
            
            this.getDeviceTypes(this.token, host, callback);
            
          } catch (e) {
            this.log.error(e);
            if(callback) callback(error);
          }
        });
    }.bind(this)).on('error', (e) => {
        this.log.error("Got error: " + e);
        if(callback) callback(error);
    });
}

/**
 * Connect to the server and obtain the device types
 */
LightwaveRF.prototype.getDeviceTypes = function(token, host, callback)
{
    this.log.debug('Getting device types from LightWave');

    var options = {
        headers: {
            'X-LWRF-token': token,
            'X-LWRF-platform': 'ios',
            'X-LWRF-skin': 'lightwaverf'
        }
    };

    https.get(host + '/v1/device_type?nested=1', options, function (res) {

        const { statusCode } = res;
        const contentType = res.headers['content-type'];

        let error;
        // Any 2xx status code signals a successful response but
        // here we're only checking for 200.
        if (statusCode !== 200) {
          error = "Request Failed.\nStatus Code: " + statusCode;
        } else if (!/^application\/json/.test(contentType)) {
          error = "Invalid content-type.\nExpected application/json but received " + contentType;
        }
        if (error) {
            this.log.error(error);
            // Consume response data to free up memory
            res.resume();
            if(callback) callback(error);
            return;
        }

        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(rawData);
            this.log.debug("getDeviceTypes parsedData = ");
            this.log.debug(parsedData);
              
            this.getUserProfile(this.token, host, callback);
            
          } catch (e) {
              this.log.error(e);
              if(callback) callback(error);
          }
        });
    }.bind(this)).on('error', (e) => {
        this.log.error("Got error: " + e);
        if(callback) callback(error);
    });
}

/**
 * Connect to the server and obtain the device types
 */
LightwaveRF.prototype.getUserProfile = function(token, host, callback)
{
    this.log.debug('Getting user profile from LightWave');

    var options = {
        headers: {
            'X-LWRF-token': token,
            'X-LWRF-platform': 'ios',
            'X-LWRF-skin': 'lightwaverf'
        }
    };

    https.get(host + '/v1/user_profile?nested=1', options, function (res) {

        const { statusCode } = res;
        const contentType = res.headers['content-type'];

        let error;
        // Any 2xx status code signals a successful response but
        // here we're only checking for 200.
        if (statusCode !== 200) {
          error = "Request Failed.\nStatus Code: " + statusCode;
        } else if (!/^application\/json/.test(contentType)) {
          error = "Invalid content-type.\nExpected application/json but received " + contentType;
        }
        if (error) {
          this.log.error(error);
          // Consume response data to free up memory
          res.resume();
          if(callback) callback(error);
          return;
        }

        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(rawData);
            this.log.debug("getUserProfile parsedData = ");
            this.log.debug(parsedData);
            
            this.parseRooms(parsedData, callback);
            
          } catch (e) {
              this.log.error(e);
              if(callback) callback(error);
          }
        });
    }.bind(this)).on('error', (e) => {
        this.log.error("Got error: " + e);
        if(callback) callback(error);
    });
}

/**
 * Parse the response
 */
LightwaveRF.prototype.parseRooms = function(lightwaveResponse, callback)
{
    if(!lightwaveResponse.content.estates) {
        this.log.warn("No estates found. Please create an estate for lightwaverf: " + lightwaveResponse.content);
        if(callback) callback(1);
    } else if(!lightwaveResponse.content.estates[0]) {
        this.log.warn("No estates[0] empty. Please create an estate for lightwaverf: " + lightwaveResponse.content);
        if(callback) callback(1);
    } else if(!lightwaveResponse.content.estates[0].locations) {
        this.log.warn("No locations found. Please create a location for lightwaverf: " + lightwaveResponse.content.estates[0]);
        if(callback) callback(1);
    } else if(!lightwaveResponse.content.estates[0].locations[0]) {
        this.log.warn("No estates[0].locations[0] empty. Please create a location for lightwaverf and assign rooms: " + lightwaveResponse.content.estates[0]);
        if(callback) callback(1);
    } else if(!lightwaveResponse.content.estates[0].locations[0].zones) {
        this.log.warn("No zones found. Please create a zone for lightwaverf: " + lightwaveResponse.content.estates[0].locations[0]);
        if(callback) callback(1);
    } else if(!lightwaveResponse.content.estates[0].locations[0].zones[0]) {
        this.log.warn("No estates[0].zones[0] empty. Please create a zone for lightwaverf and assign rooms: " + lightwaveResponse.content.estates[0].locations[0].zones[0]);
        if(callback) callback(1);
    } else if(!lightwaveResponse.content.estates[0].locations[0].zones[0].rooms) {
        this.log.warn("No rooms found. Please create a room for lightwaverf. And assign it to: " + lightwaveResponse.content.estates[0].locations[0].zones[0]);
        if(callback) callback(1);
    } else if(!lightwaveResponse.content.estates[0].locations[0].zones[0].rooms[0]) {
        this.log.warn("No estates[0].zones[0].rooms[0] empty. Please create a room for lightwaverf and assign it to: " + lightwaveResponse.content.estates[0].locations[0].zones[0]);
        if(callback) callback(1);
    }
    else {
    
      this.log.debug("Parsing lightwaveResponse: " + lightwaveResponse.content.estates[0].locations[0].zones[0].rooms[0].devices);

      var home = lightwaveResponse.content.estates[0].locations[0].zones[0];

      var rooms = [];
      for(var i=0; i < home.rooms.length; i++) {
        var r = home.rooms[i];
        var room = {
          name: r.name,
          number: r.room_number,
          status: r.name,
          active: r.active === 1,
          devices: []
        };

        rooms.push(room);

        this.log.debug("Room " + room.name + " with " + (r.devices ? r.devices.length : "0 ") + " devices");

        for (var j = 0; j < (r.devices ? r.devices.length: 0); j++) {
          var d = r.devices[j];

          var device = {
            name: d.name,
            status: d.name,
            number: d.device_number,
            active: d.active === 1,
            mood: false
          };

          this.log.debug("Adding device " + device)
          room.devices.push(device);
            
            // Get device types
            //   O: On/Off Switch
            //   D: Dimmer
            //   R: Radiator(s)
            //   P: Open/Close
            //   I: Inactive (i.e. not configured)
            //   m: Mood (inactive)
            //   M: Mood (active)
            //   o: All Off
            var dType = "";
            //if(d.active === 0) dType = "I"; // active does not seem valid
            if(d.device_type_id === 1) dType = "O";
            else if(d.device_type_id === 2) dType = "D";
            else if(d.device_type_id === 3) dType = "P";
            else if(d.device_type_id === 11) dType = "O";
            else if(d.device_type_id === 12) dType = "O";
            
            this.devices.push({roomId:r.room_number,roomName:r.name,
                               deviceId:d.device_number,deviceName:d.name,
                               deviceType:dType});

        }
      }

      this.log.debug('Rooms:' + rooms)

      if(callback) callback(this.devices, this);
    }
};

module.exports = LightwaveRF;
