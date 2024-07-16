import { BluetoothService, DVBDevice } from "./BluetoothService";
import { BleClient } from "@capacitor-community/bluetooth-le";

export class MobileBluetoothService implements BluetoothService {
  private listOfFiles: { name: string; length: string }[] = [];
  private connected: boolean = false;
  private shortname: string | null = null;
  private device: DVBDevice | null = null;
  private serialNumber: string | null = null;

  private readonly DVB_SERVICE_UUID = "dbd00001-ff30-40a5-9ceb-a17358d31999";
  private readonly SERIAL_NUMBER_UUID = "dbd00003-ff30-40a5-9ceb-a17358d31999";
  private readonly LIST_FILES_UUID = "dbd00010-ff30-40a5-9ceb-a17358d31999";
  private readonly SHORTNAME_UUID = "dbd00002-ff30-40a5-9ceb-a17358d31999";
  private readonly WRITE_TO_DEVICE_UUID =
    "dbd00011-ff30-40a5-9ceb-a17358d31999";
  private readonly READ_FROM_DEVICE_UUID =
    "dbd00012-ff30-40a5-9ceb-a17358d31999";
  private readonly FORMAT_STORAGE_UUID = "dbd00013-ff30-40a5-9ceb-a17358d31999";

  async connect(): Promise<void> {
    try {
      await BleClient.initialize();
      const device = await BleClient.requestDevice({
        services: [this.DVB_SERVICE_UUID],
        name: "DVBdiver",
      });
      await BleClient.connect(device.deviceId);
      this.device = { deviceId: device.deviceId };
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
    if (this.device) {
      BleClient.disconnect(this.device.deviceId);
    }
    this.connected = false;
    this.device = null;
    this.serialNumber = null;
    this.listOfFiles = [];
  }

  async getShortName(): Promise<string | null> {
    return this.shortname;
  }

  async setShortName(shortname?: string): Promise<void> {
    if (!this.device) throw new Error("Device not connected");
    try {
      if (!shortname) {
        const result = await BleClient.read(
          this.device.deviceId,
          this.DVB_SERVICE_UUID,
          this.SHORTNAME_UUID,
        );
        this.shortname = new TextDecoder().decode(result);
      } else {
        const data = new TextEncoder().encode(shortname);
        await BleClient.writeWithoutResponse(
          this.device.deviceId,
          this.DVB_SERVICE_UUID,
          this.SHORTNAME_UUID,
          new DataView(data.buffer),
        );
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
    if (!this.device) throw new Error("Device not connected");
    try {
      while (true) {
        const result = await BleClient.read(
          this.device.deviceId,
          this.DVB_SERVICE_UUID,
          this.LIST_FILES_UUID,
        );
        if (result.byteLength === 0) return;
        const byteString = new TextDecoder().decode(result);
        const [name, length] = byteString.split(";");
        this.listOfFiles.push({ name, length });
      }
    } catch (error) {
      console.error("Error setting file list:", error);
    }
  }

  async getFileContent(name: string): Promise<Uint8Array | void> {
    if (!this.device) throw new Error("Device not connected");
    try {
      const arrayBuffers: number[] = [];
      let offset = 0;

      while (true) {
        const nameBytes = new TextEncoder().encode(`${name};${offset};`);
        await BleClient.writeWithoutResponse(
          this.device.deviceId,
          this.DVB_SERVICE_UUID,
          this.WRITE_TO_DEVICE_UUID,
          new DataView(nameBytes.buffer),
        );
        const displayInfo = await BleClient.read(
          this.device.deviceId,
          this.DVB_SERVICE_UUID,
          this.READ_FROM_DEVICE_UUID,
        );
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
    if (!this.device) throw new Error("Device not connected");
    try {
      const result = await BleClient.read(
        this.device.deviceId,
        this.DVB_SERVICE_UUID,
        this.SERIAL_NUMBER_UUID,
      );
      this.serialNumber = new TextDecoder().decode(result);
    } catch (error) {
      console.error("Error setting serial number:", error);
    }
  }

  async formatStorage(): Promise<void> {
    if (!this.device) throw new Error("Device not connected");
    try {
      await BleClient.read(
        this.device.deviceId,
        this.DVB_SERVICE_UUID,
        this.FORMAT_STORAGE_UUID,
      );
      console.log("Storage formatted");
    } catch (error) {
      console.error("Error formatting storage:", error);
    }
  }
}
