export interface BluetoothService {
  connect(): Promise<void>;
  disconnect(): void;
  getShortName(): Promise<string | null>;
  setShortName(shortname?: string): Promise<void>;
  getFileList(): { name: string; length: string }[];
  setFileList(): Promise<void>;
  getFileContent(name: string): Promise<Uint8Array | void>;
  getSerialNumber(): string | null;
  setSerialNumber(): Promise<void>;
  formatStorage(): Promise<void>;
}

export interface DVBDevice {
  deviceId: string;
}
