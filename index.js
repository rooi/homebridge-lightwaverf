// LightWaveRF Platform Shim for HomeBridge
//
// Remember to add platform to config.json. Example:
// "platforms": [
//     {
//         "platform": "LightWaveRF",
//         "name": "LightWaveRF",
//         "ip_address": "192.168.1.123",
//         "email": "name@host.com",
//         "pin: "1234"
//     }
// ],
//
// If you do not know the IP address of your LightWaveRF ICS-1000, use an app like Fing to find it or
// check your router settings.
//
// When you attempt to add a device, it will ask for a "PIN code".
// The default code for all HomeBridge accessories is 031-45-154.
//

/* jslint node: true */
/* globals require: false */
/* globals config: false */

"use strict";

var lightwaverf = require("node-lightwaverf");

var Service, Characteristic;

module.exports = function(homebridge) {
 
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  
  homebridge.registerPlatform("homebridge-lightwaverf", "LightWaveRF", LightWaveRFPlatform);
}


function LightWaveRFPlatform(log, config) {
  this.log = log;
  this.ip_address = config["ip_address"];
  this.email = config["email"];
  
  this.log("LightWaveRF Platform Plugin Version " + this.getVersion());
  
    
}

function LightWaveRFAccessory(log, device, api) {
  this.roomId = device.roomId;
  this.deviceId = device.deviceId;
  this.name = device.deviceName;
  this.device = device;
  this.isDimmer = (device.deviceTyp == 'D');
  this.status = 0; // 0 = off, else on / percentage
  this.api = api;
  this.log = log;
}

LightWaveRFPlatform.prototype = {

  accessories: function(callback) {
    this.log("Fetching LightWaveRF switches and dimmers...");
    var that = this;
    var getLights = function () {
      var api = new lightwaverf(that.ip_address, that.email, that.pin);

      var foundAccessories = [];
      for(var i=0;i<api.devices.length;i++) {
          var device = api.devices[i];
          var accessory = new LightWaveRFAccessory(that.log, device, api);
          foundAccessories.push(accessory);
      }
        
      callback(foundAccessories);

      });
    };
  } ,
  
  getVersion: function() {
  var pjPath = path.join(__dirname, './package.json');
  var pj = JSON.parse(fs.readFileSync(pjPath));
  return pj.version;
}  
  
};

LightWaveRFAccessory.prototype = {
  extractValue: function(characteristic, status) {
    switch(characteristic.toLowerCase()) {
      case 'power':
        return status > 0 ? 1 : 0;
      case 'brightness':
        return status;
      default:
        return null;
    }
  },
    
  // Create and set a light state
  executeChange: function(characteristic, value, callback) {
    switch(characteristic.toLowerCase()) {
      case 'identify':
        // Turn on twice to let the light blink
        api.turnDeviceOn(this.roomId,this.deviceId,callback);
        api.turnDeviceOn(this.roomId,this.deviceId,callback);
        break;
      case 'power':
        if (value > 0) {
            if(this.isDimmer) {
                api.setDeviceDim(this.roomId,this.deviceId,value,callback);
            } else {
              api.turnDeviceOn(this.roomId,this.deviceId,callback);
            }
        }
        else {
          api.turnDeviceOff(this.roomId,this.deviceId,callback);
        }
        break;
      case 'brightness':
        api.setDeviceDim(this.roomId,this.deviceId,value,callback);
        break;
    }.bind(this));
  },


  // Read light state
  // TODO: implement clever polling/update and caching
  //       maybe a better NodeJS hue API exists for this
  getState: function(characteristic, callback) {
    if (callback == null) {
      return;
    }
      
    else {
      var newValue = this.extractValue(characteristic, status);
      if (newValue != undefined) {
        callback(null, newValue);
      } else {
        //  this.log("Device " + that.device.name + " does not support reading characteristic " + characteristic);
        //  callback(Error("Device " + that.device.name + " does not support reading characteristic " + characteristic) );
      }

      callback = null;
		
      //this.log("Get " + that.device.name + ", characteristic: " + characteristic + ", value: " + value + ".");
    }
  },

  // Respond to identify request
  identify: function(callback) { 
  	this.executeChange("identify", true, callback); 
  },

  // Get Services
  getServices: function() {
    var that = this;
    
    // Use HomeKit types defined in HAP node JS
	var lightbulbService = new Service.Lightbulb(this.name);

	// Basic light controls, common to Hue and Hue lux
	lightbulbService
	.getCharacteristic(Characteristic.On)
	.on('get', function(callback) { that.getState("power", callback);})
	.on('set', function(value, callback) { that.executeChange("power", value, callback);})
    .value = this.extractValue("power", this.device);

	lightbulbService
	.addCharacteristic(Characteristic.Brightness)
	.on('get', function(callback) { that.getState("brightness", callback);})
	.on('set', function(value, callback) { that.executeChange("brightness", value, callback);})
    .value = this.extractValue("brightness", this.device);

	var informationService = new Service.AccessoryInformation();

	informationService
		.setCharacteristic(Characteristic.Manufacturer, "LightWaveRF")
		.setCharacteristic(Characteristic.Model, this.model)
		.setCharacteristic(Characteristic.SerialNumber, this.device.uniqueid)
		.addCharacteristic(Characteristic.FirmwareRevision, this.device.swversion);

	return [informationService, lightbulbService];
  }
};