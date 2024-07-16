import { BluetoothService, DVBDevice } from "./BluetoothService";

export class BrowserBluetoothService implements BluetoothService {
  private listOfFiles: { name: string; length: string }[] = [];
  private connected: boolean = false;
  private shortname: string | null = null;
  private device: BluetoothDevice | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private serialNumber: string | null = null;

  private readonly DIS_SERVICE_ID: BluetoothServiceUUID = "device_information";
  private readonly SERIAL_NUMBER_UUID = "dbd00003-ff30-40a5-9ceb-a17358d31999";
  private readonly DVB_SERVICE_UUID: BluetoothServiceUUID =
    "dbd00001-ff30-40a5-9ceb-a17358d31999";
  private readonly LIST_FILES_UUID = "dbd00010-ff30-40a5-9ceb-a17358d31999";
  private readonly SHORTNAME_UUID = "dbd00002-ff30-40a5-9ceb-a17358d31999";
  private readonly WRITE_TO_DEVICE_UUID =
    "dbd00011-ff30-40a5-9ceb-a17358d31999";
  private readonly READ_FROM_DEVICE_UUID =
    "dbd00012-ff30-40a5-9ceb-a17358d31999";
  private readonly FORMAT_STORAGE_UUID = "dbd00013-ff30-40a5-9ceb-a17358d31999";

  async connect(): Promise<void> {
    try {
      const params: RequestDeviceOptions = {
        optionalServices: [
          this.DVB_SERVICE_UUID,
          this.DIS_SERVICE_ID,
        ] as unknown as number[],
        filters: [{ name: "DVBdiver" }],
      };
      this.device = await navigator.bluetooth.requestDevice(params);
      this.device.addEventListener("gattserverdisconnected", () => {
        this.disconnect();
      });
      const connection = await this.device.gatt!.connect();
      this.service = await connection.getPrimaryService(this.DVB_SERVICE_UUID);
      this.connected = true;
      await this.setShortName();
      await this.setSerialNumber();
      await this.setFileList();
    } catch (error) {
      console.error("Connection error:", error);
      this.disconnect();
    }
  }

  disconnect(): void {
    if (this.device && this.device.gatt) {
      this.device.gatt.disconnect();
    }
    this.connected = false;
    this.device = null;
    this.service = null;
    this.serialNumber = null;
    this.listOfFiles = [];
  }

  async getShortName(): Promise<string | null> {
    return this.shortname;
  }

  async setShortName(shortname?: string): Promise<void> {
    try {
      const characteristic = await this.service!.getCharacteristic(
        this.SHORTNAME_UUID,
      );
      if (!shortname) {
        const value = await characteristic.readValue();
        this.shortname = new TextDecoder().decode(value);
      } else {
        const newShortName = new TextEncoder().encode(shortname);
        await characteristic.writeValue(newShortName);
        this.shortname = shortname;
      }
    } catch (error) {
      console.error("Error setting short name:", error);
    }
  }

  getFileList(): { name: string; length: string }[] {
    return this.listOfFiles;
  }

  async setFileList(): Promise<void> {
    try {
      while (true) {
        const characteristic = await this.service!.getCharacteristic(
          this.LIST_FILES_UUID,
        );
        const value = await characteristic.readValue();
        const message = new Uint8Array(value.buffer);
        if (message.byteLength === 0) return;
        const byteString = String.fromCharCode(...message);
        const [name, length] = byteString.split(";");
        this.listOfFiles.push({ name, length });
      }
    } catch (error) {
      console.error("Error setting file list:", error);
    }
  }

  async getFileContent(name: string): Promise<Uint8Array | void> {
    try {
      const writeCharacteristic = await this.service!.getCharacteristic(
        this.WRITE_TO_DEVICE_UUID,
      );
      const readCharacteristic = await this.service!.getCharacteristic(
        this.READ_FROM_DEVICE_UUID,
      );
      const arrayBuffers: number[] = [];
      let offset = 0;
      const utf8encode = new TextEncoder();

      while (true) {
        const nameBytes = utf8encode.encode(`${name};${offset};`);
        await writeCharacteristic.writeValue(nameBytes);
        const displayInfo = await readCharacteristic.readValue();
        if (displayInfo.byteLength === 0) break;
        offset += displayInfo.byteLength;
        arrayBuffers.push(...new Uint8Array(displayInfo.buffer));
      }

      return new Uint8Array(arrayBuffers);
    } catch (error) {
      console.error("Error getting file content:", error);
    }
  }

  getSerialNumber(): string | null {
    return this.serialNumber;
  }

  async setSerialNumber(): Promise<void> {
    try {
      const characteristic = await this.service!.getCharacteristic(
        this.SERIAL_NUMBER_UUID,
      );
      const serial = await characteristic.readValue();
      this.serialNumber = new TextDecoder().decode(serial);
    } catch (error) {
      console.error("Error setting serial number:", error);
    }
  }

  async formatStorage(): Promise<void> {
    try {
      const characteristic = await this.service!.getCharacteristic(
        this.FORMAT_STORAGE_UUID,
      );
      await characteristic.readValue();
      console.log("Storage formatted");
    } catch (error) {
      console.error("Error formatting storage:", error);
    }
  }
}
