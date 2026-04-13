// Commands/ConfigCommand.cs
// Abre la ventana de configuración de conexión con ConstructionOS.
// Autor: SSA Ingenieria SRL

using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using RvtConstructionOS.Views;

namespace RvtConstructionOS.Commands
{
    [Transaction(TransactionMode.Manual)]
    [Regeneration(RegenerationOption.Manual)]
    public class ConfigCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                System.Windows.Window revitWindow =
                    System.Windows.Interop.HwndSource.FromHwnd(
                        commandData.Application.MainWindowHandle
                    )?.RootVisual as System.Windows.Window
                    ?? System.Windows.Application.Current.MainWindow;

                ConfigWindow ventanaConfig = new ConfigWindow
                {
                    Owner = revitWindow
                };

                ventanaConfig.ShowDialog();
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = $"Error al abrir configuración: {ex.Message}";
                return Result.Failed;
            }
        }
    }
}
