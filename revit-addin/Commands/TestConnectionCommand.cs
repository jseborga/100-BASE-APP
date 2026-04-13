// Commands/TestConnectionCommand.cs
// Smoke test: verifica conexión con ConstructionOS.
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
    public class TestConnectionCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            var config = AppConfig.Load();

            if (!config.IsValid)
            {
                TaskDialog.Show("Probar Conexión",
                    "No hay configuración guardada.\n" +
                    "Use el botón 'Configuración' primero.");
                return Result.Cancelled;
            }

            try
            {
                var service = new ConstructionOSService(config);
                var task = Task.Run(() => service.TestConnectionAsync());
                string resultado = task.GetAwaiter().GetResult();

                string info = $"URL: {config.Url}\n" +
                    $"Proyecto: {config.ProyectoNombre}\n\n" +
                    $"Resultado: {resultado}";

                TaskDialog.Show("Probar Conexión — OK", info);
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                TaskDialog.Show("Probar Conexión — Error",
                    $"No se pudo conectar a ConstructionOS.\n\n" +
                    $"URL: {config.Url}\n" +
                    $"Error: {ex.Message}\n\n" +
                    $"Verifique la URL y el API Key en Configuración.");
                return Result.Failed;
            }
        }
    }
}
