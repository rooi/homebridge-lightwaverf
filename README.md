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

# Configuration

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

