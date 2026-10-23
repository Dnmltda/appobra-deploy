import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useLanguage } from '@/contexts/LanguageContext.jsx';
import { t } from '@/lib/translations.js';
import { 
  LayoutDashboard, 
  Building2, 
  Package, 
  Boxes,
  PackageCheck,
  Construction,
  ArrowRightLeft, 
  Wrench, 
  HardHat, 
  Truck, 
  ShoppingCart,
  ClipboardList,
  Users,
  UsersRound,
  Wallet, 
  FolderOpen, 
  BarChart3, 
  Settings, 
  ShieldCheck,
  Siren,
  Warehouse,
  MessagesSquare, QrCode } from 'lucide-react';
import Logo from './Logo.jsx';
import BotaoInstalar from '@/components/marca/BotaoInstalar.jsx';
import { ehAdmin, podeAcessar, podeVerEstoque } from '@/lib/permissoes.js';

const Sidebar = ({ isCollapsed, setIsCollapsed }) => {
  const { language } = useLanguage();
  const { currentUser, isAdmin } = useAuth();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mesmo mapa da proteção de rotas (lib/permissoes.js).
  const hasPermission = (module) => {
    if (isAdmin) return true;
    if (module === 'usuarios') return ehAdmin(currentUser);
    return podeAcessar(currentUser, module);
  };

  // The 15 requested modules
  const menuItems = [
    { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'obras', path: '/projects', label: 'Obras', icon: Building2 },
    { id: 'minha_obra', path: '/minha-obra', label: 'Minha Obra', icon: MessagesSquare },
    { id: 'ocorrencias', path: '/ocorrencias', label: 'Ocorrências', icon: Siren },
    { id: 'materiais', path: '/materiais', label: 'Materiais', icon: Package },
    { id: 'estoque', path: '/estoque', label: 'Estoque', icon: Boxes },
    { id: 'estoque_obras', path: '/estoque-obras', label: 'Estoque por Obra', icon: Warehouse },
    { id: 'movimentacoes', path: '/movimentacoes', label: 'Movimentações', icon: ArrowRightLeft },
    { id: 'saldo_funcionario', path: '/saldo-funcionario', label: 'Saldo por Funcionário', icon: PackageCheck },
    { id: 'materiais_obra', path: '/materiais-por-obra', label: 'Materiais por Obra', icon: Construction },
    { id: 'equipamentos', path: '/equipamentos', label: 'Equipamentos', icon: Wrench },
    { id: 'epis', path: '/rh/epis', label: 'EPIs', icon: HardHat },
    { id: 'qrcode', path: '/qrcode', label: 'QR Code', icon: QrCode },
    { id: 'fornecedores', path: '/suppliers', label: 'Fornecedores', icon: Truck },
    { id: 'compras', path: '/compras', label: 'Compras', icon: ShoppingCart },
    { id: 'solicitacoes', path: '/solicitacoes', label: 'Solicitações', icon: ClipboardList },
    { id: 'funcionarios', path: '/employees', label: 'Funcionários', icon: Users },
    { id: 'financeiro', path: '/financeiro/dashboard', label: 'Financeiro', icon: Wallet },
    { id: 'documentos', path: '/documentos', label: 'Documentos', icon: FolderOpen },
    { id: 'relatorios', path: '/relatorios', label: 'Relatórios', icon: BarChart3 },
    { id: 'configuracoes', path: '/settings', label: 'Configurações', icon: Settings },
    { id: 'auditoria', path: '/auditoria', label: 'Auditoria', icon: ShieldCheck },
    { id: 'empresas', path: '/empresas', label: 'Cadastro de Empresas', icon: Building2 },
    { id: 'usuarios', path: '/usuarios', label: 'Gestão de Acessos', icon: UsersRound },
  ];

    // Agrupamento visual da barra lateral — só organiza a exibição, não muda
  // nenhuma rota, permissão ou coleção de dados.
  const GROUP_LABELS = {
    GESTAO: 'Gestão',
    SUPRIMENTOS: 'Suprimentos',
    FLUXO_COMPRA: 'Fluxo de Compra',
    PESSOAS: 'Pessoas',
    EMPRESA: 'Empresa',
  };
  const GROUP_BY_ID = {
    dashboard: 'GESTAO',
    financeiro: 'GESTAO',
    relatorios: 'GESTAO',
    documentos: 'GESTAO',
    auditoria: 'GESTAO',
    obras: 'GESTAO',
    minha_obra: 'GESTAO',
    ocorrencias: 'GESTAO',
    materiais: 'SUPRIMENTOS',
    equipamentos: 'SUPRIMENTOS',
    epis: 'SUPRIMENTOS',
    qrcode: 'SUPRIMENTOS',
    fornecedores: 'SUPRIMENTOS',
    solicitacoes: 'FLUXO_COMPRA',
    compras: 'FLUXO_COMPRA',
    estoque: 'SUPRIMENTOS',
    estoque_obras: 'SUPRIMENTOS',
    saldo_funcionario: 'SUPRIMENTOS',
    materiais_obra: 'SUPRIMENTOS',
    movimentacoes: 'SUPRIMENTOS',
    funcionarios: 'PESSOAS',
    usuarios: 'PESSOAS',
    empresas: 'EMPRESA',
    configuracoes: 'EMPRESA',
  };

  // "Minha Obra" só para quem tem cadastro de funcionário (é por ele que se sabe a obra).
  const visibleItems = menuItems
    .filter(item => hasPermission(item.id) && (item.id !== 'minha_obra' || !!currentUser?.funcionario_id))
    // Quem não vê o estoque só enxerga o próprio saldo.
    .map(item => (item.id === 'saldo_funcionario' && !podeVerEstoque(currentUser) ? { ...item, label: 'Meu Material' } : item));

  // Pick only the longest (most specific) matching path as active,
  // so a parent route never lights up together with a more specific
  // nested route that happens to share the same prefix.
  const activePath = visibleItems.reduce((best, item) => {
    const matches = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
    if (matches && (!best || item.path.length > best.length)) return item.path;
    return best;
  }, null);
  const isActive = (path) => path === activePath;

  const handleNavClick = () => {
    if (isMobile) setIsCollapsed(true);
  };

  return (
    <>
      {isMobile && !isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsCollapsed(true)}
        />
      )}
      <aside className={`fixed left-0 top-0 h-screen bg-marinho text-white shadow-xl z-50 transition-all duration-300 flex flex-col ${
        isMobile
          ? `w-64 ${isCollapsed ? '-translate-x-full' : 'translate-x-0'}`
          : (isCollapsed ? 'w-20' : 'w-64')
      }`}>
        <div 
          className="h-16 flex items-center justify-center border-b border-white/10 shrink-0 px-4 cursor-pointer hover:bg-white/5 transition-colors" 
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {(!isMobile && isCollapsed) ? (
            <img src="/app-obra-simbolo.svg" alt="APP OBRA" className="w-11 h-auto" draggable="false" />
          ) : (
            <Logo size="md" variant="light" />
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 custom-scrollbar">
          {visibleItems.map((item, idx) => {
            const active = isActive(item.path);
            const group = GROUP_BY_ID[item.id] || 'GESTÃO';
            const prevGroup = idx > 0 ? (GROUP_BY_ID[visibleItems[idx - 1].id] || 'GESTÃO') : null;
            const showGroupHeader = group !== prevGroup;
            const groupLabel = GROUP_LABELS[group];
            return (
              <React.Fragment key={item.id}>
                {showGroupHeader && (
                  <div className="px-4 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/40 select-none">
                    {groupLabel}
                  </div>
                )}
              <Link
                key={item.id}
                to={item.path}
                onClick={handleNavClick}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                  active 
                    ? 'bg-royal text-white font-semibold shadow-sm border-l-4 border-ouro' 
                    : 'text-white/80 hover:bg-white/10 hover:text-ouro font-medium'
                }`}
                title={(!isMobile && isCollapsed) ? item.label : undefined}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${active ? 'text-ouro' : 'group-hover:text-ouro'}`} />
                {(isMobile || !isCollapsed) && <span className="truncate">{item.label}</span>}
              </Link>
              </React.Fragment>
            );
          })}
        </div>
        
        {(isMobile || !isCollapsed) && (
          <div className="p-4 border-t border-white/10 text-xs text-white/50 text-center space-y-3">
            <BotaoInstalar variant="default" className="w-full" />
            <div>DNM&LTDA © {new Date().getFullYear()}</div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;

