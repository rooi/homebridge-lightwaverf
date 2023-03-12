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

var lightwaverf = require("./lib/lightwaverf.js");
var fs = require('fs');
var path = require('path');
var inherits = require('util').inherits;

var Service, Characteristic, BrightnessUpCharacteristic, BrightnessDownCharacteristic;

module.exports = function(homebridge) {
 
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
    
  BrightnessUpCharacteristic = function () {
    Characteristic.call(this, 'Up', '212131F4-2E14-4FF4-AE13-C97C4232499E');
    this.setProps({
        format: Characteristic.Formats.BOOL,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    //this.eventEnabled = true;
    this.value = this.getDefaultValue();
  };
  inherits(BrightnessUpCharacteristic, Characteristic);
    
  BrightnessDownCharacteristic = function () {
    Characteristic.call(this, 'Down', '212131F4-2E14-4FF4-AE13-C97C5232499E');
    this.setProps({
        format: Characteristic.Formats.BOOL,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    //this.eventEnabled = true;
    this.value = this.getDefaultValue();
  };
  inherits(BrightnessDownCharacteristic, Characteristic);
  
  homebridge.registerPlatform("homebridge-lightwaverf", "LightWaveRF", LightWaveRFPlatform);
}


function LightWaveRFPlatform(log, config) {
  this.log = log;
  this.ip_address = config["ip_address"];
    
  this.email = config["email"];
  this.pin = config["pin"];
    
  this.timeout = config["timeout"] || 1000;
    
  this.devices = config["devices"];
    
  this.api = null;
    
  this.host = config["manager_host"] || "web.trustsmartcloud.com";
  
  // the path of trustsmartcloud and lightwaverfhost differ
  var temp_host_path = "/manager/index.php";
  if(this.host == "lightwaverfhost.co.uk") temp_host_path = "/cocomanager/index.php";
  this.host_path = config["manager_host_path"] || temp_host_path;
  
  this.log("LightWaveRF Platform Plugin Version " + this.getVersion());
  
  // Prepare to kill pyshell
  process.on('SIGINT', () => { this.log("receive SIGINT. Closing"); if(this.api) this.api.close() })
  process.on('SIGTERM', () => { this.log("receive SIGTERM. Closing"); if(this.api) this.api.close() })
}

function LightWaveRFAccessory(log, device, api) {
  this.roomId = device.roomId;
  this.deviceId = device.deviceId;
  this.name = device. roomName + " " + device.deviceName;
  this.device = device;
  this.isDimmer = (device.deviceType.indexOf('D') > -1);
  this.isLight = (device.deviceType.indexOf('L') > -1) || this.isDimmer;
  this.isSwitch = (device.deviceType.indexOf('S') > -1);
  this.isOutlet = (device.deviceType.indexOf('O') > -1);
  this.isGarageDoor = (device.deviceType.indexOf('G') > -1);
  this.isWindowCovering = (device.deviceType.indexOf('WC') > -1);
  this.status = 0; // 0 = off, else on / percentage
  this.previousPercentage = 50;
  this.previousBlindsPosition = 0;
  this.currentBlindsPosition = 0;
  this.api = api;
  this.log = log;
  this.timeOut = device.timeOut ? device.timeOut : 2;
  this.brightness_step = 7;
}

function onErr(err) {
    this.log("Error: " + err);
    return 1;
}

LightWaveRFPlatform.prototype = {

  accessories: function(callback) {
    this.log("Fetching LightWaveRF switches and dimmers...");
    var that = this;

    var getLights = function () {
      
      var foundAccessories = [];
        
      // use website
      if(that.email && that.pin && that.pin != "") {
          
          var api = new lightwaverf({ip:that.ip_address,email:that.email,pin:that.pin,host:that.host,host_path:that.host_path,timeout:that.timeout}, that.log, function(devices) {
                                    
              // Add config for devices
              if(that.devices) {
                for(var i=0;i<that.devices.length;++i) {
                    var device = that.devices[i];
                    that.log("device = ");
                    that.log(device);
                    var accessory = new LightWaveRFAccessory(that.log, device, api);
                    foundAccessories.push(accessory);
                }
              }
              if(devices == null) {
                  that.log("Could not obtain LightWaveRF devices from the server. Using manual configuration");
              }
              else{
                  for(var i=0;i<devices.length;++i) {
                      var device = api.devices[i];
                      that.log("device = ");
                      that.log(device);
                                        
                      // check if the device was not specified already in the config
                      var deviceSpecifiedInConfig = false;
                      if(that.devices) {
                          for(var j=0;j<that.devices.length;++j) {
                              var deviceInConfig = that.devices[j];
                              if(device.roomId == deviceInConfig.roomId &&
                                 device.roomName === deviceInConfig.roomName &&
                                 device.deviceId == deviceInConfig.deviceId &&
                                 device.deviceName === deviceInConfig.deviceName) {
                                  that.log("Previous device was found in the config, it will not be added");
                                  deviceSpecifiedInConfig = true;
                              }
                          }
                      }
                                  
                      if(!deviceSpecifiedInConfig) {
                        var accessory = new LightWaveRFAccessory(that.log, device, api);
                        foundAccessories.push(accessory);
                      }
                  }
              }
              callback(foundAccessories);
          }.bind(this));
          
          that.api = api; // store for close()
      }
      else {
          // Use config for devices
          if(that.devices) {
              var api = new lightwaverf({ip:that.ip_address}, that.log);
              
              for(var i=0;i<that.devices.length;++i) {
                  var device = that.devices[i];
                  that.log("device = ");
                  that.log(device);
                  var accessory = new LightWaveRFAccessory(that.log, device, api);
                  foundAccessories.push(accessory);
              }
              that.api = api; // store for close()
          }
          callback(foundAccessories);
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
      
    this.log.debug("executeChange(" + characteristic + ", " + value + ")");
      
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
                if(this.previousPercentage < 3.125 ) {
                    this.previousPercentage = 0; // Prevent very low last states
                    this.api.turnDeviceOff(this.roomId,this.deviceId,callback);
                    this.status = 0;
                }
                else {
                    this.api.setDeviceDim(this.roomId,this.deviceId,this.previousPercentage,callback);
                    this.status = this.previousPercentage;
                }
            } else {
                if(this.deviceId < 0) {
                  this.api.turnRoomOff(this.roomId,callback);
                  this.status = 1;
                } else {
                  this.api.turnDeviceOn(this.roomId,this.deviceId,callback);
                  this.status = 1;
                }
            }
        }
        else {
          //this.previousPercentage = 0;
          if(this.deviceId < 0) {
            // do nothing
            if(callback) callback();
            this.status = 0;
          } else {
            this.api.turnDeviceOff(this.roomId,this.deviceId,callback);
            this.status = 0;
          }
        }
        break;
      case 'brightness':
        this.previousPercentage = value;
        // Only write when change is larger than 5
        this.status = value;
        //if((value % 5) == 0) {
            if(value > 0 && this.lightbulbService && !this.lightbulbService.getCharacteristic(Characteristic.On).getValue(null)) {
                this.lightbulbService.getCharacteristic(Characteristic.On).setValue(true);
            }
            this.api.setDeviceDim(this.roomId,this.deviceId,value,callback);
        //} else {
        //    if(callback) callback();
        //}
        break;
      case 'brightness_up':
        if(value == 0)
        {
            this.log("Resetting brightness up button");
            callback();
        }
//        else if(value > 0 && this.previousPercentage >= 100) {
//            this.log("Maximum brightness reached");
//            callback(); // limit the volume
//        }
        else {
            //this.log("Starting brightness " + this.previousPercentage);
            this.previousPercentage += this.brightness_step;
            if(this.previousPercentage > 100) this.previousPercentage = 100;
            this.log("Changing brightness " + this.previousPercentage);
            
            var targetChar = this.lightbulbService.getCharacteristic(BrightnessUpCharacteristic);
            var targetCharBrightness = this.lightbulbService.getCharacteristic(Characteristic.Brightness);
            //targetCharBrightness.getValue(null);
            setTimeout(function(){targetChar.setValue(0);}, 10);
            //this.api.setDeviceDim(this.roomId,this.deviceId,this.previousPercentage,callback);
            targetCharBrightness.setValue(this.previousPercentage, callback);
        }
        break;
      case 'brightness_down':
        if(value == 0)
        {
            this.log("Resetting brightness down button");
            callback();
        }
//      else if(value > 0 && this.previousPercentage >= 100) {
//          this.log("Maximum brightness reached");
//          callback(); // limit the volume
//      }
        else {
            //this.log("Starting brightness " + this.previousPercentage);
            this.previousPercentage -= this.brightness_step;
            if(this.previousPercentage < 0) this.previousPercentage = 0;
            this.log("Changing brightness " + this.previousPercentage);

            var targetChar = this.lightbulbService.getCharacteristic(BrightnessUpCharacteristic);
            var targetCharBrightness = this.lightbulbService.getCharacteristic(Characteristic.Brightness);
            //targetCharBrightness.getValue(null);
            setTimeout(function(){targetChar.setValue(0);}, 10);
            //this.api.setDeviceDim(this.roomId,this.deviceId,this.previousPercentage,callback);
            targetCharBrightness.setValue(this.previousPercentage, callback);
        }
        break;
      case 'door':
          if (value == Characteristic.TargetDoorState.CLOSED) {
            if(this.isGarageDoor) {
                // Is the garage triggered as automatic switch or as close/stop?
                if(this.isSwitch)
                    this.api.turnDeviceOff(this.roomId,this.deviceId, callback);
                else
                    this.api.closeDevice(this.roomId,this.deviceId,callback);
                this.status = value;
                
                if(this.openerService) this.openerService.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSING);
                
                setTimeout(() => {
                    if(this.openerService) this.openerService.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
                           
                    // Is the garage triggered as automatic switch or as close/stop?
                    if(!this.isSwitch)
                        this.api.stopDevice(this.roomId,this.deviceId);
                }, this.timeOut * 1000);
            }
            else if(callback) callback(1,0);
          }
          else {
            if(this.isGarageDoor) {
                // Is the garage triggered as automatic switch or as open/stop?
                if(this.isSwitch)
                    this.api.turnDeviceOn(this.roomId,this.deviceId, callback);
                else
                    this.api.openDevice(this.roomId,this.deviceId,callback);
                this.status = value;
                
                if(this.openerService) this.openerService.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPENING);
                
                setTimeout(() => {
                    if(this.openerService) this.openerService.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPEN);
                           
                    // Is the garage triggered as automatic switch or as open/stop?
                    if(!this.isSwitch)
                        this.api.stopDevice(this.roomId,this.deviceId);
              }, this.timeOut * 1000);
            }
            else if(callback) callback(1,0);
          }
          break;
        case 'blinds':
                //Command to open
                // TODO: Setting Blings position from the HomeHit App silder returns more than one value
                // this results in a very poor behaviour, blings start moving then stop then start again due to the time out
                // differnt approach is needed for next revision
                if (value < this.previousBlindsPosition) {
                    if(this.isWindowCovering){
                        this.api.closeDevice(this.roomId,this.deviceId,callback);
                        this.status = value;
                        
                        if(this.windowOpenerService) this.windowOpenerService.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.DECREASING);
                        setTimeout(() => {
                                   if(this.windowOpenerService){
                                       this.windowOpenerService.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);
                                       this.windowOpenerService.getCharacteristic(Characteristic.CurrentPosition).setValue(value);
                                   }
                                   this.api.stopDevice(this.roomId,this.deviceId);
                                   this.previousBlindsPosition = value;
                                   }, this.timeOut * 1000* (this.previousBlindsPosition-value)/100); // full time out - state
                    }
                    else if(callback) callback(1,0);
                }
                else if(value > this.previousBlindsPosition){
                    if(this.isWindowCovering){
                        this.api.openDevice(this.roomId,this.deviceId,callback);
                        this.status = value;
                        if(this.windowOpenerService) this.windowOpenerService.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.INCREASING);
                        setTimeout(() => {
                                   if(this.windowOpenerService){
                                        this.windowOpenerService.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);
                                        this.windowOpenerService.getCharacteristic(Characteristic.CurrentPosition).setValue(value);
                                
                                   }
                                   this.api.stopDevice(this.roomId,this.deviceId);
                                   this.previousBlindsPosition = value;
                                   }, this.timeOut * 1000 * (value-this.previousBlindsPosition)/100);
                    }
                    else if(callback) callback(1,0);
                }
                else{
                    if(this.isWindowCovering){
                        this.status = value;
                        this.previousBlindsPosition = value;
                        this.windowOpenerService.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);
                        this.windowOpenerService.getCharacteristic(Characteristic.CurrentPosition).setValue(value);
                        //FIXME: ideally I wouldnt be sending STOP but I didint work out how to send back info to HomeKit
                        // its somthing to do with callback
                        this.api.stopDevice(this.roomId,this.deviceId,callback);
                        
                    }
                    else if(callback) callback(1,0);
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
    this.outletService = 0;
      
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
            
            lightbulbService
            .addCharacteristic(BrightnessUpCharacteristic)
            .on('get', function(callback) { callback(null, 0);})
            .on('set', function(value, callback) { that.executeChange("brightness_up", value, callback);});
            
            lightbulbService
            .addCharacteristic(BrightnessDownCharacteristic)
            .on('get', function(callback) { callback(null, 0);})
            .on('set', function(value, callback) { that.executeChange("brightness_down", value, callback);});
        }
        
        this.lightbulbService = lightbulbService;
    }
    else if(this.isSwitch && !this.isGarageDoor) {
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
    else if(this.isOutlet) {
        // Use HomeKit types defined in HAP node JS
        var outletService = new Service.Outlet(this.name);
        
        // Basic light controls, common to Hue and Hue lux
        outletService
        .getCharacteristic(Characteristic.On)
        .on('get', function(callback) { that.getState("power", callback);})
        .on('set', function(value, callback) { that.executeChange("power", value, callback);})
        .value = this.extractValue("power", this.status);
        
        this.outletService = outletService;
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
    else if(this.outletService) return [informationService, this.outletService];
    else if(this.openerService) return [informationService, this.openerService];
    else if(this.windowOpenerService) return [informationService, this.windowOpenerService];
    else return [informationService];
  }
};
