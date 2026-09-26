import QRCode from 'qrcode';

/** Public verification URL for a farmer-check id. */
export function verifyUrl(id: string): string {
  return `${window.location.origin}/?verify=${encodeURIComponent(id)}`;
}

/** QR data-URL for embedding on screen and in printed reports. */
export async function qrDataUrl(text: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(text, { width: 220, margin: 1 });
  } catch {
    return null;
  }
}
