// Models/FiltroExtraccion.cs
// Parámetros de alcance para la extracción BIM.
// Permite limitar la extracción a una vista activa, una selección o una fase,
// en lugar de procesar siempre el modelo completo.
//
// Uso:
//   var filtro = new FiltroExtraccion { Alcance = TipoAlcance.VistaActiva, VistaId = uiDoc.ActiveView.Id };
//   var result = extractionService.Extraer(doc, filtro);
//
// Autor: SSA Ingenieria SRL

using Autodesk.Revit.DB;

namespace RvtConstructionOS.Models
{
    /// <summary>
    /// Define el alcance de la extracción BIM: qué elementos del modelo se procesan.
    /// Se construye antes de llamar a <see cref="Services.RevitExtractionService.Extraer"/>.
    /// </summary>
    public class FiltroExtraccion
    {
        // -----------------------------------------------------------------------
        // Tipo de alcance
        // -----------------------------------------------------------------------

        public enum TipoAlcance
        {
            /// <summary>Procesa todos los elementos del modelo (default).</summary>
            ModeloCompleto,

            /// <summary>Solo los elementos visibles en la vista activa de Revit.</summary>
            VistaActiva,

            /// <summary>Solo los elementos actualmente seleccionados en Revit.</summary>
            Seleccion,

            /// <summary>Solo los elementos pertenecientes a una fase de construcción específica.</summary>
            Fase,
        }

        // -----------------------------------------------------------------------
        // Propiedades de configuración
        // -----------------------------------------------------------------------

        /// <summary>Tipo de alcance aplicado en la extracción.</summary>
        public TipoAlcance Alcance { get; set; } = TipoAlcance.ModeloCompleto;

        /// <summary>
        /// ElementId de la vista activa (solo para <see cref="TipoAlcance.VistaActiva"/>).
        /// Se obtiene de <c>UIDocument.ActiveView.Id</c> antes de llamar a Extraer().
        /// </summary>
        public ElementId? VistaId { get; set; }

        /// <summary>
        /// IDs de los elementos seleccionados (solo para <see cref="TipoAlcance.Seleccion"/>).
        /// Se obtiene de <c>UIDocument.Selection.GetElementIds()</c> antes de llamar a Extraer().
        /// </summary>
        public ICollection<ElementId>? ElementosIds { get; set; }

        /// <summary>
        /// Nombre exacto de la fase en Revit (solo para <see cref="TipoAlcance.Fase"/>).
        /// Ejemplo: "Fase 1: Estructura", "Ampliación 2026".
        /// </summary>
        public string FaseNombre { get; set; } = string.Empty;

        // -----------------------------------------------------------------------
        // Fábrica
        // -----------------------------------------------------------------------

        /// <summary>Extracción del modelo completo (default).</summary>
        public static FiltroExtraccion Completo => new();

        /// <summary>Extracción de la vista activa.</summary>
        public static FiltroExtraccion DeVista(ElementId viewId) =>
            new() { Alcance = TipoAlcance.VistaActiva, VistaId = viewId };

        /// <summary>Extracción de una selección de elementos.</summary>
        public static FiltroExtraccion DeSeleccion(ICollection<ElementId> ids) =>
            new() { Alcance = TipoAlcance.Seleccion, ElementosIds = ids };

        /// <summary>Extracción por fase.</summary>
        public static FiltroExtraccion DeFase(string nombreFase) =>
            new() { Alcance = TipoAlcance.Fase, FaseNombre = nombreFase };

        /// <summary>Descripción legible del filtro activo (para la barra de estado de la UI).</summary>
        public string Descripcion => Alcance switch
        {
            TipoAlcance.VistaActiva  => "Vista activa",
            TipoAlcance.Seleccion    => $"Selección ({ElementosIds?.Count ?? 0} elementos)",
            TipoAlcance.Fase         => $"Fase: {FaseNombre}",
            _                        => "Modelo completo",
        };
    }
}
