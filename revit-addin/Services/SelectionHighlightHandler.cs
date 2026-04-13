// Services/SelectionHighlightHandler.cs
// IExternalEventHandler para seleccionar y resaltar elementos en Revit
// desde la ventana flotante BOQ (modeless window).
//
// Las ventanas modeless no pueden llamar a la API Revit directamente.
// Se usa el patrón ExternalEvent: la ventana llama a Raise() con la lista
// de ElementId a resaltar, y Revit ejecuta el handler en su hilo principal.
//
// Acciones disponibles:
//   - Seleccionar instancias en Revit (Selection.SetElementIds)
//   - Hacer zoom a la selección en la vista activa (ShowElements)
//   - Aislar la selección en la vista activa (modo temporal)
//   - Restaurar visibilidad (quitar aislamiento)
//
// Autor: SSA Ingenieria SRL

using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RvtConstructionOS.Services
{
    public enum AccionResaltado
    {
        /// <summary>Seleccionar elementos y hacer zoom a la selección.</summary>
        SeleccionarYZoom,
        /// <summary>Seleccionar sin mover la vista.</summary>
        SoloSeleccionar,
        /// <summary>Aislar temporalmente los elementos seleccionados en la vista activa.</summary>
        AislarTemporalmente,
        /// <summary>Quitar el aislamiento temporal de la vista activa.</summary>
        QuitarAislamiento,
    }

    /// <summary>
    /// Handler de evento externo para resaltar/seleccionar elementos en Revit
    /// desde la ventana flotante BOQ.
    /// </summary>
    public class SelectionHighlightHandler : IExternalEventHandler
    {
        private readonly Document _doc;

        // -----------------------------------------------------------------------
        // Propiedades configurables antes de Raise()
        // -----------------------------------------------------------------------

        /// <summary>
        /// IDs de las instancias Revit a seleccionar / resaltar.
        /// Poblar antes de llamar a ExternalEvent.Raise().
        /// </summary>
        public List<ElementId> ElementosIds { get; set; } = new();

        /// <summary>Acción a ejecutar en Revit.</summary>
        public AccionResaltado Accion { get; set; } = AccionResaltado.SeleccionarYZoom;

        /// <summary>Callback invocado tras completar la acción (en hilo WPF).</summary>
        public Action<int>? OnCompletado { get; set; }

        // -----------------------------------------------------------------------
        // Constructor
        // -----------------------------------------------------------------------

        public SelectionHighlightHandler(Document doc)
        {
            _doc = doc ?? throw new ArgumentNullException(nameof(doc));
        }

        // -----------------------------------------------------------------------
        // Execute — corre en el hilo de Revit
        // -----------------------------------------------------------------------

        public void Execute(UIApplication app)
        {
            try
            {
                var uiDoc = app.ActiveUIDocument;
                if (uiDoc == null) return;

                int resaltados = 0;

                switch (Accion)
                {
                    case AccionResaltado.SeleccionarYZoom:
                        resaltados = SeleccionarElementos(uiDoc);
                        if (resaltados > 0)
                            ZoomASeleccion(uiDoc);
                        break;

                    case AccionResaltado.SoloSeleccionar:
                        resaltados = SeleccionarElementos(uiDoc);
                        break;

                    case AccionResaltado.AislarTemporalmente:
                        resaltados = SeleccionarElementos(uiDoc);
                        if (resaltados > 0)
                            AislarEnVista(uiDoc);
                        break;

                    case AccionResaltado.QuitarAislamiento:
                        QuitarAislamiento(uiDoc);
                        break;
                }

                int n = resaltados;
                System.Windows.Application.Current?.Dispatcher.BeginInvoke(
                    new Action(() => OnCompletado?.Invoke(n)));
            }
            catch (Exception ex)
            {
                System.Windows.Application.Current?.Dispatcher.BeginInvoke(
                    new Action(() =>
                        System.Windows.MessageBox.Show(
                            $"Error al resaltar elementos:\n{ex.Message}",
                            "SSA BIM Bridge",
                            System.Windows.MessageBoxButton.OK,
                            System.Windows.MessageBoxImage.Warning)));
            }
        }

        public string GetName() => "SSA_SelectionHighlight";

        // -----------------------------------------------------------------------
        // Helpers privados
        // -----------------------------------------------------------------------

        /// <summary>
        /// Selecciona los elementosIds en Revit.
        /// Filtra IDs que no existan en el documento para evitar excepciones.
        /// Devuelve el número de elementos efectivamente seleccionados.
        /// </summary>
        private int SeleccionarElementos(UIDocument uiDoc)
        {
            if (ElementosIds.Count == 0)
            {
                uiDoc.Selection.SetElementIds(new List<ElementId>());
                return 0;
            }

            // Filtrar IDs válidos en el documento activo
            var validos = ElementosIds
                .Where(id => _doc.GetElement(id) != null)
                .ToList();

            uiDoc.Selection.SetElementIds(validos);
            return validos.Count;
        }

        /// <summary>Hace zoom a la bounding box de los elementos seleccionados en la vista activa.</summary>
        private static void ZoomASeleccion(UIDocument uiDoc)
        {
            try
            {
                uiDoc.ShowElements(uiDoc.Selection.GetElementIds());
            }
            catch
            {
                // Si ShowElements falla (vista 3D bloqueada, etc.) — ignorar
            }
        }

        /// <summary>Aísla temporalmente los elementos seleccionados en la vista activa.</summary>
        private void AislarEnVista(UIDocument uiDoc)
        {
            var vista = uiDoc.ActiveView;
            if (vista == null || !vista.CanUseTemporaryVisibilityModes()) return;

            using var tx = new Transaction(_doc, "SSA - Aislar selección");
            tx.Start();
            vista.IsolateElementsTemporary(ElementosIds);
            tx.Commit();
        }

        /// <summary>Quita el aislamiento temporal de la vista activa.</summary>
        private void QuitarAislamiento(UIDocument uiDoc)
        {
            var vista = uiDoc.ActiveView;
            if (vista == null || !vista.CanUseTemporaryVisibilityModes()) return;

            if (vista.IsInTemporaryViewMode(TemporaryViewMode.TemporaryHideIsolate))
            {
                using var tx = new Transaction(_doc, "SSA - Quitar aislamiento");
                tx.Start();
                vista.DisableTemporaryViewMode(TemporaryViewMode.TemporaryHideIsolate);
                tx.Commit();
            }
        }
    }
}
