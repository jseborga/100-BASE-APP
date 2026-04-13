// App.cs
// Entry point for the ConstructionOS Revit 2025 Add-in.
// Creates the "ConstructionOS" ribbon tab with 6 buttons.

using Autodesk.Revit.UI;
using System.Reflection;
using System.Windows.Media.Imaging;

namespace RvtConstructionOS
{
    public class App : IExternalApplication
    {
        private const string TabName = "ConstructionOS";
        private const string PanelName = "BIM Metrados";

        public Result OnStartup(UIControlledApplication application)
        {
            try
            {
                application.CreateRibbonTab(TabName);
                RibbonPanel panel = application.CreateRibbonPanel(TabName, PanelName);
                string assemblyPath = Assembly.GetExecutingAssembly().Location;

                // 1. Configuracion
                var configBtn = panel.AddItem(new PushButtonData(
                    "btnConfig", "Configuraci\u00f3n", assemblyPath,
                    "RvtConstructionOS.Commands.ConfigCommand")
                {
                    ToolTip = "Configurar conexi\u00f3n con ConstructionOS (URL, API Key, proyecto).",
                }) as PushButton;
                SetButtonIcon(configBtn!, "config_icon");

                // 2. Computos BOQ (local preview, no network)
                var boqBtn = panel.AddItem(new PushButtonData(
                    "btnBoqBrowser", "C\u00f3mputos\nBOQ", assemblyPath,
                    "RvtConstructionOS.Commands.QuantityBrowserCommand")
                {
                    ToolTip = "Vista previa local de c\u00f3mputos por Categor\u00eda/Familia/Tipo.",
                }) as PushButton;
                SetButtonIcon(boqBtn!, "boqbrowser_icon");

                // 3. Parámetros de Exportación (wizard)
                var paramBtn = panel.AddItem(new PushButtonData(
                    "btnParamWizard", "Par\u00e1metros\nExport", assemblyPath,
                    "RvtConstructionOS.Commands.ParameterWizardCommand")
                {
                    ToolTip = "Configurar qu\u00e9 par\u00e1metros exportar por familia.",
                    LongDescription = "Wizard para seleccionar par\u00e1metros custom de cada familia, " +
                        "crear f\u00f3rmulas compuestas y agregar notas para la IA.",
                }) as PushButton;
                SetButtonIcon(paramBtn!, "param_icon");

                // 4. Exportar BIM
                var exportBtn = panel.AddItem(new PushButtonData(
                    "btnExportBim", "Exportar\nBIM", assemblyPath,
                    "RvtConstructionOS.Commands.ExportBimCommand")
                {
                    ToolTip = "Extraer elementos BIM y enviar a ConstructionOS.",
                    LongDescription = "Extrae muros, pisos, columnas, puertas, ventanas con " +
                        "par\u00e1metros ricos (areas netas, agregados de aberturas, flags de acabados) " +
                        "y los env\u00eda al proyecto activo.",
                }) as PushButton;
                SetButtonIcon(exportBtn!, "export_icon");

                // 5. Match BIM
                var matchBtn = panel.AddItem(new PushButtonData(
                    "btnMatchBim", "Match\nBIM", assemblyPath,
                    "RvtConstructionOS.Commands.MatchBimCommand")
                {
                    ToolTip = "Mapear elementos BIM a partidas de construcci\u00f3n.",
                    LongDescription = "Solicita mapeo autom\u00e1tico contra reglas de mapeo. " +
                        "Muestra resultados color-coded. Permite confirmar para crear partidas.",
                }) as PushButton;
                SetButtonIcon(matchBtn!, "match_icon");

                // 6. Probar Conexion
                var testBtn = panel.AddItem(new PushButtonData(
                    "btnTestConn", "Probar\nConex.", assemblyPath,
                    "RvtConstructionOS.Commands.TestConnectionCommand")
                {
                    ToolTip = "Verificar conexi\u00f3n con el servidor ConstructionOS.",
                }) as PushButton;
                SetButtonIcon(testBtn!, "test_icon");

                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                TaskDialog.Show("Error RvtConstructionOS",
                    $"No se pudo inicializar el plugin:\n{ex.Message}");
                return Result.Failed;
            }
        }

        public Result OnShutdown(UIControlledApplication application) => Result.Succeeded;

        private static void SetButtonIcon(PushButton button, string resourceKey)
        {
            try
            {
                var asm = Assembly.GetExecutingAssembly();
                string name = $"RvtConstructionOS.Resources.{resourceKey}.png";
                using var stream = asm.GetManifestResourceStream(name);
                if (stream is not null)
                {
                    var bmp = new BitmapImage();
                    bmp.BeginInit();
                    bmp.StreamSource = stream;
                    bmp.CacheOption = BitmapCacheOption.OnLoad;
                    bmp.EndInit();
                    bmp.Freeze();
                    button.LargeImage = bmp;
                    button.Image = bmp;
                }
            }
            catch { }
        }
    }
}
