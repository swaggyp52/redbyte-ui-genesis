export function crc16_ccitt_false(buf) {
  let crc = 0xffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i] << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc & 0xffff;
}
