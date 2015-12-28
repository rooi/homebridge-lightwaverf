# homebridge-philipshue
PhilipsHue plugin for homebridge: https://github.com/nfarina/homebridge

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-philipshue
3. Update your configuration file. See the sample below.

# Configuration

Configuration sample:

 ```
"platforms": [
        {
          "platform": "PhilipsHue",
          "name": "Philips Hue",
          "ip_address": "127.0.0.1",
          "username": "252deadbeef0bf3f34c7ecb810e832f"
        }   
    ]

```

If you do not know the IP address of your Hue Bridge, simply leave it blank and your Bridge
will be discovered automatically.

If you do not have a "username" for your Hue API already, simply leave the field blank and
you will be prompted to press the link button on your Hue Bridge before running HomeBridge.
A username will be created for you and printed out, then the server will exit so you may
enter it in your config.json.
