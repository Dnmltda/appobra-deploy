import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useAuth } from "@/contexts/AuthContext.jsx";
import { useCompras } from "@/hooks/useCompras.js";
import {
  STATUS_COMPRA, PRIORIDADES, FORMAS_PAGAMENTO, CATEGORIAS_SUGERIDAS,
  statusColor, prioridadeColor, formatCurrency, formatDate, generateNumeroCompra,
} from "@/utils/comprasValidations.js";
import Header from "@/components/Header.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus, Search, Pencil, Eye, Copy, Trash2, Ban, FileText, FileDown,
  ShoppingCart, TrendingUp, Clock, CheckCircle2, XCircle, Package, Filter, X,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

const emptyForm = {
  fornecedor_id: "", obra_id: "", solicitante_id: "", comprador_id: "",
  categoria: "", subcategoria: "", centro_custo: "", prioridade: "Normal",
  justificativa: "", observacoes: "", data_solicitacao: new Date().toISOString().split("T")[0],
  data_entrega_prevista: "", status: "Solicitado", valor_previsto: "",
  forma_pagamento: "À Vista", parcelas: 1,
};

const ComprasPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const h = useCompras();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (currentUser && !currentUser.company_id) {
      toast.error("Usuário sem empresa vinculada.");
    }
  }, [currentUser]);

  const stats = useMemo(() => {
    const all = h.compras;
    const total = all.length;
    const abertas = all.filter((c) => ["Solicitado", "Em Cotação", "Aguardando Aprovação", "Aprovado", "Pedido Emitido", "Em Transporte"].includes(c.status)).length;
    const aprovadas = all.filter((c) => ["Aprovado", "Pedido Emitido"].includes(c.status)).length;
    const pendentes = all.filter((c) => c.status === "Aguardando Aprovação").length;
    const canceladas = all.filter((c) => c.status === "Cancelado").length;
    const recebidas = all.filter((c) => ["Recebido", "Parcialmente Recebido"].includes(c.status)).length;
    const valorTotal = all.reduce((acc, c) => acc + Number(c.valor_final || c.valor || 0), 0);
    const now = new Date();
    const valorMes = all.filter((c) => {
      const d = new Date(c.data_solicitacao || c.created);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((acc, c) => acc + Number(c.valor_final || c.valor || 0), 0);
    const valorAno = all.filter((c) => new Date(c.data_solicitacao || c.created).getFullYear() === now.getFullYear())
      .reduce((acc, c) => acc + Number(c.valor_final || c.valor || 0), 0);
    return { total, abertas, aprovadas, pendentes, canceladas, recebidas, valorTotal, valorMes, valorAno };
  }, [h.compras]);

  const chartData = useMemo(() => {
    const meses = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("pt-BR", { month: "short" });
      meses[key] = { name: key, valor: 0 };
    }
    h.compras.forEach((c) => {
      const d = new Date(c.data_solicitacao || c.created);
      const key = d.toLocaleString("pt-BR", { month: "short" });
      if (meses[key]) meses[key].valor += Number(c.valor_final || c.valor || 0);
    });
    const porObra = {};
    h.compras.forEach((c) => {
      const nome = c.expand?.obra_id?.nome || "Sem obra";
      porObra[nome] = (porObra[nome] || 0) + Number(c.valor_final || c.valor || 0);
    });
    const porFornecedor = {};
    h.compras.forEach((c) => {
      const nome = c.expand?.fornecedor_id?.nome || "Sem fornecedor";
      porFornecedor[nome] = (porFornecedor[nome] || 0) + 1;
    });
    return {
      mensal: Object.values(meses),
      obras: Object.keys(porObra).map((k) => ({ name: k, valor: porObra[k] })),
      fornecedores: Object.keys(porFornecedor).map((k) => ({ name: k, value: porFornecedor[k] })),
    };
  }, [h.compras]);

  const pendentesAprovacao = h.compras.filter((c) => c.status === "Aguardando Aprovação").slice(0, 5);
  const emAtraso = h.compras.filter((c) => {
    if (!c.data_entrega_prevista || ["Recebido", "Cancelado"].includes(c.status)) return false;
    return new Date(c.data_entrega_prevista) < new Date();
  }).slice(0, 5);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, solicitante_id: currentUser?.id || "", numero_compra: generateNumeroCompra() });
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      fornecedor_id: c.fornecedor_id || "", obra_id: c.obra_id || "",
      solicitante_id: c.solicitante_id || "", comprador_id: c.comprador_id || "",
      categoria: c.categoria || "", subcategoria: c.subcategoria || "",
      centro_custo: c.centro_custo || "", prioridade: c.prioridade || "Normal",
      justificativa: c.justificativa || "", observacoes: c.observacoes || "",
      data_solicitacao: c.data_solicitacao ? c.data_solicitacao.split("T")[0] : "",
      data_entrega_prevista: c.data_entrega_prevista ? c.data_entrega_prevista.split("T")[0] : "",
      status: c.status || "Solicitado", valor_previsto: c.valor_previsto || "",
      forma_pagamento: c.forma_pagamento || "À Vista", parcelas: c.parcelas || 1,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const openDuplicate = (c) => {
    setEditing(null);
    setForm({ ...h.duplicateCompra(c), numero_compra: generateNumeroCompra() });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = editing ? await h.updateCompra(editing.id, form) : await h.createCompra(form);
    if (res.success) {
      toast.success(editing ? "Compra atualizada com sucesso" : "Compra cadastrada com sucesso");
      setDialogOpen(false);
    } else {
      setFormErrors(res.errors || {});
      if (res.errors?._form) toast.error(res.errors._form);
    }
  };

  const handleCancel = async () => {
    if (!cancelMotivo.trim()) { toast.error("Informe o motivo do cancelamento"); return; }
    const res = await h.cancelCompra(cancelTarget, cancelMotivo);
    if (res.success) { toast.success("Compra cancelada"); setCancelTarget(null); setCancelMotivo(""); }
    else toast.error(res.error);
  };

  const handleDelete = async () => {
    const res = await h.deleteCompra(deleteTarget);
    if (res.success) { toast.success("Compra excluída"); setDeleteTarget(null); }
    else toast.error(res.error);
  };

  const exportExcel = () => {
    import("xlsx").then((XLSX) => {
      const rows = h.compras.map((c) => ({
        Numero: c.numero_compra, Fornecedor: c.expand?.fornecedor_id?.nome || "",
        Solicitante: c.expand?.solicitante_id?.nome_completo || c.expand?.solicitante_id?.name || "",
        Obra: c.expand?.obra_id?.nome || "", Categoria: c.categoria,
        Valor: Number(c.valor_final || 0), Status: c.status, Prioridade: c.prioridade,
        Solicitacao: formatDate(c.data_solicitacao), Prevista: formatDate(c.data_entrega_prevista),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Compras");
      XLSX.writeFile(wb, "compras.xlsx");
      h.exportAudit("Excel");
    });
  };

  const printList = () => {
    window.print();
    h.exportAudit("Impressão");
  };

  const COLORS = ["#1a3a52", "#d4af37", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  const nomeFornecedor = (c) => c.expand?.fornecedor_id?.nome || c.expand?.fornecedor_id?.razao_social || "-";
  const nomeSolicitante = (c) => c.expand?.solicitante_id?.nome_completo || c.expand?.solicitante_id?.name || "-";
  const nomeObra = (c) => c.expand?.obra_id?.nome || "-";

  return (
    <>
      <Helmet>
        <title>Compras - APP OBRA | DNM&LTDA</title>
        <meta name="description" content="Gestão completa de compras: solicitação, cotação, aprovação, pedido, recebimento e anexos." />
      </Helmet>
      <Header />
      <main className="py-8 bg-muted/20 min-h-screen">
        <div className="app-container">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-primary">Gestão de Compras</h1>
              <p className="text-muted-foreground">Controle completo do ciclo de compras da obra</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={exportExcel}><FileDown className="w-4 h-4 mr-2" />Excel</Button>
              <Button variant="outline" onClick={printList}><FileText className="w-4 h-4 mr-2" />Imprimir</Button>
              {h.canEdit && <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nova Compra</Button>}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <Kpi icon={ShoppingCart} label="Total" value={stats.total} color="text-primary" />
            <Kpi icon={Clock} label="Abertas" value={stats.abertas} color="text-blue-600" />
            <Kpi icon={CheckCircle2} label="Aprovadas" value={stats.aprovadas} color="text-green-600" />
            <Kpi icon={Package} label="Recebidas" value={stats.recebidas} color="text-emerald-600" />
            <Kpi icon={XCircle} label="Canceladas" value={stats.canceladas} color="text-red-600" />
            <Kpi icon={TrendingUp} label="Valor Total" value={formatCurrency(stats.valorTotal)} color="text-accent" small />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Valor Mensal</p><p className="text-xl font-bold text-primary">{formatCurrency(stats.valorMes)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Valor Anual</p><p className="text-xl font-bold text-primary">{formatCurrency(stats.valorAno)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pendentes Aprovação</p><p className="text-xl font-bold text-amber-600">{stats.pendentes}</p></CardContent></Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-lg">Compras Mensais (12 meses)</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.mensal}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v / 1000}k`} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Line type="monotone" dataKey="valor" name="Valor" stroke="#1a3a52" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Por Fornecedor</CardTitle></CardHeader>
              <CardContent className="h-72">
                {chartData.fornecedores.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData.fornecedores} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        {chartData.fornecedores.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader><CardTitle className="text-lg">Valor por Obra</CardTitle></CardHeader>
            <CardContent className="h-64">
              {chartData.obras.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.obras}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v / 1000}k`} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Bar dataKey="valor" name="Valor" fill="#d4af37" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Pendentes e Atraso */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="border-amber-500/30">
              <CardHeader><CardTitle className="text-lg text-amber-700">Pendentes de Aprovação</CardTitle></CardHeader>
              <CardContent>
                {pendentesAprovacao.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma compra pendente</p> : (
                  <div className="space-y-2">
                    {pendentesAprovacao.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-amber-500/5 rounded-lg border border-amber-500/20">
                        <div><p className="font-semibold text-sm">{c.numero_compra}</p><p className="text-xs text-muted-foreground">{nomeFornecedor(c)} · {formatCurrency(c.valor_final || 0)}</p></div>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/compras/${c.id}`)}>Ver</Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border-red-500/30">
              <CardHeader><CardTitle className="text-lg text-red-700">Compras em Atraso</CardTitle></CardHeader>
              <CardContent>
                {emAtraso.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma compra em atraso</p> : (
                  <div className="space-y-2">
                    {emAtraso.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                        <div><p className="font-semibold text-sm">{c.numero_compra}</p><p className="text-xs text-muted-foreground">Previsto: {formatDate(c.data_entrega_prevista)}</p></div>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/compras/${c.id}`)}>Ver</Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Filtros + Tabela */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número, fornecedor, categoria..."
                    value={h.filters.search}
                    onChange={(e) => { h.setFilters({ ...h.filters, search: e.target.value }); h.setPage(1); }}
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" onClick={() => setShowFilters((s) => !s)}>
                  <Filter className="w-4 h-4 mr-2" />Filtros
                </Button>
              </div>

              {showFilters && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={h.filters.status} onValueChange={(v) => { h.setFilters({ ...h.filters, status: v }); h.setPage(1); }}>
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {STATUS_COMPRA.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Prioridade</Label>
                    <Select value={h.filters.prioridade} onValueChange={(v) => { h.setFilters({ ...h.filters, prioridade: v }); h.setPage(1); }}>
                      <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Obra</Label>
                    <Select value={h.filters.obra} onValueChange={(v) => { h.setFilters({ ...h.filters, obra: v }); h.setPage(1); }}>
                      <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {h.obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Fornecedor</Label>
                    <Select value={h.filters.fornecedor} onValueChange={(v) => { h.setFilters({ ...h.filters, fornecedor: v }); h.setPage(1); }}>
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {h.fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome || f.razao_social}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Data Início</Label>
                    <Input type="date" value={h.filters.dataInicio} onChange={(e) => h.setFilters({ ...h.filters, dataInicio: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Data Fim</Label>
                    <Input type="date" value={h.filters.dataFim} onChange={(e) => h.setFilters({ ...h.filters, dataFim: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Valor Mín.</Label>
                    <Input type="number" value={h.filters.valorMin} onChange={(e) => h.setFilters({ ...h.filters, valorMin: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Valor Máx.</Label>
                    <Input type="number" value={h.filters.valorMax} onChange={(e) => h.setFilters({ ...h.filters, valorMax: e.target.value })} />
                  </div>
                  <div className="col-span-2 md:col-span-4 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => h.setFilters({ search: h.filters.search, status: "all", prioridade: "all", obra: "all", fornecedor: "all", dataInicio: "", dataFim: "", valorMin: "", valorMax: "" })}>
                      <X className="w-4 h-4 mr-1" />Limpar
                    </Button>
                  </div>
                </div>
              )}

              {h.loading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : h.error ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-3">Erro ao carregar compras.</p>
                  <Button variant="outline" onClick={() => h.fetchCompras()}>Tentar novamente</Button>
                </div>
              ) : h.compras.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground mb-3">Nenhuma compra cadastrada.</p>
                  {h.canEdit && <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Cadastrar primeira compra</Button>}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Número</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead>Solicitante</TableHead>
                          <TableHead>Obra</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Prioridade</TableHead>
                          <TableHead>Solicitação</TableHead>
                          <TableHead>Prevista</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {h.compras.map((c) => (
                          <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/compras/${c.id}`)}>
                            <TableCell className="font-medium">{c.numero_compra || "-"}</TableCell>
                            <TableCell className="max-w-[160px] truncate">{nomeFornecedor(c)}</TableCell>
                            <TableCell className="max-w-[140px] truncate">{nomeSolicitante(c)}</TableCell>
                            <TableCell className="max-w-[140px] truncate">{nomeObra(c)}</TableCell>
                            <TableCell>{c.categoria || "-"}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(c.valor_final || c.valor || 0)}</TableCell>
                            <TableCell><span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${statusColor(c.status)}`}>{c.status}</span></TableCell>
                            <TableCell><span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${prioridadeColor(c.prioridade)}`}>{c.prioridade || "Normal"}</span></TableCell>
                            <TableCell className="text-xs">{formatDate(c.data_solicitacao)}</TableCell>
                            <TableCell className="text-xs">{formatDate(c.data_entrega_prevista)}</TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" title="Visualizar" onClick={() => navigate(`/compras/${c.id}`)}><Eye className="w-4 h-4" /></Button>
                                {h.canEdit && c.status !== "Cancelado" && <Button size="sm" variant="ghost" title="Editar" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>}
                                {h.canEdit && <Button size="sm" variant="ghost" title="Duplicar" onClick={() => openDuplicate(c)}><Copy className="w-4 h-4" /></Button>}
                                {h.canEdit && c.status !== "Cancelado" && c.status !== "Recebido" && <Button size="sm" variant="ghost" title="Cancelar" onClick={() => setCancelTarget(c)}><Ban className="w-4 h-4 text-amber-600" /></Button>}
                                {h.canManage && <Button size="sm" variant="ghost" title="Excluir" onClick={() => setDeleteTarget(c)}><Trash2 className="w-4 h-4 text-red-600" /></Button>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Itens por página:</span>
                      <Select value={String(h.perPage)} onValueChange={(v) => { h.setPerPage(Number(v)); h.setPage(1); }}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[10, 25, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <span className="ml-2">{h.totalItems} compra(s)</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" disabled={h.page <= 1} onClick={() => h.setPage(h.page - 1)}>Anterior</Button>
                      <span className="flex items-center px-3 text-sm">{h.page} / {h.totalPages}</span>
                      <Button size="sm" variant="outline" disabled={h.page >= h.totalPages} onClick={() => h.setPage(h.page + 1)}>Próximo</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Modal Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Compra" : "Nova Compra"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fornecedor *</Label>
                <Select value={form.fornecedor_id} onValueChange={(v) => setForm({ ...form, fornecedor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {h.fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome || f.razao_social}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.fornecedor_id && <p className="text-xs text-red-600">{formErrors.fornecedor_id}</p>}
              </div>
              <div className="space-y-2">
                <Label>Obra</Label>
                <Select value={form.obra_id || "none"} onValueChange={(v) => setForm({ ...form, obra_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem obra</SelectItem>
                    {h.obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Solicitante *</Label>
                <Select value={form.solicitante_id} onValueChange={(v) => setForm({ ...form, solicitante_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {h.usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_completo || u.name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.solicitante_id && <p className="text-xs text-red-600">{formErrors.solicitante_id}</p>}
              </div>
              <div className="space-y-2">
                <Label>Comprador</Label>
                <Select value={form.comprador_id || "none"} onValueChange={(v) => setForm({ ...form, comprador_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem comprador</SelectItem>
                    {h.usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_completo || u.name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_SUGERIDAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.categoria && <p className="text-xs text-red-600">{formErrors.categoria}</p>}
              </div>
              <div className="space-y-2">
                <Label>Subcategoria</Label>
                <Input value={form.subcategoria} onChange={(e) => setForm({ ...form, subcategoria: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Centro de Custo</Label>
                <Input value={form.centro_custo} onChange={(e) => setForm({ ...form, centro_custo: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Solicitação *</Label>
                <Input type="date" value={form.data_solicitacao} onChange={(e) => setForm({ ...form, data_solicitacao: e.target.value })} />
                {formErrors.data_solicitacao && <p className="text-xs text-red-600">{formErrors.data_solicitacao}</p>}
              </div>
              <div className="space-y-2">
                <Label>Entrega Prevista</Label>
                <Input type="date" value={form.data_entrega_prevista} onChange={(e) => setForm({ ...form, data_entrega_prevista: e.target.value })} />
                {formErrors.data_entrega_prevista && <p className="text-xs text-red-600">{formErrors.data_entrega_prevista}</p>}
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_COMPRA.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor Previsto (R$)</Label>
                <Input type="number" step="0.01" min="0" value={form.valor_previsto} onChange={(e) => setForm({ ...form, valor_previsto: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={form.forma_pagamento} onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Parcelas</Label>
                <Input type="number" min="1" value={form.parcelas} onChange={(e) => setForm({ ...form, parcelas: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Justificativa</Label>
              <Textarea rows={2} value={form.justificativa} onChange={(e) => setForm({ ...form, justificativa: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            {formErrors._form && <p className="text-sm text-red-600">{formErrors._form}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={h.saving}>{h.saving ? "Salvando..." : editing ? "Atualizar" : "Cadastrar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancelar */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Cancelar Compra</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Confirme o cancelamento da compra <strong>{cancelTarget?.numero_compra}</strong>.</p>
            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Textarea rows={3} value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} placeholder="Descreva o motivo do cancelamento..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Voltar</Button>
            <Button variant="destructive" onClick={handleCancel}>Confirmar Cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Compra</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir a compra {deleteTarget?.numero_compra}? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const Kpi = ({ icon: Icon, label, value, color, small }) => (
  <Card><CardContent className="p-4 flex items-center justify-between">
    <div>
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
      <p className={`${small ? "text-base" : "text-2xl"} font-bold ${color} mt-1`}>{value}</p>
    </div>
    <div className={`p-2 rounded-lg bg-muted/40`}><Icon className={`w-5 h-5 ${color}`} /></div>
  </CardContent></Card>
);

const EmptyChart = () => (
  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados disponíveis</div>
);

export default ComprasPage;
