import {
    Dropdown,
    IDropdownOption,
    Icon,
    IconButton,
    Position,
    SpinButton,
    Stack,
    TextField,
    Toggle,
    TooltipHost,
} from "@fluentui/react";
import { makeStyles } from "@griffel/react";
import { Disposable } from "@yume-chan/event";
import {
    AdbScrcpyClient,
    AdbScrcpyOptions1_22,
    AndroidCodecLevel,
    AndroidCodecProfile,
    DEFAULT_SERVER_PATH,
    ScrcpyLogLevel,
    ScrcpyOptions1_25,
    ScrcpyOptionsInit1_24,
    ScrcpyVideoOrientation,
    ScrcpyVideoStreamPacket,
} from "@yume-chan/scrcpy";
import { TinyH264Decoder } from "@yume-chan/scrcpy-decoder-tinyh264";
import SCRCPY_SERVER_VERSION from "@yume-chan/scrcpy/bin/version";
import { WritableStream } from "@yume-chan/stream-extra";
import {
    autorun,
    computed,
    makeAutoObservable,
    observable,
    runInAction,
} from "mobx";
import { observer } from "mobx-react-lite";
import { GLOBAL_STATE } from "../../state";
import { Icons } from "../../utils";
import { STATE } from "./state";

type RequiredScrcpyOptions = Pick<
    ScrcpyOptionsInit1_24,
    "crop" | "maxSize" | "bitRate" | "powerOn"
>;
type OptionalScrcpyOptions = Partial<
    Pick<
        ScrcpyOptionsInit1_24,
        | "displayId"
        | "lockVideoOrientation"
        | "encoderName"
        | "tunnelForward"
        | "stayAwake"
        | "powerOffOnClose"
    >
>;

export interface Settings extends RequiredScrcpyOptions, OptionalScrcpyOptions {
    turnScreenOff?: boolean;
    decoder?: string;
    ignoreDecoderCodecArgs?: boolean;
}

export interface SettingDefinitionBase {
    key: keyof Settings;
    type: string;
    label: string;
    labelExtra?: JSX.Element;
    description?: string;
}

export interface TextSettingDefinition extends SettingDefinitionBase {
    type: "text";
    placeholder?: string;
}

export interface DropdownSettingDefinition extends SettingDefinitionBase {
    type: "dropdown";
    placeholder?: string;
    options: IDropdownOption[];
}

export interface ToggleSettingDefinition extends SettingDefinitionBase {
    type: "toggle";
}

export interface NumberSettingDefinition extends SettingDefinitionBase {
    type: "number";
    min?: number;
    max?: number;
    step?: number;
}

export type SettingDefinition =
    | TextSettingDefinition
    | DropdownSettingDefinition
    | ToggleSettingDefinition
    | NumberSettingDefinition;

interface SettingItemProps {
    definition: SettingDefinition;
    settings: any;
    onChange: (key: keyof Settings, value: any) => void;
}

const useClasses = makeStyles({
    labelRight: {
        marginLeft: "4px",
    },
});

export const SettingItem = observer(function SettingItem({
    definition,
    settings,
    onChange,
}: SettingItemProps) {
    const classes = useClasses();

    let label: JSX.Element = (
        <Stack horizontal verticalAlign="center">
            <span>{definition.label}</span>
            {!!definition.description && (
                <TooltipHost content={definition.description}>
                    <Icon
                        className={classes.labelRight}
                        iconName={Icons.Info}
                    />
                </TooltipHost>
            )}
            {definition.labelExtra}
        </Stack>
    );

    switch (definition.type) {
        case "text":
            return (
                <TextField
                    label={label as any}
                    placeholder={definition.placeholder}
                    value={settings[definition.key]}
                    onChange={(e, value) => onChange(definition.key, value)}
                />
            );
        case "dropdown":
            return (
                <Dropdown
                    label={label as any}
                    options={definition.options}
                    placeholder={definition.placeholder}
                    selectedKey={settings[definition.key]}
                    onChange={(e, option) =>
                        onChange(definition.key, option!.key)
                    }
                />
            );
        case "toggle":
            return (
                <Toggle
                    label={label}
                    checked={settings[definition.key]}
                    onChange={(e, checked) => onChange(definition.key, checked)}
                />
            );
        case "number":
            return (
                <SpinButton
                    label={definition.label}
                    labelPosition={Position.top}
                    min={definition.min}
                    max={definition.max}
                    step={definition.step}
                    value={settings[definition.key].toString()}
                    onChange={(e, value) =>
                        onChange(definition.key, Number.parseInt(value!, 10))
                    }
                />
            );
    }
});

export interface H264Decoder extends Disposable {
    readonly maxProfile: AndroidCodecProfile | undefined;
    readonly maxLevel: AndroidCodecLevel | undefined;

    readonly renderer: HTMLElement;
    readonly frameRendered: number;
    readonly frameSkipped: number;
    readonly writable: WritableStream<ScrcpyVideoStreamPacket>;
}

export interface H264DecoderConstructor {
    new (): H264Decoder;
}

export interface DecoderDefinition {
    key: string;
    name: string;
    Constructor: H264DecoderConstructor;
}

export const SETTING_STATE = makeAutoObservable(
    {
        settingsVisible: false,

        displays: [] as number[],
        encoders: [] as string[],
        decoders: [
            {
                key: "tinyh264",
                name: "TinyH264 (Software)",
                Constructor: TinyH264Decoder,
            },
        ] as DecoderDefinition[],

        settings: {
            maxSize: 1080,
            bitRate: 4_000_000,
            lockVideoOrientation: ScrcpyVideoOrientation.Unlocked,
            displayId: 0,
            crop: "",
            powerOn: true,
        } as Settings,
    },
    {
        decoders: observable.shallow,
        settings: observable.deep,
    }
);

autorun(() => {
    if (GLOBAL_STATE.device) {
        runInAction(() => {
            SETTING_STATE.encoders = [];
            SETTING_STATE.settings.encoderName = undefined;

            SETTING_STATE.displays = [];
            SETTING_STATE.settings.displayId = undefined;
        });
    }
});

autorun(() => {
    SETTING_STATE.settings.decoder = SETTING_STATE.decoders[0].key;
});

export const SETTING_DEFINITIONS = computed(() => {
    const result: SettingDefinition[] = [];

    result.push(
        {
            key: "powerOn",
            type: "toggle",
            label: "Turn device on when starting",
        },
        {
            key: "turnScreenOff",
            type: "toggle",
            label: "Turn screen off when starting",
        },
        {
            key: "stayAwake",
            type: "toggle",
            label: "Stay awake (if plugged in)",
        },
        {
            key: "powerOffOnClose",
            type: "toggle",
            label: "Turn device off when exiting",
        }
    );

    result.push({
        key: "displayId",
        type: "dropdown",
        label: "Display",
        placeholder: "Press refresh to update available displays",
        labelExtra: (
            <IconButton
                iconProps={{ iconName: Icons.ArrowClockwise }}
                disabled={!GLOBAL_STATE.device}
                text="Refresh"
                onClick={async () => {
                    try {
                        await STATE.pushServer();

                        const displays = await AdbScrcpyClient.getDisplays(
                            GLOBAL_STATE.device!,
                            DEFAULT_SERVER_PATH,
                            SCRCPY_SERVER_VERSION,
                            new AdbScrcpyOptions1_22(
                                new ScrcpyOptions1_25({
                                    logLevel: ScrcpyLogLevel.Debug,
                                    tunnelForward:
                                        SETTING_STATE.settings.tunnelForward,
                                })
                            )
                        );

                        runInAction(() => {
                            SETTING_STATE.displays = displays;
                            if (
                                !SETTING_STATE.settings.displayId ||
                                !SETTING_STATE.displays.includes(
                                    SETTING_STATE.settings.displayId
                                )
                            ) {
                                SETTING_STATE.settings.displayId =
                                    SETTING_STATE.displays[0];
                            }
                        });
                    } catch (e: any) {
                        GLOBAL_STATE.showErrorDialog(e);
                    }
                }}
            />
        ),
        options: SETTING_STATE.displays.map((item) => ({
            key: item,
            text: item.toString(),
        })),
    });

    result.push({
        key: "crop",
        type: "text",
        label: "Crop",
        placeholder: "W:H:X:Y",
    });

    result.push({
        key: "maxSize",
        type: "number",
        label: "Max Resolution (longer side, 0 = unlimited)",
        min: 0,
        max: 2560,
        step: 50,
    });

    result.push({
        key: "bitRate",
        type: "number",
        label: "Max Bit Rate",
        min: 100,
        max: 100_000_000,
        step: 100,
    });

    result.push({
        key: "lockVideoOrientation",
        type: "dropdown",
        label: "Lock Video Orientation",
        options: [
            {
                key: ScrcpyVideoOrientation.Unlocked,
                text: "Unlocked",
            },
            {
                key: ScrcpyVideoOrientation.Initial,
                text: "Current",
            },
            {
                key: ScrcpyVideoOrientation.Portrait,
                text: "Portrait",
            },
            {
                key: ScrcpyVideoOrientation.Landscape,
                text: "Landscape",
            },
            {
                key: ScrcpyVideoOrientation.PortraitFlipped,
                text: "Portrait (Flipped)",
            },
            {
                key: ScrcpyVideoOrientation.LandscapeFlipped,
                text: "Landscape (Flipped)",
            },
        ],
    });

    result.push({
        key: "encoderName",
        type: "dropdown",
        label: "Encoder",
        placeholder: "Press refresh to update available encoders",
        labelExtra: (
            <IconButton
                iconProps={{ iconName: Icons.ArrowClockwise }}
                disabled={!GLOBAL_STATE.device}
                text="Refresh"
                onClick={async () => {
                    try {
                        await STATE.pushServer();

                        const encoders = await AdbScrcpyClient.getEncoders(
                            GLOBAL_STATE.device!,
                            DEFAULT_SERVER_PATH,
                            SCRCPY_SERVER_VERSION,
                            new AdbScrcpyOptions1_22(
                                new ScrcpyOptions1_25({
                                    logLevel: ScrcpyLogLevel.Debug,
                                    tunnelForward:
                                        SETTING_STATE.settings.tunnelForward,
                                })
                            )
                        );

                        runInAction(() => {
                            SETTING_STATE.encoders = encoders;
                            if (
                                !SETTING_STATE.settings.encoderName ||
                                !SETTING_STATE.encoders.includes(
                                    SETTING_STATE.settings.encoderName
                                )
                            ) {
                                SETTING_STATE.settings.encoderName =
                                    SETTING_STATE.encoders[0];
                            }
                        });
                    } catch (e: any) {
                        GLOBAL_STATE.showErrorDialog(e);
                    }
                }}
            />
        ),
        options: SETTING_STATE.encoders.map((item) => ({
            key: item,
            text: item,
        })),
    });

    if (SETTING_STATE.decoders.length > 1) {
        result.push({
            key: "decoder",
            type: "dropdown",
            label: "Decoder",
            options: SETTING_STATE.decoders.map((item) => ({
                key: item.key,
                text: item.name,
                data: item,
            })),
        });
    }

    result.push({
        key: "ignoreDecoderCodecArgs",
        type: "toggle",
        label: `Ignore decoder's codec arguments`,
        description: `Some decoders don't support all H.264 profile/levels, so they request the device to encode at their highest-supported codec. However, some super old devices may not support that codec so their encoders will fail to start. Use this option to let device choose the codec to be used.`,
    });

    result.push({
        key: "tunnelForward",
        type: "toggle",
        label: "Use forward connection",
        description:
            "Android before version 9 has a bug that prevents reverse tunneling when using ADB over WiFi.",
    });

    return result;
});
