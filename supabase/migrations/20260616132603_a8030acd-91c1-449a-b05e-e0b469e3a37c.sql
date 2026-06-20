-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'operador', 'viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ JOBS ============
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bdp_job TEXT,
  cliente TEXT,
  status TEXT NOT NULL DEFAULT 'Booking',
  origen TEXT, destino TEXT, carrier TEXT,
  eta DATE, ata DATE, aduana DATE, factura DATE,
  peso NUMERIC DEFAULT 0, teus NUMERIC DEFAULT 0,
  modo TEXT DEFAULT 'Marítimo',
  responsable TEXT, centro TEXT,
  prioridad TEXT DEFAULT 'Media',
  fecha_creacion DATE DEFAULT CURRENT_DATE,
  observaciones TEXT DEFAULT '',
  escalado BOOLEAN DEFAULT false,
  -- IMPORTACIONES
  numero INTEGER, incoterms TEXT, proveedor TEXT, oc TEXT, posicion TEXT,
  codigo_sap TEXT, material TEXT, um TEXT,
  qty NUMERIC DEFAULT 0, qty_entregada NUMERIC DEFAULT 0, qty_pendiente NUMERIC DEFAULT 0,
  fecha_entrega_contractual DATE, modalidad_impo TEXT, lugar_llegada TEXT,
  etd_origen DATE, eta_puerto DATE, eta_campo DATE,
  do_num TEXT, invoice TEXT, asunto_correo TEXT,
  motivo_retraso TEXT, criterio_retraso TEXT,
  -- Fase 1 extra
  sociedad TEXT, cuenta TEXT, colector_costo TEXT, afe_proyecto TEXT, assets TEXT,
  gerencia TEXT, campo TEXT, customer TEXT, comprador TEXT,
  descripcion_material TEXT, valor_unitario NUMERIC DEFAULT 0, valor_total NUMERIC DEFAULT 0,
  fecha_orden DATE, fecha_compromiso DATE, fecha_recepcion DATE,
  descripcion_incoterms TEXT, tipo_compra TEXT DEFAULT 'Nacional',
  pais_origen TEXT, pais_procedencia TEXT,
  forwarder TEXT, naviera TEXT, bl TEXT, awb TEXT, contenedor TEXT,
  fecha_nacionalizacion DATE, fecha_puerto DATE, fecha_bodega DATE,
  -- Seguimiento extra
  llave TEXT, moneda TEXT, moneda_pedido TEXT, solicitante TEXT,
  fecha_aceptacion DATE, grupo_articulo TEXT, nombre_grupo_articulo TEXT,
  categoria TEXT, subcategoria TEXT,
  status_general TEXT, fecha_seguimiento DATE, dias_incumplimiento NUMERIC,
  valor_unit_usd NUMERIC, valor_total_usd NUMERIC,
  valor_pendiente_usd NUMERIC, valor_pendiente_cop NUMERIC,
  detalle_status TEXT, categoria_seguimiento TEXT,
  fecha_notificacion_proveedor DATE, compromiso_proveedor DATE,
  nombre_centro TEXT,
  -- Dashboard gerencial
  estado_entrega TEXT, estado_adicional TEXT,
  rango_inspeccion TEXT, rango_incumplimiento_informado TEXT, control_incumplimiento TEXT,
  anio INTEGER, mes INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_bdp ON public.jobs(bdp_job);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_responsable ON public.jobs(responsable);
CREATE INDEX idx_jobs_oc ON public.jobs(oc);
CREATE INDEX idx_jobs_proveedor ON public.jobs(proveedor);
CREATE INDEX idx_jobs_eta_campo ON public.jobs(eta_campo);
CREATE INDEX idx_jobs_tipo_compra ON public.jobs(tipo_compra);
CREATE INDEX idx_jobs_fecha_compromiso ON public.jobs(fecha_compromiso);
CREATE INDEX idx_jobs_llave ON public.jobs(llave);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read all jobs" ON public.jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update jobs" ON public.jobs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete jobs" ON public.jobs FOR DELETE TO authenticated USING (true);

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN lower(NEW.email) = 'misaelbecerra18@gmail.com' THEN 'admin'::app_role ELSE 'operador'::app_role END);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;

-- ============ CATÁLOGOS ============
CREATE TABLE public.proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER, acreedor TEXT, sociedad TEXT, nit TEXT,
  razon_social TEXT NOT NULL,
  expeditor TEXT, contacto TEXT, celular TEXT, email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedores TO authenticated;
GRANT ALL ON public.proveedores TO service_role;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth all proveedores" ON public.proveedores FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_prov_updated BEFORE UPDATE ON public.proveedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.motivos_retraso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motivo TEXT NOT NULL UNIQUE, criterio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.motivos_retraso TO authenticated;
GRANT ALL ON public.motivos_retraso TO service_role;
ALTER TABLE public.motivos_retraso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth all motivos" ON public.motivos_retraso FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.centros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centros TO authenticated;
GRANT ALL ON public.centros TO service_role;
ALTER TABLE public.centros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth all centros" ON public.centros FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.compradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE, email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compradores TO authenticated;
GRANT ALL ON public.compradores TO service_role;
ALTER TABLE public.compradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth all compradores" ON public.compradores FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.materiales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_sap TEXT UNIQUE, descripcion TEXT NOT NULL,
  grupo_articulo TEXT, categoria TEXT, subcategoria TEXT, um TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiales TO authenticated;
GRANT ALL ON public.materiales TO service_role;
ALTER TABLE public.materiales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth all materiales" ON public.materiales FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.paises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE, nombre TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paises TO authenticated;
GRANT ALL ON public.paises TO service_role;
ALTER TABLE public.paises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth all paises" ON public.paises FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);