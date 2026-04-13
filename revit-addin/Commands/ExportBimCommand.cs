// Commands/ExportBimCommand.cs
// Extrae elementos BIM del modelo Revit y los envía a ConstructionOS.
// Flujo: RevitExtractionService.Extraer() → POST import_bim_elements
// Autor: SSA Ingenieria SRL

using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using RvtConstructionOS.Models;
using RvtConstructionOS.Services;

namespace RvtConstructionOS.Commands
{
    [Transaction(TransactionMode.ReadOnly)]
    [Regeneration(RegenerationOption.Manual)]
    public class ExportBimCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            var config = AppConfig.Load();
            if (!config.IsValid)
            {
                TaskDialog.Show("Exportar BIM",
                    "Configure la conexión con ConstructionOS primero.\n" +
                    "Use el botón 'Configuración'.");
                return Result.Cancelled;
            }

            if (!config.HasProject)
            {
                TaskDialog.Show("Exportar BIM",
                    "Seleccione un proyecto activo en Configuración.");
                return Result.Cancelled;
            }

            Document? doc = commandData.Application.ActiveUIDocument?.Document;
            if (doc == null || doc.IsFamilyDocument)
            {
                TaskDialog.Show("Exportar BIM",
                    "Este comando requiere un modelo de proyecto (.rvt) abierto.");
                return Result.Cancelled;
            }

            try
            {
                // Extraer elementos del modelo
                var extractionService = new RevitExtractionService();
                var filtro = FiltroExtraccion.Completo;
                var extractionResult = extractionService.Extraer(doc, filtro);

                if (extractionResult.Elementos.Count == 0)
                {
                    TaskDialog.Show("Exportar BIM", "No se encontraron elementos para exportar.");
                    return Result.Succeeded;
                }

                // Convertir a payload para el servidor — enviar TODOS los parámetros
                var payloads = new List<BimElementPayload>();
                foreach (var elem in extractionResult.Elementos)
                {
                    // Parámetros numéricos (todos los disponibles)
                    var parametros = new Dictionary<string, double>
                    {
                        ["Area"] = elem.AreaNetaIntM2,
                        ["AreaBruta"] = elem.AreaBrutaIntM2,
                        ["AreaBrutaExt"] = elem.AreaBrutaExtM2,
                        ["AreaExt"] = elem.AreaNetaExtM2,
                        ["OpeningsArea"] = elem.AreaHuecosDescontadosM2,
                        ["OpeningsAreaTotal"] = elem.AreaHuecosM2,
                        ["OpeningsAreaNoDesc"] = elem.AreaHuecosNoDescontadosM2,
                        ["Volume"] = elem.VolumenM3,
                        ["Length"] = elem.LongitudML,
                        ["Height"] = elem.AlturaPromedio,
                        ["Width"] = elem.EspesorM,
                        ["Count"] = elem.CantInstancias,
                        ["Cantidad"] = elem.Cantidad,
                        ["FactorDesperdicio"] = elem.FactorDesperdicio,
                        ["CantidadPrincipal"] = elem.CantidadPrincipal,
                        ["CantidadConDesperdicio"] = elem.CantidadConDesperdicio,
                        ["RevEspInt"] = elem.RevEspInt,
                        ["RevEspExt"] = elem.RevEspExt,
                        ["CeramicaAltura"] = elem.CeramicaAltura,
                        ["PesoLinealKgM"] = elem.PesoLinealKgM,
                        ["PesoTotalKg"] = elem.PesoTotalKg,
                    };

                    // Metadata textual (contexto rico para el agente IA)
                    var metadata = new Dictionary<string, string>();
                    if (!string.IsNullOrEmpty(elem.Nivel)) metadata["Nivel"] = elem.Nivel;
                    if (!string.IsNullOrEmpty(elem.FuncionElemento)) metadata["Funcion"] = elem.FuncionElemento;
                    if (!string.IsNullOrEmpty(elem.FaseNombre)) metadata["Fase"] = elem.FaseNombre;
                    if (!string.IsNullOrEmpty(elem.KeynoteCode)) metadata["Keynote"] = elem.KeynoteCode;
                    if (!string.IsNullOrEmpty(elem.AssemblyCode)) metadata["AssemblyCode"] = elem.AssemblyCode;
                    if (!string.IsNullOrEmpty(elem.CriterioMedicion)) metadata["CriterioMedicion"] = elem.CriterioMedicion;
                    if (!string.IsNullOrEmpty(elem.UnidadPrincipal)) metadata["UnidadPrincipal"] = elem.UnidadPrincipal;
                    if (!string.IsNullOrEmpty(elem.AcabadoInterior)) metadata["AcabadoInterior"] = elem.AcabadoInterior;
                    if (!string.IsNullOrEmpty(elem.AcabadoExterior)) metadata["AcabadoExterior"] = elem.AcabadoExterior;
                    if (!string.IsNullOrEmpty(elem.PinturaTipoInt)) metadata["PinturaTipoInt"] = elem.PinturaTipoInt;
                    if (!string.IsNullOrEmpty(elem.PinturaTipoExt)) metadata["PinturaTipoExt"] = elem.PinturaTipoExt;
                    if (!string.IsNullOrEmpty(elem.SeccionTransversal)) metadata["SeccionTransversal"] = elem.SeccionTransversal;
                    if (!string.IsNullOrEmpty(elem.CodigoPartida)) metadata["CodigoPartida"] = elem.CodigoPartida;
                    if (!string.IsNullOrEmpty(elem.SubPartida)) metadata["SubPartida"] = elem.SubPartida;
                    if (!string.IsNullOrEmpty(elem.NombreNormalizado)) metadata["NombreNormalizado"] = elem.NombreNormalizado;
                    if (!string.IsNullOrEmpty(elem.ObservacionRevit)) metadata["Observacion"] = elem.ObservacionRevit;
                    if (!string.IsNullOrEmpty(elem.RubroOdoo)) metadata["Rubro"] = elem.RubroOdoo;
                    if (elem.ConsiderarDintel) metadata["ConsiderarDintel"] = "true";
                    if (elem.ConsiderarRasgo) metadata["ConsiderarRasgo"] = "true";
                    if (elem.ConsiderarBuna) metadata["ConsiderarBuna"] = "true";
                    if (!elem.IncluirComputo) metadata["IncluirComputo"] = "false";

                    // Capas estructurales (CompoundStructure)
                    if (elem.CapasEstructurales?.Count > 0)
                    {
                        var capasInfo = string.Join(" | ", elem.CapasEstructurales.Select(c =>
                            $"{c.Funcion}:{c.NombreMaterial}:{c.EspesorM:F3}m"));
                        metadata["CapasEstructurales"] = capasInfo;
                    }

                    // COS_* write-back data (from previous sync, if any)
                    // Read from Revit ElementType so server knows prior mapping state
                    try
                    {
                        var typeId = new ElementId((long)elem.RevitTypeId);
                        var revitType = doc.GetElement(typeId);
                        if (revitType != null)
                        {
                            string? cosCodigo = LeerCosParam(revitType, new Guid("a1b2c3d4-0004-0004-0004-000000000001"));
                            string? cosNombre = LeerCosParam(revitType, new Guid("a1b2c3d4-0004-0004-0004-000000000002"));
                            string? cosFormula = LeerCosParam(revitType, new Guid("a1b2c3d4-0004-0004-0004-000000000003"));
                            string? cosNotas = LeerCosParam(revitType, new Guid("a1b2c3d4-0004-0004-0004-000000000005"));
                            string? cosEstado = LeerCosParam(revitType, new Guid("a1b2c3d4-0004-0004-0004-000000000006"));

                            if (!string.IsNullOrEmpty(cosCodigo)) metadata["COS_PartidaCodigo"] = cosCodigo;
                            if (!string.IsNullOrEmpty(cosNombre)) metadata["COS_PartidaNombre"] = cosNombre;
                            if (!string.IsNullOrEmpty(cosFormula)) metadata["COS_Formula"] = cosFormula;
                            if (!string.IsNullOrEmpty(cosNotas)) metadata["COS_NotasMapeo"] = cosNotas;
                            if (!string.IsNullOrEmpty(cosEstado)) metadata["COS_Estado"] = cosEstado;
                        }
                    }
                    catch { /* COS params not bound yet — normal on first export */ }

                    var payload = new BimElementPayload
                    {
                        RevitId = elem.RevitTypeId.ToString(),
                        UniqueId = elem.UniqueId ?? "",
                        Categoria = elem.Categoria,
                        Familia = elem.Familia,
                        Tipo = elem.TipoRevit,
                        Parametros = parametros,
                        Metadata = metadata,
                    };
                    payloads.Add(payload);
                }

                // Enviar al servidor
                var service = new ConstructionOSService(config);
                string archivoNombre = doc.Title ?? "Revit Export";

                var task = Task.Run(() => service.ImportBimElementsAsync(
                    config.ProyectoId, archivoNombre, payloads));
                var result = task.GetAwaiter().GetResult();

                string resumen = $"Exportación completada:\n\n" +
                    $"  Elementos enviados: {result.TotalElementos}\n" +
                    $"  Con categoría válida: {result.ConCategoria}\n" +
                    $"  Sin categoría: {result.SinCategoria}\n" +
                    $"  ID importación: {result.ImportacionId}";

                if (result.CategoriasDesconocidas.Count > 0)
                {
                    resumen += $"\n\nCategorías desconocidas:\n  " +
                        string.Join("\n  ", result.CategoriasDesconocidas);
                }

                TaskDialog.Show("Exportar BIM", resumen);
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                TaskDialog.Show("Error al exportar BIM",
                    $"Error: {ex.Message}\n\n{ex.InnerException?.Message}");
                return Result.Failed;
            }
        }

        private static string? LeerCosParam(Element elem, Guid paramGuid)
        {
            var param = elem.get_Parameter(paramGuid);
            if (param == null || !param.HasValue) return null;
            string val = param.AsString() ?? param.AsValueString() ?? "";
            return string.IsNullOrWhiteSpace(val) ? null : val;
        }
    }
}
