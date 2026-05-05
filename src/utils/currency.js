export function formatPeso(value) {
  if (!Number.isInteger(value) || value <= 0) {
    return '';
  }

  return `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}
