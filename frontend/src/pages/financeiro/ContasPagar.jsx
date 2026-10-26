import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient.js';
import { useLanguage } from '@/contexts/LanguageContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { t } from '@/lib/translations.js';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Plus, Pencil, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header.jsx';
import { falhaAoCarregar, mensagemErro } from '@/lib/erros.js';

// Contas a pagar (Bloco 4, aprovado pelo Diego em 26/10/2026): cadastrar,
// editar enquanto está em aberto e dar baixa. Conta paga fica fechada (regra
// "nada se apaga": não muda mais; o servidor recusa, pb_hooks/contas-pagar.pb.js).
const VAZIO = { fornecedorId: '', descricao: '', valor: '', data_vencimento: '', observacao: '' };
const hoje = () => new Date().toISOString().split('T')[0];

const ContasPagar = () => {
  const { language } = useLanguage();
  const { currentUser } = useAuth();
  const [data, setData] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    if (!currentUser?.company_id) return;
    pb.collection('contas_pagar').getFullList({
      filter: `company_id = "${currentUser.company_id}"`,
      expand: 'fornecedorId',
      sort: 'data_vencimento',
      $autoCancel: false
    }).then(setData).catch(falhaAoCarregar('as contas a pagar'));
  }, [currentUser]);

  useEffect(() => {
    carregar();
    if (currentUser?.company_id) {
      pb.collection('fornecedores').getFullList({ filter: `company_id = "${currentUser.company_id}" && deleted_at = ""`, sort: 'nome', $autoCancel: false })
        .then(setFornecedores).catch(falhaAoCarregar('os fornecedores'));
    }
  }, [carregar, currentUser]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  const vencida = (c) => c.status !== 'Paga' && c.data_vencimento && c.data_vencimento.slice(0, 10) < hoje();

  const novo = () => { setEditando(null); setForm(VAZIO); setAberto(true); };
  const editar = (c) => {
    setEditando(c);
    setForm({
      fornecedorId: c.fornecedorId || '', descricao: c.descricao || '', valor: c.valor ?? '',
      data_vencimento: c.data_vencimento ? c.data_vencimento.slice(0, 10) : '', observacao: c.observacao || '',
    });
    setAberto(true);
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.descricao.trim() || !(Number(form.valor) > 0) || !form.data_vencimento) {
      toast.error('Preencha a descrição, o valor e o vencimento.');
      return;
    }
    setSalvando(true);
    const corpo = {
      fornecedorId: form.fornecedorId || '', descricao: form.descricao.trim(), valor: Number(form.valor),
      data_vencimento: form.data_vencimento, observacao: form.observacao || '', company_id: currentUser.company_id,
    };
    try {
      if (editando) {
        await pb.collection('contas_pagar').update(editando.id, corpo, { $autoCancel: false });
        toast.success('Conta atualizada');
      } else {
        await pb.collection('contas_pagar').create({ ...corpo, status: 'Aberta' }, { $autoCancel: false });
        toast.success('Conta cadastrada');
      }
      setAberto(false);
      carregar();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível salvar a conta.'));
    } finally {
      setSalvando(false);
    }
  };

  const darBaixa = async (c) => {
    if (!window.confirm(`Dar baixa em "${c.descricao}" (${formatCurrency(c.valor)})? Depois de paga, a conta não pode mais ser alterada.`)) return;
    try {
      await pb.collection('contas_pagar').update(c.id, { status: 'Paga', data_pagamento: hoje() }, { $autoCancel: false });
      toast.success('Baixa registrada');
      carregar();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível dar baixa.'));
    }
  };

  const emAberto = data.filter((c) => c.status !== 'Paga').reduce((s, c) => s + Number(c.valor || 0), 0);

  return (
    <>
      <Helmet><title>{t('accountsPayable', language)} - DNM&LTDA</title></Helmet>
      <Header />
      <main className="py-8">
        <div className="app-container">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2 text-primary">{t('accountsPayable', language)}</h1>
              <p className="text-muted-foreground">Gestão de obrigações financeiras</p>
            </div>
            <Dialog open={aberto} onOpenChange={setAberto}>
              <DialogTrigger asChild>
                <Button onClick={novo}><Plus className="w-4 h-4 mr-2" /> Nova conta</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader><DialogTitle>{editando ? 'Editar conta a pagar' : 'Nova conta a pagar'}</DialogTitle></DialogHeader>
                <form onSubmit={salvar} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cp_fornecedor">Fornecedor</Label>
                    <Select value={form.fornecedorId || 'nenhum'} onValueChange={(v) => setForm({ ...form, fornecedorId: v === 'nenhum' ? '' : v })}>
                      <SelectTrigger id="cp_fornecedor"><SelectValue placeholder="Escolha o fornecedor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Sem fornecedor</SelectItem>
                        {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cp_descricao">Descrição *</Label>
                    <Input id="cp_descricao" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cp_valor">Valor (R$) *</Label>
                      <Input id="cp_valor" type="number" step="0.01" min="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cp_vencimento">Vencimento *</Label>
                      <Input id="cp_vencimento" type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cp_observacao">Observação</Label>
                    <Textarea id="cp_observacao" rows={3} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
                    <Button type="submit" disabled={salvando}>{editando ? 'Atualizar' : 'Cadastrar'}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Card><CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total em aberto</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(emAberto)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Contas vencidas</p>
              <p className="text-2xl font-bold text-red-700">{data.filter(vencida).length}</p>
            </CardContent></Card>
          </div>

          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>{t('description', language)}</TableHead>
                    <TableHead>{t('supplier', language)}</TableHead>
                    <TableHead className="text-right">{t('amount', language)}</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>{t('status', language)}</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12"><FileText className="w-8 h-8 mx-auto text-muted-foreground opacity-30 mb-2"/>{t('noData', language)}</TableCell></TableRow>
                  ) : data.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.descricao}</TableCell>
                      <TableCell>{item.expand?.fornecedorId?.nome || '—'}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.valor)}</TableCell>
                      <TableCell>{item.data_vencimento ? new Date(item.data_vencimento.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 font-semibold rounded-full ${item.status === 'Paga' ? 'bg-green-100 text-green-800' : vencida(item) ? 'bg-red-100 text-red-800' : 'bg-muted text-muted-foreground'}`}>
                          {item.status === 'Paga' ? `Paga${item.data_pagamento ? ' em ' + new Date(item.data_pagamento.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : ''}` : vencida(item) ? 'Vencida' : (item.status || 'Aberta')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {item.status !== 'Paga' && (
                          <>
                            <Button size="sm" variant="ghost" title="Editar" onClick={() => editar(item)}><Pencil className="w-4 h-4" /></Button>
                            <Button size="sm" variant="outline" onClick={() => darBaixa(item)}><CheckCircle2 className="w-4 h-4 mr-1" /> Dar baixa</Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
};

export default ContasPagar;
