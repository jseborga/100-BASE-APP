// Models/BimElement.cs
// Modelo de elemento BIM para el BOQ (Bill of Quantities) del SSA BIM BOQ Bridge.
// Representa un TIPO de elemento Revit con sus cantidades calculadas (directas y derivadas),
// parámetros SSA_* leídos del modelo, y metadatos de sincronización.
// Autor: SSA Ingenieria SRL

namespace RvtConstructionOS.Models
{
    /// <summary>
    /// Origen de la partida según el SRS del SSA BIM BOQ Bridge.
    /// </summary>
    public enum OrigenPartida
    {
        BIM_DIRECTO,   // Sale directamente del modelo Revit
        BIM_DERIVADO,  // Calculado por reglas sobre el modelo (pintura, revoque, etc.)
        ERP_MANUAL     // Solo en Odoo, no viene de Revit
    }

    /// <summary>
    /// Estado de validación del elemento para ser incluido en el BOQ.
    /// </summary>
    public enum EstadoValidacion
    {
        OK,
        ADVERTENCIA,   // Falta algún dato recomendado pero puede exportarse
        ERROR,         // Falta dato obligatorio, no puede exportarse
        EXCLUIDO       // SSA_INCLUIR_COMPUTO = false
    }

    // ============================================================
    // MODELO PRINCIPAL
    // ============================================================

    /// <summary>
    /// Representa un TIPO de elemento Revit con todos sus cómputos BOQ.
    /// Agrupa todas las instancias del mismo tipo y consolida sus cantidades.
    /// Incluye tanto partidas directas (del modelo) como derivadas (por reglas).
    /// </summary>
    public class BimElement
    {
        // -----------------------------------------------------------------------
        // Identidad del tipo en Revit
        // -----------------------------------------------------------------------

        public int    RevitTypeId  { get; set; }
        public string UniqueId     { get; set; } = string.Empty;  // ElementType.UniqueId
        public string Categoria    { get; set; } = string.Empty;
        public string Familia      { get; set; } = string.Empty;
        public string TipoRevit    { get; set; } = string.Empty;
        public string Nivel        { get; set; } = string.Empty;  // Nivel predominante
        public int    CantInstancias { get; set; }                 // Nº de instancias del tipo

        /// <summary>
        /// IDs enteros de las instancias Revit de este tipo (para selección en vista).
        /// Poblado durante la extracción; no se serializa a JSON (solo en memoria).
        /// </summary>
        [System.Text.Json.Serialization.JsonIgnore]
        public List<int> InstanciasElementIds { get; set; } = new();

        /// <summary>
        /// Función del elemento según la API de Revit.
        /// Muros: "Interior" | "Exterior" | "Foundation" | "Retaining" | "Soffit" | "CoreShaft".
        /// Otros elementos: vacío por ahora.
        /// Usado por el motor de homologación (Nivel 3+).
        /// </summary>
        public string FuncionElemento { get; set; } = string.Empty;

        /// <summary>
        /// Nombre del Room/Space al que pertenece el elemento (futuro: § 12 SRS).
        /// Ejemplo: "Baño principal", "Cocina", "Dormitorio 1".
        /// Actualmente vacío — se populará en Sprint 3 con extracción de Rooms.
        /// Usado por el motor de homologación (Nivel 4).
        /// </summary>
        public string AmbienteNombre { get; set; } = string.Empty;

        // -----------------------------------------------------------------------
        // Parámetros nativos de Revit — clasificación WBS / Odoo
        // -----------------------------------------------------------------------

        /// <summary>
        /// Keynote del tipo (parámetro nativo KEYNOTE_PARAM).
        /// Se usa como <c>default_code</c> (Referencia Interna) en Odoo.
        /// Si está vacío el plugin usa CodigoPartida como fallback.
        /// Ejemplo: "H-21-LOSA", "M-LAD-01".
        /// </summary>
        public string KeynoteCode   { get; set; } = string.Empty;

        /// <summary>
        /// Assembly Code / Uniformat Code del tipo (parámetro nativo UNIFORMAT_CODE).
        /// Se usa para deducir el Rubro de Odoo (product.category) cuando
        /// SSA_COD_RUBRO_ODOO no está asignado.
        /// Ejemplo: "B2010" (Exterior Walls), "C1010" (Partitions).
        /// </summary>
        public string AssemblyCode  { get; set; } = string.Empty;

        /// <summary>
        /// Rubro / Capítulo para Odoo (WBS Nivel 1 → product.category).
        /// Fuente prioritaria: parámetro compartido SSA_COD_RUBRO_ODOO.
        /// Fallback: deducido automáticamente desde AssemblyCode.
        /// Ejemplo: "Obra Gruesa / Hormigón Armado", "Obra Fina / Muros".
        /// </summary>
        public string RubroOdoo     { get; set; } = string.Empty;

        /// <summary>Fase de construcción de las instancias del tipo.</summary>
        public string FaseNombre    { get; set; } = string.Empty;

        // -----------------------------------------------------------------------
        // Parámetros SSA_* (leídos del tipo via shared parameters)
        // -----------------------------------------------------------------------

        public string GuidIntegracion    { get; set; } = string.Empty;
        public string CodigoPartida      { get; set; } = string.Empty;
        public string SubPartida         { get; set; } = string.Empty;
        public string NombreNormalizado  { get; set; } = string.Empty;
        public string CriterioMedicion   { get; set; } = string.Empty; // AREA_NETA/VOLUMEN/LONGITUD/UNIDAD
        public bool   IncluirComputo     { get; set; } = true;
        public double FactorDesperdicio  { get; set; } = 1.0;
        public string ObservacionRevit   { get; set; } = string.Empty;

        // Parámetros específicos de muros
        public string AcabadoInterior    { get; set; } = string.Empty;
        public string AcabadoExterior    { get; set; } = string.Empty;
        public double RevEspInt          { get; set; }  // Espesor revoque interior (m)
        public double RevEspExt          { get; set; }  // Espesor revoque exterior (m)
        public string PinturaTipoInt     { get; set; } = string.Empty;
        public string PinturaTipoExt     { get; set; } = string.Empty;
        public double CeramicaAltura     { get; set; }  // Altura enchape (m)
        public bool   ConsiderarDintel   { get; set; }
        public bool   ConsiderarRasgo    { get; set; }
        public bool   ConsiderarBuna     { get; set; }

        // -----------------------------------------------------------------------
        // Cantidades brutas del modelo (conversión imperial → métrico)
        // -----------------------------------------------------------------------

        public double AreaBrutaIntM2     { get; set; }  // Área cara interior sin descontar huecos
        public double AreaBrutaExtM2     { get; set; }  // Área cara exterior sin descontar huecos
        public double AreaHuecosM2       { get; set; }  // Suma de áreas de puertas y ventanas
        public double VolumenM3          { get; set; }
        public double LongitudML         { get; set; }
        public double AlturaPromedio     { get; set; }  // Altura promedio de instancias
        public double EspesorM           { get; set; }  // Espesor del muro en metros
        public int    Cantidad           { get; set; }  // Para puertas, ventanas, elementos por unidad

        // -----------------------------------------------------------------------
        // Parámetros de sección estructural (acero / perfiles laminados)
        // -----------------------------------------------------------------------

        /// <summary>
        /// Designación del perfil estructural (p.ej. "HEB 200", "IPE 300", "2L75x75x6", "Tubo 100x4").
        /// Se lee del parámetro compartido SSA_SECCION o del nombre del tipo Revit.
        /// </summary>
        public string SeccionTransversal { get; set; } = string.Empty;

        /// <summary>
        /// Peso lineal del perfil en kg/m.
        /// Resuelto desde la tabla built-in de perfiles (PerfilesSteelTable) o SSA_PESO_LINEAL_KG.
        /// </summary>
        public double PesoLinealKgM      { get; set; }

        /// <summary>
        /// Peso total del elemento = PesoLinealKgM × LongitudML.
        /// Calculado automáticamente.
        /// </summary>
        public double PesoTotalKg        => Math.Round(PesoLinealKgM * LongitudML, 2);

        // -----------------------------------------------------------------------
        // Cantidades netas calculadas (después de descontar huecos)
        // -----------------------------------------------------------------------

        /// <summary>
        /// Área neta cara interior = AreaBrutaIntM2 - AreaHuecosM2 (huecos > umbral).
        /// Es la cantidad principal para muros medidos en m².
        /// </summary>
        public double AreaNetaIntM2  => Math.Round(
            AreaBrutaIntM2 - AreaHuecosDescontadosM2, 4);

        public double AreaNetaExtM2  => Math.Round(
            AreaBrutaExtM2 - AreaHuecosDescontadosM2, 4);

        /// <summary>
        /// Área de huecos que SÍ se descuenta (los que superan el umbral configurado).
        /// Huecos menores al umbral NO se descuentan (quedan en la cantidad bruta).
        /// </summary>
        public double AreaHuecosDescontadosM2 { get; set; }

        /// <summary>
        /// Área de huecos que NO se descuenta (menores al umbral).
        /// </summary>
        public double AreaHuecosNoDescontadosM2 =>
            Math.Round(AreaHuecosM2 - AreaHuecosDescontadosM2, 4);

        // -----------------------------------------------------------------------
        // Cantidad y unidad principal (para el BOQ)
        // -----------------------------------------------------------------------

        /// <summary>
        /// Unidad de medida principal según criterio de medición:
        /// AREA_NETA → m², VOLUMEN → m³, LONGITUD → ml, UNIDAD → und
        /// </summary>
        public string UnidadPrincipal => CriterioMedicion switch
        {
            "VOLUMEN"    => "m³",
            "LONGITUD"   => "ml",
            "UNIDAD"     => "und",
            _            => "m²"  // AREA_NETA por defecto
        };

        /// <summary>
        /// Cantidad principal según el criterio de medición del tipo.
        /// </summary>
        public double CantidadPrincipal => CriterioMedicion switch
        {
            "VOLUMEN"    => Math.Round(VolumenM3, 4),
            "LONGITUD"   => Math.Round(LongitudML, 4),
            "UNIDAD"     => Cantidad,
            _            => Math.Round(AreaNetaIntM2, 4)
        };

        /// <summary>
        /// Cantidad con factor de desperdicio aplicado (para el BOQ final).
        /// </summary>
        public double CantidadConDesperdicio =>
            Math.Round(CantidadPrincipal * FactorDesperdicio, 4);

        // -----------------------------------------------------------------------
        // Partidas derivadas (calculadas por reglas)
        // -----------------------------------------------------------------------

        /// <summary>
        /// Lista de partidas derivadas de este elemento tipo
        /// (revoque int/ext, pintura int/ext, cerámica, dinteles, jambas, buñas).
        /// Se calcula en RevitExtractionService según los SSA_* del tipo.
        /// </summary>
        public List<PartidaDerivada> PartidasDerivadas { get; set; } = new();

        /// <summary>
        /// Capas estructurales del CompoundStructure del tipo (muro/piso/techo compuesto).
        /// Solo se puebla cuando la ExportRule del tipo tiene DesglosarCapas = true.
        /// Permite Material Takeoff por capa: ladrillo, revoque, aislante, etc.
        /// </summary>
        public List<CapaMaterial> CapasEstructurales { get; set; } = new();

        // -----------------------------------------------------------------------
        // Resultado del motor de homologación (Módulo B)
        // -----------------------------------------------------------------------

        /// <summary>
        /// Resultado del motor de homologación.
        /// Null si el elemento no ha pasado por el motor todavía.
        /// Populated by MatchingEngine.Match() después de la extracción.
        /// </summary>
        public MatchResult? MatchResult { get; set; }

        // -----------------------------------------------------------------------
        // Metadatos de control
        // -----------------------------------------------------------------------

        public OrigenPartida   Origen           { get; set; } = OrigenPartida.BIM_DIRECTO;
        public EstadoValidacion EstadoValidacion { get; set; } = EstadoValidacion.OK;
        public List<string>    MensajesValidacion{ get; set; } = new();
        public string          VersionExport    { get; set; } = string.Empty;
        public string          HashRevision     { get; set; } = string.Empty;
    }

    // ============================================================
    // PARTIDAS DERIVADAS
    // ============================================================

    /// <summary>
    /// Partida BOQ calculada por reglas sobre el modelo (BIM_DERIVADO).
    /// Ejemplo: revoque interior de un muro, pintura exterior, cerámica hasta 1.80m.
    /// </summary>
    public class PartidaDerivada
    {
        /// <summary>Tipo de partida derivada.</summary>
        public TipoDerivada Tipo          { get; set; }

        /// <summary>Código de partida para el BOQ.</summary>
        public string CodigoPartida      { get; set; } = string.Empty;

        /// <summary>Descripción legible de la partida.</summary>
        public string Descripcion        { get; set; } = string.Empty;

        /// <summary>Cantidad calculada (ya con factor de desperdicio si aplica).</summary>
        public double Cantidad           { get; set; }

        /// <summary>Unidad de medida.</summary>
        public string Unidad             { get; set; } = string.Empty;

        /// <summary>Factor de desperdicio aplicado.</summary>
        public double FactorDesperdicio  { get; set; } = 1.0;

        /// <summary>Cara del muro (INTERIOR / EXTERIOR / N/A).</summary>
        public string Cara               { get; set; } = string.Empty;

        /// <summary>Observación sobre el cálculo.</summary>
        public string Observacion        { get; set; } = string.Empty;
    }

    /// <summary>Tipos de partidas derivadas soportadas en el Sprint 1.</summary>
    public enum TipoDerivada
    {
        REVOQUE_INTERIOR,
        REVOQUE_EXTERIOR,
        PINTURA_INTERIOR,
        PINTURA_EXTERIOR,
        CERAMICA_MURO,
        DINTEL,
        JAMBA_RASGO,
        ALFEIZAR,
        BUNA_LINEAL,
        ZOCALO
    }

    // ============================================================
    // ABERTURA (puerta / ventana)
    // ============================================================

    /// <summary>
    /// Datos de una abertura (puerta o ventana) asociada a un muro host.
    /// Se usa para calcular descuento de huecos y partidas derivadas de aberturas.
    /// </summary>
    public class BimAbertura
    {
        public int    RevitId        { get; set; }
        public string UniqueId       { get; set; } = string.Empty;
        public string Categoria      { get; set; } = string.Empty;  // Puertas / Ventanas
        public string Familia        { get; set; } = string.Empty;
        public string Tipo           { get; set; } = string.Empty;
        public string GuidHostMuro   { get; set; } = string.Empty;  // UniqueId del muro host
        public double AnchoM         { get; set; }
        public double AltoM          { get; set; }
        public double RoughWidthM    { get; set; }  // SSA_ROUGH_WIDTH
        public double RoughHeightM   { get; set; }  // SSA_ROUGH_HEIGHT
        public double AreaM2         => Math.Round(AnchoM * AltoM, 4);
        public bool   DescontarArea  { get; set; }  // true si área > umbral configurado

        // Parámetros SSA_* de aberturas
        public string CodigoPartida  { get; set; } = string.Empty;
        public string NombreNorm     { get; set; } = string.Empty;
        public string DintelTipo     { get; set; } = string.Empty;
        public string JambaTipo      { get; set; } = string.Empty;
        public string AlfeizarTipo   { get; set; } = string.Empty;
        public bool   IncluirComputo { get; set; } = true;

        public EstadoValidacion EstadoValidacion { get; set; } = EstadoValidacion.OK;
        public List<string> MensajesValidacion   { get; set; } = new();
    }
}
