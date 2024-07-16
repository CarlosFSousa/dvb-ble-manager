import { Capacitor } from "@capacitor/core";
import { BluetoothService } from "./BluetoothService";
import { BrowserBluetoothService } from "./BrowserBluetoothService";
import { MobileBluetoothService } from "./MobileBluetoothService";

export function createBluetoothService(): BluetoothService {
  if (Capacitor.isNativePlatform()) {
    return new MobileBluetoothService();
  } else {
    return new BrowserBluetoothService();
  }
}
