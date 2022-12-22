# dvb-ble-manager

## Setup

To run this project, install it locally.

```
$ cd ../dir
$ npm install ble-manager
```

You can also install it globally

```
$ npm install ble-manager -g
```

## Usage

Require it into your project and initiate a class

```
const ble = require('dvb-ble-manager');
const connection = new ble();
```

## Methods

You can get the list of files, serial number and shortname of the device

```
const list_of_files = connection.getFileList();
const serial_number = connection.getSerialNumber();
const shortname = connection.getShortName();
```
