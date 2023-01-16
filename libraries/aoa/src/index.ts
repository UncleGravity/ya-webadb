export const AOA_DEFAULT_DEVICE_FILTERS = [
    {
        vendorId: 0x18d1,
        productId: 0x2d00,
    },
    {
        vendorId: 0x18d1,
        productId: 0x2d01,
    },
] as const satisfies readonly USBDeviceFilter[];

export enum AoaRequestType {
    GetProtocol = 51,
    SendStrings,
    StartAccessory,
    RegisterHid,
    UnregisterHid,
    SetHidReportDescriptor,
    SendHidEvent,
    SetAudioMode,
}

export async function aoaGetProtocol(device: USBDevice) {
    const result = await device.controlTransferIn(
        {
            recipient: "device",
            requestType: "vendor",
            request: AoaRequestType.GetProtocol,
            value: 0,
            index: 0,
        },
        2
    );
    const version = result.data!.getUint16(0, true);
    return version;
}

export async function aoaSetAudioMode(device: USBDevice, mode: number) {
    await device.controlTransferOut(
        {
            recipient: "device",
            requestType: "vendor",
            request: AoaRequestType.SetAudioMode,
            value: mode,
            index: 0,
        },
        new ArrayBuffer(0)
    );
}

export async function aoaStartAccessory(device: USBDevice) {
    await device.controlTransferOut(
        {
            recipient: "device",
            requestType: "vendor",
            request: AoaRequestType.StartAccessory,
            value: 0,
            index: 0,
        },
        new ArrayBuffer(0)
    );
}

function findAudioStreamingInterface(device: USBDevice) {
    for (const configuration of device.configurations) {
        for (const interface_ of configuration.interfaces) {
            for (const alternate of interface_.alternates) {
                // Audio
                if (alternate.interfaceClass !== 0x01) {
                    continue;
                }
                // AudioStreaming
                if (alternate.interfaceSubclass !== 0x02) {
                    continue;
                }
                if (alternate.endpoints.length === 0) {
                    continue;
                }
                return { configuration, interface_, alternate };
            }
        }
    }

    throw new Error("No matched alternate interface found");
}

export function aoaGetAudioStream(device: USBDevice) {
    let endpointNumber!: number;
    return new ReadableStream<Uint8Array>({
        async start() {
            const { configuration, interface_, alternate } =
                findAudioStreamingInterface(device);

            if (
                device.configuration?.configurationValue !==
                configuration.configurationValue
            ) {
                await device.selectConfiguration(
                    configuration.configurationValue
                );
            }

            if (!interface_.claimed) {
                await device.claimInterface(interface_.interfaceNumber);
            }

            if (
                interface_.alternate.alternateSetting !==
                alternate.alternateSetting
            ) {
                await device.selectAlternateInterface(
                    interface_.interfaceNumber,
                    alternate.alternateSetting
                );
            }

            const endpoint = alternate.endpoints.find(
                (endpoint) =>
                    endpoint.type === "isochronous" &&
                    endpoint.direction === "in"
            );
            if (!endpoint) {
                throw new Error("No matched endpoint found");
            }

            endpointNumber = endpoint.endpointNumber;
        },
        async pull(controller) {
            const result = await device.isochronousTransferIn(endpointNumber, [
                1024,
            ]);
            for (const packet of result.packets) {
                const data = packet.data!;
                const array = new Uint8Array(
                    data.buffer,
                    data.byteOffset,
                    data.byteLength
                );
                controller.enqueue(array);
            }
        },
    });
}

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
