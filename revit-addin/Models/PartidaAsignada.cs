// Models/PartidaAsignada.cs
// Asignación flexible de una partida BOQ a un tipo de elemento Revit.
// Un elemento puede tener N partidas asignadas con unidades y criterios
// distintos (p.ej. muro con ladrillo + revoque + cerámica = 3 partidas).
//
// Autor: SSA Ingenieria SRL

namespace RvtConstructionOS.Models
{
    // ============================================================
    // UNIDADES VÁLIDAS
    // ============================================================

    /// <summary>
    /// Unidades de medida admitidas en el BOQ.
    /// </summary>
    public static class UnidadesBOQ
    {
        public const string M2   = "m2";
        public const string M3   = "m3";
        public const string ML   = "ml";
        public const string UND  = "und";
        public const string KG   = "kg";
        public const string TON  = "ton";
        public const string GLB  = "glb";

        /// <summary>Lista completa para UI ComboBox.</summary>
        public static readonly string[] Todas = { M2, M3, ML, UND, KG, TON, GLB };
    }

    // ============================================================
    // CRITERIOS DE CÁLCULO
    // ============================================================

    /// <summary>
    /// Criterios de cálculo de cantidad para una partida asignada.
    /// Determina qué campo de BimElement se usa como base.
    /// </summary>
    public static class CriteriosCalculo
    {
        public const string AreaNetaInt  = "AREA_NETA_INT";   // AreaNetaIntM2
        public const string AreaNetaExt  = "AREA_NETA_EXT";   // AreaNetaExtM2
        public const string AreaBruta    = "AREA_BRUTA";       // AreaBrutaIntM2
        public const string Volumen      = "VOLUMEN";           // VolumenM3
        public const string Longitud     = "LONGITUD";          // LongitudML
        public const string Cantidad     = "CANTIDAD";          // Cantidad (int)
        public const string Peso         = "PESO";              // PesoTotalKg (acero)
        public const string PorAltura    = "LONGITUD_X_ALTURA"; // LongitudML * AlturaCustom (muros→ml)

        public static readonly string[] Todos =
        {
            AreaNetaInt, AreaNetaExt, AreaBruta, Volumen, Longitud, Cantidad, Peso, PorAltura
        };
    }

    // ============================================================
    // PARTIDA ASIGNADA
    // ============================================================

    /// <summary>
    /// Una partida BOQ asignada a un tipo de elemento Revit.
    /// Cada ExportRule puede tener N instancias de esta clase,
    /// permitiendo múltiples partidas por tipo (muro, viga, losa, etc.)
    /// con unidades y criterios de cálculo distintos.
    /// </summary>
    public class PartidaAsignada
    {
        // -----------------------------------------------------------------------
        // Identificación en el catálogo
        // -----------------------------------------------------------------------

        /// <summary>Código de partida en el presupuesto (p.ej. "04-10-10-001").</summary>
        public string CodigoPartida { get; set; } = string.Empty;

        /// <summary>Descripción de la partida (editable por el usuario).</summary>
        public string Descripcion { get; set; } = string.Empty;

        /// <summary>Rubro/capítulo de la partida (p.ej. "Albañilería", "Estructuras").</summary>
        public string Rubro { get; set; } = string.Empty;

        // -----------------------------------------------------------------------
        // Unidad y criterio de cálculo (elegibles por el usuario)
        // -----------------------------------------------------------------------

        /// <summary>
        /// Unidad de medida elegida por el usuario para esta partida.
        /// Valores: m2, m3, ml, und, kg, ton, glb.
        /// </summary>
        public string UnidadElegida { get; set; } = UnidadesBOQ.M2;

        /// <summary>
        /// Criterio de cálculo de cantidad.
        /// Determina qué campo de BimElement se usa.
        /// </summary>
        public string CriterioCalculo { get; set; } = CriteriosCalculo.AreaNetaInt;

        /// <summary>
        /// Altura personalizada en metros para criterio LONGITUD_X_ALTURA (muros→ml).
        /// Si es 0 se usa BimElement.AlturaPromedio del modelo.
        /// </summary>
        public double AlturaCustomM { get; set; } = 0;

        // -----------------------------------------------------------------------
        // Ajuste de cantidad
        // -----------------------------------------------------------------------

        /// <summary>
        /// Factor de desperdicio / rendimiento (1.0 = sin desperdicio, 1.05 = 5%).
        /// Se multiplica sobre la cantidad calculada.
        /// </summary>
        public double Factor { get; set; } = 1.0;

        /// <summary>
        /// Offset de altura para partidas de zona parcial de muro.
        /// Ejemplo: cerámica desde 0.0 m hasta AlturaZonaM (0.80m).
        /// Si ambos son 0, se usa la altura total del muro.
        /// </summary>
        public double AlturaDesdeM { get; set; } = 0;

        /// <summary>
        /// Altura límite para partidas de zona parcial de muro.
        /// 0 = sin límite (usa la altura total).
        /// </summary>
        public double AlturaHastaM { get; set; } = 0;

        // -----------------------------------------------------------------------
        // Control
        // -----------------------------------------------------------------------

        /// <summary>True si esta partida está activa en la exportación.</summary>
        public bool Activa { get; set; } = true;

        /// <summary>Orden de aparición en el BOQ (menor = primero).</summary>
        public int Orden { get; set; } = 0;

        /// <summary>Observación interna (no se exporta a Odoo).</summary>
        public string Observacion { get; set; } = string.Empty;

        // -----------------------------------------------------------------------
        // Cálculo de cantidad (lógica pura, sin dependencia de Revit API)
        // -----------------------------------------------------------------------

        /// <summary>
        /// Calcula la cantidad para esta partida dado un BimElement.
        /// Aplica el criterio de cálculo, zona parcial y factor.
        /// </summary>
        public double CalcularCantidad(BimElement elem)
        {
            double base_ = CriterioCalculo switch
            {
                CriteriosCalculo.AreaNetaInt  => elem.AreaNetaIntM2,
                CriteriosCalculo.AreaNetaExt  => elem.AreaNetaExtM2,
                CriteriosCalculo.AreaBruta    => elem.AreaBrutaIntM2,
                CriteriosCalculo.Volumen      => elem.VolumenM3,
                CriteriosCalculo.Longitud     => elem.LongitudML,
                CriteriosCalculo.Cantidad     => elem.Cantidad,
                CriteriosCalculo.Peso         => elem.PesoTotalKg,
                CriteriosCalculo.PorAltura    =>
                    elem.LongitudML * (AlturaCustomM > 0 ? AlturaCustomM : elem.AlturaPromedio),
                _                            => elem.AreaNetaIntM2,
            };

            // Aplicar zona parcial de muro (cerámica hasta X metros)
            if (AlturaHastaM > 0 && elem.AlturaPromedio > 0 && CriterioCalculo == CriteriosCalculo.AreaNetaInt)
            {
                double alturaTotal = elem.AlturaPromedio;
                double desde = Math.Max(0, AlturaDesdeM);
                double hasta = Math.Min(alturaTotal, AlturaHastaM);
                double fraccion = (hasta - desde) / alturaTotal;
                base_ = Math.Max(0, base_ * fraccion);
            }

            return Math.Round(base_ * Factor, 4);
        }

        /// <summary>Etiqueta resumen para mostrar en UI.</summary>
        public string Etiqueta =>
            string.IsNullOrWhiteSpace(CodigoPartida)
                ? $"(sin código) {Descripcion}"
                : $"{CodigoPartida} — {Descripcion} [{UnidadElegida}]";
    }

    // ============================================================
    // CATÁLOGO DE PARTIDAS (biblioteca maestra)
    // ============================================================

    /// <summary>
    /// Una partida en el catálogo maestro disponible para asignar a tipos Revit.
    /// Funciona como "biblioteca" desde la que el usuario selecciona partidas.
    /// Se puede importar/exportar en Excel/CSV.
    /// </summary>
    public class PartidaCatalogo
    {
        /// <summary>Código único de partida.</summary>
        public string Codigo { get; set; } = string.Empty;

        /// <summary>Descripción de la partida.</summary>
        public string Descripcion { get; set; } = string.Empty;

        /// <summary>Disciplina (Arquitectura, Estructuras, Sanitario, Eléctrico, etc.).</summary>
        public string Disciplina { get; set; } = string.Empty;

        /// <summary>Rubro o capítulo (WBS Nivel 1).</summary>
        public string Rubro { get; set; } = string.Empty;

        /// <summary>Unidades válidas para esta partida (lista separada por comas o array).</summary>
        public List<string> UnidadesValidas { get; set; } = new() { UnidadesBOQ.M2 };

        /// <summary>Unidad por defecto.</summary>
        public string UnidadDefault { get; set; } = UnidadesBOQ.M2;

        /// <summary>Criterio de cálculo por defecto.</summary>
        public string CriterioDefault { get; set; } = CriteriosCalculo.AreaNetaInt;

        /// <summary>Observaciones / notas de aplicación.</summary>
        public string Observaciones { get; set; } = string.Empty;

        /// <summary>True si pertenece al catálogo built-in (no editable por el usuario).</summary>
        public bool EsBuiltIn { get; set; } = false;

        /// <summary>Crea un PartidaAsignada listo para agregar a un ExportRule.</summary>
        public PartidaAsignada CrearAsignacion() => new()
        {
            CodigoPartida  = Codigo,
            Descripcion    = Descripcion,
            Rubro          = Rubro,
            UnidadElegida  = UnidadDefault,
            CriterioCalculo = CriterioDefault,
        };
    }
}
