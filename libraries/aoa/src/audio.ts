import { AoaRequestType } from "./type.js";

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
