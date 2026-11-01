import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import jsPDF from "jspdf";

import pb from "@/lib/pocketbaseClient.js";
import { useAuth } from "@/contexts/AuthContext.jsx";
import { auditLog, AUDIT_ACTIONS } from "@/lib/auditLogger.js";
import { mensagemErro } from "@/lib/erros.js";
import { useUsuarios } from "@/hooks/useUsuarios.js";
import { formatCPF, formatPhone } from "@/utils/usuariosValidations.js";

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
  KeyRound,
  Ban,
  ShieldCheck,
  Power,
  Printer,
  FileText,
  UserCircle,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Calendar,
  History,
  ShieldAlert,
  Hash,
  IdCard,
  ClipboardList,
} from "lucide-react";

const COUNT_META = [
  { key: "obras", icon: Building2, label: "Obras vinculadas" },
  { key: "solicitacoes", icon: ClipboardList, label: "Solicitações criadas" },
  { key: "compras", icon: FileText, label: "Compras criadas" },
  { key: "equipamentos", icon: Briefcase, label: "Equipamentos (resp.)" },
  { key: "epis", icon: ShieldAlert, label: "EPIs entregues" },
  { key: "documentos", icon: FileText, label: "Documentos criados" },
];

const fotoUrlBig = (rec) => {
  if (rec?.foto) {
    try {
      return pb.files.getURL(rec, rec.foto, { thumb: "300x300" });
    } catch {
      return null;
    }
  }
  return null;
};

const UsuarioDetalhesPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  const {
    empresas,
    obras,
    deleteUsuario,
    blockUsuario,
    unblockUsuario,
    activateUsuario,
    deactivateUsuario,
    resetPassword,
    fetchCounts,
    fetchHistorico,
  } = useUsuarios();

  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [counts, setCounts] = useState({});
  const [countsLoading, setCountsLoading] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetResult, setResetResult] = useState(null);

  const canManage = isAdmin || currentUser?.cargo === "Administrador";
  const canEdit =
    isAdmin ||
    currentUser?.cargo === "Administrador" ||
    currentUser?.cargo === "Gerente" ||
    currentUser?.cargo === "Gerência";

  const loadUsuario = async () => {
    setLoading(true);
    setError(false);
    try {
      const rec = await pb.collection("users").getOne(id, {
        expand: "company_id,obra_vinculada_id,created_by",
        $autoCancel: false,
      });
      setUsuario(rec);
    } catch (err) {
      console.error("Erro ao carregar usuário:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsuario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (usuario?.id) {
      setCountsLoading(true);
      fetchCounts(usuario.id, usuario.company_id)
        .then(setCounts)
        .finally(() => setCountsLoading(false));
      fetchHistorico(usuario.id).then(setHistorico);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  const empresaNome = usuario?.expand?.company_id?.razao_social ||
    empresas.find((em) => em.id === usuario?.company_id)?.razao_social ||
    "—";
  const obraNome = usuario?.expand?.obra_vinculada_id?.nome ||
    obras.find((o) => o.id === usuario?.obra_vinculada_id)?.nome ||
    "—";

  const handleBlock = async () => {
    const res = await blockUsuario(usuario);
    if (res.success) { toast.success("Usuário bloqueado."); setUsuario(res.record); }
    else toast.error(res.error || "Erro ao bloquear.");
  };

  const handleUnblock = async () => {
    const res = await unblockUsuario(usuario);
    if (res.success) { toast.success("Usuário desbloqueado."); setUsuario(res.record); }
    else toast.error(res.error || "Erro ao desbloquear.");
  };

  const handleToggleActive = async () => {
    const res = usuario.status === "Ativo" ? await deactivateUsuario(usuario) : await activateUsuario(usuario);
    if (res.success) { toast.success(`Usuário ${usuario.status === "Ativo" ? "desativado" : "ativado"}.`); setUsuario(res.record); }
    else toast.error(res.error || "Erro ao alterar status.");
  };

  // Convite não aceito (nunca entrou): reenvia o e-mail "Criar minha senha".
  // O servidor diz se saiu ou por que não saiu (convite-seguro.pb.js).
  const [reenviando, setReenviando] = useState(false);
  const convitePendente = usuario && usuario.status === "Inativo" && !usuario.last_login && !String(usuario.email || "").endsWith("@arquivado.invalid");
  const handleReenviarConvite = async () => {
    setReenviando(true);
    try {
      const r = await pb.send("/api/custom/reenviar-convite", { method: "POST", body: { user_id: usuario.id }, $autoCancel: false });
      toast.success(`Convite reenviado para ${r.email}. Peça para olhar também a caixa de spam.`, { duration: 10000 });
      await auditLog(AUDIT_ACTIONS.USER_UPDATED, "Usuários", `Convite reenviado para ${r.email} (ID ${usuario.id})`);
    } catch (err) {
      toast.error(mensagemErro(err, "Não foi possível reenviar o convite agora."), { duration: 12000 });
    } finally {
      setReenviando(false);
    }
  };

  const handleDelete = async () => {
    const res = await deleteUsuario(usuario.id, usuario.nome_completo);
    if (res.success) { toast.success("Usuário excluído."); navigate("/usuarios"); }
    else toast.error(res.error || "Erro ao excluir.");
  };

  const handleReset = async () => {
    const res = await resetPassword(usuario);
    if (res.success) { setResetResult(res.tempPassword); toast.success("Senha resetada."); }
    else toast.error(res.error || "Erro ao resetar senha.");
  };

  const exportFichaPDF = async () => {
    await auditLog(AUDIT_ACTIONS.EXPORT_DATA, "Usuários", `PDF da ficha: ${usuario.nome_completo || usuario.email}`, "success");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFontSize(16);
    doc.text(usuario.nome_completo || usuario.email || "Usuário", 40, 40);
    doc.setFontSize(10);
    const linhas = [
      `Email: ${usuario.email || ""}`,
      `Username: ${usuario.username || ""}   ID Único: ${usuario.id_unico || ""}`,
      `Cargo: ${usuario.cargo || ""}   Perfil: ${usuario.perfil_acesso || ""}`,
      `Departamento: ${usuario.departamento || ""}   Centro de Custo: ${usuario.centro_custo || ""}`,
      `Empresa: ${empresaNome}   Obra: ${obraNome}`,
      `Telefone: ${formatPhone(usuario.telefone)}   CPF: ${formatCPF(usuario.cpf)}   RG: ${usuario.rg || "—"}`,
      `Admissão: ${usuario.data_admissao ? new Date(usuario.data_admissao).toLocaleDateString("pt-BR") : "—"}   Demissão: ${usuario.data_demissao ? new Date(usuario.data_demissao).toLocaleDateString("pt-BR") : "—"}`,
      `Status: ${usuario.status || ""}   Bloqueado: ${usuario.is_blocked ? "Sim" : "Não"}`,
      `Último Login: ${usuario.last_login ? new Date(usuario.last_login).toLocaleString("pt-BR") : "—"}`,
      `Tentativas: ${usuario.login_attempts ?? 0}`,
      `Observações: ${usuario.observacoes || "—"}`,
      `Cadastro: ${usuario.created ? new Date(usuario.created).toLocaleString("pt-BR") : "—"}`,
      `Convidado por: ${usuario.expand?.created_by?.name || usuario.expand?.created_by?.username || "—"}`,
    ];
    let y = 70;
    linhas.forEach((l) => { doc.text(l, 40, y); y += 18; });
    doc.save(`usuario-${usuario.id}.pdf`);
    toast.success("Ficha exportada em PDF.");
  };

  const printFicha = async () => {
    await auditLog(AUDIT_ACTIONS.EXPORT_DATA, "Usuários", `Impressão da ficha: ${usuario.nome_completo || usuario.email}`, "success");
    window.print();
  };

  if (loading) {
    return (
      <>
        <Helmet><title>Detalhes do Usuário — APP OBRA</title></Helmet>
        <Header />
        <div className="app-container py-8 space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </>
    );
  }

  if (error || !usuario) {
    return (
      <>
        <Helmet><title>Usuário não encontrado — APP OBRA</title></Helmet>
        <Header />
        <div className="app-container py-16 text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Usuário não encontrado</h1>
          <p className="text-muted-foreground mb-6">O registro pode ter sido removido ou você não tem acesso.</p>
          <Button onClick={() => navigate("/usuarios")}>Voltar à lista</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{usuario.nome_completo || usuario.email} — Detalhes | APP OBRA</title>
        <meta name="description" content={`Detalhes do usuário ${usuario.nome_completo || usuario.email}`} />
      </Helmet>
      <Header />
      <main className="py-8 bg-muted/20 min-h-screen">
        <div className="app-container space-y-6">
          {/* Topo */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => navigate("/usuarios")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
              </Button>
              <h1 className="text-2xl font-bold text-primary truncate">{usuario.nome_completo || usuario.email}</h1>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${usuario.is_blocked ? "bg-red-500/10 text-red-700 border-red-500/20" : usuario.status === "Ativo" ? "bg-green-500/10 text-green-700 border-green-500/20" : "bg-gray-500/10 text-gray-700 border-gray-500/20"}`}>
                {usuario.is_blocked ? "Bloqueado" : usuario.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportFichaPDF}><FileText className="w-4 h-4 mr-2" /> PDF</Button>
              <Button variant="outline" size="sm" onClick={printFicha}><Printer className="w-4 h-4 mr-2" /> Imprimir</Button>
              {canManage && convitePendente && (
                <Button variant="outline" size="sm" disabled={reenviando} onClick={handleReenviarConvite}>
                  <Mail className="w-4 h-4 mr-2" /> Reenviar convite
                </Button>
              )}
              {canManage && (
                <Button variant="outline" size="sm" onClick={handleToggleActive}>
                  <Power className={`w-4 h-4 mr-2 ${usuario.status === "Ativo" ? "text-green-600" : "text-red-600"}`} />
                  {usuario.status === "Ativo" ? "Desativar" : "Ativar"}
                </Button>
              )}
              {canManage && (
                usuario.is_blocked ? (
                  <Button variant="outline" size="sm" onClick={handleUnblock}>
                    <ShieldCheck className="w-4 h-4 mr-2 text-green-600" /> Desbloquear
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleBlock}>
                    <Ban className="w-4 h-4 mr-2 text-red-600" /> Bloquear
                  </Button>
                )
              )}
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => { setResetResult(null); setResetOpen(true); }}>
                  <KeyRound className="w-4 h-4 mr-2" /> Resetar Senha
                </Button>
              )}
              {canEdit && (
                <Button size="sm" onClick={() => navigate(`/usuarios/${usuario.id}/editar`)}>
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
                  <div className="w-28 h-28 rounded-full border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                    {fotoUrlBig(usuario) ? (
                      <img src={fotoUrlBig(usuario)} alt={usuario.nome_completo} className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle className="w-16 h-16 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <h2 className="text-xl font-bold text-primary">{usuario.nome_completo || usuario.name}</h2>
                    <p className="text-muted-foreground flex items-center gap-2"><Mail className="w-4 h-4" /> {usuario.email}</p>
                    <p className="text-sm flex items-center gap-2"><Hash className="w-4 h-4 text-muted-foreground" /> Username: {usuario.username} <span className="mx-2">|</span> ID: {usuario.id_unico}</p>
                    <p className="text-sm flex items-center gap-2"><Briefcase className="w-4 h-4 text-muted-foreground" /> {usuario.cargo}</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-700 border-blue-500/20">
                        Perfil: {usuario.perfil_acesso || "—"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pessoal + Profissional */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><IdCard className="w-4 h-4 text-accent" /> Dados Pessoais</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="flex items-center gap-2"><IdCard className="w-4 h-4 text-muted-foreground" /> CPF: {formatCPF(usuario.cpf) || "—"}</p>
                    <p className="flex items-center gap-2"><IdCard className="w-4 h-4 text-muted-foreground" /> RG: {usuario.rg || "—"}</p>
                    <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /> {formatPhone(usuario.telefone) || "—"}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Briefcase className="w-4 h-4 text-accent" /> Dados Profissionais</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Departamento:</span> {usuario.departamento || "—"}</p>
                    <p><span className="text-muted-foreground">Centro de Custo:</span> {usuario.centro_custo || "—"}</p>
                    <p><span className="text-muted-foreground">Empresa:</span> {empresaNome}</p>
                    <p><span className="text-muted-foreground">Obra:</span> {obraNome}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Datas */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-accent" /> Datas & Segurança</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <p><span className="text-muted-foreground">Admissão:</span> {usuario.data_admissao ? new Date(usuario.data_admissao).toLocaleDateString("pt-BR") : "—"}</p>
                  <p><span className="text-muted-foreground">Demissão:</span> {usuario.data_demissao ? new Date(usuario.data_demissao).toLocaleDateString("pt-BR") : "—"}</p>
                  <p><span className="text-muted-foreground">Último login:</span> {usuario.last_login ? new Date(usuario.last_login).toLocaleString("pt-BR") : "—"}</p>
                  <p><span className="text-muted-foreground">Tentativas:</span> {usuario.login_attempts ?? 0}</p>
                  <p><span className="text-muted-foreground">Cadastro:</span> {usuario.created ? new Date(usuario.created).toLocaleString("pt-BR") : "—"}</p>
                  {/* Quem convidou: gravado pelo servidor (pb_hooks/autoria.pb.js) */}
                  <p><span className="text-muted-foreground">Convidado por:</span> {usuario.expand?.created_by?.name || usuario.expand?.created_by?.username || "—"}</p>
                  <p><span className="text-muted-foreground">Atualização:</span> {usuario.updated ? new Date(usuario.updated).toLocaleString("pt-BR") : "—"}</p>
                </CardContent>
              </Card>

              {usuario.observacoes && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{usuario.observacoes}</p></CardContent>
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
                    Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)
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
            </div>
          </div>
        </div>
      </main>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja inativar <strong>{usuario.nome_completo}</strong>? A pessoa perde o acesso, mas o cadastro e o histórico ficam guardados (nada é apagado). Dá para reativar depois.
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

      <AlertDialog open={resetOpen} onOpenChange={(o) => { setResetOpen(o); if (!o) setResetResult(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar Senha</AlertDialogTitle>
            <AlertDialogDescription>
              {resetResult ? (
                <span>
                  Nova senha temporária para <strong>{usuario.nome_completo}</strong>:
                  <code className="block mt-2 p-2 bg-muted rounded text-sm font-mono select-all">{resetResult}</code>
                </span>
              ) : (
                <>Deseja gerar uma nova senha temporária para <strong>{usuario.nome_completo}</strong>?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {resetResult ? (
              <AlertDialogAction onClick={() => { setResetOpen(false); setResetResult(null); }}>Concluir</AlertDialogAction>
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

export default UsuarioDetalhesPage;
