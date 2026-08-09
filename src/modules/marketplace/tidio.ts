const tidioPublicKeyPattern = /^[a-z0-9]{32}$/;

export function normalizeTidioPublicKey(value: string | null | undefined) {
  const publicKey = value?.trim() ?? "";

  return tidioPublicKeyPattern.test(publicKey) ? publicKey : null;
}

export function getTidioScriptUrl(value: string | null | undefined) {
  const publicKey = normalizeTidioPublicKey(value);

  return publicKey ? `https://code.tidio.co/${publicKey}.js` : null;
}
