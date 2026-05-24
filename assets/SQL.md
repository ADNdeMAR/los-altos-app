# SQL Adicional para la Migración

Ejecuta este SQL en el **SQL Editor** de Supabase para agregar las columnas de latitude/longitude separadas a incident_reports (necesario para mostrar marcadores en el mapa sin necesidad de parsear PostGIS):

```sql
-- Agregar columnas lat/lng separadas a incident_reports para facilitar el renderizado
ALTER TABLE public.incident_reports 
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;
```

Ejecuta también el SQL completo de las nuevas tablas que te di anteriormente (tourist_spots, workshops, alternate_routes, y la columna photo_url).
