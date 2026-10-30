export function profileFields({ fullName, phone }) {
  const full_name = String(fullName || '').trim();
  const normalizedPhone = String(phone || '').trim();
  if (full_name.length < 2 || full_name.length > 100) throw new Error('Name must contain 2 to 100 characters.');
  if (normalizedPhone && !/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) throw new Error('Use an international phone number, for example +639171234567, or leave it blank.');
  return { full_name, phone: normalizedPhone || null };
}

export function verifiedPortions(claims) {
  return claims.filter(claim => !claim.is_sample && claim.status === 'picked_up')
    .reduce((total, claim) => total + Math.max(0, Number(claim.quantity ?? claim.quantity_claimed) || 0), 0);
}
