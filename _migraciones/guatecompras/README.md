# Guatecompras — retirado 2026-07-21

Motivo: AJUA discontinuó participación en licitaciones estatales.

Se removió de:
- bpm.html: nav item + sección sec-guatecompras + <script src>
- ajua-react: menú Layout.jsx + Route App.jsx + Guatecompras.jsx

Los datos históricos en Firebase (colecciones gcConcursos, gcDescubiertos) NO se tocaron.

Para restaurar: `git revert` del commit correspondiente + mover archivos de vuelta a src/modules/guatecompras/
