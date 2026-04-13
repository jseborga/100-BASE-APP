// Models/CustomParamExport.cs
// Modelos para exportación de parámetros personalizados por familia Revit.
//
// Permite al usuario seleccionar qué parámetros enviar al servidor,
// crear parámetros calculados con fórmulas, y agregar notas para la IA.
//
// Autor: SSA Ingenieria SRL

namespace RvtConstructionOS.Models
{
    // ============================================================
    // PERFIL DE PARÁMETROS POR FAMILIA
    // ============================================================

    /// <summary>
    /// Perfil de exportación de parámetros para una familia Revit.
    /// Agrupa todos los parámetros seleccionados y fórmulas custom
    /// que se enviarán al servidor para una familia específica.
    /// Se persiste en el ExportRuleSet (JSON por documento).
    /// </summary>
    public class FamilyParamProfile
    {
        /// <summary>Nombre de la familia Revit (clave de agrupación).</summary>
        public string Familia { get; set; } = string.Empty;

        /// <summary>Categoría Revit de la familia (Muros, Puertas, etc.).</summary>
        public string Categoria { get; set; } = string.Empty;

        /// <summary>
        /// Nota general para la IA sobre esta familia.
        /// Describe el propósito constructivo de la familia para que
        /// el motor de mapeo entienda el contexto.
        /// Ejemplo: "Muro cortina tipo araña para fachada flotante.
        /// Los paneles son de vidrio templado con sellador estructural."
        /// </summary>
        public string NotaGeneralIA { get; set; } = string.Empty;

        /// <summary>
        /// Parámetros directos del tipo/instancia seleccionados para exportar.
        /// El usuario elige cuáles de los parámetros nativos de Revit enviar.
        /// </summary>
        public List<ParamDirecto> ParametrosDirectos { get; set; } = new();

        /// <summary>
        /// Parámetros calculados con fórmulas que combinan parámetros nativos.
        /// Ejemplo: "AnchoDintel" = {Width} + 0.30
        /// </summary>
        public List<ParamCalculado> ParametrosCalculados { get; set; } = new();

        /// <summary>Fecha de última modificación del perfil.</summary>
        public DateTime FechaModificacion { get; set; } = DateTime.Now;

        /// <summary>Clave única para indexar: "Categoria|Familia".</summary>
        public string Clave => $"{Categoria}|{Familia}";
    }

    // ============================================================
    // PARÁMETRO DIRECTO (leído del modelo Revit)
    // ============================================================

    /// <summary>
    /// Un parámetro nativo de Revit seleccionado para exportar.
    /// Se lee directamente del ElementType o de la instancia.
    /// </summary>
    public class ParamDirecto
    {
        /// <summary>Nombre del parámetro en Revit (como aparece en Properties).</summary>
        public string NombreRevit { get; set; } = string.Empty;

        /// <summary>
        /// GUID del shared parameter. Vacío si es built-in o de familia.
        /// Se usa para lectura confiable (los nombres pueden repetirse).
        /// </summary>
        public string ParamGuid { get; set; } = string.Empty;

        /// <summary>
        /// Origen del parámetro: "Type" o "Instance".
        /// Determina si se lee del tipo o de las instancias.
        /// </summary>
        public string Origen { get; set; } = "Type";

        /// <summary>
        /// Tipo de almacenamiento: TEXT, NUMBER, YESNO, LENGTH, AREA, VOLUME, INTEGER.
        /// Determina cómo se serializa el valor.
        /// </summary>
        public string TipoDato { get; set; } = "TEXT";

        /// <summary>
        /// Alias corto para el JSON exportado.
        /// Si está vacío, se usa el nombre del parámetro sanitizado.
        /// Ejemplo: "TipoVidrio" en lugar de "Tipo de Vidrio (familia)"
        /// </summary>
        public string Alias { get; set; } = string.Empty;

        /// <summary>
        /// Nota para la IA explicando qué significa este parámetro
        /// en el contexto de construcción/metrados.
        /// Ejemplo: "Tipo de vidrio — afecta el precio por m² de vidriería.
        /// Valores: Simple 6mm, Doble 4+4, Templado 8mm"
        /// </summary>
        public string NotaIA { get; set; } = string.Empty;

        /// <summary>True si este parámetro está activo para exportar.</summary>
        public bool Activo { get; set; } = true;

        /// <summary>
        /// Clave final para el JSON: usa Alias si existe, sino sanitiza NombreRevit.
        /// </summary>
        public string ClaveExport =>
            !string.IsNullOrWhiteSpace(Alias)
                ? Alias
                : SanitizarNombre(NombreRevit);

        /// <summary>True si el valor es numérico (NUMBER, LENGTH, AREA, VOLUME, INTEGER).</summary>
        public bool EsNumerico => TipoDato is "NUMBER" or "LENGTH" or "AREA" or "VOLUME" or "INTEGER";

        private static string SanitizarNombre(string nombre)
        {
            if (string.IsNullOrWhiteSpace(nombre)) return "param";
            // Reemplazar espacios y caracteres especiales con _
            var chars = nombre.Select(c =>
                char.IsLetterOrDigit(c) || c == '_' ? c : '_').ToArray();
            return new string(chars).Trim('_');
        }
    }

    // ============================================================
    // PARÁMETRO CALCULADO (fórmula compuesta)
    // ============================================================

    /// <summary>
    /// Un parámetro virtual calculado con una fórmula que combina
    /// parámetros nativos de Revit. No existe en el modelo, se computa
    /// durante la exportación.
    ///
    /// Variables disponibles en la fórmula:
    ///   {NombreParametro} → valor numérico del parámetro Revit
    ///   Operadores: + - * / ( )
    ///   Constantes: números decimales
    ///
    /// Ejemplos:
    ///   {Width} + 0.30                    → ancho del dintel
    ///   {Area} * {Espesor}                → volumen neto
    ///   ({Height} - 0.10) * {Length} * 2  → área de jamba
    ///   {Count} * 3.5                     → peso estimado
    /// </summary>
    public class ParamCalculado
    {
        /// <summary>
        /// Nombre descriptivo del parámetro calculado.
        /// Se usa como clave en el JSON exportado.
        /// Ejemplo: "AnchoDintel", "VolumenNeto", "AreaJamba"
        /// </summary>
        public string Nombre { get; set; } = string.Empty;

        /// <summary>
        /// Fórmula con variables entre llaves.
        /// Ejemplo: "{Width} + 0.30"
        /// </summary>
        public string Formula { get; set; } = string.Empty;

        /// <summary>Unidad del resultado (m, m2, m3, kg, und).</summary>
        public string Unidad { get; set; } = string.Empty;

        /// <summary>
        /// Nota para la IA explicando qué calcula esta fórmula
        /// y para qué partida es relevante.
        /// Ejemplo: "Longitud de dintel = ancho de puerta + 15cm
        /// por lado. Genera partida de dintel de HoAo."
        /// </summary>
        public string NotaIA { get; set; } = string.Empty;

        /// <summary>True si este parámetro calculado está activo.</summary>
        public bool Activo { get; set; } = true;

        /// <summary>
        /// Clave sanitizada para el JSON exportado.
        /// </summary>
        public string ClaveExport
        {
            get
            {
                if (string.IsNullOrWhiteSpace(Nombre)) return "calc";
                var chars = Nombre.Select(c =>
                    char.IsLetterOrDigit(c) || c == '_' ? c : '_').ToArray();
                return "calc_" + new string(chars).Trim('_');
            }
        }

        /// <summary>
        /// Extrae los nombres de variables usadas en la fórmula.
        /// Ejemplo: "{Width} + {Height}" → ["Width", "Height"]
        /// </summary>
        public List<string> VariablesUsadas()
        {
            var vars = new List<string>();
            int i = 0;
            while (i < Formula.Length)
            {
                if (Formula[i] == '{')
                {
                    int cierre = Formula.IndexOf('}', i + 1);
                    if (cierre > i + 1)
                    {
                        vars.Add(Formula.Substring(i + 1, cierre - i - 1).Trim());
                        i = cierre + 1;
                        continue;
                    }
                }
                i++;
            }
            return vars;
        }
    }

    // ============================================================
    // RESULTADO DE ESCANEO DE PARÁMETROS (para el wizard)
    // ============================================================

    /// <summary>
    /// Información de un parámetro disponible en una familia Revit.
    /// Se usa en el wizard para mostrar los parámetros seleccionables.
    /// </summary>
    public class ParamDisponible
    {
        /// <summary>Nombre del parámetro.</summary>
        public string Nombre { get; set; } = string.Empty;

        /// <summary>GUID del shared parameter (vacío si built-in/familia).</summary>
        public string Guid { get; set; } = string.Empty;

        /// <summary>Tipo de dato: TEXT, NUMBER, YESNO, etc.</summary>
        public string TipoDato { get; set; } = "TEXT";

        /// <summary>Origen: "Type" o "Instance".</summary>
        public string Origen { get; set; } = "Type";

        /// <summary>Valor de ejemplo (del primer tipo encontrado).</summary>
        public string ValorEjemplo { get; set; } = string.Empty;

        /// <summary>Grupo de parámetros en Revit (Identity Data, Dimensions, etc.).</summary>
        public string Grupo { get; set; } = string.Empty;

        /// <summary>True si es un shared parameter (tiene GUID propio).</summary>
        public bool EsShared => !string.IsNullOrWhiteSpace(Guid);

        /// <summary>True si ya es un parámetro SSA_* (ya se exporta automáticamente).</summary>
        public bool EsSSA => Nombre.StartsWith("SSA_", StringComparison.OrdinalIgnoreCase);

        /// <summary>True si es un parámetro built-in de Revit (Area, Volume, etc.).</summary>
        public bool EsBuiltIn { get; set; }
    }

    // ============================================================
    // FAMILIA ESCANEADA (para el wizard)
    // ============================================================

    /// <summary>
    /// Resumen de una familia encontrada en el modelo con sus
    /// parámetros disponibles. Se usa en el wizard.
    /// </summary>
    public class FamiliaEscaneada
    {
        /// <summary>Nombre de la familia.</summary>
        public string Familia { get; set; } = string.Empty;

        /// <summary>Categoría Revit.</summary>
        public string Categoria { get; set; } = string.Empty;

        /// <summary>Cantidad de tipos distintos de esta familia con instancias.</summary>
        public int CantTipos { get; set; }

        /// <summary>Cantidad total de instancias de esta familia.</summary>
        public int CantInstancias { get; set; }

        /// <summary>Nombres de los tipos encontrados.</summary>
        public List<string> NombresTipos { get; set; } = new();

        /// <summary>Parámetros disponibles (type + instance).</summary>
        public List<ParamDisponible> Parametros { get; set; } = new();
    }
}
