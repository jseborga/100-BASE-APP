// Views/ParameterWizardWindow.xaml.cs
// Wizard para configurar qué parámetros custom exportar por familia Revit.
//
// Panel izquierdo: TreeView de familias agrupadas por categoría.
// Panel derecho: configuración de parámetros directos + fórmulas + notas IA.
//
// Los perfiles se guardan en el ExportRuleSet del documento (JSON persistente).
//
// Autor: SSA Ingenieria SRL

using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using WpfVisibility = System.Windows.Visibility;
using Autodesk.Revit.DB;
using RvtConstructionOS.Models;
using RvtConstructionOS.Services;

namespace RvtConstructionOS.Views
{
    // ================================================================
    // ViewModels internos para data binding
    // ================================================================

    /// <summary>Fila del DataGrid de parámetros directos.</summary>
    public class ParamRow : INotifyPropertyChanged
    {
        private bool   _seleccionado;
        private string _notaIA = string.Empty;

        public string Nombre       { get; set; } = string.Empty;
        public string ParamGuid    { get; set; } = string.Empty;
        public string TipoDato     { get; set; } = string.Empty;
        public string Origen       { get; set; } = string.Empty;
        public string ValorEjemplo { get; set; } = string.Empty;
        public string Grupo        { get; set; } = string.Empty;

        public bool Seleccionado
        {
            get => _seleccionado;
            set { _seleccionado = value; OnPropertyChanged(nameof(Seleccionado)); }
        }

        public string NotaIA
        {
            get => _notaIA;
            set { _notaIA = value; OnPropertyChanged(nameof(NotaIA)); }
        }

        public bool EsNumerico => TipoDato is "NUMBER" or "LENGTH" or "AREA" or "VOLUME" or "INTEGER";

        public event PropertyChangedEventHandler? PropertyChanged;
        private void OnPropertyChanged(string name) =>
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    }

    /// <summary>Fila del formulario de fórmulas calculadas.</summary>
    public class FormulaRow : INotifyPropertyChanged
    {
        private string _nombre  = string.Empty;
        private string _formula = string.Empty;
        private string _unidad  = string.Empty;
        private string _notaIA  = string.Empty;

        public string Nombre
        {
            get => _nombre;
            set { _nombre = value; OnPropertyChanged(nameof(Nombre)); }
        }
        public string Formula
        {
            get => _formula;
            set { _formula = value; OnPropertyChanged(nameof(Formula)); }
        }
        public string Unidad
        {
            get => _unidad;
            set { _unidad = value; OnPropertyChanged(nameof(Unidad)); }
        }
        public string NotaIA
        {
            get => _notaIA;
            set { _notaIA = value; OnPropertyChanged(nameof(NotaIA)); }
        }

        public event PropertyChangedEventHandler? PropertyChanged;
        private void OnPropertyChanged(string name) =>
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    }

    /// <summary>Nodo de categoría en el TreeView.</summary>
    public class NodoCategoriaWiz
    {
        public string Nombre { get; set; } = string.Empty;
        public List<NodoFamiliaWiz> Familias { get; set; } = new();
        public override string ToString() => $"{Nombre} ({Familias.Count})";
    }

    /// <summary>Nodo de familia en el TreeView.</summary>
    public class NodoFamiliaWiz
    {
        public string Familia    { get; set; } = string.Empty;
        public string Categoria  { get; set; } = string.Empty;
        public int    CantTipos  { get; set; }
        public int    CantInst   { get; set; }
        public bool   TienePerfil { get; set; }
        public FamiliaEscaneada? Data { get; set; }
        public override string ToString() =>
            TienePerfil
                ? $"\u2705 {Familia} ({CantTipos}t, {CantInst}i)"
                : $"    {Familia} ({CantTipos}t, {CantInst}i)";
    }

    // ================================================================
    // VENTANA PRINCIPAL
    // ================================================================

    public partial class ParameterWizardWindow : Window
    {
        private readonly Document _doc;
        private ExportRuleSet _ruleSet;
        private List<FamiliaEscaneada> _familias = new();
        private NodoFamiliaWiz? _familiaActual;

        // Estado editable de la familia actual
        private ObservableCollection<ParamRow> _paramRows = new();
        private ObservableCollection<FormulaRow> _formulaRows = new();

        // Cambios pendientes por familia (clave = "Categoria|Familia")
        private readonly Dictionary<string, FamilyParamProfile> _perfilesDirty = new();

        private bool _actualizandoUI;

        public ParameterWizardWindow(Document doc, ExportRuleSet ruleSet)
        {
            _doc     = doc;
            _ruleSet = ruleSet;
            InitializeComponent();
        }

        // ---------------------------------------------------------------
        // Inicialización
        // ---------------------------------------------------------------

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            try
            {
                // Cargar perfiles existentes en el cache dirty
                foreach (var perfil in _ruleSet.PerfilesParametros)
                    _perfilesDirty[perfil.Clave] = perfil;

                // Escanear modelo
                _familias = FamilyParameterScanner.EscanearModelo(_doc);
                lblInfoEscaneo.Text = $"{_familias.Count} familias con instancias dibujadas";

                // Construir TreeView
                ConstruirArbol(_familias);
            }
            catch (Exception ex)
            {
                lblInfoEscaneo.Text = $"Error al escanear: {ex.Message}";
            }
        }

        // ---------------------------------------------------------------
        // Construir TreeView de familias
        // ---------------------------------------------------------------

        private void ConstruirArbol(List<FamiliaEscaneada> familias, string? filtro = null)
        {
            treeFamilias.Items.Clear();

            var porCategoria = familias
                .Where(f => string.IsNullOrWhiteSpace(filtro)
                    || f.Familia.Contains(filtro, StringComparison.OrdinalIgnoreCase)
                    || f.Categoria.Contains(filtro, StringComparison.OrdinalIgnoreCase))
                .GroupBy(f => f.Categoria)
                .OrderBy(g => g.Key);

            foreach (var grupo in porCategoria)
            {
                var nodoCat = new TreeViewItem
                {
                    IsExpanded = true,
                    FontWeight = FontWeights.SemiBold,
                    Foreground = System.Windows.Media.Brushes.DarkSlateGray,
                };

                var nodosFam = new List<NodoFamiliaWiz>();

                foreach (var fam in grupo.OrderBy(f => f.Familia))
                {
                    string clave = $"{fam.Categoria}|{fam.Familia}";
                    bool tienePerfil = _perfilesDirty.ContainsKey(clave)
                        && (_perfilesDirty[clave].ParametrosDirectos.Any(p => p.Activo)
                            || _perfilesDirty[clave].ParametrosCalculados.Count > 0);

                    var nodoFam = new NodoFamiliaWiz
                    {
                        Familia     = fam.Familia,
                        Categoria   = fam.Categoria,
                        CantTipos   = fam.CantTipos,
                        CantInst    = fam.CantInstancias,
                        TienePerfil = tienePerfil,
                        Data        = fam,
                    };
                    nodosFam.Add(nodoFam);

                    var itemFam = new TreeViewItem
                    {
                        Header     = nodoFam.ToString(),
                        Tag        = nodoFam,
                        FontWeight = tienePerfil ? FontWeights.SemiBold : FontWeights.Normal,
                        Foreground = tienePerfil
                            ? System.Windows.Media.Brushes.DarkGreen
                            : System.Windows.Media.Brushes.DarkSlateGray,
                    };
                    nodoCat.Items.Add(itemFam);
                }

                nodoCat.Header = $"{grupo.Key} ({nodosFam.Count})";
                treeFamilias.Items.Add(nodoCat);
            }
        }

        // ---------------------------------------------------------------
        // Selección de familia
        // ---------------------------------------------------------------

        private void TreeFamilias_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
        {
            if (e.NewValue is not TreeViewItem item || item.Tag is not NodoFamiliaWiz nodo)
            {
                panelContenido.Visibility = WpfVisibility.Collapsed;
                lblFamiliaSeleccionada.Text = "Seleccione una familia";
                return;
            }

            // Guardar cambios de la familia anterior antes de cambiar
            GuardarFamiliaActualEnCache();

            _familiaActual = nodo;
            panelContenido.Visibility = WpfVisibility.Visible;
            lblFamiliaSeleccionada.Text = $"{nodo.Categoria} > {nodo.Familia}  ({nodo.CantTipos} tipos, {nodo.CantInst} instancias)";

            CargarFamilia(nodo);
        }

        // ---------------------------------------------------------------
        // Cargar familia en panel derecho
        // ---------------------------------------------------------------

        private void CargarFamilia(NodoFamiliaWiz nodo)
        {
            _actualizandoUI = true;

            var data = nodo.Data;
            if (data == null) return;

            string clave = $"{nodo.Categoria}|{nodo.Familia}";
            _perfilesDirty.TryGetValue(clave, out var perfilExistente);

            // --- Nota general ---
            txtNotaGeneralIA.Text = perfilExistente?.NotaGeneralIA ?? "";

            // --- Parámetros directos ---
            _paramRows = new ObservableCollection<ParamRow>();
            foreach (var p in data.Parametros)
            {
                // Buscar si ya estaba seleccionado en el perfil existente
                var existente = perfilExistente?.ParametrosDirectos
                    .FirstOrDefault(pd => pd.NombreRevit.Equals(p.Nombre, StringComparison.OrdinalIgnoreCase));

                _paramRows.Add(new ParamRow
                {
                    Nombre       = p.Nombre,
                    ParamGuid    = p.Guid,
                    TipoDato     = p.TipoDato,
                    Origen       = p.Origen,
                    ValorEjemplo = p.ValorEjemplo,
                    Grupo        = p.Grupo,
                    Seleccionado = existente?.Activo ?? false,
                    NotaIA       = existente?.NotaIA ?? "",
                });
            }
            gridParametros.ItemsSource = _paramRows;

            // --- Fórmulas ---
            _formulaRows = new ObservableCollection<FormulaRow>();
            if (perfilExistente != null)
            {
                foreach (var pc in perfilExistente.ParametrosCalculados)
                {
                    _formulaRows.Add(new FormulaRow
                    {
                        Nombre  = pc.Nombre,
                        Formula = pc.Formula,
                        Unidad  = pc.Unidad,
                        NotaIA  = pc.NotaIA,
                    });
                }
            }
            listaFormulas.ItemsSource = _formulaRows;

            _actualizandoUI = false;

            ActualizarConteos();
            ActualizarVariablesCustom();
            ActualizarPreview();
        }

        // ---------------------------------------------------------------
        // Eventos de edición
        // ---------------------------------------------------------------

        private void GridParametros_CellEditEnding(object sender, DataGridCellEditEndingEventArgs e)
        {
            if (_actualizandoUI) return;
            // Delay para que el binding se actualice primero
            Dispatcher.BeginInvoke(new Action(() =>
            {
                ActualizarConteos();
                ActualizarVariablesCustom();
                ActualizarPreview();
            }), System.Windows.Threading.DispatcherPriority.Background);
        }

        private void NotaGeneralIA_Changed(object sender, TextChangedEventArgs e)
        {
            if (_actualizandoUI) return;
            ActualizarPreview();
        }

        private void FormulaField_LostFocus(object sender, RoutedEventArgs e)
        {
            if (_actualizandoUI) return;
            if (sender is TextBox tb && tb.DataContext is FormulaRow row)
            {
                // Validar fórmula
                var varsDisponibles = ObtenerVariablesDisponibles();
                string? error = FormulaEvaluator.Validar(row.Formula, varsDisponibles);
                if (error != null)
                {
                    tb.BorderBrush = System.Windows.Media.Brushes.Red;
                    tb.ToolTip = error;
                }
                else
                {
                    tb.BorderBrush = System.Windows.Media.Brushes.Green;
                    tb.ToolTip = "Fórmula válida";
                }
            }
            ActualizarConteos();
            ActualizarPreview();
        }

        private void BtnAgregarFormula_Click(object sender, RoutedEventArgs e)
        {
            _formulaRows.Add(new FormulaRow
            {
                Nombre  = $"Param{_formulaRows.Count + 1}",
                Formula = "",
                Unidad  = "m",
                NotaIA  = "",
            });
            ActualizarConteos();
            ActualizarPreview();
        }

        private void BtnEliminarFormula_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is FormulaRow row)
            {
                _formulaRows.Remove(row);
                ActualizarConteos();
                ActualizarPreview();
            }
        }

        private void TxtBuscarFamilia_TextChanged(object sender, TextChangedEventArgs e)
        {
            string filtro = txtBuscarFamilia.Text.Trim();
            ConstruirArbol(_familias, string.IsNullOrEmpty(filtro) ? null : filtro);
        }

        // ---------------------------------------------------------------
        // Helpers de UI
        // ---------------------------------------------------------------

        private void ActualizarConteos()
        {
            int seleccionados = _paramRows.Count(r => r.Seleccionado);
            lblConteoParams.Text = $"{seleccionados} de {_paramRows.Count} seleccionados";
            lblConteoFormulas.Text = $"{_formulaRows.Count} fórmulas";
        }

        private void ActualizarVariablesCustom()
        {
            var vars = _paramRows
                .Where(r => r.Seleccionado)
                .Select(r => $"{{{r.Nombre}}}")
                .ToList();

            if (vars.Count > 0)
                lblVariablesCustom.Text = "Del tipo: " + string.Join("  ", vars);
            else
                lblVariablesCustom.Text = "Del tipo: (seleccione parámetros arriba)";
        }

        private List<string> ObtenerVariablesDisponibles()
        {
            // Variables estándar (siempre disponibles)
            var vars = new List<string>
            {
                "Area", "Volume", "Length", "Height", "Width", "Count",
                "Espesor", "AreaNetaInt", "AreaNetaExt", "AreaBrutaInt",
                "AreaBrutaExt", "OpeningsArea", "PesoTotalKg",
                "Cantidad", "CantidadPrincipal",
            };

            // Variables custom del tipo seleccionado
            vars.AddRange(_paramRows
                .Where(r => r.Seleccionado)
                .Select(r => r.Nombre));

            return vars;
        }

        private void ActualizarPreview()
        {
            if (_familiaActual == null) return;

            var preview = new Dictionary<string, object>();

            // Parámetros directos seleccionados
            var paramsDirectos = _paramRows
                .Where(r => r.Seleccionado)
                .ToList();

            if (paramsDirectos.Count > 0)
            {
                var paramsPrev = new Dictionary<string, object>();
                var notasPrev  = new Dictionary<string, string>();

                foreach (var r in paramsDirectos)
                {
                    string key = SanitizarNombre(r.Nombre);
                    paramsPrev[key] = r.EsNumerico ? (object)r.ValorEjemplo : r.ValorEjemplo;
                    if (!string.IsNullOrWhiteSpace(r.NotaIA))
                        notasPrev[key] = r.NotaIA;
                }

                preview["parametros_custom"] = paramsPrev;
                if (notasPrev.Count > 0)
                    preview["notas_ia"] = notasPrev;
            }

            // Fórmulas
            var formulas = _formulaRows
                .Where(f => !string.IsNullOrWhiteSpace(f.Nombre) && !string.IsNullOrWhiteSpace(f.Formula))
                .ToList();

            if (formulas.Count > 0)
            {
                var calcPrev  = new Dictionary<string, string>();
                var notasCalc = new Dictionary<string, string>();

                foreach (var f in formulas)
                {
                    string key = "calc_" + SanitizarNombre(f.Nombre);
                    calcPrev[key] = $"{f.Formula} [{f.Unidad}]";
                    if (!string.IsNullOrWhiteSpace(f.NotaIA))
                        notasCalc[key] = f.NotaIA;
                }

                preview["parametros_calculados"] = calcPrev;
                if (notasCalc.Count > 0)
                {
                    // Merge con notas directas
                    if (preview.ContainsKey("notas_ia") && preview["notas_ia"] is Dictionary<string, string> existing)
                    {
                        foreach (var kv in notasCalc)
                            existing[kv.Key] = kv.Value;
                    }
                    else
                    {
                        preview["notas_ia"] = notasCalc;
                    }
                }
            }

            // Nota general
            if (!string.IsNullOrWhiteSpace(txtNotaGeneralIA.Text))
                preview["nota_familia"] = txtNotaGeneralIA.Text.Trim();

            if (preview.Count == 0)
            {
                lblPreviewJson.Text = "// Sin parámetros custom configurados";
                return;
            }

            try
            {
                var opts = new JsonSerializerOptions { WriteIndented = true };
                lblPreviewJson.Text = JsonSerializer.Serialize(preview, opts);
            }
            catch
            {
                lblPreviewJson.Text = "// Error generando preview";
            }
        }

        // ---------------------------------------------------------------
        // Guardar / Cancelar
        // ---------------------------------------------------------------

        /// <summary>Guarda el estado de la familia actual en el cache dirty.</summary>
        private void GuardarFamiliaActualEnCache()
        {
            if (_familiaActual == null) return;

            string clave = $"{_familiaActual.Categoria}|{_familiaActual.Familia}";

            var perfil = new FamilyParamProfile
            {
                Familia           = _familiaActual.Familia,
                Categoria         = _familiaActual.Categoria,
                NotaGeneralIA     = txtNotaGeneralIA.Text.Trim(),
                FechaModificacion = DateTime.Now,
            };

            // Parámetros directos
            foreach (var r in _paramRows)
            {
                if (!r.Seleccionado && string.IsNullOrWhiteSpace(r.NotaIA))
                    continue; // No guardar parámetros no seleccionados sin nota

                perfil.ParametrosDirectos.Add(new ParamDirecto
                {
                    NombreRevit = r.Nombre,
                    ParamGuid   = r.ParamGuid,
                    Origen      = r.Origen,
                    TipoDato    = r.TipoDato,
                    NotaIA      = r.NotaIA,
                    Activo      = r.Seleccionado,
                });
            }

            // Fórmulas
            foreach (var f in _formulaRows)
            {
                if (string.IsNullOrWhiteSpace(f.Nombre) && string.IsNullOrWhiteSpace(f.Formula))
                    continue;

                perfil.ParametrosCalculados.Add(new ParamCalculado
                {
                    Nombre  = f.Nombre,
                    Formula = f.Formula,
                    Unidad  = f.Unidad,
                    NotaIA  = f.NotaIA,
                    Activo  = true,
                });
            }

            _perfilesDirty[clave] = perfil;
        }

        private void BtnGuardar_Click(object sender, RoutedEventArgs e)
        {
            // Guardar familia actual primero
            GuardarFamiliaActualEnCache();

            // Validar fórmulas de todos los perfiles
            foreach (var (clave, perfil) in _perfilesDirty)
            {
                foreach (var calc in perfil.ParametrosCalculados)
                {
                    if (string.IsNullOrWhiteSpace(calc.Formula)) continue;

                    var vars = new List<string>
                    {
                        "Area", "Volume", "Length", "Height", "Width", "Count",
                        "Espesor", "AreaNetaInt", "AreaNetaExt", "AreaBrutaInt",
                        "AreaBrutaExt", "OpeningsArea", "PesoTotalKg",
                    };
                    vars.AddRange(perfil.ParametrosDirectos
                        .Where(p => p.Activo)
                        .Select(p => p.NombreRevit));

                    string? error = FormulaEvaluator.Validar(calc.Formula, vars);
                    if (error != null)
                    {
                        MessageBox.Show(
                            $"Error en fórmula '{calc.Nombre}' de {perfil.Familia}:\n{error}",
                            "Error de validación", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                }
            }

            // Aplicar al RuleSet
            _ruleSet.PerfilesParametros = _perfilesDirty.Values
                .Where(p => p.ParametrosDirectos.Any(pd => pd.Activo)
                         || p.ParametrosCalculados.Count > 0
                         || !string.IsNullOrWhiteSpace(p.NotaGeneralIA))
                .ToList();

            // Guardar a disco
            ExportRuleService.Guardar(_doc, _ruleSet);

            int totalPerfiles = _ruleSet.PerfilesParametros.Count;
            int totalParams   = _ruleSet.PerfilesParametros.Sum(p => p.ParametrosDirectos.Count(pd => pd.Activo));
            int totalFormulas = _ruleSet.PerfilesParametros.Sum(p => p.ParametrosCalculados.Count);

            lblEstado.Text = $"Guardado: {totalPerfiles} familias, {totalParams} parámetros, {totalFormulas} fórmulas";
            lblEstado.Foreground = System.Windows.Media.Brushes.Green;

            // Actualizar TreeView para reflejar perfiles guardados
            string? filtro = txtBuscarFamilia.Text.Trim();
            ConstruirArbol(_familias, string.IsNullOrEmpty(filtro) ? null : filtro);

            MessageBox.Show(
                $"Configuración guardada:\n\n" +
                $"  Familias configuradas: {totalPerfiles}\n" +
                $"  Parámetros seleccionados: {totalParams}\n" +
                $"  Fórmulas calculadas: {totalFormulas}\n\n" +
                $"Los parámetros custom se incluirán en la próxima exportación BIM.",
                "Configuración guardada", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void BtnCancelar_Click(object sender, RoutedEventArgs e)
        {
            Close();
        }

        // ---------------------------------------------------------------
        // Utils
        // ---------------------------------------------------------------

        private static string SanitizarNombre(string nombre)
        {
            if (string.IsNullOrWhiteSpace(nombre)) return "param";
            var chars = nombre.Select(c =>
                char.IsLetterOrDigit(c) || c == '_' ? c : '_').ToArray();
            return new string(chars).Trim('_');
        }
    }
}
