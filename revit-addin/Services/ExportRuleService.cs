// Services/ExportRuleService.cs
// Servicio para escanear tipos de elementos Revit y gestionar las reglas de exportación BOQ.
//
// Responsabilidades:
//   - Escanear el documento Revit y obtener todos los ElementType con instancias.
//   - Fusionar tipos encontrados con reglas existentes (preserva ediciones del usuario).
//   - Cargar y guardar reglas en JSON por documento (%APPDATA%\SSA\RvtConstructionOS\rules\).
//   - Cargar y guardar plantillas reutilizables (%APPDATA%\SSA\RvtConstructionOS\templates\).
//
// Autor: SSA Ingenieria SRL

using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using Autodesk.Revit.DB;
using RvtConstructionOS.Models;

namespace RvtConstructionOS.Services
{
    /// <summary>
    /// Gestiona las reglas de exportación BOQ: escaneo de tipos Revit,
    /// fusión con reglas existentes, y persistencia JSON.
    /// </summary>
    public static class ExportRuleService
    {
        // -----------------------------------------------------------------------
        // Categorías Revit soportadas para escaneo
        // -----------------------------------------------------------------------

        private static readonly (BuiltInCategory Bic, string NombreCategoria)[] _categorias =
        {
            (BuiltInCategory.OST_Walls,               "Muros"),
            (BuiltInCategory.OST_Floors,              "Losas"),
            (BuiltInCategory.OST_Roofs,               "Cubiertas"),
            (BuiltInCategory.OST_Ceilings,            "Cielorrasos"),
            (BuiltInCategory.OST_Doors,               "Puertas"),
            (BuiltInCategory.OST_Windows,             "Ventanas"),
            (BuiltInCategory.OST_Columns,             "Pilares Arq."),
            (BuiltInCategory.OST_StructuralColumns,   "Pilares Est."),
            (BuiltInCategory.OST_StructuralFraming,   "Vigas/Cerchas"),
            (BuiltInCategory.OST_Stairs,              "Escaleras"),
            (BuiltInCategory.OST_Ramps,               "Rampas"),
            (BuiltInCategory.OST_StairsRailing,       "Barandas"),
            (BuiltInCategory.OST_GenericModel,        "Modelos Genéricos"),
            (BuiltInCategory.OST_Furniture,           "Mobiliario"),
            (BuiltInCategory.OST_SpecialityEquipment, "Eq. Especial"),
            (BuiltInCategory.OST_PlumbingFixtures,    "Sanitarios"),
            (BuiltInCategory.OST_MechanicalEquipment, "Equipos Mec."),
            (BuiltInCategory.OST_ElectricalFixtures,  "Luminarias"),
            (BuiltInCategory.OST_ElectricalEquipment, "Eq. Eléctrico"),
            (BuiltInCategory.OST_PipeCurves,          "Tuberías"),
            (BuiltInCategory.OST_DuctCurves,          "Ductos"),
            (BuiltInCategory.OST_CableTray,           "Bandejas Eléctricas"),
        };

        // -----------------------------------------------------------------------
        // Opciones de serialización JSON reutilizables
        // -----------------------------------------------------------------------

        private static readonly JsonSerializerOptions _jsonOpts = new()
        {
            WriteIndented           = true,
            DefaultIgnoreCondition  = JsonIgnoreCondition.WhenWritingNull,
        };

        // -----------------------------------------------------------------------
        // Escaneo del documento Revit
        // -----------------------------------------------------------------------

        /// <summary>
        /// Escanea el documento Revit en busca de todos los tipos de elemento que tienen
        /// al menos una instancia colocada, y los fusiona con las reglas existentes.
        /// Los tipos nuevos reciben reglas vacías (Incluir=true por defecto).
        /// Las reglas existentes se preservan exactamente como estaban.
        /// </summary>
        public static ExportRuleSet Escanear(Document doc, ExportRuleSet? reglasExistentes = null)
        {
            var indiceExistente = (reglasExistentes?.Reglas ?? new List<ExportRule>())
                .ToDictionary(r => r.TypeUniqueId, r => r, StringComparer.OrdinalIgnoreCase);

            var reglasFusionadas = new List<ExportRule>();

            foreach (var (bic, nombreCat) in _categorias)
            {
                try
                {
                    var idsInstancias = new FilteredElementCollector(doc)
                        .OfCategory(bic)
                        .WhereElementIsNotElementType()
                        .ToElementIds();

                    if (idsInstancias.Count == 0) continue;

                    var tipoIdsUnicos = idsInstancias
                        .Select(id => doc.GetElement(id)?.GetTypeId())
                        .Where(tid => tid != null && tid != ElementId.InvalidElementId)
                        .Distinct()
                        .ToList();

                    foreach (var tipoId in tipoIdsUnicos)
                    {
                        if (doc.GetElement(tipoId!) is not ElementType tipo) continue;

                        string uid = tipo.UniqueId;
                        string keynote = LeerParamTexto(tipo, BuiltInParameter.KEYNOTE_PARAM);

                        if (indiceExistente.TryGetValue(uid, out var reglaExistente))
                        {
                            reglaExistente.Categoria  = nombreCat;
                            reglaExistente.Familia    = ObtenerFamilia(tipo);
                            reglaExistente.TipoRevit  = tipo.Name;
                            if (!string.IsNullOrWhiteSpace(keynote))
                                reglaExistente.KeynoteSeed = keynote;
                            reglasFusionadas.Add(reglaExistente);
                        }
                        else
                        {
                            reglasFusionadas.Add(new ExportRule
                            {
                                TypeUniqueId      = uid,
                                Categoria         = nombreCat,
                                Familia           = ObtenerFamilia(tipo),
                                TipoRevit         = tipo.Name,
                                Incluir           = true,
                                CodigoPartida     = string.Empty,
                                NombreItem        = tipo.Name,
                                Rubro             = string.Empty,
                                Unidad            = UnidadSugerida(nombreCat),
                                CriterioMedicion  = CriterioSugerido(nombreCat),
                                FactorDesperdicio = 1.0,
                                KeynoteSeed       = keynote,
                            });
                        }
                    }
                }
                catch
                {
                    // Categoría no soportada en esta versión de Revit — ignorar
                }
            }

            reglasFusionadas.Sort((a, b) =>
            {
                int c = string.Compare(a.Categoria, b.Categoria, StringComparison.OrdinalIgnoreCase);
                if (c != 0) return c;
                c = string.Compare(a.Familia, b.Familia, StringComparison.OrdinalIgnoreCase);
                if (c != 0) return c;
                return string.Compare(a.TipoRevit, b.TipoRevit, StringComparison.OrdinalIgnoreCase);
            });

            return new ExportRuleSet
            {
                Version           = "1.0",
                NombrePlantilla   = reglasExistentes?.NombrePlantilla ?? "Default",
                FechaModificacion = DateTime.Now,
                NombreModelo      = doc.Title,
                Reglas            = reglasFusionadas,
                // Preservar perfiles de parámetros custom (wizard)
                PerfilesParametros = reglasExistentes?.PerfilesParametros ?? new(),
            };
        }

        // -----------------------------------------------------------------------
        // Persistencia por documento
        // -----------------------------------------------------------------------

        public static ExportRuleSet Cargar(Document doc)
        {
            string ruta = GetRulesFilePath(doc);
            if (!File.Exists(ruta))
                return new ExportRuleSet { NombreModelo = doc.Title };

            try
            {
                string json = File.ReadAllText(ruta, System.Text.Encoding.UTF8);
                return JsonSerializer.Deserialize<ExportRuleSet>(json, _jsonOpts)
                    ?? new ExportRuleSet { NombreModelo = doc.Title };
            }
            catch
            {
                return new ExportRuleSet { NombreModelo = doc.Title };
            }
        }

        public static void Guardar(Document doc, ExportRuleSet reglas)
        {
            string ruta = GetRulesFilePath(doc);
            reglas.FechaModificacion = DateTime.Now;
            reglas.NombreModelo      = doc.Title;
            string json = JsonSerializer.Serialize(reglas, _jsonOpts);
            File.WriteAllText(ruta, json, System.Text.Encoding.UTF8);
        }

        // -----------------------------------------------------------------------
        // Plantillas reutilizables
        // -----------------------------------------------------------------------

        public static ExportRuleSet CargarPlantilla(string rutaArchivo)
        {
            string json = File.ReadAllText(rutaArchivo, System.Text.Encoding.UTF8);
            return JsonSerializer.Deserialize<ExportRuleSet>(json, _jsonOpts)
                ?? new ExportRuleSet();
        }

        public static void GuardarComoPlantilla(ExportRuleSet reglas, string rutaArchivo)
        {
            reglas.FechaModificacion = DateTime.Now;
            string json = JsonSerializer.Serialize(reglas, _jsonOpts);
            File.WriteAllText(rutaArchivo, json, System.Text.Encoding.UTF8);
        }

        public static string GetTemplatesDir()
        {
            string dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "SSA", "RvtConstructionOS", "templates");
            Directory.CreateDirectory(dir);
            return dir;
        }

        // -----------------------------------------------------------------------
        // Helpers privados
        // -----------------------------------------------------------------------

        private static string GetRulesFilePath(Document doc)
        {
            string docPath = doc.PathName;
            if (string.IsNullOrEmpty(docPath))
                docPath = doc.Title;

            string hash = Math.Abs(docPath.ToLowerInvariant().GetHashCode()).ToString("X8");
            string titulo = Path.GetFileNameWithoutExtension(docPath);
            if (string.IsNullOrEmpty(titulo)) titulo = doc.Title;

            string rulesDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "SSA", "RvtConstructionOS", "rules");
            Directory.CreateDirectory(rulesDir);

            return Path.Combine(rulesDir, $"{titulo}_{hash}.json");
        }

        private static string ObtenerFamilia(ElementType tipo)
        {
            if (tipo is FamilySymbol fs)
                return fs.Family?.Name ?? tipo.FamilyName ?? string.Empty;

            return tipo.FamilyName ?? string.Empty;
        }

        private static string UnidadSugerida(string categoria) => categoria switch
        {
            "Muros"           => "m2",
            "Losas"           => "m2",
            "Cubiertas"       => "m2",
            "Cielorrasos"     => "m2",
            "Vigas/Cerchas"   => "ml",
            "Tuberías"        => "ml",
            "Ductos"          => "ml",
            "Bandejas Eléctricas" => "ml",
            "Escaleras"       => "m2",
            "Rampas"          => "m2",
            _                 => "und",
        };

        private static string LeerParamTexto(Element elem, BuiltInParameter bip)
        {
            Parameter? p = elem.get_Parameter(bip);
            if (p == null) return string.Empty;
            if (p.StorageType == StorageType.String)
                return p.AsString() ?? string.Empty;
            return p.AsValueString() ?? string.Empty;
        }

        private static string CriterioSugerido(string categoria) => categoria switch
        {
            "Muros"           => "AREA_NETA",
            "Losas"           => "AREA_NETA",
            "Cubiertas"       => "AREA_NETA",
            "Cielorrasos"     => "AREA_NETA",
            "Vigas/Cerchas"   => "LONGITUD",
            "Tuberías"        => "LONGITUD",
            "Ductos"          => "LONGITUD",
            "Bandejas Eléctricas" => "LONGITUD",
            _                 => "CANTIDAD",
        };
    }
}
