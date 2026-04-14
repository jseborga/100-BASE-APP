// Services/RevitExtractionService.cs
// Extrae cantidades BIM del modelo Revit 2025 para el BOQ SSA BIM BOQ Bridge.
//
// Sprint 1: Muros, Puertas, Ventanas, Pisos, Cielorrasos.
// Sprint 2 (Fase B): Keynote, AssemblyCode, RubroOdoo, FaseNombre, CapasEstructurales,
//                    FiltroExtraccion (vista activa / selección / fase / modelo completo).
//
// Reglas de negocio:
//   Regla 1: Solo elementos con categoría válida + nivel + SSA_INCLUIR_COMPUTO = true.
//   Regla 2: Lee materiales modelados del muro para partidas derivadas de acabados.
//   Regla 3: Descuenta huecos > umbral configurable (default 0.50 m²).
//   Regla 4: Keynote → default_code Odoo | AssemblyCode → deducción de Rubro.
//   Regla 5: CompoundStructure → CapasEstructurales cuando DesglosarCapas = true.
//
// Autor: SSA Ingenieria SRL

using Autodesk.Revit.DB;
using RvtConstructionOS.Models;
using System.Text.RegularExpressions;

namespace RvtConstructionOS.Services
{
    /// <summary>
    /// Resultado completo de la extracción BIM.
    /// </summary>
    public class ExtractionResult
    {
        public List<BimElement>  Elementos   { get; set; } = new();
        public List<BimAbertura> Aberturas   { get; set; } = new();
        public int TotalInstancias           { get; set; }
        public int ExcluidosSinParams        { get; set; }
        public int ExcluidosPorFlag          { get; set; }
        public List<string> Advertencias     { get; set; } = new();

        /// <summary>Descripción del filtro aplicado (para mostrar en la barra de estado).</summary>
        public string DescripcionFiltro      { get; set; } = "Modelo completo";

        // Estadísticas de matching (Módulo B)
        public int TotalMatchAuto  { get; set; }   // score ≥ 90, AprobadoAuto
        public int TotalRevisar    { get; set; }   // score 60-89, RevisarSugerido
        public int TotalSinMatch   { get; set; }   // sin match o ManualObligatorio

        /// <summary>Resumen para la barra de estado del QuantityBrowserWindow.</summary>
        public string ResumenMatch =>
            $"✔ Auto: {TotalMatchAuto}  ⚠ Revisar: {TotalRevisar}  ✗ Sin match: {TotalSinMatch}";
    }

    /// <summary>
    /// Extrae y calcula los cómputos BOQ del modelo activo de Revit.
    /// Admite filtros de alcance (vista, selección, fase, modelo completo).
    /// </summary>
    public class RevitExtractionService
    {
        // -----------------------------------------------------------------------
        // Factores de conversión — la API interna de Revit usa pies imperiales
        // -----------------------------------------------------------------------
        private const double PIE_A_METRO = 0.3048;
        private const double PIE2_A_M2   = PIE_A_METRO * PIE_A_METRO;
        private const double PIE3_A_M3   = PIE_A_METRO * PIE_A_METRO * PIE_A_METRO;

        /// <summary>Umbral para descuento de huecos (Regla 3). Default: 0.50 m².</summary>
        public double UmbralHuecoM2 { get; set; } = 0.50;

        // Servicios auxiliares
        private readonly ExtensibleStorageService _extStorage = new();

        // Estado de extracción (se setea en Extraer() y se usa en helpers)
        private Document?          _doc;
        private FiltroExtraccion   _filtro = FiltroExtraccion.Completo;

        // -----------------------------------------------------------------------
        // Perfiles de categorías — describe cómo medir cada categoría Revit
        // Categorías manejadas por métodos especializados (Muros, Pisos,
        // Cielorrasos, Puertas, Ventanas) NO deben estar en esta tabla.
        // -----------------------------------------------------------------------

        /// <summary>Perfil que describe el criterio de extracción de una categoría Revit.</summary>
        private sealed record PerfilCategoria(
            BuiltInCategory Bic,
            string Nombre,
            string Disciplina,
            string CriterioDefault,    // AREA_NETA | VOLUMEN | LONGITUD | CANTIDAD
            string UnidadDefault,
            bool ExtraerArea,
            bool ExtraerVolumen,
            bool ExtraerLongitud);

        private static readonly PerfilCategoria[] _perfilesCategorias =
        {
            // ── Arquitectura ────────────────────────────────────────────────────
            new(BuiltInCategory.OST_Roofs,
                "Cubiertas",          "Arquitectura",  "AREA_NETA",  "m2",  true,  true,  false),
            new(BuiltInCategory.OST_Columns,
                "Pilares Arq.",       "Arquitectura",  "CANTIDAD",   "und", false, false, false),
            new(BuiltInCategory.OST_Stairs,
                "Escaleras",          "Arquitectura",  "AREA_NETA",  "m2",  true,  false, false),
            new(BuiltInCategory.OST_Ramps,
                "Rampas",             "Arquitectura",  "AREA_NETA",  "m2",  true,  false, false),
            new(BuiltInCategory.OST_StairsRailing,
                "Barandas",           "Arquitectura",  "LONGITUD",   "ml",  false, false, true),
            new(BuiltInCategory.OST_CurtainWallPanels,
                "Paneles Muro Cortina","Arquitectura", "AREA_NETA",  "m2",  true,  false, false),
            new(BuiltInCategory.OST_CurtainWallMullions,
                "Montantes Muro Cortina","Arquitectura","LONGITUD",  "ml",  false, false, true),

            // ── Estructuras ─────────────────────────────────────────────────────
            new(BuiltInCategory.OST_StructuralColumns,
                "Pilares Est.",       "Estructuras",   "VOLUMEN",    "m3",  false, true,  true),
            new(BuiltInCategory.OST_StructuralFraming,
                "Vigas/Cerchas",      "Estructuras",   "LONGITUD",   "ml",  false, true,  true),
            new(BuiltInCategory.OST_StructuralFoundation,
                "Fundaciones",        "Estructuras",   "VOLUMEN",    "m3",  true,  true,  false),

            // ── Equipamiento y mobiliario ────────────────────────────────────────
            new(BuiltInCategory.OST_GenericModel,
                "Modelos Genéricos",  "Arquitectura",  "CANTIDAD",   "und", true,  true,  false),
            new(BuiltInCategory.OST_Furniture,
                "Mobiliario",         "Equipamiento",  "CANTIDAD",   "und", false, false, false),
            new(BuiltInCategory.OST_SpecialityEquipment,
                "Eq. Especial",       "Equipamiento",  "CANTIDAD",   "und", false, false, false),
            new(BuiltInCategory.OST_FurnitureSystems,
                "Sistemas Mobiliario","Equipamiento",  "CANTIDAD",   "und", false, false, false),

            // ── MEP — Sanitario ──────────────────────────────────────────────────
            new(BuiltInCategory.OST_PlumbingFixtures,
                "Sanitarios",         "Sanitario",     "CANTIDAD",   "und", false, false, false),
            new(BuiltInCategory.OST_PipeCurves,
                "Tuberías",           "Sanitario",     "LONGITUD",   "ml",  false, false, true),
            new(BuiltInCategory.OST_PipeFitting,
                "Acc. Tubería",       "Sanitario",     "CANTIDAD",   "und", false, false, false),
            new(BuiltInCategory.OST_PipeAccessory,
                "Acces. Tubería",     "Sanitario",     "CANTIDAD",   "und", false, false, false),

            // ── MEP — Mecánico / HVAC ────────────────────────────────────────────
            new(BuiltInCategory.OST_MechanicalEquipment,
                "Equipos Mec.",       "Mecánico",      "CANTIDAD",   "und", false, false, false),
            new(BuiltInCategory.OST_DuctCurves,
                "Ductos",             "Mecánico",      "LONGITUD",   "ml",  false, false, true),
            new(BuiltInCategory.OST_DuctFitting,
                "Acc. Ductos",        "Mecánico",      "CANTIDAD",   "und", false, false, false),
            new(BuiltInCategory.OST_DuctAccessory,
                "Acces. Ductos",      "Mecánico",      "CANTIDAD",   "und", false, false, false),
            new(BuiltInCategory.OST_FlexDuctCurves,
                "Ductos Flex.",       "Mecánico",      "LONGITUD",   "ml",  false, false, true),
            new(BuiltInCategory.OST_FlexPipeCurves,
                "Tuberías Flex.",     "Sanitario",     "LONGITUD",   "ml",  false, false, true),

            // ── MEP — Eléctrico ──────────────────────────────────────────────────
            new(BuiltInCategory.OST_ElectricalFixtures,
                "Artefactos Eléc.",   "Eléctrico",     "CANTIDAD",   "und", false, false, false),
            new(BuiltInCategory.OST_LightingFixtures,
                "Luminarias",         "Eléctrico",     "CANTIDAD",   "und", false, false, false),
            new(BuiltInCategory.OST_ElectricalEquipment,
                "Eq. Eléctrico",      "Eléctrico",     "CANTIDAD",   "und", false, false, false),
            new(BuiltInCategory.OST_CableTray,
                "Bandejas Eléctricas","Eléctrico",     "LONGITUD",   "ml",  false, false, true),
            new(BuiltInCategory.OST_Conduit,
                "Conduit",            "Eléctrico",     "LONGITUD",   "ml",  false, false, true),
            new(BuiltInCategory.OST_CableTrayFitting,
                "Acc. Bandeja",       "Eléctrico",     "CANTIDAD",   "und", false, false, false),
            new(BuiltInCategory.OST_ConduitFitting,
                "Acc. Conduit",       "Eléctrico",     "CANTIDAD",   "und", false, false, false),

            // ── Sitio / Paisajismo ───────────────────────────────────────────────
            new(BuiltInCategory.OST_Parking,
                "Estacionamientos",   "Sitio",         "CANTIDAD",   "und", true,  false, false),
            new(BuiltInCategory.OST_Entourage,
                "Vegetación/Entorno", "Sitio",         "CANTIDAD",   "und", false, false, false),
        };

        // -----------------------------------------------------------------------
        // Punto de entrada principal
        // -----------------------------------------------------------------------

        /// <summary>
        /// Extrae todos los elementos medibles del documento, calcula cantidades
        /// y aplica las reglas de negocio del SRS.
        /// </summary>
        /// <param name="doc">Documento Revit activo.</param>
        /// <param name="filtro">Filtro de alcance. Si es null se procesa el modelo completo.</param>
        public ExtractionResult Extraer(Document doc, FiltroExtraccion? filtro = null)
        {
            _doc    = doc;
            _filtro = filtro ?? FiltroExtraccion.Completo;

            var result = new ExtractionResult
            {
                DescripcionFiltro = _filtro.Descripcion,
            };

            // 1. Extraer aberturas primero (para calcular huecos en muros)
            var aberturas = ExtraerAberturas(doc, result);
            result.Aberturas = aberturas;

            var huecosPorMuro = aberturas
                .GroupBy(a => a.GuidHostMuro)
                .ToDictionary(g => g.Key, g => g.ToList());

            // 2. Extraer categorías con métodos especializados
            ExtraerMuros(doc, result, huecosPorMuro);
            ExtraerPisos(doc, result);
            ExtraerCielorrasos(doc, result);

            // 3. Extraer TODAS las demás categorías (estructuras, MEP, equipos, etc.)
            //    usando el extractor genérico guiado por perfiles de categoría.
            //    Se envuelve en try/catch por categoría para tolerar versiones de Revit
            //    que no soporten alguna categoría específica.
            foreach (var perfil in _perfilesCategorias)
            {
                try { ExtraerCategoriaGenerica(doc, result, perfil); }
                catch { /* categoría no disponible en esta versión — ignorar */ }
            }

            // 4. Aberturas como elementos BOQ independientes (por tipo)
            AgregarAberturasComoElementos(aberturas, doc, result);

            // Ordenar por categoría y tipo
            result.Elementos = result.Elementos
                .OrderBy(e => e.Categoria)
                .ThenBy(e => e.TipoRevit)
                .ToList();

            // Matching automático se realiza server-side en ConstructionOS
            // (POST match_bim_elements via webhook API)
            // Las estadísticas de matching se obtienen del servidor después del match.

            return result;
        }

        // -----------------------------------------------------------------------
        // Collector con filtro de alcance
        // -----------------------------------------------------------------------

        /// <summary>
        /// Crea un FilteredElementCollector respetando el filtro de alcance activo.
        /// </summary>
        private FilteredElementCollector CrearCollector(Document doc)
        {
            return _filtro.Alcance switch
            {
                FiltroExtraccion.TipoAlcance.VistaActiva
                    when _filtro.VistaId != null
                    => new FilteredElementCollector(doc, _filtro.VistaId),

                FiltroExtraccion.TipoAlcance.Seleccion
                    when _filtro.ElementosIds is { Count: > 0 }
                    => new FilteredElementCollector(doc, _filtro.ElementosIds),

                _ => new FilteredElementCollector(doc),
            };
        }

        // -----------------------------------------------------------------------
        // Extracción de muros
        // -----------------------------------------------------------------------

        private void ExtraerMuros(Document doc, ExtractionResult result,
            Dictionary<string, List<BimAbertura>> huecosPorMuro)
        {
            var collector = CrearCollector(doc)
                .OfCategory(BuiltInCategory.OST_Walls)
                .WhereElementIsNotElementType()
                .Cast<Wall>();

            var grupos = new Dictionary<ElementId, (WallType tipo, List<Wall> instancias)>();

            foreach (Wall muro in collector)
            {
                if (muro.WallType == null) continue;
                if (!PasaFiltroFase(muro)) continue;

                ElementId tipoId = muro.GetTypeId();
                if (!grupos.ContainsKey(tipoId))
                    grupos[tipoId] = (muro.WallType, new List<Wall>());
                grupos[tipoId].instancias.Add(muro);
                result.TotalInstancias++;
            }

            foreach (var (tipoId, (wallType, instancias)) in grupos)
            {
                bool incluir = SharedParamService.LeerBooleano(wallType, "SSA_INCLUIR_COMPUTO", true);
                if (!incluir) { result.ExcluidosPorFlag += instancias.Count; continue; }

                // --- Leer parámetros nativos Revit (WBS / Odoo) ---
                string keynote     = LeerParamTexto(wallType, BuiltInParameter.KEYNOTE_PARAM);
                string assemblyCode = LeerParamTexto(wallType, BuiltInParameter.UNIFORMAT_CODE);
                string rubroSsa    = SharedParamService.LeerTexto(wallType, "SSA_COD_RUBRO_ODOO");
                string rubro       = string.IsNullOrWhiteSpace(rubroSsa)
                    ? DeducirRubroDesdeAssembly(assemblyCode, "Muros")
                    : rubroSsa;

                // Función del muro (WallType.Function)
                string funcion = wallType.Function.ToString(); // Exterior, Interior, Foundation, etc.

                var elem = new BimElement
                {
                    RevitTypeId        = (int)tipoId.Value,
                    UniqueId           = wallType.UniqueId,
                    Categoria          = "Muros",
                    Familia            = wallType.FamilyName.Length > 0 ? wallType.FamilyName : "Muro Básico",
                    TipoRevit          = wallType.Name,
                    CantInstancias     = instancias.Count,
                    Origen             = OrigenPartida.BIM_DIRECTO,

                    // Clasificación WBS / Odoo
                    KeynoteCode        = keynote,
                    AssemblyCode       = assemblyCode,
                    RubroOdoo          = rubro,
                    FaseNombre         = ObtenerNombreFase(instancias[0]),
                    FuncionElemento    = funcion,

                    // Parámetros SSA_*
                    GuidIntegracion    = _extStorage.Leer(wallType).GuidIntegracion,
                    CodigoPartida      = SharedParamService.LeerTexto(wallType, "SSA_CODIGO_PARTIDA"),
                    SubPartida         = SharedParamService.LeerTexto(wallType, "SSA_SUBPARTIDA"),
                    NombreNormalizado  = SharedParamService.LeerTexto(wallType, "SSA_NOMBRE_NORMALIZADO"),
                    CriterioMedicion   = SharedParamService.LeerTexto(wallType, "SSA_CRITERIO_MEDICION")
                                         .DefaultIfEmpty("AREA_NETA"),
                    FactorDesperdicio  = SharedParamService.LeerNumero(wallType, "SSA_FACTOR_DESPERDICIO")
                                         .DefaultToOne(),
                    ObservacionRevit   = SharedParamService.LeerTexto(wallType, "SSA_OBSERVACION"),

                    // Acabados / derivados
                    AcabadoInterior    = SharedParamService.LeerTexto(wallType, "SSA_ACABADO_INT"),
                    AcabadoExterior    = SharedParamService.LeerTexto(wallType, "SSA_ACABADO_EXT"),
                    RevEspInt          = SharedParamService.LeerNumero(wallType, "SSA_REVOQUE_ESP_INT"),
                    RevEspExt          = SharedParamService.LeerNumero(wallType, "SSA_REVOQUE_ESP_EXT"),
                    PinturaTipoInt     = SharedParamService.LeerTexto(wallType, "SSA_PINTURA_TIPO_INT"),
                    PinturaTipoExt     = SharedParamService.LeerTexto(wallType, "SSA_PINTURA_TIPO_EXT"),
                    CeramicaAltura     = SharedParamService.LeerNumero(wallType, "SSA_CERAMICA_ALTURA"),
                    ConsiderarDintel   = SharedParamService.LeerBooleano(wallType, "SSA_CONSIDERAR_DINTEL", false),
                    ConsiderarRasgo    = SharedParamService.LeerBooleano(wallType, "SSA_CONSIDERAR_RASGO", false),
                    ConsiderarBuna     = SharedParamService.LeerBooleano(wallType, "SSA_CONSIDERAR_BUNA", false),

                    EspesorM           = Math.Round(wallType.Width * PIE_A_METRO, 4),
                    InstanciasElementIds = instancias.Select(m => m.Id.IntegerValue).ToList(),
                };

                // Acumular cantidades de todas las instancias del tipo
                foreach (Wall muro in instancias)
                {
                    double areaIntPies = ObtenerParamDouble(muro, BuiltInParameter.HOST_AREA_COMPUTED);
                    elem.AreaBrutaIntM2 += areaIntPies * PIE2_A_M2;
                    elem.AreaBrutaExtM2 += areaIntPies * PIE2_A_M2;

                    double volPies  = ObtenerParamDouble(muro, BuiltInParameter.HOST_VOLUME_COMPUTED);
                    elem.VolumenM3 += volPies * PIE3_A_M3;

                    double longPies = ObtenerParamDouble(muro, BuiltInParameter.CURVE_ELEM_LENGTH);
                    elem.LongitudML += longPies * PIE_A_METRO;

                    double altoPies = ObtenerParamDouble(muro, BuiltInParameter.WALL_USER_HEIGHT_PARAM);
                    elem.AlturaPromedio += altoPies * PIE_A_METRO;

                    if (string.IsNullOrEmpty(elem.Nivel))
                    {
                        Level? nivel = doc.GetElement(muro.LevelId) as Level;
                        elem.Nivel = nivel?.Name ?? string.Empty;
                    }

                    // Regla 3: calcular huecos
                    string muroGuid = muro.UniqueId;
                    if (huecosPorMuro.TryGetValue(muroGuid, out var huecosDelMuro))
                    {
                        foreach (var abertura in huecosDelMuro)
                        {
                            abertura.DescontarArea = abertura.AreaM2 >= UmbralHuecoM2;
                            elem.AreaHuecosM2 += abertura.AreaM2;
                            if (abertura.AreaM2 >= UmbralHuecoM2)
                                elem.AreaHuecosDescontadosM2 += abertura.AreaM2;
                        }
                    }
                }

                if (instancias.Count > 0)
                    elem.AlturaPromedio = Math.Round(elem.AlturaPromedio / instancias.Count, 4);

                elem.AreaBrutaIntM2           = Math.Round(elem.AreaBrutaIntM2, 4);
                elem.AreaBrutaExtM2           = Math.Round(elem.AreaBrutaExtM2, 4);
                elem.AreaHuecosM2             = Math.Round(elem.AreaHuecosM2, 4);
                elem.AreaHuecosDescontadosM2  = Math.Round(elem.AreaHuecosDescontadosM2, 4);
                elem.VolumenM3                = Math.Round(elem.VolumenM3, 4);
                elem.LongitudML               = Math.Round(elem.LongitudML, 4);

                // Regla 5: capas estructurales (si DesglosarCapas se activa desde ExportRule,
                // las capas ya están listas aquí para que el exportador las use)
                elem.CapasEstructurales = ExtraerCapasMuro(wallType, doc, elem.AreaBrutaIntM2);

                ValidarElemento(elem, result);
                CalcularPartidasDerivadas(elem);
                result.Elementos.Add(elem);
            }
        }

        // -----------------------------------------------------------------------
        // Extracción de pisos
        // -----------------------------------------------------------------------

        private void ExtraerPisos(Document doc, ExtractionResult result)
        {
            var grupos = new Dictionary<ElementId, (ElementType tipo, List<Element> inst)>();

            var collector = CrearCollector(doc)
                .OfCategory(BuiltInCategory.OST_Floors)
                .WhereElementIsNotElementType();

            foreach (Element piso in collector)
            {
                if (!PasaFiltroFase(piso)) continue;
                ElementId tipoId = piso.GetTypeId();
                if (tipoId == ElementId.InvalidElementId) continue;
                ElementType? tipo = doc.GetElement(tipoId) as ElementType;
                if (tipo == null) continue;

                if (!grupos.ContainsKey(tipoId))
                    grupos[tipoId] = (tipo, new List<Element>());
                grupos[tipoId].inst.Add(piso);
                result.TotalInstancias++;
            }

            foreach (var (tipoId, (tipo, instancias)) in grupos)
            {
                bool incluir = SharedParamService.LeerBooleano(tipo, "SSA_INCLUIR_COMPUTO", true);
                if (!incluir) { result.ExcluidosPorFlag += instancias.Count; continue; }

                var elem = CrearElementoBase(tipo, tipoId, "Pisos", instancias.Count, doc);
                elem.FaseNombre = ObtenerNombreFase(instancias[0]);

                foreach (var inst in instancias)
                {
                    elem.AreaBrutaIntM2 += ObtenerParamDouble(inst, BuiltInParameter.HOST_AREA_COMPUTED) * PIE2_A_M2;
                    elem.VolumenM3      += ObtenerParamDouble(inst, BuiltInParameter.HOST_VOLUME_COMPUTED) * PIE3_A_M3;
                    if (string.IsNullOrEmpty(elem.Nivel))
                    {
                        Level? niv = doc.GetElement(inst.LevelId) as Level;
                        elem.Nivel = niv?.Name ?? string.Empty;
                    }
                }
                elem.AreaBrutaIntM2 = Math.Round(elem.AreaBrutaIntM2, 4);
                elem.VolumenM3      = Math.Round(elem.VolumenM3, 4);

                // Capas estructurales del piso
                if (tipo is FloorType floorType)
                {
                    CompoundStructure? cs = floorType.GetCompoundStructure();
                    if (cs != null)
                        elem.CapasEstructurales = ExtraerCapasCompuestas(cs, doc, elem.AreaBrutaIntM2);
                }

                ValidarElemento(elem, result);
                result.Elementos.Add(elem);
            }
        }

        // -----------------------------------------------------------------------
        // Extracción de cielorrasos
        // -----------------------------------------------------------------------

        private void ExtraerCielorrasos(Document doc, ExtractionResult result)
        {
            var grupos = new Dictionary<ElementId, (ElementType tipo, List<Element> inst)>();

            var collector = CrearCollector(doc)
                .OfCategory(BuiltInCategory.OST_Ceilings)
                .WhereElementIsNotElementType();

            foreach (Element techo in collector)
            {
                if (!PasaFiltroFase(techo)) continue;
                ElementId tipoId = techo.GetTypeId();
                if (tipoId == ElementId.InvalidElementId) continue;
                ElementType? tipo = doc.GetElement(tipoId) as ElementType;
                if (tipo == null) continue;

                if (!grupos.ContainsKey(tipoId))
                    grupos[tipoId] = (tipo, new List<Element>());
                grupos[tipoId].inst.Add(techo);
                result.TotalInstancias++;
            }

            foreach (var (tipoId, (tipo, instancias)) in grupos)
            {
                bool incluir = SharedParamService.LeerBooleano(tipo, "SSA_INCLUIR_COMPUTO", true);
                if (!incluir) { result.ExcluidosPorFlag += instancias.Count; continue; }

                var elem = CrearElementoBase(tipo, tipoId, "Cielorrasos", instancias.Count, doc);
                elem.FaseNombre = ObtenerNombreFase(instancias[0]);

                foreach (var inst in instancias)
                    elem.AreaBrutaIntM2 += ObtenerParamDouble(inst, BuiltInParameter.HOST_AREA_COMPUTED) * PIE2_A_M2;

                elem.AreaBrutaIntM2 = Math.Round(elem.AreaBrutaIntM2, 4);
                ValidarElemento(elem, result);
                result.Elementos.Add(elem);
            }
        }

        // -----------------------------------------------------------------------
        // Extractor genérico universal — guiado por PerfilCategoria
        // Cubre estructuras, MEP, escaleras, equipos y cualquier otra categoría
        // que no tenga un método especializado propio.
        // -----------------------------------------------------------------------

        /// <summary>
        /// Extrae elementos de cualquier categoría Revit usando el perfil de medición.
        /// Agrupa instancias por tipo, acumula Area / Volumen / Longitud según el perfil,
        /// e intenta leer CompoundStructure para tipos que la soporten.
        /// </summary>
        private void ExtraerCategoriaGenerica(
            Document doc, ExtractionResult result, PerfilCategoria perfil)
        {
            var grupos = new Dictionary<ElementId, (ElementType tipo, List<Element> inst)>();

            var collector = CrearCollector(doc)
                .OfCategory(perfil.Bic)
                .WhereElementIsNotElementType();

            foreach (Element inst in collector)
            {
                if (!PasaFiltroFase(inst)) continue;

                ElementId tipoId = inst.GetTypeId();
                if (tipoId == ElementId.InvalidElementId) continue;
                ElementType? tipo = doc.GetElement(tipoId) as ElementType;
                if (tipo == null) continue;

                if (!grupos.ContainsKey(tipoId))
                    grupos[tipoId] = (tipo, new List<Element>());
                grupos[tipoId].inst.Add(inst);
                result.TotalInstancias++;
            }

            foreach (var (tipoId, (tipo, instancias)) in grupos)
            {
                bool incluir = SharedParamService.LeerBooleano(tipo, "SSA_INCLUIR_COMPUTO", true);
                if (!incluir) { result.ExcluidosPorFlag += instancias.Count; continue; }

                var elem = CrearElementoBase(tipo, tipoId, perfil.Nombre, instancias.Count, doc);
                elem.FaseNombre     = ObtenerNombreFase(instancias[0]);
                elem.Cantidad       = instancias.Count;
                elem.InstanciasElementIds = instancias.Select(i => i.Id.IntegerValue).ToList();

                // Usar criterio del perfil si SSA_* no lo definió
                if (string.IsNullOrEmpty(elem.CriterioMedicion))
                    elem.CriterioMedicion = perfil.CriterioDefault;

                // Acumular cantidades por instancia
                foreach (var inst in instancias)
                {
                    if (perfil.ExtraerArea)
                        elem.AreaBrutaIntM2 += ObtenerParamDouble(inst, BuiltInParameter.HOST_AREA_COMPUTED) * PIE2_A_M2;

                    if (perfil.ExtraerVolumen)
                        elem.VolumenM3 += ObtenerParamDouble(inst, BuiltInParameter.HOST_VOLUME_COMPUTED) * PIE3_A_M3;

                    if (perfil.ExtraerLongitud)
                        elem.LongitudML += ObtenerParamDouble(inst, BuiltInParameter.CURVE_ELEM_LENGTH) * PIE_A_METRO;

                    // Nivel predominante (tolerante a elementos sin nivel)
                    if (string.IsNullOrEmpty(elem.Nivel))
                    {
                        try
                        {
                            Level? niv = doc.GetElement(inst.LevelId) as Level;
                            elem.Nivel = niv?.Name ?? string.Empty;
                        }
                        catch { /* elemento sin LevelId — ignorar */ }
                    }
                }

                elem.AreaBrutaIntM2 = Math.Round(elem.AreaBrutaIntM2, 4);
                elem.VolumenM3      = Math.Round(elem.VolumenM3, 4);
                elem.LongitudML     = Math.Round(elem.LongitudML, 4);

                // CompoundStructure para tipos que la soportan (cubiertas, losas, etc.)
                if (perfil.ExtraerArea && elem.AreaBrutaIntM2 > 0)
                {
                    CompoundStructure? cs = null;
                    if      (tipo is RoofType  rt) cs = rt.GetCompoundStructure();
                    else if (tipo is FloorType ft)  cs = ft.GetCompoundStructure();
                    if (cs != null)
                        elem.CapasEstructurales = ExtraerCapasCompuestas(cs, doc, elem.AreaBrutaIntM2);
                }

                // Sección y peso para elementos metálicos (vigas / columnas)
                if (perfil.ExtraerLongitud && elem.LongitudML > 0)
                {
                    // Intentar leer sección del parámetro compartido SSA, luego del nombre del tipo
                    string seccion = SharedParamService.LeerTexto(tipo, "SSA_SECCION");
                    if (string.IsNullOrWhiteSpace(seccion))
                        seccion = PerfilesSteelService.ExtraerCodigoSeccion(tipo.Name);

                    if (!string.IsNullOrWhiteSpace(seccion))
                    {
                        elem.SeccionTransversal = seccion;
                        double pesoLin = PerfilesSteelService.ResolverPesoLineal(seccion);
                        if (pesoLin <= 0)
                            pesoLin = PerfilesSteelService.ResolverPesoLineal(tipo.Name);
                        elem.PesoLinealKgM = pesoLin;
                    }
                }

                ValidarElemento(elem, result);
                result.Elementos.Add(elem);
            }
        }

        // -----------------------------------------------------------------------
        // Extracción de aberturas (puertas y ventanas)
        // -----------------------------------------------------------------------

        private List<BimAbertura> ExtraerAberturas(Document doc, ExtractionResult result)
        {
            var aberturas = new List<BimAbertura>();

            var categorias = new[]
            {
                (BuiltInCategory.OST_Doors,   "Puertas"),
                (BuiltInCategory.OST_Windows,  "Ventanas"),
            };

            foreach (var (bic, nombreCategoria) in categorias)
            {
                var collector = CrearCollector(doc)
                    .OfCategory(bic)
                    .WhereElementIsNotElementType()
                    .Cast<FamilyInstance>();

                foreach (FamilyInstance inst in collector)
                {
                    if (!PasaFiltroFase(inst)) continue;
                    result.TotalInstancias++;

                    ElementId tipoId = inst.GetTypeId();
                    ElementType? tipo = doc.GetElement(tipoId) as ElementType;

                    bool incluir = tipo != null
                        ? SharedParamService.LeerBooleano(tipo, "SSA_INCLUIR_COMPUTO", true)
                        : true;

                    string guidHost = inst.Host?.UniqueId ?? string.Empty;

                    double anchoM = ObtenerParamDouble(inst, BuiltInParameter.FAMILY_WIDTH_PARAM)  * PIE_A_METRO;
                    double altoM  = ObtenerParamDouble(inst, BuiltInParameter.FAMILY_HEIGHT_PARAM) * PIE_A_METRO;
                    if (anchoM <= 0) anchoM = ObtenerParamDouble(inst, BuiltInParameter.FAMILY_ROUGH_WIDTH_PARAM)  * PIE_A_METRO;
                    if (altoM  <= 0) altoM  = ObtenerParamDouble(inst, BuiltInParameter.FAMILY_ROUGH_HEIGHT_PARAM) * PIE_A_METRO;

                    var abertura = new BimAbertura
                    {
                        RevitId       = inst.Id.Value > int.MaxValue ? 0 : (int)inst.Id.Value,
                        UniqueId      = inst.UniqueId,
                        Categoria     = nombreCategoria,
                        Familia       = inst.Symbol?.FamilyName ?? string.Empty,
                        Tipo          = inst.Symbol?.Name ?? string.Empty,
                        GuidHostMuro  = guidHost,
                        AnchoM        = Math.Round(anchoM, 4),
                        AltoM         = Math.Round(altoM,  4),
                        IncluirComputo = incluir,
                    };

                    if (tipo != null)
                    {
                        abertura.CodigoPartida = SharedParamService.LeerTexto(tipo, "SSA_CODIGO_PARTIDA");
                        abertura.NombreNorm    = SharedParamService.LeerTexto(tipo, "SSA_NOMBRE_NORMALIZADO");
                        abertura.DintelTipo    = SharedParamService.LeerTexto(tipo, "SSA_DINTEL_TIPO");
                        abertura.JambaTipo     = SharedParamService.LeerTexto(tipo, "SSA_JAMBA_TIPO");
                        abertura.AlfeizarTipo  = SharedParamService.LeerTexto(tipo, "SSA_ALFEIZAR_TIPO");
                        abertura.RoughWidthM   = SharedParamService.LeerNumero(tipo, "SSA_ROUGH_WIDTH");
                        abertura.RoughHeightM  = SharedParamService.LeerNumero(tipo, "SSA_ROUGH_HEIGHT");
                    }

                    abertura.DescontarArea = abertura.AreaM2 >= UmbralHuecoM2;
                    ValidarAbertura(abertura, result);
                    aberturas.Add(abertura);
                }
            }

            return aberturas;
        }

        /// <summary>
        /// Agrega las aberturas al resultado como BimElement agrupados por tipo (criterio UNIDAD).
        /// </summary>
        private void AgregarAberturasComoElementos(
            List<BimAbertura> aberturas, Document doc, ExtractionResult result)
        {
            var grupos = aberturas
                .Where(a => a.IncluirComputo)
                .GroupBy(a => $"{a.Categoria}|{a.Familia}|{a.Tipo}");

            foreach (var grupo in grupos)
            {
                var primera = grupo.First();

                // Buscar el ElementType para leer Keynote y AssemblyCode
                string keynote      = string.Empty;
                string assemblyCode = string.Empty;
                string rubro        = primera.Categoria;

                var tipoElem = new FilteredElementCollector(doc)
                    .OfCategory(primera.Categoria == "Puertas"
                        ? BuiltInCategory.OST_Doors
                        : BuiltInCategory.OST_Windows)
                    .WhereElementIsElementType()
                    .Cast<ElementType>()
                    .FirstOrDefault(t => t.FamilyName == primera.Familia && t.Name == primera.Tipo);

                if (tipoElem != null)
                {
                    keynote     = LeerParamTexto(tipoElem, BuiltInParameter.KEYNOTE_PARAM);
                    assemblyCode = LeerParamTexto(tipoElem, BuiltInParameter.UNIFORMAT_CODE);
                    string rubroSsa = SharedParamService.LeerTexto(tipoElem, "SSA_COD_RUBRO_ODOO");
                    rubro = string.IsNullOrWhiteSpace(rubroSsa)
                        ? DeducirRubroDesdeAssembly(assemblyCode, primera.Categoria)
                        : rubroSsa;
                }

                var elem = new BimElement
                {
                    Categoria         = primera.Categoria,
                    Familia           = primera.Familia,
                    TipoRevit         = primera.Tipo,
                    CantInstancias    = grupo.Count(),
                    Cantidad          = grupo.Count(),
                    CriterioMedicion  = "UNIDAD",
                    Origen            = OrigenPartida.BIM_DIRECTO,
                    CodigoPartida     = primera.CodigoPartida,
                    NombreNormalizado = primera.NombreNorm,
                    Nivel             = string.Empty,
                    FactorDesperdicio = 1.0,
                    EstadoValidacion  = EstadoValidacion.OK,
                    KeynoteCode       = keynote,
                    AssemblyCode      = assemblyCode,
                    RubroOdoo         = rubro,
                };
                result.Elementos.Add(elem);
            }
        }

        // -----------------------------------------------------------------------
        // Partidas derivadas (revoque, pintura, cerámica)
        // -----------------------------------------------------------------------

        private static void CalcularPartidasDerivadas(BimElement muro)
        {
            double areaNetaInt = muro.AreaNetaIntM2;
            double areaNetaExt = muro.AreaNetaExtM2;

            if (muro.RevEspInt > 0 && areaNetaInt > 0)
            {
                muro.PartidasDerivadas.Add(new PartidaDerivada
                {
                    Tipo              = TipoDerivada.REVOQUE_INTERIOR,
                    CodigoPartida     = $"{muro.CodigoPartida}-REV-INT",
                    Descripcion       = $"Revoque interior e={muro.RevEspInt * 100:F0}mm — {muro.TipoRevit}",
                    Cantidad          = Math.Round(areaNetaInt * muro.FactorDesperdicio, 4),
                    Unidad            = "m²",
                    FactorDesperdicio = muro.FactorDesperdicio,
                    Cara              = "INTERIOR",
                });
            }

            if (muro.RevEspExt > 0 && areaNetaExt > 0)
            {
                muro.PartidasDerivadas.Add(new PartidaDerivada
                {
                    Tipo              = TipoDerivada.REVOQUE_EXTERIOR,
                    CodigoPartida     = $"{muro.CodigoPartida}-REV-EXT",
                    Descripcion       = $"Revoque exterior e={muro.RevEspExt * 100:F0}mm — {muro.TipoRevit}",
                    Cantidad          = Math.Round(areaNetaExt * muro.FactorDesperdicio, 4),
                    Unidad            = "m²",
                    FactorDesperdicio = muro.FactorDesperdicio,
                    Cara              = "EXTERIOR",
                });
            }

            if (!string.IsNullOrEmpty(muro.PinturaTipoInt) &&
                muro.PinturaTipoInt.ToUpperInvariant() != "NINGUNO" && areaNetaInt > 0)
            {
                double areaPintInt = muro.CeramicaAltura > 0
                    ? Math.Max(0, areaNetaInt - muro.LongitudML * muro.CeramicaAltura)
                    : areaNetaInt;

                if (areaPintInt > 0)
                {
                    muro.PartidasDerivadas.Add(new PartidaDerivada
                    {
                        Tipo              = TipoDerivada.PINTURA_INTERIOR,
                        CodigoPartida     = $"{muro.CodigoPartida}-PINT-INT",
                        Descripcion       = $"Pintura {muro.PinturaTipoInt} interior — {muro.TipoRevit}",
                        Cantidad          = Math.Round(areaPintInt * muro.FactorDesperdicio, 4),
                        Unidad            = "m²",
                        FactorDesperdicio = muro.FactorDesperdicio,
                        Cara              = "INTERIOR",
                    });
                }
            }

            if (!string.IsNullOrEmpty(muro.PinturaTipoExt) &&
                muro.PinturaTipoExt.ToUpperInvariant() != "NINGUNO" && areaNetaExt > 0)
            {
                muro.PartidasDerivadas.Add(new PartidaDerivada
                {
                    Tipo              = TipoDerivada.PINTURA_EXTERIOR,
                    CodigoPartida     = $"{muro.CodigoPartida}-PINT-EXT",
                    Descripcion       = $"Pintura {muro.PinturaTipoExt} exterior — {muro.TipoRevit}",
                    Cantidad          = Math.Round(areaNetaExt * muro.FactorDesperdicio, 4),
                    Unidad            = "m²",
                    FactorDesperdicio = muro.FactorDesperdicio,
                    Cara              = "EXTERIOR",
                });
            }

            if (muro.CeramicaAltura > 0 && muro.LongitudML > 0)
            {
                double areaCeramica = Math.Round(muro.LongitudML * muro.CeramicaAltura, 4);
                if (areaCeramica > 0)
                {
                    muro.PartidasDerivadas.Add(new PartidaDerivada
                    {
                        Tipo              = TipoDerivada.CERAMICA_MURO,
                        CodigoPartida     = $"{muro.CodigoPartida}-CER",
                        Descripcion       = $"Cerámica h={muro.CeramicaAltura:F2}m — {muro.TipoRevit}",
                        Cantidad          = Math.Round(areaCeramica * muro.FactorDesperdicio, 4),
                        Unidad            = "m²",
                        FactorDesperdicio = muro.FactorDesperdicio,
                        Cara              = "INTERIOR",
                        Observacion       = $"Longitud neta: {muro.LongitudML:F2} ml × {muro.CeramicaAltura:F2} m",
                    });
                }
            }
        }

        // -----------------------------------------------------------------------
        // Capas estructurales (Material Takeoff multicapa)
        // -----------------------------------------------------------------------

        /// <summary>
        /// Lee las capas del CompoundStructure de un WallType y calcula sus cantidades.
        /// Solo extrae capas con espesor > 0 y material asignado.
        /// </summary>
        private static List<CapaMaterial> ExtraerCapasMuro(
            WallType wallType, Document doc, double areaTotalM2)
        {
            CompoundStructure? cs = wallType.GetCompoundStructure();
            if (cs == null) return new List<CapaMaterial>();
            return ExtraerCapasCompuestas(cs, doc, areaTotalM2);
        }

        /// <summary>
        /// Lee las capas de cualquier CompoundStructure (muro, piso, techo).
        /// </summary>
        private static List<CapaMaterial> ExtraerCapasCompuestas(
            CompoundStructure cs, Document doc, double areaTotalM2)
        {
            var capas = new List<CapaMaterial>();
            int indice = 0;

            foreach (CompoundStructureLayer capa in cs.GetLayers())
            {
                double espesorM = Math.Round(capa.Width * PIE_A_METRO, 4);
                if (espesorM <= 0) { indice++; continue; }

                string nombreMaterial = "(Sin material)";
                if (capa.MaterialId != ElementId.InvalidElementId)
                {
                    Material? mat = doc.GetElement(capa.MaterialId) as Material;
                    if (mat != null) nombreMaterial = mat.Name;
                }

                double volM3 = Math.Round(areaTotalM2 * espesorM, 4);
                string funcion = capa.Function.ToString();

                capas.Add(new CapaMaterial
                {
                    NombreMaterial      = nombreMaterial,
                    Funcion             = funcion,
                    Indice              = indice,
                    EspesorM            = espesorM,
                    AreaM2              = Math.Round(areaTotalM2, 4),
                    VolumenM3           = volM3,
                    DescripcionSugerida = $"{nombreMaterial} e={espesorM * 100:F0}mm",
                });
                indice++;
            }

            return capas;
        }

        // -----------------------------------------------------------------------
        // Validaciones (Regla 1 del SRS)
        // -----------------------------------------------------------------------

        private static void ValidarElemento(BimElement elem, ExtractionResult result)
        {
            if (string.IsNullOrEmpty(elem.TipoRevit))
            {
                elem.MensajesValidacion.Add("ERROR: tipo de elemento vacío");
                elem.EstadoValidacion = EstadoValidacion.ERROR;
            }

            if (string.IsNullOrEmpty(elem.GuidIntegracion))
                elem.MensajesValidacion.Add("ADVERTENCIA: SSA_GUID_INTEGRACION no asignado aún");

            if (string.IsNullOrEmpty(elem.CodigoPartida) && string.IsNullOrEmpty(elem.KeynoteCode))
            {
                elem.MensajesValidacion.Add("ADVERTENCIA: ni Código de Partida ni Keynote asignados");
                if (elem.EstadoValidacion == EstadoValidacion.OK)
                    elem.EstadoValidacion = EstadoValidacion.ADVERTENCIA;
            }

            if (elem.CantidadPrincipal <= 0)
            {
                elem.MensajesValidacion.Add("ADVERTENCIA: cantidad principal = 0");
                if (elem.EstadoValidacion == EstadoValidacion.OK)
                    elem.EstadoValidacion = EstadoValidacion.ADVERTENCIA;
            }

            if (elem.EstadoValidacion == EstadoValidacion.ADVERTENCIA)
                result.Advertencias.Add($"{elem.TipoRevit}: {string.Join("; ", elem.MensajesValidacion)}");
        }

        private static void ValidarAbertura(BimAbertura ab, ExtractionResult result)
        {
            if (ab.AnchoM <= 0 || ab.AltoM <= 0)
            {
                ab.MensajesValidacion.Add("ADVERTENCIA: dimensiones de abertura en 0 — verificar familia");
                ab.EstadoValidacion = EstadoValidacion.ADVERTENCIA;
                result.Advertencias.Add($"{ab.Tipo}: {string.Join("; ", ab.MensajesValidacion)}");
            }

            if (string.IsNullOrEmpty(ab.GuidHostMuro))
            {
                ab.MensajesValidacion.Add("ADVERTENCIA: abertura sin muro host identificado");
                ab.EstadoValidacion = EstadoValidacion.ADVERTENCIA;
            }
        }

        // -----------------------------------------------------------------------
        // Helpers
        // -----------------------------------------------------------------------

        /// <summary>
        /// Fábrica de BimElement para categorías genéricas (Pisos, Cielorrasos, etc.).
        /// Lee todos los parámetros SSA_* y los parámetros nativos WBS/Odoo.
        /// </summary>
        private BimElement CrearElementoBase(
            ElementType tipo, ElementId tipoId, string categoria, int cant, Document doc)
        {
            string keynote      = LeerParamTexto(tipo, BuiltInParameter.KEYNOTE_PARAM);
            string assemblyCode = LeerParamTexto(tipo, BuiltInParameter.UNIFORMAT_CODE);
            string rubroSsa     = SharedParamService.LeerTexto(tipo, "SSA_COD_RUBRO_ODOO");
            string rubro        = string.IsNullOrWhiteSpace(rubroSsa)
                ? DeducirRubroDesdeAssembly(assemblyCode, categoria)
                : rubroSsa;

            return new BimElement
            {
                RevitTypeId       = (int)tipoId.Value,
                UniqueId          = tipo.UniqueId,
                Categoria         = categoria,
                Familia           = tipo.FamilyName,
                TipoRevit         = tipo.Name,
                CantInstancias    = cant,
                Origen            = OrigenPartida.BIM_DIRECTO,

                // Clasificación WBS / Odoo
                KeynoteCode       = keynote,
                AssemblyCode      = assemblyCode,
                RubroOdoo         = rubro,

                // Parámetros SSA_*
                GuidIntegracion   = _extStorage.Leer(tipo).GuidIntegracion,
                CodigoPartida     = SharedParamService.LeerTexto(tipo, "SSA_CODIGO_PARTIDA"),
                NombreNormalizado = SharedParamService.LeerTexto(tipo, "SSA_NOMBRE_NORMALIZADO"),
                CriterioMedicion  = SharedParamService.LeerTexto(tipo, "SSA_CRITERIO_MEDICION").DefaultIfEmpty("AREA_NETA"),
                FactorDesperdicio = SharedParamService.LeerNumero(tipo, "SSA_FACTOR_DESPERDICIO").DefaultToOne(),
                ObservacionRevit  = SharedParamService.LeerTexto(tipo, "SSA_OBSERVACION"),
            };
        }

        /// <summary>
        /// Lee un parámetro nativo de Revit como texto (string o valueString).
        /// Devuelve string.Empty si el parámetro no existe o está vacío.
        /// </summary>
        private static string LeerParamTexto(Element elem, BuiltInParameter bip)
        {
            Parameter? p = elem.get_Parameter(bip);
            if (p == null) return string.Empty;
            if (p.StorageType == StorageType.String)
                return p.AsString() ?? string.Empty;
            return p.AsValueString() ?? string.Empty;
        }

        /// <summary>
        /// Lee el nombre de la fase de creación de un elemento instancia.
        /// Devuelve string.Empty si el elemento no tiene fase asignada.
        /// </summary>
        private string ObtenerNombreFase(Element instancia)
        {
            if (_doc == null) return string.Empty;
            try
            {
                Parameter? pFase = instancia.get_Parameter(BuiltInParameter.PHASE_CREATED);
                if (pFase == null || pFase.StorageType != StorageType.ElementId) return string.Empty;
                ElementId faseId = pFase.AsElementId();
                if (faseId == ElementId.InvalidElementId) return string.Empty;
                return _doc.GetElement(faseId)?.Name ?? string.Empty;
            }
            catch { return string.Empty; }
        }

        /// <summary>
        /// Verifica si un elemento pasa el filtro de fase activo.
        /// Siempre devuelve true cuando el filtro no es por fase.
        /// </summary>
        private bool PasaFiltroFase(Element elem)
        {
            if (_filtro.Alcance != FiltroExtraccion.TipoAlcance.Fase
                || string.IsNullOrWhiteSpace(_filtro.FaseNombre))
                return true;

            return ObtenerNombreFase(elem) == _filtro.FaseNombre;
        }

        /// <summary>
        /// Deduce un rubro legible (WBS Nivel 1) a partir del Assembly Code (Uniformat).
        /// Mapeo básico de primer dígito alfabético. Usa la categoría Revit como fallback.
        /// </summary>
        private static string DeducirRubroDesdeAssembly(string assemblyCode, string categoriaRevit)
        {
            if (string.IsNullOrWhiteSpace(assemblyCode))
                return categoriaRevit;

            return assemblyCode.ToUpperInvariant().TrimStart()[0] switch
            {
                'A' => "Obra Gruesa / Excavaciones y Fundaciones",
                'B' => "Obra Gruesa / Estructura",
                'C' => "Obra Fina / Cerramientos y Fachadas",
                'D' => "Instalaciones / Servicios",
                'E' => "Equipamiento",
                'F' => "Obra Especial",
                'G' => "Urbanización y Sitio",
                'Z' => "General",
                _   => categoriaRevit,
            };
        }

        private static double ObtenerParamDouble(Element elem, BuiltInParameter bip)
        {
            Parameter? p = elem.get_Parameter(bip);
            if (p == null || p.StorageType != StorageType.Double) return 0;
            double v = p.AsDouble();
            return v > 0 ? v : 0;
        }

        // -----------------------------------------------------------------------
        // Aplicación de perfiles de parámetros custom (wizard)
        // -----------------------------------------------------------------------

        /// <summary>
        /// Aplica los perfiles de parámetros custom a los elementos extraídos.
        /// Lee parámetros directos del modelo y evalúa fórmulas calculadas.
        /// Debe llamarse después de Extraer() con el documento aún abierto.
        /// </summary>
        /// <param name="doc">Documento Revit activo.</param>
        /// <param name="result">Resultado de la extracción.</param>
        /// <param name="perfiles">Perfiles configurados en el wizard.</param>
        public void AplicarPerfilesCustom(
            Document doc, ExtractionResult result, List<FamilyParamProfile> perfiles)
        {
            if (perfiles.Count == 0) return;

            // Indexar perfiles por clave "Categoria|Familia"
            var indicePerfil = perfiles.ToDictionary(
                p => p.Clave, p => p, StringComparer.OrdinalIgnoreCase);

            // Cache de tipos ya procesados → evitar releer parámetros
            var cacheCustomValues = new Dictionary<string, Dictionary<string, object>>();
            var cacheNotasIA      = new Dictionary<string, Dictionary<string, string>>();

            foreach (var elem in result.Elementos)
            {
                string clavePerf = $"{elem.Categoria}|{elem.Familia}";
                if (!indicePerfil.TryGetValue(clavePerf, out var perfil)) continue;

                // Nota general de la familia
                if (!string.IsNullOrWhiteSpace(perfil.NotaGeneralIA))
                    elem.NotaFamiliaIA = perfil.NotaGeneralIA;

                // Cache por UniqueId del tipo (todos los del mismo tipo comparten valores)
                if (cacheCustomValues.TryGetValue(elem.UniqueId, out var cachedVals))
                {
                    elem.ParametrosCustomValues = new Dictionary<string, object>(cachedVals);
                    elem.NotasIA = new Dictionary<string, string>(cacheNotasIA[elem.UniqueId]);
                    continue;
                }

                var customValues = new Dictionary<string, object>();
                var notasIA      = new Dictionary<string, string>();

                // Obtener el ElementType para leer parámetros del tipo
                Element? tipoElem = null;
                Element? instEjem = null;

                try
                {
                    var tiposCollector = new FilteredElementCollector(doc)
                        .WhereElementIsElementType()
                        .Where(e => e.UniqueId == elem.UniqueId)
                        .FirstOrDefault();
                    tipoElem = tiposCollector;

                    // Buscar una instancia de ejemplo para params de instancia
                    if (tipoElem != null)
                    {
                        var tipoId = tipoElem.Id;
                        instEjem = new FilteredElementCollector(doc)
                            .OfCategory(ObtenerBuiltInCategory(elem.Categoria))
                            .WhereElementIsNotElementType()
                            .FirstOrDefault(e => e.GetTypeId() == tipoId);
                    }
                }
                catch { /* fallback: no leer params custom */ }

                if (tipoElem == null)
                {
                    cacheCustomValues[elem.UniqueId] = customValues;
                    cacheNotasIA[elem.UniqueId]      = notasIA;
                    continue;
                }

                // --- Leer parámetros directos ---
                // Diccionario de todos los valores numéricos disponibles (para fórmulas)
                var valoresParaFormula = BuildValoresBase(elem);

                foreach (var pd in perfil.ParametrosDirectos.Where(p => p.Activo))
                {
                    Element? source = pd.Origen == "Instance" ? instEjem : tipoElem;
                    if (source == null) source = tipoElem;

                    Parameter? param = BuscarParametro(source, pd.NombreRevit, pd.ParamGuid);
                    if (param == null) continue;

                    string claveExport = pd.ClaveExport;

                    if (pd.EsNumerico)
                    {
                        double valor = FamilyParameterScanner.LeerValorNumerico(param);
                        customValues[claveExport] = valor;
                        valoresParaFormula[pd.NombreRevit] = valor;
                    }
                    else
                    {
                        string valor = FamilyParameterScanner.LeerValorTexto(param);
                        if (!string.IsNullOrWhiteSpace(valor))
                            customValues[claveExport] = valor;
                    }

                    if (!string.IsNullOrWhiteSpace(pd.NotaIA))
                        notasIA[claveExport] = pd.NotaIA;
                }

                // --- Evaluar fórmulas calculadas ---
                foreach (var pc in perfil.ParametrosCalculados.Where(c => c.Activo))
                {
                    if (string.IsNullOrWhiteSpace(pc.Formula)) continue;

                    var resultado = FormulaEvaluator.Evaluar(pc.Formula, valoresParaFormula);
                    if (resultado.Exito)
                    {
                        customValues[pc.ClaveExport] = resultado.Valor;
                    }

                    if (!string.IsNullOrWhiteSpace(pc.NotaIA))
                        notasIA[pc.ClaveExport] = pc.NotaIA;
                }

                elem.ParametrosCustomValues = customValues;
                elem.NotasIA = notasIA;

                // Cachear
                cacheCustomValues[elem.UniqueId] = customValues;
                cacheNotasIA[elem.UniqueId]      = notasIA;
            }
        }

        /// <summary>
        /// Construye un diccionario con los valores estándar del BimElement
        /// para que las fórmulas puedan referenciarlos.
        /// </summary>
        private static Dictionary<string, double> BuildValoresBase(BimElement elem)
        {
            // Aliases "Area" y "Espesor" eliminados — usar AreaBrutaInt y Width.
            // "Area" causaba confusión: es la suma de HOST_AREA_COMPUTED
            // de todas las instancias del tipo, no un valor observable individual.
            return new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase)
            {
                ["AreaBrutaInt"]      = elem.AreaBrutaIntM2,
                ["AreaBrutaExt"]      = elem.AreaBrutaExtM2,
                ["AreaNetaInt"]       = elem.AreaNetaIntM2,
                ["AreaNetaExt"]       = elem.AreaNetaExtM2,
                ["OpeningsArea"]      = elem.AreaHuecosDescontadosM2,
                ["Volume"]            = elem.VolumenM3,
                ["Length"]            = elem.LongitudML,
                ["Height"]            = elem.AlturaPromedio,
                ["Width"]             = elem.EspesorM,
                ["Count"]             = elem.CantInstancias,
                ["Cantidad"]          = elem.Cantidad,
                ["CantidadPrincipal"] = elem.CantidadPrincipal,
                ["PesoTotalKg"]       = elem.PesoTotalKg,
                ["PesoLinealKgM"]     = elem.PesoLinealKgM,
            };
        }

        /// <summary>
        /// Busca un parámetro por nombre o GUID en un elemento.
        /// </summary>
        private static Parameter? BuscarParametro(Element elem, string nombre, string guidStr)
        {
            // Intentar por GUID primero (más confiable)
            if (!string.IsNullOrWhiteSpace(guidStr) && Guid.TryParse(guidStr, out var guid))
            {
                var p = elem.get_Parameter(guid);
                if (p != null) return p;
            }

            // Fallback por nombre
            foreach (Parameter p in elem.Parameters)
            {
                if (p.Definition?.Name?.Equals(nombre, StringComparison.OrdinalIgnoreCase) == true)
                    return p;
            }

            return null;
        }

        /// <summary>
        /// Mapea nombre de categoría (español) a BuiltInCategory.
        /// </summary>
        private static BuiltInCategory ObtenerBuiltInCategory(string categoria)
        {
            return categoria switch
            {
                "Muros"               => BuiltInCategory.OST_Walls,
                "Losas"               => BuiltInCategory.OST_Floors,
                "Cubiertas"           => BuiltInCategory.OST_Roofs,
                "Cielorrasos"         => BuiltInCategory.OST_Ceilings,
                "Puertas"             => BuiltInCategory.OST_Doors,
                "Ventanas"            => BuiltInCategory.OST_Windows,
                "Pilares Arq."        => BuiltInCategory.OST_Columns,
                "Pilares Est."        => BuiltInCategory.OST_StructuralColumns,
                "Vigas/Cerchas"       => BuiltInCategory.OST_StructuralFraming,
                "Escaleras"           => BuiltInCategory.OST_Stairs,
                "Rampas"              => BuiltInCategory.OST_Ramps,
                "Barandas"            => BuiltInCategory.OST_StairsRailing,
                "Modelos Genéricos"   => BuiltInCategory.OST_GenericModel,
                "Mobiliario"          => BuiltInCategory.OST_Furniture,
                "Eq. Especial"        => BuiltInCategory.OST_SpecialityEquipment,
                "Sanitarios"          => BuiltInCategory.OST_PlumbingFixtures,
                "Equipos Mec."        => BuiltInCategory.OST_MechanicalEquipment,
                "Luminarias"          => BuiltInCategory.OST_ElectricalFixtures,
                "Eq. Eléctrico"       => BuiltInCategory.OST_ElectricalEquipment,
                "Tuberías"            => BuiltInCategory.OST_PipeCurves,
                "Ductos"              => BuiltInCategory.OST_DuctCurves,
                "Bandejas Eléctricas" => BuiltInCategory.OST_CableTray,
                "Fundaciones"         => BuiltInCategory.OST_StructuralFoundation,
                _                     => BuiltInCategory.OST_GenericModel,
            };
        }
    }

    // -----------------------------------------------------------------------
    // Extensiones de conveniencia
    // -----------------------------------------------------------------------

    internal static class Ext
    {
        public static string DefaultIfEmpty(this string s, string def) =>
            string.IsNullOrWhiteSpace(s) ? def : s;

        public static double DefaultToOne(this double d) =>
            d <= 0 ? 1.0 : d;
    }
}
