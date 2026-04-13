// Services/BimSerializer.cs
// Converts BimElement + BimAbertura to JSON-ready dictionaries for the ConstructionOS server.
// Outputs simplified aliases (backward compat) and full names.
// Pre-computes opening aggregates on walls for N:1 mapping.

using RvtConstructionOS.Models;

namespace RvtConstructionOS.Services
{
    public static class BimSerializer
    {
        public static Dictionary<string, object> ToParametros(
            BimElement elem,
            List<BimAbertura>? aberturas = null)
        {
            var p = new Dictionary<string, object>();

            Set(p, "Area", elem.AreaBrutaIntM2);
            Set(p, "AreaBrutaInt", elem.AreaBrutaIntM2);
            Set(p, "AreaBrutaExt", elem.AreaBrutaExtM2);
            Set(p, "AreaNetaInt", elem.AreaNetaIntM2);
            Set(p, "AreaNetaExt", elem.AreaNetaExtM2);
            Set(p, "OpeningsArea", elem.AreaHuecosDescontadosM2);
            Set(p, "OpeningsAreaTotal", elem.AreaHuecosM2);
            Set(p, "OpeningsAreaNoDesc", elem.AreaHuecosNoDescontadosM2);
            Set(p, "Volume", elem.VolumenM3);
            Set(p, "Length", elem.LongitudML);
            Set(p, "Height", elem.AlturaPromedio);
            Set(p, "Width", elem.EspesorM);
            Set(p, "Espesor", elem.EspesorM);
            Set(p, "Count", elem.CantInstancias);
            Set(p, "Cantidad", elem.Cantidad);
            Set(p, "CantidadPrincipal", elem.CantidadPrincipal);
            Set(p, "CantidadConDesperdicio", elem.CantidadConDesperdicio);
            Set(p, "FactorDesperdicio", elem.FactorDesperdicio);
            Set(p, "PesoLinealKgM", elem.PesoLinealKgM);
            Set(p, "PesoTotalKg", elem.PesoTotalKg);

            Set(p, "RevEspInt", elem.RevEspInt);
            Set(p, "RevEspExt", elem.RevEspExt);
            Set(p, "CeramicaAltura", elem.CeramicaAltura);

            p["HasRevoqueInt"] = elem.RevEspInt > 0 ? 1.0 : 0.0;
            p["HasRevoqueExt"] = elem.RevEspExt > 0 ? 1.0 : 0.0;
            p["HasPinturaInt"] = HasText(elem.PinturaTipoInt) ? 1.0 : 0.0;
            p["HasPinturaExt"] = HasText(elem.PinturaTipoExt) ? 1.0 : 0.0;
            p["HasCeramica"] = elem.CeramicaAltura > 0 ? 1.0 : 0.0;
            p["HasDintel"] = elem.ConsiderarDintel ? 1.0 : 0.0;
            p["HasRasgo"] = elem.ConsiderarRasgo ? 1.0 : 0.0;
            p["HasBuna"] = elem.ConsiderarBuna ? 1.0 : 0.0;

            if (aberturas != null && aberturas.Count > 0 && elem.Categoria == "Muros")
            {
                double rasgoTotal = 0, dintelTotal = 0, alfeizarTotal = 0;
                foreach (var ab in aberturas)
                {
                    if (!ab.IncluirComputo) continue;
                    double perimetro = (2 * ab.AltoM) + ab.AnchoM;
                    rasgoTotal += perimetro * elem.EspesorM;
                    dintelTotal += ab.AnchoM;
                    if (ab.Categoria == "Ventanas") alfeizarTotal += ab.AnchoM;
                }
                Set(p, "RasgoTotalM2", rasgoTotal);
                Set(p, "DintelTotalML", dintelTotal);
                Set(p, "AlfeizarTotalML", alfeizarTotal);
                Set(p, "ZocaloML", elem.LongitudML);
            }

            p["_unique_id"] = elem.UniqueId;
            if (!string.IsNullOrEmpty(elem.FuncionElemento)) p["_funcion"] = elem.FuncionElemento;
            if (!string.IsNullOrEmpty(elem.Nivel)) p["_nivel"] = elem.Nivel;
            if (!string.IsNullOrEmpty(elem.AcabadoInterior)) p["_acabado_int"] = elem.AcabadoInterior;
            if (!string.IsNullOrEmpty(elem.AcabadoExterior)) p["_acabado_ext"] = elem.AcabadoExterior;
            if (!string.IsNullOrEmpty(elem.PinturaTipoInt)) p["_pintura_tipo_int"] = elem.PinturaTipoInt;
            if (!string.IsNullOrEmpty(elem.PinturaTipoExt)) p["_pintura_tipo_ext"] = elem.PinturaTipoExt;
            if (!string.IsNullOrEmpty(elem.SeccionTransversal)) p["_seccion"] = elem.SeccionTransversal;
            if (!string.IsNullOrEmpty(elem.CriterioMedicion)) p["_criterio"] = elem.CriterioMedicion;

            // Parámetros custom configurados por el usuario (wizard)
            foreach (var kv in elem.ParametrosCustomValues)
            {
                if (kv.Value is double d)
                    p[kv.Key] = Math.Round(d, 4);
                else if (kv.Value is int i)
                    p[kv.Key] = (double)i;
                else
                    p[$"_{kv.Key}"] = kv.Value?.ToString() ?? "";
            }

            return p;
        }

        public static BimElementPayload ToPayload(BimElement elem, List<BimAbertura>? aberturas = null)
        {
            var allParams = ToParametros(elem, aberturas);
            var numericParams = new Dictionary<string, double>();
            var metadata = new Dictionary<string, string>();
            foreach (var kv in allParams)
            {
                if (kv.Key.StartsWith('_'))
                    metadata[kv.Key] = kv.Value?.ToString() ?? "";
                else if (kv.Value is double d)
                    numericParams[kv.Key] = d;
                else if (kv.Value is int i)
                    numericParams[kv.Key] = i;
            }
            // Notas IA del wizard
            var notasIA = new Dictionary<string, string>(elem.NotasIA);

            return new BimElementPayload
            {
                RevitId = elem.RevitTypeId.ToString(),
                UniqueId = elem.UniqueId,
                Categoria = elem.Categoria,
                Familia = elem.Familia,
                Tipo = elem.TipoRevit,
                Parametros = numericParams,
                Metadata = metadata,
                NotasIA = notasIA,
                NotaFamilia = string.IsNullOrWhiteSpace(elem.NotaFamiliaIA)
                    ? null : elem.NotaFamiliaIA,
            };
        }

        private static void Set(Dictionary<string, object> p, string key, double value)
            => p[key] = Math.Round(value, 4);

        private static void Set(Dictionary<string, object> p, string key, int value)
            => p[key] = (double)value;

        private static bool HasText(string? value)
            => !string.IsNullOrWhiteSpace(value) && !value.Equals("NINGUNO", StringComparison.OrdinalIgnoreCase);
    }
}
