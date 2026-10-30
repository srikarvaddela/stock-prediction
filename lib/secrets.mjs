const encoder = new TextEncoder();
const decode = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const encode = (value) => btoa(String.fromCharCode(...value));
async function key(master) {
  const bytes = decode(master);
  if (bytes.length !== 32) throw new Error("Encryption is not configured.");
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function encryptSecret(value, master, owner) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(owner) },
    await key(master),
    encoder.encode(value),
  );
  return JSON.stringify({
    v: 1,
    iv: encode(iv),
    data: encode(new Uint8Array(ciphertext)),
  });
}
export async function decryptSecret(value, master, owner) {
  const item = JSON.parse(value);
  if (item.v !== 1) throw new Error("Unsupported secret format.");
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decode(item.iv),
        additionalData: encoder.encode(owner),
      },
      await key(master),
      decode(item.data),
    ),
  );
}
