// Commands/ParameterWizardCommand.cs
// Lanza el wizard de configuración de parámetros de exportación por familia.
// Autor: SSA Ingenieria SRL

using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using RvtConstructionOS.Services;
using RvtConstructionOS.Views;

namespace RvtConstructionOS.Commands
{
    [Transaction(TransactionMode.ReadOnly)]
    [Regeneration(RegenerationOption.Manual)]
    public class ParameterWizardCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            Document? doc = commandData.Application.ActiveUIDocument?.Document;
            if (doc == null || doc.IsFamilyDocument)
            {
                TaskDialog.Show("Parámetros de Exportación",
                    "Este comando requiere un modelo de proyecto (.rvt) abierto.");
                return Result.Cancelled;
            }

            try
            {
                // Cargar reglas existentes del documento
                var ruleSet = ExportRuleService.Cargar(doc);

                // Escanear y fusionar con tipos actuales
                ruleSet = ExportRuleService.Escanear(doc, ruleSet);

                // Abrir wizard
                var wizard = new ParameterWizardWindow(doc, ruleSet);
                wizard.ShowDialog();

                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                TaskDialog.Show("Error",
                    $"Error al abrir el wizard de parámetros:\n{ex.Message}");
                return Result.Failed;
            }
        }
    }
}
