import { BleClient } from '@capacitor-community/bluetooth-le';
import CBOR from 'cbor';

function isMobileDevice() {
	return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

class DVBDeviceBLE {
	constructor(di = {}) {
		// MTU
		this.SERVICE_UUID = '8d53dc1d-1db7-4cd3-868b-8a527460aa84';
		this.CHARACTERISTIC_UUID = 'da2e7828-fbce-4e01-ae9e-261174997c48';
		this._mtu = 140;
		this._device = null;
		this._service = null;
		this._characteristic = null;
		this._connectCallback = null;
		this._connectingCallback = null;
		this._disconnectCallback = null;
		this._messageCallback = null;
		this._imageUploadProgressCallback = null;
		this._uploadIsInProgress = false;
		this._buffer = new Uint8Array();
		this._logger = di.logger || { info: console.log, error: console.error };
		this._seq = 0;
		this._userRequestedDisconnect = false;

		// 
		this._serviceDVB = null;
		this._servceInfo = null;
		this.listOfFiles = [];
		this.shortname = null;
		this.serialNumber = null;
		this.firmwareVersion = null;
		this.hardwareVersion = null;
		this.DEVICE_INFORMATION_SERVICE_UUID = '0000180a-0000-1000-8000-00805f9b34fb';
		this.SERIAL_NUMBER_UUID = 'dbd00003-ff30-40a5-9ceb-a17358d31999';
		this.DVB_SERVICE_UUID = 'dbd00001-ff30-40a5-9ceb-a17358d31999';
		this.LIST_FILES_UUID = 'dbd00010-ff30-40a5-9ceb-a17358d31999';
		this.SHORTNAME_UUID = 'dbd00002-ff30-40a5-9ceb-a17358d31999';
		this.WRITE_TO_DEVICE_UUID = 'dbd00011-ff30-40a5-9ceb-a17358d31999';
		this.READ_FROM_DEVICE_UUID = 'dbd00012-ff30-40a5-9ceb-a17358d31999';
		this.FORMAT_STORAGE_UUID = 'dbd00013-ff30-40a5-9ceb-a17358d31999';
		this.FIRMWARE_REVISION_UUID = '00002a26-0000-1000-8000-00805f9b34fb';
		this.HARDWARE_REVISION_UUID = '00002a27-0000-1000-8000-00805f9b34fb';
	}

	async _requestDevice(filters) {
		const params = {
			acceptAllDevices: true,
			optionalServices: [this.SERVICE_UUID,this.DVB_SERVICE_UUID, this.DEVICE_INFORMATION_SERVICE_UUID]
		};
		if (filters) {
			params.filters = filters;
			params.acceptAllDevices = false;
		}
		return navigator.bluetooth.requestDevice(params);
	}

	async _requestMobileDevice(filters) {
		const params = {
			acceptAllDevices: true,
			optionalServices: [this.SERVICE_UUID,this.DVB_SERVICE_UUID, this.DEVICE_INFORMATION_SERVICE_UUID]
		};
		if (filters) {
			params.filters = filters;
			params.acceptAllDevices = false;
		}
		return navigator.bluetooth.requestLEScan(params);
	}

	async connect(filters) {
        try {
            this._device = await this._requestDevice(filters);
            
            this._logger.info(`Connecting to device ${this.name}...`);
            this._device.addEventListener('gattserverdisconnected', async (event) => {
                this._logger.info(event);
                if (!this._userRequestedDisconnect) {
                    this._logger.info('Trying to reconnect');
                    await this._connect();
                } else {
                    await this._disconnected();
                }
            });
            await this._connect();
        } catch (error) {
            this._logger.error(error);
            await this._disconnected();
            throw error;
        }
    }

	async _connect() {
        try {
            if (this._connectingCallback) this._connectingCallback();
            const server = await this._device.gatt.connect();
            this._logger.info(`Server connected.`);
            this._service = await server.getPrimaryService(this.SERVICE_UUID);
			if (this._device.name && this._device.name.includes('DVB')) {
				this._serviceDVB = await server.getPrimaryService(this.DVB_SERVICE_UUID);
				this._serviceInfo = await server.getPrimaryService(this.DEVICE_INFORMATION_SERVICE_UUID);
				await this.setDeviceInfo();
				
			}
            this._logger.info(`Service connected.`);
            this._characteristic = await this._service.getCharacteristic(this.CHARACTERISTIC_UUID);
            this._characteristic.addEventListener(
                'characteristicvaluechanged',
                this._notification.bind(this)
            );
            await this._characteristic.startNotifications();
            await this._connected();
            if (this._uploadIsInProgress) {
                this._uploadNext();
            }
        } catch (error) {
            this._logger.error(error);
            await this._disconnected();
            throw error;
        }
    }

	async setDeviceInfo() {
        await this.setFileList();
        await this.setShortName();
        await this.setSerialNumber();
        await this.setHardwareVersion();
        await this.setFirmwareVersion();
    }


	disconnect() {
		this._userRequestedDisconnect = true;
		return this._device.gatt.disconnect();
	}

	onConnecting(callback) {
		this._connectingCallback = callback;
		return this;
	}

	onConnect(callback) {
		this._connectCallback = callback;
		return this;
	}

	onDisconnect(callback) {
		this._disconnectCallback = callback;
		return this;
	}

	onMessage(callback) {
		this._messageCallback = callback;
		return this;
	}

	onImageUploadProgress(callback) {
		this._imageUploadProgressCallback = callback;
		return this;
	}

	onImageUploadFinished(callback) {
		this._imageUploadFinishedCallback = callback;
		return this;
	}

	async _connected() {
		if (this._connectCallback) this._connectCallback();
	}

	async _disconnected() {
		this._logger.info('Disconnected.');
		if (this._disconnectCallback) this._disconnectCallback();
		this._device = null;
		this._service = null;
		this._serviceDVB = null;
		this._serviceInfo = null;
		this._characteristic = null;
		this._uploadIsInProgress = false;
		this._userRequestedDisconnect = false;
		this.serialNumber = null;
		this.listOfFiles = [];
	}

	get name() {
		return this._device && this._device.name;
	}

	async _sendMessage(op, group, id, data) {
		const _flags = 0;
		let encodedData = [];
		if (typeof data !== 'undefined') {
			encodedData = [...new Uint8Array(CBOR.encode(data))];
		}
		const length_lo = encodedData.length & 255;
		const length_hi = encodedData.length >> 8;
		const group_lo = group & 255;
		const group_hi = group >> 8;
		const message = [
			op,
			_flags,
			length_hi,
			length_lo,
			group_hi,
			group_lo,
			this._seq,
			id,
			...encodedData
		];
		// console.log('>'  + message.map(x => x.toString(16).padStart(2, '0')).join(' '));
		await this._characteristic.writeValueWithoutResponse(Uint8Array.from(message));
		this._seq = (this._seq + 1) % 256;
	}

	_notification(event) {
		// console.log('message received');
		const message = new Uint8Array(event.target.value.buffer);
		// console.log(message);
		// console.log('<'  + [...message].map(x => x.toString(16).padStart(2, '0')).join(' '));
		this._buffer = new Uint8Array([...this._buffer, ...message]);
		const messageLength = this._buffer[2] * 256 + this._buffer[3];
		if (this._buffer.length < messageLength + 8) return;
		this._processMessage(this._buffer.slice(0, messageLength + 8));
		this._buffer = this._buffer.slice(messageLength + 8);
	}

	_processMessage(message) {
		const [op, _flags, length_hi, length_lo, group_hi, group_lo, _seq, id] = message;
		const data = CBOR.decode(message.slice(8).buffer);
		const length = length_hi * 256 + length_lo;
		const group = group_hi * 256 + group_lo;
		if (group === 1 && id === 1 && (data.rc === 0 || data.rc === undefined) && data.off) {
			this._uploadOffset = data.off;
			this._uploadNext();
			return;
		}
		if (this._messageCallback) this._messageCallback({ op, group, id, data, length });
	}

	cmdReset() {
		return this._sendMessage(2, 0, 5);
	}

	smpEcho(message) {
		return this._sendMessage(2, 0, 0, { d: message });
	}

	cmdImageState() {
		return this._sendMessage(0, 1, 0);
	}

	cmdImageErase() {
		return this._sendMessage(2, 1, 5, {});
	}

	cmdImageTest(hash) {
		return this._sendMessage(2, 1, 0, {
			hash,
			confirm: false
		});
	}

	cmdImageConfirm(hash) {
		return this._sendMessage(2, 1, 0, {
			hash,
			confirm: true
		});
	}

	_hash(image) {
		return crypto.subtle.digest('SHA-256', image);
	}

	async _uploadNext() {
		if (this._uploadOffset >= this._uploadImage.byteLength) {
			this._uploadIsInProgress = false;
			this._imageUploadFinishedCallback();
			return;
		}

		const nmpOverhead = 8;
		const message = { data: new Uint8Array(), off: this._uploadOffset };
		if (this._uploadOffset === 0) {
			message.len = this._uploadImage.byteLength;
			message.sha = new Uint8Array(await this._hash(this._uploadImage));
		}
		this._imageUploadProgressCallback({
			percentage: Math.floor((this._uploadOffset / this._uploadImage.byteLength) * 100)
		});

		const length = this._mtu - CBOR.encode(message).byteLength - nmpOverhead;

		message.data = new Uint8Array(
			this._uploadImage.slice(this._uploadOffset, this._uploadOffset + length)
		);

		this._uploadOffset += length;

		this._sendMessage(2, 1, 1, message);
	}

	async cmdUpload(image, slot = 0) {
		if (this._uploadIsInProgress) {
			this._logger.error('Upload is already in progress.');
			return;
		}
		this._uploadIsInProgress = true;

		this._uploadOffset = 0;
		this._uploadImage = image;
		this._uploadSlot = slot;

		this._uploadNext();
	}

	async imageInfo(image) {
		// https://interrupt.memfault.com/blog/mcuboot-overview#mcuboot-image-binaries

		const info = {};
		const view = new Uint8Array(image);

		// check header length
		if (view.length < 4096) {
			throw new Error('Image header is too short');
		}

		// parse image version
		const version = [view[12], view[13], view[14], view[15]].join('.');

		info.version = version;

		// parse image hash
		const hashStart = 20;
		const hashEnd = hashStart + 32;
		const hash = view.slice(hashStart, hashEnd);

		info.hash = hash;

		return info;
	}

	getShortName() {
		return this.shortname;
	}

	async setShortName(shortname) {
		try {
			if (isMobileDevice()) {
				if (!shortname) {
					const result = await BleClient.read(
						this._device.deviceId,
						this.DVB_SERVICE_UUID,
						this.SHORTNAME_UUID
					);
					this.shortname = new TextDecoder().decode(result);
				} else {
					const uf8encode = new TextEncoder();
					const newShortName = uf8encode.encode(shortname);
					await BleClient.write(
						this._device.deviceId,
						this.DVB_SERVICE_UUID,
						this.SHORTNAME_UUID,
						newShortName
					);
					this.shortname = shortname;
				}
			} else {
				if (!shortname) {
					const characteristic = await this._serviceDVB.getCharacteristic(this.SHORTNAME_UUID);
					const value = await characteristic.readValue();
					const shortName = new TextDecoder().decode(value);
					this.shortname = shortName;
				} else {
					const characteristic = await this._serviceDVB.getCharacteristic(this.SHORTNAME_UUID);
					const uf8encode = new TextEncoder();
					const newShortName = uf8encode.encode(shortname);
					await characteristic.writeValue(newShortName);
					this.shortname = newShortName;
				}
			}
		} catch (error) {
			this._logger.error(error);
		}
	}
	getFileList() {
		return this.listOfFiles;
	}

	async setFileList() {
		try {
			if (isMobileDevice()) {
				while (true) {
					const value = await BleClient.read(
						this._device.deviceId,
						this.DVB_SERVICE_UUID,
						this.LIST_FILES_UUID
					);
					const message = new Uint8Array(value);
					if (message.byteLength === 0) return;
					const byteString = String.fromCharCode(...message);
					const split_string = byteString.split(';');
					const name = split_string[0];
					const length = split_string[1];
					this.listOfFiles.push({ name, length });
				}
			} else {
				while (true) {
					const characteristic = await this._serviceDVB.getCharacteristic(this.LIST_FILES_UUID);
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
		} catch (error) {
			this._logger.error(error);
		}
	}

	async getFileContent(name, progressCallback) {
		try {
			const arrayBuffers = [];
			let offset = 0;
			let totalSize = 0;

			const fileInfo = this.listOfFiles.find((file) => file.name === name);
			if (fileInfo) {
				totalSize = parseInt(fileInfo.length);
			}

			const uf8encode = new TextEncoder();
			const name_bytes = uf8encode.encode(`${name};${offset};`);

			if (isMobileDevice()) {
				await BleClient.write(
					this._device.deviceId,
					this.DVB_SERVICE_UUID,
					this.WRITE_TO_DEVICE_UUID,
					name_bytes
				);

				while (true) {
					const display_info = await BleClient.read(
						this._device.deviceId,
						this.DVB_SERVICE_UUID,
						this.READ_FROM_DEVICE_UUID
					);

					if (display_info.byteLength !== 0) {
						offset += display_info.byteLength;
						this._logger.info(`Appending length to offset: ${offset}`);
						const name_bytes = uf8encode.encode(`${name};${offset};`);
						await BleClient.write(
							this._device.deviceId,
							this.DVB_SERVICE_UUID,
							this.WRITE_TO_DEVICE_UUID,
							name_bytes
						);
						const array = new Uint8Array(display_info);
						array.map((x) => {
							arrayBuffers.push(x);
						});

						if (totalSize > 0 && progressCallback) {
							const progress = Math.min(100, Math.round((offset / totalSize) * 100));
							progressCallback(progress);
						}
					} else {
						break;
					}
				}
			} else {
				const write_characteristic = await this._serviceDVB.getCharacteristic(
					this.WRITE_TO_DEVICE_UUID
				);
				const read_characteristic = await this._serviceDVB.getCharacteristic(
					this.READ_FROM_DEVICE_UUID
				);

				await write_characteristic.writeValue(name_bytes);
				while (true) {
					const display_info = await read_characteristic.readValue();
					if (display_info.byteLength !== 0) {
						offset += display_info.byteLength;
						this._logger.info(`Appending length to offset: ${offset}`);
						const name_bytes = uf8encode.encode(`${name};${offset};`);
						await write_characteristic.writeValue(name_bytes);
						const array = new Uint8Array(display_info.buffer);
						array.map((x) => {
							arrayBuffers.push(x);
						});

						if (totalSize > 0 && progressCallback) {
							const progress = Math.min(100, Math.round((offset / totalSize) * 100));
							progressCallback(progress);
						}
					} else {
						break;
					}
				}
			}


			return new Uint8Array(arrayBuffers);
		} catch (error) {
			this._logger.error(error);
		}
	}

	async formatStorage() {
		try {
			if (isMobileDevice()) {
				await BleClient.read(this._device.deviceId, this.DVB_SERVICE_UUID, this.FORMAT_STORAGE_UUID);
			} else {
				const characteristic = await this._serviceDVB.getCharacteristic(this.FORMAT_STORAGE_UUID);
				await characteristic.readValue();
			}
			this._logger.info('Files erased');
		} catch (error) {
			this._logger.error(error);
		}
	}

	getSerialNumber() {
		return this.serialNumber;
	}

	async setSerialNumber() {
		try {
			if (isMobileDevice()) {
				const serial = await BleClient.read(
					this._device.deviceId,
					this.DVB_SERVICE_UUID,
					this.SERIAL_NUMBER_UUID
				);
				const serialNumber = new TextDecoder().decode(serial);
				this.serialNumber = serialNumber;
			} else {
				const characteristic = await this._serviceDVB.getCharacteristic(this.SERIAL_NUMBER_UUID);
				const serial = await characteristic.readValue();
				const serialNumber = new TextDecoder().decode(serial);
				this.serialNumber = serialNumber;
				this._logger.info(`Serial Number: ${this.serialNumber}`);
			}
		} catch (error) {
			this._logger.error(error);
		}
	}

	getFirmwareVersion() {
		return this.firmwareVersion;
	}

	async setFirmwareVersion() {
		try {
			if (isMobileDevice()) {
				const firmware = await BleClient.read(
					this._device.deviceId,
					this.DEVICE_INFORMATION_SERVICE_UUID,
					this.FIRMWARE_REVISION_UUID
				);
				const firmwareVersion = new TextDecoder().decode(firmware);
				this._logger.info('Firmware Version:', firmwareVersion);
				this.firmwareVersion = firmwareVersion;
			} else {
				const characteristic = await this._serviceInfo.getCharacteristic(
					this.FIRMWARE_REVISION_UUID
				);
				const firmware = await characteristic.readValue();
				const firmwareVersion = new TextDecoder().decode(firmware);
				this._logger.info('Firmware Version:', firmwareVersion);
				this.firmwareVersion = firmwareVersion;
			}
		} catch (error) {
			this._logger.error('Error getting firmware version:', error);
			throw error;
		}
	}

	getHardwareVersion() {
		return this.hardwareVersion;
	}

	async setHardwareVersion() {
		try {
			if (isMobileDevice()) {
				const hardware = await BleClient.read(
					this._device.deviceId,
					this.DEVICE_INFORMATION_SERVICE_UUID,
					this.HARDWARE_REVISION_UUID
				);
				const hardwareVersion = new TextDecoder().decode(hardware);
				this._logger.info('Hardware Version:', hardwareVersion);
				this.hardwareVersion = hardwareVersion;
			} else {
				const characteristic = await this._serviceInfo.getCharacteristic(
					this.HARDWARE_REVISION_UUID
				);
				const hardware = await characteristic.readValue();
				const hardwareVersion = new TextDecoder().decode(hardware);
				this._logger.info('Hardware Version:', hardwareVersion);
				this.hardwareVersion = hardwareVersion;
			}
		} catch (error) {
			this._logger.error('Error getting firmware version:', error);
			throw error;
		}
	}

	async setDeviceInfo() {
		await this.setFileList();
		await this.setShortName();
		await this.setSerialNumber();
		await this.setHardwareVersion();
		await this.setFirmwareVersion();
	}
}
