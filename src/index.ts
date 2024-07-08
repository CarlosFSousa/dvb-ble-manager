interface File {
  name: string;
  length: string;
}

export class DVBDeviceBLE {
  private listOfFiles: File[] = [];
  private shortname: string | Uint8Array = "";
  private device: BluetoothDevice | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private serialNumber: string | null = null;
  private readonly DIS_SERVICE_ID = 'device_information';
  private readonly SERIAL_NUMBER_UUID = 'dbd00003-ff30-40a5-9ceb-a17358d31999';
  private readonly DVB_SERVICE_UUID = 'dbd00001-ff30-40a5-9ceb-a17358d31999';
  private readonly LIST_FILES_UUID = 'dbd00010-ff30-40a5-9ceb-a17358d31999';
  private readonly SHORTNAME_UUID = 'dbd00002-ff30-40a5-9ceb-a17358d31999';
  private readonly WRITE_TO_DEVICE_UUID = 'dbd00011-ff30-40a5-9ceb-a17358d31999';
  private readonly READ_FROM_DEVICE_UUID = 'dbd00012-ff30-40a5-9ceb-a17358d31999';
  private readonly FORMAT_STORAGE_UUID = 'dbd00013-ff30-40a5-9ceb-a17358d31999';

  // Starts searching for devices and connects to device information and dvb services
  async connect(): Promise<void> {
    if (!navigator.bluetooth) {
      console.error("Web Bluetooth API is not available in this browser");
      return;
    }
    try {
      const params: RequestDeviceOptions = {
        optionalServices: [this.DVB_SERVICE_UUID, this.DIS_SERVICE_ID],
        filters: [{ name: 'DVBdiver' }],
      };
      this.device = await navigator.bluetooth.requestDevice(params);
      this.device.addEventListener('gattserverdisconnected', (event: Event) => {
        console.log(event);
        this.disconnect();
      });
      const connection = await this.device.gatt!.connect();
      this.service = await connection.getPrimaryService(this.DVB_SERVICE_UUID);
      console.log(`Connected to service ${this.DVB_SERVICE_UUID}`);
      await this.setShortName();
      await this.setSerialNumber();
      await this.setFileList();
    } catch (error) {
      console.log(error);
      this.disconnect();
    }
  }

  // Disconnects device and sets everything to null or empty array
  private disconnect(): void {
    console.log('Disconnected');
    this.device?.gatt?.disconnect();
    this.device = null;
    this.service = null;
    this.serialNumber = null;
    this.listOfFiles = [];
  }

  // Retrieves shortname from DVB unit
  async getShortName(): Promise<string | Uint8Array> {
    return this.shortname;
  }

  // With parameter, sets a new shortname. Without parameter, retrieves the current shortname from device and sets this.shortname
  async setShortName(shortname?: string): Promise<void> {
    try {
      const characteristic = await this.service!.getCharacteristic(this.SHORTNAME_UUID);
      if (!shortname) {
        const value = await characteristic.readValue();
        const shortName = new TextDecoder().decode(value);
        this.shortname = shortName;
      } else {
        const utf8encode = new TextEncoder();
        const newShortName = utf8encode.encode(shortname);
        await characteristic.writeValue(newShortName);
        this.shortname = newShortName;
      }
    } catch (error) {
      console.log(error);
    }
  }

  // Retrieve file list
  getFileList(): File[] {
    return this.listOfFiles;
  }

  // Gets files from device and sets this.listOfFiles
  private async setFileList(): Promise<void> {
    try {
      while (true) {
        const characteristic = await this.service!.getCharacteristic(this.LIST_FILES_UUID);
        const value = await characteristic.readValue();
        const message = new Uint8Array(value.buffer);
        if (message.byteLength === 0) return;
        const byteString = String.fromCharCode(...message);
        const splitString = byteString.split(';');
        const name = splitString[0];
        const length = splitString[1];
        this.listOfFiles.push({ name, length });
      }
    } catch (error) {
      console.log(error);
    }
  }

  // Retrieves the data from file using parameter name
  async getFileContent(name: string): Promise<Uint8Array | undefined> {
    try {
      const writeCharacteristic = await this.service!.getCharacteristic(this.WRITE_TO_DEVICE_UUID);
      const readCharacteristic = await this.service!.getCharacteristic(this.READ_FROM_DEVICE_UUID);
      const arrayBuffers: number[] = [];
      let offset = 0;
      const utf8encode = new TextEncoder();
      const nameBytes = utf8encode.encode(`${name};${offset};`);
      await writeCharacteristic.writeValue(nameBytes);
      while (true) {
        const displayInfo = await readCharacteristic.readValue();
        if (displayInfo.byteLength !== 0) {
          offset += displayInfo.byteLength;
          console.log(`Appending length to offset: ${offset}`);
          const nameBytes = utf8encode.encode(`${name};${offset};`);
          await writeCharacteristic.writeValue(nameBytes);
          const array = new Uint8Array(displayInfo.buffer);
          arrayBuffers.push(...array);
        } else {
          break;
        }
      }
      return new Uint8Array(arrayBuffers);
    } catch (error) {
      console.log(error);
    }
  }

  // Retrieves serial number
  getSerialNumber(): string | null {
    console.log(`Serial Number: ${this.serialNumber}`);
    return this.serialNumber;
  }

  // Retrieves current serial number and sets this.serialNumber
  private async setSerialNumber(): Promise<void> {
    try {
      const characteristic = await this.service!.getCharacteristic(this.SERIAL_NUMBER_UUID);
      const serial = await characteristic.readValue();
      const serialNumber = new TextDecoder().decode(serial);
      this.serialNumber = serialNumber;
    } catch (error) {
      console.log(error);
    }
  }

  // Formats storage
  async formatStorage(): Promise<void> {
    try {
      const characteristic = await this.service!.getCharacteristic(this.FORMAT_STORAGE_UUID);
      await characteristic.readValue();
      console.log('Files erased');
    } catch (error) {
      console.log(error);
    }
  }
}

