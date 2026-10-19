import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle, ArrowLeftCircle, ArrowRightCircle, Building2, Hammer, Package, Wallet, Warehouse,
} from 'lucide-react';
import { toast } from 'sonner';
import { mensagemErro } from '@/lib/erros.js';
import { podeGerirEstoque } from '@/lib/permissoes.js';

// Estoque geral + estoque de cada obra (pedido do Diego, 19/10/2026).
// A compra entra no estoque geral (tela Estoque) e o almoxarifado distribui
// para cada obra. O saldo de cada obra é do servidor (coleção estoque_obra);
// esta tela só lança movimentações:
//   - "Transferência para Obra": geral -> obra;
//   - "Devolução da Obra": obra -> geral;
//   - "Consumo de Obra" com estoque da obra: usado na obra (vira gasto da obra).

const formatCurrency = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNumber = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const formatDate = (d) => {
  if (!d) return '-';
  const date = new Date(String(d).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
};

const ACAO = {
  transferir: { tipo: 'Transferência para Obra', titulo: 'Transferir do estoque geral para a obra', botao: 'Transferir' },
  devolver: { tipo: 'Devolução da Obra', titulo: 'Devolver ao estoque geral', botao: 'Devolver' },
  consumo: { tipo: 'Consumo de Obra', titulo: 'Registrar consumo na obra', botao: 'Registrar consumo' },
};

const EstoqueObrasPage = () => {
  const { currentUser } = useAuth();
  const companyId = currentUser?.company_id;
  const podeMovimentar = podeGerirEstoque(currentUser);
  const [obras, setObras] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [saldos, setSaldos] = useState([]);
  const [movs, setMovs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [obraId, setObraId] = useState('');
  const [acao, setAcao] = useState(null); // { tipo: 'transferir'|'devolver'|'consumo', materialId }
  const [form, setForm] = useState({ material_id: '', quantidade: '', observacoes: '' });
  const [salvando, setSalvando] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    try {
      const [obs, mats, sds, mvs] = await Promise.all([
        pb.collection('obras').getFullList({ filter: `company_id = "${companyId}"`, sort: 'nome', $autoCancel: false }),
        pb.collection('materiais').getFullList({ filter: `company_id = "${companyId}"`, sort: 'name', $autoCancel: false }),
        pb.collection('estoque_obra').getFullList({ filter: `company_id = "${companyId}"`, $autoCancel: false }),
        pb.collection('movimentacoes').getList(1, 200, {
          filter: `company_id = "${companyId}" && estoque_obra_id != ""`,
          sort: '-created',
          expand: 'material_id,responsavel_id',
          $autoCancel: false,
        }),
      ]);
      setObras(obs);
      setMateriais(mats);
      setSaldos(sds);
      setMovs(mvs.items);
      setObraId((atual) => atual || obs[0]?.id || '');
    } catch (err) {
      console.error('Erro ao carregar estoque das obras:', err);
      setError(true);
      toast.error('Erro ao carregar o estoque das obras');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const material = (id) => materiais.find((m) => m.id === id);
  const saldoDaObra = useMemo(
    () => saldos
      .filter((s) => s.obra_id === obraId && Number(s.quantidade) > 0)
      .map((s) => {
        const m = material(s.material_id);
        return { ...s, nome: m?.name || 'Material', unidade: m?.unit || '', valor: Number(s.quantidade) * Number(m?.unit_cost || 0) };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saldos, obraId, materiais],
  );
  const valorPorObra = useMemo(() => {
    const map = new Map();
    saldos.forEach((s) => {
      const m = material(s.material_id);
      map.set(s.obra_id, (map.get(s.obra_id) || 0) + Number(s.quantidade || 0) * Number(m?.unit_cost || 0));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saldos, materiais]);
  const movsDaObra = movs.filter((m) => m.estoque_obra_id === obraId);
  const nomeObra = obras.find((o) => o.id === obraId)?.nome || 'Obra';

  // Quanto dá para lançar: do geral na transferência, da obra nos outros.
  const disponivel = (tipo, materialId) => {
    if (!materialId) return null;
    if (tipo === 'transferir') return Number(material(materialId)?.quantity_in_stock || 0);
    return Number(saldos.find((s) => s.obra_id === obraId && s.material_id === materialId)?.quantidade || 0);
  };

  const abrir = (tipo, materialId = '') => {
    setForm({ material_id: materialId, quantidade: '', observacoes: '' });
    setAcao({ tipo });
  };

  const salvar = async (e) => {
    e.preventDefault();
    const qtd = Number(String(form.quantidade).replace(',', '.'));
    if (!form.material_id) { toast.error('Escolha o material.'); return; }
    if (!(qtd > 0)) { toast.error('A quantidade precisa ser maior que zero.'); return; }
    const max = disponivel(acao.tipo, form.material_id);
    if (qtd > max) {
      toast.error(`Quantidade maior do que a disponível (${formatNumber(max)}).`);
      return;
    }
    const m = material(form.material_id);
    setSalvando(true);
    try {
      await pb.collection('movimentacoes').create({
        company_id: companyId,
        material_id: form.material_id,
        tipo: ACAO[acao.tipo].tipo,
        quantidade: qtd,
        unidade: m?.unit || '',
        valor_unitario: Number(m?.unit_cost || 0),
        valor_total: Number((qtd * Number(m?.unit_cost || 0)).toFixed(2)),
        obra_id: obraId,
        estoque_obra_id: obraId,
        origem: acao.tipo === 'transferir' ? 'Almoxarifado' : 'Estoque da obra',
        destino: acao.tipo === 'transferir' ? 'Obra' : acao.tipo === 'devolver' ? 'Almoxarifado' : 'Obra',
        status: 'Aprovado',
        observacoes: form.observacoes,
        responsavel_id: currentUser.id,
        criado_por: currentUser.id,
        data: new Date().toISOString().replace('T', ' '),
      });
      toast.success(acao.tipo === 'transferir' ? `Transferido para ${nomeObra}`
        : acao.tipo === 'devolver' ? 'Devolvido ao estoque geral' : 'Consumo registrado');
      setAcao(null);
      fetchAll();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível registrar'));
    } finally {
      setSalvando(false);
    }
  };

  const opcoesMaterial = acao?.tipo === 'transferir'
    ? materiais.filter((m) => Number(m.quantity_in_stock) > 0 && !m.deleted_at)
    : saldoDaObra.map((s) => material(s.material_id)).filter(Boolean);
  const max = acao ? disponivel(acao.tipo, form.material_id) : null;
  const totalObra = saldoDaObra.reduce((s, x) => s + x.valor, 0);

  return (
    <>
      <Helmet>
        <title>Estoque por Obra - DNM&LTDA</title>
        <meta name="description" content="Estoque de cada obra, abastecido pelo estoque geral" />
      </Helmet>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1">Estoque por Obra</h1>
            <p className="text-muted-foreground">
              A compra entra no <Link to="/estoque" className="underline">estoque geral</Link> e é distribuída para cada obra
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={obraId} onValueChange={setObraId} disabled={!obras.length}>
              <SelectTrigger className="w-[220px]" aria-label="Obra"><SelectValue placeholder="Escolha a obra" /></SelectTrigger>
              <SelectContent>
                {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {podeMovimentar && (
              <Button onClick={() => abrir('transferir')} disabled={!obraId}>
                <ArrowRightCircle className="w-4 h-4 mr-2" />Transferir do estoque geral
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : error ? (
          <div className="text-center py-16">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="mb-4">Não foi possível carregar os dados.</p>
            <Button onClick={fetchAll}>Tentar novamente</Button>
          </div>
        ) : !obras.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-40" />
            Cadastre uma obra para ter um estoque nela.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Em estoque em {nomeObra}</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(totalObra)}</p>
                    <p className="text-xs text-muted-foreground">{saldoDaObra.length} material(is)</p>
                  </div>
                  <Wallet className="w-8 h-8 text-primary/30" />
                </CardContent>
              </Card>
              {obras.filter((o) => o.id !== obraId && valorPorObra.get(o.id) > 0).map((o) => (
                <Card key={o.id} className="cursor-pointer hover:border-primary" onClick={() => setObraId(o.id)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{o.nome}</p>
                      <p className="text-xl font-bold">{formatCurrency(valorPorObra.get(o.id))}</p>
                    </div>
                    <Warehouse className="w-8 h-8 text-primary/30 shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mb-6">
              <CardHeader className="pb-2"><CardTitle className="text-lg">Materiais na obra</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      {podeMovimentar && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saldoDaObra.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          Nenhum material no estoque desta obra. Use "Transferir do estoque geral".
                        </TableCell>
                      </TableRow>
                    ) : saldoDaObra.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.nome}</TableCell>
                        <TableCell>{formatNumber(s.quantidade)} {s.unidade}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.valor)}</TableCell>
                        {podeMovimentar && (
                          <TableCell className="text-right whitespace-nowrap">
                            <Button size="sm" variant="ghost" title="Registrar consumo na obra" onClick={() => abrir('consumo', s.material_id)}>
                              <Hammer className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Devolver ao estoque geral" onClick={() => abrir('devolver', s.material_id)}>
                              <ArrowLeftCircle className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-lg">Movimentações do estoque da obra</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Quem</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movsDaObra.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma movimentação.</TableCell>
                      </TableRow>
                    ) : movsDaObra.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{formatDate(m.data || m.created)}</TableCell>
                        <TableCell>{m.tipo}</TableCell>
                        <TableCell className="font-medium">{m.expand?.material_id?.name || '-'}</TableCell>
                        <TableCell>{formatNumber(m.quantidade)} {m.unidade}</TableCell>
                        <TableCell>{m.expand?.responsavel_id?.name || '-'}</TableCell>
                        <TableCell>{m.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={!!acao} onOpenChange={(o) => !o && setAcao(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{acao ? ACAO[acao.tipo].titulo : ''}</DialogTitle>
          </DialogHeader>
          {acao && (
            <form onSubmit={salvar} className="space-y-4">
              <p className="text-sm text-muted-foreground">Obra: <span className="font-medium text-foreground">{nomeObra}</span></p>
              <div className="space-y-2">
                <Label htmlFor="eo-material">Material *</Label>
                <Select value={form.material_id} onValueChange={(v) => setForm({ ...form, material_id: v })}>
                  <SelectTrigger id="eo-material" aria-label="Material *"><SelectValue placeholder="Escolha o material" /></SelectTrigger>
                  <SelectContent>
                    {opcoesMaterial.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {max !== null && (
                  <p className="text-xs text-muted-foreground">
                    {acao.tipo === 'transferir' ? 'No estoque geral' : 'No estoque da obra'}: {formatNumber(max)} {material(form.material_id)?.unit || ''}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="eo-qtd">Quantidade *</Label>
                <Input id="eo-qtd" type="number" min="0" step="any" value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eo-obs">{acao.tipo === 'consumo' ? 'Onde foi usado' : 'Observações'}</Label>
                <Textarea id="eo-obs" rows={2} value={form.observacoes}
                  placeholder={acao.tipo === 'consumo' ? 'Ex.: laje do 2º andar' : ''}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAcao(null)}>Cancelar</Button>
                <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : ACAO[acao.tipo].botao}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EstoqueObrasPage;
