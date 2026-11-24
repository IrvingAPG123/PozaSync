export const COLONIAS_POZA_RICA = [
  '27 de Septiembre',
  '5 de Mayo',
  'Agustín Lara',
  'Anáhuac',
  'Benito Juárez',
  'Cazones',
  'Centro',
  'Chapultepec',
  'Emiliano Zapata',
  'Flores Magón',
  'Francisco I. Madero',
  'Guadalupe Victoria',
  'Hidalgo',
  'Independencia',
  'Insurgentes',
  'La Rueda',
  'Laredo',
  'Las Gaviotas',
  'Lázaro Cárdenas',
  'Libertad',
  'Los Sauces',
  'Manuel Ávila Camacho',
  'Miguel Hidalgo',
  'Morelos',
  'Obrera',
  'Palma Sola',
  'Petromex',
  'Plan de Ayala',
  'Reforma',
  'Revolución',
  'Santa Emilia',
  'Tajín',
  'Tepeyac',
  'Vicente Guerrero',
] as const;

export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}

export function buscarColonias(
  texto: string,
  adicionales: string[] = []
): string[] {
  const busqueda = normalizarBusqueda(texto);

  const catalogo = [
    ...adicionales,
    ...COLONIAS_POZA_RICA,
  ];

  const unicas = catalogo.filter(
    (nombre, indice, lista) =>
      lista.findIndex(
        (otra) =>
          normalizarBusqueda(otra) ===
          normalizarBusqueda(nombre)
      ) === indice
  );

  return unicas.filter((nombre) =>
    normalizarBusqueda(nombre).includes(busqueda)
  );
}