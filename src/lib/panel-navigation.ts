export type PanelRole = 'owner' | 'professional' | 'client' | null | undefined;

export type PanelNavItem =
  | { section: string }
  | { href: string; icon: string; label: string; ownerOnly?: boolean };

export const PROFESSIONAL_RESTRICTED_PATHS = [
  '/profesionales',
  '/servicios',
  '/horarios',
  '/configuracion',
  '/analitica',
] as const;

export const PANEL_NAV_ITEMS: PanelNavItem[] = [
  { section: 'Panel' },
  { href: '/', icon: 'dashboard', label: 'Resumen' },
  { href: '/citas', icon: 'calendar', label: 'Citas' },
  { section: 'Gestión' },
  { href: '/profesionales', icon: 'doctor', label: 'Profesionales', ownerOnly: true },
  { href: '/servicios', icon: 'spa', label: 'Servicios', ownerOnly: true },
  { href: '/pacientes', icon: 'users', label: 'Pacientes' },
  { href: '/horarios', icon: 'clock', label: 'Horarios', ownerOnly: true },
  { href: '/analitica', icon: 'chart', label: 'Analítica', ownerOnly: true },
  { href: '/configuracion', icon: 'settings', label: 'Configuración', ownerOnly: true },
];

const SECTION_TITLE_MAP: Array<{ prefix: string; title: string }> = [
  { prefix: '/citas', title: 'Citas' },
  { prefix: '/pacientes', title: 'Pacientes' },
  { prefix: '/profesionales', title: 'Profesionales' },
  { prefix: '/servicios', title: 'Servicios' },
  { prefix: '/horarios', title: 'Horarios' },
  { prefix: '/configuracion', title: 'Configuración' },
  { prefix: '/analitica', title: 'Analítica' },
  { prefix: '/analytics', title: 'Analítica' },
];

export function getPanelSectionTitle(pathname: string): string {
  if (pathname === '/') return 'Resumen';

  const match = SECTION_TITLE_MAP.find((item) => pathname.startsWith(item.prefix));
  return match?.title ?? 'Panel';
}

export function isRestrictedForProfessional(pathname: string): boolean {
  return PROFESSIONAL_RESTRICTED_PATHS.some((path) => pathname.startsWith(path));
}

export function canRenderNavItem(item: PanelNavItem, role: PanelRole): boolean {
  if (!('href' in item)) return true;
  if (!item.ownerOnly) return true;
  return role === 'owner';
}

export function isPanelNavSection(item: PanelNavItem): item is { section: string } {
  return 'section' in item;
}

export function isPanelNavLink(item: PanelNavItem): item is Extract<PanelNavItem, { href: string }> {
  return 'href' in item;
}
