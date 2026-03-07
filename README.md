# AJÚA BPM

Sistema de control interno — Agroindustria AJÚA  
Importación y distribución de vegetales, Guatemala.

## Stack

- **Frontend:** HTML/CSS/JS Vanilla — sin framework
- **Base de datos:** Firebase Firestore (`ajuabmp` project)
- **Hosting:** GitHub Pages via `ajua-bpm.github.io`
- **Dominio:** agroajua.com (CNAME → GitHub Pages)
- **CI/CD:** GitHub Actions → deploy automático en cada push a `main`

## Estructura del proyecto

```
ajua-bpm/
├── index.html              ← App principal (Build actual)
├── landing.html            ← Landing page pública
├── src/
│   ├── styles/
│   │   └── main.css        ← Estilos extraídos (Build 45)
│   ├── core/               ← Pendiente extracción (Fase 3-4)
│   └── modules/            ← Pendiente extracción (Fase 4)
├── .github/
│   └── workflows/
│       └── deploy.yml      ← CI/CD pipeline
├── manifest.json
├── sw.js
└── AJUA_MAPA.md            ← Mapa completo de arquitectura
```

## Módulos del sistema

| Módulo | Descripción |
|--------|-------------|
| 🖐 BPM Dashboard | Control de procesos diarios y registros de inocuidad |
| 📦 Inventario | Entradas, salidas, productos, presentaciones |
| 🛒 Walmart | Pedidos, rubros, calendario, rechazos |
| 💸 Gastos Diarios | Control de gastos operativos por categoría |
| 📊 Gastos Generales | Control semanal de gastos fijos |
| 👷 Nómina | Cálculo automático desde registros de acceso |
| 📈 Reportes | Ingresos, costos, utilidad por canal/producto |
| 💼 Cotizador | Ofertas comerciales con seguimiento |
| 📋 Carga Masiva | Import/export Excel |

## Builds

| Build | Descripción |
|-------|-------------|
| 43 | Baseline — sistema funcionando en producción |
| 44 | GitHub Actions + estructura modular `src/` |
| 45 | CSS extraído a `src/styles/main.css` |
| 46 | README + mapa de arquitectura |

## Desarrollo local

```bash
git clone https://github.com/ajua-bpm/ajua-bpm.git
cd ajua-bpm
# Abrir index.html en navegador — no requiere servidor
```

## Deploy

Automático: cualquier push a `main` dispara GitHub Actions y publica en GitHub Pages.
