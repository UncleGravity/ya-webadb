import { AoaRequestType } from "./type.js";

export async function aoaRegisterHid(
    device: USBDevice,
    accessoryId: number,
    reportDescriptorSize: number
) {
    await device.controlTransferOut(
        {
            recipient: "device",
            requestType: "vendor",
            request: AoaRequestType.RegisterHid,
            value: accessoryId,
            index: reportDescriptorSize,
        },
        new ArrayBuffer(0)
    );
}

export async function aoaSetHidReportDescriptor(
    device: USBDevice,
    accessoryId: number,
    reportDescriptor: Uint8Array
) {
    await device.controlTransferOut(
        {
            recipient: "device",
            requestType: "vendor",
            request: AoaRequestType.SetHidReportDescriptor,
            value: accessoryId,
            index: 0,
        },
        reportDescriptor
    );
}

export async function aoaUnregisterHid(device: USBDevice, accessoryId: number) {
    await device.controlTransferOut(
        {
            recipient: "device",
            requestType: "vendor",
            request: AoaRequestType.UnregisterHid,
            value: accessoryId,
            index: 0,
        },
        new ArrayBuffer(0)
    );
}

export async function aoaSendHidEvent(
    device: USBDevice,
    accessoryId: number,
    event: Uint8Array
) {
    await device.controlTransferOut(
        {
            recipient: "device",
            requestType: "vendor",
            request: AoaRequestType.SendHidEvent,
            value: accessoryId,
            index: 0,
        },
        event
    );
}

export class AoaHidDevice {
    public static async register(
        device: USBDevice,
        accessoryId: number,
        reportDescriptor: Uint8Array
    ) {
        await aoaRegisterHid(device, accessoryId, reportDescriptor.length);
        await aoaSetHidReportDescriptor(device, accessoryId, reportDescriptor);
    }

    private _device: USBDevice;
    private _accessoryId: number;

    private constructor(device: USBDevice, accessoryId: number) {
        this._device = device;
        this._accessoryId = accessoryId;
    }

    public async sendEvent(event: Uint8Array) {
        await aoaSendHidEvent(this._device, this._accessoryId, event);
    }

    public async unregister() {
        await aoaUnregisterHid(this._device, this._accessoryId);
    }
}
