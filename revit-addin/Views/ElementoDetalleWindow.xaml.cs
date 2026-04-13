// Views/ElementoDetalleWindow.xaml.cs
// Ventana flotante de detalle de cómputos para un tipo de elemento seleccionado
// en la ventana QuantityBrowserWindow.
//
// Se abre al seleccionar una fila en el árbol BOQ y muestra:
//   - Todas las cantidades brutas/netas del modelo
//   - Capas estructurales (CompoundStructure)
//   - Partidas asignadas editables (multi-partida)
//   - Clasificación WBS / Odoo
//   - Estado de matching
//
// Patron: ventana modeless, singleton por elemento seleccionado.
// La ventana se reutiliza (se actualiza su contenido) si ya está abierta.
//
// Autor: SSA Ingenieria SRL

using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using RvtConstructionOS.Models;
using RvtConstructionOS.ViewModels;
using WpfComboBox     = System.Windows.Controls.ComboBox;
using WpfComboBoxItem = System.Windows.Controls.ComboBoxItem;
using WpfVisibility   = System.Windows.Visibility;

namespace RvtConstructionOS.Views
{
    public partial class ElementoDetalleWindow : Window
    {
        // -----------------------------------------------------------------------
        // Estado actual
        // -----------------------------------------------------------------------

        private NodoTipoVm? _tipoActual;

        /// <summary>
        /// Callback invocado cuando el usuario modifica las partidas asignadas.
        /// El parámetro es el TypeUniqueId del tipo modificado.
        /// </summary>
        public event Action<string>? PartidasModificadas;

        // -----------------------------------------------------------------------
        // Constructor
        // -----------------------------------------------------------------------

        public ElementoDetalleWindow()
        {
            InitializeComponent();
        }

        // -----------------------------------------------------------------------
        // API pública — actualizar contenido con el tipo seleccionado
        // -----------------------------------------------------------------------

        /// <summary>
        /// Actualiza la ventana con el elemento seleccionado en el árbol BOQ.
        /// Si la ventana ya está visible, solo actualiza los datos.
        /// </summary>
        public void MostrarTipo(NodoTipoVm tipo, Window owner)
        {
            _tipoActual = tipo;

            // Posicionar cerca del owner la primera vez
            if (!IsVisible)
            {
                Owner = owner;
                Left  = owner.Left + owner.Width + 8;
                Top   = owner.Top;
            }

            RellenarDatos(tipo);

            if (!IsVisible)
                Show();
            else
                Activate();
        }

        // -----------------------------------------------------------------------
        // Relleno de datos
        // -----------------------------------------------------------------------

        private void RellenarDatos(NodoTipoVm tipo)
        {
            var elem = tipo.Elemento;

            // Encabezado
            txtTituloNombre.Text = tipo.TipoRevit;
            txtTituloMeta.Text   = $"{tipo.Categoria}  ·  {tipo.Familia}" +
                                   (tipo.NumInstancias > 0 ? $"  ·  {tipo.NumInstancias} instancias" : "");

            // ── Cantidades brutas ──────────────────────────────────────────────
            txtInstancias.Text   = tipo.NumInstancias > 0 ? $"{tipo.NumInstancias}" : "—";
            txtAreaBrutaInt.Text = FormatM2(tipo.AreaBrutaInt);
            txtAreaBrutaExt.Text = FormatM2(tipo.AreaBrutaExt);
            txtHuecos.Text       = tipo.AreaHuecosDesc > 0 ? $"- {tipo.AreaHuecosDesc:F2}" : "—";
            txtAreaNetaInt.Text  = FormatM2(tipo.AreaNetaInt);
            txtVolumen.Text      = tipo.TieneVolumen  ? $"{tipo.VolumenM3:F3}" : "—";
            txtLongitud.Text     = tipo.TieneLongitud ? $"{tipo.LongitudML:F3}" : "—";

            double alturaPromedio = elem?.AlturaPromedio ?? 0;
            double espesorM       = elem?.EspesorM       ?? 0;
            lblAltura.Visibility  = alturaPromedio > 0 ? WpfVisibility.Visible : WpfVisibility.Collapsed;
            txtAltura.Visibility  = alturaPromedio > 0 ? WpfVisibility.Visible : WpfVisibility.Collapsed;
            txtAltura.Text        = alturaPromedio > 0 ? $"{alturaPromedio:F2}" : "—";
            lblEspesor.Visibility = espesorM > 0 ? WpfVisibility.Visible : WpfVisibility.Collapsed;
            txtEspesor.Visibility = espesorM > 0 ? WpfVisibility.Visible : WpfVisibility.Collapsed;
            txtEspesor.Text       = espesorM > 0 ? $"{espesorM:F3}" : "—";

            // ── Sección estructural (acero) ────────────────────────────────────
            bool tieneSeccion = elem != null && !string.IsNullOrWhiteSpace(elem.SeccionTransversal);
            borderSeccion.Visibility = tieneSeccion ? WpfVisibility.Visible : WpfVisibility.Collapsed;
            gridSeccion.Visibility   = tieneSeccion ? WpfVisibility.Visible : WpfVisibility.Collapsed;
            if (tieneSeccion && elem != null)
            {
                txtSeccion.Text    = elem.SeccionTransversal;
                txtPesoLineal.Text = elem.PesoLinealKgM > 0 ? $"{elem.PesoLinealKgM:F2} kg/m" : "—";
                txtPesoTotal.Text  = elem.PesoTotalKg   > 0 ? $"{elem.PesoTotalKg:F1} kg" : "—";
            }

            // ── Capas estructurales ────────────────────────────────────────────
            var capas = elem?.CapasEstructurales ?? new();
            bool tieneCapas = capas.Count > 0;
            borderCapas.Visibility = tieneCapas ? WpfVisibility.Visible : WpfVisibility.Collapsed;
            gridCapas.Visibility   = tieneCapas ? WpfVisibility.Visible : WpfVisibility.Collapsed;
            if (tieneCapas)
                gridCapas.ItemsSource = capas;

            // ── Partidas asignadas ─────────────────────────────────────────────
            RefrescarListaPartidas(tipo);

            // ── Clasificación WBS / Odoo ───────────────────────────────────────
            txtKeynote.Text  = elem?.KeynoteCode  ?? string.Empty;
            txtAssembly.Text = elem?.AssemblyCode ?? string.Empty;
            txtRubro.Text    = elem?.RubroOdoo    ?? string.Empty;
            txtFuncion.Text  = elem?.FuncionElemento ?? string.Empty;
            txtFase.Text     = elem?.FaseNombre   ?? string.Empty;

            // ── Estado de matching ─────────────────────────────────────────────
            var match = elem?.MatchResult;
            if (match != null)
            {
                txtMatchEstado.Text      = match.EtiquetaEstado;
                txtMatchCriterio.Text    = match.CriterioMatch.Length > 60
                                            ? match.CriterioMatch[..60] + "…"
                                            : match.CriterioMatch;
                borderMatch.Background   = MatchColor(match.Estado);
            }
            else
            {
                txtMatchEstado.Text      = "Sin match";
                txtMatchCriterio.Text    = string.Empty;
                borderMatch.Background   = new SolidColorBrush(Colors.Transparent);
            }
        }

        private void RefrescarListaPartidas(NodoTipoVm tipo)
        {
            // Mostrar partidas asignadas en el ItemsControl
            // La partida principal (ExportRule.CodigoPartida) se muestra primero si existe
            var todas = new List<PartidaAsignada>();

            var regla = tipo.ObtenerRegla();
            var principal = regla.PartidaPrincipalComoObjeto;
            if (principal != null && regla.PartidasAsignadas.Count == 0)
                todas.Add(principal);
            else
                todas.AddRange(regla.PartidasAsignadas.Where(p => p.Activa).OrderBy(p => p.Orden));

            listPartidas.ItemsSource = null;
            listPartidas.ItemsSource = todas;
        }

        // -----------------------------------------------------------------------
        // Eventos de la UI
        // -----------------------------------------------------------------------

        private void BtnAgregarPartida_Click(object sender, RoutedEventArgs e)
        {
            if (_tipoActual == null) return;

            // Abre el selector de catálogo (o agrega una vacía directamente)
            var nueva = new PartidaAsignada
            {
                CodigoPartida   = string.Empty,
                Descripcion     = "Nueva partida",
                UnidadElegida   = UnidadesBOQ.M2,
                CriterioCalculo = CriteriosCalculo.AreaNetaInt,
                Factor          = 1.0,
                Orden           = (_tipoActual.ObtenerRegla().PartidasAsignadas.Count + 1) * 10,
            };
            _tipoActual.ObtenerRegla().PartidasAsignadas.Add(nueva);
            RefrescarListaPartidas(_tipoActual);
            NotificarCambio();
        }

        private void BtnQuitarPartida_Click(object sender, RoutedEventArgs e)
        {
            if (_tipoActual == null) return;
            if (sender is Button btn && btn.Tag is PartidaAsignada partida)
            {
                _tipoActual.ObtenerRegla().PartidasAsignadas.Remove(partida);
                RefrescarListaPartidas(_tipoActual);
                NotificarCambio();
            }
        }

        private void PartidaUnidad_Changed(object sender, SelectionChangedEventArgs e)
        {
            if (sender is WpfComboBox cmb && cmb.Tag is PartidaAsignada partida
                && cmb.SelectedItem is WpfComboBoxItem item)
            {
                partida.UnidadElegida = item.Content?.ToString() ?? UnidadesBOQ.M2;
                NotificarCambio();
            }
        }

        private void PartidaCriterio_Changed(object sender, SelectionChangedEventArgs e)
        {
            if (sender is WpfComboBox cmb && cmb.Tag is PartidaAsignada partida
                && cmb.SelectedItem is WpfComboBoxItem item)
            {
                partida.CriterioCalculo = item.Content?.ToString() ?? CriteriosCalculo.AreaNetaInt;
                NotificarCambio();
            }
        }

        private void PartidaFactor_LostFocus(object sender, RoutedEventArgs e)
        {
            if (sender is TextBox txt && txt.Tag is PartidaAsignada partida)
            {
                if (double.TryParse(txt.Text, out double v) && v > 0)
                {
                    partida.Factor = v;
                    NotificarCambio();
                }
                else
                {
                    txt.Text = partida.Factor.ToString("F2");
                }
            }
        }

        private void BtnCerrar_Click(object sender, RoutedEventArgs e) => Hide();

        private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            e.Cancel = true; // No destruir — ocultar para reutilizar
            Hide();
        }

        // -----------------------------------------------------------------------
        // Helpers
        // -----------------------------------------------------------------------

        private void NotificarCambio()
        {
            if (_tipoActual != null)
                PartidasModificadas?.Invoke(_tipoActual.ObtenerRegla().TypeUniqueId);
        }

        private static string FormatM2(double v) => v > 0 ? $"{v:F2}" : "—";

        private static Brush MatchColor(EstadoMatch estado) => estado switch
        {
            EstadoMatch.AprobadoAuto    => new SolidColorBrush(Color.FromRgb(200, 230, 201)),
            EstadoMatch.AprobadoManual  => new SolidColorBrush(Color.FromRgb(200, 230, 201)),
            EstadoMatch.RevisarSugerido => new SolidColorBrush(Color.FromRgb(255, 243, 205)),
            EstadoMatch.ManualObligatorio => new SolidColorBrush(Color.FromRgb(255, 224, 178)),
            EstadoMatch.SinMatch        => new SolidColorBrush(Color.FromRgb(255, 205, 210)),
            _                          => new SolidColorBrush(Colors.Transparent),
        };
    }
}
