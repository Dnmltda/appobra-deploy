import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useLanguage } from '@/contexts/LanguageContext.jsx';
import { t } from '@/lib/translations.js';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { User, LogOut, Settings, Globe, Menu, UserCircle, Shield } from 'lucide-react';
import NotificationsCenter from './NotificationsCenter.jsx';
import Sidebar from './Sidebar.jsx';

const Header = () => {
  const { isAuthenticated, currentUser, isAdmin, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const applyPadding = () => {
      if (isAuthenticated) {
        const isMobile = window.innerWidth < 1024;
        document.body.style.paddingLeft = isMobile
          ? '0px'
          : (isSidebarCollapsed ? '5rem' : '16rem');
        document.body.style.transition = 'padding-left 0.3s';
      } else {
        document.body.style.paddingLeft = '0px';
      }
    };
    applyPadding();
    window.addEventListener('resize', applyPadding);
    return () => {
      window.removeEventListener('resize', applyPadding);
      document.body.style.paddingLeft = '0px';
    };
  }, [isAuthenticated, isSidebarCollapsed]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    localStorage.setItem('appobra_language', lang);
  };

  const languageFlags = {
    'pt-BR': '🇧🇷',
    'en-US': '🇺🇸',
    'es-ES': '🇪🇸'
  };

  return (
    <>
      {isAuthenticated && (
        <Sidebar isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed} />
      )}

      <header 
        className="sticky top-0 z-40 w-full bg-marinho text-white shadow-md"
      >
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              {isAuthenticated && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-white hover:bg-white/10"
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                >
                  <Menu className="w-6 h-6" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-4 ml-auto">
              {isAuthenticated ? (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-ouro">
                        <Globe className="w-5 h-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>{t('selecionarIdioma', language)}</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleLanguageChange('pt-BR')} className={language === 'pt-BR' ? 'bg-accent/10 text-accent font-medium' : ''}>
                        {languageFlags['pt-BR']} Português (Brasil)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleLanguageChange('en-US')} className={language === 'en-US' ? 'bg-accent/10 text-accent font-medium' : ''}>
                        {languageFlags['en-US']} English
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleLanguageChange('es-ES')} className={language === 'es-ES' ? 'bg-accent/10 text-accent font-medium' : ''}>
                        {languageFlags['es-ES']} Español
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <NotificationsCenter />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="gap-2 text-white hover:bg-white/10 hover:text-ouro transition-all px-2 sm:px-4">
                        <User className="w-5 h-5" />
                        <div className="hidden sm:flex flex-col items-start">
                          <span className="font-medium max-w-[120px] truncate text-sm">
                            {currentUser?.name || currentUser?.nome_completo || currentUser?.email}
                          </span>
                          <span className="text-xs text-white/70">
                            {currentUser?.cargo || currentUser?.role || 'Usuário'}
                          </span>
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="truncate">{currentUser?.email}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer py-2">
                        <UserCircle className="w-4 h-4 mr-2 text-muted-foreground" />
                        Ver Perfil
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer py-2">
                        <Settings className="w-4 h-4 mr-2 text-muted-foreground" />
                        {t('configuracoes', language)}
                      </DropdownMenuItem>
                      {isAdmin && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => navigate('/admin/security')} className="cursor-pointer py-2">
                            <Shield className="w-4 h-4 mr-2 text-muted-foreground" />
                            Painel de Segurança
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="cursor-pointer py-2 text-destructive focus:bg-destructive/10 focus:text-destructive">
                        <LogOut className="w-4 h-4 mr-2" />
                        {t('sair', language)}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Button asChild className="bg-ouro text-marinho hover:bg-ouro-escuro font-bold transition-all shadow-sm">
                  <Link to="/login">{t('adminLogin', language)}</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
