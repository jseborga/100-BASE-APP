// Models/AppConfig.cs
// Configuración de conexión con ConstructionOS.
// Reemplaza OdooConfig (URL+DB+user+password) por URL+APIKey (stateless).
// Autor: SSA Ingenieria SRL

using System.IO;
using System.Text.Json;

namespace RvtConstructionOS.Models
{
    public class AppConfig
    {
        /// <summary>URL base del servidor ConstructionOS (e.g., "https://base-app.q8waob.easypanel.host").</summary>
        public string Url { get; set; } = string.Empty;

        /// <summary>API Key para autenticación Bearer.</summary>
        public string ApiKey { get; set; } = string.Empty;

        /// <summary>UUID del proyecto activo seleccionado.</summary>
        public string ProyectoId { get; set; } = string.Empty;

        /// <summary>Nombre del proyecto activo (para mostrar en UI).</summary>
        public string ProyectoNombre { get; set; } = string.Empty;

        /// <summary>True si la configuración tiene URL y ApiKey.</summary>
        public bool IsValid => !string.IsNullOrWhiteSpace(Url) && !string.IsNullOrWhiteSpace(ApiKey);

        /// <summary>True si hay un proyecto seleccionado.</summary>
        public bool HasProject => !string.IsNullOrWhiteSpace(ProyectoId);

        // -----------------------------------------------------------------------
        // Persistencia (archivo JSON en AppData)
        // -----------------------------------------------------------------------

        private static readonly string ConfigDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "RvtConstructionOS");

        private static readonly string ConfigPath = Path.Combine(ConfigDir, "config.json");

        public static AppConfig Load()
        {
            try
            {
                if (File.Exists(ConfigPath))
                {
                    string json = File.ReadAllText(ConfigPath);
                    return JsonSerializer.Deserialize<AppConfig>(json) ?? new AppConfig();
                }
            }
            catch { }
            return new AppConfig();
        }

        public void Save()
        {
            try
            {
                Directory.CreateDirectory(ConfigDir);
                string json = JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(ConfigPath, json);
            }
            catch { }
        }
    }
}
