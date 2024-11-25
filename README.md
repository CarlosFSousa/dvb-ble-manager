# DVBDeviceBLE Library

A JavaScript library for interfacing with Bluetooth LE devices supporting DVB and MCU management services.

## Installation

```bash
npm install @capacitor-community/bluetooth-le cbor2
```

## Initialize class

```javascript
import DVBDeviceBLE from './DVBDeviceBLE';

// Initialize with custom logger (optional)
const device = new DVBDeviceBLE({
  logger: {
    info: console.log,
    error: console.error,
  },
});

// Setup event handlers
device
  .onConnecting(() => console.log('Connecting...'))
  .onConnect(() => console.log('Connected'))
  .onDisconnect(() => console.log('Disconnected'))
  .onMessage((message) => console.log('Message received:', message))
  .onImageUploadProgress((progress) =>
    console.log(`Upload progress: ${progress}%`)
  )
  .onImageUploadFinished(() => console.log('Upload complete'));

// Connect to device (with optional filters)
try {
  await device.connect([
    { name: 'MyDevice' }, // Filter by device name
    // Add more filters as needed
  ]);
} catch (error) {
  console.error('Connection failed:', error);
}
```

## Device Information

```javascript
// Get device info
await device.setDeviceInfo();

const info = {
  shortName: device.getShortName(),
  serialNumber: device.getSerialNumber(),
  firmwareVersion: device.getFirmwareVersion(),
  hardwareVersion: device.getHardwareVersion(),
};
```

## MCU Management

```javascript
// Basic commands
await device.cmdReset();
await device.smpEcho('test message');

// Image operations
await device.cmdImageState();
await device.cmdImageErase();

// Image upload with hash verification
const imageData = new Uint8Array([
  /* your image data */
]);
await device.cmdUpload(imageData);
const imageInfo = await device.imageInfo(imageData);
await device.cmdImageTest(imageInfo.hash);
await device.cmdImageConfirm(imageInfo.hash);
```

## Device Filtering Examples

```javascript
// Filter by device name
await device.connect([{ name: 'MyDevice' }]);

// Filter by prefix
await device.connect([{ namePrefix: 'DVB-' }]);

// Multiple filters
await device.connect([
  { name: 'MyDevice' },
  { namePrefix: 'DVB-' },
  { services: [device.DVB_SERVICE_UUID] },
]);
```

## Custom Error Logging

```javascript
const device = new DVBDeviceBLE({
  logger: {
    info: (msg) => console.log('[DVB]', msg),
    error: (msg) => console.error('[DVB]', msg),
  },
});
```

## Contributing

Carlos Fontes e Sousa
