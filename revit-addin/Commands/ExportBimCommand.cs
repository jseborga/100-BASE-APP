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

                // Convertir a payload para el servidor
                var payloads = new List<BimElementPayload>();
                foreach (var elem in extractionResult.Elementos)
                {
                    var payload = new BimElementPayload
                    {
                        RevitId = elem.RevitTypeId.ToString(),
                        Categoria = elem.Categoria,
                        Familia = elem.Familia,
                        Tipo = elem.TipoRevit,
                        Parametros = new Dictionary<string, double>
                        {
                            ["Area"] = elem.AreaNetaIntM2,
                            ["AreaBruta"] = elem.AreaBrutaIntM2,
                            ["AreaExt"] = elem.AreaNetaExtM2,
                            ["OpeningsArea"] = elem.AreaHuecosDescontadosM2,
                            ["Volume"] = elem.VolumenM3,
                            ["Length"] = elem.LongitudML,
                            ["Height"] = elem.AlturaPromedio,
                            ["Width"] = elem.EspesorM,
                            ["Count"] = elem.CantInstancias,
                        },
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
    }
}
