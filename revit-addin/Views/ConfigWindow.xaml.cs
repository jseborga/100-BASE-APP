// Views/ConfigWindow.xaml.cs
// Code-behind para la ventana de configuración de ConstructionOS.
// Auto-carga proyectos si ya hay credenciales guardadas.
// Autor: SSA Ingenieria SRL

using System.Windows;
using RvtConstructionOS.Models;
using RvtConstructionOS.Services;

namespace RvtConstructionOS.Views
{
    public partial class ConfigWindow : Window
    {
        private AppConfig _config;
        private List<ProjectSummary> _proyectos = new();

        public ConfigWindow()
        {
            InitializeComponent();
            _config = AppConfig.Load();

            // Poblar campos desde config guardada
            txtUrl.Text = _config.Url;
            txtApiKey.Password = _config.ApiKey;

            MostrarProyectoActivo();
        }

        /// <summary>
        /// Al abrir la ventana, auto-cargar proyectos si ya hay credenciales.
        /// </summary>
        private async void Window_Loaded(object sender, RoutedEventArgs e)
        {
            if (_config.IsValid)
            {
                await CargarProyectosAsync();
            }
        }

        private void MostrarProyectoActivo()
        {
            if (_config.HasProject)
            {
                pnlProyectoInfo.Visibility = Visibility.Visible;
                txtProyectoInfo.Text = _config.ProyectoNombre;
                txtProyectoDetalle.Text = $"ID: {_config.ProyectoId.Substring(0, 8)}... · Guardado";
            }
            else
            {
                pnlProyectoInfo.Visibility = Visibility.Collapsed;
            }
        }

        private async Task CargarProyectosAsync()
        {
            string url = txtUrl.Text.Trim();
            string apiKey = txtApiKey.Password.Trim();

            if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(apiKey))
            {
                txtEstado.Text = "Ingrese URL y API Key primero.";
                txtEstado.Foreground = System.Windows.Media.Brushes.Red;
                return;
            }

            try
            {
                btnCargarProyectos.IsEnabled = false;
                txtEstado.Text = "Cargando proyectos...";
                txtEstado.Foreground = System.Windows.Media.Brushes.Gray;

                var tempConfig = new AppConfig { Url = url, ApiKey = apiKey };
                var service = new ConstructionOSService(tempConfig);
                var result = await service.ListProjectsAsync(estado: "activo", limit: 100);

                _proyectos = result.Projects;
                cmbProyectos.ItemsSource = _proyectos;
                cmbProyectos.IsEnabled = true;

                // Select current project if it's in the list
                if (_config.HasProject)
                {
                    var current = _proyectos.FindIndex(p => p.Id == _config.ProyectoId);
                    if (current >= 0) cmbProyectos.SelectedIndex = current;
                }

                txtEstado.Text = $"{_proyectos.Count} proyecto(s) activo(s) encontrados.";
                txtEstado.Foreground = System.Windows.Media.Brushes.Green;
            }
            catch (Exception ex)
            {
                txtEstado.Text = $"Error al cargar proyectos: {ex.Message}";
                txtEstado.Foreground = System.Windows.Media.Brushes.Red;
            }
            finally
            {
                btnCargarProyectos.IsEnabled = true;
            }
        }

        private async void BtnCargarProyectos_Click(object sender, RoutedEventArgs e)
        {
            await CargarProyectosAsync();
        }

        private async void BtnProbar_Click(object sender, RoutedEventArgs e)
        {
            string url = txtUrl.Text.Trim();
            string apiKey = txtApiKey.Password.Trim();

            if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(apiKey))
            {
                txtEstado.Text = "Ingrese URL y API Key.";
                txtEstado.Foreground = System.Windows.Media.Brushes.Red;
                return;
            }

            try
            {
                btnProbar.IsEnabled = false;
                txtEstado.Text = "Probando conexión...";
                txtEstado.Foreground = System.Windows.Media.Brushes.Gray;

                var tempConfig = new AppConfig { Url = url, ApiKey = apiKey };
                var service = new ConstructionOSService(tempConfig);
                string resultado = await service.TestConnectionAsync();

                string proyectoInfo = _config.HasProject
                    ? $"\nProyecto activo: {_config.ProyectoNombre}"
                    : "\n⚠ Sin proyecto seleccionado";

                txtEstado.Text = $"✓ {resultado}{proyectoInfo}";
                txtEstado.Foreground = System.Windows.Media.Brushes.Green;
            }
            catch (Exception ex)
            {
                txtEstado.Text = $"Error: {ex.Message}";
                txtEstado.Foreground = System.Windows.Media.Brushes.Red;
            }
            finally
            {
                btnProbar.IsEnabled = true;
            }
        }

        private void BtnGuardar_Click(object sender, RoutedEventArgs e)
        {
            _config.Url = txtUrl.Text.Trim();
            _config.ApiKey = txtApiKey.Password.Trim();

            if (cmbProyectos.SelectedItem is ProjectSummary proyecto)
            {
                _config.ProyectoId = proyecto.Id;
                _config.ProyectoNombre = proyecto.Nombre;
            }

            _config.Save();

            MostrarProyectoActivo();
            txtEstado.Text = "✓ Configuración guardada correctamente.";
            txtEstado.Foreground = System.Windows.Media.Brushes.Green;
        }

        private void BtnCancelar_Click(object sender, RoutedEventArgs e)
        {
            Close();
        }
    }
}
