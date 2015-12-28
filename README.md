# homebridge-lightwaverf
LightWaveRF plugin for homebridge: https://github.com/nfarina/homebridge

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
          "email": "name@host.com",
          "pin: "1234"
        }   
    ]

```

