import { makeStyles } from "@griffel/react";
import { HidMouse } from "@yume-chan/aoa";
import {
    AndroidKeyCode,
    AndroidKeyEventAction,
    AndroidMotionEventAction,
    ScrcpyPointerId,
} from "@yume-chan/scrcpy";
import {
    KeyboardEvent,
    MouseEvent,
    PointerEvent,
    useEffect,
    useState,
} from "react";
import { STATE } from "./state";

const useClasses = makeStyles({
    video: {
        transformOrigin: "center center",
        touchAction: "none",
    },
});

function handleWheel(e: WheelEvent) {
    if (!STATE.client) {
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (STATE.mouse) {
        if (document.pointerLockElement) {
            STATE.mouse.sendEvent(
                HidMouse.serializeReport(
                    0,
                    0,
                    e.buttons,
                    -e.deltaX / 100,
                    -e.deltaY / 100
                )
            );
        }
    } else {
        const { x, y } = STATE.clientPositionToDevicePosition(
            e.clientX,
            e.clientY
        );
        STATE.client!.controlMessageSerializer!.injectScroll({
            screenWidth: STATE.client!.screenWidth!,
            screenHeight: STATE.client!.screenHeight!,
            pointerX: x,
            pointerY: y,
            scrollX: -e.deltaX / 100,
            scrollY: -e.deltaY / 100,
            buttons: 0,
        });
    }
}

function injectTouch(
    action: AndroidMotionEventAction,
    e: PointerEvent<HTMLDivElement>
) {
    if (!STATE.client) {
        return;
    }

    const { pointerType } = e;
    let pointerId: bigint;
    if (pointerType === "mouse") {
        // ScrcpyPointerId.Mouse doesn't work with Chrome browser
        // https://github.com/Genymobile/scrcpy/issues/3635
        pointerId = ScrcpyPointerId.Finger;
    } else {
        pointerId = BigInt(e.pointerId);
    }

    const { x, y } = STATE.clientPositionToDevicePosition(e.clientX, e.clientY);

    const messages = STATE.hoverHelper!.process({
        action,
        pointerId,
        screenWidth: STATE.client.screenWidth!,
        screenHeight: STATE.client.screenHeight!,
        pointerX: x,
        pointerY: y,
        pressure: e.pressure,
        buttons: e.buttons,
    });
    for (const message of messages) {
        STATE.client.controlMessageSerializer!.injectTouch(message);
    }
}

function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    STATE.rendererContainer!.focus();
    e.preventDefault();
    e.stopPropagation();

    if (STATE.mouse && e.pointerType === "mouse") {
        e.currentTarget.requestPointerLock();
        STATE.mouse.sendEvent(HidMouse.serializeReport(0, 0, e.buttons, 0, 0));
    } else {
        e.currentTarget.setPointerCapture(e.pointerId);
        injectTouch(AndroidMotionEventAction.Down, e);
    }
}

function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!STATE.client) {
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (STATE.mouse && e.pointerType === "mouse") {
        if (document.pointerLockElement) {
            STATE.mouse.sendEvent(
                HidMouse.serializeReport(
                    e.movementX,
                    e.movementY,
                    e.buttons,
                    0,
                    0
                )
            );
        }
    } else {
        injectTouch(
            e.buttons === 0
                ? AndroidMotionEventAction.HoverMove
                : AndroidMotionEventAction.Move,
            e
        );
    }
}

function handlePointerUp(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (STATE.mouse && e.pointerType === "mouse") {
        STATE.mouse.sendEvent(HidMouse.serializeReport(0, 0, e.buttons, 0, 0));
    } else {
        injectTouch(AndroidMotionEventAction.Up, e);
    }
}

function handlePointerLeave(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    // Prevent hover state on device from "stuck" at the last position
    injectTouch(AndroidMotionEventAction.HoverExit, e);
    injectTouch(AndroidMotionEventAction.Up, e);
}

function handleContextMenu(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
}

const KEY_MAP = {
    Enter: AndroidKeyCode.Enter,
    Escape: AndroidKeyCode.Escape,
    Backspace: AndroidKeyCode.Delete,
    Tab: AndroidKeyCode.Tab,
    Delete: AndroidKeyCode.ForwardDelete,
    Home: AndroidKeyCode.MoveHome,
    End: AndroidKeyCode.MoveEnd,
    Space: AndroidKeyCode.Space,
    ArrowUp: AndroidKeyCode.DPadUp,
    ArrowDown: AndroidKeyCode.DPadDown,
    ArrowLeft: AndroidKeyCode.DPadLeft,
    ArrowRight: AndroidKeyCode.DPadRight,
    ControlLeft: AndroidKeyCode.CtrlLeft,
    ControlRight: AndroidKeyCode.CtrlRight,
    ShiftLeft: AndroidKeyCode.ShiftLeft,
    ShiftRight: AndroidKeyCode.ShiftRight,
    AltLeft: AndroidKeyCode.AltLeft,
    AltRight: AndroidKeyCode.AltRight,
} as Record<string, AndroidKeyCode | undefined>;

async function handleKeyEvent(e: KeyboardEvent<HTMLDivElement>) {
    if (!STATE.client || e.repeat) {
        return;
    }

    const { type, key, code } = e;
    if (type === "keydown" && key.match(/^[!-`{-~]$/i)) {
        e.preventDefault();
        e.stopPropagation();
        STATE.client!.controlMessageSerializer!.injectText(key);
        return;
    }

    const keyCode = KEY_MAP[code];

    if (keyCode) {
        // Intercept keys like "Tab"
        e.preventDefault();
        e.stopPropagation();

        STATE.client!.controlMessageSerializer!.injectKeyCode({
            action:
                type === "keydown"
                    ? AndroidKeyEventAction.Down
                    : AndroidKeyEventAction.Up,
            keyCode,
            metaState: 0,
            repeat: 0,
        });
    }
}

export function VideoContainer() {
    const classes = useClasses();

    const [container, setContainer] = useState<HTMLDivElement | null>(null);

    useEffect(() => {
        STATE.handleRendererContainerRef(container);

        if (!container) {
            return;
        }

        container.addEventListener("wheel", handleWheel, {
            passive: false,
        });

        return () => {
            container.removeEventListener("wheel", handleWheel);
        };
    }, [container]);

    return (
        <div
            ref={setContainer}
            tabIndex={-1}
            className={classes.video}
            style={{
                width: STATE.width,
                height: STATE.height,
                transform: `translate(${
                    (STATE.rotatedWidth - STATE.width) / 2
                }px, ${(STATE.rotatedHeight - STATE.height) / 2}px) rotate(${
                    STATE.rotation * 90
                }deg)`,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onKeyDown={handleKeyEvent}
            onKeyUp={handleKeyEvent}
            onContextMenu={handleContextMenu}
        />
    );
}
