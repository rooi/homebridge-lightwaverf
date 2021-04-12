# homebridge-lightwaverf
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![homebridge-lightwaverf](https://badgen.net/npm/v/homebridge-lightwaverf?icon=npm)](https://www.npmjs.com/package/homebridge-lightwaverf)
[![homebridge-lightwaverf](https://badgen.net/npm/dt/homebridge-lightwaverf?icon=npm)](https://www.npmjs.com/package/homebridge-lightwaverf)


LightWaveRF plugin for homebridge: https://github.com/nfarina/homebridge
Note: This plugin communicates with the KlikAanKlikUit ICS-1000 or Lightwave Link
Set the correct manager_host in the configuration:
- web.trustsmartcloud.com
- lightwaverfhost.co.uk

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-lightwaverf
3. Update your configuration file. See the sample below.
4. Start homebridge
5. Allow access on the lightwaverf link. Issue a command using homekit and press the botton on the link to grant access

# Configuration

There are two options to configure lightwaverf. When you have the 'old' lightwaverf link (pre 2016)
You can use the email, 4 digit pin and host to configure the plugin automatically using:
Configuration sample:

 ```
"platforms": [
        {
          "platform": "LightWaveRF",
          "name": "LightWaveRF",
          "ip_address": "192.168.1.123",
          "manager_host": "lightwaverfhost.co.uk",
          "email": "name@host.com",
          "pin": "1234",
          "timeout": 1000
        }   
    ]

```

When you have a new lightwaverf link (+2016) you need to specify the devices yourself using the 
following syntax:

 ```
"platforms": [
        {
            "platform" : "LightWaveRF",
            "name" : "LightWaveRF",
            "ip_address": "10.0.1.30",
            "devices": [
                {
                    "roomId": 1,
                    "roomName": "LivingRoom",
                    "deviceId": 1,
                    "deviceName": "MyLight",
                    "deviceType": "D"
                },
                {
                    "roomId": 1,
                    "roomName": "LivingRoom",
                    "deviceId": 2,
                    "deviceName": "MyLight2",
                    "deviceType": "D"
                },
                {
                    "roomId": 1,
                    "roomName": "LivingRoom",
                    "deviceId": 3,
                    "deviceName": "MyGarageDoor",
                    "deviceType": "G",
                    "timeOut": 10
                },
                {
                    "roomId": 1,
                    "roomName": "LivingRoom",
                    "deviceId": 3,
                    "deviceName": "MyBlinds",
                    "deviceType": "WC",
                    "timeOut": 15
                }
            ]
        }
]
```

The following devices are supported:
- Light: "deviceType": "L"
- Dimmeble Light: "deviceType": "D"
- Switch: "deviceType": "S"
- GarageDoor: "deviceType": "G"
- WindowCovering: "deviceType": "WC" 

# How to Determine Room Number:

Log in to Manager.LightwaveRF.com
View All Rooms
Select the room in question
Show Page Source
Search in Page Source for "All Off" -The Required value is in the data-room_number= attribute of that line

# How to Determine Device Number:

Log in to Manager.LightwaveRF.com
View All Rooms
Select the room in question
Device Number is usually the order in which the devices are listed, but this does not account for adding and removing devices. This may take some trial and error.

# How to Register your HomeBridge server on Lightwave Link:

For Mac OSX, (nix, or rPi - can anyone verify?) 
in a Terminal Window, run echo -ne '100,!F*p' | nc -u 192.168.yyy.xxx 9760 be sure to select the right IP address. 
Ctrl+C to close the Echo window 
For Windows PC

Download PacketSender - https://packetsender.com/
Send 100,!F*p. to the Lightwave Link on port 9760
When the Lightwave Link starts flashing, press the Link button
