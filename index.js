class DVBDeviceBLE {
  listOfFiles = [];
  shortname = null;
  device = null;
  service = null;
  serialNumber = null;
  SERVICE_UUID = 'dbd00001-ff30-40a5-9ceb-a17358d31999';
  LIST_FILES_UUID = 'dbd00010-ff30-40a5-9ceb-a17358d31999';
  GET_SHORTNAME_UUID = 'dbd00002-ff30-40a5-9ceb-a17358d31999';
  WRITE_TO_DEVICE_UUID = 'dbd00011-ff30-40a5-9ceb-a17358d31999';
  READ_FROM_DEVICE_UUID = 'dbd00012-ff30-40a5-9ceb-a17358d31999';
  FORMAT_STORAGE_UUID = 'dbd00013-ff30-40a5-9ceb-a17358d31999';
  async connect() {
    try {
      const params = {
        optionalServices: [this.SERVICE_UUID],
        filters: [{ name: 'DVBdiver' }],
      };
      this.device = await navigator.bluetooth.requestDevice(params);
      this.device.addEventListener('gattserverdisconnected', (event) => {
        console.log(event);
        this.disconnect();
      });
      const connection = await this.device.gatt.connect();
      this.service = await connection.getPrimaryService(this.SERVICE_UUID);
      console.log(`Connected to service ${this.SERVICE_UUID}`);
      await this.setShortName();
      await this.setFileList();
      // await this.setSerialNumber();
    } catch (error) {
      console.log(`Error: ${error}`);
      this.disconnect();
    }
  }
  disconnect() {
    console.log('Disconnected');
    this.device.gatt.disconnect();
    this.device = null;
    this.service = null;
    this.listOfFiles = [];
  }
  async getShortName() {
    return this.shortname;
  }
  async setShortName() {
    const characteristic = await this.service.getCharacteristic(
      this.GET_SHORTNAME_UUID
    );
    const value = await characteristic.readValue();
    const message = new Uint8Array(value.buffer);
    this.shortname = String.fromCharCode(...message);
  }
  getFileList() {
    return this.listOfFiles;
  }

  async setFileList() {
    while (true) {
      const characteristic = await this.service.getCharacteristic(
        this.LIST_FILES_UUID
      );
      const value = await characteristic.readValue();
      const message = new Uint8Array(value.buffer);
      if (message.byteLength === 0) return;
      const byteString = String.fromCharCode(...message);
      const split_string = byteString.split(';');
      const name = split_string[0];
      const length = split_string[1];
      this.listOfFiles.push({ name, length });
    }
  }
  async getFileContent(name) {
    const write_characteristic = await this.service.getCharacteristic(
      this.WRITE_TO_DEVICE_UUID
    );
    const read_characteristic = await this.service.getCharacteristic(
      this.READ_FROM_DEVICE_UUID
    );
    let hex_text = '';
    let offset = 0;
    const uf8encode = new TextEncoder();
    const name_bytes = uf8encode.encode(`${name};${offset};`);
    await write_characteristic.writeValue(name_bytes);
    while (true) {
      const display_info = await read_characteristic.readValue();
      if (display_info.byteLength !== 0) {
        offset += display_info.byteLength;
        console.log(`Appending length to offset: ${offset}`);
        const uf8encode = new TextEncoder();
        const name_bytes = uf8encode.encode(`${name};${offset};`);
        await write_characteristic.writeValue(name_bytes);
        const byteArray = [...new Uint8Array(display_info.buffer)]
          .map((x) => x.toString().padStart(2, '0'))
          .join('');
        hex_text += byteArray;
      } else {
        break;
      }
    }
    return hex_text;
  }
  async formatStorage() {
    const characteristic = await this.service.getCharacteristic(
      this.FORMAT_STORAGE_UUID
    );
    const uf8encode = new TextEncoder();
    const char = uf8encode.encode(`1`);
    await characteristic.writeValue(char);
    console.log('Files erased');
  }

  getSerialNumber() {
    console.log(`Serial Number: ${this.serialNumber}`);
    return this.serialNumber;
  }
  async setSerialNumber() {
    const characteristic = await this.service.getCharacteristic('2a25');
    const value = await characteristic.readValue();
    this.serialNumber = value;
  }
}

module.exports = DVBDeviceBLE;
