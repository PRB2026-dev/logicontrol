# Reporte Semanal de Gestión — LÍNEA BASE (antes de cambios)

> Captura del estado actual para comparación de regresión. No se modificó código.
> Fuente: `src/routes/reportes.tsx` (componente `Reportes`, `useMemo semanal`).

## Valores que muestra hoy el reporte (vs. esperado Excel Consolidado N°44)

| Indicador | Valor actual | Esperado | ¿Coincide? |
|---|---|---|---|
| OC sujetas a seguimiento | 148 | 148 | ✅ |
| Líneas en seguimiento | 1.286 | 643 | ❌ (×2) |
| Backlog: líneas atrasadas sin entregar | 222 | 111 | ❌ (×2) |
| Backlog: OC atrasadas | 47 | 47 | ✅ |
| USD en riesgo (backlog) | US$ 269.038 | US$ 154.566 | ❌ (×1,74) |
| Entregas programadas (semana) | 278 | 39–77 (AR, 7 días hábiles) | ❌ |
| Cumplimiento ANS | 98% | — | (medición distinta, ver fórmulas) |
| Cumplidas (de programadas) | 9% | — | (medición distinta) |
| Total de líneas en el sistema | 9.730 | 8.055 (DATA FINAL nacional) | población distinta |

## Fórmulas actuales (tal como están hoy)

- **Base "activas" (seguimiento)**: `tipoCompra != "Importación"` AND `estadoAdicional (BH) ∈ {0, l}` AND `estadoEntrega (BF) ∈ {sin entrega, entrega parcial}`.
- **Base "no-impo + no-borradas"**: `tipoCompra != "Importación"` AND `BH ∈ {0,l}` AND `BF != borrado`. (Más amplia que "activas": incluye ENTREGADO.)
- **Líneas en seguimiento** = `activas.length`.
- **OC en seguimiento** = `new Set(activas.map(oc)).size`.
- **Cumplimiento ANS** = `conSeguimiento / activas.length × 100`, donde `conSeguimiento` = activas con `fechaSeguimiento` dentro de los últimos **14 días hábiles**.
- **Entregas programadas** = (no-impo + no-borradas) con `fechaEntregaContractual || fechaCompromiso` dentro de la ventana. **Cumplidas** = las programadas con `BF = entregado`. `Cumplidas% = cumplidas/programadas`.
- **Backlog** = `activas.filter(jobDelayDays > 0)`. `jobDelayDays` = `diasIncumplimiento (BK)` si existe, si no `diasRetraso` (calculado desde `fechaCompromiso||fechaEntregaContractual||etaCampo` a hoy).
- **USD en riesgo (backlog)** = `Σ valorPendienteUsdFn(backlog)`.
- **Riesgos críticos** = backlog con `jobDelayDays > 30` y (sin `fechaSeguimiento` o `diasHabiles(fechaSeguimiento) > 14`).

## Ventana temporal (inconsistencia detectada)
- **On-screen (`semanal`)**: últimos **5 días hábiles** (`while diasHabilesContados < 5`).
- **Exportar Semanal**: últimos **7 días hábiles** (`while _dh < 7`).
- **Texto del encabezado**: dice "Últimos 7 días". →三者 no coinciden.

## Mapeo de columnas DATA FINAL en el parser (`src/lib/excel-import.ts`)
| Columna | Índice | Campo destino | ¿Posición fija? |
|---|---|---|---|
| T | 19 | oc | ✅ fija |
| BF | 57 | estadoEntrega | ✅ fija (+detección inteligente) |
| BH | 59 | estadoAdicional | ✅ fija |
| BK | 62 | diasIncumplimiento | ✅ fija |
| BY | 76 | categoriaSeguimiento | ✅ fija |
| R | 17 | responsable | ❌ solo alias (riesgo de elegir CQ=94) |
| AR | 43 | fechaEntregaContractual? | ❌ solo alias |
| AK | 36 | fechaAceptacion? | ❌ solo alias |
| BV | 73 | fechaRecepcion? | ❌ solo alias |

## Referencia (base completa, sin ventana) — para validar los nuevos bloques
- Entregadas con BV: 4.213. Por BK: atrasadas 2.912 · en fecha 142 · anticipadas 1.159.
- Por BV−AR: atrasadas 2.580 · en fecha 178 · anticipadas 1.455.
- Cambian de clasificación entre A y B: 344. Entregadas sin BV: 9.
- Activas a tiempo: 532 líneas · 112 OC. Activas atrasadas: 111 líneas · 47 OC.
- Chequeos: 532 + 111 = 643 · 112 + 47 − 11 = 148 OC.
