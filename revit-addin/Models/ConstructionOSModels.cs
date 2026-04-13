// Models/ConstructionOSModels.cs
// DTOs para respuestas del servidor ConstructionOS.
// Autor: SSA Ingenieria SRL

using System.Text.Json.Serialization;

namespace RvtConstructionOS.Models
{
    // ============================================================
    // Respuesta de list_projects
    // ============================================================

    public class ListProjectsResponse
    {
        [JsonPropertyName("projects")]
        public List<ProjectSummary> Projects { get; set; } = new();

        [JsonPropertyName("count")]
        public int Count { get; set; }
    }

    public class ProjectSummary
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("nombre")]
        public string Nombre { get; set; } = string.Empty;

        [JsonPropertyName("descripcion")]
        public string? Descripcion { get; set; }

        [JsonPropertyName("tipologia")]
        public string? Tipologia { get; set; }

        [JsonPropertyName("estado")]
        public string Estado { get; set; } = "activo";
    }

    // ============================================================
    // Respuesta de import_bim_elements
    // ============================================================

    public class ImportBimResponse
    {
        [JsonPropertyName("importacion_id")]
        public string ImportacionId { get; set; } = string.Empty;

        [JsonPropertyName("total_elementos")]
        public int TotalElementos { get; set; }

        [JsonPropertyName("con_categoria")]
        public int ConCategoria { get; set; }

        [JsonPropertyName("sin_categoria")]
        public int SinCategoria { get; set; }

        [JsonPropertyName("categorias_desconocidas")]
        public List<string> CategoriasDesconocidas { get; set; } = new();

        [JsonPropertyName("message")]
        public string Message { get; set; } = string.Empty;
    }

    // ============================================================
    // Respuesta de match_bim_elements
    // ============================================================

    public class MatchBimResponse
    {
        [JsonPropertyName("original_elements")]
        public int OriginalElements { get; set; }

        [JsonPropertyName("matched")]
        public int Matched { get; set; }

        [JsonPropertyName("derived_created")]
        public int DerivedCreated { get; set; }

        [JsonPropertyName("no_match")]
        public int NoMatch { get; set; }

        [JsonPropertyName("message")]
        public string Message { get; set; } = string.Empty;
    }

    // ============================================================
    // Respuesta de confirm_bim_match
    // ============================================================

    public class ConfirmBimResponse
    {
        [JsonPropertyName("created")]
        public int Created { get; set; }

        [JsonPropertyName("updated")]
        public int Updated { get; set; }

        [JsonPropertyName("total_partidas")]
        public int TotalPartidas { get; set; }

        [JsonPropertyName("message")]
        public string Message { get; set; } = string.Empty;
    }

    // ============================================================
    // Respuesta de get_bim_elements (para la vista de resultados)
    // ============================================================

    public class BimElementsResponse
    {
        [JsonPropertyName("elements")]
        public List<BimElementDto> Elements { get; set; } = new();

        [JsonPropertyName("count")]
        public int Count { get; set; }

        [JsonPropertyName("total")]
        public int Total { get; set; }
    }

    public class BimElementDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("revit_id")]
        public string? RevitId { get; set; }

        [JsonPropertyName("familia")]
        public string? Familia { get; set; }

        [JsonPropertyName("tipo")]
        public string? Tipo { get; set; }

        [JsonPropertyName("metrado_calculado")]
        public decimal? MetradoCalculado { get; set; }

        [JsonPropertyName("estado")]
        public string Estado { get; set; } = "pendiente";

        [JsonPropertyName("revit_categorias")]
        public RevitCategoriaDto? RevitCategoria { get; set; }

        [JsonPropertyName("partidas")]
        public PartidaDto? Partida { get; set; }
    }

    public class RevitCategoriaDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("nombre")]
        public string Nombre { get; set; } = string.Empty;

        [JsonPropertyName("nombre_es")]
        public string? NombreEs { get; set; }
    }

    public class PartidaDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("nombre")]
        public string Nombre { get; set; } = string.Empty;

        [JsonPropertyName("unidad")]
        public string Unidad { get; set; } = string.Empty;

        [JsonPropertyName("capitulo")]
        public string? Capitulo { get; set; }
    }
}
