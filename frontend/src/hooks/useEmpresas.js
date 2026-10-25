// Hook customizado para o Módulo Cadastro de Empresas — APP OBRA
// CRUD, busca, filtros, paginação, contagens relacionadas, auditoria e upload de logo.
// Comunicação exclusiva via PocketBase existente (live data).

import { useState, useEffect, useCallback } from "react";
import pb from "@/lib/pocketbaseClient.js";
import { useAuth } from "@/contexts/AuthContext.jsx";
import { auditLog, AUDIT_ACTIONS } from "@/lib/auditLogger.js";
import { validateEmpresaForm } from "@/utils/empresasValidations.js";

const COLLECTION = "empresas";

// Collections que possuem company_id (para contagens na página de detalhes).
const COUNT_COLLECTIONS = [
  { key: "usuarios", collection: "users", label: "Usuários" },
  { key: "obras", collection: "obras", label: "Obras" },
  { key: "equipamentos", collection: "equipamentos", label: "Equipamentos" },
  { key: "documentos", collection: "documentos", label: "Documentos" },
  { key: "solicitacoes", collection: "solicitacoes", label: "Solicitações" },
  { key: "compras", collection: "compras", label: "Compras" },
  { key: "materiais", collection: "materiais", label: "Materiais" },
  { key: "epis", collection: "epis", label: "EPIs" },
  { key: "clientes", collection: "clientes", label: "Clientes" },
];

const buildFilter = ({ search, status, plano, estado, dataInicio, dataFim }) => {
  const parts = [];
  if (search) {
    const q = search.replace(/\\/g, '').replace(/"/g, '\\"');
    parts.push(
      `(razao_social ~ "${q}" || nome_fantasia ~ "${q}" || cnpj ~ "${q}" || cidade ~ "${q}" || responsavel_legal ~ "${q}")`,
    );
  }
  if (status && status !== "all") parts.push(`status = "${status}"`);
  if (plano && plano !== "all") parts.push(`plano = "${plano}"`);
  if (estado && estado !== "all") parts.push(`estado = "${estado}"`);
  if (dataInicio) parts.push(`created >= "${dataInicio} 00:00:00"`);
  if (dataFim) parts.push(`created <= "${dataFim} 23:59:59"`);
  return parts.join(" && ");
};

export const useEmpresas = () => {
  const { currentUser, isAdmin } = useAuth();
  const [empresas, setEmpresas] = useState([]);
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
    plano: "all",
    estado: "all",
    dataInicio: "",
    dataFim: "",
  });
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState({});
  const [countsLoading, setCountsLoading] = useState(false);

  const canEdit = isAdmin || currentUser?.cargo === "Administrador" || currentUser?.cargo === "Gerência";
  const canManage = isAdmin || currentUser?.cargo === "Administrador";

  const fetchEmpresas = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const filter = buildFilter(filters);
      const result = await pb.collection(COLLECTION).getList(page, perPage, {
        filter: filter || "",
        sort,
        $autoCancel: false,
      });
      setEmpresas(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error("Erro ao carregar empresas:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters, page, perPage, sort]);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  // Realtime — atualização automática da lista
  useEffect(() => {
    let active = true;
    const sub = pb
      .collection(COLLECTION)
      .subscribe("*", (e) => {
        if (!active) return;
        if (e.action === "delete") {
          setEmpresas((prev) => prev.filter((x) => x.id !== e.record.id));
          setTotalItems((n) => Math.max(0, n - 1));
        } else if (e.action === "create") {
          fetchEmpresas();
        } else if (e.action === "update") {
          setEmpresas((prev) => prev.map((x) => (x.id === e.record.id ? e.record : x)));
        }
      })
      .catch((err) => console.error("Realtime empresas falhou", err));

    return () => {
      active = false;
      sub.then((unsub) => {
        try {
          unsub();
        } catch (_) {}
      }).catch(() => {});
    };
  }, [fetchEmpresas]);

  const fetchCounts = useCallback(async (empresaId) => {
    setCountsLoading(true);
    setCounts({});
    try {
      const results = await Promise.allSettled(
        COUNT_COLLECTIONS.map((c) =>
          pb
            .collection(c.collection)
            .getList(1, 1, {
              filter: `company_id = "${empresaId}"`,
              $autoCancel: false,
            })
            .then((r) => ({ key: c.key, label: c.label, total: r.totalItems })),
        ),
      );
      const map = {};
      results.forEach((r) => {
        if (r.status === "fulfilled") map[r.value.key] = r.value;
      });
      setCounts(map);
    } catch (err) {
      console.error("Erro ao carregar contagens:", err);
    } finally {
      setCountsLoading(false);
    }
  }, []);

  const fetchHistorico = useCallback(async (empresaId) => {
    try {
      const logs = await pb.collection("audit_logs").getList(1, 50, {
        filter: `modulo = "Empresas" && detalhes ~ "${empresaId}"`,
        sort: "-created",
        $autoCancel: false,
      });
      return logs.items;
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
      return [];
    }
  }, []);

  const buildPayload = (data) => ({
    razao_social: data.razao_social?.trim(),
    nome_fantasia: data.nome_fantasia?.trim(),
    cnpj: String(data.cnpj || "").replace(/\D/g, ""),
    inscricao_estadual: data.inscricao_estadual || "",
    inscricao_municipal: data.inscricao_municipal || "",
    cep: String(data.cep || "").replace(/\D/g, ""),
    endereco: data.endereco?.trim(),
    numero: String(data.numero || "").trim(),
    complemento: data.complemento || "",
    bairro: data.bairro?.trim(),
    cidade: data.cidade?.trim(),
    estado: String(data.estado || "").toUpperCase().trim(),
    pais: data.pais || "Brasil",
    telefone: String(data.telefone || "").replace(/\D/g, ""),
    whatsapp: data.whatsapp ? String(data.whatsapp).replace(/\D/g, "") : "",
    email: data.email?.trim().toLowerCase(),
    website: data.website || "",
    responsavel_legal: data.responsavel_legal?.trim(),
    cpf_responsavel: String(data.cpf_responsavel || "").replace(/\D/g, ""),
    plano: data.plano || "Básico",
    status: data.status || "Ativo",
    observacoes: data.observacoes || "",
  });

  const checkDuplicate = async (cnpj, razao, excludeId = null) => {
    const cnpjClean = String(cnpj || "").replace(/\D/g, "");
    const parts = [];
    if (cnpjClean) parts.push(`cnpj = "${cnpjClean}"`);
    if (razao) parts.push(`razao_social = "${razao.replace(/\\/g, '').replace(/"/g, '\\"')}"`);
    if (parts.length === 0) return false;
    let filter = parts.join(" || ");
    if (excludeId) filter += ` && id != "${excludeId}"`;
    try {
      const res = await pb.collection(COLLECTION).getList(1, 1, { filter, $autoCancel: false });
      return res.totalItems > 0;
    } catch {
      return false;
    }
  };

  const createEmpresa = async (data, logoFile = null) => {
    const { valid, errors } = validateEmpresaForm(data);
    if (!valid) return { success: false, errors };

    const dup = await checkDuplicate(data.cnpj, data.razao_social);
    if (dup) {
      return {
        success: false,
        errors: { cnpj: "Já existe uma empresa com este CNPJ ou razão social." },
      };
    }

    setSaving(true);
    try {
      const fd = new FormData();
      const payload = buildPayload(data);
      payload.criado_por = currentUser?.id;
      payload.atualizado_por = currentUser?.id;
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) fd.append(k, v);
      });
      if (logoFile) fd.append("logo", logoFile);

      const rec = await pb.collection(COLLECTION).create(fd, { $autoCancel: false });
      await auditLog(
        AUDIT_ACTIONS.RECORD_CREATED,
        "Empresas",
        `Empresa criada: ${rec.razao_social} (CNPJ ${rec.cnpj}) — ID ${rec.id}`,
        "success",
      );
      return { success: true, record: rec };
    } catch (err) {
      console.error("Erro ao criar empresa:", err);
      return { success: false, errors: { _form: err.message || "Erro ao cadastrar empresa." } };
    } finally {
      setSaving(false);
    }
  };

  const updateEmpresa = async (id, data, logoFile = null, removeLogo = false) => {
    const { valid, errors } = validateEmpresaForm(data);
    if (!valid) return { success: false, errors };

    const dup = await checkDuplicate(data.cnpj, data.razao_social, id);
    if (dup) {
      return {
        success: false,
        errors: { cnpj: "Já existe outra empresa com este CNPJ ou razão social." },
      };
    }

    setSaving(true);
    try {
      const fd = new FormData();
      const payload = buildPayload(data);
      payload.atualizado_por = currentUser?.id;
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) fd.append(k, v);
      });
      if (logoFile) fd.append("logo", logoFile);
      if (removeLogo) fd.append("logo", "");

      const rec = await pb.collection(COLLECTION).update(id, fd, { $autoCancel: false });
      await auditLog(
        AUDIT_ACTIONS.RECORD_UPDATED,
        "Empresas",
        `Empresa editada: ${rec.razao_social} — ID ${rec.id}`,
        "success",
      );
      return { success: true, record: rec };
    } catch (err) {
      console.error("Erro ao atualizar empresa:", err);
      return { success: false, errors: { _form: err.message || "Erro ao atualizar empresa." } };
    } finally {
      setSaving(false);
    }
  };

  const deleteEmpresa = async (id, nome) => {
    try {
      await pb.collection(COLLECTION).delete(id, { $autoCancel: false });
      await auditLog(
        AUDIT_ACTIONS.RECORD_DELETED,
        "Empresas",
        `Empresa excluída: ${nome || id} — ID ${id}`,
        "success",
      );
      return { success: true };
    } catch (err) {
      console.error("Erro ao excluir empresa:", err);
      return { success: false, error: err.message || "Erro ao excluir empresa." };
    }
  };

  const toggleStatus = async (empresa) => {
    const novoStatus = empresa.status === "Ativo" ? "Inativo" : "Ativo";
    try {
      const rec = await pb.collection(COLLECTION).update(
        empresa.id,
        { status: novoStatus, atualizado_por: currentUser?.id },
        { $autoCancel: false },
      );
      await auditLog(
        novoStatus === "Ativo" ? "Empresa ativada" : "Empresa desativada",
        "Empresas",
        `${novoStatus === "Ativo" ? "Ativada" : "Desativada"}: ${empresa.razao_social} — ID ${empresa.id}`,
        "success",
      );
      return { success: true, record: rec };
    } catch (err) {
      console.error("Erro ao alterar status:", err);
      return { success: false, error: err.message };
    }
  };

  const exportAudit = async (tipo) => {
    await auditLog(
      AUDIT_ACTIONS.EXPORT_DATA,
      "Empresas",
      `Exportação ${tipo} da lista de empresas`,
      "success",
    );
  };

  return {
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
    counts,
    countsLoading,
    canEdit,
    canManage,
    setPage,
    setPerPage,
    setSort,
    setFilters,
    fetchEmpresas,
    fetchCounts,
    fetchHistorico,
    createEmpresa,
    updateEmpresa,
    deleteEmpresa,
    toggleStatus,
    exportAudit,
  };
};

export default useEmpresas;
