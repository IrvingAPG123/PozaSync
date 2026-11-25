
export function interpretarFechaUTC(
  fecha: string | null | undefined
): Date | null {
  if (!fecha) {
    return null;
  }

  let normalizada = fecha.trim();

  const sinZonaHoraria =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

  if (sinZonaHoraria.test(normalizada)) {
    normalizada += 'Z';
  }

  const valor = new Date(normalizada);

  if (Number.isNaN(valor.getTime())) {
    return null;
  }

  return valor;
}
