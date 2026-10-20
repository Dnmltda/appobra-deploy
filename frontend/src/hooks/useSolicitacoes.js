// Hook customizado para o Módulo de Solicitações — APP OBRA
// CRUD de solicitações, aprovações e anexos.
// Comunicação exclusiva via PocketBase existente (live data). Multitenancy por company_id.

import { useState, useEffect, useCallback } from "react";
import pb from "@/lib/pocketbaseClient.js";
import { useAuth } from "@/contexts/AuthContext.jsx";
import { auditLog, AUDIT_ACTIONS } from "@/lib/auditLogger.js";
import {
  validateSolicitacaoForm,
  validateAprovacaoForm,
  generateNumeroSolicitacao,
} from "@/utils/solicitacoesValidations.js";
import { ehAdmin, podeGerirSolicitacoes } from "@/lib/permissoes.js";
import { mensagemErro } from "@/lib/erros.js";

const COL = "solicitacoes";
const APROV = "solicitacoes_aprovacao";
const ANEXO = "solicitacoes_anexos";

const buildFilter = ({ search, tipo, status, prioridade, obra, departamento, responsavel, dataInicio, dataFim }) => {
  const parts = [];
  if (search) {
    const q = search.replace(/"/g, '\\"');
    parts.push(
      `(numero_solicitacao ~ "${q}" || descricao ~ "${q}" || categoria ~ "${q}" || departamento ~ "${q}")`,
    );
  }
  if (tipo && tipo !== "all") parts.push(`tipo = "${tipo}"`);
  if (status && status !== "all") parts.push(`status = "${status}"`);
  if (prioridade && prioridade !== "all") parts.push(`prioridade = "${prioridade}"`);
  if (obra && obra !== "all") parts.push(`obra_id = "${obra}"`);
  if (responsavel && responsavel !== "all") parts.push(`responsavel_id = "${responsavel}"`);
  if (departamento) parts.push(`departamento ~ "${departamento.replace(/"/g, '\\"')}"`);
  if (dataInicio) parts.push(`data_solicitacao >= "${dataInicio}"`);
  if (dataFim) parts.push(`data_solicitacao <= "${dataFim}"`);
  return parts.join(" && ");
};

export const useSolicitacoes = () => {
  const { currentUser, isAdmin } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [obras, setObras] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sort, setSort] = useState("-created");
  const [filters, setFilters] = useState({
    search: "", tipo: "all", status: "all", prioridade: "all",
    obra: "all", departamento: "", responsavel: "all", dataInicio: "", dataFim: "",
  });
  const [saving, setSaving] = useState(false);

  // Mesma regra do servidor (lib/permissoes.js). Antes usava "Gerente" e
  // "Supervisor", que não são cargos do app, e deixava Almoxarife de fora.
  const canManage = isAdmin || ehAdmin(currentUser);
  const canEdit = isAdmin || podeGerirSolicitacoes(currentUser);
  const canApprove = isAdmin || podeGerirSolicitacoes(currentUser);

  const fetchAux = useCallback(async () => {
    if (!currentUser?.company_id) return;
    const cid = currentUser.company_id;
    try {
      const [o, u] = await Promise.all([
        pb.collection("obras").getFullList({ filter: `company_id = "${cid}"`, sort: "nome", $autoCancel: false }),
        pb.collection("users").getFullList({ filter: `company_id = "${cid}"`, sort: "nome_completo", $autoCancel: false }),
      ]);
      setObras(o);
      setUsuarios(u);
    } catch (err) {
      console.error("Erro ao carregar dados auxiliares:", err);
    }
  }, [currentUser]);

  const fetchSolicitacoes = useCallback(async () => {
    if (!currentUser?.company_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const filter = buildFilter(filters);
      const result = await pb.collection(COL).getList(page, perPage, {
        filter: filter || "",
        sort,
        expand: "solicitante_id,obra_id,responsavel_id",
        $autoCancel: false,
      });
      setSolicitacoes(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error("Erro ao carregar solicitações:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters, page, perPage, sort, currentUser]);

  useEffect(() => {
    fetchSolicitacoes();
    fetchAux();
  }, [fetchSolicitacoes, fetchAux]);

  // Realtime
  useEffect(() => {
    let active = true;
    const sub = pb
      .collection(COL)
      .subscribe("*", (e) => {
        if (!active) return;
        if (e.action === "delete") {
          setSolicitacoes((prev) => prev.filter((x) => x.id !== e.record.id));
          setTotalItems((n) => Math.max(0, n - 1));
        } else if (e.action === "create") {
          fetchSolicitacoes();
        } else if (e.action === "update") {
          setSolicitacoes((prev) => prev.map((x) => (x.id === e.record.id ? e.record : x)));
        }
      })
      .catch((err) => console.error("Realtime solicitacoes falhou", err));
    return () => {
      active = false;
      sub
        .then((unsub) => { try { unsub(); } catch (_) {} })
        .catch(() => {});
    };
  }, [fetchSolicitacoes]);

  const buildPayload = (data) => ({
    numero_solicitacao: data.numero_solicitacao || generateNumeroSolicitacao(),
    company_id: currentUser.company_id,
    tipo: data.tipo,
    categoria: data.categoria || "",
    solicitante_id: data.solicitante_id,
    departamento: data.departamento || "",
    centro_custo: data.centro_custo || "",
    obra_id: data.obra_id || null,
    responsavel_id: data.responsavel_id || null,
    prioridade: data.prioridade || "Normal",
    descricao: data.descricao,
    justificativa: data.justificativa || "",
    data_solicitacao: data.data_solicitacao,
    data_prazo: data.data_prazo || "",
    status: data.status || "Aberta",
    observacoes: data.observacoes || "",
  });

  const createSolicitacao = async (data) => {
    const { valid, errors } = validateSolicitacaoForm(data);
    if (!valid) return { success: false, errors };
    setSaving(true);
    try {
      const payload = buildPayload(data);
      payload.criado_por = currentUser.id;
      payload.atualizado_por = currentUser.id;
      const rec = await pb.collection(COL).create(payload, { $autoCancel: false });
      await auditLog(AUDIT_ACTIONS.RECORD_CREATED, "Solicitações", `Solicitação criada: ${rec.numero_solicitacao} — ID ${rec.id}`, "success");
      return { success: true, record: rec };
    } catch (err) {
      console.error("Erro ao criar solicitação:", err);
      return { success: false, errors: { _form: err.message || "Erro ao cadastrar solicitação." } };
    } finally {
      setSaving(false);
    }
  };

  const updateSolicitacao = async (id, data) => {
    const { valid, errors } = validateSolicitacaoForm(data);
    if (!valid) return { success: false, errors };
    setSaving(true);
    try {
      const payload = buildPayload(data);
      payload.atualizado_por = currentUser.id;
      const rec = await pb.collection(COL).update(id, payload, { $autoCancel: false });
      await auditLog(AUDIT_ACTIONS.RECORD_UPDATED, "Solicitações", `Solicitação editada: ${rec.numero_solicitacao} — ID ${rec.id}`, "success");
      return { success: true, record: rec };
    } catch (err) {
      console.error("Erro ao atualizar solicitação:", err);
      return { success: false, errors: { _form: err.message || "Erro ao atualizar solicitação." } };
    } finally {
      setSaving(false);
    }
  };

  const cancelSolicitacao = async (solicitacao, motivo) => {
    try {
      const rec = await pb.collection(COL).update(
        solicitacao.id,
        { status: "Cancelada", observacoes: `${solicitacao.observacoes || ""}\n[Cancelamento] ${motivo}`.trim(), atualizado_por: currentUser.id },
        { $autoCancel: false },
      );
      await auditLog("Solicitação cancelada", "Solicitações", `Solicitação cancelada: ${solicitacao.numero_solicitacao} — Motivo: ${motivo}`, "success");
      return { success: true, record: rec };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const concluirSolicitacao = async (solicitacao) => {
    try {
      const rec = await pb.collection(COL).update(
        solicitacao.id,
        { status: "Concluída", atualizado_por: currentUser.id },
        { $autoCancel: false },
      );
      await auditLog("Solicitação concluída", "Solicitações", `Solicitação concluída: ${solicitacao.numero_solicitacao}`, "success");
      return { success: true, record: rec };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const deleteSolicitacao = async (solicitacao) => {
    try {
      await pb.collection(COL).delete(solicitacao.id, { $autoCancel: false });
      await auditLog(AUDIT_ACTIONS.RECORD_DELETED, "Solicitações", `Solicitação excluída: ${solicitacao.numero_solicitacao} — ID ${solicitacao.id}`, "success");
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const duplicateSolicitacao = (solicitacao) => ({
    tipo: solicitacao.tipo || "",
    categoria: solicitacao.categoria || "",
    solicitante_id: solicitacao.solicitante_id || currentUser.id,
    departamento: solicitacao.departamento || "",
    centro_custo: solicitacao.centro_custo || "",
    obra_id: solicitacao.obra_id || "",
    responsavel_id: solicitacao.responsavel_id || "",
    prioridade: solicitacao.prioridade || "Normal",
    descricao: solicitacao.descricao || "",
    justificativa: solicitacao.justificativa || "",
    data_solicitacao: new Date().toISOString().split("T")[0],
    data_prazo: "",
    status: "Aberta",
    observacoes: solicitacao.observacoes || "",
  });

  // ---------- APROVAÇÕES ----------
  const fetchAprovacoes = async (solicitacaoId) => {
    try {
      return await pb.collection(APROV).getFullList({
        filter: `solicitacao_id = "${solicitacaoId}"`,
        expand: "usuario_id",
        sort: "data_aprovacao",
        $autoCancel: false,
      });
    } catch (err) {
      return [];
    }
  };

  const addAprovacao = async (solicitacaoId, data) => {
    const { valid, errors } = validateAprovacaoForm(data);
    if (!valid) return { success: false, errors };
    try {
      const rec = await pb.collection(APROV).create(
        {
          company_id: currentUser.company_id,
          solicitacao_id: solicitacaoId,
          nivel_aprovacao: data.nivel_aprovacao,
          usuario_id: data.usuario_id,
          data_aprovacao: data.data_aprovacao,
          hora_aprovacao: data.hora_aprovacao,
          status_aprovacao: data.status_aprovacao,
          observacao: data.observacao || "",
          criado_por: currentUser.id,
        },
        { $autoCancel: false },
      );
      if (data.status_aprovacao === "Aprovado") {
        await pb.collection(COL).update(solicitacaoId, { status: "Aprovada", responsavel_id: data.usuario_id, atualizado_por: currentUser.id }, { $autoCancel: false });
      } else if (data.status_aprovacao === "Rejeitado") {
        await pb.collection(COL).update(solicitacaoId, { status: "Rejeitada", atualizado_por: currentUser.id }, { $autoCancel: false });
      }
      await auditLog("Solicitação aprovada", "Solicitações", `Aprovação ${data.status_aprovacao} — nível ${data.nivel_aprovacao}`, "success");
      return { success: true, record: rec };
    } catch (err) {
      return { success: false, errors: { _form: err.message } };
    }
  };

  // ---------- ITENS (materiais pedidos) ----------
  const fetchItens = async (solicitacaoId) => {
    try {
      return await pb.collection("solicitacoes_itens").getFullList({
        filter: `solicitacao_id = "${solicitacaoId}"`, expand: "material_id", sort: "created", $autoCancel: false,
      });
    } catch (err) {
      return [];
    }
  };

  const addItem = async (solicitacaoId, materialId, quantidade) => {
    try {
      await pb.collection("solicitacoes_itens").create(
        { solicitacao_id: solicitacaoId, material_id: materialId, quantidade: Number(quantidade) }, { $autoCancel: false },
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: mensagemErro(err, "Não foi possível incluir o material.") };
    }
  };

  const removeItem = async (itemId) => {
    try {
      await pb.collection("solicitacoes_itens").delete(itemId, { $autoCancel: false });
      return { success: true };
    } catch (err) {
      return { success: false, error: mensagemErro(err, "Não foi possível tirar o material.") };
    }
  };

  // Próximo passo do fluxo de material (o servidor confere a ordem e, na
  // entrega, dá a baixa no estoque).
  const mudarStatus = async (solicitacao, status, extra = {}) => {
    try {
      const rec = await pb.collection(COL).update(solicitacao.id, { ...extra, status, atualizado_por: currentUser.id }, { $autoCancel: false });
      await auditLog("Solicitação: " + status, "Solicitações", `${solicitacao.numero_solicitacao}: ${solicitacao.status} → ${status}`, "success");
      return { success: true, record: rec };
    } catch (err) {
      return { success: false, error: mensagemErro(err, "Não foi possível mudar o passo.") };
    }
  };

  // ---------- ANEXOS ----------
  const fetchAnexos = async (solicitacaoId) => {
    try {
      return await pb.collection(ANEXO).getFullList({
        filter: `solicitacao_id = "${solicitacaoId}"`,
        sort: "-created",
        $autoCancel: false,
      });
    } catch (err) {
      return [];
    }
  };

  const addAnexo = async (solicitacaoId, data, file) => {
    if (!file) return { success: false, errors: { arquivo: "Arquivo é obrigatório." } };
    try {
      const fd = new FormData();
      fd.append("company_id", currentUser.company_id);
      fd.append("solicitacao_id", solicitacaoId);
      fd.append("tipo_anexo", data.tipo_anexo);
      fd.append("arquivo", file);
      fd.append("descricao", data.descricao || "");
      fd.append("criado_por", currentUser.id);
      const rec = await pb.collection(ANEXO).create(fd, { $autoCancel: false });
      await auditLog("Anexo adicionado", "Solicitações", `Anexo ${data.tipo_anexo} adicionado`, "success");
      return { success: true, record: rec };
    } catch (err) {
      return { success: false, errors: { _form: err.message } };
    }
  };

  const deleteAnexo = async (id) => {
    try {
      await pb.collection(ANEXO).delete(id, { $autoCancel: false });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const fileUrl = (record, field) => {
    try {
      return pb.files.getURL(record, record[field]);
    } catch {
      return "";
    }
  };

  const fetchHistorico = async (solicitacaoId) => {
    try {
      const logs = await pb.collection("audit_logs").getList(1, 20, {
        filter: `modulo = "Solicitações" && detalhes ~ "${solicitacaoId}"`,
        sort: "-created",
        $autoCancel: false,
      });
      return logs.items;
    } catch (err) {
      return [];
    }
  };

  const exportAudit = async (tipo) => {
    await auditLog(AUDIT_ACTIONS.EXPORT_DATA, "Solicitações", `Exportação ${tipo} da lista de solicitações`, "success");
  };

  return {
    solicitacoes, obras, usuarios,
    totalItems, totalPages, loading, error,
    page, perPage, sort, filters, saving,
    canManage, canEdit, canApprove,
    setPage, setPerPage, setSort, setFilters,
    fetchSolicitacoes, fetchAux,
    createSolicitacao, updateSolicitacao, cancelSolicitacao, concluirSolicitacao,
    deleteSolicitacao, duplicateSolicitacao,
    fetchAprovacoes, addAprovacao,
    fetchAnexos, addAnexo, deleteAnexo, fileUrl,
    fetchHistorico, exportAudit,
    fetchItens, addItem, removeItem, mudarStatus,
  };
};

export default useSolicitacoes;
