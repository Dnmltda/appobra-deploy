import React, { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

import pb from "@/lib/pocketbaseClient.js";
import { useEmpresas } from "@/hooks/useEmpresas.js";
import {
  ESTADOS_BRASILEIROS,
  PLANOS,
  STATUS_EMPRESA,
  formatCNPJ,
  formatCPF,
  formatPhone,
  formatCEP,
  validateEmpresaForm,
} from "@/utils/empresasValidations.js";

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
  Plus,
  Pencil,
  Trash2,
  Search,
  Eye,
  Copy,
  Power,
  FileText,
  FileSpreadsheet,
  Printer,
  Building2,
  AlertCircle,
  ArrowUpDown,
  ImageIcon,
} from "lucide-react";

const emptyForm = {
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  inscricao_estadual: "",
  inscricao_municipal: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  pais: "Brasil",
  telefone: "",
  whatsapp: "",
  email: "",
  website: "",
  responsavel_legal: "",
  cpf_responsavel: "",
  plano: "Básico",
  status: "Ativo",
  observacoes: "",
};

const planoBadge = (plano) => {
  const map = {
    Básico: "bg-gray-500/10 text-gray-700 border-gray-500/20",
    Profissional: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    Empresarial: "bg-purple-500/10 text-purple-700 border-purple-500/20",
    Enterprise: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  };
  return map[plano] || "bg-gray-500/10 text-gray-700 border-gray-500/20";
};

const statusBadge = (status) =>
  status === "Ativo"
    ? "bg-green-500/10 text-green-700 border-green-500/20"
    : "bg-red-500/10 text-red-700 border-red-500/20";

const logoUrl = (rec) => {
  if (rec?.logo) {
    try {
      return pb.files.getURL(rec, rec.logo, { thumb: "100x100" });
    } catch {
      return null;
    }
  }
  return null;
};

const EmpresasPage = () => {
  const navigate = useNavigate();
  const params = useParams();
  const emp = useEmpresas();
  const {
    empresas,
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
    fetchEmpresas,
    createEmpresa,
    updateEmpresa,
    deleteEmpresa,
    toggleStatus,
    exportAudit,
  } = emp;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const fileInputRef = useRef(null);

  // Rota /empresas/:id/editar — abre automaticamente o modal de edição
  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    (async () => {
      try {
        const rec = await pb.collection("empresas").getOne(params.id, { $autoCancel: false });
        if (cancelled) return;
        setEditing(rec);
        setForm({
          razao_social: rec.razao_social || "",
          nome_fantasia: rec.nome_fantasia || "",
          cnpj: formatCNPJ(rec.cnpj),
          inscricao_estadual: rec.inscricao_estadual || "",
          inscricao_municipal: rec.inscricao_municipal || "",
          cep: formatCEP(rec.cep),
          endereco: rec.endereco || "",
          numero: rec.numero || "",
          complemento: rec.complemento || "",
          bairro: rec.bairro || "",
          cidade: rec.cidade || "",
          estado: rec.estado || "",
          pais: rec.pais || "Brasil",
          telefone: formatPhone(rec.telefone),
          whatsapp: rec.whatsapp ? formatPhone(rec.whatsapp) : "",
          email: rec.email || "",
          website: rec.website || "",
          responsavel_legal: rec.responsavel_legal || "",
          cpf_responsavel: formatCPF(rec.cpf_responsavel),
          plano: rec.plano || "Básico",
          status: rec.status || "Ativo",
          observacoes: rec.observacoes || "",
        });
        setFormErrors({});
        setLogoFile(null);
        setLogoPreview(logoUrl(rec));
        setRemoveLogo(false);
        setDialogOpen(true);
      } catch (err) {
        if (!cancelled) {
          toast.error("Empresa não encontrada para edição.");
          navigate("/empresas");
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormErrors({});
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(false);
    setDialogOpen(true);
  };

  const openEdit = (rec) => {
    setEditing(rec);
    setForm({
      razao_social: rec.razao_social || "",
      nome_fantasia: rec.nome_fantasia || "",
      cnpj: formatCNPJ(rec.cnpj),
      inscricao_estadual: rec.inscricao_estadual || "",
      inscricao_municipal: rec.inscricao_municipal || "",
      cep: formatCEP(rec.cep),
      endereco: rec.endereco || "",
      numero: rec.numero || "",
      complemento: rec.complemento || "",
      bairro: rec.bairro || "",
      cidade: rec.cidade || "",
      estado: rec.estado || "",
      pais: rec.pais || "Brasil",
      telefone: formatPhone(rec.telefone),
      whatsapp: rec.whatsapp ? formatPhone(rec.whatsapp) : "",
      email: rec.email || "",
      website: rec.website || "",
      responsavel_legal: rec.responsavel_legal || "",
      cpf_responsavel: formatCPF(rec.cpf_responsavel),
      plano: rec.plano || "Básico",
      status: rec.status || "Ativo",
      observacoes: rec.observacoes || "",
    });
    setFormErrors({});
    setLogoFile(null);
    setLogoPreview(logoUrl(rec));
    setRemoveLogo(false);
    setDialogOpen(true);
  };

  const openDuplicate = (rec) => {
    setEditing(null);
    setForm({
      ...emptyForm,
      razao_social: `${rec.razao_social} (Cópia)`,
      nome_fantasia: rec.nome_fantasia ? `${rec.nome_fantasia} (Cópia)` : "",
      inscricao_estadual: rec.inscricao_estadual || "",
      inscricao_municipal: rec.inscricao_municipal || "",
      cep: formatCEP(rec.cep),
      endereco: rec.endereco || "",
      numero: rec.numero || "",
      complemento: rec.complemento || "",
      bairro: rec.bairro || "",
      cidade: rec.cidade || "",
      estado: rec.estado || "",
      pais: rec.pais || "Brasil",
      telefone: formatPhone(rec.telefone),
      whatsapp: rec.whatsapp ? formatPhone(rec.whatsapp) : "",
      email: rec.email || "",
      website: rec.website || "",
      responsavel_legal: rec.responsavel_legal || "",
      plano: rec.plano || "Básico",
      status: "Ativo",
      observacoes: rec.observacoes || "",
      cnpj: "",
      cpf_responsavel: "",
    });
    setFormErrors({});
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(false);
    setDialogOpen(true);
    toast.info("Formulário pré-preenchido para duplicação. Ajuste CNPJ e CPF.");
  };

  const onLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG, GIF ou WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo muito grande (máx 5MB).");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const { valid, errors } = validateEmpresaForm(form);
    if (!valid) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    const result = editing
      ? await updateEmpresa(editing.id, form, logoFile, removeLogo)
      : await createEmpresa(form, logoFile);

    if (!result.success) {
      setFormErrors(result.errors || {});
      if (result.errors?._form) toast.error(result.errors._form);
      return;
    }
    toast.success(editing ? "Empresa atualizada com sucesso!" : "Empresa cadastrada com sucesso!");
    setDialogOpen(false);
    fetchEmpresas();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteEmpresa(deleteTarget.id, deleteTarget.razao_social);
    if (res.success) {
      toast.success("Empresa excluída com sucesso.");
      fetchEmpresas();
    } else {
      toast.error(res.error || "Erro ao excluir empresa.");
    }
    setDeleteTarget(null);
  };

  const handleToggle = async (rec) => {
    const res = await toggleStatus(rec);
    if (res.success) toast.success(`Empresa ${res.record.status === "Ativo" ? "ativada" : "desativada"}.`);
    else toast.error(res.error || "Erro ao alterar status.");
  };

  const sortField = sort.replace("-", "");
  const sortDesc = sort.startsWith("-");

  const toggleSort = (field) => {
    if (sortField === field) {
      setSort(sortDesc ? field : `-${field}`);
    } else {
      setSort(field);
    }
  };

  const exportPDF = async () => {
    await exportAudit("PDF");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("Cadastro de Empresas — APP OBRA", 14, 20);
    doc.setFontSize(8);

    const cols = [
      { title: "Razão Social", w: 160 },
      { title: "Nome Fantasia", w: 120 },
      { title: "CNPJ", w: 90 },
      { title: "Cidade/UF", w: 80 },
      { title: "Responsável", w: 100 },
      { title: "Plano", w: 70 },
      { title: "Status", w: 50 },
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

    empresas.forEach((r, idx) => {
      if (y > 560) {
        doc.addPage();
        y = 20;
      }
      x = startX;
      const row = [
        r.razao_social || "",
        r.nome_fantasia || "",
        formatCNPJ(r.cnpj),
        `${r.cidade || ""}/${r.estado || ""}`,
        r.responsavel_legal || "",
        r.plano || "",
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

    doc.save("empresas.pdf");
    toast.success("PDF exportado.");
  };

  const exportExcel = async () => {
    await exportAudit("Excel");
    const rows = empresas.map((r) => ({
      "Razão Social": r.razao_social || "",
      "Nome Fantasia": r.nome_fantasia || "",
      CNPJ: formatCNPJ(r.cnpj),
      "Insc. Estadual": r.inscricao_estadual || "",
      CEP: formatCEP(r.cep),
      Endereço: `${r.endereco || ""}, ${r.numero || ""} ${r.complemento || ""}`.trim(),
      Bairro: r.bairro || "",
      Cidade: r.cidade || "",
      Estado: r.estado || "",
      Telefone: formatPhone(r.telefone),
      WhatsApp: r.whatsapp ? formatPhone(r.whatsapp) : "",
      Email: r.email || "",
      Website: r.website || "",
      "Responsável Legal": r.responsavel_legal || "",
      "CPF Responsável": formatCPF(r.cpf_responsavel),
      Plano: r.plano || "",
      Status: r.status || "",
      Observações: r.observacoes || "",
      "Data Cadastro": r.created ? new Date(r.created).toLocaleString("pt-BR") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Empresas");
    XLSX.writeFile(wb, "empresas.xlsx");
    toast.success("Excel exportado.");
  };

  const printList = () => {
    window.print();
  };

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <>
      <Helmet>
        <title>Cadastro de Empresas — APP OBRA | DNM&LTDA</title>
        <meta name="description" content="Módulo de cadastro e gestão de empresas com auditoria, filtros e exportações." />
      </Helmet>
      <Header />
      <main className="py-8 bg-muted/20 min-h-screen">
        <div className="app-container">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
                <Building2 className="w-8 h-8 text-accent" /> Cadastro de Empresas
              </h1>
              <p className="text-muted-foreground">Gestão administrativa de empresas — CRUD, auditoria e exportações.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportPDF} disabled={empresas.length === 0}>
                <FileText className="w-4 h-4 mr-2" /> PDF
              </Button>
              <Button variant="outline" onClick={exportExcel} disabled={empresas.length === 0}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
              </Button>
              <Button variant="outline" onClick={printList} disabled={empresas.length === 0}>
                <Printer className="w-4 h-4 mr-2" /> Imprimir
              </Button>
              {canEdit && (
                <Button onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-2" /> Nova Empresa
                </Button>
              )}
            </div>
          </div>

          {/* Filtros */}
          <Card className="mb-6">
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar (razão, fantasia, CNPJ, cidade, responsável)..."
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
                  {STATUS_EMPRESA.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={filters.plano}
                onValueChange={(v) => { setPage(1); setFilters({ ...filters, plano: v }); }}
              >
                <SelectTrigger><SelectValue placeholder="Plano" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos planos</SelectItem>
                  {PLANOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={filters.estado}
                onValueChange={(v) => { setPage(1); setFilters({ ...filters, estado: v }); }}
              >
                <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos estados</SelectItem>
                  {ESTADOS_BRASILEIROS.map((e) => <SelectItem key={e.sigla} value={e.sigla}>{e.sigla} — {e.nome}</SelectItem>)}
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
                  <h2 className="text-xl font-bold mb-2">Erro ao carregar empresas</h2>
                  <p className="text-muted-foreground mb-4">Verifique sua conexão e tente novamente.</p>
                  <Button onClick={fetchEmpresas}>Tentar novamente</Button>
                </div>
              ) : empresas.length === 0 ? (
                <div className="py-16 text-center">
                  <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-2">Nenhuma empresa cadastrada</h2>
                  <p className="text-muted-foreground mb-4">
                    {filters.search || filters.status !== "all" || filters.plano !== "all"
                      ? "Nenhum resultado para os filtros aplicados."
                      : "Comece cadastrando a primeira empresa."}
                  </p>
                  {canEdit && <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Nova Empresa</Button>}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-12">Logo</TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("razao_social")}>
                          <span className="inline-flex items-center gap-1">Razão Social <ArrowUpDown className="w-3 h-3" /></span>
                        </TableHead>
                        <TableHead>Nome Fantasia</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Cidade/UF</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {empresas.map((r) => (
                        <TableRow key={r.id} className="hover:bg-muted/30">
                          <TableCell>
                            {logoUrl(r) ? (
                              <img src={logoUrl(r)} alt={r.razao_social} className="w-10 h-10 rounded-lg object-cover border" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-primary" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium max-w-[220px] truncate">{r.razao_social}</TableCell>
                          <TableCell className="max-w-[160px] truncate text-muted-foreground">{r.nome_fantasia}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatCNPJ(r.cnpj)}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.cidade}/{r.estado}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatPhone(r.telefone)}</TableCell>
                          <TableCell className="max-w-[140px] truncate">{r.responsavel_legal}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${planoBadge(r.plano)}`}>
                              {r.plano || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusBadge(r.status)}`}>
                              {r.status || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" title="Visualizar detalhes" onClick={() => navigate(`/empresas/${r.id}`)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {canEdit && (
                                <Button size="sm" variant="ghost" title="Editar" onClick={() => openEdit(r)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              )}
                              {canEdit && (
                                <Button size="sm" variant="ghost" title="Duplicar" onClick={() => openDuplicate(r)}>
                                  <Copy className="w-4 h-4" />
                                </Button>
                              )}
                              {canManage && (
                                <Button size="sm" variant="ghost" title={r.status === "Ativo" ? "Desativar" : "Ativar"} onClick={() => handleToggle(r)}>
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
              {!loading && empresas.length > 0 && (
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
                    <span className="ml-2">{totalItems} empresa(s)</span>
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
            <DialogTitle>{editing ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-2">
                <Label>Logo da empresa</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Selecionar imagem
                  </Button>
                  {logoPreview && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setLogoFile(null); setLogoPreview(null); setRemoveLogo(true); }}>
                      Remover
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">JPG, PNG, GIF ou WEBP — máx 5MB.</p>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={onLogoChange} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Razão Social *</Label>
                <Input value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} />
                {formErrors.razao_social && <p className="text-xs text-destructive">{formErrors.razao_social}</p>}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Nome Fantasia *</Label>
                <Input value={form.nome_fantasia} onChange={(e) => set("nome_fantasia", e.target.value)} />
                {formErrors.nome_fantasia && <p className="text-xs text-destructive">{formErrors.nome_fantasia}</p>}
              </div>
              <div className="space-y-2">
                <Label>CNPJ *</Label>
                <Input value={form.cnpj} onChange={(e) => set("cnpj", formatCNPJ(e.target.value))} placeholder="00.000.000/0000-00" />
                {formErrors.cnpj && <p className="text-xs text-destructive">{formErrors.cnpj}</p>}
              </div>
              <div className="space-y-2">
                <Label>Inscrição Estadual</Label>
                <Input value={form.inscricao_estadual} onChange={(e) => set("inscricao_estadual", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Inscrição Municipal</Label>
                <Input value={form.inscricao_municipal} onChange={(e) => set("inscricao_municipal", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CEP *</Label>
                <Input value={form.cep} onChange={(e) => set("cep", formatCEP(e.target.value))} placeholder="00000-000" />
                {formErrors.cep && <p className="text-xs text-destructive">{formErrors.cep}</p>}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Endereço *</Label>
                <Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} />
                {formErrors.endereco && <p className="text-xs text-destructive">{formErrors.endereco}</p>}
              </div>
              <div className="space-y-2">
                <Label>Número *</Label>
                <Input value={form.numero} onChange={(e) => set("numero", e.target.value)} />
                {formErrors.numero && <p className="text-xs text-destructive">{formErrors.numero}</p>}
              </div>
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input value={form.complemento} onChange={(e) => set("complemento", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bairro *</Label>
                <Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
                {formErrors.bairro && <p className="text-xs text-destructive">{formErrors.bairro}</p>}
              </div>
              <div className="space-y-2">
                <Label>Cidade *</Label>
                <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
                {formErrors.cidade && <p className="text-xs text-destructive">{formErrors.cidade}</p>}
              </div>
              <div className="space-y-2">
                <Label>Estado (UF) *</Label>
                <Select value={form.estado} onValueChange={(v) => set("estado", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS_BRASILEIROS.map((e) => <SelectItem key={e.sigla} value={e.sigla}>{e.sigla} — {e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.estado && <p className="text-xs text-destructive">{formErrors.estado}</p>}
              </div>
              <div className="space-y-2">
                <Label>País</Label>
                <Input value={form.pais} onChange={(e) => set("pais", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone *</Label>
                <Input value={form.telefone} onChange={(e) => set("telefone", formatPhone(e.target.value))} placeholder="(00) 00000-0000" />
                {formErrors.telefone && <p className="text-xs text-destructive">{formErrors.telefone}</p>}
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp} onChange={(e) => set("whatsapp", formatPhone(e.target.value))} placeholder="(00) 00000-0000" />
                {formErrors.whatsapp && <p className="text-xs text-destructive">{formErrors.whatsapp}</p>}
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://..." />
                {formErrors.website && <p className="text-xs text-destructive">{formErrors.website}</p>}
              </div>
              <div className="space-y-2">
                <Label>Responsável Legal *</Label>
                <Input value={form.responsavel_legal} onChange={(e) => set("responsavel_legal", e.target.value)} />
                {formErrors.responsavel_legal && <p className="text-xs text-destructive">{formErrors.responsavel_legal}</p>}
              </div>
              <div className="space-y-2">
                <Label>CPF do Responsável *</Label>
                <Input value={form.cpf_responsavel} onChange={(e) => set("cpf_responsavel", formatCPF(e.target.value))} placeholder="000.000.000-00" />
                {formErrors.cpf_responsavel && <p className="text-xs text-destructive">{formErrors.cpf_responsavel}</p>}
              </div>
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={form.plano} onValueChange={(v) => set("plano", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLANOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_EMPRESA.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
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
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : editing ? "Atualizar" : "Cadastrar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja arquivar <strong>{deleteTarget?.razao_social}</strong>? O registro sai da lista, mas fica guardado no histórico (nada é apagado).
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
    </>
  );
};

export default EmpresasPage;
