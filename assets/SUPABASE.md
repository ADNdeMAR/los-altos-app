# Configuración de Base de Datos (Supabase)

Para la fase Beta, hemos provisto un cliente de base de datos rápido usando Supabase (PostgreSQL + PostGIS). 
Debes seguir estos pasos para que la aplicación funcione al 100%:

1. Ve a [supabase.com](https://supabase.com) y crea un nuevo proyecto (es gratis).
2. Entra a **Project Settings -> API** y copia tu `URL` y `anon public key`.
3. Pégalos en el archivo `src/lib/supabase.js`.
4. Ve a la sección **SQL Editor** en tu panel de Supabase y pega el siguiente código para crear las tablas necesarias habilitando mapas geoespaciales:

```sql
-- Activar la extensión espacial (PostGIS)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Tabla de Perfiles (Reputación)
CREATE TABLE public.profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  reputation_points integer default 0,
  updated_at timestamp with time zone,
  
  constraint username_length check (char_length(username) >= 3)
);

-- Tabla de Reportes de Incidentes
CREATE TABLE public.incident_reports (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  incident_type text not null, -- 'DERRUMBE', 'CAMINO_DAÑADO', 'BLOQUEO'
  description text,
  location geography(POINT) not null,
  status text default 'ACTIVO', -- 'ACTIVO', 'RESUELTO', 'FALSO'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabla de Validaciones de Confianza
CREATE TABLE public.report_validations (
  id uuid default uuid_generate_v4() primary key,
  report_id uuid references public.incident_reports(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  is_valid boolean not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(report_id, user_id)
);

-- Configurar RLS (Seguridad a Nivel de Fila) - Configuración Básica MVP
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Perfiles públicos" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Reportes visibles para todos" ON public.incident_reports FOR SELECT USING (true);
CREATE POLICY "Usuarios autenticados pueden crear reportes" ON public.incident_reports FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Validaciones visibles para todos" ON public.report_validations FOR SELECT USING (true);
CREATE POLICY "Usuarios pueden validar" ON public.report_validations FOR INSERT WITH CHECK (auth.uid() = user_id);
```
