// ViewModels/BoqTreeVm.cs
// ViewModels para la ventana flotante de cómputos BOQ.
// Estructura: NodoCategoriaVm → NodoFamiliaVm → NodoTipoVm → NodoDerivadoVm
//
// NodoTipoVm combina BimElement (cantidades del modelo) + ExportRule (config del usuario).
// NodoDerivadoVm envuelve PartidaDerivada con campos editables por el usuario.
//
// Autor: SSA Ingenieria SRL

using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using RvtConstructionOS.Models;

namespace RvtConstructionOS.ViewModels
{
    // ============================================================
    // NODO CATEGORÍA  (Muros, Puertas, Ventanas, ...)
    // ============================================================

    public class NodoCategoriaVm
    {
        public string Nombre { get; set; } = string.Empty;
        public ObservableCollection<NodoFamiliaVm> Familias { get; } = new();

        public int TotalTipos     => Familias.Sum(f => f.Tipos.Count);
        public int TotalIncluidos => Familias.Sum(f => f.Tipos.Count(t => t.Incluir));
        public string Resumen     => $"{Nombre}  ({TotalTipos} tipos)";
    }

    // ============================================================
    // NODO FAMILIA  (Muro Básico, Puerta Simple, ...)
    // ============================================================

    public class NodoFamiliaVm
    {
        public string Nombre { get; set; } = string.Empty;
        public ObservableCollection<NodoTipoVm> Tipos { get; } = new();
    }

    // ============================================================
    // NODO TIPO  (el nodo hoja — un ElementType específico)
    // ============================================================

    /// <summary>
    /// Representa un ElementType del modelo Revit.
    /// Combina las cantidades calculadas (BimElement) con la configuración BOQ (ExportRule).
    /// Implementa INotifyPropertyChanged para binding bidireccional desde el panel de detalle.
    /// </summary>
    public class NodoTipoVm : INotifyPropertyChanged
    {
        private readonly ExportRule _regla;

        public NodoTipoVm(BimElement? elemento, ExportRule regla)
        {
            Elemento = elemento;
            _regla   = regla;

            // Construir derivados desde el BimElement
            if (elemento?.PartidasDerivadas != null)
            {
                foreach (var pd in elemento.PartidasDerivadas)
                    Derivados.Add(new NodoDerivadoVm(pd));
            }
        }

        // -----------------------------------------------------------------------
        // Datos del modelo (readonly — viene de RevitExtractionService)
        // -----------------------------------------------------------------------

        public BimElement? Elemento { get; }

        /// <summary>Cantidad principal según criterio de medición del tipo.</summary>
        public double CantidadPrincipal => Elemento?.CantidadPrincipal ?? 0;

        /// <summary>Unidad principal según criterio.</summary>
        public string UnidadPrincipal => Elemento?.UnidadPrincipal
            ?? (_regla.Unidad.Length > 0 ? _regla.Unidad : "und");

        /// <summary>Resumen corto para mostrar en el árbol junto al nombre del tipo.</summary>
        public string ResumenArbol => Elemento != null
            ? $"{CantidadPrincipal:F2} {UnidadPrincipal}"
            : "";

        // Desglose de cantidades (para el panel de detalle)
        public double AreaBrutaInt       => Elemento?.AreaBrutaIntM2         ?? 0;
        public double AreaBrutaExt       => Elemento?.AreaBrutaExtM2         ?? 0;
        public double AreaHuecosTotal    => Elemento?.AreaHuecosM2           ?? 0;
        public double AreaHuecosDesc     => Elemento?.AreaHuecosDescontadosM2 ?? 0;
        public double AreaHuecosNoDes    => Elemento?.AreaHuecosNoDescontadosM2 ?? 0;
        public double AreaNetaInt        => Elemento?.AreaNetaIntM2          ?? 0;
        public double AreaNetaExt        => Elemento?.AreaNetaExtM2          ?? 0;
        public double VolumenM3          => Elemento?.VolumenM3              ?? 0;
        public double LongitudML         => Elemento?.LongitudML             ?? 0;
        public int    NumInstancias      => Elemento?.CantInstancias         ?? 0;

        public bool TieneAreaInfo     => AreaBrutaInt > 0 || AreaBrutaExt > 0;
        public bool TieneVolumen      => VolumenM3 > 0;
        public bool TieneLongitud     => LongitudML > 0;
        public bool TieneDerivados    => Derivados.Count > 0;

        // -----------------------------------------------------------------------
        // Derivados (calculados por RevitExtractionService)
        // -----------------------------------------------------------------------

        public ObservableCollection<NodoDerivadoVm> Derivados { get; } = new();

        // -----------------------------------------------------------------------
        // Campos editables de configuración BOQ (delegados a ExportRule)
        // -----------------------------------------------------------------------

        public string TipoRevit  => _regla.TipoRevit;
        public string Categoria  => _regla.Categoria;
        public string Familia    => _regla.Familia;

        public bool Incluir
        {
            get => _regla.Incluir;
            set { _regla.Incluir = value; OnPropertyChanged(); OnPropertyChanged(nameof(ResumenArbol)); }
        }

        public string CodigoPartida
        {
            get => _regla.CodigoPartida;
            set { _regla.CodigoPartida = value; OnPropertyChanged(); }
        }

        public string NombreItem
        {
            get => _regla.NombreItem;
            set { _regla.NombreItem = value; OnPropertyChanged(); }
        }

        public string Rubro
        {
            get => _regla.Rubro;
            set { _regla.Rubro = value; OnPropertyChanged(); }
        }

        public string Unidad
        {
            get => _regla.Unidad;
            set { _regla.Unidad = value; OnPropertyChanged(); }
        }

        public string CriterioMedicion
        {
            get => _regla.CriterioMedicion;
            set
            {
                _regla.CriterioMedicion = value;
                // Sincronizar al BimElement para recalcular CantidadPrincipal en vivo
                if (Elemento != null)
                    Elemento.CriterioMedicion = value;
                OnPropertyChanged();
                // Notificar las propiedades que dependen del criterio
                OnPropertyChanged(nameof(CantidadPrincipal));
                OnPropertyChanged(nameof(UnidadPrincipal));
                OnPropertyChanged(nameof(ResumenArbol));
            }
        }

        public double FactorDesperdicio
        {
            get => _regla.FactorDesperdicio;
            set
            {
                if (value > 0)
                {
                    _regla.FactorDesperdicio = value;
                    // Sync al BimElement para recalcular CantidadConDesperdicio
                    if (Elemento != null)
                        Elemento.FactorDesperdicio = value;
                    OnPropertyChanged();
                    OnPropertyChanged(nameof(CantidadPrincipal));
                    OnPropertyChanged(nameof(ResumenArbol));
                }
            }
        }

        public string Observacion
        {
            get => _regla.Observacion;
            set { _regla.Observacion = value; OnPropertyChanged(); }
        }

        /// <summary>Acceso a la regla subyacente para persistencia.</summary>
        public ExportRule ObtenerRegla() => _regla;

        // -----------------------------------------------------------------------
        // INotifyPropertyChanged
        // -----------------------------------------------------------------------

        public event PropertyChangedEventHandler? PropertyChanged;
        protected void OnPropertyChanged([CallerMemberName] string? name = null)
            => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    }

    // ============================================================
    // NODO DERIVADO  (Revoque Int, Pintura Ext, Zócalo, ...)
    // ============================================================

    /// <summary>
    /// Envuelve una PartidaDerivada con campos editables de configuración BOQ.
    /// Permite al usuario asignar código y nombre a cada partida derivada.
    /// </summary>
    public class NodoDerivadoVm : INotifyPropertyChanged
    {
        private bool   _incluir = true;
        private string _codigoPartida;
        private string _nombreItem;

        public NodoDerivadoVm(PartidaDerivada partida)
        {
            Partida        = partida;
            _codigoPartida = partida.CodigoPartida;
            _nombreItem    = partida.Descripcion;
        }

        public PartidaDerivada Partida { get; }

        // Datos del modelo (readonly)
        public string TipoDisplay    => Partida.Tipo.ToString().Replace("_", " ");
        public string Cara           => Partida.Cara;
        public double Cantidad       => Math.Round(Partida.Cantidad, 2);
        public string Unidad         => Partida.Unidad;
        public string ResumenCant    => $"{Cantidad:F2} {Unidad}";
        public string Observacion    => Partida.Observacion;

        // Campos editables
        public bool Incluir
        {
            get => _incluir;
            set { _incluir = value; OnPropertyChanged(); }
        }

        public string CodigoPartida
        {
            get => _codigoPartida;
            set
            {
                _codigoPartida          = value;
                Partida.CodigoPartida   = value;
                OnPropertyChanged();
            }
        }

        public string NombreItem
        {
            get => _nombreItem;
            set
            {
                _nombreItem          = value;
                Partida.Descripcion  = value;
                OnPropertyChanged();
            }
        }

        // INotifyPropertyChanged
        public event PropertyChangedEventHandler? PropertyChanged;
        protected void OnPropertyChanged([CallerMemberName] string? name = null)
            => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    }
}
