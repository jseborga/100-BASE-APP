#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
// ============================================================
// ConstructionOS MCP Server
// Exposes tools for AI-driven construction metrados orchestration
// Connects to the Next.js webhook API
// ============================================================
const API_URL = process.env.CONSTRUCTIONOS_API_URL || 'https://base-app.q8waob.easypanel.host';
const API_KEY = process.env.CONSTRUCTIONOS_API_KEY || '';
async function callWebhook(action, params = {}) {
    const url = `${API_URL}/api/webhooks/mcp`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ action, params }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(`API error (${response.status}): ${err.error || response.statusText}`);
    }
    return response.json();
}
// ============================================================
// Server setup
// ============================================================
const server = new mcp_js_1.McpServer({
    name: 'constructionos',
    version: '1.0.0',
});
// ============================================================
// TOOLS — Read operations
// ============================================================
server.tool('list_projects', 'List all construction projects. Returns project name, country, typology, status, area, and floor count.', {
    estado: zod_1.z.enum(['activo', 'archivado', 'borrador']).optional().describe('Filter by project status'),
    limit: zod_1.z.number().optional().describe('Max results (default 50)'),
}, async (params) => {
    const result = await callWebhook('list_projects', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('get_project', 'Get full detail of a project including all assigned partidas with metrados, localizaciones, and country info. Use this to understand what a project currently contains.', {
    proyecto_id: zod_1.z.string().uuid().describe('Project UUID'),
}, async (params) => {
    const result = await callWebhook('get_project', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('search_catalog', 'Search the master partidas catalog by name, chapter, unit, or tags. Use to find existing partidas before creating new ones. The catalog is country-agnostic — localizaciones add country-specific codes.', {
    query: zod_1.z.string().optional().describe('Search by partida name (fuzzy match)'),
    capitulo: zod_1.z.string().optional().describe('Filter by chapter (e.g., "Muros y Tabiques", "Estructura")'),
    unidad: zod_1.z.string().optional().describe('Filter by unit (m2, m3, ml, kg, pza, glb, m, und)'),
    pais_codigo: zod_1.z.string().optional().describe('Filter to partidas that have a localizacion for this country code (BO, PE, BR, etc.)'),
    tags: zod_1.z.array(zod_1.z.string()).optional().describe('Filter by tag values (e.g., ["residencial_multifamiliar", "muy_comun"])'),
    limit: zod_1.z.number().optional().describe('Max results (default 50)'),
    offset: zod_1.z.number().optional().describe('Pagination offset'),
}, async (params) => {
    const result = await callWebhook('search_catalog', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('get_countries', 'List all available countries in the system with their codes and currencies.', {}, async () => {
    const result = await callWebhook('get_countries');
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('get_standards', 'List construction standards/normativas (NB for Bolivia, RNE for Peru, ABNT for Brazil, CSI for USA, etc.). Each standard has divisions/chapters.', {
    pais_codigo: zod_1.z.string().optional().describe('Filter by country code (BO, PE, BR, US, AR, CL)'),
}, async (params) => {
    const result = await callWebhook('get_standards', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('get_tags', 'List all AI vocabulary tags used for partida filtering. Tags have 7 dimensions: tipo_proyecto, fase, frecuencia, especialidad, pais, region, origen_bim.', {
    dimension: zod_1.z.string().optional().describe('Filter by dimension'),
}, async (params) => {
    const result = await callWebhook('get_tags', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('get_project_partidas', 'Get all partidas assigned to a project with their metrados (quantities), localizaciones (country codes), and catalog detail.', {
    proyecto_id: zod_1.z.string().uuid().describe('Project UUID'),
}, async (params) => {
    const result = await callWebhook('get_project_partidas', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('get_partida_detail', 'Get full detail of a single catalog partida including all country localizaciones and assigned tags.', {
    partida_id: zod_1.z.string().uuid().describe('Partida UUID'),
}, async (params) => {
    const result = await callWebhook('get_partida_detail', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
// ============================================================
// TOOLS — Write operations
// ============================================================
server.tool('add_partidas_to_project', 'Add one or more existing catalog partidas to a project. Skips duplicates. Optionally set initial metrados.', {
    proyecto_id: zod_1.z.string().uuid().describe('Project UUID'),
    partida_ids: zod_1.z.array(zod_1.z.string().uuid()).describe('Array of partida UUIDs to add'),
    metrados: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).optional().describe('Optional: { partida_id: metrado_value } for initial metrado_manual'),
}, async (params) => {
    const result = await callWebhook('add_partidas_to_project', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('remove_partidas_from_project', 'Remove partidas from a project (does not delete them from the catalog).', {
    proyecto_id: zod_1.z.string().uuid().describe('Project UUID'),
    partida_ids: zod_1.z.array(zod_1.z.string().uuid()).describe('Array of partida UUIDs to remove'),
}, async (params) => {
    const result = await callWebhook('remove_partidas_from_project', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('update_metrado', 'Update the metrado (quantity) for a specific partida within a project.', {
    proyecto_id: zod_1.z.string().uuid().describe('Project UUID'),
    partida_id: zod_1.z.string().uuid().describe('Partida UUID'),
    metrado_manual: zod_1.z.number().optional().describe('Manual metrado value'),
    metrado_final: zod_1.z.number().optional().describe('Final confirmed metrado'),
    notas: zod_1.z.string().optional().describe('Notes about the metrado'),
}, async (params) => {
    const result = await callWebhook('update_metrado', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('create_partida', 'Create a new partida in the master catalog. Use this when a needed partida does not exist yet. The partida is country-agnostic — add localizaciones separately.', {
    nombre: zod_1.z.string().describe('Partida name (e.g., "Muro ladrillo soga e=15cm")'),
    unidad: zod_1.z.string().describe('Unit of measurement (m2, m3, ml, kg, pza, glb, m, und)'),
    capitulo: zod_1.z.string().optional().describe('Chapter grouping (e.g., "Muros y Tabiques", "Estructura")'),
    descripcion: zod_1.z.string().optional().describe('Detailed description'),
    tipo: zod_1.z.string().optional().describe('Type: obra, suministro, instalacion (default: obra)'),
}, async (params) => {
    const result = await callWebhook('create_partida', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('create_suggestion', 'Submit a partida suggestion to the review queue. Use this for partidas that should be reviewed before being added to the master catalog.', {
    nombre_sugerido: zod_1.z.string().describe('Suggested partida name'),
    unidad_sugerida: zod_1.z.string().optional().describe('Suggested unit'),
    descripcion: zod_1.z.string().optional().describe('Description and justification'),
    origen: zod_1.z.enum(['ia', 'usuario']).optional().describe('Origin of suggestion'),
    contexto: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().describe('Additional context (project, country, etc.)'),
}, async (params) => {
    const result = await callWebhook('create_suggestion', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('approve_suggestion', 'Approve a pending partida suggestion, creating the actual partida in the master catalog.', {
    suggestion_id: zod_1.z.string().uuid().describe('Suggestion UUID'),
}, async (params) => {
    const result = await callWebhook('approve_suggestion', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('add_localizacion', 'Add or update a country-specific code (localizacion) for a partida. Each partida can have one code per standard (NB for Bolivia, RNE for Peru, etc.).', {
    partida_id: zod_1.z.string().uuid().describe('Partida UUID'),
    estandar_codigo: zod_1.z.string().describe('Standard code: NB (Bolivia), RNE (Peru), ABNT (Brazil), CSI (USA), CIRSOC (Argentina), NCh (Chile)'),
    codigo_local: zod_1.z.string().describe('Local code within the standard (e.g., "05.01", "04.01.01", "04 21 13")'),
    referencia_norma: zod_1.z.string().optional().describe('Normative reference (e.g., "NB-1225002 Art.3", "RNE E.070")'),
}, async (params) => {
    const result = await callWebhook('add_localizacion', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('add_tags_to_partida', 'Assign AI vocabulary tags to a partida for intelligent filtering. Tags have 7 dimensions: tipo_proyecto, fase, frecuencia, especialidad, pais, region, origen_bim.', {
    partida_id: zod_1.z.string().uuid().describe('Partida UUID'),
    tags: zod_1.z.array(zod_1.z.object({
        dimension: zod_1.z.string().describe('Tag dimension'),
        valor: zod_1.z.string().describe('Tag value'),
        peso: zod_1.z.number().optional().describe('Weight/relevance (default 1.0)'),
    })).describe('Tags to assign'),
}, async (params) => {
    const result = await callWebhook('add_tags_to_partida', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
// ============================================================
// TOOLS — Bulk operations
// ============================================================
server.tool('bulk_create_partidas', 'Create multiple partidas at once in the master catalog. Max 100 per batch. Returns created partidas with IDs.', {
    partidas: zod_1.z.array(zod_1.z.object({
        nombre: zod_1.z.string().describe('Partida name'),
        unidad: zod_1.z.string().describe('Unit (m2, m3, ml, kg, pza, glb, m, und)'),
        capitulo: zod_1.z.string().optional().describe('Chapter grouping'),
        descripcion: zod_1.z.string().optional().describe('Description'),
    })).describe('Array of partidas to create'),
}, async (params) => {
    const result = await callWebhook('bulk_create_partidas', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('bulk_add_localizaciones', 'Add country-specific codes for multiple partidas at once. Max 200 per batch. Upserts — updates existing codes.', {
    localizaciones: zod_1.z.array(zod_1.z.object({
        partida_id: zod_1.z.string().uuid().describe('Partida UUID'),
        estandar_codigo: zod_1.z.string().describe('Standard code (NB, RNE, ABNT, CSI, CIRSOC, NCh)'),
        codigo_local: zod_1.z.string().describe('Local code'),
        referencia_norma: zod_1.z.string().optional().describe('Normative reference'),
    })).describe('Array of localizaciones to add/update'),
}, async (params) => {
    const result = await callWebhook('bulk_add_localizaciones', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
// ============================================================
// TOOLS — BIM operations
// ============================================================
server.tool('get_bim_imports', 'List BIM imports for a project. Returns import history with element counts and status.', {
    proyecto_id: zod_1.z.string().uuid().describe('Project UUID'),
}, async (params) => {
    const result = await callWebhook('get_bim_imports', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('get_bim_elements', 'Get BIM elements for a specific import. Returns elements with Revit category, matched partida, and calculated metrado.', {
    importacion_id: zod_1.z.string().uuid().describe('Import UUID'),
    estado: zod_1.z.enum(['pendiente', 'mapeado', 'revisado', 'error']).optional().describe('Filter by element status'),
    limit: zod_1.z.number().optional().describe('Max results (default 100, max 500)'),
    offset: zod_1.z.number().optional().describe('Pagination offset'),
}, async (params) => {
    const result = await callWebhook('get_bim_elements', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('get_revit_mapeos', 'Get Revit category → partida mapping rules. Shows formulas used to calculate metrados from BIM parameters (Area, Volume, Length, Count).', {
    revit_categoria_id: zod_1.z.string().uuid().optional().describe('Filter by Revit category UUID'),
}, async (params) => {
    const result = await callWebhook('get_revit_mapeos', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('import_bim_elements', 'Import BIM elements from Revit into a project. Creates an importacion record and inserts all elements. Auto-resolves Revit category by name (Walls, Floors, Structural Columns, etc.).', {
    proyecto_id: zod_1.z.string().uuid().describe('Project UUID'),
    archivo_nombre: zod_1.z.string().optional().describe('Source file name (default: "Revit Export")'),
    elementos: zod_1.z.array(zod_1.z.object({
        revit_id: zod_1.z.string().describe('Revit ElementId'),
        unique_id: zod_1.z.string().optional().describe('Revit UniqueId (GUID)'),
        categoria: zod_1.z.string().describe('Revit category name (Walls, Floors, Structural Columns, etc.)'),
        familia: zod_1.z.string().describe('Revit family name'),
        tipo: zod_1.z.string().describe('Revit type name'),
        parametros: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).describe('Numeric parameters: { Area, AreaBruta, AreaBrutaExt, Volume, Length, Height, Width, Count, OpeningsArea, PesoLinealKgM, ... }'),
        metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional().describe('Text metadata: { Nivel, Funcion, AcabadoInterior, CapasEstructurales, ... }'),
    })).describe('Array of BIM elements to import'),
}, async (params) => {
    const result = await callWebhook('import_bim_elements', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('match_bim_elements', 'Run formula-based matching on imported BIM elements. Evaluates revit_mapeos formulas against element parameters, assigns partida_id + metrado_calculado. Creates derived elements when one Revit element maps to multiple partidas (e.g., wall → brick + plaster + paint).', {
    importacion_id: zod_1.z.string().uuid().describe('Import UUID to process'),
}, async (params) => {
    const result = await callWebhook('match_bim_elements', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('confirm_bim_match', 'Confirm matched BIM elements and create/update proyecto_partidas with metrado_bim. Aggregates metrados by partida, creates new proyecto_partidas or updates existing ones, and reorders by chapter.', {
    importacion_id: zod_1.z.string().uuid().describe('Import UUID'),
    elemento_ids: zod_1.z.array(zod_1.z.string().uuid()).optional().describe('Optional: confirm only specific element UUIDs (default: all matched)'),
}, async (params) => {
    const result = await callWebhook('confirm_bim_match', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
// ============================================================
// TOOLS — BIM Mapping Management (AI agent + web)
// ============================================================
server.tool('get_bim_element_detail', 'Get full detail of a single BIM element including all numeric params, metadata, and available mapeos for its category. Use this to understand an element before mapping it.', {
    elemento_id: zod_1.z.string().uuid().describe('BIM element UUID'),
}, async (params) => {
    const result = await callWebhook('get_bim_element_detail', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('create_revit_mapeo', 'Create a new mapping rule: Revit category → partida with formula. Formula uses element param names (Area, Volume, Length, Count, Width, Height, OpeningsArea, AreaBruta, etc.). Example formulas: "(Area - OpeningsArea) * 1.05", "Volume * 78.5", "Count".', {
    revit_categoria_id: zod_1.z.string().uuid().describe('Revit category UUID'),
    partida_id: zod_1.z.string().uuid().describe('Target partida UUID from catalog'),
    formula: zod_1.z.string().describe('Arithmetic formula using param names (e.g., "(Area - OpeningsArea) * 1.05")'),
    parametro_principal: zod_1.z.string().optional().describe('Main parameter (Area, Volume, Length, Count)'),
    descripcion: zod_1.z.string().optional().describe('Human description of this rule'),
    prioridad: zod_1.z.number().optional().describe('Evaluation priority (lower = first, default 10)'),
}, async (params) => {
    const result = await callWebhook('create_revit_mapeo', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('update_revit_mapeo', 'Update an existing mapping rule (formula, partida, priority, description).', {
    mapeo_id: zod_1.z.string().uuid().describe('Mapeo UUID to update'),
    formula: zod_1.z.string().optional().describe('New formula'),
    partida_id: zod_1.z.string().uuid().optional().describe('New target partida UUID'),
    parametro_principal: zod_1.z.string().optional().describe('New main parameter'),
    descripcion: zod_1.z.string().optional().describe('New description'),
    prioridad: zod_1.z.number().optional().describe('New priority'),
}, async (params) => {
    const result = await callWebhook('update_revit_mapeo', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('delete_revit_mapeo', 'Delete a mapping rule.', {
    mapeo_id: zod_1.z.string().uuid().describe('Mapeo UUID to delete'),
}, async (params) => {
    const result = await callWebhook('delete_revit_mapeo', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('apply_mapping_to_element', 'Manually assign a partida to a BIM element with optional formula evaluation. Used by AI agent to suggest/apply mappings one element at a time.', {
    elemento_id: zod_1.z.string().uuid().describe('BIM element UUID'),
    partida_id: zod_1.z.string().uuid().describe('Partida UUID to assign'),
    formula: zod_1.z.string().optional().describe('Formula to evaluate for metrado (uses element params)'),
    metrado: zod_1.z.number().optional().describe('Direct metrado value (if not using formula)'),
}, async (params) => {
    const result = await callWebhook('apply_mapping_to_element', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('get_element_mappings', 'Get confirmed/mapped element results for Revit write-back. Returns revit_id → partida code + metrado for each mapped element.', {
    importacion_id: zod_1.z.string().uuid().optional().describe('Filter by import UUID'),
    proyecto_id: zod_1.z.string().uuid().optional().describe('Filter by project UUID'),
}, async (params) => {
    const result = await callWebhook('get_element_mappings', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
// ============================================================
// TOOLS — BIM Skills (intelligent mapping per country/norm)
// ============================================================
server.tool('analyze_bim_import', 'Analyze a BIM import: summarize elements by category, show which have mapeos and which need new rules, identify categories missing mapping rules, show sample params. Returns an actionable report. Use this as the FIRST step when working with a new BIM import.', {
    importacion_id: zod_1.z.string().uuid().describe('Import UUID to analyze'),
    pais_codigo: zod_1.z.string().optional().describe('Country code for standard context (BO, PE, BR, US)'),
}, async (params) => {
    const result = await callWebhook('analyze_bim_import', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('suggest_element_mapping', 'Get AI-ready mapping suggestions for a specific BIM element. Returns: all numeric params, metadata, existing mapeo rules evaluated against this element, candidate partidas from catalog (filtered by category keywords + country), and suggested formulas. Use this to decide what mapping to create or apply.', {
    elemento_id: zod_1.z.string().uuid().describe('BIM element UUID to analyze'),
    pais_codigo: zod_1.z.string().optional().describe('Country code for catalog filtering (default: BO)'),
}, async (params) => {
    const result = await callWebhook('suggest_element_mapping', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
server.tool('get_mapping_coverage', 'Show mapping coverage statistics: categories with/without rules, rules per category, per-country partida coverage, gaps in the mapping standard. Use this to understand what mapping work is still needed and to prioritize rule creation.', {
    pais_codigo: zod_1.z.string().optional().describe('Country code to check localization coverage (BO, PE, BR, US)'),
}, async (params) => {
    const result = await callWebhook('get_mapping_coverage', params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
// ============================================================
// Start server
// ============================================================
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('ConstructionOS MCP server running on stdio');
}
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
