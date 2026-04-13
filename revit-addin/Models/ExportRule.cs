// Models/ExportRule.cs
// Modelo de datos para las reglas de exportación BOQ por tipo de elemento Revit.
// Cada regla mapea un ElementType del modelo a una o más partidas del presupuesto.
//
// Compatibilidad: los campos directos (CodigoPartida, NombreItem, etc.) son la
// "partida principal" de edición rápida. PartidasAsignadas es la lista extendida
// para multi-partida (muro + revoque + cerámica, etc.).
//
// Autor: SSA Ingenieria SRL

using System.Text.Json.Serialization;

namespace RvtConstructionOS.Models
{
    /// <summary>
    /// Regla de exportación para un tipo de elemento Revit específico.
    /// Define cómo se mide, nombra y agrupa en el presupuesto BOQ.
    /// Soporta múltiples partidas por tipo mediante PartidasAsignadas.
    /// </summary>
    public class ExportRule
    {
        // -----------------------------------------------------------------------
        // Identificación del tipo Revit (readonly — viene del modelo)
        // -----------------------------------------------------------------------

        /// <summary>UniqueId del ElementType en Revit. Clave de identificación.</summary>
        public string TypeUniqueId { get; set; } = string.Empty;

        /// <summary>Categoría Revit (Muros, Puertas, Ventanas, Losas, etc.).</summary>
        public string Categoria { get; set; } = string.Empty;

        /// <summary>Nombre de la familia (p.ej. "Muro Básico", "Puerta Simple").</summary>
        public string Familia { get; set; } = string.Empty;

        /// <summary>Nombre del tipo Revit (p.ej. "Muro 20cm Ladrillo").</summary>
        public string TipoRevit { get; set; } = string.Empty;

        // -----------------------------------------------------------------------
        // Control de inclusión
        // -----------------------------------------------------------------------

        /// <summary>True si este tipo se incluye en la exportación. Default: true.</summary>
        public bool Incluir { get; set; } = true;

        // -----------------------------------------------------------------------
        // Partida principal — edición rápida (un solo código)
        // Serializada directamente para compatibilidad con reglas existentes.
        // -----------------------------------------------------------------------

        /// <summary>Código de partida principal (p.ej. "04-10-10-001").</summary>
        public string CodigoPartida { get; set; } = string.Empty;

        /// <summary>Nombre descriptivo del ítem en el presupuesto.</summary>
        public string NombreItem { get; set; } = string.Empty;

        /// <summary>Rubro o capítulo (WBS Nivel 1, p.ej. "Albañilería").</summary>
        public string Rubro { get; set; } = string.Empty;

        /// <summary>Unidad de medida principal (m2, m3, ml, und, kg, ton).</summary>
        public string Unidad { get; set; } = string.Empty;

        /// <summary>
        /// Criterio de medición principal.
        /// Valores: AREA_NETA_INT, AREA_NETA_EXT, AREA_BRUTA, VOLUMEN, LONGITUD, CANTIDAD, PESO.
        /// </summary>
        public string CriterioMedicion { get; set; } = string.Empty;

        /// <summary>Factor de desperdicio (1.0 = sin desperdicio, 1.05 = 5%).</summary>
        public double FactorDesperdicio { get; set; } = 1.0;

        /// <summary>Observación general sobre esta regla.</summary>
        public string Observacion { get; set; } = string.Empty;

        // -----------------------------------------------------------------------
        // Partidas adicionales (multi-partida)
        // Para muro con cerámica + revoque + estructura como partidas separadas.
        // Si está vacía, solo aplica la partida principal de arriba.
        // -----------------------------------------------------------------------

        /// <summary>
        /// Partidas adicionales asignadas a este tipo de elemento.
        /// Permiten múltiples líneas BOQ por tipo:
        ///   muro ladrillo (m²) + revoque int (m²) + cerámica hasta 80cm (m²).
        /// Se exportan junto a la partida principal si CodigoPartida no está vacío,
        /// o en su lugar si CodigoPartida sí está vacío.
        /// </summary>
        public List<PartidaAsignada> PartidasAsignadas { get; set; } = new();

        // -----------------------------------------------------------------------
        // Opciones avanzadas
        // -----------------------------------------------------------------------

        /// <summary>
        /// Si true, genera una partida por cada capa del CompoundStructure.
        /// Aplica a muros, pisos y techos con estructura compuesta.
        /// </summary>
        public bool DesglosarCapas { get; set; } = false;

        /// <summary>
        /// Keynote leído del modelo Revit en el último escaneo.
        /// </summary>
        public string KeynoteSeed { get; set; } = string.Empty;

        // -----------------------------------------------------------------------
        // Helpers para construir la partida principal desde código
        // -----------------------------------------------------------------------

        /// <summary>
        /// Convierte la partida principal (campos directos) en un PartidaAsignada.
        /// Útil para procesar de forma uniforme con las partidas adicionales.
        /// </summary>
        [JsonIgnore]
        public PartidaAsignada? PartidaPrincipalComoObjeto =>
            string.IsNullOrWhiteSpace(CodigoPartida) ? null : new PartidaAsignada
            {
                CodigoPartida   = CodigoPartida,
                Descripcion     = NombreItem,
                Rubro           = Rubro,
                UnidadElegida   = string.IsNullOrWhiteSpace(Unidad) ? UnidadesBOQ.M2 : Unidad,
                CriterioCalculo = string.IsNullOrWhiteSpace(CriterioMedicion)
                                    ? CriteriosCalculo.AreaNetaInt : CriterioMedicion,
                Factor          = FactorDesperdicio > 0 ? FactorDesperdicio : 1.0,
                Orden           = 0,
                Activa          = true,
            };

        /// <summary>
        /// Todas las partidas activas en orden: principal primero, luego adicionales.
        /// </summary>
        [JsonIgnore]
        public IEnumerable<PartidaAsignada> TodasLasPartidas
        {
            get
            {
                if (PartidasAsignadas.Count > 0)
                    return PartidasAsignadas.Where(p => p.Activa).OrderBy(p => p.Orden);

                var principal = PartidaPrincipalComoObjeto;
                return principal != null ? new[] { principal } : Enumerable.Empty<PartidaAsignada>();
            }
        }

        // -----------------------------------------------------------------------
        // Helper fluido para construir reglas desde código
        // -----------------------------------------------------------------------

        /// <summary>Agrega una partida adicional (fluido).</summary>
        public ExportRule AgregarPartida(string codigo, string desc, string unidad,
            string criterio, double factor = 1.0, int orden = 10)
        {
            PartidasAsignadas.Add(new PartidaAsignada
            {
                CodigoPartida   = codigo,
                Descripcion     = desc,
                UnidadElegida   = unidad,
                CriterioCalculo = criterio,
                Factor          = factor,
                Orden           = orden,
            });
            return this;
        }

        /// <summary>Agrega una partida de zona parcial (cerámica hasta X metros).</summary>
        public ExportRule AgregarPartidaZona(string codigo, string desc, string unidad,
            double alturaDesdeM, double alturaHastaM, double factor = 1.0, int orden = 20)
        {
            PartidasAsignadas.Add(new PartidaAsignada
            {
                CodigoPartida   = codigo,
                Descripcion     = desc,
                UnidadElegida   = unidad,
                CriterioCalculo = CriteriosCalculo.AreaNetaInt,
                AlturaDesdeM    = alturaDesdeM,
                AlturaHastaM    = alturaHastaM,
                Factor          = factor,
                Orden           = orden,
            });
            return this;
        }
    }

    // ============================================================
    // CONJUNTO DE REGLAS (persistencia por proyecto)
    // ============================================================

    /// <summary>
    /// Conjunto de reglas de exportación para un modelo.
    /// Se serializa a JSON para persistencia entre sesiones.
    /// </summary>
    public class ExportRuleSet
    {
        public string   Version           { get; set; } = "2.0";
        public string   NombrePlantilla   { get; set; } = "Sin nombre";
        public DateTime FechaModificacion { get; set; } = DateTime.Now;
        public string   NombreModelo      { get; set; } = string.Empty;
        public List<ExportRule> Reglas    { get; set; } = new();

        /// <summary>
        /// Perfiles de parámetros personalizados por familia.
        /// Cada perfil define qué parámetros extra exportar y
        /// fórmulas calculadas, con notas para la IA.
        /// </summary>
        public List<FamilyParamProfile> PerfilesParametros { get; set; } = new();

        /// <summary>Busca el perfil de una familia por categoría+nombre.</summary>
        public FamilyParamProfile? BuscarPerfil(string categoria, string familia)
        {
            string clave = $"{categoria}|{familia}";
            return PerfilesParametros.FirstOrDefault(p =>
                p.Clave.Equals(clave, StringComparison.OrdinalIgnoreCase));
        }
    }

    // ============================================================
    // PLANTILLA DE EXPORTACIÓN (reutilizable entre proyectos)
    // ============================================================

    /// <summary>Criterio de aplicación de una regla de plantilla.</summary>
    public enum CriterioAplicacion
    {
        PorCategoria,
        PorFamilia,
        PorTipoExacto,
    }

    /// <summary>
    /// Regla de plantilla: usa patrones en lugar de UniqueId para ser reutilizable.
    /// </summary>
    public class PlantillaRegla
    {
        public CriterioAplicacion   Criterio      { get; set; } = CriterioAplicacion.PorCategoria;
        public string               Categoria     { get; set; } = string.Empty;
        public string               FamiliaPatron { get; set; } = "*";
        public string               TipoPatron    { get; set; } = "*";
        public List<PartidaAsignada> Partidas      { get; set; } = new();
        /// <summary>Si true, sobreescribe partidas ya asignadas. False = solo si vacío.</summary>
        public bool                 Sobreescribir { get; set; } = false;
    }

    /// <summary>
    /// Plantilla de exportación reutilizable entre proyectos.
    /// </summary>
    public class PlantillaExport
    {
        public string              Nombre          { get; set; } = string.Empty;
        public string              Descripcion     { get; set; } = string.Empty;
        public string              Version         { get; set; } = "1.0";
        public string              Autor           { get; set; } = string.Empty;
        public DateTime            FechaCreacion   { get; set; } = DateTime.Now;
        public List<PlantillaRegla> Reglas         { get; set; } = new();
        public List<PartidaCatalogo> CatalogoEmbebido { get; set; } = new();
    }
}
