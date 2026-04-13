// Services/ExportService.cs
// Stub — export to Excel/CSV. In ConstructionOS, export happens server-side.
// Autor: SSA Ingenieria SRL

using Autodesk.Revit.DB;
using RvtConstructionOS.Models;

namespace RvtConstructionOS.Services
{
    public class ExportService
    {
        public static void ExportarExcel(Document doc, ExtractionResult result, ExportRuleSet ruleSet)
        {
            Autodesk.Revit.UI.TaskDialog.Show("Exportar",
                "La exportación Excel se realiza desde ConstructionOS web.\n" +
                "Use 'Exportar BIM' para enviar los datos al servidor.");
        }

        public static void ExportarOdoo(Document doc, ExtractionResult result, ExportRuleSet ruleSet, AppConfig config)
        {
            Autodesk.Revit.UI.TaskDialog.Show("Exportar a Odoo",
                "La exportación a Odoo se gestiona desde ConstructionOS.\n" +
                "Use el flujo: Exportar BIM → Match BIM → Confirmar.");
        }
    }
}
