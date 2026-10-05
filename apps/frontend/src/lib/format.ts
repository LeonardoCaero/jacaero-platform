export function formatEuro(value: string | number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(Number(value))
}

// Not CSS capitalize: Spanish only capitalizes the first word.
export function capitalizeFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
