// Services/FamilyParameterScanner.cs
// Escanea las familias con instancias dibujadas en el modelo Revit
// y recopila sus parámetros disponibles (type + instance).
//
// Se usa en el wizard de configuración de parámetros de exportación
// para mostrar al usuario qué parámetros puede seleccionar.
//
// Autor: SSA Ingenieria SRL

using Autodesk.Revit.DB;
using RvtConstructionOS.Models;

namespace RvtConstructionOS.Services
{
    /// <summary>
    /// Escanea familias del modelo Revit y extrae sus parámetros disponibles.
    /// Solo considera familias que tienen al menos una instancia colocada.
    /// </summary>
    public static class FamilyParameterScanner
    {
        // Categorías soportadas (mismas que ExportRuleService)
        private static readonly BuiltInCategory[] _categorias =
        {
            BuiltInCategory.OST_Walls,
            BuiltInCategory.OST_Floors,
            BuiltInCategory.OST_Roofs,
            BuiltInCategory.OST_Ceilings,
            BuiltInCategory.OST_Doors,
            BuiltInCategory.OST_Windows,
            BuiltInCategory.OST_Columns,
            BuiltInCategory.OST_StructuralColumns,
            BuiltInCategory.OST_StructuralFraming,
            BuiltInCategory.OST_Stairs,
            BuiltInCategory.OST_Ramps,
            BuiltInCategory.OST_StairsRailing,
            BuiltInCategory.OST_GenericModel,
            BuiltInCategory.OST_Furniture,
            BuiltInCategory.OST_SpecialityEquipment,
            BuiltInCategory.OST_PlumbingFixtures,
            BuiltInCategory.OST_MechanicalEquipment,
            BuiltInCategory.OST_ElectricalFixtures,
            BuiltInCategory.OST_ElectricalEquipment,
            BuiltInCategory.OST_PipeCurves,
            BuiltInCategory.OST_DuctCurves,
            BuiltInCategory.OST_CableTray,
            BuiltInCategory.OST_CurtainWallPanels,
            BuiltInCategory.OST_CurtainWallMullions,
            BuiltInCategory.OST_StructuralFoundation,
        };

        private static readonly Dictionary<BuiltInCategory, string> _nombresCategoria = new()
        {
            [BuiltInCategory.OST_Walls]               = "Muros",
            [BuiltInCategory.OST_Floors]              = "Losas",
            [BuiltInCategory.OST_Roofs]               = "Cubiertas",
            [BuiltInCategory.OST_Ceilings]            = "Cielorrasos",
            [BuiltInCategory.OST_Doors]               = "Puertas",
            [BuiltInCategory.OST_Windows]             = "Ventanas",
            [BuiltInCategory.OST_Columns]             = "Pilares Arq.",
            [BuiltInCategory.OST_StructuralColumns]   = "Pilares Est.",
            [BuiltInCategory.OST_StructuralFraming]   = "Vigas/Cerchas",
            [BuiltInCategory.OST_Stairs]              = "Escaleras",
            [BuiltInCategory.OST_Ramps]               = "Rampas",
            [BuiltInCategory.OST_StairsRailing]       = "Barandas",
            [BuiltInCategory.OST_GenericModel]        = "Modelos Genéricos",
            [BuiltInCategory.OST_Furniture]           = "Mobiliario",
            [BuiltInCategory.OST_SpecialityEquipment] = "Eq. Especial",
            [BuiltInCategory.OST_PlumbingFixtures]    = "Sanitarios",
            [BuiltInCategory.OST_MechanicalEquipment] = "Equipos Mec.",
            [BuiltInCategory.OST_ElectricalFixtures]  = "Luminarias",
            [BuiltInCategory.OST_ElectricalEquipment] = "Eq. Eléctrico",
            [BuiltInCategory.OST_PipeCurves]          = "Tuberías",
            [BuiltInCategory.OST_DuctCurves]          = "Ductos",
            [BuiltInCategory.OST_CableTray]           = "Bandejas Eléctricas",
            [BuiltInCategory.OST_CurtainWallPanels]   = "Paneles Muro Cortina",
            [BuiltInCategory.OST_CurtainWallMullions] = "Montantes Muro Cortina",
            [BuiltInCategory.OST_StructuralFoundation]= "Fundaciones",
        };

        // Parámetros que ya se exportan automáticamente (no mostrar en wizard)
        private static readonly HashSet<string> _paramsAutoExport = new(StringComparer.OrdinalIgnoreCase)
        {
            // Built-in que BimSerializer ya maneja
            "Area", "Volume", "Length", "Width", "Height",
            // SSA_* compartidos
            "SSA_GUID_INTEGRACION", "SSA_CODIGO_PARTIDA", "SSA_SUBPARTIDA",
            "SSA_NOMBRE_NORMALIZADO", "SSA_CRITERIO_MEDICION", "SSA_INCLUIR_COMPUTO",
            "SSA_FACTOR_DESPERDICIO", "SSA_ORIGEN_PARTIDA", "SSA_VERSION_EXPORT",
            "SSA_OBSERVACION", "SSA_ACABADO_INT", "SSA_ACABADO_EXT",
            "SSA_REVOQUE_ESP_INT", "SSA_REVOQUE_ESP_EXT", "SSA_PINTURA_TIPO_INT",
            "SSA_PINTURA_TIPO_EXT", "SSA_CERAMICA_ALTURA", "SSA_CONSIDERAR_DINTEL",
            "SSA_CONSIDERAR_RASGO", "SSA_CONSIDERAR_BUNA",
            "SSA_ROUGH_WIDTH", "SSA_ROUGH_HEIGHT", "SSA_DINTEL_TIPO",
            "SSA_JAMBA_TIPO", "SSA_ALFEIZAR_TIPO",
        };

        /// <summary>
        /// Escanea todas las familias con instancias en el modelo.
        /// Retorna las familias agrupadas por categoría con sus parámetros.
        /// </summary>
        public static List<FamiliaEscaneada> EscanearModelo(Document doc)
        {
            var familias = new List<FamiliaEscaneada>();

            foreach (var bic in _categorias)
            {
                try
                {
                    string nombreCat = _nombresCategoria.TryGetValue(bic, out var n) ? n : bic.ToString();
                    var familiasDeCategoria = EscanearCategoria(doc, bic, nombreCat);
                    familias.AddRange(familiasDeCategoria);
                }
                catch
                {
                    // Categoría no soportada en esta versión de Revit
                }
            }

            return familias.OrderBy(f => f.Categoria).ThenBy(f => f.Familia).ToList();
        }

        /// <summary>
        /// Escanea una categoría específica y retorna las familias encontradas.
        /// </summary>
        private static List<FamiliaEscaneada> EscanearCategoria(
            Document doc, BuiltInCategory bic, string nombreCat)
        {
            // Obtener instancias de la categoría
            var instancias = new FilteredElementCollector(doc)
                .OfCategory(bic)
                .WhereElementIsNotElementType()
                .ToElements();

            if (instancias.Count == 0) return new();

            // Agrupar por familia
            var grupos = new Dictionary<string, (ElementType? primerTipo,
                HashSet<string> nombresTipos, int cantInstancias, Element? primerInstancia)>();

            foreach (var inst in instancias)
            {
                var tipoId = inst.GetTypeId();
                if (tipoId == null || tipoId == ElementId.InvalidElementId) continue;

                var tipo = doc.GetElement(tipoId) as ElementType;
                if (tipo == null) continue;

                string familia = ObtenerNombreFamilia(tipo);
                if (string.IsNullOrWhiteSpace(familia)) continue;

                if (!grupos.ContainsKey(familia))
                    grupos[familia] = (tipo, new HashSet<string>(), 0, inst);

                var g = grupos[familia];
                g.nombresTipos.Add(tipo.Name);
                g.cantInstancias++;
                grupos[familia] = (g.primerTipo, g.nombresTipos, g.cantInstancias, g.primerInstancia);
            }

            var result = new List<FamiliaEscaneada>();

            foreach (var (familia, (primerTipo, nombresTipos, cantInst, primerInst)) in grupos)
            {
                var parametros = ExtraerParametros(primerTipo!, primerInst);

                result.Add(new FamiliaEscaneada
                {
                    Familia        = familia,
                    Categoria      = nombreCat,
                    CantTipos      = nombresTipos.Count,
                    CantInstancias = cantInst,
                    NombresTipos   = nombresTipos.OrderBy(n => n).ToList(),
                    Parametros     = parametros,
                });
            }

            return result;
        }

        /// <summary>
        /// Extrae los parámetros disponibles de un tipo y una instancia de ejemplo.
        /// Filtra los parámetros SSA_* que ya se exportan automáticamente.
        /// </summary>
        private static List<ParamDisponible> ExtraerParametros(
            ElementType tipo, Element? instancia)
        {
            var parametros = new List<ParamDisponible>();
            var nombresVistos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            // --- Parámetros del TIPO ---
            foreach (Parameter p in tipo.Parameters)
            {
                if (p.Definition == null) continue;
                string nombre = p.Definition.Name;
                if (string.IsNullOrWhiteSpace(nombre)) continue;
                if (nombresVistos.Contains(nombre)) continue;
                if (_paramsAutoExport.Contains(nombre)) continue;

                nombresVistos.Add(nombre);
                parametros.Add(CrearParamDisponible(p, "Type"));
            }

            // --- Parámetros de INSTANCIA (si hay) ---
            if (instancia != null)
            {
                foreach (Parameter p in instancia.Parameters)
                {
                    if (p.Definition == null) continue;
                    string nombre = p.Definition.Name;
                    if (string.IsNullOrWhiteSpace(nombre)) continue;
                    if (nombresVistos.Contains(nombre)) continue;
                    if (_paramsAutoExport.Contains(nombre)) continue;

                    nombresVistos.Add(nombre);
                    parametros.Add(CrearParamDisponible(p, "Instance"));
                }
            }

            return parametros
                .Where(p => !p.EsSSA)                     // Excluir SSA_* ya exportados
                .OrderBy(p => p.Origen)                    // Type primero, luego Instance
                .ThenBy(p => p.Grupo)                      // Agrupar por grupo de Revit
                .ThenBy(p => p.Nombre)                     // Alfabético dentro del grupo
                .ToList();
        }

        /// <summary>
        /// Crea un ParamDisponible a partir de un Parameter de Revit.
        /// </summary>
        private static ParamDisponible CrearParamDisponible(Parameter p, string origen)
        {
            string tipoDato = p.StorageType switch
            {
                StorageType.String  => "TEXT",
                StorageType.Double  => ClasificarDoubleParam(p),
                StorageType.Integer => p.Definition.Name.Contains("YesNo", StringComparison.OrdinalIgnoreCase)
                                       || IsYesNoParam(p)
                                       ? "YESNO" : "INTEGER",
                StorageType.ElementId => "ELEMENT_ID",
                _ => "TEXT"
            };

            string valorEjemplo = LeerValorComoTexto(p);

            // Intentar obtener GUID si es shared parameter
            string guid = string.Empty;
            try
            {
                if (p.IsShared)
                    guid = p.GUID.ToString();
            }
            catch { }

            // Grupo del parámetro
            string grupo = string.Empty;
            try
            {
                grupo = p.Definition.GetGroupTypeId()?.TypeId ?? "";
                // Limpiar el ID del grupo para mostrar algo legible
                if (grupo.Contains('-'))
                    grupo = grupo.Split('-').Last().Replace("_", " ").Trim();
            }
            catch { }

            return new ParamDisponible
            {
                Nombre       = p.Definition.Name,
                Guid         = guid,
                TipoDato     = tipoDato,
                Origen       = origen,
                ValorEjemplo = valorEjemplo,
                Grupo        = grupo,
                EsBuiltIn    = !p.IsShared && string.IsNullOrEmpty(guid),
            };
        }

        /// <summary>
        /// Clasifica un parámetro Double según su DisplayUnitType.
        /// </summary>
        private static string ClasificarDoubleParam(Parameter p)
        {
            try
            {
                var spec = p.Definition.GetDataType();
                string specId = spec?.TypeId ?? "";

                if (specId.Contains("length", StringComparison.OrdinalIgnoreCase)) return "LENGTH";
                if (specId.Contains("area", StringComparison.OrdinalIgnoreCase))   return "AREA";
                if (specId.Contains("volume", StringComparison.OrdinalIgnoreCase)) return "VOLUME";
                if (specId.Contains("angle", StringComparison.OrdinalIgnoreCase))  return "ANGLE";
            }
            catch { }

            return "NUMBER";
        }

        /// <summary>
        /// Determina si un parámetro Integer es realmente YesNo.
        /// </summary>
        private static bool IsYesNoParam(Parameter p)
        {
            try
            {
                var spec = p.Definition.GetDataType();
                return spec?.TypeId?.Contains("Boolean", StringComparison.OrdinalIgnoreCase) == true
                    || spec?.TypeId?.Contains("yesNo", StringComparison.OrdinalIgnoreCase) == true;
            }
            catch { return false; }
        }

        /// <summary>
        /// Lee el valor de un parámetro como texto para mostrar en el wizard.
        /// </summary>
        private static string LeerValorComoTexto(Parameter p)
        {
            try
            {
                if (!p.HasValue) return "(vacío)";

                return p.StorageType switch
                {
                    StorageType.String => p.AsString() ?? "(vacío)",
                    StorageType.Double => p.AsValueString() ?? p.AsDouble().ToString("F4"),
                    StorageType.Integer => p.AsInteger().ToString(),
                    StorageType.ElementId => p.AsValueString() ?? $"id:{p.AsElementId().Value}",
                    _ => "(desconocido)"
                };
            }
            catch
            {
                return "(error)";
            }
        }

        /// <summary>
        /// Lee el valor numérico de un parámetro (para evaluar fórmulas).
        /// Para parámetros de texto o sin valor, retorna 0.
        /// </summary>
        public static double LeerValorNumerico(Parameter p)
        {
            try
            {
                if (!p.HasValue) return 0;
                return p.StorageType switch
                {
                    StorageType.Double  => p.AsDouble(),
                    StorageType.Integer => p.AsInteger(),
                    _ => 0
                };
            }
            catch { return 0; }
        }

        /// <summary>
        /// Lee el valor de texto de un parámetro (para metadata).
        /// </summary>
        public static string LeerValorTexto(Parameter p)
        {
            try
            {
                if (!p.HasValue) return "";
                return p.StorageType switch
                {
                    StorageType.String  => p.AsString() ?? "",
                    StorageType.Double  => p.AsValueString() ?? p.AsDouble().ToString("F4"),
                    StorageType.Integer => p.AsInteger().ToString(),
                    _ => ""
                };
            }
            catch { return ""; }
        }

        /// <summary>Obtiene el nombre de la familia de un ElementType.</summary>
        private static string ObtenerNombreFamilia(ElementType tipo)
        {
            if (tipo is FamilySymbol fs)
                return fs.Family?.Name ?? tipo.FamilyName ?? string.Empty;
            return tipo.FamilyName ?? string.Empty;
        }
    }
}
