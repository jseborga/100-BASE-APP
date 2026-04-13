// App.cs
// Punto de entrada del Add-in ConstructionOS para Autodesk Revit 2025.
// Crea la pestaña "ConstructionOS" con 5 botones.
// Autor: SSA Ingenieria SRL

using Autodesk.Revit.UI;
using System.IO;
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

                // Boton 1: Configuracion
                PushButtonData configBtnData = new PushButtonData(
                    name: "btnCOSConfig",
                    text: "Configuración",
                    assemblyName: assemblyPath,
                    className: "RvtConstructionOS.Commands.ConfigCommand"
                )
                {
                    ToolTip = "Configurar conexión con ConstructionOS.",
                    LongDescription = "URL del servidor, API Key y selección de proyecto activo.",
                };
                PushButton configBtn = panel.AddItem(configBtnData) as PushButton
                    ?? throw new InvalidOperationException("No se pudo crear el botón Configuración.");
                SetButtonIcon(configBtn, "config_icon");

                // Boton 2: Computos BOQ
                PushButtonData boqBtnData = new PushButtonData(
                    name: "btnCOSBoq",
                    text: "Cómputos\nBOQ",
                    assemblyName: assemblyPath,
                    className: "RvtConstructionOS.Commands.QuantityBrowserCommand"
                )
                {
                    ToolTip = "Abrir navegador de cómputos BOQ (vista local).",
                    LongDescription = "Muestra todos los tipos del modelo organizados por Categoría → Familia → Tipo, " +
                                      "con cantidades calculadas. No requiere conexión de red.",
                };
                PushButton boqBtn = panel.AddItem(boqBtnData) as PushButton
                    ?? throw new InvalidOperationException("No se pudo crear el botón Cómputos BOQ.");
                SetButtonIcon(boqBtn, "boqbrowser_icon");

                // Boton 3: Exportar BIM
                PushButtonData exportBtnData = new PushButtonData(
                    name: "btnCOSExport",
                    text: "Exportar\nBIM",
                    assemblyName: assemblyPath,
                    className: "RvtConstructionOS.Commands.ExportBimCommand"
                )
                {
                    ToolTip = "Exportar elementos BIM a ConstructionOS.",
                    LongDescription = "Extrae elementos del modelo Revit y los envía al servidor " +
                                      "ConstructionOS para crear una importación BIM en el proyecto activo.",
                };
                PushButton exportBtn = panel.AddItem(exportBtnData) as PushButton
                    ?? throw new InvalidOperationException("No se pudo crear el botón Exportar BIM.");
                SetButtonIcon(exportBtn, "export_icon");

                // Boton 4: Match BIM
                PushButtonData matchBtnData = new PushButtonData(
                    name: "btnCOSMatch",
                    text: "Match\nBIM",
                    assemblyName: assemblyPath,
                    className: "RvtConstructionOS.Commands.MatchBimCommand"
                )
                {
                    ToolTip = "Mapear elementos BIM a partidas de construcción.",
                    LongDescription = "Ejecuta el matching server-side: evalúa fórmulas de revit_mapeos " +
                                      "contra los parámetros de cada elemento, asigna partidas y metrados. " +
                                      "Muestra resultados para revisión antes de confirmar.",
                };
                PushButton matchBtn = panel.AddItem(matchBtnData) as PushButton
                    ?? throw new InvalidOperationException("No se pudo crear el botón Match BIM.");
                SetButtonIcon(matchBtn, "bridgematch_icon");

                // Boton 5: Probar Conexion
                PushButtonData testBtnData = new PushButtonData(
                    name: "btnCOSTest",
                    text: "Probar\nConexión",
                    assemblyName: assemblyPath,
                    className: "RvtConstructionOS.Commands.TestConnectionCommand"
                )
                {
                    ToolTip = "Verificar conexión con el servidor ConstructionOS.",
                    LongDescription = "Smoke test: autentica con el API Key y llama list_projects " +
                                      "para verificar conectividad y permisos.",
                };
                PushButton testBtn = panel.AddItem(testBtnData) as PushButton
                    ?? throw new InvalidOperationException("No se pudo crear el botón Probar Conexión.");
                SetButtonIcon(testBtn, "testbridge_icon");

                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                TaskDialog.Show(
                    "Error al iniciar RvtConstructionOS",
                    $"No se pudo inicializar el plugin:\n{ex.Message}"
                );
                return Result.Failed;
            }
        }

        public Result OnShutdown(UIControlledApplication application)
        {
            return Result.Succeeded;
        }

        private static void SetButtonIcon(PushButton button, string resourceKey)
        {
            try
            {
                Assembly asm = Assembly.GetExecutingAssembly();
                string resourceName = $"RvtConstructionOS.Resources.{resourceKey}.png";
                using Stream? stream = asm.GetManifestResourceStream(resourceName);
                if (stream is not null)
                {
                    BitmapImage bmp = new BitmapImage();
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
