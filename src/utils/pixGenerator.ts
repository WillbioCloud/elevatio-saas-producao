// Calcula o CRC16-CCITT exigido pelo Banco Central
function getCRC16(payload: string): string {
  let crc = 0xffff;

  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;

    for (let j = 0; j < 8; j += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }

  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

// Formata blocos do EMV (ID + Tamanho + Valor)
function formatEMV(id: string, value: string): string {
  const size = value.length.toString().padStart(2, '0');
  return `${id}${size}${value}`;
}

export function generatePixPayload(
  pixKey: string,
  merchantName: string,
  merchantCity: string,
  amount?: number,
  txid: string = '***'
): string {
  const payloadKey = formatEMV('00', 'br.gov.bcb.pix') + formatEMV('01', pixKey);

  let payload =
    formatEMV('00', '01') +
    formatEMV('26', payloadKey) +
    formatEMV('52', '0000') +
    formatEMV('53', '986');

  if (amount && amount > 0) {
    payload += formatEMV('54', amount.toFixed(2));
  }

  payload +=
    formatEMV('58', 'BR') +
    formatEMV('59', merchantName.substring(0, 25)) +
    formatEMV('60', merchantCity.substring(0, 15)) +
    formatEMV('62', formatEMV('05', txid));

  payload += '6304';
  const crc = getCRC16(payload);

  return payload + crc;
}
