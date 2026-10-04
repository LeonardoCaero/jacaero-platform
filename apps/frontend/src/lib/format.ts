export function formatEuro(value: string | number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(Number(value))
}

// CSS `capitalize` would turn "octubre de 2026" into "Octubre De 2026"; Spanish only capitalizes the first word.
export function capitalizeFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
