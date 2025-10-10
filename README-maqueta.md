
# School Attendance — Prototypes Monorepo

Este repo contiene **3 maquetas front-end** (solo vistas estáticas) y **datasets mock** coherentes, todo en un solo lugar:

```
.
├── src/
│   ├── web-app/        # Maqueta Dirección/Padres (HTML/CSS/JS)
│   ├── kiosk-app/      # Maqueta Totem/Kiosco (HTML/CSS/JS + SW)
│   └── teacher-pwa/    # Maqueta PWA Profesores (HTML/CSS/JS + SW + manifest)
└── data/
    ├── web-app/        # JSONs específicos de la web-app
    ├── kiosk-app/      # JSONs específicos del kiosco
    ├── teacher-pwa/    # JSONs específicos de la PWA
    └── shared/         # JSONs comunes (fuente de verdad para los que coinciden por nombre)
```

## ¿Por qué este layout?
- Un solo repo simplifica versionado, issues y PRs.
- Cada app tiene su **carpeta en `src/`** y sus **datasets en `data/<app>/`**.
- La carpeta `data/shared/` contiene **datos comunes** (p. ej., `students.json`, `courses.json`) que se **copian** a cada app cuando el **nombre del archivo coincide**.

## Sincronizar datos compartidos
Para copiar desde `data/shared/` a las carpetas de cada app (solo los archivos que existen por nombre en el destino), ejecuta:

```bash
make sync
# o
python3 scripts/sync_shared.py
```

> Puedes extender `scripts/sync_shared.py` si necesitas transformar/filtrar campos por app.

## ¿Dónde poner el código de las maquetas?
- Pega el código que genere Claude Code en:
  - `src/web-app/`
  - `src/kiosk-app/`
  - `src/teacher-pwa/`

Cada maqueta debe leer sus datos desde la carpeta correspondiente en `data/<app>/` (según los prompts).

## Servir localmente (ejemplo)
Puedes usar cualquier servidor estático. Por ejemplo, con `npx`:
```bash
# Web Dirección/Padres
npx serve src/web-app -p 5173

# Kiosco
npx serve src/kiosk-app -p 5174

# PWA Profesores
npx serve src/teacher-pwa -p 5175
```

## Nota sobre `shared`
`data/shared/` es **fuente de verdad** para datasets comunes.
- Si editas `students.json` en `shared`, corre `make sync` para reflejar cambios en cada app que use ese archivo.
- Algunos archivos **solo existen** en una app (p. ej., `tags.json` para kiosco); esos **no** se sincronizan.

## Próximos pasos
1. Genera las 3 maquetas con los prompts.
2. Copia/ajusta rutas de lectura de datos para que apunten a `data/<app>/`.
3. (Opcional) Ajusta `scripts/sync_shared.py` si necesitas reglas personalizadas de copia.
