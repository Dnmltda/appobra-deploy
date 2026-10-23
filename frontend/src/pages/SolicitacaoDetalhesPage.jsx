import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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
  ArrowLeft, Pencil, FileText, Plus, Trash2, CheckCircle2, Download, ClipboardCheck, Paperclip, Package, Truck, XCircle,
} from "lucide-react";
import { podeGerirSolicitacoes, podeGerirEstoque, cargoDe } from "@/lib/permissoes.js";
import FotoRetirada from "@/components/FotoRetirada.jsx";
import FotoProtegida from "@/components/FotoProtegida.jsx";

// Fluxo do material de consumo: o estoque confirma que recebeu o pedido,
// separa e avisa; quem pediu confere e aceita na retirada (só aí o material
// sai do estoque) ou recusa dizendo o que está errado.
const PASSOS = [
  { status: "Aberta", rotulo: "Pedido" },
  { status: "Aprovada", rotulo: "Recebido pelo estoque" },
  { status: "Em separação", rotulo: "Separando" },
  { status: "Pronto para retirada", rotulo: "Pronto para retirada" },
  { status: "Concluída", rotulo: "Retirado e aceito" },
];
const ABERTOS = ["Aberta", "Em análise", "Aguardando aprovação", "draft", "pending"];
// "Entregue" é de pedidos antigos (entregues antes do aceite na retirada).
const passoAtual = (status) => (ABERTOS.includes(status) ? 0
  : status === "Entregue" ? 3 : PASSOS.findIndex((p) => p.status === status));
const nivelDoCargo = (cargo) => ({ Administrador: "Administrador", Diretoria: "Administrador", "Gerência": "Gerente", Engenheiro: "Engenheiro" }[cargo] || "Supervisor");

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
  const [itens, setItens] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [novoItem, setNovoItem] = useState({ material_id: "", quantidade: "" });
  const [confirmarEntrega, setConfirmarEntrega] = useState(false);
  const [mudando, setMudando] = useState(false);

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
      const s = await pb.collection("solicitacoes").getOne(id, { expand: "solicitante_id,obra_id,responsavel_id,retirada_registrada_por", $autoCancel: false });
      setSolicitacao(s);
      const [ap, an, hi, it] = await Promise.all([
        h.fetchAprovacoes(id), h.fetchAnexos(id), h.fetchHistorico(id), h.fetchItens(id),
      ]);
      setAprovacoes(ap); setAnexos(an); setHistorico(hi); setItens(it);
      if (s.tipo === "Material" && currentUser?.company_id) {
        pb.collection("materiais").getFullList({ filter: `company_id = "${currentUser.company_id}"`, sort: "name", $autoCancel: false })
          .then(setMateriais).catch(() => setMateriais([]));
      }
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

  // ---------- fluxo do material ----------
  const souSolicitante = solicitacao?.solicitante_id === currentUser?.id;
  const gestao = podeGerirSolicitacoes(currentUser);
  const estoque = podeGerirEstoque(currentUser);
  const temFluxo = solicitacao?.tipo === "Material" || itens.length > 0;
  const aberta = ABERTOS.includes(solicitacao?.status);

  const incluirItem = async (e) => {
    e.preventDefault();
    if (!novoItem.material_id || !(Number(novoItem.quantidade) > 0)) { toast.error("Escolha o material e a quantidade"); return; }
    const res = await h.addItem(id, novoItem.material_id, novoItem.quantidade);
    if (res.success) { setNovoItem({ material_id: "", quantidade: "" }); setItens(await h.fetchItens(id)); }
    else toast.error(res.error);
  };

  const tirarItem = async (itemId) => {
    const res = await h.removeItem(itemId);
    if (res.success) setItens(await h.fetchItens(id)); else toast.error(res.error);
  };

  const avancar = async (status, mensagem, extra) => {
    setMudando(true);
    const res = status === "Aprovada" || status === "Rejeitada"
      ? await h.addAprovacao(id, {
          nivel_aprovacao: nivelDoCargo(cargoDe(currentUser)), usuario_id: currentUser.id, status_aprovacao: status === "Aprovada" ? "Aprovado" : "Rejeitado",
          data_aprovacao: new Date().toISOString().split("T")[0], hora_aprovacao: new Date().toTimeString().slice(0, 5), observacao: "",
        }).then((r) => (r.success ? r : { success: false, error: r.errors?._form }))
      : await h.mudarStatus(solicitacao, status, extra);
    setMudando(false);
    setConfirmarEntrega(false);
    if (res.success) { toast.success(mensagem); loadAll(); } else toast.error(res.error || "Não foi possível mudar o passo.");
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
              {!temFluxo && h.canApprove && !["Aprovada", "Concluída", "Cancelada", "Rejeitada"].includes(solicitacao.status) && <Button onClick={() => setAprovModal(true)}><CheckCircle2 className="w-4 h-4 mr-2" />Aprovar</Button>}
              {!temFluxo && h.canEdit && !["Concluída", "Cancelada", "Rejeitada"].includes(solicitacao.status) && <Button variant="outline" onClick={handleConcluir}><CheckCircle2 className="w-4 h-4 mr-2" />Concluir</Button>}
            </div>
          </div>

          {temFluxo && (
            <FluxoMaterial
              solicitacao={solicitacao} itens={itens} materiais={materiais} aberta={aberta}
              podeEditarItens={aberta && (souSolicitante || gestao)} gestao={gestao} estoque={estoque}
              podeAceitar={souSolicitante}
              novoItem={novoItem} setNovoItem={setNovoItem} incluirItem={incluirItem} tirarItem={tirarItem}
              avancar={avancar} mudando={mudando} confirmarEntrega={confirmarEntrega} setConfirmarEntrega={setConfirmarEntrega}
            />
          )}

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

// Andamento + materiais pedidos: o "próximo passo" aparece como um botão só,
// para quem pode dar aquele passo.
const FluxoMaterial = ({
  solicitacao, itens, materiais, podeEditarItens, gestao, estoque, podeAceitar, aberta,
  novoItem, setNovoItem, incluirItem, tirarItem, avancar, mudando, confirmarEntrega, setConfirmarEntrega,
}) => {
  const st = solicitacao.status;
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  // Retirada: quem pediu aceita, ou o almoxarifado registra no balcão; nos
  // dois casos com a foto de quem está levando (o servidor exige).
  const [foto, setFoto] = useState(null);
  const podeRetirar = podeAceitar || estoque;
  // De qual estoque sai: geral ou o da obra do pedido (quem separa escolhe).
  const obraPedido = solicitacao.obra_id || "";
  const [saldoObra, setSaldoObra] = useState(null); // { material_id: quantidade }
  const [origem, setOrigem] = useState("geral");
  useEffect(() => {
    if (!(st === "Em separação" && estoque && obraPedido)) return;
    pb.collection("estoque_obra").getFullList({ filter: `obra_id = "${obraPedido}"`, $autoCancel: false })
      .then((rs) => {
        const map = Object.fromEntries(rs.map((r) => [r.material_id, Number(r.quantidade || 0)]));
        setSaldoObra(map);
        const temTudo = itens.length > 0 && itens.every((it) => (map[it.material_id] || 0) >= Number(it.quantidade));
        setOrigem(temTudo ? "obra" : "geral");
      })
      .catch(() => setSaldoObra({}));
  }, [st, estoque, obraPedido, itens]);
  const faltaNaObra = saldoObra ? itens.filter((it) => (saldoObra[it.material_id] || 0) < Number(it.quantidade)) : [];
  const nomeObraPedido = solicitacao.expand?.obra_id?.nome || "obra";
  const atual = passoAtual(st);
  const encerrada = ["Cancelada", "Rejeitada"].includes(st);
  return (
    <Card className="mb-6 border-primary/30">
      <CardHeader className="pb-2"><CardTitle className="text-lg">Andamento do pedido de material</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        {encerrada ? (
          <p className="text-sm font-medium text-red-700">Pedido {st.toLowerCase()}.</p>
        ) : (
          <>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden" role="progressbar" aria-label="Andamento"
            aria-valuemin={0} aria-valuemax={PASSOS.length} aria-valuenow={Math.max(atual, 0) + 1}>
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-ouro-escuro via-ouro to-ouro"
              initial={{ width: 0 }}
              animate={{ width: `${((Math.max(atual, 0) + 1) / PASSOS.length) * 100}%` }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </div>
          <ol className="flex flex-wrap gap-2" aria-label="Passos do pedido">
            {PASSOS.map((p, i) => (
              <li key={p.status} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border ${
                i < atual ? "bg-green-50 border-green-300 text-green-800" : i === atual ? "bg-primary text-primary-foreground border-royal font-semibold" : "text-muted-foreground"}`}>
                <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs">{i < atual ? "✓" : i + 1}</span>{p.rotulo}
              </li>
            ))}
          </ol>
          </>
        )}

        <div>
          <p className="text-sm font-semibold mb-2">Materiais pedidos</p>
          {itens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum material ainda. {podeEditarItens ? "Inclua abaixo o que precisa." : ""}</p>
          ) : (
            <div className="divide-y border rounded-lg">
              {itens.map((it) => (
                <div key={it.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-medium">{it.expand?.material_id?.name || "Material"}</span>
                  <span className="flex items-center gap-3">
                    <span>{it.quantidade} {it.unidade}</span>
                    {it.quantidade_entregue > 0 && <Badge variant="outline" className="text-green-700 border-green-300">entregue</Badge>}
                    {podeEditarItens && (
                      <Button size="sm" variant="ghost" title="Tirar" onClick={() => tirarItem(it.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
          {podeEditarItens && (
            <form onSubmit={incluirItem} className="flex flex-col sm:flex-row gap-2 mt-3">
              <div className="flex-1">
                <Select value={novoItem.material_id} onValueChange={(v) => setNovoItem({ ...novoItem, material_id: v })}>
                  <SelectTrigger aria-label="Material"><SelectValue placeholder="Escolha o material" /></SelectTrigger>
                  <SelectContent>
                    {materiais.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}{estoque ? ` (${m.quantity_in_stock || 0} ${m.unit} em estoque)` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Input type="number" min="0" step="0.01" placeholder="Quantidade" aria-label="Quantidade" className="sm:w-32"
                value={novoItem.quantidade} onChange={(e) => setNovoItem({ ...novoItem, quantidade: e.target.value })} />
              <Button type="submit"><Plus className="w-4 h-4 mr-1" />Incluir</Button>
            </form>
          )}
        </div>

        {solicitacao.foto_retirada && (
          <div className="flex items-center gap-3">
            <FotoProtegida record={solicitacao} />
            <div className="text-sm">
              <p className="font-semibold">Foto da retirada</p>
              {solicitacao.expand?.retirada_registrada_por && (
                <p className="text-muted-foreground">Registrada por {solicitacao.expand.retirada_registrada_por.name || solicitacao.expand.retirada_registrada_por.email}</p>
              )}
            </div>
          </div>
        )}

        {!encerrada && (
          <div className="flex flex-wrap gap-2 pt-1">
            {aberta && gestao && (
              <>
                <Button disabled={mudando || itens.length === 0} onClick={() => avancar("Aprovada", "Pedido recebido pelo estoque")}><CheckCircle2 className="w-4 h-4 mr-2" />Confirmar que recebi o pedido</Button>
                <Button variant="outline" disabled={mudando} onClick={() => avancar("Rejeitada", "Pedido recusado")}><XCircle className="w-4 h-4 mr-2" />Recusar</Button>
              </>
            )}
            {st === "Aprovada" && estoque && (
              <Button disabled={mudando} onClick={() => avancar("Em separação", "Separação iniciada")}><Package className="w-4 h-4 mr-2" />Começar a separar</Button>
            )}
            {st === "Em separação" && estoque && obraPedido && (
              <div className="w-full space-y-1">
                <Label htmlFor="origem-estoque">Separar de qual estoque</Label>
                <Select value={origem} onValueChange={setOrigem}>
                  <SelectTrigger id="origem-estoque" aria-label="Separar de qual estoque" className="sm:w-80"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral">Estoque geral</SelectItem>
                    <SelectItem value="obra">Estoque da obra {nomeObraPedido}</SelectItem>
                  </SelectContent>
                </Select>
                {origem === "obra" && faltaNaObra.length > 0 && (
                  <p className="text-xs text-amber-700">
                    Falta no estoque da obra: {faltaNaObra.map((it) => `${it.expand?.material_id?.name || "material"} (tem ${saldoObra?.[it.material_id] || 0})`).join(", ")}.
                  </p>
                )}
              </div>
            )}
            {st === "Em separação" && estoque && (
              <Button disabled={mudando} onClick={() => avancar("Pronto para retirada", "Material separado. Quem pediu foi avisado.",
                { estoque_obra_id: obraPedido && origem === "obra" ? obraPedido : "" })}>
                <Package className="w-4 h-4 mr-2" />Material separado, avisar quem pediu
              </Button>
            )}
            {["Pronto para retirada", "Concluída"].includes(st) && obraPedido && (
              <p className="w-full text-sm text-muted-foreground">
                Sai do {solicitacao.estoque_obra_id ? `estoque da obra ${nomeObraPedido}` : "estoque geral"}.
              </p>
            )}
            {st === "Pronto para retirada" && podeRetirar && !recusando && (
              confirmarEntrega ? (
                <div className="w-full space-y-3 p-3 border rounded-lg bg-amber-50 text-sm">
                  <p>{podeAceitar
                    ? "Conferiu tudo? Ao aceitar, o material sai do estoque e passa a ficar com você."
                    : `Retirada no balcão: confira o material com ${solicitacao.expand?.solicitante_id?.nome_completo || solicitacao.expand?.solicitante_id?.name || "quem pediu"}. Ao registrar, o material sai do estoque.`}</p>
                  <FotoRetirada onFoto={setFoto} rotulo="Foto de quem está levando o material" />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={mudando || !foto}
                      onClick={() => avancar("Concluída", "Retirada registrada com foto.", { foto_retirada: foto }).then(() => setFoto(null))}>
                      {podeAceitar ? "Sim, aceitar" : "Registrar retirada"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setConfirmarEntrega(false); setFoto(null); }}>Voltar</Button>
                  </div>
                  {!foto && <p className="text-xs text-muted-foreground">Sem a foto não dá para registrar a retirada.</p>}
                </div>
              ) : (
                <>
                  <Button onClick={() => setConfirmarEntrega(true)}><Truck className="w-4 h-4 mr-2" />
                    {podeAceitar ? "Conferir e aceitar o material" : "Registrar retirada no balcão"}</Button>
                  {podeAceitar && <Button variant="outline" onClick={() => setRecusando(true)}><XCircle className="w-4 h-4 mr-2" />Material errado</Button>}
                </>
              )
            )}
            {st === "Pronto para retirada" && podeAceitar && recusando && (
              <div className="w-full space-y-2 p-3 border rounded-lg bg-red-50 text-sm">
                <Label htmlFor="motivo-recusa">O que está errado?</Label>
                <Textarea id="motivo-recusa" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: pedi fio azul de 2,5 mm e veio de 1,5 mm" />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={mudando || !motivo.trim()}
                    onClick={() => avancar("Em separação", "Material recusado. O estoque vai corrigir.", { retirada_recusa_motivo: motivo.trim() }).then(() => { setRecusando(false); setMotivo(""); })}>
                    Recusar e devolver para o estoque
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRecusando(false)}>Voltar</Button>
                </div>
              </div>
            )}
            {st === "Pronto para retirada" && !podeRetirar && <p className="text-sm text-muted-foreground">Aguardando quem pediu conferir e aceitar o material na retirada.</p>}
            {st === "Entregue" && (podeAceitar || gestao) && (
              <Button disabled={mudando} onClick={() => avancar("Concluída", "Recebimento confirmado")}><CheckCircle2 className="w-4 h-4 mr-2" />Confirmar que recebi</Button>
            )}
            {st === "Em separação" && solicitacao.retirada_recusa_motivo && (
              <p className="w-full text-sm text-red-700">Material recusado na retirada: {solicitacao.retirada_recusa_motivo}</p>
            )}
            {aberta && !gestao && <p className="text-sm text-muted-foreground">Aguardando o estoque confirmar que recebeu o pedido.</p>}
            {["Aprovada", "Em separação"].includes(st) && !estoque && <p className="text-sm text-muted-foreground">O almoxarifado está preparando o seu pedido.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Info = ({ label, value }) => (
  <div><p className="text-xs text-muted-foreground uppercase">{label}</p><p className="font-medium">{value}</p></div>
);

export default SolicitacaoDetalhesPage;
