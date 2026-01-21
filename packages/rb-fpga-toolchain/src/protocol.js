/**
 * RBHB Protocol Constants (Toolchain Side)
 * Shared between wrapper generator and other toolchain components.
 */

// Magic header: "RBHB" in ASCII
export const RBHB_MAGIC_HEADER_Val = 0x52424842;

// Protocol version
export const RBHB_VERSION_V1 = 0x01;

// Frame types
export const RBHB_TYPE_IDENTIFY = 0x01;
export const RBHB_TYPE_IDENTIFY_RESP = 0x02;
export const RBHB_TYPE_STREAM_START = 0x10;
export const RBHB_TYPE_STREAM_STOP = 0x11;
export const RBHB_TYPE_SAMPLE = 0x12;

// Frame structure constants
export const RBHB_HEADER_LEN = 8; // Magic(4) + Ver(1) + Type(1) + Len(2)
export const RBHB_CRC_LEN = 4;
export const RBHB_MIN_FRAME_LEN = RBHB_HEADER_LEN + RBHB_CRC_LEN;
