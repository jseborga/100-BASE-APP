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

                // Cargar reglas y aplicar perfiles custom (wizard)
                var ruleSet = ExportRuleService.Cargar(doc);
                if (ruleSet.PerfilesParametros.Count > 0)
                {
                    extractionService.AplicarPerfilesCustom(
                        doc, extractionResult, ruleSet.PerfilesParametros);
                }

                // Filtrar elementos excluidos por regla (Incluir=false)
                var indiceReglas = ruleSet.Reglas
                    .ToDictionary(r => r.TypeUniqueId, r => r, StringComparer.OrdinalIgnoreCase);

                var elementosFiltrados = extractionResult.Elementos
                    .Where(elem =>
                    {
                        if (!indiceReglas.TryGetValue(elem.UniqueId, out var regla))
                            return true; // Sin regla → incluir por defecto
                        return regla.Incluir;
                    })
                    .ToList();

                // Group openings by host wall UniqueId for N:1 pre-computation
                var huecosPorMuro = new Dictionary<string, List<BimAbertura>>();
                foreach (var ab in extractionResult.Aberturas)
                {
                    if (string.IsNullOrEmpty(ab.GuidHostMuro)) continue;
                    if (!huecosPorMuro.ContainsKey(ab.GuidHostMuro))
                        huecosPorMuro[ab.GuidHostMuro] = new List<BimAbertura>();
                    huecosPorMuro[ab.GuidHostMuro].Add(ab);
                }

                // Convert to payloads using BimSerializer
                var payloads = new List<BimElementPayload>();
                foreach (var elem in elementosFiltrados)
                {
                    // Asignar CriterioMedicion de la regla si el elemento no lo tiene
                    if (string.IsNullOrEmpty(elem.CriterioMedicion) &&
                        indiceReglas.TryGetValue(elem.UniqueId, out var reglaElem) &&
                        !string.IsNullOrEmpty(reglaElem.CriterioMedicion))
                    {
                        elem.CriterioMedicion = reglaElem.CriterioMedicion;
                    }

                    List<BimAbertura>? wallOpenings = null;
                    if (elem.Categoria == "Muros" && huecosPorMuro.TryGetValue(elem.UniqueId, out var openings))
                        wallOpenings = openings;

                    payloads.Add(BimSerializer.ToPayload(elem, wallOpenings));
                }

                var service = new ConstructionOSService(config);
                string archivoNombre = doc.Title ?? "Revit Export";

                // Check for existing imports in this project
                string? importacionExistenteId = null;
                try
                {
                    var imports = Task.Run(() => service.ListBimImportsAsync(config.ProyectoId))
                        .GetAwaiter().GetResult();

                    // Find an existing import with the same file name
                    var existente = imports.Imports
                        .FirstOrDefault(i => i.ArchivoNombre == archivoNombre);

                    if (existente != null)
                    {
                        var dlg = new TaskDialog("Exportar BIM")
                        {
                            MainInstruction = "Ya existe una exportación de este modelo.",
                            MainContent =
                                $"Importación existente: {existente.ArchivoNombre}\n" +
                                $"Elementos: {existente.TotalElementos} ({existente.ElementosMapeados} vinculados)\n" +
                                $"Fecha: {existente.CreatedAt}\n\n" +
                                "¿Qué desea hacer?",
                            CommonButtons = TaskDialogCommonButtons.Cancel,
                        };
                        dlg.AddCommandLink(TaskDialogCommandLinkId.CommandLink1,
                            "Actualizar datos",
                            "Actualiza parámetros, preserva vínculos con partidas, recalcula cantidades.");
                        dlg.AddCommandLink(TaskDialogCommandLinkId.CommandLink2,
                            "Nueva versión",
                            "Crea una importación nueva. Los vínculos anteriores se mantienen aparte.");

                        var dialogResult = dlg.Show();

                        if (dialogResult == TaskDialogResult.Cancel)
                            return Result.Cancelled;

                        if (dialogResult == TaskDialogResult.CommandLink1)
                            importacionExistenteId = existente.Id;
                        // CommandLink2 → importacionExistenteId stays null → new import
                    }
                }
                catch
                {
                    // If checking imports fails, proceed with new import
                }

                string resumen;

                if (importacionExistenteId != null)
                {
                    // Update existing import
                    var result = Task.Run(() => service.UpdateBimElementsAsync(
                        importacionExistenteId, payloads))
                        .GetAwaiter().GetResult();

                    resumen = $"Actualización completada:\n\n" +
                        $"  Actualizados: {result.Updated}\n" +
                        $"  Nuevos: {result.Inserted}\n" +
                        $"  Eliminados del modelo: {result.Removed}\n" +
                        $"  Vínculos preservados: {result.PreservedLinks}\n" +
                        $"  Metrados recalculados: {result.Recalculated}\n" +
                        $"  Partidas actualizadas: {result.PartidasUpdated}\n" +
                        $"  Total elementos: {result.TotalElementos}";
                }
                else
                {
                    // New import
                    var result = Task.Run(() => service.ImportBimElementsAsync(
                        config.ProyectoId, archivoNombre, payloads))
                        .GetAwaiter().GetResult();

                    int elemConCustom = elementosFiltrados
                        .Count(e => e.ParametrosCustomValues.Count > 0);
                    int totalNotas = elementosFiltrados
                        .Sum(e => e.NotasIA.Count);
                    int excluidos = extractionResult.Elementos.Count - elementosFiltrados.Count;

                    resumen = $"Exportación completada:\n\n" +
                        $"  Elementos enviados: {result.TotalElementos}\n" +
                        (excluidos > 0 ? $"  Excluidos (Incluir=false): {excluidos}\n" : "") +
                        $"  Con categoría válida: {result.ConCategoria}\n" +
                        $"  Sin categoría: {result.SinCategoria}\n" +
                        $"  Con params custom: {elemConCustom}\n" +
                        $"  Notas IA enviadas: {totalNotas}\n" +
                        $"  ID importación: {result.ImportacionId}";

                    if (result.CategoriasDesconocidas.Count > 0)
                    {
                        resumen += $"\n\nCategorías desconocidas:\n  " +
                            string.Join("\n  ", result.CategoriasDesconocidas);
                    }
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
