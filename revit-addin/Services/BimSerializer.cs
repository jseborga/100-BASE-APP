// Services/BimSerializer.cs
// Converts BimElement + BimAbertura to JSON-ready dictionaries for the ConstructionOS server.
// Sends all geometric + weight params for all categories (non-zero only).
// Wall-specific params (acabados, flags, opening aggregates) only for Muros.

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
            bool isWall = elem.Categoria == "Muros";

            // ── Geometric params (all categories, non-zero only) ──
            SetIfPositive(p, "AreaBrutaInt", elem.AreaBrutaIntM2);
            SetIfPositive(p, "AreaBrutaExt", elem.AreaBrutaExtM2);
            SetIfPositive(p, "AreaNetaInt", elem.AreaNetaIntM2);
            SetIfPositive(p, "AreaNetaExt", elem.AreaNetaExtM2);
            SetIfPositive(p, "OpeningsArea", elem.AreaHuecosDescontadosM2);
            SetIfPositive(p, "OpeningsAreaTotal", elem.AreaHuecosM2);
            SetIfPositive(p, "Volume", elem.VolumenM3);
            SetIfPositive(p, "Length", elem.LongitudML);
            SetIfPositive(p, "Height", elem.AlturaPromedio);
            SetIfPositive(p, "Width", elem.EspesorM);
            Set(p, "Count", elem.CantInstancias);

            // ── Calculated quantities (non-zero only) ──
            SetIfPositive(p, "CantidadPrincipal", elem.CantidadPrincipal);
            if (elem.FactorDesperdicio > 1.0)
            {
                Set(p, "FactorDesperdicio", elem.FactorDesperdicio);
                SetIfPositive(p, "CantidadConDesperdicio", elem.CantidadConDesperdicio);
            }

            // ── Weight params (all categories, for steel/weight operations) ──
            SetIfPositive(p, "PesoLinealKgM", elem.PesoLinealKgM);
            SetIfPositive(p, "PesoTotalKg", elem.PesoTotalKg);

            // ── Wall-specific: acabados, flags, opening aggregates ──
            if (isWall)
            {
                SetIfPositive(p, "RevEspInt", elem.RevEspInt);
                SetIfPositive(p, "RevEspExt", elem.RevEspExt);
                SetIfPositive(p, "CeramicaAltura", elem.CeramicaAltura);

                if (elem.RevEspInt > 0)                p["HasRevoqueInt"] = 1.0;
                if (elem.RevEspExt > 0)                p["HasRevoqueExt"] = 1.0;
                if (HasText(elem.PinturaTipoInt))      p["HasPinturaInt"] = 1.0;
                if (HasText(elem.PinturaTipoExt))      p["HasPinturaExt"] = 1.0;
                if (elem.CeramicaAltura > 0)           p["HasCeramica"]   = 1.0;
                if (elem.ConsiderarDintel)             p["HasDintel"]     = 1.0;
                if (elem.ConsiderarRasgo)              p["HasRasgo"]      = 1.0;
                if (elem.ConsiderarBuna)               p["HasBuna"]       = 1.0;

                if (aberturas != null && aberturas.Count > 0)
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
                    SetIfPositive(p, "RasgoTotalM2", rasgoTotal);
                    SetIfPositive(p, "DintelTotalML", dintelTotal);
                    SetIfPositive(p, "AlfeizarTotalML", alfeizarTotal);
                    SetIfPositive(p, "ZocaloML", elem.LongitudML);
                }
            }

            // ── Metadata ──
            p["_unique_id"] = elem.UniqueId;
            if (!string.IsNullOrEmpty(elem.FuncionElemento)) p["_funcion"] = elem.FuncionElemento;
            if (!string.IsNullOrEmpty(elem.Nivel)) p["_nivel"] = elem.Nivel;
            if (!string.IsNullOrEmpty(elem.AcabadoInterior)) p["_acabado_int"] = elem.AcabadoInterior;
            if (!string.IsNullOrEmpty(elem.AcabadoExterior)) p["_acabado_ext"] = elem.AcabadoExterior;
            if (!string.IsNullOrEmpty(elem.PinturaTipoInt)) p["_pintura_tipo_int"] = elem.PinturaTipoInt;
            if (!string.IsNullOrEmpty(elem.PinturaTipoExt)) p["_pintura_tipo_ext"] = elem.PinturaTipoExt;
            if (!string.IsNullOrEmpty(elem.SeccionTransversal)) p["_seccion"] = elem.SeccionTransversal;
            if (!string.IsNullOrEmpty(elem.CriterioMedicion)) p["_criterio"] = elem.CriterioMedicion;

            // ── Custom params from wizard (already filtered by Activo flag) ──
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

        private static void SetIfPositive(Dictionary<string, object> p, string key, double value)
        {
            if (value > 0) p[key] = Math.Round(value, 4);
        }

        private static bool HasText(string? value)
            => !string.IsNullOrWhiteSpace(value) && !value.Equals("NINGUNO", StringComparison.OrdinalIgnoreCase);
    }
}
