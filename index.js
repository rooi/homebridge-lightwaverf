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
    
  this.devices = config["devices"];
    
  if(config["manager_host"]) this.host = config["manager_host"];
  
  this.log("LightWaveRF Platform Plugin Version " + this.getVersion());
  
    
}

function LightWaveRFAccessory(log, device, api) {
  this.roomId = device.roomId;
  this.deviceId = device.deviceId;
  this.name = device. roomName + " " + device.deviceName;
  this.device = device;
  this.isDimmer = (device.deviceType.indexOf('D') > -1);
  this.isLight = (device.deviceType.indexOf('L') > -1) || this.isDimmer;
  this.isSwitch = (device.deviceType.indexOf('S') > -1 || device.deviceType.indexOf('O') > -1);
  this.isGarageDoor = (device.deviceType.indexOf('G') > -1);
  this.isWindowCovering = (device.deviceType.indexOf('WC') > -1);
  this.status = 0; // 0 = off, else on / percentage
  this.previousPercentage = 0;
  this.previousBlindsPosition = 0;
  this.currentBlindsPosition = 0;
  this.api = api;
  this.log = log;
  this.timeOut = device.timeOut ? device.timeOut : 2;
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
      
      var foundAccessories = [];
        
      // use website
      if(that.email && that.pin) {
          
          var api = new lightwaverf({ip:that.ip_address,email:that.email,pin:that.pin,host:that.host}, function(devices) {
                                    
              // Add config for devices
              if(that.devices) {
                for(var i=0;i<that.devices.length;++i) {
                    var device = that.devices[i];
                    console.log("device = ");
                    console.log(device);
                    var accessory = new LightWaveRFAccessory(that.log, device, api);
                    foundAccessories.push(accessory);
                }
              }
          
              for(var i=0;i<devices.length;++i) {
                  var device = api.devices[i];
                  console.log("device = ");
                  console.log(device);
                  var accessory = new LightWaveRFAccessory(that.log, device, api);
                  foundAccessories.push(accessory);
              }
              callback(foundAccessories);
          }.bind(this));
      }
      else {
          // Use config for devices
          if(that.devices) {
              var api = new lightwaverf({ip:that.ip_address});
              
              for(var i=0;i<that.devices.length;++i) {
                  var device = that.devices[i];
                  console.log("device = ");
                  console.log(device);
                  var accessory = new LightWaveRFAccessory(that.log, device, api);
                  foundAccessories.push(accessory);
              }
              callback(foundAccessories);
          }
      }

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
      case 'door':
        return status;
      case 'blinds':
        return status;
      default:
        return null;
    }
  },
    
  // Create and set a light state
  executeChange: function(characteristic, value, callback, option) {
      
      console.log(characteristic);
      console.log(callback);
      console.log("value Eq opening: ", (value-this.previousBlindsPosition)/100);
      
      console.log("pv: ", this.previousBlindsPosition);
      console.log("v: ", value);
      console.log("opt: " ,option);
      
    switch(characteristic.toLowerCase()) {
      case 'identify':
        // Turn on twice to let the light blink
        this.api.turnDeviceOn(this.roomId,this.deviceId);
        
        var that = this;
        setTimeout(function () {
            that.api.turnDeviceOff(that.roomId,that.deviceId);
        }, 1000);
        setTimeout(function () {
            that.api.turnDeviceOn(that.roomId,that.deviceId);
        }, 2000);
        setTimeout(function () {
            that.api.turnDeviceOff(that.roomId,that.deviceId);
        }, 3000);
        if(callback) callback();
        break;
      case 'power':
        if (value > 0) {
            if(this.isDimmer) {
                if(this.previousPercentage < 3.125 ) this.previousPercentage = 100; // Prevent very low last states
                this.api.setDeviceDim(this.roomId,this.deviceId,this.previousPercentage,callback);
                //this.status = this.previousPercentage;
            } else {
                this.api.turnDeviceOn(this.roomId,this.deviceId,callback);
                this.status = 100;
            }
        }
        else {
          //this.previousPercentage = 0;
          this.api.turnDeviceOff(this.roomId,this.deviceId,callback);
          this.status = 0;
        }
        break;
      case 'brightness':
        this.previousPercentage = value;
        // Only write when change is larger than 5
        this.status = value;
        //if((value % 5) == 0) {
            if(value > 0 && this.lightbulbService && !this.lightbulbService.getCharacteristic(Characteristic.On)) {
                this.lightbulbService.getCharacteristic(Characteristic.On).setValue(true);
            }
            this.api.setDeviceDim(this.roomId,this.deviceId,value,callback);
        //} else {
        //    if(callback) callback();
        //}
        break;
        case 'door':
          if (value == Characteristic.TargetDoorState.CLOSED) {
            if(this.isGarageDoor) {
                this.api.closeDevice(this.roomId,this.deviceId,callback);
                this.status = value;
                
                if(this.openerService) this.openerService.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSING);
                
                setTimeout(() => {
                    if(this.openerService) this.openerService.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
                    this.api.stopDevice(this.roomId,this.deviceId);
                }, this.timeOut * 1000);
            }
            else if(callback) callback(1,0);
          }
          else {
            if(this.isGarageDoor) {
              this.api.openDevice(this.roomId,this.deviceId,callback);
              this.status = value;
                
              if(this.openerService) this.openerService.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPENING);
                
              setTimeout(() => {
                if(this.openerService) this.openerService.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPENING);
                this.api.stopDevice(this.roomId,this.deviceId);
              }, this.timeOut * 1000);
            }
            else if(callback) callback(1,0);
          }
          break;
        case 'blinds':
            if(1){
                //Command to open
                if (value <= this.previousBlindsPosition) {
                    console.log("Closing");
                    if(this.isWindowCovering){
                        this.api.closeDevice(this.roomId,this.deviceId,callback);
                        this.status = value;
                        
                        if(this.windowOpenerService) this.windowOpenerService.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.DECREASING);
                        setTimeout(() => {
                                   if(this.windowOpenerService){
                                    console.log("Closing time out");
                                       this.windowOpenerService.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);
                                       this.windowOpenerService.getCharacteristic(Characteristic.CurrentPosition).setValue(value);
                                   }
                                   console.log("Closing stopped");
                                   this.api.stopDevice(this.roomId,this.deviceId);
                                   this.previousBlindsPosition = value;
                                   }, this.timeOut * 1000* (this.previousBlindsPosition-value)/100); // full time out - state
                    }
                    else if(callback) callback(1,0);
                }
                else {
                    console.log("Opening");
                    if(this.isWindowCovering){
                        this.api.openDevice(this.roomId,this.deviceId,callback);
                        this.status = value;
                        if(this.windowOpenerService) this.windowOpenerService.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.INCREASING);
                        setTimeout(() => {
                                   if(this.windowOpenerService){
                                    console.log("Opening time out");
                                        this.windowOpenerService.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);
                                        this.windowOpenerService.getCharacteristic(Characteristic.CurrentPosition).setValue(value);
                                
                                   }
                                   console.log("Opening stoped");
                                   this.api.stopDevice(this.roomId,this.deviceId);
                                   this.previousBlindsPosition = value;
                                   }, this.timeOut * 1000 * (value-this.previousBlindsPosition)/100);
                    }
                    else if(callback) callback(1,0);
                }
            }
            else{
                //Checking Postion
                console.log("Check");
                this.windowOpenerService.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);
                //this.windowOpenerService.getCharacteristic(Characteristic.CurrentPosition).setValue(value);

                
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
        //this.log("Device " + that.device.name + " does not support reading characteristic " + characteristic);
        //  callback(Error("Device " + that.device.name + " does not support reading characteristic " + characteristic) );
        callback(1,0);
      }

      callback = null;
		
      //this.log("Get " + that.device.name + ", characteristic: " + characteristic + ", value: " + value + ".");
    }//.bind(this));
  },

  // Respond to identify request
  identify: function(callback) { 
  	this.executeChange("identify");
    callback();
  },

  // Get Services
  getServices: function() {
    var that = this;

    this.lightbulbService = 0;
    this.switchService = 0;
      
    if(this.isLight ) {
        // Use HomeKit types defined in HAP node JS
        var lightbulbService = new Service.Lightbulb(this.name);

        // Basic light controls, common to Hue and Hue lux
        lightbulbService
        .getCharacteristic(Characteristic.On)
        .on('get', function(callback) { that.getState("power", callback);})
        .on('set', function(value, callback) { that.executeChange("power", value, callback);})
        .value = this.extractValue("power", this.status);

        if(this.isDimmer) {
            lightbulbService
            .addCharacteristic(Characteristic.Brightness)
            .on('get', function(callback) { that.getState("brightness", callback);})
            .on('set', function(value, callback) { that.executeChange("brightness", value, callback);})
            .value = this.extractValue("brightness", this.status);
            lightbulbService.getCharacteristic(Characteristic.Brightness)
              .setProps({ minStep: 1 })
        }
        
        this.lightbulbService = lightbulbService;
    }
    else if(this.isSwitch) {
        // Use HomeKit types defined in HAP node JS
        var switchService = new Service.Switch(this.name);
        
        // Basic light controls, common to Hue and Hue lux
        switchService
        .getCharacteristic(Characteristic.On)
        .on('get', function(callback) { that.getState("power", callback);})
        .on('set', function(value, callback) { that.executeChange("power", value, callback);})
        .value = this.extractValue("power", this.status);
        
        this.switchService = switchService;
    }
    else if(this.isGarageDoor) {
        // Use HomeKit types defined in HAP node JS
        var openerService = new Service.GarageDoorOpener(this.name);
        
        // Basic light controls, common to Hue and Hue lux
        
        openerService
        .getCharacteristic(Characteristic.TargetDoorState)
        .on('get', function(callback) { that.getState("door", callback);})
        .on('set', function(value, callback) { that.executeChange("door", value, callback);})
        .value = this.extractValue("door", this.status);
        
        this.openerService = openerService;
         
    }
    else if(this.isWindowCovering) {
        // Use HomeKit types defined in HAP node JS
        var windowOpenerService = new Service.WindowCovering(this.name);
        
        // Basic light controls, common to Hue and Hue lux
        windowOpenerService
        .getCharacteristic(Characteristic.TargetPosition)
        .on('get', function(callback) { that.getState("blinds", callback);})
        .on('set', function(value, callback) { that.executeChange("blinds", value, callback, 0);})
        .value = this.extractValue("blinds", this.status);
        
        /*
        windowOpenerService
        .getCharacteristic(Characteristic.CurrentPosition)
        .on('get', function(callback) { that.getState("blinds", callback);})
        .on('set', function(value, callback) { that.executeChange("blinds", value, callback, 1);})
        .value = this.extractValue("blinds", this.status);
         */
        
        //windowOpenerService.getCharacteristic(Characteristic.PositionState.STOPPED)

    
        
        this.windowOpenerService = windowOpenerService;
    }

	var informationService = new Service.AccessoryInformation();

	informationService
		.setCharacteristic(Characteristic.Manufacturer, "LightWaveRF")
		.setCharacteristic(Characteristic.Model, "ICS-1000")
		.setCharacteristic(Characteristic.SerialNumber, "A1S2NASF88EW" + this.roomId + this.deviceId)//this.device.uniqueid)
		.addCharacteristic(Characteristic.FirmwareRevision, "0.0.1");

    if(this.lightbulbService) return [informationService, this.lightbulbService];
    else if(this.switchService) return [informationService, this.switchService];
    else if(this.openerService) return [informationService, this.openerService];
    else if(this.windowOpenerService) return [informationService, this.windowOpenerService];
    else return [informationService];
  }
};
