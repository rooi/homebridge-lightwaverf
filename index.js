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

var lightwaverf = require("lightwaverf");
var fs = require('fs');
var path = require('path');

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
  this.pin = config["pin"];
  this.host = "web.trustsmartcloud.com";
  if(config["manager_host"]) this.host = config["manager_host"];
  
  this.log("LightWaveRF Platform Plugin Version " + this.getVersion());
  
    
}

function LightWaveRFAccessory(log, device, api) {
  this.roomId = device.roomId;
  this.deviceId = device.deviceId;
  this.name = device. roomName + " " + device.deviceName;
  this.device = device;
  this.isDimmer = (device.deviceType.indexOf('D') > -1);
  this.status = 0; // 0 = off, else on / percentage
  this.previousPercentage = 0;
  this.api = api;
  this.log = log;
}

function onErr(err) {
    console.log(err);
    return 1;
}

LightWaveRFPlatform.prototype = {

  accessories: function(callback) {
    this.log("Fetching LightWaveRF switches and dimmers...");
    var that = this;
    var getLights = function () {
        
      if(!that.email) {
          // Get email
          var prompt = require('prompt');
          prompt.start();
          prompt.get(['email', 'pin'], function (err, result) {
            if (err) { return this.onErr(err); }
            console.log('Command-line input received:');
            that.email = result.email;
            that.pin = result.pin;
            //console.log('  Email: ' + result.email);
            //console.log('  Pin: ' + result.pin);
            });
      }
      
        if(!that.pin) {
            // Get email
            var prompt = require('prompt');
            prompt.start();
            prompt.get(['pin'], function (err, result) {
                       if (err) { return this.onErr(err); }
                       console.log('Command-line input received:');
                       that.pin = result.pin;
                       //console.log('  Pin: ' + result.pin);
                       });
        }
        
        var api = new lightwaverf({ip:that.ip_address,email:that.email,pin:that.pin,host:that.host}, function(devices) {
      
            var foundAccessories = [];
            for(var i=0;i<devices.length;++i) {
                var device = api.devices[i];
                var accessory = new LightWaveRFAccessory(that.log, device, api);
                foundAccessories.push(accessory);
            }
            callback(foundAccessories);
        });

    };
      
    getLights();
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
        if(value > 0) {
            var that = this;
            this.api.turnDeviceOn(this.roomId,this.deviceId);
            this.api.turnDeviceOn(this.roomId,this.deviceId);
            setTimeout(function () {
                that.api.turnDeviceOff(that.roomId,that.deviceId,callback);
            }, 2000);
        }
        else {
            if(callback) callback();
        }
        break;
      case 'power':
        if (value > 0) {
            if(this.isDimmer) {
                if(this.previousPercentage < 5 ) this.previousPercentage = 100; // Prevent very low last states
                this.api.setDeviceDim(this.roomId,this.deviceId,this.previousPercentage,callback);
                this.status = this.previousPercentage;
            } else {
                this.api.turnDeviceOn(this.roomId,this.deviceId,callback);
                this.status = 100;
            }
        }
        else {
          this.previousPercentage = this.status;
          this.api.turnDeviceOff(this.roomId,this.deviceId,callback);
          this.status = 0;
        }
        break;
      case 'brightness':
        this.previousPercentage = this.status;
        // Only write when change is larger than 5
        this.status = value;
        if((value % 5) == 0) {
            this.api.setDeviceDim(this.roomId,this.deviceId,value,callback);
        } else {
            if(callback) callback();
        }
            
        break;
    }//.bind(this));
  },


  // Read light state
  // TODO: implement clever polling/update and caching
  //       maybe a better NodeJS hue API exists for this
  getState: function(characteristic, callback) {
    if (callback == null) {
      return;
    }
      
    else {
      var newValue = this.extractValue(characteristic, this.status);
      if (newValue != undefined) {
        callback(null, newValue);
      } else {
        //  this.log("Device " + that.device.name + " does not support reading characteristic " + characteristic);
        //  callback(Error("Device " + that.device.name + " does not support reading characteristic " + characteristic) );
      }

      callback = null;
		
      //this.log("Get " + that.device.name + ", characteristic: " + characteristic + ", value: " + value + ".");
    }//.bind(this));
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
    .value = this.extractValue("power", this.status);

	lightbulbService
	.addCharacteristic(Characteristic.Brightness)
	.on('get', function(callback) { that.getState("brightness", callback);})
	.on('set', function(value, callback) { that.executeChange("brightness", value, callback);})
    .value = this.extractValue("brightness", this.status);
    lightbulbService.getCharacteristic(Characteristic.Brightness)
      .setProps({ minStep: 5 })

	var informationService = new Service.AccessoryInformation();

	informationService
		.setCharacteristic(Characteristic.Manufacturer, "LightWaveRF")
		.setCharacteristic(Characteristic.Model, "ICS-1000")
		.setCharacteristic(Characteristic.SerialNumber, "A1S2NASF88EW" + this.roomId + this.deviceId)//this.device.uniqueid)
		.addCharacteristic(Characteristic.FirmwareRevision, "0.0.1");

    return [informationService, lightbulbService];
  }
};
