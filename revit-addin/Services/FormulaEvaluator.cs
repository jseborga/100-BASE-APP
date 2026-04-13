// Services/FormulaEvaluator.cs
// Motor de evaluación de fórmulas parametrizadas para el wizard de parámetros.
//
// Evalúa expresiones como:
//   {Width} + 0.30
//   {Area} * {Espesor}
//   ({Height} - 0.10) * {Length} * 2
//
// Usa System.Data.DataTable.Compute() para evaluación segura de expresiones
// matemáticas básicas (+, -, *, /, paréntesis) sin necesidad de parser propio.
//
// Autor: SSA Ingenieria SRL

using System.Data;
using System.Text.RegularExpressions;

namespace RvtConstructionOS.Services
{
    /// <summary>
    /// Resultado de la evaluación de una fórmula.
    /// </summary>
    public class FormulaResult
    {
        public bool   Exito   { get; set; }
        public double Valor   { get; set; }
        public string Error   { get; set; } = string.Empty;

        /// <summary>Fórmula con las variables reemplazadas (para depuración).</summary>
        public string FormulaExpandida { get; set; } = string.Empty;

        public static FormulaResult Ok(double valor, string expandida) =>
            new() { Exito = true, Valor = valor, FormulaExpandida = expandida };

        public static FormulaResult Fallo(string error) =>
            new() { Exito = false, Error = error };
    }

    /// <summary>
    /// Evalúa fórmulas con variables entre llaves contra un diccionario de valores.
    /// Thread-safe (sin estado mutable).
    /// </summary>
    public static class FormulaEvaluator
    {
        // Regex para encontrar {NombreVariable} en la fórmula
        private static readonly Regex _varPattern =
            new(@"\{([^}]+)\}", RegexOptions.Compiled);

        // DataTable reutilizable para Compute() — thread-safe para lectura
        private static readonly DataTable _dt = new();

        /// <summary>
        /// Evalúa una fórmula reemplazando variables con valores del diccionario.
        /// </summary>
        /// <param name="formula">Fórmula con variables entre llaves. Ej: "{Width} + 0.30"</param>
        /// <param name="variables">Diccionario nombre → valor numérico.</param>
        /// <returns>Resultado con valor o error.</returns>
        public static FormulaResult Evaluar(string formula, Dictionary<string, double> variables)
        {
            if (string.IsNullOrWhiteSpace(formula))
                return FormulaResult.Fallo("Fórmula vacía");

            try
            {
                // 1. Encontrar todas las variables usadas
                var matches = _varPattern.Matches(formula);
                string expandida = formula;

                foreach (Match m in matches)
                {
                    string varName = m.Groups[1].Value.Trim();

                    if (!variables.TryGetValue(varName, out double valor))
                    {
                        // Buscar case-insensitive
                        var key = variables.Keys.FirstOrDefault(k =>
                            k.Equals(varName, StringComparison.OrdinalIgnoreCase));

                        if (key == null)
                            return FormulaResult.Fallo(
                                $"Variable '{varName}' no encontrada. " +
                                $"Disponibles: {string.Join(", ", variables.Keys.Take(10))}");

                        valor = variables[key];
                    }

                    // Reemplazar {variable} con el valor numérico
                    // Usar formato invariante para evitar problemas con comas decimales
                    expandida = expandida.Replace(m.Value,
                        valor.ToString("G", System.Globalization.CultureInfo.InvariantCulture));
                }

                // 2. Evaluar la expresión matemática
                object result = _dt.Compute(expandida, null);

                if (result == null || result == DBNull.Value)
                    return FormulaResult.Fallo($"La fórmula '{expandida}' no retornó resultado");

                double valorFinal = Convert.ToDouble(result);
                return FormulaResult.Ok(Math.Round(valorFinal, 4), expandida);
            }
            catch (SyntaxErrorException ex)
            {
                return FormulaResult.Fallo($"Error de sintaxis: {ex.Message}");
            }
            catch (EvaluateException ex)
            {
                return FormulaResult.Fallo($"Error de cálculo: {ex.Message}");
            }
            catch (DivideByZeroException)
            {
                return FormulaResult.Fallo("División por cero");
            }
            catch (Exception ex)
            {
                return FormulaResult.Fallo($"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Valida una fórmula sin evaluarla completamente.
        /// Verifica sintaxis y que todas las variables existan.
        /// </summary>
        /// <param name="formula">Fórmula a validar.</param>
        /// <param name="variablesDisponibles">Nombres de variables disponibles.</param>
        /// <returns>Null si es válida, mensaje de error si no.</returns>
        public static string? Validar(string formula, IEnumerable<string> variablesDisponibles)
        {
            if (string.IsNullOrWhiteSpace(formula))
                return "Fórmula vacía";

            var disponibles = new HashSet<string>(
                variablesDisponibles, StringComparer.OrdinalIgnoreCase);

            var matches = _varPattern.Matches(formula);
            if (matches.Count == 0)
                return "La fórmula no referencia ninguna variable. Use {NombreParam} para referenciar parámetros.";

            foreach (Match m in matches)
            {
                string varName = m.Groups[1].Value.Trim();
                if (!disponibles.Contains(varName))
                    return $"Variable '{varName}' no existe. Disponibles: {string.Join(", ", disponibles.Take(10))}";
            }

            // Intentar evaluar con valores dummy para validar sintaxis
            var dummy = disponibles.ToDictionary(v => v, _ => 1.0);
            var result = Evaluar(formula, dummy);
            if (!result.Exito)
                return result.Error;

            return null; // válida
        }

        /// <summary>
        /// Extrae las variables usadas en una fórmula.
        /// </summary>
        public static List<string> ExtraerVariables(string formula)
        {
            if (string.IsNullOrWhiteSpace(formula))
                return new List<string>();

            return _varPattern.Matches(formula)
                .Select(m => m.Groups[1].Value.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }
    }
}
