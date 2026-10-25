import React, { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

import pb from "@/lib/pocketbaseClient.js";
import { useUsuarios } from "@/hooks/useUsuarios.js";
import {
  PERFIS_ACESSO,
  STATUS_USUARIO,
  formatCPF,
  formatPhone,
  passwordStrengthLabel,
  validateUsuarioForm,
} from "@/utils/usuariosValidations.js";

import Header from "@/components/Header.jsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pencil,
  Trash2,
  Search,
  Eye,
  KeyRound,
  Ban,
  ShieldCheck,
  Power,
  FileText,
  FileSpreadsheet,
  Printer,
  Users,
  AlertCircle,
  ArrowUpDown,
  ImageIcon,
  UserCircle,
} from "lucide-react";
import { CARGOS } from "@/lib/permissoes.js";

// Perfil de acesso sugerido para cada cargo (o admin ainda pode trocar).
const perfilDoCargo = (cargo) => {
  if (cargo === "Gerência") return "Gerente";
  if (["Pedreiro", "Servente", "Encanador", "Eletricista", "Faxina"].includes(cargo)) return "Funcionário";
  return PERFIS_ACESSO.includes(cargo) ? cargo : "Funcionário";
};

const emptyForm = {
  nome_completo: "",
  email: "",
  username: "",
  id_unico: "",
  password: "",
  passwordConfirm: "",
  cargo: "",
  perfil_acesso: "",
  departamento: "",
  centro_custo: "",
  company_id: "",
  obra_vinculada_id: "",
  telefone: "",
  cpf: "",
  rg: "",
  data_admissao: "",
  data_demissao: "",
  status: "Ativo",
  bloqueado: false,
  observacoes: "",
};

const perfilBadge = (perfil) => {
  const map = {
    Administrador: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    Gerente: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    Supervisor: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
    Engenheiro: "bg-cyan-500/10 text-cyan-700 border-cyan-500/20",
    "Mestre de Obras": "bg-orange-500/10 text-orange-700 border-orange-500/20",
    Almoxarife: "bg-teal-500/10 text-teal-700 border-teal-500/20",
    Comprador: "bg-purple-500/10 text-purple-700 border-purple-500/20",
    Financeiro: "bg-green-500/10 text-green-700 border-green-500/20",
    RH: "bg-pink-500/10 text-pink-700 border-pink-500/20",
    Funcionário: "bg-gray-500/10 text-gray-700 border-gray-500/20",
    Cliente: "bg-slate-500/10 text-slate-700 border-slate-500/20",
    Pedreiro: "bg-stone-500/10 text-stone-700 border-stone-500/20",
    Servente: "bg-stone-500/10 text-stone-700 border-stone-500/20",
    Encanador: "bg-sky-500/10 text-sky-700 border-sky-500/20",
    Eletricista: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    Faxina: "bg-lime-500/10 text-lime-700 border-lime-500/20",
  };
  return map[perfil] || "bg-gray-500/10 text-gray-700 border-gray-500/20";
};

const statusBadge = (status, blocked) => {
  if (blocked || status === "Bloqueado")
    return "bg-red-500/10 text-red-700 border-red-500/20";
  if (status === "Ativo") return "bg-green-500/10 text-green-700 border-green-500/20";
  return "bg-gray-500/10 text-gray-700 border-gray-500/20";
};

const fotoUrl = (rec) => {
  if (rec?.foto) {
    try {
      return pb.files.getURL(rec, rec.foto, { thumb: "100x100" });
    } catch {
      return null;
    }
  }
  return null;
};

const UsuariosPage = () => {
  const navigate = useNavigate();
  const params = useParams();
  const u = useUsuarios();
  const {
    usuarios,
    empresas,
    obras,
    totalItems,
    totalPages,
    loading,
    error,
    page,
    perPage,
    sort,
    filters,
    saving,
    canEdit,
    canManage,
    setPage,
    setPerPage,
    setSort,
    setFilters,
    fetchUsuarios,
    updateUsuario,
    deleteUsuario,
    blockUsuario,
    unblockUsuario,
    activateUsuario,
    deactivateUsuario,
    resetPassword,
    exportAudit,
  } = u;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [removeFoto, setRemoveFoto] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const fileInputRef = useRef(null);

  // Rota /usuarios/:id/editar — abre automaticamente o modal de edição
  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    (async () => {
      try {
        const rec = await pb.collection("users").getOne(params.id, {
          expand: "company_id,obra_vinculada_id",
          $autoCancel: false,
        });
        if (cancelled) return;
        openEdit(rec);
      } catch (err) {
        if (!cancelled) {
          toast.error("Usuário não encontrado para edição.");
          navigate("/usuarios");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const fillFormFromRec = (rec) => ({
    nome_completo: rec.nome_completo || rec.name || "",
    email: rec.email || "",
    username: rec.username || "",
    id_unico: rec.id_unico || "",
    password: "",
    passwordConfirm: "",
    cargo: rec.cargo || "",
    perfil_acesso: rec.perfil_acesso || "",
    departamento: rec.departamento || "",
    centro_custo: rec.centro_custo || "",
    company_id: rec.company_id || "",
    obra_vinculada_id: rec.obra_vinculada_id || "",
    telefone: formatPhone(rec.telefone),
    cpf: formatCPF(rec.cpf),
    rg: rec.rg || "",
    data_admissao: rec.data_admissao ? String(rec.data_admissao).slice(0, 10) : "",
    data_demissao: rec.data_demissao ? String(rec.data_demissao).slice(0, 10) : "",
    status: rec.status || "Ativo",
    bloqueado: !!rec.is_blocked,
    observacoes: rec.observacoes || "",
  });

    const openEdit = (rec) => {
    setEditing(rec);
    setForm(fillFormFromRec(rec));
    setFormErrors({});
    setFotoFile(null);
    setFotoPreview(fotoUrl(rec));
    setRemoveFoto(false);
    setDialogOpen(true);
  };

  const onFotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG, GIF ou WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Foto muito grande (máx 5MB).");
      return;
    }
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
    setRemoveFoto(false);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const { valid, errors } = validateUsuarioForm(form, "edit");
    if (!valid) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    const result = await updateUsuario(editing.id, form, fotoFile, removeFoto);

    if (!result.success) {
      setFormErrors(result.errors || {});
      if (result.errors?._form) toast.error(result.errors._form);
      return;
    }
    toast.success("Usuário atualizado com sucesso!");
    setDialogOpen(false);
    fetchUsuarios();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteUsuario(deleteTarget.id, deleteTarget.nome_completo);
    if (res.success) {
      toast.success("Usuário excluído com sucesso.");
      fetchUsuarios();
    } else {
      toast.error(res.error || "Erro ao excluir usuário.");
    }
    setDeleteTarget(null);
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    const res = await resetPassword(resetTarget);
    if (res.success) {
      setResetResult(res.tempPassword);
      toast.success("Senha resetada com sucesso.");
    } else {
      toast.error(res.error || "Erro ao resetar senha.");
    }
  };

  const handleBlock = async (rec) => {
    const res = await blockUsuario(rec);
    if (res.success) toast.success("Usuário bloqueado.");
    else toast.error(res.error || "Erro ao bloquear.");
    fetchUsuarios();
  };

  const handleUnblock = async (rec) => {
    const res = await unblockUsuario(rec);
    if (res.success) toast.success("Usuário desbloqueado.");
    else toast.error(res.error || "Erro ao desbloquear.");
    fetchUsuarios();
  };

  const handleToggleActive = async (rec) => {
    const res = rec.status === "Ativo" ? await deactivateUsuario(rec) : await activateUsuario(rec);
    if (res.success) toast.success(`Usuário ${rec.status === "Ativo" ? "desativado" : "ativado"}.`);
    else toast.error(res.error || "Erro ao alterar status.");
    fetchUsuarios();
  };

  const sortField = sort.replace("-", "");
  const sortDesc = sort.startsWith("-");
  const toggleSort = (field) => {
    if (sortField === field) setSort(sortDesc ? field : `-${field}`);
    else setSort(field);
  };

  const empresaNome = (rec) =>
    rec?.expand?.company_id?.razao_social ||
    empresas.find((em) => em.id === rec?.company_id)?.razao_social ||
    "—";

  const exportPDF = async () => {
    await exportAudit("PDF");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("Cadastro de Usuários — APP OBRA", 14, 20);
    doc.setFontSize(8);
    const cols = [
      { title: "Nome", w: 150 },
      { title: "Username", w: 80 },
      { title: "ID", w: 50 },
      { title: "Cargo", w: 90 },
      { title: "Empresa", w: 120 },
      { title: "Email", w: 150 },
      { title: "Perfil", w: 80 },
      { title: "Status", w: 60 },
    ];
    const startX = 14;
    let y = 36;
    let x = startX;
    doc.setFont(undefined, "bold");
    cols.forEach((c) => {
      doc.rect(x, y - 10, c.w, 16, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(c.title, x + 4, y);
      x += c.w;
    });
    doc.setFont(undefined, "normal");
    doc.setTextColor(20, 20, 20);
    y += 16;
    usuarios.forEach((r, idx) => {
      if (y > 560) {
        doc.addPage();
        y = 20;
      }
      x = startX;
      const row = [
        r.nome_completo || r.name || "",
        r.username || "",
        r.id_unico || "",
        r.cargo || "",
        empresaNome(r),
        r.email || "",
        r.perfil_acesso || "",
        r.status || "",
      ];
      if (idx % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(startX, y - 10, cols.reduce((a, c) => a + c.w, 0), 16, "F");
      }
      cols.forEach((c, i) => {
        const txt = String(row[i]).slice(0, Math.floor(c.w / 4.2));
        doc.text(txt, x + 4, y);
        x += c.w;
      });
      y += 16;
    });
    doc.save("usuarios.pdf");
    toast.success("PDF exportado.");
  };

  const exportExcel = async () => {
    await exportAudit("Excel");
    const rows = usuarios.map((r) => ({
      Nome: r.nome_completo || r.name || "",
      Username: r.username || "",
      "ID Único": r.id_unico || "",
      Cargo: r.cargo || "",
      Departamento: r.departamento || "",
      Empresa: empresaNome(r),
      Telefone: formatPhone(r.telefone),
      Email: r.email || "",
      CPF: formatCPF(r.cpf),
      RG: r.rg || "",
      "Perfil de Acesso": r.perfil_acesso || "",
      Status: r.status || "",
      Bloqueado: r.is_blocked ? "Sim" : "Não",
      "Data Admissão": r.data_admissao ? new Date(r.data_admissao).toLocaleDateString("pt-BR") : "",
      "Último Login": r.last_login ? new Date(r.last_login).toLocaleString("pt-BR") : "",
      "Data Cadastro": r.created ? new Date(r.created).toLocaleString("pt-BR") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Usuários");
    XLSX.writeFile(wb, "usuarios.xlsx");
    toast.success("Excel exportado.");
  };

  const printList = () => window.print();

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const strength = passwordStrengthLabel(form.password);

  return (
    <>
      <Helmet>
        <title>Gestão de Acessos — APP OBRA | DNM&LTDA</title>
        <meta name="description" content="Gestão de acessos — perfis, permissões, bloqueio, ativação e reset de senha. Novas pessoas são cadastradas em Funcionários." />
      </Helmet>
      <Header />
      <main className="py-8 bg-muted/20 min-h-screen">
        <div className="app-container">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
                <Users className="w-8 h-8 text-accent" /> Gestão de Acessos
              </h1>
              <p className="text-muted-foreground">Gerencie acessos, permissões e perfis dos usuários. Novos usuários são criados através do cadastro de Funcionários.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportPDF} disabled={usuarios.length === 0}>
                <FileText className="w-4 h-4 mr-2" /> PDF
              </Button>
              <Button variant="outline" onClick={exportExcel} disabled={usuarios.length === 0}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
              </Button>
              <Button variant="outline" onClick={printList} disabled={usuarios.length === 0}>
                <Printer className="w-4 h-4 mr-2" /> Imprimir
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <Card className="mb-6">
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar (nome, username, email, CPF, ID)..."
                  value={filters.search}
                  onChange={(e) => {
                    setPage(1);
                    setFilters({ ...filters, search: e.target.value });
                  }}
                  className="pl-9"
                />
              </div>
              <Select
                value={filters.status}
                onValueChange={(v) => { setPage(1); setFilters({ ...filters, status: v }); }}
              >
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  {["Ativo", "Inativo", "Bloqueado"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={filters.perfil}
                onValueChange={(v) => { setPage(1); setFilters({ ...filters, perfil: v }); }}
              >
                <SelectTrigger><SelectValue placeholder="Perfil" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos perfis</SelectItem>
                  {PERFIS_ACESSO.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={filters.empresa}
                onValueChange={(v) => { setPage(1); setFilters({ ...filters, empresa: v }); }}
              >
                <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas empresas</SelectItem>
                  {empresas.map((em) => <SelectItem key={em.id} value={em.id}>{em.razao_social}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  type="date"
                  title="Data inicial"
                  value={filters.dataInicio}
                  onChange={(e) => { setPage(1); setFilters({ ...filters, dataInicio: e.target.value }); }}
                />
                <Input
                  type="date"
                  title="Data final"
                  value={filters.dataFim}
                  onChange={(e) => { setPage(1); setFilters({ ...filters, dataFim: e.target.value }); }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tabela */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : error ? (
                <div className="py-16 text-center">
                  <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-2">Erro ao carregar usuários</h2>
                  <p className="text-muted-foreground mb-4">Verifique sua conexão e tente novamente.</p>
                  <Button onClick={fetchUsuarios}>Tentar novamente</Button>
                </div>
              ) : usuarios.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-2">Nenhum usuário cadastrado</h2>
                  <p className="text-muted-foreground mb-4">
                    {filters.search || filters.status !== "all" || filters.perfil !== "all"
                      ? "Nenhum resultado para os filtros aplicados."
                      : "Nenhum usuário ainda. Para adicionar uma nova pessoa (com ou sem acesso ao sistema), use a página Funcionários."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-12">Foto</TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("nome_completo")}>
                          <span className="inline-flex items-center gap-1">Nome <ArrowUpDown className="w-3 h-3" /></span>
                        </TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Perfil</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Últ. Login</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usuarios.map((r) => (
                        <TableRow key={r.id} className="hover:bg-muted/30">
                          <TableCell>
                            {fotoUrl(r) ? (
                              <img src={fotoUrl(r)} alt={r.nome_completo} className="w-10 h-10 rounded-full object-cover border" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <UserCircle className="w-6 h-6 text-primary" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">{r.nome_completo || r.name}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{r.username}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{r.id_unico}</TableCell>
                          <TableCell className="max-w-[120px] truncate">{r.cargo}</TableCell>
                          <TableCell className="max-w-[140px] truncate">{empresaNome(r)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatPhone(r.telefone)}</TableCell>
                          <TableCell className="max-w-[180px] truncate text-muted-foreground">{r.email}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${perfilBadge(r.perfil_acesso)}`}>
                              {r.perfil_acesso || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusBadge(r.status, r.is_blocked)}`}>
                              {r.is_blocked ? "Bloqueado" : r.status || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {r.last_login ? new Date(r.last_login).toLocaleString("pt-BR") : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" title="Visualizar detalhes" onClick={() => navigate(`/usuarios/${r.id}`)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {canEdit && (
                                <Button size="sm" variant="ghost" title="Editar" onClick={() => openEdit(r)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              )}
                              {canManage && (
                                <Button size="sm" variant="ghost" title="Resetar senha" onClick={() => setResetTarget(r)}>
                                  <KeyRound className="w-4 h-4" />
                                </Button>
                              )}
                              {canManage && (
                                r.is_blocked ? (
                                  <Button size="sm" variant="ghost" title="Desbloquear" onClick={() => handleUnblock(r)}>
                                    <ShieldCheck className="w-4 h-4 text-green-600" />
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="ghost" title="Bloquear" onClick={() => handleBlock(r)}>
                                    <Ban className="w-4 h-4 text-red-600" />
                                  </Button>
                                )
                              )}
                              {canManage && (
                                <Button size="sm" variant="ghost" title={r.status === "Ativo" ? "Desativar" : "Ativar"} onClick={() => handleToggleActive(r)}>
                                  <Power className={`w-4 h-4 ${r.status === "Ativo" ? "text-green-600" : "text-red-600"}`} />
                                </Button>
                              )}
                              {canManage && (
                                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" title="Excluir" onClick={() => setDeleteTarget(r)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Paginação */}
              {!loading && usuarios.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Itens por página:</span>
                    <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
                      <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="ml-2">{totalItems} usuário(s)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
                    <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                    <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Modal Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Foto */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                {fotoPreview ? (
                  <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-2">
                <Label>Foto do usuário</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Selecionar imagem
                  </Button>
                  {fotoPreview && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setFotoFile(null); setFotoPreview(null); setRemoveFoto(true); }}>
                      Remover
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">JPG, PNG, GIF ou WEBP — máx 5MB.</p>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={onFotoChange} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Nome Completo *</Label>
                <Input value={form.nome_completo} onChange={(e) => set("nome_completo", e.target.value)} />
                {formErrors.nome_completo && <p className="text-xs text-destructive">{formErrors.nome_completo}</p>}
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input value={form.username} onChange={(e) => set("username", e.target.value.toLowerCase())} placeholder="usuario.sobrenome" />
                {formErrors.username && <p className="text-xs text-destructive">{formErrors.username}</p>}
              </div>
              {editing && (
                <div className="space-y-2">
                  <Label>ID</Label>
                  {/* Número por ordem de chegada na empresa, dado pelo servidor — não se edita. */}
                  <Input value={form.id_unico} readOnly tabIndex={-1} className="bg-muted/40" />
                  <p className="text-xs text-muted-foreground">Ordem de chegada na empresa. Não muda.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={(e) => set("cpf", formatCPF(e.target.value))} placeholder="000.000.000-00" />
                {formErrors.cpf && <p className="text-xs text-destructive">{formErrors.cpf}</p>}
              </div>
              <div className="space-y-2">
                <Label>RG</Label>
                <Input value={form.rg} onChange={(e) => set("rg", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => set("telefone", formatPhone(e.target.value))} placeholder="(00) 00000-0000" />
                {formErrors.telefone && <p className="text-xs text-destructive">{formErrors.telefone}</p>}
              </div>
              <div className="space-y-2">
                <Label>Cargo *</Label>
                {/* Lista fixa: o cargo define o que a pessoa acessa (lib/permissoes.js).
                    Antes era texto livre e "Engenheiro Civil" não era reconhecido. */}
                <Select
                  value={form.cargo}
                  onValueChange={(v) => setForm((f) => ({ ...f, cargo: v, perfil_acesso: perfilDoCargo(v) }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {form.cargo && !CARGOS.includes(form.cargo) && (
                      <SelectItem value={form.cargo}>{form.cargo} (antigo)</SelectItem>
                    )}
                    {CARGOS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.cargo && <p className="text-xs text-destructive">{formErrors.cargo}</p>}
              </div>
              <div className="space-y-2">
                <Label>Perfil de Acesso *</Label>
                <Select value={form.perfil_acesso} onValueChange={(v) => set("perfil_acesso", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {PERFIS_ACESSO.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.perfil_acesso && <p className="text-xs text-destructive">{formErrors.perfil_acesso}</p>}
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input value={form.departamento} onChange={(e) => set("departamento", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Centro de Custo</Label>
                <Input value={form.centro_custo} onChange={(e) => set("centro_custo", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select value={form.company_id} onValueChange={(v) => set("company_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {empresas.map((em) => <SelectItem key={em.id} value={em.id}>{em.razao_social}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.company_id && <p className="text-xs text-destructive">{formErrors.company_id}</p>}
              </div>
              <div className="space-y-2">
                <Label>Obra Vinculada</Label>
                <Select value={form.obra_vinculada_id || "none"} onValueChange={(v) => set("obra_vinculada_id", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome || o.titulo || o.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data de Admissão</Label>
                <Input type="date" value={form.data_admissao} onChange={(e) => set("data_admissao", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data de Demissão</Label>
                <Input type="date" value={form.data_demissao} onChange={(e) => set("data_demissao", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_USUARIO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bloqueado</Label>
                <Select value={form.bloqueado ? "sim" : "nao"} onValueChange={(v) => set("bloqueado", v === "sim")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não</SelectItem>
                    <SelectItem value="sim">Sim</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Nova Senha (deixe vazio para manter)</Label>
                <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Mín. 8 caracteres" />
                {form.password && (
                  <p className={`text-xs ${strength.color}`}>Força da senha: {strength.label}</p>
                )}
                {formErrors.password && <p className="text-xs text-destructive">{formErrors.password}</p>}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Confirmar Senha (se alterou)</Label>
                <Input type="password" value={form.passwordConfirm} onChange={(e) => set("passwordConfirm", e.target.value)} />
                {formErrors.passwordConfirm && <p className="text-xs text-destructive">{formErrors.passwordConfirm}</p>}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Observações</Label>
                <Textarea rows={3} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
              </div>
            </div>

            {formErrors._form && (
              <p className="text-sm text-destructive">{formErrors._form}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Atualizar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja inativar <strong>{deleteTarget?.nome_completo}</strong>? A pessoa perde o acesso, mas o cadastro e o histórico ficam guardados (nada é apagado). Dá para reativar depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset de senha */}
      <AlertDialog open={!!resetTarget} onOpenChange={(o) => { if (!o) { setResetTarget(null); setResetResult(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar Senha</AlertDialogTitle>
            <AlertDialogDescription>
              {resetResult ? (
                <span>
                  Uma nova senha temporária foi gerada para <strong>{resetTarget?.nome_completo}</strong>.
                  Compartilhe com o usuário com segurança:
                  <code className="block mt-2 p-2 bg-muted rounded text-sm font-mono select-all">{resetResult}</code>
                </span>
              ) : (
                <>Deseja gerar uma nova senha temporária para <strong>{resetTarget?.nome_completo}</strong>?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {resetResult ? (
              <AlertDialogAction onClick={() => { setResetTarget(null); setResetResult(null); }}>Concluir</AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Gerar nova senha</AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UsuariosPage;
