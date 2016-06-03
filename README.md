# homebridge-lightwaverf
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
          "manager_host": "lightwaverfhost.co.uk"
          "email": "name@host.com",
          "pin: "1234"
        }   
    ]

```

When you have a new lightwaverf link (+2016) you need to specify the devices yourself using the 
following syntac:

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
                    "deviceName": "MyLight",
                    "deviceType": "D"
                }
            ]
        }
]
```

The following devices are supported:
- Light: "deviceType": "L"
- Dimmeble Light: "deviceType": "D"
- Switch: "deviceType": "S"