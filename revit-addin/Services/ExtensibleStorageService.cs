// Services/ExtensibleStorageService.cs
// Gestiona el almacenamiento de metadatos de sincronización BIM usando
// Extensible Storage de Revit 2025. A diferencia de los shared parameters,
// Extensible Storage guarda datos en el elemento sin aparecer en schedules
// ni ser accesible por el usuario final, lo que lo hace ideal para metadatos
// de integración (GUID, versión, hash, estado de sincronización).
// Autor: SSA Ingenieria SRL

using Autodesk.Revit.DB;
using Autodesk.Revit.DB.ExtensibleStorage;

namespace RvtConstructionOS.Services
{
    /// <summary>
    /// Metadatos de sincronización almacenados en cada elemento tipo via Extensible Storage.
    /// </summary>
    public class SyncMetadata
    {
        /// <summary>GUID único de integración para este tipo en el sistema BOQ.</summary>
        public string GuidIntegracion { get; set; } = string.Empty;

        /// <summary>Versión del último export (Ej: "v1.0 2025-03-26").</summary>
        public string VersionExport { get; set; } = string.Empty;

        /// <summary>Hash del estado del tipo en el momento del último export.</summary>
        public string HashRevision { get; set; } = string.Empty;

        /// <summary>Estado de sincronización: PENDIENTE / SINCRONIZADO / MODIFICADO / ERROR.</summary>
        public string EstadoSync { get; set; } = "PENDIENTE";

        /// <summary>Fecha/hora del último export en formato ISO 8601.</summary>
        public string FechaUltimoExport { get; set; } = string.Empty;

        /// <summary>Código de partida asignado en el último export.</summary>
        public string CodigoPartida { get; set; } = string.Empty;
    }

    /// <summary>
    /// Servicio para leer y escribir metadatos de sincronización en elementos Revit
    /// usando Extensible Storage (API nativa de Revit 2025).
    /// Los datos se guardan en el tipo de elemento (ElementType), no en la instancia.
    /// </summary>
    public class ExtensibleStorageService
    {
        // -----------------------------------------------------------------------
        // Schema de Extensible Storage
        // GUIDs fijos — no cambiar entre versiones para mantener compatibilidad
        // -----------------------------------------------------------------------
        private static readonly Guid SchemaGuid =
            new Guid("7F3A9B2C-1D4E-4F56-8A9B-0C1D2E3F4A5B");

        private const string SchemaName        = "SSABimSyncMetadata";
        private const string SchemaVendorId    = "SSA_INGENIERIA";
        private const string SchemaDescription = "Metadatos de sincronización SSA BIM BOQ Bridge";

        // Nombres de campos dentro del schema
        private const string FieldGuid         = "GuidIntegracion";
        private const string FieldVersion      = "VersionExport";
        private const string FieldHash         = "HashRevision";
        private const string FieldEstado       = "EstadoSync";
        private const string FieldFecha        = "FechaUltimoExport";
        private const string FieldCodigo       = "CodigoPartida";

        // -----------------------------------------------------------------------
        // Obtención / creación del Schema
        // -----------------------------------------------------------------------

        /// <summary>
        /// Obtiene el schema de Extensible Storage existente o lo crea si no existe.
        /// El schema es el "tipo" que define los campos; se crea una sola vez por modelo.
        /// </summary>
        private static Schema ObtenerOCrearSchema()
        {
            // Buscar si ya existe el schema en el documento
            Schema? schema = Schema.Lookup(SchemaGuid);
            if (schema != null) return schema;

            // Crear el schema con permisos de lectura para todos,
            // escritura solo para el vendor (el plugin)
            SchemaBuilder builder = new SchemaBuilder(SchemaGuid);
            builder.SetSchemaName(SchemaName);
            builder.SetVendorId(SchemaVendorId);
            builder.SetDocumentation(SchemaDescription);
            builder.SetReadAccessLevel(AccessLevel.Public);
            builder.SetWriteAccessLevel(AccessLevel.Vendor);

            // Definir los campos del schema (todos texto para simplicidad)
            builder.AddSimpleField(FieldGuid,    typeof(string));
            builder.AddSimpleField(FieldVersion, typeof(string));
            builder.AddSimpleField(FieldHash,    typeof(string));
            builder.AddSimpleField(FieldEstado,  typeof(string));
            builder.AddSimpleField(FieldFecha,   typeof(string));
            builder.AddSimpleField(FieldCodigo,  typeof(string));

            return builder.Finish();
        }

        // -----------------------------------------------------------------------
        // Lectura
        // -----------------------------------------------------------------------

        /// <summary>
        /// Lee los metadatos de sincronización de un tipo de elemento.
        /// Retorna un SyncMetadata con valores vacíos si el elemento no tiene datos previos.
        /// </summary>
        public SyncMetadata Leer(ElementType tipo)
        {
            Schema schema = ObtenerOCrearSchema();
            Entity? entity = tipo.GetEntity(schema);

            // Si no tiene datos almacenados, retornar defaults
            if (!entity.IsValid()) return new SyncMetadata();

            return new SyncMetadata
            {
                GuidIntegracion  = entity.Get<string>(FieldGuid)    ?? string.Empty,
                VersionExport    = entity.Get<string>(FieldVersion)  ?? string.Empty,
                HashRevision     = entity.Get<string>(FieldHash)     ?? string.Empty,
                EstadoSync       = entity.Get<string>(FieldEstado)   ?? "PENDIENTE",
                FechaUltimoExport= entity.Get<string>(FieldFecha)    ?? string.Empty,
                CodigoPartida    = entity.Get<string>(FieldCodigo)   ?? string.Empty,
            };
        }

        // -----------------------------------------------------------------------
        // Escritura
        // -----------------------------------------------------------------------

        /// <summary>
        /// Escribe los metadatos de sincronización en un tipo de elemento.
        /// IMPORTANTE: Debe llamarse dentro de una Transaction abierta.
        /// </summary>
        public void Escribir(ElementType tipo, SyncMetadata metadata)
        {
            Schema schema = ObtenerOCrearSchema();
            Entity entity = new Entity(schema);

            entity.Set(FieldGuid,    metadata.GuidIntegracion);
            entity.Set(FieldVersion, metadata.VersionExport);
            entity.Set(FieldHash,    metadata.HashRevision);
            entity.Set(FieldEstado,  metadata.EstadoSync);
            entity.Set(FieldFecha,   metadata.FechaUltimoExport);
            entity.Set(FieldCodigo,  metadata.CodigoPartida);

            tipo.SetEntity(entity);
        }

        /// <summary>
        /// Asigna un nuevo GUID de integración a un tipo si todavía no tiene uno.
        /// Retorna el GUID asignado (nuevo o existente).
        /// IMPORTANTE: Debe llamarse dentro de una Transaction abierta.
        /// </summary>
        public string AsegurarGuid(ElementType tipo)
        {
            SyncMetadata meta = Leer(tipo);

            if (string.IsNullOrWhiteSpace(meta.GuidIntegracion))
            {
                // Generar nuevo GUID único para este tipo
                meta.GuidIntegracion = Guid.NewGuid().ToString("D").ToUpperInvariant();
                meta.EstadoSync = "PENDIENTE";
                Escribir(tipo, meta);
            }

            return meta.GuidIntegracion;
        }

        /// <summary>
        /// Marca un tipo como sincronizado con la versión y hash actuales.
        /// IMPORTANTE: Debe llamarse dentro de una Transaction abierta.
        /// </summary>
        public void MarcarSincronizado(ElementType tipo, string version, string hash, string codigoPartida)
        {
            SyncMetadata meta = Leer(tipo);
            meta.VersionExport     = version;
            meta.HashRevision      = hash;
            meta.EstadoSync        = "SINCRONIZADO";
            meta.FechaUltimoExport = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            meta.CodigoPartida     = codigoPartida;
            Escribir(tipo, meta);
        }

        /// <summary>
        /// Calcula un hash simple del estado del tipo para detectar cambios entre versiones.
        /// Usa nombre, categoría y parámetros clave del tipo.
        /// </summary>
        public static string CalcularHash(ElementType tipo)
        {
            // Combinar los atributos clave del tipo para detectar si cambió
            string contenido = string.Concat(
                tipo.Name,
                tipo.Category?.Name ?? "",
                tipo.FamilyName,
                tipo.LookupParameter("SSA_CODIGO_PARTIDA")?.AsString() ?? "",
                tipo.LookupParameter("SSA_CRITERIO_MEDICION")?.AsString() ?? ""
            );

            // Hash simple (no criptográfico) usando XOR sobre bytes
            int hash = contenido.Aggregate(0, (acc, c) => acc ^ (c * 397));
            return Math.Abs(hash).ToString("X8");
        }
    }
}
