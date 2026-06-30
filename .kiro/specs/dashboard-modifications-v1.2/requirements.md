# Requirements Document

## Introduction

This document specifies the requirements for LogiControl ERP Dashboard v1.2 modifications. The changes include fixes to existing charts, new indicators, validation reviews, a new Supplier Dashboard section, a new team filter, and a UI adjustment in the Operations module. All modifications preserve the existing architecture (React 19, TanStack Router, Supabase, Zustand, Recharts, Tailwind CSS v4) and do not alter authentication logic or unrelated dashboards.

## Glossary

- **Dashboard_Gerencial**: The main managerial dashboard view located at `src/routes/dashboard-gerencial.tsx` that displays KPIs, charts, and indicators for procurement management.
- **Operations_Module**: The operations table view at `src/routes/operaciones.tsx` displaying line-level procurement data.
- **Line**: A single row in the procurement dataset representing one OC + Position combination (LLAVE = OC + POSICIÓN).
- **OC_Activa**: A purchase order line classified as active when column BF (estadoEntrega) is "Entrega Parcial" or "Sin entrega" AND column BH (estadoAdicional) is "0" or "L".
- **Excel_Import_Module**: The module at `src/lib/excel-import.ts` responsible for parsing uploaded Excel files and mapping columns to the Job data model.
- **Categoría_de_Seguimiento_Chart**: The existing bar chart in Dashboard_Gerencial that breaks down pending lines by follow-up category.
- **Liberation_Indicator**: A new KPI card showing the count of lines with specific estadoAdicional (BH) values ("0", "L", "B").
- **Team_Filter**: A new global filter based on column Q (equipo) that affects all charts and indicators in Dashboard_Gerencial.
- **Supplier_Dashboard**: A new section within Dashboard_Gerencial showing supplier-level analytics including total lines, USD totals, compliance metrics, and ranking.
- **Column_BH**: Excel column 59 (estadoAdicional) with values "0" (active), "L" (liberated), "B" (blocked/deleted).
- **Column_BC**: Excel column 54 (valorTotalUsd) representing the total USD value per line.
- **Column_BY**: Excel column 76 (categoriaSeguimiento) with values such as "Revision Administrativa" or "Revision Proveedor".
- **Column_BZ**: Excel column 77, currently unmapped — requires identification during implementation for Categoría_de_Seguimiento_Chart breakdown.
- **Column_CA**: Excel column 78, currently unmapped — requires identification during implementation for Categoría_de_Seguimiento_Chart breakdown.
- **Column_Q**: Excel column 16, currently unmapped — represents the team (equipo) field for the new Team_Filter.
- **Jobs_Store**: The Zustand store at `src/lib/jobs-store.ts` managing application state with Supabase persistence.

## Requirements

### Requirement 1: Update "Pendientes por Categoría de Seguimiento" Chart Breakdown

**User Story:** As a procurement manager, I want the "Pendientes por Categoría de Seguimiento" chart to show a detailed breakdown using columns BY, BZ, and CA, so that I can see follow-up category details with sub-classifications.

#### Acceptance Criteria

1. WHEN the Excel file is imported, THE Excel_Import_Module SHALL map column BZ (index 77) to a new field `subcategoriaSeguimiento` in the Job data model.
2. WHEN the Excel file is imported, THE Excel_Import_Module SHALL map column CA (index 78) to a new field `detalleSeguimiento` in the Job data model.
3. WHEN the Categoría_de_Seguimiento_Chart renders, THE Dashboard_Gerencial SHALL display a breakdown hierarchy using categoriaSeguimiento (BY) as the primary grouping, subcategoriaSeguimiento (BZ) as the secondary grouping, and detalleSeguimiento (CA) as the tertiary detail.
4. THE Dashboard_Gerencial SHALL preserve the current chart type and visual style of the Categoría_de_Seguimiento_Chart.
5. THE Dashboard_Gerencial SHALL not modify the main filtering logic (`isOcActiva`) used by other charts and indicators.

### Requirement 2: Liberation Indicators

**User Story:** As a procurement manager, I want to see a liberation status indicator based on column BH (estadoAdicional), so that I can quickly assess how many lines are active, liberated, or blocked.

#### Acceptance Criteria

1. THE Dashboard_Gerencial SHALL display a Liberation_Indicator section showing the count of lines grouped by estadoAdicional (BH) values: "0" (Activas), "L" (Liberadas), and "B" (Bloqueadas/Borradas).
2. WHEN the Liberation_Indicator renders, THE Dashboard_Gerencial SHALL calculate counts from the full dataset without applying the OC_Activa filter, since the indicator purpose is to show the distribution across all BH states.
3. THE Dashboard_Gerencial SHALL provide a toggle control that allows the user to show or hide the Liberation_Indicator section.
4. WHILE the Liberation_Indicator toggle is set to hidden, THE Dashboard_Gerencial SHALL not render the Liberation_Indicator section.
5. THE Dashboard_Gerencial SHALL persist the toggle state within the user session using component-level state.

### Requirement 3: Economic Validation (USD Calculations)

**User Story:** As a procurement manager, I want the system to validate that USD calculations based on column BC are correct, so that financial KPIs reflect accurate data.

#### Acceptance Criteria

1. WHEN the Excel file is imported, THE Excel_Import_Module SHALL read column BC (index 54) as the single source of truth for `valorTotalUsd` per line.
2. THE `valorCompradoUsd` function in operational.ts SHALL return the numeric value of `valorTotalUsd` when positive and finite, and 0 otherwise.
3. WHEN `valorTotalUsd` is 0 or null for a line, THE `valorCompradoUsd` function SHALL return 0 without estimating from other columns.
4. IF a line has `estadoEntrega` equal to "Borrado", "Eliminado", "Baja", "Anulado", or "Cancelado", THEN THE `valorRecibidoUsd` function SHALL return 0.
5. IF a line has `estadoEntrega` equal to "Sin entrega" or "Pendiente", THEN THE `valorRecibidoUsd` function SHALL return 0.
6. WHEN `valorPendienteUsd` column is provided with a positive value, THE `valorRecibidoUsd` function SHALL calculate received value as `valorTotalUsd` minus `valorPendienteUsd`.
7. THE Dashboard_Gerencial SHALL display USD totals (comprado, recibido, pendiente) that sum exclusively from the `valorTotalUsd` field mapped to column BC.

### Requirement 4: Partial Delivery Validation

**User Story:** As a procurement manager, I want the system to correctly identify partial deliveries, so that the dashboard accurately distinguishes between fully delivered, partially delivered, and pending lines.

#### Acceptance Criteria

1. WHEN a line has `qtyEntregada` greater than 0 AND `qtyEntregada` less than `qty`, THE `lineStatus` function SHALL return "Parcial".
2. WHEN a line has `estadoEntrega` containing "parcial", THE `estadoOf` function SHALL return "Entregado Parcial".
3. WHEN a line has `estadoEntrega` equal to "Entregado" AND `qty` greater than 0 AND `qtyEntregada` greater than 0 AND `qtyEntregada` less than `qty`, THE `estadoOf` function SHALL return "Entregado Parcial".
4. THE Dashboard_Gerencial SHALL count partial deliveries separately from fully delivered lines in all KPI calculations.
5. IF the current logic correctly identifies partial deliveries per criteria 1-3, THEN THE system SHALL not modify the existing implementation.

### Requirement 5: Supplier Dashboard Section

**User Story:** As a procurement manager, I want a dedicated Supplier Dashboard section within Dashboard_Gerencial showing supplier-level metrics, so that I can evaluate supplier performance at a glance.

#### Acceptance Criteria

1. THE Dashboard_Gerencial SHALL display a new "Dashboard Proveedores" section containing supplier-level analytics.
2. THE Supplier_Dashboard SHALL display the total number of Lines across all suppliers from the filtered dataset.
3. THE Supplier_Dashboard SHALL display the total USD value (sum of `valorTotalUsd`) across all suppliers from the filtered dataset.
4. THE Supplier_Dashboard SHALL display a ranking of suppliers sorted by the number of Lines in descending order, showing the top 10 suppliers.
5. THE Supplier_Dashboard SHALL display for each ranked supplier: supplier name, total lines count, total USD value, on-time deliveries count, late deliveries count, and compliance percentage.
6. WHEN calculating compliance percentage for a supplier, THE Supplier_Dashboard SHALL compute it as (on-time lines / total delivered lines) × 100 for that supplier.
7. WHEN calculating on-time deliveries, THE Supplier_Dashboard SHALL count lines where `jobDelayDays` returns 0 or less AND the line is delivered (`estadoOf` returns "Entregado").
8. WHEN calculating late deliveries, THE Supplier_Dashboard SHALL count lines where `jobDelayDays` returns greater than 0 AND the line is delivered (`estadoOf` returns "Entregado").
9. THE Supplier_Dashboard SHALL perform all calculations at the Line level using LLAVE (OC + POSICIÓN) as the unit of measurement.
10. THE Supplier_Dashboard SHALL reuse existing UI components (Card, Badge) and Recharts for any visualizations.

### Requirement 6: New Team Filter

**User Story:** As a procurement manager, I want to filter the entire Dashboard_Gerencial by team (column Q), so that I can view metrics scoped to a specific team.

#### Acceptance Criteria

1. WHEN the Excel file is imported, THE Excel_Import_Module SHALL map column Q (index 16) to a new field `equipo` in the Job data model.
2. THE Dashboard_Gerencial SHALL display a Team_Filter dropdown containing all unique `equipo` values found in the dataset, plus an "All Teams" default option.
3. WHEN a specific team is selected in the Team_Filter, THE Dashboard_Gerencial SHALL filter the dataset to include only lines where `equipo` matches the selected value before computing any KPIs, charts, or indicators.
4. WHEN "All Teams" is selected, THE Dashboard_Gerencial SHALL include all lines in computations without filtering by `equipo`.
5. THE Team_Filter SHALL appear alongside existing filter controls (Gerencia, Campo, Año) in the Dashboard_Gerencial toolbar.
6. WHEN the Team_Filter value changes, THE Dashboard_Gerencial SHALL re-render all charts, KPIs, and indicators using the newly filtered dataset.

### Requirement 7: Operations Module — Move "Proveedor" Field

**User Story:** As an operations analyst, I want the "Proveedor" column to appear at the beginning of the main information columns in the Operations table, so that I can quickly identify the supplier for each line.

#### Acceptance Criteria

1. THE Operations_Module SHALL render the "Proveedor" column immediately after the identifier columns (LLAVE, OC, Pos.) and before the "Material" column.
2. THE Operations_Module SHALL preserve all existing column visibility, sorting, and filtering functionality for the "Proveedor" column after repositioning.
3. THE Operations_Module SHALL not alter the data content or formatting of the "Proveedor" column.
