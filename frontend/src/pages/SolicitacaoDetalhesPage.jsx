import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import pb from "@/lib/pocketbaseClient.js";
import { useAuth } from "@/contexts/AuthContext.jsx";
import { useSolicitacoes } from "@/hooks/useSolicitacoes.js";
import {  NIVEIS_APROVACAO, STATUS_APROVACAO,
  TIPOS_ANEXO, tipoColor, statusColor, prioridadeColor, formatDate,
} from "@/utils/solicitacoesValidations.js";
import Header from "@/components/Header.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Pencil, FileText, Plus, Trash2, CheckCircle2, Download, ClipboardCheck, Paperclip,
} from "lucide-react";

const SolicitacaoDetalhesPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const h = useSolicitacoes();
  const [solicitacao, setSolicitacao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aprovacoes, setAprovacoes] = useState([]);
  const [anexos, setAnexos] = useState([]);
  const [historico, setHistorico] = useState([]);

  const [aprovModal, setAprovModal] = useState(false);
  const [aprovForm, setAprovForm] = useState(emptyAprov());
  const [anexoModal, setAnexoModal] = useState(false);
  const [anexoForm, setAnexoForm] = useState({ tipo_anexo: "Documento", descricao: "" });
  const [anexoFile, setAnexoFile] = useState(null);

  function emptyAprov() {
    return { nivel_aprovacao: "Supervisor", usuario_id: currentUser?.id || "", data_aprovacao: new Date().toISOString().split("T")[0], hora_aprovacao: new Date().toTimeString().slice(0, 5), status_aprovacao: "Aprovado", observacao: "" };
  }

  const loadAll = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const s = await pb.collection("solicitacoes").getOne(id, { expand: "solicitante_id,obra_id,responsavel_id", $autoCancel: false });
      setSolicitacao(s);
      const [ap, an, hi] = await Promise.all([
        h.fetchAprovacoes(id), h.fetchAnexos(id), h.fetchHistorico(id),
      ]);
      setAprovacoes(ap); setAnexos(an); setHistorico(hi);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar solicitação");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [id]);

  const submitAprov = async (e) => {
    e.preventDefault();
    const res = await h.addAprovacao(id, aprovForm);
    if (res.success) {
      toast.success("Aprovação registrada");
      setAprovModal(false); setAprovForm(emptyAprov());
      loadAll();
    } else {
      if (res.errors?._form) toast.error(res.errors._form);
    }
  };

  const submitAnexo = async (e) => {
    e.preventDefault();
    const res = await h.addAnexo(id, anexoForm, anexoFile);
    if (res.success) {
      toast.success("Anexo adicionado");
      setAnexoModal(false); setAnexoForm({ tipo_anexo: "Documento", descricao: "" }); setAnexoFile(null);
      setAnexos(await h.fetchAnexos(id));
    } else {
      if (res.errors?._form) toast.error(res.errors._form);
    }
  };

  const removeAnexo = async (anexoId) => {
    const res = await h.deleteAnexo(anexoId);
    if (res.success) { toast.success("Anexo removido"); setAnexos(await h.fetchAnexos(id)); }
    else toast.error(res.error);
  };

  const handleConcluir = async () => {
    const res = await h.concluirSolicitacao(solicitacao);
    if (res.success) { toast.success("Solicitação concluída"); loadAll(); }
    else toast.error(res.error);
  };

  const gerarPDF = () => {
    import("jspdf").then(({ jsPDF }) => {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Solicitação ${solicitacao.numero_solicitacao || ""}`, 14, 18);
      doc.setFontSize(10);
      doc.text(`Tipo: ${solicitacao.tipo}`, 14, 28);
      doc.text(`Status: ${solicitacao.status}`, 14, 34);
      doc.text(`Solicitante: ${solicitacao.expand?.solicitante_id?.nome_completo || "-"}`, 14, 40);
      doc.text(`Data: ${formatDate(solicitacao.data_solicitacao)}`, 14, 46);
      doc.text(`Prazo: ${formatDate(solicitacao.data_prazo)}`, 14, 52);
      doc.text(`Descrição: ${solicitacao.descricao || ""}`, 14, 60);
      doc.save(`solicitacao-${solicitacao.numero_solicitacao || id}.pdf`);
      h.exportAudit("PDF ficha");
    });
  };

  if (loading) {
    return (
      <>
        <Helmet><title>Detalhes da Solicitação - APP OBRA</title></Helmet>
        <Header />
        <div className="app-container py-8"><Skeleton className="h-96 w-full" /></div>
      </>
    );
  }

  if (!solicitacao) {
    return (
      <>
        <Helmet><title>Solicitação não encontrada - APP OBRA</title></Helmet>
        <Header />
        <div className="app-container py-16 text-center">
          <p className="text-muted-foreground mb-4">Solicitação não encontrada.</p>
          <Button onClick={() => navigate("/solicitacoes")}>Voltar para Solicitações</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>{`Solicitação ${solicitacao.numero_solicitacao || ""} - APP OBRA`}</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/20 min-h-screen">
        <div className="app-container">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => navigate("/solicitacoes")}><ArrowLeft className="w-4 h-4" /></Button>
              <div>
                <h1 className="text-2xl font-bold text-primary">{solicitacao.numero_solicitacao || "Solicitação"}</h1>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${tipoColor(solicitacao.tipo)}`}>{solicitacao.tipo}</span>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${statusColor(solicitacao.status)}`}>{solicitacao.status}</span>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${prioridadeColor(solicitacao.prioridade)}`}>{solicitacao.prioridade || "Normal"}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={gerarPDF}><FileText className="w-4 h-4 mr-2" />PDF</Button>
              {h.canEdit && !["Cancelada", "Concluída", "Rejeitada"].includes(solicitacao.status) && <Button variant="outline" onClick={() => navigate(`/solicitacoes/${id}/editar`)}><Pencil className="w-4 h-4 mr-2" />Editar</Button>}
              {h.canApprove && !["Aprovada", "Concluída", "Cancelada", "Rejeitada"].includes(solicitacao.status) && <Button onClick={() => setAprovModal(true)}><CheckCircle2 className="w-4 h-4 mr-2" />Aprovar</Button>}
              {h.canEdit && !["Concluída", "Cancelada", "Rejeitada"].includes(solicitacao.status) && <Button variant="outline" onClick={handleConcluir}><CheckCircle2 className="w-4 h-4 mr-2" />Concluir</Button>}
            </div>
          </div>

          {/* Dados principais */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Dados da Solicitação</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <Info label="Solicitante" value={solicitacao.expand?.solicitante_id?.nome_completo || solicitacao.expand?.solicitante_id?.name || "-"} />
                <Info label="Responsável" value={solicitacao.expand?.responsavel_id?.nome_completo || "-"} />
                <Info label="Obra" value={solicitacao.expand?.obra_id?.nome || "-"} />
                <Info label="Departamento" value={solicitacao.departamento || "-"} />
                <Info label="Centro de Custo" value={solicitacao.centro_custo || "-"} />
                <Info label="Categoria" value={solicitacao.categoria || "-"} />
                <Info label="Data Solicitação" value={formatDate(solicitacao.data_solicitacao)} />
                <Info label="Prazo" value={formatDate(solicitacao.data_prazo)} />
                <Info label="Prioridade" value={solicitacao.prioridade || "Normal"} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Descrição e Justificativa</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Descrição</p><p className="text-sm">{solicitacao.descricao || "-"}</p></div>
                {solicitacao.justificativa && <div><p className="text-xs text-muted-foreground">Justificativa</p><p className="text-sm">{solicitacao.justificativa}</p></div>}
                {solicitacao.observacoes && <div><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm">{solicitacao.observacoes}</p></div>}
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="aprovacao">
            <TabsList className="mb-4">
              <TabsTrigger value="aprovacao"><ClipboardCheck className="w-4 h-4 mr-1" />Aprovação</TabsTrigger>
              <TabsTrigger value="anexos"><Paperclip className="w-4 h-4 mr-1" />Anexos</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            {/* APROVAÇÃO */}
            <TabsContent value="aprovacao">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-lg">Fluxo de Aprovação</CardTitle>
                  {h.canApprove && <Button size="sm" onClick={() => setAprovModal(true)}><Plus className="w-4 h-4 mr-1" />Registrar</Button>}
                </CardHeader>
                <CardContent>
                  {aprovacoes.length === 0 ? <p className="text-center py-8 text-muted-foreground">Nenhuma aprovação registrada</p> : (
                    <div className="space-y-3">
                      {aprovacoes.map((a) => (
                        <div key={a.id} className="flex items-start gap-3 p-3 border rounded-lg">
                          <div className={`w-3 h-3 rounded-full mt-1.5 ${a.status_aprovacao === "Aprovado" ? "bg-green-500" : a.status_aprovacao === "Rejeitado" ? "bg-red-500" : "bg-amber-500"}`} />
                          <div className="flex-1">
                            <div className="flex justify-between">
                              <p className="font-semibold text-sm">{a.nivel_aprovacao} — {a.expand?.usuario_id?.nome_completo || a.expand?.usuario_id?.name || "-"}</p>
                              <Badge variant="outline">{a.status_aprovacao}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{formatDate(a.data_aprovacao)} {a.hora_aprovacao}</p>
                            {a.observacao && <p className="text-sm mt-1">{a.observacao}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ANEXOS */}
            <TabsContent value="anexos">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-lg">Anexos</CardTitle>
                  {h.canEdit && <Button size="sm" onClick={() => setAnexoModal(true)}><Plus className="w-4 h-4 mr-1" />Anexar</Button>}
                </CardHeader>
                <CardContent>
                  {anexos.length === 0 ? <p className="text-center py-8 text-muted-foreground">Nenhum anexo</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {anexos.map((a) => (
                        <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-primary" />
                            <div>
                              <p className="font-medium text-sm">{a.tipo_anexo}</p>
                              <p className="text-xs text-muted-foreground">{a.descricao || a.arquivo}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <a href={h.fileUrl(a, "arquivo")} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><Download className="w-4 h-4" /></Button></a>
                            {h.canManage && <Button size="sm" variant="ghost" onClick={() => removeAnexo(a.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* HISTÓRICO */}
            <TabsContent value="historico">
              <Card>
                <CardHeader><CardTitle className="text-lg">Histórico de Ações</CardTitle></CardHeader>
                <CardContent>
                  {historico.length === 0 ? <p className="text-center py-8 text-muted-foreground">Sem histórico</p> : (
                    <div className="space-y-2">
                      {historico.map((log) => (
                        <div key={log.id} className="flex items-start gap-3 p-2 border-l-2 border-primary/30">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{log.acao}</p>
                            <p className="text-xs text-muted-foreground">{log.detalhes}</p>
                            <p className="text-xs text-muted-foreground">{log.usuario} · {formatDate(log.data)} {log.hora}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Modal Aprovação */}
      <Dialog open={aprovModal} onOpenChange={setAprovModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Registrar Aprovação</DialogTitle></DialogHeader>
          <form onSubmit={submitAprov} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nível *</Label>
                <Select value={aprovForm.nivel_aprovacao} onValueChange={(v) => setAprovForm({ ...aprovForm, nivel_aprovacao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{NIVEIS_APROVACAO.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Status *</Label>
                <Select value={aprovForm.status_aprovacao} onValueChange={(v) => setAprovForm({ ...aprovForm, status_aprovacao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_APROVACAO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2"><Label>Usuário *</Label>
                <Select value={aprovForm.usuario_id} onValueChange={(v) => setAprovForm({ ...aprovForm, usuario_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{h.usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_completo || u.name || u.email}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Data *</Label><Input type="date" value={aprovForm.data_aprovacao} onChange={(e) => setAprovForm({ ...aprovForm, data_aprovacao: e.target.value })} /></div>
              <div className="space-y-2"><Label>Hora *</Label><Input type="time" value={aprovForm.hora_aprovacao} onChange={(e) => setAprovForm({ ...aprovForm, hora_aprovacao: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Observação</Label><Textarea rows={2} value={aprovForm.observacao} onChange={(e) => setAprovForm({ ...aprovForm, observacao: e.target.value })} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setAprovModal(false)}>Cancelar</Button><Button type="submit">Registrar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Anexo */}
      <Dialog open={anexoModal} onOpenChange={setAnexoModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Anexar Documento</DialogTitle></DialogHeader>
          <form onSubmit={submitAnexo} className="space-y-3">
            <div className="space-y-2"><Label>Tipo *</Label>
              <Select value={anexoForm.tipo_anexo} onValueChange={(v) => setAnexoForm({ ...anexoForm, tipo_anexo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPOS_ANEXO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Arquivo *</Label><Input type="file" onChange={(e) => setAnexoFile(e.target.files?.[0] || null)} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Input value={anexoForm.descricao} onChange={(e) => setAnexoForm({ ...anexoForm, descricao: e.target.value })} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setAnexoModal(false)}>Cancelar</Button><Button type="submit">Anexar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

const Info = ({ label, value }) => (
  <div><p className="text-xs text-muted-foreground uppercase">{label}</p><p className="font-medium">{value}</p></div>
);

export default SolicitacaoDetalhesPage;
