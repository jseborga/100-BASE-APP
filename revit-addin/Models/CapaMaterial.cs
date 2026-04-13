// Models/CapaMaterial.cs
// Representa una capa estructural de un elemento compuesto (muro, piso, techo).
// Generada al leer CompoundStructure de la API de Revit.
// Cada capa puede convertirse en una PartidaDerivada cuando DesglosarCapas = true en ExportRule.
//
// Autor: SSA Ingenieria SRL

namespace RvtConstructionOS.Models
{
    /// <summary>
    /// Capa estructural extraída del CompoundStructure de un WallType / FloorType / CeilingType.
    /// Permite el Material Takeoff multicapa (desglosar un muro en ladrillo + revoque + aislante, etc.)
    /// </summary>
    public class CapaMaterial
    {
        // -----------------------------------------------------------------------
        // Identidad de la capa
        // -----------------------------------------------------------------------

        /// <summary>Nombre del material asignado en Revit (p.ej. "Ladrillo Cerámico 6H").</summary>
        public string NombreMaterial { get; set; } = string.Empty;

        /// <summary>
        /// Función estructural de la capa.
        /// Valores posibles: Structure, Substrate, Finish1, Finish2, Membrane, InsulationAirLayer.
        /// Mapeado desde <c>MaterialFunctionAssignment</c> en la API de Revit.
        /// </summary>
        public string Funcion { get; set; } = string.Empty;

        /// <summary>Índice de orden en la estructura (0 = cara exterior, n = cara interior).</summary>
        public int Indice { get; set; }

        // -----------------------------------------------------------------------
        // Dimensiones
        // -----------------------------------------------------------------------

        /// <summary>Espesor de la capa en metros (convertido desde pies internos de Revit).</summary>
        public double EspesorM { get; set; }

        /// <summary>
        /// Área superficial de la capa en m².
        /// Igual al área neta del elemento host: la capa ocupa la misma superficie, no cambia el área.
        /// </summary>
        public double AreaM2 { get; set; }

        /// <summary>
        /// Volumen de la capa en m³.
        /// Calculado como AreaM2 × EspesorM.
        /// </summary>
        public double VolumenM3 { get; set; }

        // -----------------------------------------------------------------------
        // BOQ
        // -----------------------------------------------------------------------

        /// <summary>
        /// Descripción sugerida para el BOQ, generada automáticamente.
        /// El usuario puede sobreescribirla en la interfaz.
        /// Ejemplo: "Ladrillo Cerámico 6H e=150mm".
        /// </summary>
        public string DescripcionSugerida { get; set; } = string.Empty;

        /// <summary>
        /// Unidad de medida sugerida según la función de la capa.
        /// Structure → m³  |  Finish1/Finish2 → m²  |  resto → m².
        /// </summary>
        public string UnidadSugerida => Funcion == "Structure" ? "m³" : "m²";

        /// <summary>
        /// Cantidad sugerida para el BOQ según la unidad.
        /// Si UnidadSugerida = m³ → VolumenM3, si m² → AreaM2.
        /// </summary>
        public double CantidadSugerida => UnidadSugerida == "m³" ? VolumenM3 : AreaM2;
    }
}
