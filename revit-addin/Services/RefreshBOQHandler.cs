// Services/RefreshBOQHandler.cs
// IExternalEventHandler para refrescar los cómputos desde la ventana flotante (modeless).
//
// En Revit, las ventanas modeless no pueden llamar a la API directamente.
// Se usa el patrón ExternalEvent: la ventana hace Raise() y Revit ejecuta
// el handler en el hilo correcto, luego llama al callback en el dispatcher de WPF.
//
// Autor: SSA Ingenieria SRL

using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using RvtConstructionOS.Models;

namespace RvtConstructionOS.Services
{
    /// <summary>
    /// Handler de evento externo para re-escanear el modelo Revit desde la ventana flotante BOQ.
    /// Se registra con <see cref="ExternalEvent.Create"/> en el comando de Revit y se pasa
    /// a la ventana. La ventana llama a <c>ExternalEvent.Raise()</c> para dispararlo.
    /// </summary>
    public class RefreshBOQHandler : IExternalEventHandler
    {
        private Document _doc;

        /// <summary>
        /// Resultado de la extracción. Disponible después de que Execute() haya completado.
        /// </summary>
        public ExtractionResult? Resultado { get; private set; }

        /// <summary>
        /// Filtro de alcance para la próxima extracción.
        /// La ventana lo puede setear antes de llamar a Raise() para filtrar por vista/selección/fase.
        /// </summary>
        public FiltroExtraccion Filtro { get; set; } = FiltroExtraccion.Completo;

        /// <summary>
        /// Callback invocado en el dispatcher de WPF después de que la extracción termine.
        /// La ventana lo usa para actualizar su UI.
        /// </summary>
        public Action<ExtractionResult>? OnCompletado { get; set; }

        public RefreshBOQHandler(Document doc)
        {
            _doc = doc ?? throw new ArgumentNullException(nameof(doc));
        }

        /// <summary>Actualiza el documento cuando el usuario cambia de pestaña en Revit.</summary>
        public void ActualizarDocumento(Document doc) => _doc = doc;

        /// <summary>
        /// Ejecutado por Revit en el hilo principal cuando ExternalEvent.Raise() es llamado.
        /// Extrae los cómputos con el filtro activo y notifica a la ventana vía dispatcher de WPF.
        /// </summary>
        public void Execute(UIApplication app)
        {
            try
            {
                var svc = new RevitExtractionService();
                Resultado = svc.Extraer(_doc, Filtro);

                // Notificar a la ventana WPF en su hilo de UI
                System.Windows.Application.Current?.Dispatcher.BeginInvoke(
                    new Action(() => OnCompletado?.Invoke(Resultado)));
            }
            catch (Exception ex)
            {
                System.Windows.Application.Current?.Dispatcher.BeginInvoke(
                    new Action(() =>
                    {
                        System.Windows.MessageBox.Show(
                            $"Error al refrescar cómputos:\n{ex.Message}",
                            "SSA BIM Bridge", System.Windows.MessageBoxButton.OK,
                            System.Windows.MessageBoxImage.Warning);
                    }));
            }
        }

        public string GetName() => "SSA_RefreshBOQ";
    }
}
