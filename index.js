import BluetoothLE from '@capacitor-community/bluetooth-le';
const { Bluetooth } = BluetoothLE;
import CBOR from 'cbor';

class DVBDeviceBLE {
	listOfFiles = [];
	shortname = null;
	device = null;
	service = null;
	deviceInformation = null;
	serialNumber = null;
	DIS_SERVICE_ID = 'device_information';
	SERIAL_NUMBER_UUID = 'dbd00003-ff30-40a5-9ceb-a17358d31999';
	DVB_SERVICE_UUID = 'dbd00001-ff30-40a5-9ceb-a17358d31999';
	LIST_FILES_UUID = 'dbd00010-ff30-40a5-9ceb-a17358d31999';
	SHORTNAME_UUID = 'dbd00002-ff30-40a5-9ceb-a17358d31999';
	WRITE_TO_DEVICE_UUID = 'dbd00011-ff30-40a5-9ceb-a17358d31999';
	READ_FROM_DEVICE_UUID = 'dbd00012-ff30-40a5-9ceb-a17358d31999';
	FORMAT_STORAGE_UUID = 'dbd00013-ff30-40a5-9ceb-a17358d31999';

	isMobileDevice() {
		return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
			navigator.userAgent
		);
	}

	async connect() {
		try {
			if (this.isMobileDevice()) {
				await this._connectMobile();
			} else {
				await this._connectBrowser();
			}

			await this.setShortName();
			await this.setSerialNumber();
			await this.setFileList();
		} catch (error) {
			console.log(error);
			this.disconnect();
		}
	}

	async _connectMobile() {
		// Request Bluetooth permissions
		await Bluetooth.requestDevice({
			acceptAllDevices: true,
			optionalServices: [this.DVB_SERVICE_UUID, this.DIS_SERVICE_ID]
		});

		// Connect to the device
		this.device = await Bluetooth.connectToDevice({ deviceId: this.device.id });
		console.log(`Connected to device: ${this.device.name}`);

		// Get the DVB service
		this.service = await this.device.getService(this.DVB_SERVICE_UUID);
		console.log(`Connected to service ${this.DVB_SERVICE_UUID}`);
	}

	async _connectBrowser() {
		const params = {
			optionalServices: [this.DVB_SERVICE_UUID, this.DIS_SERVICE_ID],
			acceptAllDevices: true
		};
		this.device = await navigator.bluetooth.requestDevice(params);
		this.device.addEventListener('gattserverdisconnected', (event) => {
			console.log(event);
			this.disconnect();
		});
		const connection = await this.device.gatt.connect();
		this.service = await connection.getPrimaryService(this.DVB_SERVICE_UUID);
		console.log(`Connected to service ${this.DVB_SERVICE_UUID}`);
	}

	disconnect() {
		console.log('Disconnected');
		if (this.isMobileDevice()) {
			this.device.disconnect();
		} else {
			this.device.gatt.disconnect();
		}
		this.device = null;
		this.service = null;
		this.serialNumber = null;
		this.listOfFiles = [];
	}

	async getShortName() {
		return this.shortname;
	}

	async setShortName(shortname) {
		try {
			if (!shortname) {
				const characteristic = await this.service.getCharacteristic(this.SHORTNAME_UUID);
				const value = await this.readCharacteristic(characteristic);
				const shortName = new TextDecoder().decode(value);
				this.shortname = shortName;
			} else {
				const characteristic = await this.service.getCharacteristic(this.SHORTNAME_UUID);
				const utf8encode = new TextEncoder();
				const newShortName = utf8encode.encode(shortname);
				await this.writeCharacteristic(characteristic, newShortName);
				this.shortname = newShortName;
			}
		} catch (error) {}
	}

	getFileList() {
		return this.listOfFiles;
	}

	async setFileList() {
		try {
			while (true) {
				const characteristic = await this.service.getCharacteristic(this.LIST_FILES_UUID);
				const value = await this.readCharacteristic(characteristic);
				const message = new Uint8Array(value.buffer);
				if (message.byteLength === 0) return;
				const byteString = String.fromCharCode(...message);
				const split_string = byteString.split(';');
				const name = split_string[0];
				const length = split_string[1];
				this.listOfFiles.push({ name, length });
			}
		} catch (error) {
			console.log(error);
		}
	}

	async getFileContent(name) {
		try {
			const write_characteristic = await this.service.getCharacteristic(this.WRITE_TO_DEVICE_UUID);
			const read_characteristic = await this.service.getCharacteristic(this.READ_FROM_DEVICE_UUID);
			const arrayBuffers = [];
			let offset = 0;
			const utf8encode = new TextEncoder();
			const name_bytes = utf8encode.encode(`${name};${offset};`);
			await this.writeCharacteristic(write_characteristic, name_bytes);
			while (true) {
				const display_info = await this.readCharacteristic(read_characteristic);
				if (display_info.byteLength !== 0) {
					offset += display_info.byteLength;
					console.log(`Appending length to offset: ${offset}`);
					const utf8encode = new TextEncoder();
					const name_bytes = utf8encode.encode(`${name};${offset};`);
					await this.writeCharacteristic(write_characteristic, name_bytes);
					const array = new Uint8Array(display_info.buffer);
					array.map((x) => {
						arrayBuffers.push(x);
					});
				} else {
					break;
				}
			}
			return new Uint8Array(arrayBuffers);
		} catch (error) {
			console.log(error);
		}
	}

	getSerialNumber() {
		console.log(`Serial Number: ${this.serialNumber}`);
		return this.serialNumber;
	}

	async setSerialNumber() {
		try {
			const characteristic = await this.service.getCharacteristic(this.SERIAL_NUMBER_UUID);
			const serial = await this.readCharacteristic(characteristic);
			const serialNumber = new TextDecoder().decode(serial);
			this.serialNumber = serialNumber;
		} catch (error) {
			console.log(error);
		}
	}

	async formatStorage() {
		try {
			const characteristic = await this.service.getCharacteristic(this.FORMAT_STORAGE_UUID);
			await this.readCharacteristic(characteristic);
			console.log('Files erased');
		} catch (error) {
			console.log(error);
		}
	}

	async readCharacteristic(characteristic) {
		if (this.isMobileDevice()) {
			return await Bluetooth.readCharacteristic({ characteristicId: characteristic.uuid });
		} else {
			return await characteristic.readValue();
		}
	}

	async writeCharacteristic(characteristic, value) {
		if (this.isMobileDevice()) {
			await Bluetooth.writeCharacteristic({ characteristicId: characteristic.uuid, value });
		} else {
			await characteristic.writeValue(value);
		}
	}
}

class MCUManager {
	constructor(di = {}) {
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
		this._isMobile = false;
	}

	async connect(filters) {
		try {
			this._isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
				navigator.userAgent
			);

			if (this._isMobile) {
				await this._connectMobile();
			} else {
				await this._connectBrowser();
			}

			await this._connected();
			if (this._uploadIsInProgress) {
				this._uploadNext();
			}
		} catch (error) {
			this._logger.error(error);
			await this._disconnected();
			return;
		}
	}

	async _connectMobile() {
		await Bluetooth.requestDevice({
			acceptAllDevices: true,
			optionalServices: [this.SERVICE_UUID]
		});

		this._device = await Bluetooth.connectToDevice({ deviceId: this._device.id });
		this._logger.info(`Connected to device: ${this._device.name}`);

		this._service = await this._device.getService(this.SERVICE_UUID);
		this._logger.info(`Connected to service ${this.SERVICE_UUID}`);

		this._characteristic = await this._service.getCharacteristic(this.CHARACTERISTIC_UUID);
		this._characteristic.addEventListener(
			'characteristicvaluechanged',
			this._notification.bind(this)
		);
		await this._characteristic.startNotifications();
	}

	async _connectBrowser() {
		const params = {
			optionalServices: [this.SERVICE_UUID],
			acceptAllDevices: true
		};
		this._device = await navigator.bluetooth.requestDevice(params);
		this._device.addEventListener('gattserverdisconnected', async (event) => {
			this._logger.info(event);
			if (!this._userRequestedDisconnect) {
				this._logger.info('Trying to reconnect');
				await this._connect();
			} else {
				await this._disconnected();
			}
		});
		const connection = await this._device.gatt.connect();
		this._service = await connection.getPrimaryService(this.SERVICE_UUID);
		this._characteristic = await this._service.getCharacteristic(this.CHARACTERISTIC_UUID);
		this._characteristic.addEventListener(
			'characteristicvaluechanged',
			this._notification.bind(this)
		);
		await this._characteristic.startNotifications();
	}

	disconnect() {
		this._userRequestedDisconnect = true;
		if (this._isMobile) {
			return this._device.disconnect();
		} else {
			return this._device.gatt.disconnect();
		}
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
		this._characteristic = null;
		this._uploadIsInProgress = false;
		this._userRequestedDisconnect = false;
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
		if (this._isMobile) {
			await Bluetooth.writeCharacteristic({
				characteristicId: this._characteristic.uuid,
				value: message
			});
		} else {
			await this._characteristic.writeValueWithoutResponse(Uint8Array.from(message));
		}
		this._seq = (this._seq + 1) % 256;
	}

	_notification(event) {
		const message = new Uint8Array(event.target.value.buffer);
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
		if (this._messageCallback) this._messageCallback({ op, group, id, data, length });
	}

	// Other methods remain the same
}

class DVBAndMCUManager {
	constructor() {
		this.dvbDeviceBLE = new DVBDeviceBLE();
		this.mcuManager = new MCUManager();
	}

	async connect() {
		await this.dvbDeviceBLE.connect();
	}

	async getFileContent(name) {
		return await this.dvbDeviceBLE.getFileContent(name);
	}

	async getShortName() {
		return await this.dvbDeviceBLE.getShortName();
	}

	async setShortName(shortname) {
		await this.dvbDeviceBLE.setShortName(shortname);
	}

	getFileList() {
		return this.dvbDeviceBLE.getFileList();
	}

	async setFileList() {
		await this.dvbDeviceBLE.setFileList();
	}

	getSerialNumber() {
		return this.dvbDeviceBLE.getSerialNumber();
	}

	async setSerialNumber() {
		await this.dvbDeviceBLE.setSerialNumber();
	}

	async formatStorage() {
		await this.dvbDeviceBLE.formatStorage();
	}

	async connectToMCU(filters) {
		await this.mcuManager.connect(filters);
	}

	onConnect(callback) {
		return this.mcuManager.onConnect(callback);
	}

	onDisconnect(callback) {
		return this.mcuManager.onDisconnect(callback);
	}

	onMessage(callback) {
		return this.mcuManager.onMessage(callback);
	}

	onImageUploadProgress(callback) {
		return this.mcuManager.onImageUploadProgress(callback);
	}

	onImageUploadFinished(callback) {
		return this.mcuManager.onImageUploadFinished(callback);
	}

	async cmdReset() {
		await this.mcuManager.cmdReset();
	}

	async smpEcho(message) {
		await this.mcuManager.smpEcho(message);
	}

	async cmdImageState() {
		await this.mcuManager.cmdImageState();
	}

	async cmdImageErase() {
		await this.mcuManager.cmdImageErase();
	}

	async cmdImageTest(hash) {
		await this.mcuManager.cmdImageTest(hash);
	}

	async cmdImageConfirm(hash) {
		await this.mcuManager.cmdImageConfirm(hash);
	}

	async cmdUpload(image, slot = 0) {
		await this.mcuManager.cmdUpload(image, slot);
	}

	async imageInfo(image) {
		return await this.mcuManager.imageInfo(image);
	}
}

export default DVBAndMCUManager;
