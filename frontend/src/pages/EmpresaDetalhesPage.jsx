import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import jsPDF from "jspdf";

import pb from "@/lib/pocketbaseClient.js";
import { useAuth } from "@/contexts/AuthContext.jsx";
import { auditLog, AUDIT_ACTIONS } from "@/lib/auditLogger.js";
import {
  formatCNPJ,
  formatCPF,
  formatPhone,
  formatCEP,
  ESTADOS_BRASILEIROS,
} from "@/utils/empresasValidations.js";

import Header from "@/components/Header.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  ArrowLeft,
  Pencil,
  Trash2,
  Power,
  Printer,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  User,
  FileText,
  Users,
  Package,
  Wrench,
  HardHat,
  ShoppingCart,
  FolderOpen,
  ClipboardList,
  CreditCard,
  Calendar,
  History,
} from "lucide-react";

const COUNT_META = [
  { key: "usuarios", icon: Users, label: "Usuários" },
  { key: "obras", icon: Building2, label: "Obras" },
  { key: "equipamentos", icon: Wrench, label: "Equipamentos" },
  { key: "documentos", icon: FolderOpen, label: "Documentos" },
  { key: "solicitacoes", icon: ClipboardList, label: "Solicitações" },
  { key: "compras", icon: ShoppingCart, label: "Compras" },
  { key: "materiais", icon: Package, label: "Materiais" },
  { key: "epis", icon: HardHat, label: "EPIs" },
  { key: "clientes", icon: CreditCard, label: "Clientes" },
];

const COUNT_COLLECTIONS = {
  usuarios: "users",
  obras: "obras",
  equipamentos: "equipamentos",
  documentos: "documentos",
  solicitacoes: "solicitacoes_compra",
  compras: "compras",
  materiais: "materiais",
  epis: "epis",
  clientes: "clientes",
};

const logoUrlBig = (rec) => {
  if (rec?.logo) {
    try {
      return pb.files.getURL(rec, rec.logo, { thumb: "300x300" });
    } catch {
      return null;
    }
  }
  return null;
};

const EmpresaDetalhesPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [counts, setCounts] = useState({});
  const [countsLoading, setCountsLoading] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canEdit = isAdmin || currentUser?.cargo === "Administrador" || currentUser?.cargo === "Gerência";
  const canManage = isAdmin || currentUser?.cargo === "Administrador";

  const loadEmpresa = async () => {
    setLoading(true);
    setError(false);
    try {
      const rec = await pb.collection("empresas").getOne(id, { $autoCancel: false });
      setEmpresa(rec);
    } catch (err) {
      console.error("Erro ao carregar empresa:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadCounts = async (empresaId) => {
    setCountsLoading(true);
    try {
      const entries = await Promise.allSettled(
        Object.entries(COUNT_COLLECTIONS).map(([key, col]) =>
          pb
            .collection(col)
            .getList(1, 1, { filter: `company_id = "${empresaId}"`, $autoCancel: false })
            .then((r) => [key, r.totalItems]),
        ),
      );
      const map = {};
      entries.forEach((e) => {
        if (e.status === "fulfilled") map[e.value[0]] = e.value[1];
      });
      setCounts(map);
    } catch (err) {
      console.error("Erro ao carregar contagens:", err);
    } finally {
      setCountsLoading(false);
    }
  };

  const loadHistorico = async (empresaId) => {
    try {
      const logs = await pb.collection("audit_logs").getList(1, 20, {
        filter: `modulo = "Empresas" && detalhes ~ "${empresaId}"`,
        sort: "-created",
        $autoCancel: false,
      });
      setHistorico(logs.items);
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    }
  };

  useEffect(() => {
    loadEmpresa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (empresa?.id) {
      loadCounts(empresa.id);
      loadHistorico(empresa.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa?.id]);

  const handleToggle = async () => {
    const novo = empresa.status === "Ativo" ? "Inativo" : "Ativo";
    try {
      const rec = await pb.collection("empresas").update(
        empresa.id,
        { status: novo, atualizado_por: currentUser?.id },
        { $autoCancel: false },
      );
      setEmpresa(rec);
      await auditLog(
        novo === "Ativo" ? "Empresa ativada" : "Empresa desativada",
        "Empresas",
        `${novo === "Ativo" ? "Ativada" : "Desativada"}: ${empresa.razao_social} — ID ${empresa.id}`,
        "success",
      );
      toast.success(`Empresa ${novo === "Ativo" ? "ativada" : "desativada"}.`);
    } catch (err) {
      toast.error("Erro ao alterar status.");
    }
  };

  const handleDelete = async () => {
    try {
      await pb.collection("empresas").delete(empresa.id, { $autoCancel: false });
      await auditLog(
        AUDIT_ACTIONS.RECORD_DELETED,
        "Empresas",
        `Empresa excluída: ${empresa.razao_social} — ID ${empresa.id}`,
        "success",
      );
      toast.success("Empresa excluída.");
      navigate("/empresas");
    } catch (err) {
      toast.error("Erro ao excluir empresa.");
    }
  };

  const printFicha = async () => {
    await auditLog(AUDIT_ACTIONS.EXPORT_DATA, "Empresas", `Impressão da ficha: ${empresa.razao_social}`, "success");
    window.print();
  };

  const exportFichaPDF = async () => {
    await auditLog(AUDIT_ACTIONS.EXPORT_DATA, "Empresas", `PDF da ficha: ${empresa.razao_social}`, "success");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFontSize(16);
    doc.text(empresa.razao_social || "Empresa", 40, 40);
    doc.setFontSize(10);
    const linhas = [
      `Nome Fantasia: ${empresa.nome_fantasia || ""}`,
      `CNPJ: ${formatCNPJ(empresa.cnpj)}`,
      `IE: ${empresa.inscricao_estadual || "—"}   IM: ${empresa.inscricao_municipal || "—"}`,
      `Endereço: ${empresa.endereco || ""}, ${empresa.numero || ""} ${empresa.complemento || ""}`,
      `Bairro: ${empresa.bairro || ""}   CEP: ${formatCEP(empresa.cep)}`,
      `Cidade/UF: ${empresa.cidade || ""}/${empresa.estado || ""}   País: ${empresa.pais || ""}`,
      `Telefone: ${formatPhone(empresa.telefone)}   WhatsApp: ${empresa.whatsapp ? formatPhone(empresa.whatsapp) : "—"}`,
      `Email: ${empresa.email || ""}   Website: ${empresa.website || "—"}`,
      `Responsável Legal: ${empresa.responsavel_legal || ""}   CPF: ${formatCPF(empresa.cpf_responsavel)}`,
      `Plano: ${empresa.plano || ""}   Status: ${empresa.status || ""}`,
      `Observações: ${empresa.observacoes || "—"}`,
      `Cadastro: ${empresa.created ? new Date(empresa.created).toLocaleString("pt-BR") : "—"}`,
      `Atualização: ${empresa.updated ? new Date(empresa.updated).toLocaleString("pt-BR") : "—"}`,
    ];
    let y = 70;
    linhas.forEach((l) => {
      doc.text(l, 40, y);
      y += 18;
    });
    doc.save(`empresa-${empresa.id}.pdf`);
    toast.success("Ficha exportada em PDF.");
  };

  if (loading) {
    return (
      <>
        <Helmet><title>Detalhes da Empresa — APP OBRA</title></Helmet>
        <Header />
        <div className="app-container py-8 space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </>
    );
  }

  if (error || !empresa) {
    return (
      <>
        <Helmet><title>Empresa não encontrada — APP OBRA</title></Helmet>
        <Header />
        <div className="app-container py-16 text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Empresa não encontrada</h1>
          <p className="text-muted-foreground mb-6">O registro pode ter sido removido ou você não tem acesso.</p>
          <Button onClick={() => navigate("/empresas")}>Voltar à lista</Button>
        </div>
      </>
    );
  }

  const estadoNome = ESTADOS_BRASILEIROS.find((e) => e.sigla === empresa.estado)?.nome || empresa.estado;

  return (
    <>
      <Helmet>
        <title>{empresa.razao_social} — Detalhes | APP OBRA</title>
        <meta name="description" content={`Detalhes da empresa ${empresa.razao_social}`} />
      </Helmet>
      <Header />
      <main className="py-8 bg-muted/20 min-h-screen">
        <div className="app-container space-y-6">
          {/* Topo */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/empresas")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
              </Button>
              <h1 className="text-2xl font-bold text-primary truncate">{empresa.razao_social}</h1>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${empresa.status === "Ativo" ? "bg-green-500/10 text-green-700 border-green-500/20" : "bg-red-500/10 text-red-700 border-red-500/20"}`}>
                {empresa.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportFichaPDF}><FileText className="w-4 h-4 mr-2" /> PDF</Button>
              <Button variant="outline" size="sm" onClick={printFicha}><Printer className="w-4 h-4 mr-2" /> Imprimir</Button>
              {canManage && (
                <Button variant="outline" size="sm" onClick={handleToggle}>
                  <Power className={`w-4 h-4 mr-2 ${empresa.status === "Ativo" ? "text-green-600" : "text-red-600"}`} />
                  {empresa.status === "Ativo" ? "Desativar" : "Ativar"}
                </Button>
              )}
              {canEdit && (
                <Button size="sm" onClick={() => navigate(`/empresas/${empresa.id}/editar`)}>
                  <Pencil className="w-4 h-4 mr-2" /> Editar
                </Button>
              )}
              {canManage && (
                <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna principal */}
            <div className="lg:col-span-2 space-y-6">
              {/* Identificação */}
              <Card>
                <CardContent className="p-6 flex flex-col sm:flex-row gap-6">
                  <div className="w-28 h-28 rounded-xl border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                    {logoUrlBig(empresa) ? (
                      <img src={logoUrlBig(empresa)} alt={empresa.razao_social} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-12 h-12 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <h2 className="text-xl font-bold text-primary">{empresa.razao_social}</h2>
                    <p className="text-muted-foreground">{empresa.nome_fantasia}</p>
                    <p className="text-sm"><span className="font-medium">CNPJ:</span> {formatCNPJ(empresa.cnpj)}</p>
                    <p className="text-sm"><span className="font-medium">IE:</span> {empresa.inscricao_estadual || "—"} <span className="mx-2">|</span> <span className="font-medium">IM:</span> {empresa.inscricao_municipal || "—"}</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border bg-amber-500/10 text-amber-700 border-amber-500/20">Plano: {empresa.plano || "—"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contato + Endereço */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Phone className="w-4 h-4 text-accent" /> Contato</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /> {formatPhone(empresa.telefone)}</p>
                    <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-green-600" /> {empresa.whatsapp ? formatPhone(empresa.whatsapp) : "—"}</p>
                    <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /> {empresa.email}</p>
                    <p className="flex items-center gap-2"><Globe className="w-4 h-4 text-muted-foreground" /> {empresa.website || "—"}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-accent" /> Endereço</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>{empresa.endereco}, {empresa.numero} {empresa.complemento}</p>
                    <p>{empresa.bairro} — CEP {formatCEP(empresa.cep)}</p>
                    <p>{empresa.cidade}/{empresa.estado} — {estadoNome}</p>
                    <p>{empresa.pais || "Brasil"}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Responsável */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-accent" /> Responsável Legal</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="font-medium">{empresa.responsavel_legal}</p>
                  <p className="text-muted-foreground">CPF: {formatCPF(empresa.cpf_responsavel)}</p>
                </CardContent>
              </Card>

              {empresa.observacoes && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{empresa.observacoes}</p></CardContent>
                </Card>
              )}

              {/* Histórico */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4 text-accent" /> Histórico (auditoria)</CardTitle></CardHeader>
                <CardContent>
                  {historico.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhum registro de auditoria encontrado.</p>
                  ) : (
                    <ol className="relative border-l border-border ml-2 space-y-4">
                      {historico.map((h) => (
                        <li key={h.id} className="ml-4">
                          <span className="absolute -left-[7px] mt-1 w-3 h-3 rounded-full bg-accent" />
                          <p className="text-sm font-medium">{h.acao}</p>
                          <p className="text-xs text-muted-foreground">{h.detalhes}</p>
                          <p className="text-xs text-muted-foreground">{h.usuario} — {h.data} {h.hora}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Coluna lateral — contagens */}
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="w-4 h-4 text-accent" /> Recursos vinculados</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  {countsLoading ? (
                    Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-20" />)
                  ) : (
                    COUNT_META.map((c) => (
                      <div key={c.key} className="rounded-lg border bg-card p-3 flex flex-col items-center text-center">
                        <c.icon className="w-5 h-5 text-primary mb-1" />
                        <span className="text-2xl font-bold text-primary">{counts[c.key] ?? 0}</span>
                        <span className="text-xs text-muted-foreground">{c.label}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-accent" /> Datas</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Cadastro:</span> {empresa.created ? new Date(empresa.created).toLocaleString("pt-BR") : "—"}</p>
                  <p><span className="text-muted-foreground">Atualização:</span> {empresa.updated ? new Date(empresa.updated).toLocaleString("pt-BR") : "—"}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja arquivar <strong>{empresa.razao_social}</strong>? O registro sai da lista, mas fica guardado no histórico (nada é apagado).
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

export default EmpresaDetalhesPage;
