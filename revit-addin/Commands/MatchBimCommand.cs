// Commands/MatchBimCommand.cs
// Ejecuta el matching server-side y muestra resultados para revisión.
// Flujo: POST match_bim_elements → muestra DataGrid → POST confirm_bim_match
// Autor: SSA Ingenieria SRL

using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using RvtConstructionOS.Models;
using RvtConstructionOS.Services;
using RvtConstructionOS.Views;

namespace RvtConstructionOS.Commands
{
    [Transaction(TransactionMode.ReadOnly)]
    [Regeneration(RegenerationOption.Manual)]
    public class MatchBimCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            var config = AppConfig.Load();
            if (!config.IsValid || !config.HasProject)
            {
                TaskDialog.Show("Match BIM",
                    "Configure la conexión y seleccione un proyecto primero.");
                return Result.Cancelled;
            }

            try
            {
                var service = new ConstructionOSService(config);

                // Get the latest import for this project
                var importsTask = Task.Run(() => service.GetBimImportsAsync(config.ProyectoId));
                var importsResult = importsTask.GetAwaiter().GetResult();

                var imports = importsResult?["imports"]?.AsArray();
                if (imports == null || imports.Count == 0)
                {
                    TaskDialog.Show("Match BIM",
                        "No hay importaciones BIM para este proyecto.\n" +
                        "Use 'Exportar BIM' primero.");
                    return Result.Cancelled;
                }

                string importacionId = imports[0]?["id"]?.GetValue<string>() ?? string.Empty;
                string estado = imports[0]?["estado"]?.GetValue<string>() ?? string.Empty;

                if (string.IsNullOrEmpty(importacionId))
                {
                    TaskDialog.Show("Match BIM", "No se pudo obtener la importación.");
                    return Result.Failed;
                }

                // Run matching if the import is still pending
                if (estado == "pendiente")
                {
                    var matchTask = Task.Run(() => service.MatchBimElementsAsync(importacionId));
                    var matchResult = matchTask.GetAwaiter().GetResult();

                    TaskDialog td = new TaskDialog("Match BIM — Resultados");
                    td.MainInstruction = matchResult.Message;
                    td.MainContent =
                        $"Elementos originales: {matchResult.OriginalElements}\n" +
                        $"Mapeados: {matchResult.Matched}\n" +
                        $"Derivados creados: {matchResult.DerivedCreated}\n" +
                        $"Sin match: {matchResult.NoMatch}";
                    td.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Ver resultados detallados");
                    td.AddCommandLink(TaskDialogCommandLinkId.CommandLink2, "Confirmar todo y crear partidas");
                    td.CommonButtons = TaskDialogCommonButtons.Close;

                    var dialogResult = td.Show();

                    if (dialogResult == TaskDialogResult.CommandLink1)
                    {
                        // Show results window
                        ShowResultsWindow(commandData, service, importacionId);
                    }
                    else if (dialogResult == TaskDialogResult.CommandLink2)
                    {
                        // Confirm all
                        ConfirmMatch(service, importacionId);
                    }
                }
                else if (estado == "completado")
                {
                    // Already matched — show results or confirm
                    TaskDialog td = new TaskDialog("Match BIM");
                    td.MainInstruction = "Esta importación ya fue procesada.";
                    td.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Ver resultados detallados");
                    td.AddCommandLink(TaskDialogCommandLinkId.CommandLink2, "Confirmar y crear partidas");
                    td.CommonButtons = TaskDialogCommonButtons.Close;

                    var dialogResult = td.Show();

                    if (dialogResult == TaskDialogResult.CommandLink1)
                        ShowResultsWindow(commandData, service, importacionId);
                    else if (dialogResult == TaskDialogResult.CommandLink2)
                        ConfirmMatch(service, importacionId);
                }
                else
                {
                    TaskDialog.Show("Match BIM", $"Estado de la importación: {estado}");
                }

                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                TaskDialog.Show("Error en Match BIM",
                    $"Error: {ex.Message}\n\n{ex.InnerException?.Message}");
                return Result.Failed;
            }
        }

        private void ShowResultsWindow(ExternalCommandData commandData, ConstructionOSService service, string importacionId)
        {
            try
            {
                var elemTask = Task.Run(() => service.GetBimElementsAsync(importacionId, estado: "mapeado"));
                var elemResult = elemTask.GetAwaiter().GetResult();

                System.Windows.Window revitWindow =
                    System.Windows.Interop.HwndSource.FromHwnd(
                        commandData.Application.MainWindowHandle
                    )?.RootVisual as System.Windows.Window
                    ?? System.Windows.Application.Current.MainWindow;

                var window = new MatchResultsWindow(elemResult.Elements, importacionId, service)
                {
                    Owner = revitWindow
                };
                window.ShowDialog();
            }
            catch (Exception ex)
            {
                TaskDialog.Show("Error", $"No se pudieron cargar los resultados:\n{ex.Message}");
            }
        }

        private void ConfirmMatch(ConstructionOSService service, string importacionId)
        {
            try
            {
                var confirmTask = Task.Run(() => service.ConfirmBimMatchAsync(importacionId));
                var confirmResult = confirmTask.GetAwaiter().GetResult();

                TaskDialog.Show("Match BIM — Confirmado",
                    $"{confirmResult.Message}\n\n" +
                    $"Partidas creadas: {confirmResult.Created}\n" +
                    $"Partidas actualizadas: {confirmResult.Updated}\n" +
                    $"Total partidas: {confirmResult.TotalPartidas}");
            }
            catch (Exception ex)
            {
                TaskDialog.Show("Error al confirmar",
                    $"Error: {ex.Message}\n\n{ex.InnerException?.Message}");
            }
        }
    }
}
