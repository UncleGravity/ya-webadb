// cspell:ignore Cnst

export class HidMouse {
    public static descriptor = new Uint8Array(
        // prettier-ignore
        [
            0x05, 0x01,       // USAGE_PAGE (Generic Desktop)
            0x09, 0x02,       // USAGE (Mouse)
            0xa1, 0x01,       // COLLECTION (Application)
            0x09, 0x01,       //   USAGE (Pointer)
            0xa1, 0x00,       //   COLLECTION (Physical)
            0x05, 0x09,       //     USAGE_PAGE (Button)
            0x19, 0x01,       //     USAGE_MINIMUM (Button 1)
            0x29, 0x05,       //     USAGE_MAXIMUM (Button 5)
            0x15, 0x00,       //     LOGICAL_MINIMUM (0)
            0x25, 0x01,       //     LOGICAL_MAXIMUM (1)
            0x95, 0x03,       //     REPORT_COUNT (5)
            0x75, 0x01,       //     REPORT_SIZE (1)
            0x81, 0x02,       //     INPUT (Data,Var,Abs)
            0x95, 0x01,       //     REPORT_COUNT (1)
            0x75, 0x05,       //     REPORT_SIZE (3)
            0x81, 0x01,       //     INPUT (Cnst,Var,Abs)
            0x05, 0x01,       //     USAGE_PAGE (Generic Desktop)
            0x09, 0x30,       //     USAGE (X)
            0x09, 0x31,       //     USAGE (Y)
            0x09, 0x38,       //     USAGE (Z)
            0x15, 0x81,       //     LOGICAL_MINIMUM (-127)
            0x25, 0x7f,       //     LOGICAL_MAXIMUM (127)
            0x75, 0x08,       //     REPORT_SIZE (8)
            0x95, 0x03,       //     REPORT_COUNT (3)
            0x81, 0x06,       //     INPUT (Data,Var,Rel)
            0x05, 0x0C,       //     USAGE_PAGE (Consumer)
            0x0A, 0x38, 0x02, //     USAGE (AC Pan)
            0x15, 0x81,       //     LOGICAL_MINIMUM (-127)
            0x25, 0x7f,       //     LOGICAL_MAXIMUM (127)
            0x75, 0x08,       //     REPORT_SIZE (8)
            0x95, 0x01,       //     REPORT_COUNT (1)
            0x81, 0x06,       //     INPUT (Data,Var,Rel)
            0xc0,             //   END_COLLECTION
            0xc0,             // END_COLLECTION
        ]
    );

    public static serializeReport(
        relativeX: number,
        relativeY: number,
        buttons: number,
        scrollX: number,
        scrollY: number
    ): Uint8Array {
        return new Uint8Array([
            buttons,
            relativeX,
            relativeY,
            scrollY,
            scrollX,
        ]);
    }
}
