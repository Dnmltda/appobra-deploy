import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useAuth } from "@/contexts/AuthContext.jsx";
import { useSolicitacoes } from "@/hooks/useSolicitacoes.js";
import {
  TIPOS_SOLICITACAO, PRIORIDADES, STATUS_SOLICITACAO,
  tipoColor, statusColor, prioridadeColor, formatDate, generateNumeroSolicitacao,
} from "@/utils/solicitacoesValidations.js";
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
  ClipboardList, Clock, CheckCircle2, XCircle, AlertTriangle, Filter, X,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import SeletorUnidade from "@/components/SeletorUnidade.jsx";

const emptyForm = {
  tipo: "", categoria: "", solicitante_id: "", departamento: "", centro_custo: "",
  obra_id: "", unidade_id: "", responsavel_id: "", prioridade: "Normal", descricao: "", justificativa: "",
  data_solicitacao: new Date().toISOString().split("T")[0], data_prazo: "",
  status: "Aberta", observacoes: "",
};

const SolicitacoesPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const h = useSolicitacoes();
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
    const all = h.solicitacoes;
    const abertas = all.filter((s) => s.status === "Aberta").length;
    const emAnalise = all.filter((s) => s.status === "Em análise").length;
    const aprovadas = all.filter((s) => s.status === "Aprovada").length;
    const rejeitadas = all.filter((s) => s.status === "Rejeitada").length;
    const concluidas = all.filter((s) => s.status === "Concluída").length;
    const urgentes = all.filter((s) => ["Urgente", "Emergencial"].includes(s.prioridade)).length;
    return { total: all.length, abertas, emAnalise, aprovadas, rejeitadas, concluidas, urgentes };
  }, [h.solicitacoes]);

  const chartData = useMemo(() => {
    const meses = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("pt-BR", { month: "short" });
      meses[key] = { name: key, total: 0 };
    }
    h.solicitacoes.forEach((s) => {
      const d = new Date(s.data_solicitacao || s.created);
      const key = d.toLocaleString("pt-BR", { month: "short" });
      if (meses[key]) meses[key].total += 1;
    });
    const porObra = {};
    h.solicitacoes.forEach((s) => {
      const nome = s.expand?.obra_id?.nome || "Sem obra";
      porObra[nome] = (porObra[nome] || 0) + 1;
    });
    const porSetor = {};
    h.solicitacoes.forEach((s) => {
      const nome = s.departamento || "Sem setor";
      porSetor[nome] = (porSetor[nome] || 0) + 1;
    });
    const porResponsavel = {};
    h.solicitacoes.forEach((s) => {
      const nome = s.expand?.responsavel_id?.nome_completo || s.expand?.responsavel_id?.name || "Sem responsável";
      porResponsavel[nome] = (porResponsavel[nome] || 0) + 1;
    });
    return {
      mensal: Object.values(meses),
      obras: Object.keys(porObra).map((k) => ({ name: k, total: porObra[k] })),
      setores: Object.keys(porSetor).map((k) => ({ name: k, value: porSetor[k] })),
      responsaveis: Object.keys(porResponsavel).map((k) => ({ name: k, total: porResponsavel[k] })),
    };
  }, [h.solicitacoes]);

  const pendentesAprovacao = h.solicitacoes.filter((s) => s.status === "Aguardando aprovação").slice(0, 5);
  const emAtraso = h.solicitacoes.filter((s) => {
    if (!s.data_prazo || ["Concluída", "Cancelada", "Rejeitada"].includes(s.status)) return false;
    return new Date(s.data_prazo) < new Date();
  }).slice(0, 5);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, solicitante_id: currentUser?.id || "", numero_solicitacao: generateNumeroSolicitacao() });
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      tipo: s.tipo || "", categoria: s.categoria || "", solicitante_id: s.solicitante_id || "",
      departamento: s.departamento || "", centro_custo: s.centro_custo || "",
      obra_id: s.obra_id || "", unidade_id: s.unidade_id || "", responsavel_id: s.responsavel_id || "",
      prioridade: s.prioridade || "Normal", descricao: s.descricao || "",
      justificativa: s.justificativa || "",
      data_solicitacao: s.data_solicitacao ? s.data_solicitacao.split("T")[0] : "",
      data_prazo: s.data_prazo ? s.data_prazo.split("T")[0] : "",
      status: s.status || "Aberta", observacoes: s.observacoes || "",
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const openDuplicate = (s) => {
    setEditing(null);
    setForm({ ...h.duplicateSolicitacao(s), numero_solicitacao: generateNumeroSolicitacao() });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = editing ? await h.updateSolicitacao(editing.id, form) : await h.createSolicitacao(form);
    if (res.success) {
      setDialogOpen(false);
      // Pedido de material: vai direto para a página do pedido incluir os materiais.
      if (!editing && res.record?.tipo === "Material") {
        toast.success("Pedido criado. Agora inclua os materiais.");
        navigate(`/solicitacoes/${res.record.id}`);
        return;
      }
      toast.success(editing ? "Solicitação atualizada com sucesso" : "Solicitação cadastrada com sucesso");
    } else {
      setFormErrors(res.errors || {});
      if (res.errors?._form) toast.error(res.errors._form);
    }
  };

  const handleCancel = async () => {
    if (!cancelMotivo.trim()) { toast.error("Informe o motivo do cancelamento"); return; }
    const res = await h.cancelSolicitacao(cancelTarget, cancelMotivo);
    if (res.success) { toast.success("Solicitação cancelada"); setCancelTarget(null); setCancelMotivo(""); }
    else toast.error(res.error);
  };

  const handleDelete = async () => {
    const res = await h.deleteSolicitacao(deleteTarget);
    if (res.success) { toast.success("Solicitação excluída"); setDeleteTarget(null); }
    else toast.error(res.error);
  };

  const exportExcel = () => {
    import("xlsx").then((XLSX) => {
      const rows = h.solicitacoes.map((s) => ({
        Numero: s.numero_solicitacao, Tipo: s.tipo,
        Solicitante: s.expand?.solicitante_id?.nome_completo || s.expand?.solicitante_id?.name || "",
        Obra: s.expand?.obra_id?.nome || "", Setor: s.departamento,
        Prioridade: s.prioridade, Status: s.status,
        Responsavel: s.expand?.responsavel_id?.nome_completo || "",
        Data: formatDate(s.data_solicitacao), Prazo: formatDate(s.data_prazo),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Solicitações");
      XLSX.writeFile(wb, "solicitacoes.xlsx");
      h.exportAudit("Excel");
    });
  };

  const printList = () => { window.print(); h.exportAudit("Impressão"); };

  const COLORS = ["#0A1F4D", "#D09C26", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  const nomeSolicitante = (s) => s.expand?.solicitante_id?.nome_completo || s.expand?.solicitante_id?.name || "-";
  const nomeResponsavel = (s) => s.expand?.responsavel_id?.nome_completo || s.expand?.responsavel_id?.name || "-";
  const nomeObra = (s) => s.expand?.obra_id?.nome || "-";

  return (
    <>
      <Helmet>
        <title>Solicitações - APP OBRA | DNM&LTDA</title>
        <meta name="description" content="Gestão completa de solicitações internas: material, compra, equipamento, EPI, manutenção e mais, com fluxo de aprovação e anexos." />
      </Helmet>
      <Header />
      <main className="py-8 bg-muted/20 min-h-screen">
        <div className="app-container">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-primary">Solicitações</h1>
              <p className="text-muted-foreground">Controle completo das solicitações internas da empresa</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={exportExcel}><FileDown className="w-4 h-4 mr-2" />Excel</Button>
              <Button variant="outline" onClick={printList}><FileText className="w-4 h-4 mr-2" />Imprimir</Button>
              {/* Qualquer pessoa com acesso a Solicitações pode fazer um pedido
                  (antes só a gestão via o botão e o pedreiro não conseguia pedir). */}
              <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nova Solicitação</Button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <Kpi icon={ClipboardList} label="Total" value={stats.total} color="text-primary" />
            <Kpi icon={Clock} label="Abertas" value={stats.abertas} color="text-blue-600" />
            <Kpi icon={CheckCircle2} label="Aprovadas" value={stats.aprovadas} color="text-green-600" />
            <Kpi icon={CheckCircle2} label="Concluídas" value={stats.concluidas} color="text-emerald-600" />
            <Kpi icon={XCircle} label="Rejeitadas" value={stats.rejeitadas} color="text-red-600" />
            <Kpi icon={AlertTriangle} label="Urgentes" value={stats.urgentes} color="text-amber-600" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-lg">Solicitações Mensais (12 meses)</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.mensal}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="total" name="Quantidade" stroke="#0A1F4D" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Por Setor</CardTitle></CardHeader>
              <CardContent className="h-72">
                {chartData.setores.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData.setores} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        {chartData.setores.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Por Obra</CardTitle></CardHeader>
              <CardContent className="h-64">
                {chartData.obras.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.obras}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" name="Quantidade" fill="#0A1F4D" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Por Responsável</CardTitle></CardHeader>
              <CardContent className="h-64">
                {chartData.responsaveis.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.responsaveis}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" name="Quantidade" fill="#D09C26" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Pendentes e Atraso */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="border-amber-500/30">
              <CardHeader><CardTitle className="text-lg text-amber-700">Pendentes de Aprovação</CardTitle></CardHeader>
              <CardContent>
                {pendentesAprovacao.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma solicitação pendente</p> : (
                  <div className="space-y-2">
                    {pendentesAprovacao.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-amber-500/5 rounded-lg border border-amber-500/20">
                        <div><p className="font-semibold text-sm">{s.numero_solicitacao}</p><p className="text-xs text-muted-foreground">{s.tipo} · {nomeSolicitante(s)}</p></div>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/solicitacoes/${s.id}`)}>Ver</Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border-red-500/30">
              <CardHeader><CardTitle className="text-lg text-red-700">Solicitações em Atraso</CardTitle></CardHeader>
              <CardContent>
                {emAtraso.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma solicitação em atraso</p> : (
                  <div className="space-y-2">
                    {emAtraso.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                        <div><p className="font-semibold text-sm">{s.numero_solicitacao}</p><p className="text-xs text-muted-foreground">Prazo: {formatDate(s.data_prazo)}</p></div>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/solicitacoes/${s.id}`)}>Ver</Button>
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
                    placeholder="Buscar por número, tipo, descrição, setor..."
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
                    <Label className="text-xs">Tipo</Label>
                    <Select value={h.filters.tipo} onValueChange={(v) => { h.setFilters({ ...h.filters, tipo: v }); h.setPage(1); }}>
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {TIPOS_SOLICITACAO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={h.filters.status} onValueChange={(v) => { h.setFilters({ ...h.filters, status: v }); h.setPage(1); }}>
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {STATUS_SOLICITACAO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                    <Label className="text-xs">Responsável</Label>
                    <Select value={h.filters.responsavel} onValueChange={(v) => { h.setFilters({ ...h.filters, responsavel: v }); h.setPage(1); }}>
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {h.usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_completo || u.name || u.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Setor</Label>
                    <Input value={h.filters.departamento} onChange={(e) => h.setFilters({ ...h.filters, departamento: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Data Início</Label>
                    <Input type="date" value={h.filters.dataInicio} onChange={(e) => h.setFilters({ ...h.filters, dataInicio: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Data Fim</Label>
                    <Input type="date" value={h.filters.dataFim} onChange={(e) => h.setFilters({ ...h.filters, dataFim: e.target.value })} />
                  </div>
                  <div className="col-span-2 md:col-span-4 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => h.setFilters({ search: h.filters.search, tipo: "all", status: "all", prioridade: "all", obra: "all", departamento: "", responsavel: "all", dataInicio: "", dataFim: "" })}>
                      <X className="w-4 h-4 mr-1" />Limpar
                    </Button>
                  </div>
                </div>
              )}

              {h.loading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : h.error ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-3">Erro ao carregar solicitações.</p>
                  <Button variant="outline" onClick={() => h.fetchSolicitacoes()}>Tentar novamente</Button>
                </div>
              ) : h.solicitacoes.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground mb-3">Nenhuma solicitação cadastrada.</p>
                  {h.canEdit && <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Cadastrar primeira solicitação</Button>}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Número</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Solicitante</TableHead>
                          <TableHead>Obra</TableHead>
                          <TableHead>Setor</TableHead>
                          <TableHead>Prioridade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Prazo</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {h.solicitacoes.map((s) => (
                          <TableRow key={s.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/solicitacoes/${s.id}`)}>
                            <TableCell className="font-medium">{s.numero_solicitacao || "-"}</TableCell>
                            <TableCell><span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${tipoColor(s.tipo)}`}>{s.tipo}</span></TableCell>
                            <TableCell className="max-w-[140px] truncate">{nomeSolicitante(s)}</TableCell>
                            <TableCell className="max-w-[140px] truncate">{nomeObra(s)}</TableCell>
                            <TableCell>{s.departamento || "-"}</TableCell>
                            <TableCell><span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${prioridadeColor(s.prioridade)}`}>{s.prioridade || "Normal"}</span></TableCell>
                            <TableCell><span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${statusColor(s.status)}`}>{s.status}</span></TableCell>
                            <TableCell className="max-w-[140px] truncate">{nomeResponsavel(s)}</TableCell>
                            <TableCell className="text-xs">{formatDate(s.data_solicitacao)}</TableCell>
                            <TableCell className="text-xs">{formatDate(s.data_prazo)}</TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" title="Visualizar" onClick={() => navigate(`/solicitacoes/${s.id}`)}><Eye className="w-4 h-4" /></Button>
                                {h.canEdit && s.status !== "Cancelada" && s.status !== "Concluída" && <Button size="sm" variant="ghost" title="Editar" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>}
                                {h.canEdit && <Button size="sm" variant="ghost" title="Duplicar" onClick={() => openDuplicate(s)}><Copy className="w-4 h-4" /></Button>}
                                {h.canEdit && !["Cancelada", "Concluída", "Rejeitada"].includes(s.status) && <Button size="sm" variant="ghost" title="Cancelar" onClick={() => setCancelTarget(s)}><Ban className="w-4 h-4 text-amber-600" /></Button>}
                                {h.canManage && <Button size="sm" variant="ghost" title="Excluir" onClick={() => setDeleteTarget(s)}><Trash2 className="w-4 h-4 text-red-600" /></Button>}
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
                      <span className="ml-2">{h.totalItems} solicitação(ões)</span>
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
            <DialogTitle>{editing ? "Editar Solicitação" : "Nova Solicitação"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_SOLICITACAO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.tipo && <p className="text-xs text-red-600">{formErrors.tipo}</p>}
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
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
                <Label>Responsável</Label>
                <Select value={form.responsavel_id || "none"} onValueChange={(v) => setForm({ ...form, responsavel_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {h.usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_completo || u.name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
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
              <SeletorUnidade obraId={form.obra_id} value={form.unidade_id} onChange={(v) => setForm((f) => ({ ...f, unidade_id: v }))} id="sol_unidade" />
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })} />
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
                <Label>Prazo</Label>
                <Input type="date" value={form.data_prazo} onChange={(e) => setForm({ ...form, data_prazo: e.target.value })} />
                {formErrors.data_prazo && <p className="text-xs text-red-600">{formErrors.data_prazo}</p>}
              </div>
              {/* Status só para a gestão; quem pede não escolhe (o servidor cria como "Aberta"). */}
              {h.canApprove && form.tipo !== "Material" && (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_SOLICITACAO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              {formErrors.descricao && <p className="text-xs text-red-600">{formErrors.descricao}</p>}
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
          <DialogHeader><DialogTitle>Cancelar Solicitação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Confirme o cancelamento da solicitação <strong>{cancelTarget?.numero_solicitacao}</strong>.</p>
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
            <AlertDialogTitle>Excluir Solicitação</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja arquivar a solicitação {deleteTarget?.numero_solicitacao}? O registro sai da lista, mas fica guardado no histórico (nada é apagado).</AlertDialogDescription>
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

const Kpi = ({ icon: Icon, label, value, color }) => (
  <Card><CardContent className="p-4 flex items-center justify-between">
    <div>
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
      <p className={`text-2xl font-bold ${color} mt-1`}>{value}</p>
    </div>
    <div className="p-2 rounded-lg bg-muted/40"><Icon className={`w-5 h-5 ${color}`} /></div>
  </CardContent></Card>
);

const EmptyChart = () => (
  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados disponíveis</div>
);

export default SolicitacoesPage;
