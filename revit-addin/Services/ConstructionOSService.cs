// Services/ConstructionOSService.cs
// Cliente REST para ConstructionOS webhook API.
// Reemplaza OdooService (917 lineas JSON-RPC + cookies) por ~300 lineas REST + Bearer.
// Autor: SSA Ingenieria SRL

using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using RvtConstructionOS.Models;

namespace RvtConstructionOS.Services
{
    public class ConstructionOSService
    {
        private readonly HttpClient _http;
        private readonly AppConfig _config;

        private static readonly JsonSerializerOptions JsonOpts = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        };

        public ConstructionOSService(AppConfig config)
        {
            _config = config;
            _http = new HttpClient();
            _http.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", config.ApiKey);
            _http.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("application/json"));
        }

        // ============================================================
        // Generic action caller
        // ============================================================

        private async Task<JsonNode?> CallActionAsync(string action, object? parameters = null)
        {
            var url = $"{_config.Url.TrimEnd('/')}/api/webhooks/mcp";

            var payload = new { action, @params = parameters ?? new { } };
            string json = JsonSerializer.Serialize(payload, JsonOpts);

            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await _http.PostAsync(url, content);

            string body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                JsonNode? errNode = null;
                try { errNode = JsonNode.Parse(body); } catch { }
                string errMsg = errNode?["error"]?.GetValue<string>() ?? response.ReasonPhrase ?? "Unknown error";
                throw new HttpRequestException($"ConstructionOS API error ({(int)response.StatusCode}): {errMsg}");
            }

            return JsonNode.Parse(body);
        }

        private async Task<T> CallActionAsync<T>(string action, object? parameters = null)
        {
            var node = await CallActionAsync(action, parameters);
            string json = node?.ToJsonString() ?? "{}";
            return JsonSerializer.Deserialize<T>(json, JsonOpts)
                ?? throw new InvalidOperationException($"Failed to deserialize response for action '{action}'");
        }

        // ============================================================
        // Read operations
        // ============================================================

        public async Task<ListProjectsResponse> ListProjectsAsync(string? estado = null, int limit = 50)
        {
            return await CallActionAsync<ListProjectsResponse>("list_projects", new { estado, limit });
        }

        public async Task<JsonNode?> GetProjectAsync(string proyectoId)
        {
            return await CallActionAsync("get_project", new { proyecto_id = proyectoId });
        }

        public async Task<BimElementsResponse> GetBimElementsAsync(string importacionId, string? estado = null, int limit = 500)
        {
            return await CallActionAsync<BimElementsResponse>("get_bim_elements", new
            {
                importacion_id = importacionId,
                estado,
                limit,
            });
        }

        public async Task<JsonNode?> GetBimImportsAsync(string proyectoId)
        {
            return await CallActionAsync("get_bim_imports", new { proyecto_id = proyectoId });
        }

        // ============================================================
        // Write operations — BIM workflow
        // ============================================================

        public async Task<ImportBimResponse> ImportBimElementsAsync(
            string proyectoId,
            string archivoNombre,
            List<BimElementPayload> elementos)
        {
            return await CallActionAsync<ImportBimResponse>("import_bim_elements", new
            {
                proyecto_id = proyectoId,
                archivo_nombre = archivoNombre,
                elementos,
            });
        }

        public async Task<MatchBimResponse> MatchBimElementsAsync(string importacionId)
        {
            return await CallActionAsync<MatchBimResponse>("match_bim_elements", new
            {
                importacion_id = importacionId,
            });
        }

        public async Task<ConfirmBimResponse> ConfirmBimMatchAsync(string importacionId, List<string>? elementoIds = null)
        {
            return await CallActionAsync<ConfirmBimResponse>("confirm_bim_match", new
            {
                importacion_id = importacionId,
                elemento_ids = elementoIds,
            });
        }

        // ============================================================
        // Smoke test
        // ============================================================

        public async Task<string> TestConnectionAsync()
        {
            var result = await ListProjectsAsync(limit: 1);
            return $"Conexión exitosa. {result.Count} proyecto(s) accesible(s).";
        }

        // ============================================================
        // Cleanup
        // ============================================================

        public void Dispose()
        {
            _http.Dispose();
        }
    }

    // ============================================================
    // Payload para enviar elementos BIM al servidor
    // ============================================================

    public class BimElementPayload
    {
        [System.Text.Json.Serialization.JsonPropertyName("revit_id")]
        public string RevitId { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("categoria")]
        public string Categoria { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("familia")]
        public string Familia { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("tipo")]
        public string Tipo { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("parametros")]
        public Dictionary<string, double> Parametros { get; set; } = new();
    }
}
