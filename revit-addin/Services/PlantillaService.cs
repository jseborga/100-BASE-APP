// Services/PlantillaService.cs
// Stub — template management for export rules.
// Autor: SSA Ingenieria SRL

using RvtConstructionOS.Models;

namespace RvtConstructionOS.Services
{
    public static class PlantillaService
    {
        public static (List<PartidaCatalogo> catalogo, List<PlantillaRegla> reglas) CargarPlantillaConCatalogo()
        {
            return (new List<PartidaCatalogo>(), new List<PlantillaRegla>());
        }

        public static void GuardarPlantilla(string nombre, List<PlantillaRegla> reglas, List<PartidaCatalogo> catalogo)
        {
            // No-op in ConstructionOS — templates managed server-side
        }
    }
}
