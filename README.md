# Project Name: Bluetooth LE Device Interaction

This project facilitates communication with Bluetooth Low Energy (BLE) devices, particularly focusing on interaction with a "DVBDeviceBLE" and an "MCUManager."

## Key Features:

* **DVBDeviceBLE**
    * Connects to BLE devices exposing a specific service (`DVB_SERVICE_UUID`).
    * Retrieves device information (short name, serial number, firmware version).
    * Lists files on the device.
    * Downloads file content with progress updates.
    * Supports formatting device storage.
    * Handles both mobile and web environments.

* **MCUManager**
    * Connects to BLE devices offering an MCU management service (`SERVICE_UUID`).
    * Sends and receives messages using the CBOR encoding format.
    * Supports device reset and echo commands.
    * Handles image management:
        * Queries image state.
        * Erases image.
        * Tests and confirms image with hash.
        * Uploads image data with progress tracking.

## Getting Started:

1. **Install dependencies:**

   ```bash
   npm install @capacitor-community/bluetooth-le cbor
