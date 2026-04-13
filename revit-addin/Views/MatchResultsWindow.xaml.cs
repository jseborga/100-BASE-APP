// Views/MatchResultsWindow.xaml.cs
// Muestra los resultados del matching BIM en un DataGrid.
// Permite confirmar y crear partidas en el proyecto.
// Autor: SSA Ingenieria SRL

using System.Windows;
using RvtConstructionOS.Models;
using RvtConstructionOS.Services;

namespace RvtConstructionOS.Views
{
    public partial class MatchResultsWindow : Window
    {
        private readonly List<BimElementDto> _elements;
        private readonly string _importacionId;
        private readonly ConstructionOSService _service;

        public MatchResultsWindow(
            List<BimElementDto> elements,
            string importacionId,
            ConstructionOSService service)
        {
            InitializeComponent();
            _elements = elements;
            _importacionId = importacionId;
            _service = service;

            LoadData();
        }

        private void LoadData()
        {
            var rows = _elements.Select(e => new MatchResultRow
            {
                Id = e.Id,
                CategoriaName = e.RevitCategoria?.NombreEs ?? e.RevitCategoria?.Nombre ?? "—",
                Familia = e.Familia ?? "—",
                Tipo = e.Tipo ?? "—",
                PartidaName = e.Partida?.Nombre ?? "Sin partida",
                PartidaUnidad = e.Partida?.Unidad ?? "—",
                MetradoCalculado = e.MetradoCalculado ?? 0,
                Estado = e.Estado,
            }).ToList();

            dgResults.ItemsSource = rows;

            int mapeados = rows.Count(r => r.Estado == "mapeado");
            int errores = rows.Count(r => r.Estado == "error");
            txtResumen.Text = $"{rows.Count} elementos — {mapeados} mapeados, {errores} sin match";
        }

        private async void BtnConfirmar_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                btnConfirmar.IsEnabled = false;
                btnConfirmar.Content = "Confirmando...";

                var result = await _service.ConfirmBimMatchAsync(_importacionId);

                MessageBox.Show(
                    $"{result.Message}\n\n" +
                    $"Partidas creadas: {result.Created}\n" +
                    $"Partidas actualizadas: {result.Updated}\n" +
                    $"Total: {result.TotalPartidas}",
                    "Match BIM — Confirmado",
                    MessageBoxButton.OK,
                    MessageBoxImage.Information);

                Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    $"Error al confirmar:\n{ex.Message}",
                    "Error",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
                btnConfirmar.IsEnabled = true;
                btnConfirmar.Content = "Confirmar y crear partidas";
            }
        }

        private void BtnCerrar_Click(object sender, RoutedEventArgs e)
        {
            Close();
        }
    }

    /// <summary>Row model for the DataGrid.</summary>
    public class MatchResultRow
    {
        public string Id { get; set; } = string.Empty;
        public string CategoriaName { get; set; } = string.Empty;
        public string Familia { get; set; } = string.Empty;
        public string Tipo { get; set; } = string.Empty;
        public string PartidaName { get; set; } = string.Empty;
        public string PartidaUnidad { get; set; } = string.Empty;
        public decimal MetradoCalculado { get; set; }
        public string Estado { get; set; } = string.Empty;
    }
}
