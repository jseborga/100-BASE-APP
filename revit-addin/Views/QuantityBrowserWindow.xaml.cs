// Views/QuantityBrowserWindow.xaml.cs
// Ventana flotante (modeless) de cómputos BOQ — SSA BIM Bridge.
//
// Muestra árbol: Categoría → Familia → Tipo, con cantidades del modelo.
// Panel de detalle: desglose de cantidades + campos editables de configuración BOQ.
// Derivados: partidas calculadas (revoque, pintura, zócalo, etc.) con campos editables.
//
// La ventana se abre como modeless (Show()) y permanece abierta mientras se trabaja en Revit.
// El botón "Actualizar" usa ExternalEvent para re-escanear el modelo sin bloquear Revit.
//
// Autor: SSA Ingenieria SRL

using System.Collections.ObjectModel;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using WpfComboBox = System.Windows.Controls.ComboBox;
using WpfComboBoxItem = System.Windows.Controls.ComboBoxItem;
using WpfVisibility = System.Windows.Visibility;
using Microsoft.Win32;
using RvtConstructionOS.Models;
using RvtConstructionOS.Services;
using RvtConstructionOS.ViewModels;

namespace RvtConstructionOS.Views
{
    public partial class QuantityBrowserWindow : Window
    {
        // -----------------------------------------------------------------------
        // Estado interno
        // -----------------------------------------------------------------------

        private readonly Document                   _doc;
        private readonly ExternalEvent              _extEvent;
        private readonly RefreshBOQHandler          _handler;
        private readonly ExternalEvent?             _selEvent;
        private readonly SelectionHighlightHandler? _selHandler;

        private ExtractionResult?       _result;
        private ExportRuleSet           _ruleSet = new();
        private NodoTipoVm?             _tipoSeleccionado;

        // Árbol completo (sin filtro)
        private ObservableCollection<NodoCategoriaVm> _todasCategorias = new();

        // Bandera para no disparar eventos mientras se actualiza la UI
        private bool _actualizandoUI = false;

        // Ventana de detalle de cómputos (singleton reutilizable)
        private ElementoDetalleWindow? _ventanaDetalle;

        // -----------------------------------------------------------------------
        // Constructor
        // -----------------------------------------------------------------------

        public QuantityBrowserWindow(Document doc, ExternalEvent extEvent, RefreshBOQHandler handler,
            ExternalEvent? selEvent = null, SelectionHighlightHandler? selHandler = null)
        {
            InitializeComponent();
            _doc        = doc      ?? throw new ArgumentNullException(nameof(doc));
            _extEvent   = extEvent ?? throw new ArgumentNullException(nameof(extEvent));
            _handler    = handler  ?? throw new ArgumentNullException(nameof(handler));
            _selEvent   = selEvent;
            _selHandler = selHandler;

            // Cuando el handler termine, actualizar la UI
            _handler.OnCompletado = ActualizarConResultado;

            if (_selHandler != null)
                _selHandler.OnCompletado = n => txtStatus.Text =
                    $"✓ {n} instancias seleccionadas/resaltadas en Revit";
        }

        // -----------------------------------------------------------------------
        // Carga inicial
        // -----------------------------------------------------------------------

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            txtNombreModelo.Text = _doc.Title;
            CargarDatos();
        }

        /// <summary>
        /// Carga los datos: extracción del modelo + reglas guardadas → construye el árbol.
        /// </summary>
        private void CargarDatos()
        {
            try
            {
                // Extraer cómputos del modelo Revit
                var svc = new RevitExtractionService();
                _result = svc.Extraer(_doc);

                // Cargar reglas guardadas
                _ruleSet = ExportRuleService.Cargar(_doc);

                ConstruirArbol();
                ActualizarStatus();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error al cargar datos del modelo:\n{ex.Message}",
                    "SSA BIM Bridge", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        /// <summary>
        /// Construye el árbol a partir del ExtractionResult y ExportRuleSet actuales.
        /// Fusiona BimElement (cantidades) con ExportRule (configuración).
        /// </summary>
        private void ConstruirArbol()
        {
            _todasCategorias.Clear();

            if (_result?.Elementos == null) return;

            // Índice de reglas por TypeUniqueId
            var indiceReglas = _ruleSet.Reglas
                .ToDictionary(r => r.TypeUniqueId, r => r, StringComparer.OrdinalIgnoreCase);

            // Agrupar BimElements por Categoria → Familia
            var grupos = _result.Elementos
                .GroupBy(e => e.Categoria)
                .OrderBy(g => g.Key);

            foreach (var grupoCategoria in grupos)
            {
                var nodoCat = new NodoCategoriaVm { Nombre = grupoCategoria.Key };

                var subGrupos = grupoCategoria
                    .GroupBy(e => e.Familia)
                    .OrderBy(g => g.Key);

                foreach (var grupoFamilia in subGrupos)
                {
                    var nodoFam = new NodoFamiliaVm { Nombre = grupoFamilia.Key };

                    foreach (var elem in grupoFamilia.OrderBy(e => e.TipoRevit))
                    {
                        // Buscar o crear regla para este tipo
                        if (!indiceReglas.TryGetValue(elem.UniqueId, out var regla))
                        {
                            regla = new ExportRule
                            {
                                TypeUniqueId     = elem.UniqueId,
                                Categoria        = elem.Categoria,
                                Familia          = elem.Familia,
                                TipoRevit        = elem.TipoRevit,
                                Incluir          = true,
                                NombreItem       = elem.NombreNormalizado.Length > 0
                                                    ? elem.NombreNormalizado
                                                    : elem.TipoRevit,
                                CodigoPartida    = elem.CodigoPartida,
                                Unidad           = elem.UnidadPrincipal,
                                CriterioMedicion = elem.CriterioMedicion.Length > 0
                                                    ? elem.CriterioMedicion
                                                    : "AREA_NETA",
                                FactorDesperdicio = elem.FactorDesperdicio > 0
                                                    ? elem.FactorDesperdicio : 1.0,
                            };
                            _ruleSet.Reglas.Add(regla);
                            indiceReglas[regla.TypeUniqueId] = regla;
                        }
                        else
                        {
                            // Actualizar campos de identificación por si cambió el tipo
                            regla.Categoria = elem.Categoria;
                            regla.Familia   = elem.Familia;
                            regla.TipoRevit = elem.TipoRevit;
                        }

                        nodoFam.Tipos.Add(new NodoTipoVm(elem, regla));
                    }

                    if (nodoFam.Tipos.Count > 0)
                        nodoCat.Familias.Add(nodoFam);
                }

                if (nodoCat.Familias.Count > 0)
                    _todasCategorias.Add(nodoCat);
            }

            AplicarFiltroArbol();
        }

        // -----------------------------------------------------------------------
        // Filtro del árbol
        // -----------------------------------------------------------------------

        private void TxtFiltroArbol_TextChanged(object sender, TextChangedEventArgs e)
            => AplicarFiltroArbol();

        private void AplicarFiltroArbol()
        {
            string filtro = txtFiltroArbol?.Text?.Trim() ?? string.Empty;

            if (string.IsNullOrEmpty(filtro))
            {
                treeElementos.ItemsSource = _todasCategorias;
                ActualizarContadorArbol(_todasCategorias);
                return;
            }

            // Filtrar: solo mostrar tipos que coincidan
            var filtrado = new ObservableCollection<NodoCategoriaVm>();

            foreach (var cat in _todasCategorias)
            {
                var catFiltrada = new NodoCategoriaVm { Nombre = cat.Nombre };
                foreach (var fam in cat.Familias)
                {
                    var famFiltrada = new NodoFamiliaVm { Nombre = fam.Nombre };
                    foreach (var tipo in fam.Tipos)
                    {
                        if (tipo.TipoRevit.Contains(filtro, StringComparison.OrdinalIgnoreCase)
                         || tipo.Familia.Contains(filtro, StringComparison.OrdinalIgnoreCase)
                         || tipo.CodigoPartida.Contains(filtro, StringComparison.OrdinalIgnoreCase)
                         || tipo.NombreItem.Contains(filtro, StringComparison.OrdinalIgnoreCase))
                        {
                            famFiltrada.Tipos.Add(tipo);
                        }
                    }
                    if (famFiltrada.Tipos.Count > 0)
                        catFiltrada.Familias.Add(famFiltrada);
                }
                if (catFiltrada.Familias.Count > 0)
                    filtrado.Add(catFiltrada);
            }

            treeElementos.ItemsSource = filtrado;
            ActualizarContadorArbol(filtrado);
        }

        private void ActualizarContadorArbol(ObservableCollection<NodoCategoriaVm> lista)
        {
            int total = lista.Sum(c => c.TotalTipos);
            txtContadorArbol.Text = $" {total} tipos";
        }

        // -----------------------------------------------------------------------
        // Selección en el árbol → panel de detalle
        // -----------------------------------------------------------------------

        private void TreeElementos_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
        {
            if (e.NewValue is not NodoTipoVm tipo)
            {
                MostrarPanelVacio();
                return;
            }

            _tipoSeleccionado = tipo;
            MostrarDetalle(tipo);

            // Abrir/actualizar ventana de detalle automáticamente si ya estaba visible
            if (_ventanaDetalle?.IsVisible == true)
                AbrirVentanaDetalle(tipo);
        }

        private void BtnVerDetalle_Click(object sender, RoutedEventArgs e)
        {
            if (_tipoSeleccionado != null)
                AbrirVentanaDetalle(_tipoSeleccionado);
        }

        // -----------------------------------------------------------------------
        // Selección / resaltado en Revit
        // -----------------------------------------------------------------------

        private void BtnSeleccionar_Click(object sender, RoutedEventArgs e)
            => EnviarSeleccion(AccionResaltado.SeleccionarYZoom);

        private void BtnAislar_Click(object sender, RoutedEventArgs e)
            => EnviarSeleccion(AccionResaltado.AislarTemporalmente);

        private void BtnQuitarAislamiento_Click(object sender, RoutedEventArgs e)
        {
            if (_selHandler == null || _selEvent == null) return;
            _selHandler.ElementosIds.Clear();
            _selHandler.Accion = AccionResaltado.QuitarAislamiento;
            _selEvent.Raise();
        }

        private void EnviarSeleccion(AccionResaltado accion)
        {
            if (_selHandler == null || _selEvent == null || _tipoSeleccionado == null) return;

            var ids = _tipoSeleccionado.Elemento?.InstanciasElementIds;
            if (ids == null || ids.Count == 0)
            {
                txtStatus.Text = "⚠ No hay instancias registradas para este tipo.";
                return;
            }

            _selHandler.ElementosIds = ids.Select(i => new ElementId(i)).ToList();
            _selHandler.Accion       = accion;
            _selEvent.Raise();

            txtStatus.Text = $"⟳ Seleccionando {ids.Count} instancias en Revit...";
        }

        private void MostrarPanelVacio()
        {
            panelVacio.Visibility   = WpfVisibility.Visible;
            scrollDetalle.Visibility = WpfVisibility.Collapsed;
            _tipoSeleccionado       = null;
        }

        private void AbrirVentanaDetalle(NodoTipoVm tipo)
        {
            if (_ventanaDetalle == null)
            {
                _ventanaDetalle = new ElementoDetalleWindow();
                _ventanaDetalle.PartidasModificadas += _ => ExportRuleService.Guardar(_doc, _ruleSet);
                _ventanaDetalle.Closed += (s, e) => _ventanaDetalle = null;
            }
            _ventanaDetalle.MostrarTipo(tipo, this);
        }

        private void MostrarDetalle(NodoTipoVm tipo)
        {
            panelVacio.Visibility    = WpfVisibility.Collapsed;
            scrollDetalle.Visibility = WpfVisibility.Visible;

            _actualizandoUI = true;

            // Encabezado
            txtTipoNombre.Text = tipo.TipoRevit;
            txtTipoMeta.Text   = $"{tipo.Categoria}  ·  {tipo.Familia}  ·  {tipo.NumInstancias} instancias";

            // Cantidades
            txtAreaBrutaInt.Text = tipo.AreaBrutaInt > 0 ? $"{tipo.AreaBrutaInt:F2}" : "—";
            txtAreaHuecos.Text   = tipo.AreaHuecosDesc > 0 ? $"- {tipo.AreaHuecosDesc:F2}" : "0.00";
            txtAreaNetaInt.Text  = tipo.AreaNetaInt > 0 || tipo.AreaBrutaInt > 0
                                    ? $"{tipo.AreaNetaInt:F2}" : "—";

            lblVolumen.Visibility  = tipo.TieneVolumen  ? WpfVisibility.Visible : WpfVisibility.Collapsed;
            txtVolumen.Visibility  = tipo.TieneVolumen  ? WpfVisibility.Visible : WpfVisibility.Collapsed;
            lblVolumen.Parent      ?.GetType(); // touch to avoid null
            txtVolumen.Text  = $"{tipo.VolumenM3:F2}";

            lblLongitud.Visibility = tipo.TieneLongitud ? WpfVisibility.Visible : WpfVisibility.Collapsed;
            txtLongitud.Visibility = tipo.TieneLongitud ? WpfVisibility.Visible : WpfVisibility.Collapsed;
            txtLongitud.Text = $"{tipo.LongitudML:F2}";

            // Configuración BOQ
            chkIncluir.IsChecked    = tipo.Incluir;
            txtCodigo.Text          = tipo.CodigoPartida;
            txtNombreItem.Text      = tipo.NombreItem;
            txtRubro.Text           = tipo.Rubro;
            txtFactor.Text          = tipo.FactorDesperdicio.ToString("F2");
            txtObservacion.Text     = tipo.Observacion;

            // Unidad: seleccionar el item que coincida o setear texto
            SeleccionarComboItem(cmbUnidad, tipo.Unidad);

            // Criterio
            SeleccionarComboItem(cmbCriterio, tipo.CriterioMedicion);

            // Derivados
            bool tieneDerivados = tipo.TieneDerivados;
            borderDerivados.Visibility = tieneDerivados ? WpfVisibility.Visible  : WpfVisibility.Collapsed;
            gridDerivados.Visibility   = tieneDerivados ? WpfVisibility.Visible  : WpfVisibility.Collapsed;

            if (tieneDerivados)
            {
                gridDerivados.ItemsSource = null;
                gridDerivados.ItemsSource = tipo.Derivados;
            }

            _actualizandoUI = false;
        }

        // -----------------------------------------------------------------------
        // Eventos de edición en el panel de detalle → actualizar NodoTipoVm
        // -----------------------------------------------------------------------

        private void CampoBOQ_Changed(object sender, RoutedEventArgs e)
        {
            if (_actualizandoUI || _tipoSeleccionado == null) return;
            GuardarCamposBOQ(_tipoSeleccionado);
        }

        private void CampoBOQ_Changed(object sender, SelectionChangedEventArgs e)
        {
            if (_actualizandoUI || _tipoSeleccionado == null) return;
            GuardarCamposBOQ(_tipoSeleccionado);
        }

        private void GuardarCamposBOQ(NodoTipoVm tipo)
        {
            tipo.Incluir = chkIncluir.IsChecked == true;
            tipo.CodigoPartida     = txtCodigo.Text.Trim();
            tipo.NombreItem        = txtNombreItem.Text.Trim();
            tipo.Rubro             = txtRubro.Text.Trim();
            tipo.Observacion       = txtObservacion.Text.Trim();

            if (double.TryParse(txtFactor.Text.Replace(',', '.'),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out double f) && f > 0)
                tipo.FactorDesperdicio = f;

            // Unidad: texto del ComboBox (puede ser editable)
            tipo.Unidad = (cmbUnidad.SelectedItem as ComboBoxItem)?.Content?.ToString()
                       ?? cmbUnidad.Text?.Trim() ?? string.Empty;

            // Criterio
            tipo.CriterioMedicion = (cmbCriterio.SelectedItem as ComboBoxItem)?.Content?.ToString()
                                  ?? tipo.CriterioMedicion;

            ActualizarStatus();
        }

        // -----------------------------------------------------------------------
        // Botón Actualizar → ExternalEvent
        // -----------------------------------------------------------------------

        private void BtnRefresh_Click(object sender, RoutedEventArgs e)
        {
            btnRefresh.IsEnabled = false;
            btnRefresh.Content   = "⟳  Actualizando...";
            _extEvent.Raise();
        }

        /// <summary>Callback llamado por RefreshBOQHandler cuando termina la extracción.</summary>
        private void ActualizarConResultado(ExtractionResult result)
        {
            _result = result;
            ConstruirArbol();
            ActualizarStatus();
            btnRefresh.IsEnabled = true;
            btnRefresh.Content   = "⟳  Actualizar Modelo";
        }

        // -----------------------------------------------------------------------
        // Guardar reglas
        // -----------------------------------------------------------------------

        private void BtnGuardar_Click(object sender, RoutedEventArgs e)
        {
            if (_tipoSeleccionado != null)
                GuardarCamposBOQ(_tipoSeleccionado);

            SincronizarReglasDesdeArbol();
            ExportRuleService.Guardar(_doc, _ruleSet);
            txtStatus.Text = $"✓ Reglas guardadas — {DateTime.Now:HH:mm:ss}";
        }

        // -----------------------------------------------------------------------
        // Exportar Excel / CSV
        // -----------------------------------------------------------------------

        private void BtnExportarExcel_Click(object sender, RoutedEventArgs e)
        {
            if (_result == null) { MsgSinDatos(); return; }

            MessageBox.Show(
                "La exportación Excel se realiza desde ConstructionOS web.\n\n" +
                "Use 'Exportar BIM' para enviar los datos al servidor\n" +
                "y luego exporte desde el panel de proyecto.",
                "Exportar", MessageBoxButton.OK, MessageBoxImage.Information);
            txtStatus.Text = "Exportación disponible en ConstructionOS web";
        }

        private void BtnExportarCsv_Click(object sender, RoutedEventArgs e)
        {
            if (_result == null) { MsgSinDatos(); return; }

            MessageBox.Show(
                "La exportación CSV se realiza desde ConstructionOS web.\n\n" +
                "Use 'Exportar BIM' para enviar los datos al servidor\n" +
                "y luego exporte desde el panel de proyecto.",
                "Exportar", MessageBoxButton.OK, MessageBoxImage.Information);
            txtStatus.Text = "Exportación disponible en ConstructionOS web";
        }

        // -----------------------------------------------------------------------
        // Catálogo de partidas + Plantillas
        // -----------------------------------------------------------------------

        private void BtnImportarCatalogo_Click(object sender, RoutedEventArgs e)
        {
            MessageBox.Show(
                "El catálogo de partidas se gestiona desde ConstructionOS web.\n\n" +
                "Importe catálogos desde el módulo Catálogo en el dashboard.",
                "Importar Catálogo", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void BtnExportarCatalogo_Click(object sender, RoutedEventArgs e)
        {
            MessageBox.Show(
                "La exportación de plantillas se realiza desde ConstructionOS web.\n\n" +
                "Use el módulo Catálogo en el dashboard para exportar.",
                "Exportar Plantilla", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void BtnAplicarPlantilla_Click(object sender, RoutedEventArgs e)
        {
            MessageBox.Show(
                "Las plantillas de partidas se gestionan desde ConstructionOS web.\n\n" +
                "Use 'Match BIM' para aplicar mapeos automáticos\n" +
                "basados en las reglas configuradas en el servidor.",
                "Plantillas", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        // -----------------------------------------------------------------------
        // Helpers
        // -----------------------------------------------------------------------

        /// <summary>
        /// Recorre el árbol y sincroniza todas las reglas al ExportRuleSet
        /// (por si el usuario editó varios tipos sin guardar).
        /// </summary>
        private void SincronizarReglasDesdeArbol()
        {
            foreach (var cat in _todasCategorias)
                foreach (var fam in cat.Familias)
                    foreach (var tipo in fam.Tipos)
                    {
                        var regla = tipo.ObtenerRegla();
                        // La regla ya es la misma instancia referenciada en _ruleSet.Reglas
                        // así que no hay que hacer nada extra — los cambios ya están reflejados
                        _ = regla;
                    }
        }

        /// <summary>
        /// Aplica las reglas al ExtractionResult:
        /// - Filtra elementos con Incluir=false
        /// - Sobreescribe CodigoPartida y NombreNormalizado con los valores de la regla
        /// </summary>
        private ExtractionResult AplicarReglasAlResultado(ExtractionResult original)
        {
            var indiceReglas = _ruleSet.Reglas
                .ToDictionary(r => r.TypeUniqueId, r => r, StringComparer.OrdinalIgnoreCase);

            var elementosFiltrados = new List<BimElement>();
            foreach (var elem in original.Elementos)
            {
                if (!indiceReglas.TryGetValue(elem.UniqueId, out var regla))
                {
                    elementosFiltrados.Add(elem);
                    continue;
                }
                if (!regla.Incluir) continue;

                // Clonar y sobreescribir campos de nomenclatura
                var copia = ShallowCopyElement(elem);
                if (!string.IsNullOrWhiteSpace(regla.CodigoPartida))
                    copia.CodigoPartida = regla.CodigoPartida;
                if (!string.IsNullOrWhiteSpace(regla.NombreItem))
                    copia.NombreNormalizado = regla.NombreItem;
                if (!string.IsNullOrWhiteSpace(regla.CriterioMedicion))
                    copia.CriterioMedicion = regla.CriterioMedicion;
                if (regla.FactorDesperdicio > 0)
                    copia.FactorDesperdicio = regla.FactorDesperdicio;

                elementosFiltrados.Add(copia);
            }

            return new ExtractionResult
            {
                Elementos        = elementosFiltrados,
                Aberturas        = original.Aberturas,
                TotalInstancias  = original.TotalInstancias,
                ExcluidosSinParams = original.ExcluidosSinParams,
                ExcluidosPorFlag = original.ExcluidosPorFlag,
                Advertencias     = original.Advertencias,
            };
        }

        private static BimElement ShallowCopyElement(BimElement src) => new BimElement
        {
            RevitTypeId           = src.RevitTypeId,
            UniqueId              = src.UniqueId,
            Categoria             = src.Categoria,
            Familia               = src.Familia,
            TipoRevit             = src.TipoRevit,
            Nivel                 = src.Nivel,
            CantInstancias        = src.CantInstancias,
            GuidIntegracion       = src.GuidIntegracion,
            CodigoPartida         = src.CodigoPartida,
            NombreNormalizado     = src.NombreNormalizado,
            CriterioMedicion      = src.CriterioMedicion,
            IncluirComputo        = src.IncluirComputo,
            FactorDesperdicio     = src.FactorDesperdicio,
            ObservacionRevit      = src.ObservacionRevit,
            AcabadoInterior       = src.AcabadoInterior,
            AcabadoExterior       = src.AcabadoExterior,
            RevEspInt             = src.RevEspInt,
            RevEspExt             = src.RevEspExt,
            PinturaTipoInt        = src.PinturaTipoInt,
            PinturaTipoExt        = src.PinturaTipoExt,
            CeramicaAltura        = src.CeramicaAltura,
            ConsiderarDintel      = src.ConsiderarDintel,
            ConsiderarRasgo       = src.ConsiderarRasgo,
            ConsiderarBuna        = src.ConsiderarBuna,
            AreaBrutaIntM2        = src.AreaBrutaIntM2,
            AreaBrutaExtM2        = src.AreaBrutaExtM2,
            AreaHuecosM2          = src.AreaHuecosM2,
            AreaHuecosDescontadosM2 = src.AreaHuecosDescontadosM2,
            VolumenM3             = src.VolumenM3,
            LongitudML            = src.LongitudML,
            AlturaPromedio        = src.AlturaPromedio,
            EspesorM              = src.EspesorM,
            Cantidad              = src.Cantidad,
            PartidasDerivadas     = src.PartidasDerivadas,
            Origen                = src.Origen,
            EstadoValidacion      = src.EstadoValidacion,
            MensajesValidacion    = src.MensajesValidacion,
        };

        private void ActualizarStatus()
        {
            int total     = _todasCategorias.Sum(c => c.TotalTipos);
            int incluidos = _todasCategorias.Sum(c => c.TotalIncluidos);
            int conCodigo = _todasCategorias
                .SelectMany(c => c.Familias)
                .SelectMany(f => f.Tipos)
                .Count(t => !string.IsNullOrWhiteSpace(t.CodigoPartida));

            txtStatus.Text =
                $"{total} tipos  |  {incluidos} incluidos  |  {conCodigo} con código";
        }

        private static void SeleccionarComboItem(WpfComboBox combo, string valor)
        {
            if (string.IsNullOrEmpty(valor)) return;
            foreach (WpfComboBoxItem item in combo.Items)
            {
                if (item.Content?.ToString() == valor)
                {
                    combo.SelectedItem = item;
                    return;
                }
            }
            // No encontrado: setear como texto editable
            combo.Text = valor;
        }

        private static void MsgSinDatos() =>
            MessageBox.Show("No hay datos del modelo cargados. Use 'Actualizar Modelo' primero.",
                "Sin datos", MessageBoxButton.OK, MessageBoxImage.Information);
    }
}
