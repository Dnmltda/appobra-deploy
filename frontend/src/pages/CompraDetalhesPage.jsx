import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import pb from "@/lib/pocketbaseClient.js";
import { useAuth } from "@/contexts/AuthContext.jsx";
import { useCompras } from "@/hooks/useCompras.js";
import {  NIVEIS_APROVACAO, STATUS_APROVACAO,
  STATUS_RECEBIMENTO, TIPOS_ANEXO, statusColor, prioridadeColor,
  formatCurrency, formatDate, calcItemTotal,
} from "@/utils/comprasValidations.js";
import Header from "@/components/Header.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Pencil, FileText, Plus, Trash2, CheckCircle2, Download, Package, ClipboardCheck, Inbox,
} from "lucide-react";

const CompraDetalhesPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const h = useCompras();
  const [compra, setCompra] = useState(null);
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState([]);
  const [aprovacoes, setAprovacoes] = useState([]);
  const [recebimentos, setRecebimentos] = useState([]);
  const [anexos, setAnexos] = useState([]);
  const [historico, setHistorico] = useState([]);

  // modais
  const [itemModal, setItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState(emptyItem());
  const [aprovModal, setAprovModal] = useState(false);
  const [aprovForm, setAprovForm] = useState(emptyAprov());
  const [recModal, setRecModal] = useState(false);
  const [recForm, setRecForm] = useState(emptyRec());
  const [recFoto, setRecFoto] = useState(null);
  const [anexoModal, setAnexoModal] = useState(false);
  const [anexoForm, setAnexoForm] = useState({ tipo_anexo: "Orçamento", descricao: "" });
  const [anexoFile, setAnexoFile] = useState(null);

  function emptyItem() {
    return { material_id: "", codigo: "", descricao: "", unidade: "", quantidade: "", preco_unitario: "", desconto: 0, frete: 0, ipi: 0, icms: 0, observacoes: "" };
  }
  function emptyAprov() {
    return { nivel_aprovacao: "Supervisor", usuario_id: currentUser?.id || "", data_aprovacao: new Date().toISOString().split("T")[0], hora_aprovacao: new Date().toTimeString().slice(0, 5), status_aprovacao: "Aprovado", observacao: "" };
  }
  function emptyRec() {
    return { data_recebimento: new Date().toISOString().split("T")[0], hora_recebimento: new Date().toTimeString().slice(0, 5), responsavel_id: currentUser?.id || "", quantidade_recebida: "", quantidade_prevista: "", status_recebimento: "Completo", observacoes: "" };
  }

  const loadAll = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const c = await pb.collection("compras").getOne(id, { expand: "fornecedor_id,obra_id,solicitante_id,comprador_id,responsavel_aprovacao_id", $autoCancel: false });
      setCompra(c);
      const [it, ap, re, an, hi] = await Promise.all([
        h.fetchItens(id), h.fetchAprovacoes(id), h.fetchRecebimentos(id), h.fetchAnexos(id), h.fetchHistorico(id),
      ]);
      setItens(it); setAprovacoes(ap); setRecebimentos(re); setAnexos(an); setHistorico(hi);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar compra");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [id]);

  const refreshItens = async () => {
    const it = await h.fetchItens(id);
    setItens(it);
    const total = await h.recalcCompraValor(id);
    setCompra((prev) => (prev ? { ...prev, valor_final: total } : prev));
  };

  const submitItem = async (e) => {
    e.preventDefault();
    const res = editingItem ? await h.updateItem(editingItem.id, itemForm) : await h.addItem(id, itemForm);
    if (res.success) {
      toast.success(editingItem ? "Item atualizado" : "Item adicionado");
      setItemModal(false); setEditingItem(null); setItemForm(emptyItem());
      refreshItens();
    } else {
      if (res.errors?._form) toast.error(res.errors._form);
      else toast.error("Verifique os campos do item");
    }
  };

  const removeItem = async (itemId) => {
    const res = await h.deleteItem(itemId);
    if (res.success) { toast.success("Item removido"); refreshItens(); }
    else toast.error(res.error);
  };

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

  const submitRec = async (e) => {
    e.preventDefault();
    const res = await h.addRecebimento(id, recForm, recFoto);
    if (res.success) {
      toast.success("Recebimento registrado");
      setRecModal(false); setRecForm(emptyRec()); setRecFoto(null);
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
      setAnexoModal(false); setAnexoForm({ tipo_anexo: "Orçamento", descricao: "" }); setAnexoFile(null);
      const an = await h.fetchAnexos(id); setAnexos(an);
    } else {
      if (res.errors?._form) toast.error(res.errors._form);
    }
  };

  const removeAnexo = async (anexoId) => {
    const res = await h.deleteAnexo(anexoId);
    if (res.success) { toast.success("Anexo removido"); setAnexos(await h.fetchAnexos(id)); }
    else toast.error(res.error);
  };

  const gerarPDF = () => {
    import("jspdf").then(({ jsPDF }) => {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Compra ${compra.numero_compra || ""}`, 14, 18);
      doc.setFontSize(10);
      doc.text(`Fornecedor: ${compra.expand?.fornecedor_id?.nome || "-"}`, 14, 28);
      doc.text(`Status: ${compra.status}`, 14, 34);
      doc.text(`Data Solicitação: ${formatDate(compra.data_solicitacao)}`, 14, 40);
      doc.text(`Valor Total: ${formatCurrency(compra.valor_final || 0)}`, 14, 46);
      let y = 56;
      doc.text("Itens:", 14, y); y += 6;
      itens.forEach((it, i) => {
        doc.text(`${i + 1}. ${it.descricao} — ${it.quantidade} ${it.unidade} — ${formatCurrency(it.valor_total)}`, 14, y);
        y += 6;
      });
      doc.save(`compra-${compra.numero_compra || id}.pdf`);
      h.exportAudit("PDF ficha");
    });
  };

  if (loading) {
    return (
      <>
        <Helmet><title>Detalhes da Compra - APP OBRA</title></Helmet>
        <Header />
        <div className="app-container py-8"><Skeleton className="h-96 w-full" /></div>
      </>
    );
  }

  if (!compra) {
    return (
      <>
        <Helmet><title>Compra não encontrada - APP OBRA</title></Helmet>
        <Header />
        <div className="app-container py-16 text-center">
          <p className="text-muted-foreground mb-4">Compra não encontrada.</p>
          <Button onClick={() => navigate("/compras")}>Voltar para Compras</Button>
        </div>
      </>
    );
  }

  const subtotal = itens.reduce((a, i) => a + Number(i.quantidade || 0) * Number(i.preco_unitario || 0), 0);
  const descontos = itens.reduce((a, i) => a + Number(i.desconto || 0), 0);
  const fretes = itens.reduce((a, i) => a + Number(i.frete || 0), 0);
  const total = itens.reduce((a, i) => a + Number(i.valor_total || 0), 0);

  return (
    <>
      <Helmet><title>{`Compra ${compra.numero_compra || ""} - APP OBRA`}</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/20 min-h-screen">
        <div className="app-container">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => navigate("/compras")}><ArrowLeft className="w-4 h-4" /></Button>
              <div>
                <h1 className="text-2xl font-bold text-primary">{compra.numero_compra || "Compra"}</h1>
                <div className="flex gap-2 mt-1">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${statusColor(compra.status)}`}>{compra.status}</span>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${prioridadeColor(compra.prioridade)}`}>{compra.prioridade || "Normal"}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={gerarPDF}><FileText className="w-4 h-4 mr-2" />PDF</Button>
              {h.canEdit && compra.status !== "Cancelado" && <Button variant="outline" onClick={() => navigate(`/compras/${id}/editar`)}><Pencil className="w-4 h-4 mr-2" />Editar</Button>}
              {h.canApprove && !["Aprovado", "Recebido", "Cancelado"].includes(compra.status) && <Button onClick={() => setAprovModal(true)}><CheckCircle2 className="w-4 h-4 mr-2" />Aprovar</Button>}
              {h.canEdit && !["Recebido", "Cancelado"].includes(compra.status) && <Button onClick={() => setRecModal(true)}><Package className="w-4 h-4 mr-2" />Recebimento</Button>}
            </div>
          </div>

          {/* Dados principais */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-lg">Dados da Compra</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <Info label="Fornecedor" value={compra.expand?.fornecedor_id?.nome || compra.expand?.fornecedor_id?.razao_social || "-"} />
                <Info label="Solicitante" value={compra.expand?.solicitante_id?.nome_completo || compra.expand?.solicitante_id?.name || "-"} />
                <Info label="Obra" value={compra.expand?.obra_id?.nome || "-"} />
                <Info label="Categoria" value={compra.categoria || "-"} />
                <Info label="Centro de Custo" value={compra.centro_custo || "-"} />
                <Info label="Forma Pagamento" value={compra.forma_pagamento || "-"} />
                <Info label="Parcelas" value={compra.parcelas || 1} />
                <Info label="Data Solicitação" value={formatDate(compra.data_solicitacao)} />
                <Info label="Entrega Prevista" value={formatDate(compra.data_entrega_prevista)} />
                <Info label="Entrega Real" value={formatDate(compra.data_entrega_real)} />
                <Info label="Comprador" value={compra.expand?.comprador_id?.nome_completo || "-"} />
                <Info label="Responsável Aprovação" value={compra.expand?.responsavel_aprovacao_id?.nome_completo || "-"} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Valores</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Valor Previsto" value={formatCurrency(compra.valor_previsto)} />
                <Row label="Valor Aprovado" value={formatCurrency(compra.valor_aprovado)} />
                <div className="border-t pt-3">
                  <Row label="Subtotal Itens" value={formatCurrency(subtotal)} />
                  <Row label="Descontos" value={`- ${formatCurrency(descontos)}`} />
                  <Row label="Fretes" value={formatCurrency(fretes)} />
                  <Row label="Valor Final" value={formatCurrency(compra.valor_final || total)} bold />
                </div>
                {compra.justificativa && <div><p className="text-xs text-muted-foreground">Justificativa</p><p className="text-sm">{compra.justificativa}</p></div>}
                {compra.observacoes && <div><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm">{compra.observacoes}</p></div>}
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="itens">
            <TabsList className="mb-4">
              <TabsTrigger value="itens"><Package className="w-4 h-4 mr-1" />Itens</TabsTrigger>
              <TabsTrigger value="aprovacao"><ClipboardCheck className="w-4 h-4 mr-1" />Aprovação</TabsTrigger>
              <TabsTrigger value="recebimento"><Inbox className="w-4 h-4 mr-1" />Recebimento</TabsTrigger>
              <TabsTrigger value="anexos"><FileText className="w-4 h-4 mr-1" />Anexos</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            {/* ITENS */}
            <TabsContent value="itens">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-lg">Itens da Compra</CardTitle>
                  {h.canEdit && compra.status !== "Cancelado" && <Button size="sm" onClick={() => { setEditingItem(null); setItemForm(emptyItem()); setItemModal(true); }}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>}
                </CardHeader>
                <CardContent className="p-0">
                  {itens.length === 0 ? <p className="text-center py-8 text-muted-foreground">Nenhum item adicionado</p> : (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Material</TableHead><TableHead>Descrição</TableHead><TableHead>Un.</TableHead>
                        <TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Preço</TableHead>
                        <TableHead className="text-right">Desc.</TableHead><TableHead className="text-right">Frete</TableHead>
                        <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Ações</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {itens.map((it) => (
                          <TableRow key={it.id}>
                            <TableCell className="text-xs">{it.expand?.material_id?.name || "-"}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{it.descricao}</TableCell>
                            <TableCell>{it.unidade}</TableCell>
                            <TableCell className="text-right">{it.quantidade}</TableCell>
                            <TableCell className="text-right">{formatCurrency(it.preco_unitario)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(it.desconto)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(it.frete)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(it.valor_total)}</TableCell>
                            <TableCell className="text-right">
                              {h.canEdit && compra.status !== "Cancelado" && (
                                <div className="flex justify-end gap-1">
                                  <Button size="sm" variant="ghost" onClick={() => { setEditingItem(it); setItemForm({ material_id: it.material_id || "", codigo: it.codigo || "", descricao: it.descricao, unidade: it.unidade, quantidade: it.quantidade, preco_unitario: it.preco_unitario, desconto: it.desconto || 0, frete: it.frete || 0, ipi: it.ipi || 0, icms: it.icms || 0, observacoes: it.observacoes || "" }); setItemModal(true); }}><Pencil className="w-4 h-4" /></Button>
                                  <Button size="sm" variant="ghost" onClick={() => removeItem(it.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

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

            {/* RECEBIMENTO */}
            <TabsContent value="recebimento">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-lg">Recebimentos</CardTitle>
                  {h.canEdit && !["Recebido", "Cancelado"].includes(compra.status) && <Button size="sm" onClick={() => setRecModal(true)}><Plus className="w-4 h-4 mr-1" />Registrar</Button>}
                </CardHeader>
                <CardContent className="p-0">
                  {recebimentos.length === 0 ? <p className="text-center py-8 text-muted-foreground">Nenhum recebimento registrado</p> : (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Número</TableHead><TableHead>Data</TableHead><TableHead>Responsável</TableHead>
                        <TableHead className="text-right">Recebida</TableHead><TableHead className="text-right">Prevista</TableHead><TableHead>Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {recebimentos.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.numero_recebimento}</TableCell>
                            <TableCell>{formatDate(r.data_recebimento)} {r.hora_recebimento}</TableCell>
                            <TableCell>{r.expand?.responsavel_id?.nome_completo || r.expand?.responsavel_id?.name || "-"}</TableCell>
                            <TableCell className="text-right">{r.quantidade_recebida}</TableCell>
                            <TableCell className="text-right">{r.quantidade_prevista}</TableCell>
                            <TableCell><Badge variant="outline">{r.status_recebimento}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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

      {/* Modal Item */}
      <Dialog open={itemModal} onOpenChange={setItemModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? "Editar Item" : "Adicionar Item"}</DialogTitle></DialogHeader>
          <form onSubmit={submitItem} className="space-y-3">
            <div className="space-y-2">
              <Label>Material *</Label>
              <Select value={itemForm.material_id} onValueChange={(v) => {
                const m = h.materiais.find((x) => x.id === v);
                setItemForm({ ...itemForm, material_id: v, descricao: m?.name || itemForm.descricao, unidade: m?.unit || itemForm.unidade, preco_unitario: m?.unit_cost || itemForm.preco_unitario, codigo: m?.code || itemForm.codigo });
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{h.materiais.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Descrição *</Label><Input value={itemForm.descricao} onChange={(e) => setItemForm({ ...itemForm, descricao: e.target.value })} /></div>
              <div className="space-y-2"><Label>Unidade *</Label><Input value={itemForm.unidade} onChange={(e) => setItemForm({ ...itemForm, unidade: e.target.value })} /></div>
              <div className="space-y-2"><Label>Quantidade *</Label><Input type="number" step="0.01" min="0" value={itemForm.quantidade} onChange={(e) => setItemForm({ ...itemForm, quantidade: e.target.value })} /></div>
              <div className="space-y-2"><Label>Preço Unit. *</Label><Input type="number" step="0.01" min="0" value={itemForm.preco_unitario} onChange={(e) => setItemForm({ ...itemForm, preco_unitario: e.target.value })} /></div>
              <div className="space-y-2"><Label>Desconto</Label><Input type="number" step="0.01" min="0" value={itemForm.desconto} onChange={(e) => setItemForm({ ...itemForm, desconto: e.target.value })} /></div>
              <div className="space-y-2"><Label>Frete</Label><Input type="number" step="0.01" min="0" value={itemForm.frete} onChange={(e) => setItemForm({ ...itemForm, frete: e.target.value })} /></div>
              <div className="space-y-2"><Label>IPI (%)</Label><Input type="number" step="0.01" min="0" value={itemForm.ipi} onChange={(e) => setItemForm({ ...itemForm, ipi: e.target.value })} /></div>
              <div className="space-y-2"><Label>ICMS (%)</Label><Input type="number" step="0.01" min="0" value={itemForm.icms} onChange={(e) => setItemForm({ ...itemForm, icms: e.target.value })} /></div>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg text-sm flex justify-between"><span>Total calculado:</span><strong>{formatCurrency(calcItemTotal(itemForm))}</strong></div>
            <div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={itemForm.observacoes} onChange={(e) => setItemForm({ ...itemForm, observacoes: e.target.value })} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setItemModal(false)}>Cancelar</Button><Button type="submit">{editingItem ? "Atualizar" : "Adicionar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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

      {/* Modal Recebimento */}
      <Dialog open={recModal} onOpenChange={setRecModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Registrar Recebimento</DialogTitle></DialogHeader>
          <form onSubmit={submitRec} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Data *</Label><Input type="date" value={recForm.data_recebimento} onChange={(e) => setRecForm({ ...recForm, data_recebimento: e.target.value })} /></div>
              <div className="space-y-2"><Label>Hora *</Label><Input type="time" value={recForm.hora_recebimento} onChange={(e) => setRecForm({ ...recForm, hora_recebimento: e.target.value })} /></div>
              <div className="space-y-2 col-span-2"><Label>Responsável *</Label>
                <Select value={recForm.responsavel_id} onValueChange={(v) => setRecForm({ ...recForm, responsavel_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{h.usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_completo || u.name || u.email}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Qtd Recebida *</Label><Input type="number" step="0.01" min="0" value={recForm.quantidade_recebida} onChange={(e) => setRecForm({ ...recForm, quantidade_recebida: e.target.value })} /></div>
              <div className="space-y-2"><Label>Qtd Prevista *</Label><Input type="number" step="0.01" min="0" value={recForm.quantidade_prevista} onChange={(e) => setRecForm({ ...recForm, quantidade_prevista: e.target.value })} /></div>
              <div className="space-y-2 col-span-2"><Label>Status</Label>
                <Select value={recForm.status_recebimento} onValueChange={(v) => setRecForm({ ...recForm, status_recebimento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_RECEBIMENTO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2"><Label>Foto do Recebimento</Label><Input type="file" accept="image/*" onChange={(e) => setRecFoto(e.target.files?.[0] || null)} /></div>
            </div>
            <div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={recForm.observacoes} onChange={(e) => setRecForm({ ...recForm, observacoes: e.target.value })} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setRecModal(false)}>Cancelar</Button><Button type="submit">Registrar</Button></DialogFooter>
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
const Row = ({ label, value, bold }) => (
  <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className={bold ? "font-bold text-primary text-base" : "font-medium"}>{value}</span></div>
);

export default CompraDetalhesPage;
