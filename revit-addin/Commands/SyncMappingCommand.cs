// Commands/SyncMappingCommand.cs
// Descarga mapeos confirmados de ConstructionOS y los escribe como
// parámetros compartidos COS_* en los tipos/familias de Revit.
// Flujo ida y vuelta: Export → Map en web → Sync → Revit tiene códigos.
// Autor: SSA Ingenieria SRL

using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using RvtConstructionOS.Models;
using RvtConstructionOS.Services;

namespace RvtConstructionOS.Commands
{
    [Transaction(TransactionMode.Manual)]
    [Regeneration(RegenerationOption.Manual)]
    public class SyncMappingCommand : IExternalCommand
    {
        // COS shared parameter GUIDs — must match SharedParameters.txt Group 4
        private static readonly Guid COS_PARTIDA_CODIGO = new("a1b2c3d4-0004-0004-0004-000000000001");
        private static readonly Guid COS_PARTIDA_NOMBRE = new("a1b2c3d4-0004-0004-0004-000000000002");
        private static readonly Guid COS_FORMULA        = new("a1b2c3d4-0004-0004-0004-000000000003");
        private static readonly Guid COS_METRADO        = new("a1b2c3d4-0004-0004-0004-000000000004");
        private static readonly Guid COS_NOTAS_MAPEO    = new("a1b2c3d4-0004-0004-0004-000000000005");
        private static readonly Guid COS_ESTADO         = new("a1b2c3d4-0004-0004-0004-000000000006");
        private static readonly Guid COS_ULTIMA_SYNC    = new("a1b2c3d4-0004-0004-0004-000000000007");

        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            var config = AppConfig.Load();
            if (!config.IsValid || !config.HasProject)
            {
                TaskDialog.Show("Sync Mapeo",
                    "Configure la conexión y seleccione un proyecto activo primero.");
                return Result.Cancelled;
            }

            Document? doc = commandData.Application.ActiveUIDocument?.Document;
            if (doc == null || doc.IsFamilyDocument)
            {
                TaskDialog.Show("Sync Mapeo",
                    "Abra un modelo de proyecto (.rvt) antes de sincronizar.");
                return Result.Cancelled;
            }

            try
            {
                // 1. Obtener mapeos del servidor
                var service = new ConstructionOSService(config);
                var task = Task.Run(() => service.GetElementMappingsAsync(config.ProyectoId));
                var response = task.GetAwaiter().GetResult();

                if (response.Mappings.Count == 0)
                {
                    TaskDialog.Show("Sync Mapeo",
                        "No hay mapeos confirmados para este proyecto.\n" +
                        "Exporte primero desde Revit, luego mapee en ConstructionOS.");
                    return Result.Succeeded;
                }

                // 2. Indexar mapeos por RevitId (TypeId) — puede haber N mapeos por tipo
                var mappingsByRevitId = new Dictionary<string, List<ElementMappingDto>>();
                foreach (var m in response.Mappings)
                {
                    if (string.IsNullOrEmpty(m.RevitId)) continue;
                    if (!mappingsByRevitId.ContainsKey(m.RevitId))
                        mappingsByRevitId[m.RevitId] = new List<ElementMappingDto>();
                    mappingsByRevitId[m.RevitId].Add(m);
                }

                // 3. Buscar ElementTypes en el modelo y escribir parámetros
                int escritos = 0;
                int sinParam = 0;
                int noEncontrados = 0;

                using var tx = new Transaction(doc, "COS Sync Mapping");
                tx.Start();

                foreach (var (revitIdStr, mappings) in mappingsByRevitId)
                {
                    if (!long.TryParse(revitIdStr, out long revitIdLong)) continue;
                    var elementId = new ElementId(revitIdLong);
                    var elem = doc.GetElement(elementId);
                    if (elem == null)
                    {
                        noEncontrados++;
                        continue;
                    }

                    // Consolidar múltiples mapeos en un solo write-back
                    // Para código/nombre: usar el primero (partida principal)
                    // Para notas: concatenar todas las partidas
                    var principal = mappings[0];
                    string codigosAll = string.Join(" | ",
                        mappings.Where(m => !string.IsNullOrEmpty(m.PartidaCodigo))
                                .Select(m => m.PartidaCodigo));
                    string nombresAll = string.Join(" | ",
                        mappings.Where(m => !string.IsNullOrEmpty(m.PartidaNombre))
                                .Select(m => m.PartidaNombre));
                    string formulasAll = string.Join(" | ",
                        mappings.Where(m => !string.IsNullOrEmpty(m.Formula))
                                .Select(m => $"{m.PartidaCodigo}: {m.Formula}"));
                    string notasAll = string.Join("\n",
                        mappings.Where(m => !string.IsNullOrEmpty(m.NotasMapeo))
                                .Select(m => $"[{m.PartidaCodigo}] {m.NotasMapeo}"));
                    decimal metradoTotal = mappings.Sum(m => m.Metrado ?? 0);

                    bool wrote = false;
                    wrote |= EscribirTexto(elem, COS_PARTIDA_CODIGO, codigosAll);
                    wrote |= EscribirTexto(elem, COS_PARTIDA_NOMBRE, nombresAll);
                    wrote |= EscribirTexto(elem, COS_FORMULA, formulasAll);
                    wrote |= EscribirNumero(elem, COS_METRADO, (double)metradoTotal);
                    wrote |= EscribirTexto(elem, COS_NOTAS_MAPEO, notasAll);
                    wrote |= EscribirTexto(elem, COS_ESTADO, principal.Estado);
                    wrote |= EscribirTexto(elem, COS_ULTIMA_SYNC,
                        DateTime.Now.ToString("yyyy-MM-dd HH:mm"));

                    if (wrote) escritos++;
                    else sinParam++;
                }

                tx.Commit();

                string resumen =
                    $"Sincronización completada:\n\n" +
                    $"  Mapeos recibidos: {response.Mappings.Count}\n" +
                    $"  Tipos Revit únicos: {mappingsByRevitId.Count}\n" +
                    $"  Escritos en modelo: {escritos}\n" +
                    $"  Sin parámetros COS_*: {sinParam}\n" +
                    $"  No encontrados: {noEncontrados}\n\n" +
                    $"Los parámetros COS_* ahora contienen:\n" +
                    $"  • COS_PARTIDA_CODIGO — código de partida\n" +
                    $"  • COS_PARTIDA_NOMBRE — nombre de partida\n" +
                    $"  • COS_FORMULA — fórmula de metrado aplicada\n" +
                    $"  • COS_METRADO — cantidad calculada\n" +
                    $"  • COS_NOTAS_MAPEO — instrucciones de cómputo\n" +
                    $"  • COS_ESTADO — estado del mapeo\n" +
                    $"  • COS_ULTIMA_SYNC — fecha/hora de sincronización";

                if (sinParam > 0)
                {
                    resumen += "\n\n⚠ Algunos tipos no tienen los parámetros COS_* vinculados.\n" +
                        "Use 'Administrar > Parámetros compartidos' para agregarlos.";
                }

                TaskDialog.Show("Sync Mapeo", resumen);
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                TaskDialog.Show("Error Sync Mapeo",
                    $"Error: {ex.Message}\n\n{ex.InnerException?.Message}");
                return Result.Failed;
            }
        }

        private static bool EscribirTexto(Element elem, Guid paramGuid, string? valor)
        {
            if (string.IsNullOrEmpty(valor)) return false;
            var param = elem.get_Parameter(paramGuid);
            if (param == null || param.IsReadOnly) return false;
            param.Set(valor);
            return true;
        }

        private static bool EscribirNumero(Element elem, Guid paramGuid, double valor)
        {
            var param = elem.get_Parameter(paramGuid);
            if (param == null || param.IsReadOnly) return false;
            param.Set(valor);
            return true;
        }
    }
}
