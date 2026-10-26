import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient.js';
import { useLanguage } from '@/contexts/LanguageContext.jsx';
import { t } from '@/lib/translations.js';
import Header from '@/components/Header.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Filter, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const AuditPage = () => {
  const { language } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    action: '',
    module: '',
    user: '',
    status: 'all'
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 20;

  useEffect(() => {
    fetchAuditLogs();
  }, [page]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      let filterQuery = '';
      const filterParts = [];

      if (filters.startDate) {
        filterParts.push(`data >= "${filters.startDate}"`);
      }
      if (filters.endDate) {
        filterParts.push(`data <= "${filters.endDate}"`);
      }
      if (filters.action) {
        filterParts.push(`acao ~ "${filters.action}"`);
      }
      if (filters.module) {
        filterParts.push(`modulo ~ "${filters.module}"`);
      }
      if (filters.user) {
        filterParts.push(`usuario ~ "${filters.user}"`);
      }
      if (filters.status && filters.status !== 'all') {
        filterParts.push(`status = "${filters.status}"`);
      }

      if (filterParts.length > 0) {
        filterQuery = filterParts.join(' && ');
      }

      const result = await pb.collection('audit_logs').getList(page, perPage, {
        filter: filterQuery,
        sort: '-created', // PocketBase default timestamp
        expand: 'usuario_id',
        $autoCancel: false
      });

      setLogs(result.items);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error(t('erroCarregar', language));
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyFilters = () => {
    setPage(1);
    fetchAuditLogs();
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      action: '',
      module: '',
      user: '',
      status: 'all'
    });
    setPage(1);
    setTimeout(fetchAuditLogs, 100);
  };

  return (
    <>
      <Helmet>
        <title>{t('auditoria', language)} - DNM&LTDA OBRAS</title>
      </Helmet>
      <Header />
      <main className="py-8">
        <div className="app-container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 text-primary">{t('auditoria', language)}</h1>
            <p className="text-muted-foreground">Registro completo de ações e acessos no sistema</p>
          </div>

          <Card className="mb-6 shadow-sm border-border bg-card">
            <CardHeader>
              <CardTitle className="text-primary text-lg flex items-center gap-2">
                <Filter className="w-5 h-5" />
                {t('filtrar', language)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">{t('data', language)} Inicial</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">{t('data', language)} Final</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user">{t('usuario', language)}</Label>
                  <Input
                    id="user"
                    type="text"
                    placeholder={t('buscar', language)}
                    value={filters.user}
                    onChange={(e) => handleFilterChange('user', e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action">{t('acao', language)}</Label>
                  <Input
                    id="action"
                    type="text"
                    placeholder={t('buscar', language)}
                    value={filters.action}
                    onChange={(e) => handleFilterChange('action', e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="module">{t('modulo', language)}</Label>
                  <Input
                    id="module"
                    type="text"
                    placeholder={t('buscar', language)}
                    value={filters.module}
                    onChange={(e) => handleFilterChange('module', e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('estado', language)}</Label>
                  <Select value={filters.status} onValueChange={(val) => handleFilterChange('status', val)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('todas', language)}</SelectItem>
                      <SelectItem value="success">{t('sucessoStatus', language)}</SelectItem>
                      <SelectItem value="failure">{t('falhaStatus', language)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleApplyFilters} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Search className="w-4 h-4 mr-2" />
                  {t('buscar', language)}
                </Button>
                <Button onClick={handleClearFilters} variant="outline">
                  Limpar Filtros
                </Button>
                {/* Botão "Exportar" escondido até a função existir (Bloco 4; ver docs/ideias-futuras.md). */}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border bg-card">
            <CardHeader>
              <CardTitle className="text-primary text-lg">Registros de Auditoria</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                </div>
              ) : logs.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  {t('nenhumRegistro', language)}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-[180px]">{t('dataHora', language)}</TableHead>
                          <TableHead>{t('usuario', language)}</TableHead>
                          <TableHead>{t('acao', language)}</TableHead>
                          <TableHead className="hidden md:table-cell">{t('modulo', language)}</TableHead>
                          <TableHead className="hidden md:table-cell">{t('enderecoIP', language)}</TableHead>
                          <TableHead className="hidden lg:table-cell">{t('agenteUsuario', language)}</TableHead>
                          <TableHead className="w-[120px]">{t('estado', language)}</TableHead>
                          <TableHead className="hidden xl:table-cell">{t('detalhes', language)}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map(log => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {new Date(log.created).toLocaleDateString()} {new Date(log.created).toLocaleTimeString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{log.usuario || '-'}</span>
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{log.perfil || '-'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{log.acao}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="text-xs px-2 py-1 bg-accent/20 text-accent-foreground font-semibold rounded-full">
                                {log.modulo}
                              </span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm font-mono text-muted-foreground">{log.ip_address || '-'}</TableCell>
                            <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[200px] truncate" title={log.user_agent}>
                              {log.user_agent || log.navegador || '-'}
                            </TableCell>
                            <TableCell>
                              {log.status === 'success' || !log.status ? (
                                <div className="flex items-center gap-1.5 text-success font-medium">
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="text-sm">{t('sucessoStatus', language)}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-destructive font-medium">
                                  <XCircle className="w-4 h-4" />
                                  <span className="text-sm">{t('falhaStatus', language)}</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="hidden xl:table-cell max-w-[250px] truncate text-sm" title={log.detalhes}>
                              {log.detalhes || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        Página {page} de {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
};

export default AuditPage;