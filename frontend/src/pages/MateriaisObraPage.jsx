import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Building2, Download, Package, Wallet } from 'lucide-react';
import { toast } from 'sonner';

// Materiais usados em cada obra (pedido do Diego, 19/10/2026). Junta:
//  - saídas "Consumo de Obra" do estoque (material entregue direto na obra);
//  - usos registrados no Saldo por Funcionário (material que estava com o
//    funcionário e ele disse onde usou).
// Material retirado por funcionário e ainda não usado NÃO conta: ele está com
// a pessoa (Saldo por Funcionário), não gasto na obra.

const formatCurrency = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNumber = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const formatDate = (d) => {
  if (!d) return '-';
  const date = new Date(String(d).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
};

const MateriaisObraPage = () => {
  const { currentUser } = useAuth();
  const companyId = currentUser?.company_id;
  const [obras, setObras] = useState([]);
  const [usos, setUsos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [obraId, setObraId] = useState('all');

  const fetchAll = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    try {
      const [obs, consumos, utilizacoes] = await Promise.all([
        pb.collection('obras').getFullList({ filter: `company_id = "${companyId}"`, sort: 'nome', $autoCancel: false }),
        pb.collection('movimentacoes').getFullList({
          filter: `company_id = "${companyId}" && tipo = "Consumo de Obra" && estoque_aplicado = true && obra_id != ""`,
          sort: '-created',
          expand: 'material_id,responsavel_id',
          $autoCancel: false,
        }),
        pb.collection('saldo_funcionario').getFullList({
          filter: `company_id = "${companyId}" && tipo_operacao = "Utilização" && obra_id != ""`,
          sort: '-created',
          expand: 'material_id,funcionario_id',
          $autoCancel: false,
        }),
      ]);
      setObras(obs);
      setUsos([
        ...consumos.map((m) => ({
          id: m.id,
          obra_id: m.obra_id,
          material_id: m.material_id,
          material: m.expand?.material_id?.name || 'Material',
          unidade: m.unidade || m.expand?.material_id?.unit || '',
          quantidade: Number(m.quantidade || 0),
          valor: Number(m.valor_total || 0),
          data: m.data || m.created,
          quem: m.expand?.responsavel_id?.name || '-',
          local: '',
          origem: 'Entregue na obra',
        })),
        ...utilizacoes.map((u) => ({
          id: u.id,
          obra_id: u.obra_id,
          material_id: u.material_id,
          material: u.expand?.material_id?.name || 'Material',
          unidade: u.expand?.material_id?.unit || '',
          quantidade: Number(u.quantidade || 0),
          valor: Number(u.valor_total || 0),
          data: u.data_operacao || u.created,
          quem: u.expand?.funcionario_id?.nome || '-',
          local: u.local_uso || '',
          origem: 'Uso do funcionário',
        })),
      ].sort((a, b) => String(b.data).localeCompare(String(a.data))));
    } catch (err) {
      console.error('Erro ao carregar materiais por obra:', err);
      setError(true);
      toast.error('Erro ao carregar materiais por obra');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const doFiltro = useMemo(
    () => (obraId === 'all' ? usos : usos.filter((u) => u.obra_id === obraId)),
    [usos, obraId],
  );

  // Totais por obra (cartões) e por material (tabela).
  const porObra = useMemo(() => {
    const map = new Map();
    usos.forEach((u) => {
      const t = map.get(u.obra_id) || { valor: 0, lancamentos: 0 };
      t.valor += u.valor;
      t.lancamentos += 1;
      map.set(u.obra_id, t);
    });
    return map;
  }, [usos]);

  const porMaterial = useMemo(() => {
    const map = new Map();
    doFiltro.forEach((u) => {
      const t = map.get(u.material_id) || { material: u.material, unidade: u.unidade, quantidade: 0, valor: 0 };
      t.quantidade += u.quantidade;
      t.valor += u.valor;
      map.set(u.material_id, t);
    });
    return [...map.values()].sort((a, b) => b.valor - a.valor);
  }, [doFiltro]);

  const totalGasto = doFiltro.reduce((s, u) => s + u.valor, 0);
  const nomeObra = (id) => obras.find((o) => o.id === id)?.nome || 'Obra';

  const handleExport = () => {
    const rows = [['Data', 'Obra', 'Material', 'Quantidade', 'Unidade', 'Valor', 'Local', 'Quem', 'Origem']];
    doFiltro.forEach((u) => rows.push([
      formatDate(u.data), nomeObra(u.obra_id), u.material, String(u.quantidade), u.unidade,
      u.valor.toFixed(2), u.local, u.quem, u.origem,
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `materiais-por-obra-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Helmet>
        <title>Materiais por Obra - DNM&LTDA</title>
        <meta name="description" content="Materiais usados e valor gasto em cada obra" />
      </Helmet>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1">Materiais por Obra</h1>
            <p className="text-muted-foreground">
              O que cada obra já usou e quanto custou: material entregue direto na obra e usos registrados pelos funcionários
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger className="w-[220px]" aria-label="Obra"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as obras</SelectItem>
                {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExport} disabled={doFiltro.length === 0}>
              <Download className="w-4 h-4 mr-2" />Exportar
            </Button>
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
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{obraId === 'all' ? 'Gasto em todas as obras' : `Gasto em ${nomeObra(obraId)}`}</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(totalGasto)}</p>
                    <p className="text-xs text-muted-foreground">{porMaterial.length} material(is)</p>
                  </div>
                  <Wallet className="w-8 h-8 text-primary/30" />
                </CardContent>
              </Card>
              {obraId === 'all' && obras.filter((o) => porObra.has(o.id)).map((o) => (
                <Card key={o.id} className="cursor-pointer hover:border-primary" onClick={() => setObraId(o.id)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{o.nome}</p>
                      <p className="text-xl font-bold">{formatCurrency(porObra.get(o.id).valor)}</p>
                      <p className="text-xs text-muted-foreground">{porObra.get(o.id).lancamentos} lançamento(s)</p>
                    </div>
                    <Building2 className="w-8 h-8 text-primary/30 shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mb-6">
              <CardHeader className="pb-2"><CardTitle className="text-lg">Por material</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Quantidade usada</TableHead>
                      <TableHead className="text-right">Valor gasto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {porMaterial.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          Nenhum material usado {obraId === 'all' ? 'nas obras' : 'nesta obra'} ainda.
                        </TableCell>
                      </TableRow>
                    ) : porMaterial.map((m) => (
                      <TableRow key={m.material}>
                        <TableCell className="font-medium">{m.material}</TableCell>
                        <TableCell>{formatNumber(m.quantidade)} {m.unidade}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(m.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-lg">Lançamentos</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      {obraId === 'all' && <TableHead>Obra</TableHead>}
                      <TableHead>Material</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Onde</TableHead>
                      <TableHead>Quem</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doFiltro.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum lançamento.</TableCell>
                      </TableRow>
                    ) : doFiltro.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{formatDate(u.data)}</TableCell>
                        {obraId === 'all' && <TableCell>{nomeObra(u.obra_id)}</TableCell>}
                        <TableCell className="font-medium">{u.material}</TableCell>
                        <TableCell>{formatNumber(u.quantidade)} {u.unidade}</TableCell>
                        <TableCell>{u.local || <span className="text-muted-foreground">{u.origem}</span>}</TableCell>
                        <TableCell>{u.quem}</TableCell>
                        <TableCell className="text-right">{formatCurrency(u.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
};

export default MateriaisObraPage;
