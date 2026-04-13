// Services/SharedParamService.cs
// Servicio para registrar y leer los shared parameters SSA_* en el documento de Revit.
// Los parámetros se aplican a nivel de TIPO (ElementType), no instancia,
// ya que todos los elementos del mismo tipo comparten los mismos valores BOQ.
// Autor: SSA Ingenieria SRL

using System.IO;
using System.Reflection;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RvtConstructionOS.Services
{
    /// <summary>
    /// Resultado del registro de shared parameters en el documento.
    /// </summary>
    public class SharedParamRegistrationResult
    {
        public int Registrados { get; set; }
        public int YaExistian  { get; set; }
        public List<string> Errores { get; set; } = new();
        public bool Success => Errores.Count == 0;
    }

    /// <summary>
    /// Gestiona los shared parameters SSA_* del proyecto BIM BOQ Bridge.
    /// Registra los parámetros en los tipos de categorías medibles y
    /// provee métodos para leer y escribir valores por tipo de elemento.
    /// </summary>
    public class SharedParamService
    {
        // Nombre del archivo de shared parameters incluido junto al plugin
        private const string ArchivoSharedParams = "SharedParameters.txt";

        // Categorías que recibirán los parámetros generales SSA_*
        private static readonly BuiltInCategory[] CategoriasGenerales =
        {
            BuiltInCategory.OST_Walls,
            BuiltInCategory.OST_Floors,
            BuiltInCategory.OST_Ceilings,
            BuiltInCategory.OST_Doors,
            BuiltInCategory.OST_Windows,
            BuiltInCategory.OST_StructuralColumns,
            BuiltInCategory.OST_StructuralFraming,
            BuiltInCategory.OST_StructuralFoundation,
            BuiltInCategory.OST_Roofs,
            BuiltInCategory.OST_Stairs,
        };

        // Categorías que recibirán parámetros específicos de muros
        private static readonly BuiltInCategory[] CategoriasParaMuros =
        {
            BuiltInCategory.OST_Walls,
        };

        // Categorías que recibirán parámetros de aberturas
        private static readonly BuiltInCategory[] CategoriasParaAberturas =
        {
            BuiltInCategory.OST_Doors,
            BuiltInCategory.OST_Windows,
        };

        // -----------------------------------------------------------------------
        // Registro de parámetros
        // -----------------------------------------------------------------------

        /// <summary>
        /// Registra todos los shared parameters SSA_* en el documento activo.
        /// Debe ejecutarse dentro de una Transaction abierta.
        /// El archivo SharedParameters.txt se busca en la misma carpeta que el plugin.
        /// </summary>
        public SharedParamRegistrationResult RegistrarParametros(Document doc, UIApplication app)
        {
            var resultado = new SharedParamRegistrationResult();

            // Localizar el archivo de shared parameters junto al ensamblado del plugin
            string carpetaPlugin = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)!;
            string rutaArchivo   = Path.Combine(carpetaPlugin, ArchivoSharedParams);

            if (!File.Exists(rutaArchivo))
            {
                resultado.Errores.Add(
                    $"No se encontró '{ArchivoSharedParams}' en:\n{carpetaPlugin}\n" +
                    "Asegúrese de que el archivo esté en la carpeta del plugin.");
                return resultado;
            }

            // Apuntar Revit al archivo de shared parameters del plugin
            string archivoAnterior = app.Application.SharedParametersFilename;
            app.Application.SharedParametersFilename = rutaArchivo;

            DefinitionFile defFile = app.Application.OpenSharedParameterFile();
            if (defFile == null)
            {
                resultado.Errores.Add("No se pudo abrir el archivo de shared parameters.");
                app.Application.SharedParametersFilename = archivoAnterior;
                return resultado;
            }

            try
            {
                // Grupo 1: parámetros generales (todas las categorías medibles)
                RegistrarGrupo(doc, defFile, "SSA_General", CategoriasGenerales,
                    GroupTypeId.IdentityData, resultado);

                // Grupo 2: parámetros de muros
                RegistrarGrupo(doc, defFile, "SSA_Muros", CategoriasParaMuros,
                    GroupTypeId.Construction, resultado);

                // Grupo 3: parámetros de aberturas
                RegistrarGrupo(doc, defFile, "SSA_Aberturas", CategoriasParaAberturas,
                    GroupTypeId.Construction, resultado);
            }
            finally
            {
                // Restaurar el archivo de shared parameters anterior del usuario
                app.Application.SharedParametersFilename = archivoAnterior;
            }

            return resultado;
        }

        /// <summary>
        /// Registra todos los parámetros de un grupo en las categorías especificadas.
        /// </summary>
        private static void RegistrarGrupo(
            Document doc,
            DefinitionFile defFile,
            string nombreGrupo,
            BuiltInCategory[] categorias,
            ForgeTypeId groupTypeId,
            SharedParamRegistrationResult resultado)
        {
            DefinitionGroup? defGroup = defFile.Groups
                .FirstOrDefault(g => g.Name == nombreGrupo);

            if (defGroup == null)
            {
                resultado.Errores.Add($"Grupo '{nombreGrupo}' no encontrado en el archivo de shared params.");
                return;
            }

            // Construir CategorySet con las categorías destino
            CategorySet catSet = doc.Application.Create.NewCategorySet();
            foreach (var bic in categorias)
            {
                Category? cat = doc.Settings.Categories.get_Item(bic);
                if (cat != null) catSet.Insert(cat);
            }

            // Registrar cada parámetro del grupo
            foreach (Definition def in defGroup.Definitions)
            {
                try
                {
                    // Verificar si el parámetro ya existe en el proyecto
                    bool yaExiste = doc.ParameterBindings.Contains(def);
                    if (yaExiste)
                    {
                        resultado.YaExistian++;
                        continue;
                    }

                    // Crear el binding de tipo (por tipo de elemento, no instancia)
                    TypeBinding binding = doc.Application.Create.NewTypeBinding(catSet);
                    doc.ParameterBindings.Insert(def, binding, groupTypeId);
                    resultado.Registrados++;
                }
                catch (Exception ex)
                {
                    resultado.Errores.Add($"Error al registrar '{def.Name}': {ex.Message}");
                }
            }
        }

        // -----------------------------------------------------------------------
        // Lectura y escritura de valores SSA_* en tipos de elemento
        // -----------------------------------------------------------------------

        /// <summary>
        /// Lee el valor de texto de un shared parameter SSA_* en un tipo de elemento.
        /// Retorna string vacío si el parámetro no existe o no tiene valor.
        /// </summary>
        public static string LeerTexto(ElementType tipo, string nombreParam)
        {
            Parameter? p = tipo.LookupParameter(nombreParam);
            return p?.AsString() ?? string.Empty;
        }

        /// <summary>
        /// Lee el valor numérico de un shared parameter SSA_* en un tipo de elemento.
        /// Retorna 0 si el parámetro no existe o no tiene valor.
        /// </summary>
        public static double LeerNumero(ElementType tipo, string nombreParam)
        {
            Parameter? p = tipo.LookupParameter(nombreParam);
            if (p == null || p.StorageType != StorageType.Double) return 0;
            return p.AsDouble();
        }

        /// <summary>
        /// Lee el valor booleano (Yes/No) de un shared parameter SSA_* en un tipo de elemento.
        /// Retorna true si el parámetro no existe (incluir por defecto).
        /// </summary>
        public static bool LeerBooleano(ElementType tipo, string nombreParam, bool valorDefault = true)
        {
            Parameter? p = tipo.LookupParameter(nombreParam);
            if (p == null || p.StorageType != StorageType.Integer) return valorDefault;
            return p.AsInteger() == 1;
        }

        /// <summary>
        /// Escribe un valor de texto en un shared parameter SSA_* de un tipo de elemento.
        /// Requiere Transaction abierta.
        /// </summary>
        public static bool EscribirTexto(ElementType tipo, string nombreParam, string valor)
        {
            Parameter? p = tipo.LookupParameter(nombreParam);
            if (p == null || p.IsReadOnly) return false;
            p.Set(valor);
            return true;
        }

        /// <summary>
        /// Escribe un valor numérico en un shared parameter SSA_* de un tipo de elemento.
        /// Requiere Transaction abierta.
        /// </summary>
        public static bool EscribirNumero(ElementType tipo, string nombreParam, double valor)
        {
            Parameter? p = tipo.LookupParameter(nombreParam);
            if (p == null || p.IsReadOnly || p.StorageType != StorageType.Double) return false;
            p.Set(valor);
            return true;
        }

        /// <summary>
        /// Escribe un valor booleano en un shared parameter SSA_* de un tipo de elemento.
        /// Requiere Transaction abierta.
        /// </summary>
        public static bool EscribirBooleano(ElementType tipo, string nombreParam, bool valor)
        {
            Parameter? p = tipo.LookupParameter(nombreParam);
            if (p == null || p.IsReadOnly || p.StorageType != StorageType.Integer) return false;
            p.Set(valor ? 1 : 0);
            return true;
        }
    }
}
