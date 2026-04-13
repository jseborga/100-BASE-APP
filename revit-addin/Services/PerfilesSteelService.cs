// Services/PerfilesSteelService.cs
// Tabla built-in de perfiles de acero estructural para Bolivia / Sur América.
// Permite resolver el peso lineal (kg/m) dado el nombre del perfil del tipo Revit.
//
// Perfiles incluidos:
//   - IPE  (vigas europeas de ala paralela)
//   - HEB  (columnas europeas de ala ancha)
//   - HEA  (columnas europeas ala ancha ligera)
//   - UPN  (canales / perfil U estándar)
//   - L    (ángulos igual ala)
//   - Tubo cuadrado / rectangular (RHS)
//   - Tubo redondo (CHS)
//
// Búsqueda: se intenta hacer match del nombre del tipo Revit contra esta tabla.
// Si no hay match, PesoLinealKgM queda en 0 (sin calcular).
//
// Fuente: tablas estándar AISC / EN 10365 (valores aproximados comunes en Bolivia).
//
// Autor: SSA Ingenieria SRL

namespace RvtConstructionOS.Services
{
    public static class PerfilesSteelService
    {
        // -----------------------------------------------------------------------
        // Tabla de perfiles (nombre → kg/m)
        // -----------------------------------------------------------------------

        private static readonly Dictionary<string, double> _tabla =
            new(StringComparer.OrdinalIgnoreCase)
        {
            // ── IPE (vigas de ala paralela) ─────────────────────────────────────
            { "IPE 80",    6.00 }, { "IPE80",    6.00 },
            { "IPE 100",   8.10 }, { "IPE100",   8.10 },
            { "IPE 120",  10.40 }, { "IPE120",  10.40 },
            { "IPE 140",  12.90 }, { "IPE140",  12.90 },
            { "IPE 160",  15.80 }, { "IPE160",  15.80 },
            { "IPE 180",  18.80 }, { "IPE180",  18.80 },
            { "IPE 200",  22.40 }, { "IPE200",  22.40 },
            { "IPE 220",  26.20 }, { "IPE220",  26.20 },
            { "IPE 240",  30.70 }, { "IPE240",  30.70 },
            { "IPE 270",  36.10 }, { "IPE270",  36.10 },
            { "IPE 300",  42.20 }, { "IPE300",  42.20 },
            { "IPE 330",  49.10 }, { "IPE330",  49.10 },
            { "IPE 360",  57.10 }, { "IPE360",  57.10 },
            { "IPE 400",  66.30 }, { "IPE400",  66.30 },
            { "IPE 450",  77.60 }, { "IPE450",  77.60 },
            { "IPE 500",  90.70 }, { "IPE500",  90.70 },
            { "IPE 550", 106.00 }, { "IPE550", 106.00 },
            { "IPE 600", 122.00 }, { "IPE600", 122.00 },

            // ── HEB (columnas ala ancha) ─────────────────────────────────────────
            { "HEB 100",  20.40 }, { "HEB100",  20.40 },
            { "HEB 120",  26.70 }, { "HEB120",  26.70 },
            { "HEB 140",  33.70 }, { "HEB140",  33.70 },
            { "HEB 160",  42.60 }, { "HEB160",  42.60 },
            { "HEB 180",  51.20 }, { "HEB180",  51.20 },
            { "HEB 200",  61.30 }, { "HEB200",  61.30 },
            { "HEB 220",  71.50 }, { "HEB220",  71.50 },
            { "HEB 240",  83.20 }, { "HEB240",  83.20 },
            { "HEB 260",  93.00 }, { "HEB260",  93.00 },
            { "HEB 280", 103.00 }, { "HEB280", 103.00 },
            { "HEB 300", 117.00 }, { "HEB300", 117.00 },
            { "HEB 320", 127.00 }, { "HEB320", 127.00 },
            { "HEB 340", 134.00 }, { "HEB340", 134.00 },
            { "HEB 360", 142.00 }, { "HEB360", 142.00 },
            { "HEB 400", 155.00 }, { "HEB400", 155.00 },
            { "HEB 450", 171.00 }, { "HEB450", 171.00 },
            { "HEB 500", 187.00 }, { "HEB500", 187.00 },
            { "HEB 550", 199.00 }, { "HEB550", 199.00 },
            { "HEB 600", 212.00 }, { "HEB600", 212.00 },

            // ── HEA (columnas ala ancha ligera) ─────────────────────────────────
            { "HEA 100",  16.70 }, { "HEA100",  16.70 },
            { "HEA 120",  19.90 }, { "HEA120",  19.90 },
            { "HEA 140",  24.70 }, { "HEA140",  24.70 },
            { "HEA 160",  30.40 }, { "HEA160",  30.40 },
            { "HEA 180",  35.50 }, { "HEA180",  35.50 },
            { "HEA 200",  42.30 }, { "HEA200",  42.30 },
            { "HEA 220",  50.50 }, { "HEA220",  50.50 },
            { "HEA 240",  60.30 }, { "HEA240",  60.30 },
            { "HEA 260",  68.20 }, { "HEA260",  68.20 },
            { "HEA 280",  76.40 }, { "HEA280",  76.40 },
            { "HEA 300",  88.30 }, { "HEA300",  88.30 },

            // ── UPN (canales) ─────────────────────────────────────────────────────
            { "UPN 80",   8.64 }, { "UPN80",   8.64 },
            { "UPN 100", 10.60 }, { "UPN100", 10.60 },
            { "UPN 120", 13.40 }, { "UPN120", 13.40 },
            { "UPN 140", 16.00 }, { "UPN140", 16.00 },
            { "UPN 160", 18.80 }, { "UPN160", 18.80 },
            { "UPN 180", 22.00 }, { "UPN180", 22.00 },
            { "UPN 200", 25.30 }, { "UPN200", 25.30 },
            { "UPN 220", 29.40 }, { "UPN220", 29.40 },
            { "UPN 240", 33.20 }, { "UPN240", 33.20 },
            { "UPN 260", 37.90 }, { "UPN260", 37.90 },
            { "UPN 280", 41.80 }, { "UPN280", 41.80 },
            { "UPN 300", 46.20 }, { "UPN300", 46.20 },

            // ── Ángulos iguales L ─────────────────────────────────────────────────
            { "L 40x40x4",    2.42 }, { "L40x40x4",   2.42 },
            { "L 50x50x5",    3.77 }, { "L50x50x5",   3.77 },
            { "L 60x60x6",    5.42 }, { "L60x60x6",   5.42 },
            { "L 70x70x7",    7.38 }, { "L70x70x7",   7.38 },
            { "L 75x75x6",    6.85 }, { "L75x75x6",   6.85 },
            { "L 80x80x8",    9.63 }, { "L80x80x8",   9.63 },
            { "L 90x90x9",   12.20 }, { "L90x90x9",  12.20 },
            { "L 100x100x10",15.10 }, { "L100x100x10",15.10 },

            // ── Tubo cuadrado / rectangular RHS ─────────────────────────────────
            { "RHS 60x60x4",   7.00 }, { "Tubo 60x60x4",   7.00 },
            { "RHS 80x80x4",   9.35 }, { "Tubo 80x80x4",   9.35 },
            { "RHS 100x100x4",11.70 }, { "Tubo 100x100x4",11.70 },
            { "RHS 100x50x4",  9.06 }, { "Tubo 100x50x4",  9.06 },
            { "RHS 120x80x5", 15.10 }, { "Tubo 120x80x5", 15.10 },
            { "RHS 150x100x5",19.00 }, { "Tubo 150x100x5",19.00 },
            { "RHS 200x100x6",27.80 }, { "Tubo 200x100x6",27.80 },

            // ── Tubo redondo CHS ──────────────────────────────────────────────────
            { "CHS 48.3x3.2",   3.56 }, { "Tubo 48x3",   3.56 },
            { "CHS 60.3x3.6",   5.07 }, { "Tubo 60x3.6", 5.07 },
            { "CHS 76.1x4",     7.11 }, { "Tubo 76x4",   7.11 },
            { "CHS 88.9x4",     8.38 }, { "Tubo 88x4",   8.38 },
            { "CHS 101.6x4",    9.63 }, { "Tubo 101x4",  9.63 },
            { "CHS 114.3x5",   13.50 }, { "Tubo 114x5", 13.50 },
            { "CHS 139.7x5",   16.60 }, { "Tubo 140x5", 16.60 },
            { "CHS 168.3x6",   24.00 }, { "Tubo 168x6", 24.00 },
            { "CHS 219.1x8",   41.60 }, { "Tubo 219x8", 41.60 },
        };

        // -----------------------------------------------------------------------
        // API pública
        // -----------------------------------------------------------------------

        /// <summary>
        /// Intenta resolver el peso lineal en kg/m dado el nombre del tipo Revit.
        /// Primero busca por nombre exacto; luego busca el código de perfil dentro del nombre.
        /// Retorna 0 si no se puede resolver.
        /// </summary>
        public static double ResolverPesoLineal(string nombreTipo)
        {
            if (string.IsNullOrWhiteSpace(nombreTipo)) return 0;

            // 1. Búsqueda exacta
            if (_tabla.TryGetValue(nombreTipo.Trim(), out double pesoExacto))
                return pesoExacto;

            // 2. Buscar alguna clave de la tabla dentro del nombre del tipo
            foreach (var kv in _tabla)
            {
                if (nombreTipo.Contains(kv.Key, StringComparison.OrdinalIgnoreCase))
                    return kv.Value;
            }

            // 3. Extraer patrón tipo "IPE200" o "HEB 300" del nombre con regex
            var match = System.Text.RegularExpressions.Regex.Match(
                nombreTipo, @"(IPE|HEB|HEA|HEM|UPN|UPE|IPN|CHS|RHS)\s*(\d{2,3})",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (match.Success)
            {
                string clave = $"{match.Groups[1].Value.ToUpperInvariant()} {match.Groups[2].Value}";
                if (_tabla.TryGetValue(clave, out double pesoRegex))
                    return pesoRegex;
            }

            return 0;
        }

        /// <summary>
        /// Extrae el código de sección de un nombre de tipo Revit.
        /// Ejemplo: "Viga IPE 200 - Planta 2" → "IPE 200"
        /// </summary>
        public static string ExtraerCodigoSeccion(string nombreTipo)
        {
            if (string.IsNullOrWhiteSpace(nombreTipo)) return string.Empty;

            var match = System.Text.RegularExpressions.Regex.Match(
                nombreTipo,
                @"(IPE|HEB|HEA|HEM|HEP|UPN|UPE|IPN|CHS|RHS|L)\s*(\d{2,3}(?:x\d{2,3}(?:x\d{1,2})?)?)",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);

            return match.Success
                ? $"{match.Groups[1].Value.ToUpperInvariant()} {match.Groups[2].Value}"
                : string.Empty;
        }

        /// <summary>
        /// Lista completa de perfiles disponibles en la tabla built-in.
        /// </summary>
        public static IEnumerable<(string Perfil, double KgM)> TodosLosPerfiles()
            => _tabla.Where(kv => !kv.Key.Contains(' ') || kv.Key.IndexOf(' ') > 2)
                     .Select(kv => (kv.Key, kv.Value))
                     .OrderBy(t => t.Key);
    }
}
