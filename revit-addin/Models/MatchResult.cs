// Models/MatchResult.cs
// Resultado del motor de homologación para un BimElement.
// Implementa el § 8 de la SRS del SSA BIM Quant Link:
// scoring 0-100, 6 niveles de match, estados de aprobación.
//
// Autor: SSA Ingenieria SRL

namespace RvtConstructionOS.Models
{
    // ============================================================
    // ESTADO DE HOMOLOGACIÓN
    // ============================================================

    /// <summary>
    /// Estado del elemento después de pasar por el motor de homologación.
    /// Determina si requiere revisión humana o fue aprobado automáticamente.
    /// </summary>
    public enum EstadoMatch
    {
        /// <summary>Sin procesar por el motor de matching.</summary>
        SinProcesar,

        /// <summary>Score ≥ 90 — aprobado automáticamente, listo para exportar.</summary>
        AprobadoAuto,

        /// <summary>Score 60–89 — match sugerido pero requiere revisión humana.</summary>
        RevisarSugerido,

        /// <summary>Score < 60 — no hay match confiable, requiere asignación manual.</summary>
        ManualObligatorio,

        /// <summary>Score = 0 — ninguna regla aplica.</summary>
        SinMatch,

        /// <summary>El usuario aprobó manualmente una sugerencia o asignó un código.</summary>
        AprobadoManual,

        /// <summary>El elemento fue excluido explícitamente del BOQ.</summary>
        Excluido,
    }

    // ============================================================
    // SUGERENCIA ALTERNATIVA
    // ============================================================

    /// <summary>
    /// Una partida alternativa sugerida por el motor de homologación (top 3).
    /// Se muestra cuando el match principal no es confiable (score 60–89).
    /// </summary>
    public class MatchSugerencia
    {
        /// <summary>Código de partida sugerido.</summary>
        public string CodigoPartida { get; set; } = string.Empty;

        /// <summary>Descripción de la partida sugerida.</summary>
        public string Descripcion { get; set; } = string.Empty;

        /// <summary>Unidad de medida de la sugerencia.</summary>
        public string Unidad { get; set; } = string.Empty;

        /// <summary>Score de confianza de esta sugerencia (0-100).</summary>
        public int Score { get; set; }

        /// <summary>Nivel de matching que generó esta sugerencia (1-6).</summary>
        public int Nivel { get; set; }

        /// <summary>ID de la regla que generó esta sugerencia.</summary>
        public string ReglId { get; set; } = string.Empty;

        /// <summary>Descripción humana del criterio que generó el match.</summary>
        public string CriterioMatch { get; set; } = string.Empty;
    }

    // ============================================================
    // RESULTADO PRINCIPAL
    // ============================================================

    /// <summary>
    /// Resultado completo del motor de homologación para un BimElement.
    /// Contiene la partida asignada, el score, el nivel de matching
    /// y las sugerencias alternativas.
    /// </summary>
    public class MatchResult
    {
        // -----------------------------------------------------------------------
        // Partida principal asignada
        // -----------------------------------------------------------------------

        /// <summary>Código de partida asignado (mejor match).</summary>
        public string CodigoPartida { get; set; } = string.Empty;

        /// <summary>Descripción de la partida asignada.</summary>
        public string DescripcionPartida { get; set; } = string.Empty;

        /// <summary>Unidad de medida de la partida asignada.</summary>
        public string Unidad { get; set; } = string.Empty;

        /// <summary>Criterio de medición: AREA_NETA, VOLUMEN, LONGITUD, CANTIDAD.</summary>
        public string CriterioMedicion { get; set; } = string.Empty;

        // -----------------------------------------------------------------------
        // Métricas del match
        // -----------------------------------------------------------------------

        /// <summary>
        /// Score de confianza del match (0-100).
        /// 100 = código directo | 90 = familia/tipo exacto | 80 = cat+mat+esp
        /// 70 = cat+mat | 60 = cat+contexto | 50 = cat sola | 0 = sin match
        /// </summary>
        public int Score { get; set; }

        /// <summary>
        /// Nivel de matching que generó el resultado (1-6).
        /// 1=CódigoDirecto | 2=FamiliaTipoExacto | 3=Cat+Mat+Esp | 4=Cat+Mat
        /// 5=Cat+Contexto | 6=CatSola | 0=SinMatch
        /// </summary>
        public int NivelMatch { get; set; }

        /// <summary>Estado derivado del score.</summary>
        public EstadoMatch Estado { get; set; } = EstadoMatch.SinProcesar;

        /// <summary>
        /// Descripción legible del criterio que generó el match.
        /// Ejemplo: "Familia 'Muro Básico' + Tipo 'LAD-15cm' → exacto".
        /// </summary>
        public string CriterioMatch { get; set; } = string.Empty;

        /// <summary>ID de la regla MappingRule que generó el match (para auditoría).</summary>
        public string ReglaId { get; set; } = string.Empty;

        // -----------------------------------------------------------------------
        // Sugerencias alternativas (top 3)
        // -----------------------------------------------------------------------

        /// <summary>
        /// Hasta 3 partidas alternativas ordenadas por score descendente.
        /// Se muestran cuando Estado = RevisarSugerido o ManualObligatorio.
        /// </summary>
        public List<MatchSugerencia> Sugerencias { get; set; } = new();

        // -----------------------------------------------------------------------
        // Control de revisión humana
        // -----------------------------------------------------------------------

        /// <summary>
        /// Si true, el usuario aprobó manualmente este match (sobrescribe el auto).
        /// </summary>
        public bool AprobadoManualmente { get; set; }

        /// <summary>Nota del revisor (para auditoría).</summary>
        public string NotaRevisor { get; set; } = string.Empty;

        // -----------------------------------------------------------------------
        // Factories
        // -----------------------------------------------------------------------

        internal static MatchResult SinMatch() => new()
        {
            Score    = 0,
            NivelMatch = 0,
            Estado   = EstadoMatch.SinMatch,
            CriterioMatch = "Ninguna regla aplica — asignación manual requerida",
        };

        internal static MatchResult DesdeCodigo(string codigo, string descripcion, string unidad, string criterio) => new()
        {
            CodigoPartida     = codigo,
            DescripcionPartida = descripcion,
            Unidad            = unidad,
            CriterioMedicion  = criterio,
            Score             = 100,
            NivelMatch        = 1,
            Estado            = EstadoMatch.AprobadoAuto,
            CriterioMatch     = "Nivel 1 — código directo en el elemento",
        };

        /// <summary>Calcula el EstadoMatch en función del score.</summary>
        internal static EstadoMatch EstadoDesdeScore(int score) => score switch
        {
            >= 90 => EstadoMatch.AprobadoAuto,
            >= 60 => EstadoMatch.RevisarSugerido,
            >  0  => EstadoMatch.ManualObligatorio,
            _     => EstadoMatch.SinMatch,
        };

        /// <summary>Etiqueta corta para mostrar en la UI.</summary>
        public string EtiquetaEstado => Estado switch
        {
            EstadoMatch.AprobadoAuto      => $"✔ Auto ({Score})",
            EstadoMatch.RevisarSugerido   => $"⚠ Revisar ({Score})",
            EstadoMatch.ManualObligatorio => $"✗ Manual ({Score})",
            EstadoMatch.SinMatch          => "✗ Sin match",
            EstadoMatch.AprobadoManual    => "✔ Manual",
            EstadoMatch.Excluido          => "— Excluido",
            _                             => "…",
        };
    }
}
