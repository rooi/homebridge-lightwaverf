# homebridge-lightwaverf

LightWaveRF plugin for homebridge: https://github.com/nfarina/homebridge

Note: This plugin reads configuration from the KlikAanKlikUit ICS-1000, Lightwave Link or LightwaveRF Gem YAML file.

Set the correct `manager_host` or the `file` property in the configuration:
- web.trustsmartcloud.com
- lightwaverfhost.co.uk

# Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-lightwaverf`
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

Or, for a local LightwaveRF Gem YAML configuration:

```
"platforms": [
        {
          "platform": "LightWaveRF",
          "name": "LightWaveRF",
          "ip_address": "192.168.1.123",
          "file": "/a/config/file.yml"
        }
    ]
```
