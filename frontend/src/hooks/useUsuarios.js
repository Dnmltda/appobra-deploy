// Hook customizado para o Módulo Cadastro de Usuários — APP OBRA
// CRUD, busca, filtros, paginação, bloqueio/desbloqueio, ativar/desativar,
// reset de senha, duplicação, contagens relacionadas e auditoria.
// Comunicação exclusiva via PocketBase existente (live data). Não altera AuthContext.

import { useState, useEffect, useCallback } from "react";
import pb from "@/lib/pocketbaseClient.js";
import { useAuth } from "@/contexts/AuthContext.jsx";
import { auditLog, AUDIT_ACTIONS } from "@/lib/auditLogger.js";
import {
  validateUsuarioForm,
  generateIdUnico,
  generateTempPassword,
  formatCPF,
  formatPhone,
} from "@/utils/usuariosValidations.js";

const COLLECTION = "users";

const buildFilter = ({ search, status, perfil, empresa, departamento, dataInicio, dataFim }) => {
  const parts = [];
  if (search) {
    const q = search.replace(/"/g, '\\"');
    parts.push(
      `(nome_completo ~ "${q}" || username ~ "${q}" || email ~ "${q}" || cpf ~ "${q}" || id_unico ~ "${q}")`,
    );
  }
  if (status && status !== "all") parts.push(`status = "${status}"`);
  if (perfil && perfil !== "all") parts.push(`perfil_acesso = "${perfil}"`);
  if (empresa && empresa !== "all") parts.push(`company_id = "${empresa}"`);
  if (departamento) parts.push(`departamento ~ "${departamento.replace(/"/g, '\\"')}"`);
  if (dataInicio) parts.push(`created >= "${dataInicio} 00:00:00"`);
  if (dataFim) parts.push(`created <= "${dataFim} 23:59:59"`);
  return parts.join(" && ");
};

export const useUsuarios = () => {
  const { currentUser, isAdmin } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [obras, setObras] = useState([]);
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
    perfil: "all",
    empresa: "all",
    departamento: "",
    dataInicio: "",
    dataFim: "",
  });
  const [saving, setSaving] = useState(false);

  // Admin vê todas as empresas; não-admin vê apenas a própria empresa.
  const canManage = isAdmin || currentUser?.cargo === "Administrador";
  const canEdit =
    isAdmin ||
    currentUser?.cargo === "Administrador" ||
    currentUser?.cargo === "Gerente" ||
    currentUser?.cargo === "Gerência";

  // Cada administrador só pode ver e vincular usuários à própria empresa —
  // nunca a outras empresas do sistema. Corrigido: antes buscava TODAS as
  // empresas sem filtro nenhum quando isAdmin=true, permitindo que um admin
  // de uma empresa escolhesse outra empresa ao criar um usuário.
  // Corrigido: a collection "empresas" (plural) está sempre vazia — nunca foi
  // usada de fato. A empresa real do usuário vive em "companies" (mesma
  // collection usada em todo o resto do app: materiais, equipamentos,
  // compras...). Mapeamos "name" para "razao_social" aqui para não precisar
  // alterar a exibição em UsuariosPage.jsx.
  const fetchEmpresas = useCallback(async () => {
    if (!currentUser?.company_id) {
      setEmpresas([]);
      return;
    }
    try {
      const rec = await pb.collection("companies").getOne(currentUser.company_id, {
        $autoCancel: false,
      });
      setEmpresas([{ ...rec, razao_social: rec.name }]);
    } catch (err) {
      console.error("Erro ao carregar empresas:", err);
    }
  }, [currentUser?.company_id]);

  const fetchObras = useCallback(async () => {
    try {
      const list = await pb.collection("obras").getFullList({
        sort: "nome",
        $autoCancel: false,
      });
      setObras(list);
    } catch (err) {
      console.error("Erro ao carregar obras:", err);
    }
  }, []);

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const userFilter = buildFilter(filters);
      // Camada extra de defesa no frontend: sempre restringe explicitamente
      // a company_id do usuario logado, alem da PocketBase Rule (fonte
      // de verdade). Nao substitui a regra do backend.
      const companyFilter = currentUser?.company_id ? `company_id = "${currentUser.company_id}"` : "";
      const filter = [companyFilter, userFilter].filter(Boolean).join(" && ");
      const result = await pb.collection(COLLECTION).getList(page, perPage, {
        filter: filter || "",
        sort,
        expand: "company_id,obra_vinculada_id",
        $autoCancel: false,
      });
      setUsuarios(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters, page, perPage, sort]);

  useEffect(() => {
    fetchUsuarios();
    fetchEmpresas();
    fetchObras();
  }, [fetchUsuarios, fetchEmpresas, fetchObras]);

  // Realtime — atualização automática da lista
  useEffect(() => {
    let active = true;
    const sub = pb
      .collection(COLLECTION)
      .subscribe("*", (e) => {
        if (!active) return;
        if (e.action === "delete") {
          setUsuarios((prev) => prev.filter((x) => x.id !== e.record.id));
          setTotalItems((n) => Math.max(0, n - 1));
        } else if (e.action === "create") {
          fetchUsuarios();
        } else if (e.action === "update") {
          setUsuarios((prev) => prev.map((x) => (x.id === e.record.id ? e.record : x)));
        }
      })
      .catch((err) => console.error("Realtime users falhou", err));

    return () => {
      active = false;
      sub
        .then((unsub) => {
          try {
            unsub();
          } catch (_) {}
        })
        .catch(() => {});
    };
  }, [fetchUsuarios]);

  const checkDuplicate = async ({ email, username, id_unico, cpf }, excludeId = null) => {
    const checks = [];
    if (email) checks.push(`email = "${String(email).trim().toLowerCase()}"`);
    if (username) checks.push(`username = "${String(username).trim().toLowerCase()}"`);
    if (id_unico) checks.push(`id_unico = "${String(id_unico).trim()}"`);
    if (cpf) {
      const clean = String(cpf).replace(/\D/g, "");
      if (clean) checks.push(`cpf = "${clean}"`);
    }
    if (checks.length === 0) return null;
    let filter = checks.join(" || ");
    if (excludeId) filter += ` && id != "${excludeId}"`;
    try {
      const res = await pb.collection(COLLECTION).getList(1, 1, { filter, $autoCancel: false });
      if (res.totalItems === 0) return null;
      const r = res.items[0];
      if (r.email === String(email).trim().toLowerCase()) return { field: "email", msg: "Email já cadastrado." };
      if (r.username === String(username).trim().toLowerCase()) return { field: "username", msg: "Username já cadastrado." };
      if (r.id_unico === String(id_unico).trim()) return { field: "id_unico", msg: "ID único já cadastrado." };
      return { field: "cpf", msg: "CPF já cadastrado." };
    } catch {
      return null;
    }
  };

  const buildPayload = (data) => {
    const payload = {
      nome_completo: data.nome_completo?.trim(),
      name: data.nome_completo?.trim(),
      email: String(data.email || "").trim().toLowerCase(),
      username: String(data.username || "").trim().toLowerCase(),
      id_unico: String(data.id_unico || "").trim(),
      cargo: data.cargo?.trim(),
      perfil_acesso: data.perfil_acesso || "",
      departamento: data.departamento || "",
      centro_custo: data.centro_custo || "",
      company_id: currentUser?.company_id || null,
      obra_vinculada_id: data.obra_vinculada_id || null,
      telefone: String(data.telefone || "").replace(/\D/g, ""),
      cpf: data.cpf ? String(data.cpf).replace(/\D/g, "") : "",
      rg: data.rg || "",
      data_admissao: data.data_admissao || "",
      data_demissao: data.data_demissao || "",
      status: data.status || "Ativo",
      is_active: (data.status || "Ativo") === "Ativo",
      is_blocked: !!data.bloqueado,
      observacoes: data.observacoes || "",
      // O cargo define as permissões (tela e servidor); role acompanha o cargo.
      role: data.cargo || data.perfil_acesso || "Funcionário",
    };
    return payload;
  };

  const createUsuario = async (data, fotoFile = null) => {
    const { valid, errors } = validateUsuarioForm(data, "create");
    if (!valid) return { success: false, errors };

    const dup = await checkDuplicate(data);
    if (dup) return { success: false, errors: { [dup.field]: dup.msg } };

    setSaving(true);
    try {
      const fd = new FormData();
      const payload = buildPayload(data);
      payload.password = data.password;
      payload.passwordConfirm = data.passwordConfirm;
      payload.login_attempts = 0;
      payload.created_by = currentUser?.id;
      payload.updated_by = currentUser?.id;
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) fd.append(k, v);
      });
      if (fotoFile) fd.append("foto", fotoFile);

      const rec = await pb.collection(COLLECTION).create(fd, { $autoCancel: false });
      await auditLog(
        AUDIT_ACTIONS.USER_CREATED,
        "Usuários",
        `Usuário criado: ${rec.nome_completo || rec.email} (ID ${rec.id}) — perfil ${rec.perfil_acesso || rec.cargo}`,
        "success",
      );
      return { success: true, record: rec };
    } catch (err) {
      console.error("Erro ao criar usuário:", err);
      return { success: false, errors: { _form: err.message || "Erro ao cadastrar usuário." } };
    } finally {
      setSaving(false);
    }
  };

  const updateUsuario = async (id, data, fotoFile = null, removeFoto = false) => {
    const { valid, errors } = validateUsuarioForm(data, "edit");
    if (!valid) return { success: false, errors };

    const dup = await checkDuplicate(data, id);
    if (dup) return { success: false, errors: { [dup.field]: dup.msg } };

    setSaving(true);
    try {
      const fd = new FormData();
      const payload = buildPayload(data);
      payload.updated_by = currentUser?.id;
      if (data.password) {
        payload.password = data.password;
        payload.passwordConfirm = data.passwordConfirm;
      }
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) fd.append(k, v);
      });
      if (fotoFile) fd.append("foto", fotoFile);
      if (removeFoto) fd.append("foto", "");

      const rec = await pb.collection(COLLECTION).update(id, fd, { $autoCancel: false });
      await auditLog(
        AUDIT_ACTIONS.USER_UPDATED,
        "Usuários",
        `Usuário editado: ${rec.nome_completo || rec.email} — ID ${rec.id}`,
        "success",
      );
      return { success: true, record: rec };
    } catch (err) {
      console.error("Erro ao atualizar usuário:", err);
      return { success: false, errors: { _form: err.message || "Erro ao atualizar usuário." } };
    } finally {
      setSaving(false);
    }
  };

  const deleteUsuario = async (id, nome) => {
    try {
      await pb.collection(COLLECTION).delete(id, { $autoCancel: false });
      await auditLog(
        AUDIT_ACTIONS.USER_DELETED,
        "Usuários",
        `Usuário excluído: ${nome || id} — ID ${id}`,
        "success",
      );
      return { success: true };
    } catch (err) {
      console.error("Erro ao excluir usuário:", err);
      return { success: false, error: err.message || "Erro ao excluir usuário." };
    }
  };

  const blockUsuario = async (usuario) => {
    try {
      const rec = await pb.collection(COLLECTION).update(
        usuario.id,
        {
          is_blocked: true,
          status: "Bloqueado",
          locked_until: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          updated_by: currentUser?.id,
        },
        { $autoCancel: false },
      );
      await auditLog(
        AUDIT_ACTIONS.USER_BLOCKED,
        "Usuários",
        `Usuário bloqueado: ${usuario.nome_completo || usuario.email} — ID ${usuario.id}`,
        "success",
      );
      return { success: true, record: rec };
    } catch (err) {
      console.error("Erro ao bloquear:", err);
      return { success: false, error: err.message };
    }
  };

  const unblockUsuario = async (usuario) => {
    try {
      const rec = await pb.collection(COLLECTION).update(
        usuario.id,
        {
          is_blocked: false,
          status: "Ativo",
          login_attempts: 0,
          locked_until: "",
          updated_by: currentUser?.id,
        },
        { $autoCancel: false },
      );
      await auditLog(
        AUDIT_ACTIONS.USER_UNBLOCKED,
        "Usuários",
        `Usuário desbloqueado: ${usuario.nome_completo || usuario.email} — ID ${usuario.id}`,
        "success",
      );
      return { success: true, record: rec };
    } catch (err) {
      console.error("Erro ao desbloquear:", err);
      return { success: false, error: err.message };
    }
  };

  const activateUsuario = async (usuario) => {
    try {
      const rec = await pb.collection(COLLECTION).update(
        usuario.id,
        { status: "Ativo", is_active: true, is_blocked: false, updated_by: currentUser?.id },
        { $autoCancel: false },
      );
      await auditLog(
        AUDIT_ACTIONS.USER_ACTIVATED,
        "Usuários",
        `Usuário ativado: ${usuario.nome_completo || usuario.email} — ID ${usuario.id}`,
        "success",
      );
      return { success: true, record: rec };
    } catch (err) {
      console.error("Erro ao ativar:", err);
      return { success: false, error: err.message };
    }
  };

  const deactivateUsuario = async (usuario) => {
    try {
      const rec = await pb.collection(COLLECTION).update(
        usuario.id,
        { status: "Inativo", is_active: false, updated_by: currentUser?.id },
        { $autoCancel: false },
      );
      await auditLog(
        AUDIT_ACTIONS.USER_DEACTIVATED,
        "Usuários",
        `Usuário desativado: ${usuario.nome_completo || usuario.email} — ID ${usuario.id}`,
        "success",
      );
      return { success: true, record: rec };
    } catch (err) {
      console.error("Erro ao desativar:", err);
      return { success: false, error: err.message };
    }
  };

  const resetPassword = async (usuario) => {
    const tempPwd = generateTempPassword();
    try {
      await pb.collection(COLLECTION).update(
        usuario.id,
        {
          password: tempPwd,
          passwordConfirm: tempPwd,
          login_attempts: 0,
          locked_until: "",
          is_blocked: false,
          updated_by: currentUser?.id,
        },
        { $autoCancel: false },
      );
      await auditLog(
        AUDIT_ACTIONS.PASSWORD_RESET_SUCCESS,
        "Usuários",
        `Senha resetada para: ${usuario.nome_completo || usuario.email} — ID ${usuario.id}`,
        "success",
      );
      return { success: true, tempPassword: tempPwd };
    } catch (err) {
      console.error("Erro ao resetar senha:", err);
      return { success: false, error: err.message };
    }
  };

  const fetchCounts = async (userId, companyId) => {
    const queries = [
      { key: "obras", col: "obras", filter: `responsavel_user_id = "${userId}"` },
      { key: "solicitacoes", col: "solicitacoes_compra", filter: `solicitante_id = "${userId}"` },
      { key: "compras", col: "compras", filter: `criado_por = "${userId}"` },
      { key: "equipamentos", col: "equipamentos", filter: `responsavel_id = "${userId}"` },
      { key: "epis", col: "epis_entregas", filter: `responsavel_id = "${userId}"` },
      { key: "documentos", col: "documentos", filter: `criado_por = "${userId}"` },
    ];
    const results = await Promise.allSettled(
      queries.map((q) =>
        pb.collection(q.col).getList(1, 1, { filter: q.filter, $autoCancel: false }).then((r) => [q.key, r.totalItems]),
      ),
    );
    const map = {};
    results.forEach((r) => {
      if (r.status === "fulfilled") map[r.value[0]] = r.value[1];
    });
    return map;
  };

  const fetchHistorico = async (userId) => {
    try {
      const logs = await pb.collection("audit_logs").getList(1, 20, {
        filter: `modulo = "Usuários" && (detalhes ~ "${userId}" || usuario_id = "${userId}")`,
        sort: "-created",
        $autoCancel: false,
      });
      return logs.items;
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
      return [];
    }
  };

  const exportAudit = async (tipo) => {
    await auditLog(AUDIT_ACTIONS.EXPORT_DATA, "Usuários", `Exportação ${tipo} da lista de usuários`, "success");
  };

  return {
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
    canManage,
    canEdit,
    setPage,
    setPerPage,
    setSort,
    setFilters,
    fetchUsuarios,
    createUsuario,
    updateUsuario,
    deleteUsuario,
    blockUsuario,
    unblockUsuario,
    activateUsuario,
    deactivateUsuario,
    resetPassword,
    fetchCounts,
    fetchHistorico,
    exportAudit,
    generateIdUnico,
    formatCPF,
    formatPhone,
  };
};

export default useUsuarios;
