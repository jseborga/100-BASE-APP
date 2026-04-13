// Commands/QuantityBrowserCommand.cs
// Abre la ventana flotante de computos BOQ (vista local, sin red).
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
    public class QuantityBrowserCommand : IExternalCommand
    {
        private static QuantityBrowserWindow?      _ventana;
        private static ExternalEvent?              _extEvent;
        private static RefreshBOQHandler?          _handler;
        private static ExternalEvent?              _selEvent;
        private static SelectionHighlightHandler?  _selHandler;

        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            if (_ventana != null)
            {
                try { _ventana.Activate(); }
                catch { }
                return Result.Succeeded;
            }

            Document? doc = commandData.Application.ActiveUIDocument?.Document;

            if (doc == null || doc.IsFamilyDocument)
            {
                TaskDialog.Show("Cómputos BOQ",
                    "Este comando requiere un modelo de proyecto (.rvt) abierto.");
                return Result.Cancelled;
            }

            try
            {
                _handler    = new RefreshBOQHandler(doc);
                _extEvent   = ExternalEvent.Create(_handler);
                _selHandler = new SelectionHighlightHandler(doc);
                _selEvent   = ExternalEvent.Create(_selHandler);

                _ventana = new QuantityBrowserWindow(doc, _extEvent, _handler,
                                                     _selEvent, _selHandler);

                _ventana.Closed += (s, e) =>
                {
                    _ventana = null;
                    _extEvent?.Dispose();  _extEvent  = null; _handler    = null;
                    _selEvent?.Dispose(); _selEvent  = null; _selHandler = null;
                };

                _ventana.Show();
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                _ventana  = null;
                _extEvent?.Dispose();
                _extEvent = null;
                _handler  = null;
                message = ex.Message;
                TaskDialog.Show("Error en Cómputos BOQ", ex.Message);
                return Result.Failed;
            }
        }
    }
}
