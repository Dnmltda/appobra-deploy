// Hook customizado para o Módulo de Compras — APP OBRA
// CRUD de compras, itens, aprovações, recebimentos e anexos.
// Comunicação exclusiva via PocketBase existente (live data). Multitenancy por company_id.

import { useState, useEffect, useCallback } from "react";
import pb from "@/lib/pocketbaseClient.js";
import { useAuth } from "@/contexts/AuthContext.jsx";
import { auditLog, AUDIT_ACTIONS } from "@/lib/auditLogger.js";
import {
  validateCompraForm,
  validateItemForm,
  validateAprovacaoForm,
  validateRecebimentoForm,
  generateNumeroCompra,
  generateNumeroRecebimento,
  calcItemTotal,
} from "@/utils/comprasValidations.js";

const COL = "compras";
const ITENS = "compras_itens";
const APROV = "compras_aprovacao";
const RECEB = "compras_recebimento";
const ANEXO = "compras_anexos";

const buildFilter = ({ search, status, prioridade, obra, fornecedor, dataInicio, dataFim, valorMin, valorMax }) => {
  const parts = [];
  if (search) {
    const q = search.replace(/"/g, '\\"');
    parts.push(
      `(numero_compra ~ "${q}" || descricao ~ "${q}" || categoria ~ "${q}" || justificativa ~ "${q}")`,
    );
  }
  if (status && status !== "all") parts.push(`status = "${status}"`);
  if (prioridade && prioridade !== "all") parts.push(`prioridade = "${prioridade}"`);
  if (obra && obra !== "all") parts.push(`obra_id = "${obra}"`);
  if (fornecedor && fornecedor !== "all") parts.push(`fornecedor_id = "${fornecedor}"`);
  if (dataInicio) parts.push(`data_solicitacao >= "${dataInicio}"`);
  if (dataFim) parts.push(`data_solicitacao <= "${dataFim}"`);
  if (valorMin !== "" && valorMin != null) parts.push(`valor_final >= ${Number(valorMin)}`);
  if (valorMax !== "" && valorMax != null) parts.push(`valor_final <= ${Number(valorMax)}`);
  return parts.join(" && ");
};

export const useCompras = () => {
  const { currentUser, isAdmin } = useAuth();
  const [compras, setCompras] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [obras, setObras] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sort, setSort] = useState("-created");
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    prioridade: "all",
    obra: "all",
    fornecedor: "all",
    dataInicio: "",
    dataFim: "",
    valorMin: "",
    valorMax: "",
  });
  const [saving, setSaving] = useState(false);

  const canManage = isAdmin || currentUser?.cargo === "Administrador";
  const canEdit =
    isAdmin ||
    currentUser?.cargo === "Administrador" ||
    currentUser?.cargo === "Gerente" ||
    currentUser?.cargo === "Gerência" ||
    currentUser?.cargo === "Comprador";
  const canApprove =
    isAdmin ||
    currentUser?.cargo === "Administrador" ||
    currentUser?.cargo === "Gerente" ||
    currentUser?.cargo === "Gerência" ||
    currentUser?.cargo === "Engenheiro";

  const fetchAux = useCallback(async () => {
    if (!currentUser?.company_id) return;
    const cid = currentUser.company_id;
    try {
      // Cada lista carrega independente: antes, uma consulta com erro (materiais
      // ordenados por "nome", que não existe) zerava as quatro e o formulário de
      // compra abria sem fornecedor, obra, material nem usuário para escolher.
      const lista = (col, sort) =>
        pb.collection(col).getFullList({ filter: `company_id = "${cid}"`, sort, $autoCancel: false })
          .catch((err) => { console.error(`Erro ao carregar ${col}:`, err); return []; });
      const [f, o, m, u] = await Promise.all([
        lista("fornecedores", "nome"),
        lista("obras", "nome"),
        lista("materiais", "name"),
        lista("users", "nome_completo"),
      ]);
      setFornecedores(f);
      setObras(o);
      setMateriais(m);
      setUsuarios(u);
    } catch (err) {
      console.error("Erro ao carregar dados auxiliares:", err);
    }
  }, [currentUser]);

  const fetchCompras = useCallback(async () => {
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
        expand: "fornecedor_id,obra_id,solicitante_id,comprador_id",
        $autoCancel: false,
      });
      setCompras(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error("Erro ao carregar compras:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters, page, perPage, sort, currentUser]);

  useEffect(() => {
    fetchCompras();
    fetchAux();
  }, [fetchCompras, fetchAux]);

  // Realtime
  useEffect(() => {
    let active = true;
    const sub = pb
      .collection(COL)
      .subscribe("*", (e) => {
        if (!active) return;
        if (e.action === "delete") {
          setCompras((prev) => prev.filter((x) => x.id !== e.record.id));
          setTotalItems((n) => Math.max(0, n - 1));
        } else if (e.action === "create") {
          fetchCompras();
        } else if (e.action === "update") {
          setCompras((prev) => prev.map((x) => (x.id === e.record.id ? e.record : x)));
        }
      })
      .catch((err) => console.error("Realtime compras falhou", err));
    return () => {
      active = false;
      sub
        .then((unsub) => {
          try { unsub(); } catch (_) {}
        })
        .catch(() => {});
    };
  }, [fetchCompras]);

  const buildPayload = (data) => ({
    numero_compra: data.numero_compra || generateNumeroCompra(),
    company_id: currentUser.company_id,
    fornecedor_id: data.fornecedor_id,
    obra_id: data.obra_id || null,
    solicitante_id: data.solicitante_id,
    comprador_id: data.comprador_id || null,
    categoria: data.categoria?.trim(),
    subcategoria: data.subcategoria || "",
    centro_custo: data.centro_custo || "",
    prioridade: data.prioridade || "Normal",
    justificativa: data.justificativa || "",
    observacoes: data.observacoes || "",
    descricao: data.descricao || data.categoria || "",
    data_solicitacao: data.data_solicitacao,
    data_entrega_prevista: data.data_entrega_prevista || "",
    data_entrega_real: data.data_entrega_real || "",
    status: data.status || "Solicitado",
    valor_previsto: Number(data.valor_previsto || 0),
    valor_aprovado: Number(data.valor_aprovado || 0),
    valor_final: Number(data.valor_final || 0),
    forma_pagamento: data.forma_pagamento || "À Vista",
    parcelas: Number(data.parcelas || 1),
    responsavel_aprovacao_id: data.responsavel_aprovacao_id || null,
    data_aprovacao: data.data_aprovacao || "",
  });

  const createCompra = async (data) => {
    const { valid, errors } = validateCompraForm(data);
    if (!valid) return { success: false, errors };
    setSaving(true);
    try {
      const payload = buildPayload(data);
      payload.criado_por = currentUser.id;
      payload.atualizado_por = currentUser.id;
      const rec = await pb.collection(COL).create(payload, { $autoCancel: false });
      await auditLog(AUDIT_ACTIONS.RECORD_CREATED, "Compras", `Compra criada: ${rec.numero_compra} — ID ${rec.id}`, "success");
      return { success: true, record: rec };
    } catch (err) {
      console.error("Erro ao criar compra:", err);
      return { success: false, errors: { _form: err.message || "Erro ao cadastrar compra." } };
    } finally {
      setSaving(false);
    }
  };

  const updateCompra = async (id, data) => {
    const { valid, errors } = validateCompraForm(data);
    if (!valid) return { success: false, errors };
    setSaving(true);
    try {
      const payload = buildPayload(data);
      payload.atualizado_por = currentUser.id;
      const rec = await pb.collection(COL).update(id, payload, { $autoCancel: false });
      await auditLog(AUDIT_ACTIONS.RECORD_UPDATED, "Compras", `Compra editada: ${rec.numero_compra} — ID ${rec.id}`, "success");
      return { success: true, record: rec };
    } catch (err) {
      console.error("Erro ao atualizar compra:", err);
      return { success: false, errors: { _form: err.message || "Erro ao atualizar compra." } };
    } finally {
      setSaving(false);
    }
  };

  const cancelCompra = async (compra, motivo) => {
    try {
      const rec = await pb.collection(COL).update(
        compra.id,
        { status: "Cancelado", observacoes: `${compra.observacoes || ""}\n[Cancelamento] ${motivo}`.trim(), atualizado_por: currentUser.id },
        { $autoCancel: false },
      );
      await auditLog("Compra cancelada", "Compras", `Compra cancelada: ${compra.numero_compra} — Motivo: ${motivo}`, "success");
      return { success: true, record: rec };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const deleteCompra = async (compra) => {
    try {
      await pb.collection(COL).delete(compra.id, { $autoCancel: false });
      await auditLog(AUDIT_ACTIONS.RECORD_DELETED, "Compras", `Compra excluída: ${compra.numero_compra} — ID ${compra.id}`, "success");
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const duplicateCompra = (compra) => ({
    fornecedor_id: compra.fornecedor_id || "",
    obra_id: compra.obra_id || "",
    solicitante_id: compra.solicitante_id || currentUser.id,
    categoria: compra.categoria || "",
    subcategoria: compra.subcategoria || "",
    centro_custo: compra.centro_custo || "",
    prioridade: compra.prioridade || "Normal",
    justificativa: compra.justificativa || "",
    observacoes: compra.observacoes || "",
    data_solicitacao: new Date().toISOString().split("T")[0],
    data_entrega_prevista: "",
    status: "Solicitado",
    valor_previsto: compra.valor_previsto || 0,
    forma_pagamento: compra.forma_pagamento || "À Vista",
    parcelas: compra.parcelas || 1,
  });

  // ---------- ITENS ----------
  const fetchItens = async (compraId) => {
    try {
      return await pb.collection(ITENS).getFullList({
        filter: `compra_id = "${compraId}"`,
        expand: "material_id,fornecedor_id",
        sort: "created",
        $autoCancel: false,
      });
    } catch (err) {
      console.error("Erro ao carregar itens:", err);
      return [];
    }
  };

  const addItem = async (compraId, item) => {
    const { valid, errors } = validateItemForm(item);
    if (!valid) return { success: false, errors };
    try {
      const rec = await pb.collection(ITENS).create(
        {
          company_id: currentUser.company_id,
          compra_id: compraId,
          material_id: item.material_id,
          codigo: item.codigo || "",
          descricao: item.descricao,
          unidade: item.unidade,
          quantidade: Number(item.quantidade),
          preco_unitario: Number(item.preco_unitario),
          desconto: Number(item.desconto || 0),
          frete: Number(item.frete || 0),
          ipi: Number(item.ipi || 0),
          icms: Number(item.icms || 0),
          valor_total: calcItemTotal(item),
          fornecedor_id: item.fornecedor_id || null,
          observacoes: item.observacoes || "",
          criado_por: currentUser.id,
        },
        { $autoCancel: false },
      );
      await auditLog("Item adicionado", "Compras", `Item adicionado à compra: ${item.descricao}`, "success");
      return { success: true, record: rec };
    } catch (err) {
      return { success: false, errors: { _form: err.message } };
    }
  };

  const updateItem = async (id, item) => {
    const { valid, errors } = validateItemForm(item);
    if (!valid) return { success: false, errors };
    try {
      const rec = await pb.collection(ITENS).update(
        id,
        {
          material_id: item.material_id,
          codigo: item.codigo || "",
          descricao: item.descricao,
          unidade: item.unidade,
          quantidade: Number(item.quantidade),
          preco_unitario: Number(item.preco_unitario),
          desconto: Number(item.desconto || 0),
          frete: Number(item.frete || 0),
          ipi: Number(item.ipi || 0),
          icms: Number(item.icms || 0),
          valor_total: calcItemTotal(item),
          fornecedor_id: item.fornecedor_id || null,
          observacoes: item.observacoes || "",
        },
        { $autoCancel: false },
      );
      return { success: true, record: rec };
    } catch (err) {
      return { success: false, errors: { _form: err.message } };
    }
  };

  const deleteItem = async (id) => {
    try {
      await pb.collection(ITENS).delete(id, { $autoCancel: false });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const recalcCompraValor = async (compraId) => {
    try {
      const itens = await fetchItens(compraId);
      const total = itens.reduce((acc, i) => acc + Number(i.valor_total || 0), 0);
      await pb.collection(COL).update(compraId, { valor_final: total, atualizado_por: currentUser.id }, { $autoCancel: false });
      return total;
    } catch (err) {
      console.error("Erro ao recalcular valor:", err);
      return 0;
    }
  };

  // ---------- APROVAÇÕES ----------
  const fetchAprovacoes = async (compraId) => {
    try {
      return await pb.collection(APROV).getFullList({
        filter: `compra_id = "${compraId}"`,
        expand: "usuario_id",
        sort: "data_aprovacao",
        $autoCancel: false,
      });
    } catch (err) {
      return [];
    }
  };

  const addAprovacao = async (compraId, data) => {
    const { valid, errors } = validateAprovacaoForm(data);
    if (!valid) return { success: false, errors };
    try {
      const rec = await pb.collection(APROV).create(
        {
          company_id: currentUser.company_id,
          compra_id: compraId,
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
      // Atualiza status da compra conforme aprovação
      if (data.status_aprovacao === "Aprovado") {
        await pb.collection(COL).update(compraId, { status: "Aprovado", responsavel_aprovacao_id: data.usuario_id, data_aprovacao: data.data_aprovacao, atualizado_por: currentUser.id }, { $autoCancel: false });
      } else if (data.status_aprovacao === "Rejeitado") {
        await pb.collection(COL).update(compraId, { status: "Cancelado", atualizado_por: currentUser.id }, { $autoCancel: false });
      }
      await auditLog("Compra aprovada", "Compras", `Aprovação ${data.status_aprovacao} — nível ${data.nivel_aprovacao}`, "success");
      return { success: true, record: rec };
    } catch (err) {
      return { success: false, errors: { _form: err.message } };
    }
  };

  // ---------- RECEBIMENTOS ----------
  const fetchRecebimentos = async (compraId) => {
    try {
      return await pb.collection(RECEB).getFullList({
        filter: `compra_id = "${compraId}"`,
        expand: "responsavel_id",
        sort: "-data_recebimento",
        $autoCancel: false,
      });
    } catch (err) {
      return [];
    }
  };

  const addRecebimento = async (compraId, data, fotoFile = null) => {
    const { valid, errors } = validateRecebimentoForm(data);
    if (!valid) return { success: false, errors };
    try {
      const fd = new FormData();
      fd.append("company_id", currentUser.company_id);
      fd.append("compra_id", compraId);
      fd.append("numero_recebimento", data.numero_recebimento || generateNumeroRecebimento());
      fd.append("data_recebimento", data.data_recebimento);
      fd.append("hora_recebimento", data.hora_recebimento);
      fd.append("responsavel_id", data.responsavel_id);
      fd.append("quantidade_recebida", Number(data.quantidade_recebida));
      fd.append("quantidade_prevista", Number(data.quantidade_prevista));
      fd.append("status_recebimento", data.status_recebimento || "Completo");
      fd.append("observacoes", data.observacoes || "");
      fd.append("criado_por", currentUser.id);
      if (fotoFile) fd.append("foto_recebimento", fotoFile);
      const rec = await pb.collection(RECEB).create(fd, { $autoCancel: false });
      const novoStatus = data.status_recebimento === "Completo" ? "Recebido" : "Parcialmente Recebido";
      await pb.collection(COL).update(compraId, { status: novoStatus, data_entrega_real: data.data_recebimento, atualizado_por: currentUser.id }, { $autoCancel: false });
      await auditLog("Recebimento registrado", "Compras", `Recebimento ${data.status_recebimento} — qtd ${data.quantidade_recebida}`, "success");
      return { success: true, record: rec };
    } catch (err) {
      return { success: false, errors: { _form: err.message } };
    }
  };

  // ---------- ANEXOS ----------
  const fetchAnexos = async (compraId) => {
    try {
      return await pb.collection(ANEXO).getFullList({
        filter: `compra_id = "${compraId}"`,
        sort: "-created",
        $autoCancel: false,
      });
    } catch (err) {
      return [];
    }
  };

  const addAnexo = async (compraId, data, file) => {
    if (!file) return { success: false, errors: { arquivo: "Arquivo é obrigatório." } };
    try {
      const fd = new FormData();
      fd.append("company_id", currentUser.company_id);
      fd.append("compra_id", compraId);
      fd.append("tipo_anexo", data.tipo_anexo);
      fd.append("arquivo", file);
      fd.append("descricao", data.descricao || "");
      fd.append("criado_por", currentUser.id);
      const rec = await pb.collection(ANEXO).create(fd, { $autoCancel: false });
      await auditLog("Anexo adicionado", "Compras", `Anexo ${data.tipo_anexo} adicionado`, "success");
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

  const fetchHistorico = async (compraId) => {
    try {
      const logs = await pb.collection("audit_logs").getList(1, 20, {
        filter: `modulo = "Compras" && detalhes ~ "${compraId}"`,
        sort: "-created",
        $autoCancel: false,
      });
      return logs.items;
    } catch (err) {
      return [];
    }
  };

  const exportAudit = async (tipo) => {
    await auditLog(AUDIT_ACTIONS.EXPORT_DATA, "Compras", `Exportação ${tipo} da lista de compras`, "success");
  };

  return {
    compras, fornecedores, obras, materiais, usuarios,
    totalItems, totalPages, loading, error,
    page, perPage, sort, filters, saving,
    canManage, canEdit, canApprove,
    setPage, setPerPage, setSort, setFilters,
    fetchCompras, fetchAux,
    createCompra, updateCompra, cancelCompra, deleteCompra, duplicateCompra,
    fetchItens, addItem, updateItem, deleteItem, recalcCompraValor,
    fetchAprovacoes, addAprovacao,
    fetchRecebimentos, addRecebimento,
    fetchAnexos, addAnexo, deleteAnexo, fileUrl,
    fetchHistorico, exportAudit,
  };
};

export default useCompras;
